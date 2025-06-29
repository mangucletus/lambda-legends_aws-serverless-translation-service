# lambda/translate_function.py
# FINAL FIX: Lambda function that returns the EXACT format the frontend expects

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
    """FINAL FIX: Lambda handler that returns EXACTLY what frontend expects."""
    
    request_id = context.aws_request_id if context else str(uuid.uuid4())
    
    try:
        print(f"🚀 Starting translation request: {request_id}")
        print(f"📋 Event: {json.dumps(event, default=str)[:500]}...")
        
        # Handle CORS preflight
        if event.get('httpMethod') == 'OPTIONS':
            print("✈️ Handling CORS preflight request")
            return create_cors_response(200, {'message': 'CORS preflight successful'})
        
        # Parse request body
        request_data = parse_request_body(event)
        if not request_data:
            print("❌ No request data provided")
            return create_cors_response(400, {
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
            return create_cors_response(400, {'error': validation_error})
        
        # Generate translation ID
        translation_id = str(uuid.uuid4())
        print(f"🔖 Translation ID: {translation_id}")
        
        # Perform translation
        print("🔄 Starting translation process...")
        translation_result = perform_translation(request_data, translation_id, request_id)
        
        # CRITICAL FIX: Create the EXACT response format the frontend expects
        frontend_response = {
            'translations': translation_result['translations'],
            'request_metadata': translation_result['request_metadata'],
            'summary': translation_result['summary']
        }
        
        print(f"🎯 FRONTEND RESPONSE FORMAT (what we're returning):")
        print(f"   - translations array length: {len(frontend_response['translations'])}")
        print(f"   - successful translations: {translation_result['request_metadata']['successful_translations']}")
        
        # Log the actual translated text for debugging
        for i, trans in enumerate(frontend_response['translations']):
            if trans.get('status') == 'success':
                print(f"   - Translation {i+1}: '{trans.get('original_text')}' → '{trans.get('translated_text')}'")
        
        # Save to S3 buckets (save the full detailed response for records)
        try:
            print("💾 Saving request and response to S3...")
            save_request_and_response(request_data, translation_result, translation_id)
            print("✅ Successfully saved to S3")
        except Exception as s3_error:
            print(f"⚠️ Failed to save to S3: {s3_error}")
            # Don't fail the translation if S3 save fails
        
        print(f"🎉 Returning successful response with {len(frontend_response['translations'])} translations")
        return create_cors_response(200, frontend_response)
        
    except Exception as e:
        error_msg = str(e)
        print(f"❌ Critical error: {error_msg}")
        print(f"🔍 Traceback: {traceback.format_exc()}")
        
        return create_cors_response(500, {
            'error': f"Translation service error: {error_msg}",
            'request_id': request_id,
            'timestamp': datetime.now().isoformat()
        })


def create_cors_response(status_code: int, body_data: Any) -> Dict[str, Any]:
    """Create API Gateway response with comprehensive CORS headers."""
    
    headers = {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent,Cache-Control,X-Requested-With',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS,PUT,DELETE',
        'Access-Control-Allow-Credentials': 'false',
        'Access-Control-Max-Age': '86400'
    }
    
    response_body = json.dumps(body_data, default=str, ensure_ascii=False)
    
    response = {
        'statusCode': status_code,
        'headers': headers,
        'body': response_body,
        'isBase64Encoded': False
    }
    
    print(f"📤 API Gateway Response Preview:")
    print(f"   - Status: {status_code}")
    print(f"   - Body size: {len(response_body)} chars")
    if status_code == 200 and 'translations' in body_data:
        print(f"   - Contains translations array: YES ({len(body_data['translations'])} items)")
    
    return response


def parse_request_body(event: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Parse request body from API Gateway event."""
    try:
        body = event.get('body')
        if not body:
            return None
        
        if event.get('isBase64Encoded'):
            import base64
            body = base64.b64decode(body).decode('utf-8')
        
        if isinstance(body, str):
            return json.loads(body)
        return body
        
    except Exception as e:
        print(f"❌ Error parsing request body: {e}")
        return None


def validate_request(request_data: Dict[str, Any]) -> Optional[str]:
    """Validate request data."""
    try:
        if not isinstance(request_data, dict):
            return f"Request must be a JSON object, got {type(request_data)}"
        
        required_fields = ['source_language', 'target_language', 'texts']
        for field in required_fields:
            if field not in request_data:
                return f"Missing required field: '{field}'"
        
        source_lang = request_data['source_language']
        target_lang = request_data['target_language']
        
        if source_lang not in SUPPORTED_LANGUAGES:
            return f"Unsupported source language: '{source_lang}'"
        
        if target_lang not in SUPPORTED_LANGUAGES:
            return f"Unsupported target language: '{target_lang}'"
        
        texts = request_data['texts']
        if not isinstance(texts, list) or not texts:
            return "Field 'texts' must be a non-empty array"
        
        return None
        
    except Exception as e:
        return f"Validation error: {str(e)}"


def perform_translation(request_data: Dict[str, Any], translation_id: str, request_id: str) -> Dict[str, Any]:
    """Perform the actual translation."""
    
    source_lang = request_data['source_language']
    target_lang = request_data['target_language']
    texts = request_data['texts']
    
    print(f"🔄 Translating {len(texts)} texts from {source_lang} to {target_lang}")
    
    translations = []
    successful_count = 0
    failed_count = 0
    total_characters = 0
    
    for i, text in enumerate(texts):
        print(f"🔄 Processing text {i+1}/{len(texts)}: '{text}'")
        
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
            # Call AWS Translate
            print(f"🌐 Calling AWS Translate for: '{text}'")
            response = translate_client.translate_text(
                Text=text.strip(),
                SourceLanguageCode=source_lang,
                TargetLanguageCode=target_lang
            )
            
            translated_text = response['TranslatedText']
            total_characters += len(translated_text)
            successful_count += 1
            
            translation_obj = {
                'original_text': text,
                'translated_text': translated_text,
                'index': i,
                'status': 'success',
                'source_language_detected': response.get('SourceLanguageCode', source_lang),
                'target_language': response.get('TargetLanguageCode', target_lang),
                'character_count': len(translated_text)
            }
            
            translations.append(translation_obj)
            
            print(f"✅ SUCCESS: '{text}' → '{translated_text}'")
            
        except Exception as e:
            error_msg = str(e)
            print(f"❌ Translation failed for '{text}': {error_msg}")
            
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
            'translation_id': translation_id,
            'request_id': request_id
        },
        'translations': translations,
        'summary': {
            'success_rate': success_rate,
            'total_characters_translated': total_characters
        }
    }
    
    print(f"📊 Translation complete: {successful_count}/{total_texts} successful ({success_rate}%)")
    return result


def save_request_and_response(request_data: Dict[str, Any], translation_result: Dict[str, Any], translation_id: str) -> None:
    """Save request and detailed response to S3 buckets."""
    
    if not REQUEST_BUCKET or not RESPONSE_BUCKET:
        print("⚠️ S3 buckets not configured")
        return
    
    timestamp = datetime.now().strftime('%Y%m%d-%H%M%S')
    
    try:
        # Save request
        request_key = f"requests/request-{timestamp}-{translation_id[:8]}.json"
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
            Body=json.dumps(request_object, indent=2, ensure_ascii=False, default=str),
            ContentType='application/json; charset=utf-8'
        )
        
        # Save detailed response (with translation_result wrapper for records)
        response_key = f"responses/response-{timestamp}-{translation_id[:8]}.json"
        response_object = {
            'translation_result': translation_result,  # Full detailed response for S3 records
            'original_request': request_data,
            'metadata': {
                'translation_id': translation_id,
                'timestamp': datetime.now().isoformat(),
                'processed_by': 'lambda',
                'version': '2.0',
                'bucket_type': 'response'
            }
        }
        
        s3_client.put_object(
            Bucket=RESPONSE_BUCKET,
            Key=response_key,
            Body=json.dumps(response_object, indent=2, ensure_ascii=False, default=str),
            ContentType='application/json; charset=utf-8'
        )
        
        print(f"✅ Saved to S3: {request_key} and {response_key}")
        
    except Exception as e:
        print(f"❌ S3 save error: {e}")
        raise


# Test function
if __name__ == "__main__":
    test_event = {
        'httpMethod': 'POST',
        'headers': {'Content-Type': 'application/json'},
        'body': json.dumps({
            'source_language': 'en',
            'target_language': 'fr',
            'texts': ['How are you', 'Good morning']
        })
    }
    
    class MockContext:
        aws_request_id = 'test-12345'
    
    print("🧪 Testing Lambda function...")
    result = lambda_handler(test_event, MockContext())
    print("📋 Result:", json.dumps(result, indent=2, default=str))