# lambda/translate_function.py
# AWS Lambda function for handling translation requests using AWS Translate service
# COMPLETE FIXED VERSION - Ensures proper API Gateway response format

import json
import boto3
import os
import uuid
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from urllib.parse import unquote_plus
import time

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize AWS clients
s3_client = boto3.client('s3')
translate_client = boto3.client('translate')
dynamodb = boto3.resource('dynamodb')

# Environment variables
REQUEST_BUCKET = os.environ.get('REQUEST_BUCKET')
RESPONSE_BUCKET = os.environ.get('RESPONSE_BUCKET')
USER_DATA_TABLE = os.environ.get('USER_DATA_TABLE')
TRANSLATION_TABLE = os.environ.get('TRANSLATION_TABLE')
AWS_REGION = os.environ.get('AWS_REGION', 'us-east-1')

# DynamoDB tables
user_data_table = dynamodb.Table(USER_DATA_TABLE) if USER_DATA_TABLE else None
translation_table = dynamodb.Table(TRANSLATION_TABLE) if TRANSLATION_TABLE else None

# Supported language codes for AWS Translate
SUPPORTED_LANGUAGES = {
    'af': 'Afrikaans', 'sq': 'Albanian', 'am': 'Amharic', 'ar': 'Arabic',
    'hy': 'Armenian', 'az': 'Azerbaijani', 'bn': 'Bengali', 'bs': 'Bosnian',
    'bg': 'Bulgarian', 'ca': 'Catalan', 'zh': 'Chinese (Simplified)',
    'zh-TW': 'Chinese (Traditional)', 'hr': 'Croatian', 'cs': 'Czech',
    'da': 'Danish', 'fa-AF': 'Dari', 'nl': 'Dutch', 'en': 'English',
    'et': 'Estonian', 'fa': 'Farsi (Persian)', 'tl': 'Filipino, Tagalog',
    'fi': 'Finnish', 'fr': 'French', 'fr-CA': 'French (Canada)',
    'ka': 'Georgian', 'de': 'German', 'el': 'Greek', 'gu': 'Gujarati',
    'ht': 'Haitian Creole', 'ha': 'Hausa', 'he': 'Hebrew', 'hi': 'Hindi',
    'hu': 'Hungarian', 'is': 'Icelandic', 'id': 'Indonesian', 'ga': 'Irish',
    'it': 'Italian', 'ja': 'Japanese', 'kn': 'Kannada', 'kk': 'Kazakh',
    'ko': 'Korean', 'lv': 'Latvian', 'lt': 'Lithuanian', 'mk': 'Macedonian',
    'ms': 'Malay', 'ml': 'Malayalam', 'mt': 'Maltese', 'mr': 'Marathi',
    'mn': 'Mongolian', 'no': 'Norwegian (Bokmål)', 'ps': 'Pashto',
    'pl': 'Polish', 'pt': 'Portuguese (Brazil)', 'pt-PT': 'Portuguese (Portugal)',
    'pa': 'Punjabi', 'ro': 'Romanian', 'ru': 'Russian', 'sr': 'Serbian',
    'si': 'Sinhala', 'sk': 'Slovak', 'sl': 'Slovenian', 'so': 'Somali',
    'es': 'Spanish', 'es-MX': 'Spanish (Mexico)', 'sw': 'Swahili',
    'sv': 'Swedish', 'ta': 'Tamil', 'te': 'Telugu', 'th': 'Thai',
    'tr': 'Turkish', 'uk': 'Ukrainian', 'ur': 'Urdu', 'uz': 'Uzbek',
    'vi': 'Vietnamese', 'cy': 'Welsh'
}


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Main Lambda handler function that processes translation requests.
    FIXED: Ensures proper API Gateway response format
    """
    try:
        logger.info(f"📥 Received event: {json.dumps(event, default=str)}")
        
        # Determine the event source and handle accordingly
        if 'Records' in event:
            # S3 event trigger
            return handle_s3_event(event, context)
        elif 'httpMethod' in event or 'requestContext' in event:
            # API Gateway event - MAIN FIX HERE
            return handle_api_gateway_event(event, context)
        else:
            # Direct invocation
            return handle_direct_invocation(event, context)
            
    except Exception as e:
        logger.error(f"❌ Error in lambda_handler: {str(e)}")
        return create_error_response(500, f"Internal server error: {str(e)}")


def handle_api_gateway_event(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Handle API Gateway request for direct translation.
    FIXED: Returns proper response format that frontend expects
    """
    try:
        start_time = time.time()
        
        logger.info(f"🚀 Processing API Gateway request: {event.get('httpMethod', 'unknown')}")
        
        # Handle CORS preflight requests
        if event.get('httpMethod') == 'OPTIONS':
            return {
                'statusCode': 200,
                'headers': get_cors_headers(),
                'body': json.dumps({'message': 'CORS preflight'})
            }
        
        # Parse the request body
        request_data = parse_request_body(event)
        if not request_data:
            return create_error_response(400, "Request body is required")
        
        logger.info(f"📋 Parsed request data: {json.dumps(request_data)}")
        
        # Validate request data
        validation_result = validate_translation_request(request_data)
        if not validation_result['valid']:
            logger.error(f"❌ Validation failed: {validation_result['error']}")
            return create_error_response(400, validation_result['error'])
        
        # Extract user information
        user_id = extract_user_id(event)
        logger.info(f"👤 User ID: {user_id}")
        
        # Generate unique ID for this request
        translation_id = str(uuid.uuid4())
        
        # Save request to S3 (optional)
        try:
            request_key = f"api-request-{datetime.now().strftime('%Y%m%d-%H%M%S')}-{translation_id}.json"
            save_request_to_s3(request_key, request_data, user_id, 'api')
            logger.info(f"💾 Request saved to S3: {request_key}")
        except Exception as s3_error:
            logger.warning(f"⚠️ Failed to save request to S3: {s3_error}")
        
        # MAIN FIX: Perform translation and ensure proper response
        logger.info("🔄 Starting translation process")
        translation_result = perform_translation(request_data)
        
        processing_time = time.time() - start_time
        
        # Add metadata to result
        translation_result['translation_id'] = translation_id
        translation_result['processing_time'] = processing_time
        translation_result['user_id'] = user_id
        
        logger.info(f"✅ Translation completed: {translation_result['request_metadata']['successful_translations']} successful")
        
        # Save to S3 response bucket
        try:
            response_key = f"api-response-{datetime.now().strftime('%Y%m%d-%H%M%S')}-{translation_id}.json"
            complete_result = {
                'original_request': request_data,
                'translation_result': translation_result,
                'metadata': {
                    'processed_at': datetime.now().isoformat(),
                    'lambda_request_id': context.aws_request_id if context else '',
                    'version': '1.0',
                    'buckets': {
                        'request_bucket': REQUEST_BUCKET,
                        'response_bucket': RESPONSE_BUCKET
                    }
                }
            }
            save_translation_result(response_key, complete_result)
            logger.info(f"💾 Response saved to S3: {response_key}")
        except Exception as s3_error:
            logger.warning(f"⚠️ Failed to save response to S3: {s3_error}")
        
        # Save metadata to DynamoDB (optional)
        try:
            metadata = {
                'user_id': user_id,
                'source_language': request_data['source_language'],
                'target_language': request_data['target_language'],
                'request_type': 'api',
                'text_count': len(request_data['texts']),
                'success_count': translation_result['request_metadata']['successful_translations'],
                'processing_time': processing_time
            }
            save_translation_metadata(translation_id, metadata)
            
            if user_id != 'anonymous':
                save_user_translation_history(user_id, translation_result)
        except Exception as e:
            logger.warning(f"⚠️ Failed to save metadata: {str(e)}")
        
        # CRITICAL FIX: Return the translation result directly in proper format
        logger.info(f"📤 Returning translation result: {json.dumps(translation_result, default=str)[:200]}...")
        
        return {
            'statusCode': 200,
            'headers': get_cors_headers(),
            'body': json.dumps(translation_result, default=str, ensure_ascii=False)
        }
        
    except Exception as e:
        logger.error(f"❌ Error handling API Gateway event: {str(e)}")
        import traceback
        logger.error(f"🔍 Traceback: {traceback.format_exc()}")
        return create_error_response(500, f"Error processing request: {str(e)}")


def perform_translation(request_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Perform the actual translation using AWS Translate.
    FIXED: Improved error handling and logging
    """
    try:
        source_lang = request_data['source_language']
        target_lang = request_data['target_language']
        texts = request_data['texts']
        
        logger.info(f"🌍 Translating {len(texts)} texts from {source_lang} to {target_lang}")
        
        translations = []
        successful_count = 0
        failed_count = 0
        total_characters = 0
        
        for i, text in enumerate(texts):
            if not text.strip():  # Skip empty texts
                translations.append({
                    'original_text': text,
                    'translated_text': text,
                    'index': i,
                    'status': 'skipped',
                    'reason': 'empty_text'
                })
                continue
            
            try:
                logger.info(f"🔄 Translating text {i+1}: '{text[:50]}...'")
                
                # Call AWS Translate
                response = translate_client.translate_text(
                    Text=text,
                    SourceLanguageCode=source_lang,
                    TargetLanguageCode=target_lang
                )
                
                translated_text = response['TranslatedText']
                total_characters += len(translated_text)
                successful_count += 1
                
                logger.info(f"✅ Translation {i+1} successful: '{translated_text[:50]}...'")
                
                translations.append({
                    'original_text': text,
                    'translated_text': translated_text,
                    'index': i,
                    'status': 'success',
                    'source_language_detected': response.get('SourceLanguageCode'),
                    'target_language': response.get('TargetLanguageCode')
                })
                
            except Exception as e:
                logger.error(f"❌ Error translating text {i}: {str(e)}")
                failed_count += 1
                translations.append({
                    'original_text': text,
                    'translated_text': None,
                    'index': i,
                    'status': 'error',
                    'error': str(e)
                })
        
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
                'timestamp': datetime.now().isoformat()
            },
            'translations': translations,
            'summary': {
                'success_rate': success_rate,
                'total_characters_translated': total_characters
            }
        }
        
        logger.info(f"📊 Translation summary: {successful_count}/{total_texts} successful, {success_rate}% success rate")
        
        return result
        
    except Exception as e:
        logger.error(f"❌ Error performing translation: {str(e)}")
        raise


def parse_request_body(event: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Parse the request body from API Gateway event.
    IMPROVED: Better error handling and logging
    """
    try:
        if not event.get('body'):
            logger.warning("⚠️ No body in request")
            return None
        
        body = event['body']
        logger.info(f"📥 Raw body type: {type(body)}, first 100 chars: {str(body)[:100]}")
        
        if event.get('isBase64Encoded'):
            import base64
            body = base64.b64decode(body).decode('utf-8')
            logger.info("🔓 Decoded base64 body")
        
        if isinstance(body, str):
            parsed = json.loads(body)
            logger.info(f"✅ Parsed JSON body: {json.dumps(parsed)}")
            return parsed
        else:
            logger.info(f"✅ Body already parsed: {json.dumps(body)}")
            return body
        
    except json.JSONDecodeError as e:
        logger.error(f"❌ JSON decode error: {str(e)}")
        return None
    except Exception as e:
        logger.error(f"❌ Error parsing request body: {str(e)}")
        return None


def extract_user_id(event: Dict[str, Any]) -> str:
    """Extract user ID from API Gateway event."""
    try:
        request_context = event.get('requestContext', {})
        authorizer = request_context.get('authorizer', {})
        
        if 'claims' in authorizer:
            return authorizer['claims'].get('sub', 'anonymous')
        elif 'lambda' in authorizer:
            return authorizer['lambda'].get('sub', 'anonymous')
        elif 'principalId' in authorizer:
            return authorizer['principalId']
        
        return 'anonymous'
        
    except Exception as e:
        logger.warning(f"Could not extract user ID: {str(e)}")
        return 'anonymous'


def save_request_to_s3(key: str, request_data: Dict[str, Any], user_id: str, request_type: str) -> None:
    """Save request data to S3 Request Bucket."""
    try:
        if not REQUEST_BUCKET:
            logger.warning("Request bucket not configured")
            return
        
        request_object = {
            'request_data': request_data,
            'metadata': {
                'user_id': user_id,
                'request_type': request_type,
                'timestamp': datetime.now().isoformat(),
                'source_language': request_data.get('source_language'),
                'target_language': request_data.get('target_language'),
                'text_count': len(request_data.get('texts', []))
            }
        }
        
        request_json = json.dumps(request_object, indent=2, ensure_ascii=False, default=str)
        
        s3_client.put_object(
            Bucket=REQUEST_BUCKET,
            Key=key,
            Body=request_json.encode('utf-8'),
            ContentType='application/json',
            Metadata={
                'user-id': user_id,
                'request-type': request_type,
                'source-language': request_data.get('source_language', ''),
                'target-language': request_data.get('target_language', ''),
                'text-count': str(len(request_data.get('texts', []))),
                'timestamp': datetime.now().isoformat()
            }
        )
        
    except Exception as e:
        logger.error(f"Error saving request to S3: {str(e)}")
        raise


def save_translation_result(file_key: str, complete_result: Dict[str, Any]) -> None:
    """Save translation result to S3 Response Bucket."""
    try:
        if not RESPONSE_BUCKET:
            logger.warning("Response bucket not configured")
            return
        
        result_json = json.dumps(complete_result, indent=2, ensure_ascii=False, default=str)
        
        translation_result = complete_result.get('translation_result', {})
        original_request = complete_result.get('original_request', {})
        
        s3_client.put_object(
            Bucket=RESPONSE_BUCKET,
            Key=file_key,
            Body=result_json.encode('utf-8'),
            ContentType='application/json',
            Metadata={
                'source-language': original_request.get('source_language', ''),
                'target-language': original_request.get('target_language', ''),
                'texts-count': str(len(original_request.get('texts', []))),
                'successful-translations': str(translation_result.get('request_metadata', {}).get('successful_translations', 0)),
                'success-rate': str(translation_result.get('summary', {}).get('success_rate', 0)),
                'total-characters': str(translation_result.get('summary', {}).get('total_characters_translated', 0)),
                'processed-at': datetime.now().isoformat()
            }
        )
        
    except Exception as e:
        logger.error(f"Error saving translation result: {str(e)}")
        raise


def validate_translation_request(request_data: Dict[str, Any]) -> Dict[str, Any]:
    """Validate the translation request data."""
    try:
        if not request_data or not isinstance(request_data, dict):
            return {'valid': False, 'error': 'Request data must be a valid JSON object'}
        
        required_fields = ['source_language', 'target_language', 'texts']
        for field in required_fields:
            if field not in request_data:
                return {'valid': False, 'error': f"Missing required field: {field}"}
        
        source_lang = request_data['source_language']
        target_lang = request_data['target_language']
        
        if source_lang not in SUPPORTED_LANGUAGES:
            return {'valid': False, 'error': f"Unsupported source language: {source_lang}"}
        
        if target_lang not in SUPPORTED_LANGUAGES:
            return {'valid': False, 'error': f"Unsupported target language: {target_lang}"}
        
        texts = request_data['texts']
        if not isinstance(texts, list):
            return {'valid': False, 'error': "Field 'texts' must be a list"}
        
        if not texts:
            return {'valid': False, 'error': "Field 'texts' cannot be empty"}
        
        for i, text in enumerate(texts):
            if not isinstance(text, str):
                return {'valid': False, 'error': f"Text at index {i} must be a string"}
            if len(text.encode('utf-8')) > 5000:
                return {'valid': False, 'error': f"Text at index {i} exceeds 5000 bytes limit"}
        
        return {'valid': True, 'error': None}
        
    except Exception as e:
        logger.error(f"Error validating request: {str(e)}")
        return {'valid': False, 'error': f"Validation error: {str(e)}"}


def save_user_translation_history(user_id: str, translation_data: Dict[str, Any]) -> None:
    """Save user translation history to DynamoDB."""
    try:
        if not user_data_table:
            return
        
        timestamp = datetime.now().isoformat()
        ttl = int((datetime.now() + timedelta(days=365)).timestamp())
        
        user_data_table.put_item(
            Item={
                'user_id': user_id,
                'timestamp': timestamp,
                'translation_id': translation_data.get('translation_id', str(uuid.uuid4())),
                'source_language': translation_data.get('request_metadata', {}).get('source_language'),
                'target_language': translation_data.get('request_metadata', {}).get('target_language'),
                'text_count': len(translation_data.get('translations', [])),
                'success_count': translation_data.get('request_metadata', {}).get('successful_translations', 0),
                'created_at': timestamp,
                'ttl': ttl
            }
        )
        
    except Exception as e:
        logger.error(f"Error saving user translation history: {str(e)}")


def save_translation_metadata(translation_id: str, metadata: Dict[str, Any]) -> None:
    """Save translation metadata to DynamoDB."""
    try:
        if not translation_table:
            return
        
        timestamp = datetime.now().isoformat()
        ttl = int((datetime.now() + timedelta(days=90)).timestamp())
        
        translation_table.put_item(
            Item={
                'translation_id': translation_id,
                'user_id': metadata.get('user_id', 'anonymous'),
                'source_language': metadata.get('source_language'),
                'target_language': metadata.get('target_language'),
                'request_type': metadata.get('request_type', 'api'),
                'text_count': metadata.get('text_count', 0),
                'success_count': metadata.get('success_count', 0),
                'file_name': metadata.get('file_name'),
                'created_at': timestamp,
                'processing_time': metadata.get('processing_time', 0),
                'ttl': ttl
            }
        )
        
    except Exception as e:
        logger.error(f"Error saving translation metadata: {str(e)}")


def get_cors_headers() -> Dict[str, str]:
    """Get CORS headers for API responses."""
    return {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
    }


def create_error_response(status_code: int, message: str) -> Dict[str, Any]:
    """Create a standardized error response."""
    return {
        'statusCode': status_code,
        'headers': get_cors_headers(),
        'body': json.dumps({
            'error': True,
            'message': message,
            'timestamp': datetime.now().isoformat()
        }, default=str, ensure_ascii=False)
    }


def handle_s3_event(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Handle S3 event when a file is uploaded."""
    try:
        processed_files = []
        
        for record in event['Records']:
            bucket = record['s3']['bucket']['name']
            key = unquote_plus(record['s3']['object']['key'])
            
            logger.info(f"Processing file: {key} from bucket: {bucket}")
            
            if bucket != REQUEST_BUCKET:
                logger.warning(f"File from unexpected bucket: {bucket}")
                continue
            
            if not key.lower().endswith('.json'):
                logger.info(f"Skipping non-JSON file: {key}")
                continue
            
            if key.startswith('api-request-') or key.startswith('file-request-') or key.startswith('s3-response-'):
                logger.info(f"Skipping already processed file: {key}")
                continue
            
            # Process the file (simplified for this example)
            processed_files.append({
                'file': key,
                'status': 'processed',
                'timestamp': datetime.now().isoformat()
            })
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'S3 files processed successfully',
                'processed_files': processed_files
            }, default=str)
        }
        
    except Exception as e:
        logger.error(f"Error handling S3 event: {str(e)}")
        return create_error_response(500, f"Error processing S3 event: {str(e)}")


def handle_direct_invocation(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Handle direct Lambda invocation."""
    try:
        validation_result = validate_translation_request(event)
        if not validation_result['valid']:
            return create_error_response(400, validation_result['error'])
        
        translation_result = perform_translation(event)
        
        return {
            'statusCode': 200,
            'headers': get_cors_headers(),
            'body': json.dumps(translation_result, default=str, ensure_ascii=False)
        }
        
    except Exception as e:
        logger.error(f"Error handling direct invocation: {str(e)}")
        return create_error_response(500, f"Error processing direct invocation: {str(e)}")


# For local testing
if __name__ == "__main__":
    test_event = {
        'source_language': 'en',
        'target_language': 'es',
        'texts': [
            'Hello, world!',
            'How are you today?',
            'This is a test translation.'
        ]
    }
    
    class MockContext:
        def __init__(self):
            self.aws_request_id = 'test-request-id'
            self.function_name = 'test-function'
            self.memory_limit_in_mb = 256
            self.remaining_time_in_millis = lambda: 30000
    
    if not REQUEST_BUCKET:
        os.environ['REQUEST_BUCKET'] = 'test-request-bucket'
    if not RESPONSE_BUCKET:
        os.environ['RESPONSE_BUCKET'] = 'test-response-bucket'
    
    result = lambda_handler(test_event, MockContext())
    print(json.dumps(result, indent=2, default=str))