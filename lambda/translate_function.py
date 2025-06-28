# lambda/translate_function.py
# ENHANCED: Fixed AWS Lambda function with proper translation logic

import json
import boto3
import os
import uuid
from datetime import datetime
from typing import Dict, List, Any, Optional
import traceback

# Initialize AWS clients
s3_client = boto3.client('s3')
translate_client = boto3.client('translate')

# Environment variables
REQUEST_BUCKET = os.environ.get('REQUEST_BUCKET')
RESPONSE_BUCKET = os.environ.get('RESPONSE_BUCKET')
AWS_REGION = os.environ.get('AWS_REGION', 'us-east-1')

# Enhanced supported languages
SUPPORTED_LANGUAGES = {
    'en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh', 'ar', 'hi',
    'nl', 'sv', 'no', 'da', 'fi', 'pl', 'tr', 'th', 'vi', 'zh-TW', 'pt-PT',
    'fr-CA', 'es-MX', 'cs', 'hu', 'ro', 'bg', 'hr', 'sk', 'sl', 'et', 'lv', 'lt'
}

def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Enhanced Lambda handler with proper error handling and logging."""
    
    request_id = context.aws_request_id if context else str(uuid.uuid4())
    
    try:
        print(f"🚀 Starting translation request: {request_id}")
        print(f"📋 Event: {json.dumps(event, default=str)[:500]}...")
        
        # Handle CORS preflight
        if event.get('httpMethod') == 'OPTIONS':
            print("✈️ Handling CORS preflight request")
            return create_response(200, {'message': 'CORS preflight successful'})
        
        # Parse request body
        request_data = parse_request_body(event)
        if not request_data:
            print("❌ No request data provided")
            return create_response(400, {
                'error': 'Request body is required',
                'example': {
                    'source_language': 'en',
                    'target_language': 'es',
                    'texts': ['Hello, world!']
                }
            })
        
        print(f"📝 Parsed request data: {json.dumps(request_data, default=str)}")
        
        # Validate request
        validation_error = validate_request(request_data)
        if validation_error:
            print(f"❌ Validation error: {validation_error}")
            return create_response(400, {'error': validation_error})
        
        # Generate translation ID
        translation_id = str(uuid.uuid4())
        print(f"🔖 Translation ID: {translation_id}")
        
        # Perform translation
        print("🔄 Starting translation process...")
        translation_result = perform_translation(request_data, translation_id)
        
        # Save to S3 buckets
        try:
            print("💾 Saving request and response to S3...")
            save_request_and_response(request_data, translation_result, translation_id)
            print("✅ Successfully saved to S3")
        except Exception as s3_error:
            print(f"⚠️ Failed to save to S3: {s3_error}")
            # Don't fail the translation if S3 save fails
        
        print(f"🎉 Translation completed successfully: {translation_result['request_metadata']['successful_translations']} successful")
        return create_response(200, translation_result)
        
    except Exception as e:
        error_msg = str(e)
        print(f"❌ Critical error: {error_msg}")
        print(f"🔍 Traceback: {traceback.format_exc()}")
        
        return create_response(500, {
            'error': f"Translation service error: {error_msg}",
            'request_id': request_id,
            'timestamp': datetime.now().isoformat()
        })


def create_response(status_code: int, body_data: Any) -> Dict[str, Any]:
    """Create API Gateway response with proper CORS headers."""
    response = {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token',
            'Access-Control-Allow-Methods': 'GET,POST,OPTIONS,PUT,DELETE',
            'Access-Control-Allow-Credentials': 'false'
        },
        'body': json.dumps(body_data, default=str, ensure_ascii=False)
    }
    
    print(f"📤 Response: {status_code} - {json.dumps(body_data, default=str)[:200]}...")
    return response


def parse_request_body(event: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Parse request body from API Gateway event with enhanced error handling."""
    try:
        body = event.get('body')
        if not body:
            print("⚠️ No body in request")
            return None
        
        print(f"📋 Raw body: {str(body)[:200]}...")
        
        # Handle base64 encoded body
        if event.get('isBase64Encoded'):
            import base64
            body = base64.b64decode(body).decode('utf-8')
            print("🔓 Decoded base64 body")
        
        # Parse JSON
        if isinstance(body, str):
            parsed_body = json.loads(body)
            print(f"📊 Parsed JSON successfully: {list(parsed_body.keys()) if isinstance(parsed_body, dict) else type(parsed_body)}")
            return parsed_body
        else:
            print("📊 Body already parsed")
            return body
        
    except json.JSONDecodeError as e:
        print(f"❌ JSON decode error: {e}")
        return None
    except Exception as e:
        print(f"❌ Error parsing request body: {e}")
        return None


def validate_request(request_data: Dict[str, Any]) -> Optional[str]:
    """Enhanced request validation with detailed error messages."""
    
    try:
        # Check if request_data is a dict
        if not isinstance(request_data, dict):
            return f"Request must be a JSON object, got {type(request_data)}"
        
        # Check required fields
        required_fields = ['source_language', 'target_language', 'texts']
        for field in required_fields:
            if field not in request_data:
                return f"Missing required field: '{field}'"
        
        # Validate languages
        source_lang = request_data['source_language']
        target_lang = request_data['target_language']
        
        if not isinstance(source_lang, str) or source_lang not in SUPPORTED_LANGUAGES:
            return f"Unsupported source language: '{source_lang}'. Supported: {sorted(list(SUPPORTED_LANGUAGES)[:10])}..."
        
        if not isinstance(target_lang, str) or target_lang not in SUPPORTED_LANGUAGES:
            return f"Unsupported target language: '{target_lang}'. Supported: {sorted(list(SUPPORTED_LANGUAGES)[:10])}..."
        
        # Validate texts
        texts = request_data['texts']
        if not isinstance(texts, list):
            return f"Field 'texts' must be a list, got {type(texts)}"
        
        if not texts:
            return "Field 'texts' cannot be empty"
        
        if len(texts) > 100:
            return f"Too many texts: {len(texts)} (maximum 100)"
        
        # Check individual texts
        for i, text in enumerate(texts):
            if not isinstance(text, str):
                return f"Text at index {i} must be a string, got {type(text)}"
            
            if len(text.encode('utf-8')) > 5000:
                return f"Text at index {i} exceeds 5000 bytes ({len(text.encode('utf-8'))} bytes)"
        
        print(f"✅ Validation passed: {len(texts)} texts, {source_lang} -> {target_lang}")
        return None
        
    except Exception as e:
        print(f"❌ Validation error: {e}")
        return f"Validation error: {str(e)}"


def perform_translation(request_data: Dict[str, Any], translation_id: str) -> Dict[str, Any]:
    """Enhanced translation with retry logic and better error handling."""
    
    source_lang = request_data['source_language']
    target_lang = request_data['target_language']
    texts = request_data['texts']
    
    print(f"🔄 Translating {len(texts)} texts from {source_lang} to {target_lang}")
    
    translations = []
    successful_count = 0
    failed_count = 0
    total_characters = 0
    
    for i, text in enumerate(texts):
        print(f"🔄 Processing text {i+1}/{len(texts)}: {text[:50]}...")
        
        if not text or not text.strip():
            print(f"⏭️ Skipping empty text at index {i}")
            translations.append({
                'original_text': text,
                'translated_text': '',
                'index': i,
                'status': 'skipped',
                'reason': 'empty_text'
            })
            continue
        
        try:
            # Validate text length
            text_bytes = len(text.strip().encode('utf-8'))
            if text_bytes > 5000:
                print(f"⚠️ Text {i+1} too long: {text_bytes} bytes")
                translations.append({
                    'original_text': text,
                    'translated_text': None,
                    'index': i,
                    'status': 'error',
                    'error': f'Text too long: {text_bytes} bytes (max 5000)'
                })
                failed_count += 1
                continue
            
            # Call AWS Translate with retry logic
            max_retries = 3
            for attempt in range(max_retries):
                try:
                    print(f"🌐 Calling AWS Translate (attempt {attempt + 1})...")
                    response = translate_client.translate_text(
                        Text=text.strip(),
                        SourceLanguageCode=source_lang,
                        TargetLanguageCode=target_lang
                    )
                    
                    translated_text = response['TranslatedText']
                    total_characters += len(translated_text)
                    successful_count += 1
                    
                    translations.append({
                        'original_text': text,
                        'translated_text': translated_text,
                        'index': i,
                        'status': 'success',
                        'source_language_detected': response.get('SourceLanguageCode', source_lang),
                        'target_language': response.get('TargetLanguageCode', target_lang),
                        'character_count': len(translated_text)
                    })
                    
                    print(f"✅ Text {i+1} translated: '{text[:30]}...' -> '{translated_text[:30]}...'")
                    break
                    
                except Exception as translate_error:
                    if attempt == max_retries - 1:
                        # Final attempt failed
                        error_msg = str(translate_error)
                        print(f"❌ Translation failed after {max_retries} attempts: {error_msg}")
                        
                        translations.append({
                            'original_text': text,
                            'translated_text': None,
                            'index': i,
                            'status': 'error',
                            'error': error_msg
                        })
                        failed_count += 1
                    else:
                        print(f"⚠️ Attempt {attempt + 1} failed, retrying...")
                        import time
                        time.sleep(0.5 * (attempt + 1))  # Exponential backoff
            
        except Exception as e:
            error_msg = str(e)
            print(f"❌ Unexpected error processing text {i+1}: {error_msg}")
            
            translations.append({
                'original_text': text,
                'translated_text': None,
                'index': i,
                'status': 'error',
                'error': error_msg
            })
            failed_count += 1
    
    # Calculate statistics
    total_texts = len(texts)
    success_rate = round((successful_count / total_texts * 100), 2) if total_texts > 0 else 0
    
    result = {
        'request_metadata': {
            'source_language': source_lang,
            'target_language': target_lang,
            'total_texts': total_texts,
            'successful_translations': successful_count,
            'failed_translations': failed_count,
            'timestamp': datetime.now().isoformat(),
            'translation_id': translation_id
        },
        'translations': translations,
        'summary': {
            'success_rate': success_rate,
            'total_characters_translated': total_characters
        }
    }
    
    print(f"📊 Translation summary: {successful_count}/{total_texts} successful ({success_rate}%)")
    return result


def save_request_and_response(request_data: Dict[str, Any], translation_result: Dict[str, Any], translation_id: str) -> None:
    """Save both request and response to respective S3 buckets."""
    
    if not REQUEST_BUCKET or not RESPONSE_BUCKET:
        print("⚠️ S3 buckets not configured, skipping save")
        return
    
    timestamp = datetime.now().strftime('%Y%m%d-%H%M%S')
    
    try:
        # Save request to request bucket
        request_key = f"request-{timestamp}-{translation_id[:8]}.json"
        request_object = {
            'request_data': request_data,
            'metadata': {
                'translation_id': translation_id,
                'timestamp': datetime.now().isoformat(),
                'source_language': request_data.get('source_language'),
                'target_language': request_data.get('target_language'),
                'text_count': len(request_data.get('texts', []))
            }
        }
        
        s3_client.put_object(
            Bucket=REQUEST_BUCKET,
            Key=request_key,
            Body=json.dumps(request_object, indent=2, ensure_ascii=False),
            ContentType='application/json'
        )
        print(f"✅ Request saved: s3://{REQUEST_BUCKET}/{request_key}")
        
        # Save response to response bucket
        response_key = f"response-{timestamp}-{translation_id[:8]}.json"
        response_object = {
            'translation_result': translation_result,
            'original_request': request_data,
            'metadata': {
                'translation_id': translation_id,
                'timestamp': datetime.now().isoformat(),
                'processed_by': 'lambda',
                'version': '2.0'
            }
        }
        
        s3_client.put_object(
            Bucket=RESPONSE_BUCKET,
            Key=response_key,
            Body=json.dumps(response_object, indent=2, ensure_ascii=False),
            ContentType='application/json'
        )
        print(f"✅ Response saved: s3://{RESPONSE_BUCKET}/{response_key}")
        
    except Exception as e:
        print(f"❌ Error saving to S3: {e}")
        raise


# For local testing
if __name__ == "__main__":
    # Test event
    test_event = {
        'httpMethod': 'POST',
        'body': json.dumps({
            'source_language': 'en',
            'target_language': 'es',
            'texts': [
                'Hello, world!',
                'How are you today?',
                'This is a test translation with enhanced functionality.'
            ]
        })
    }
    
    class MockContext:
        aws_request_id = 'test-request-' + str(uuid.uuid4())[:8]
    
    # Set test environment
    os.environ['REQUEST_BUCKET'] = 'test-request-bucket'
    os.environ['RESPONSE_BUCKET'] = 'test-response-bucket'
    
    print("🧪 Testing enhanced Lambda function...")
    result = lambda_handler(test_event, MockContext())
    print("📊 Test Result:")
    print(json.dumps(result, indent=2, default=str))