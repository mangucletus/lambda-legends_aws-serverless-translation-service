# lambda/translate_function.py
# COMPLETELY FIXED VERSION - Ensures proper API Gateway response format

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
    FIXED: Main Lambda handler with proper API Gateway response format.
    """
    try:
        logger.info(f"Received event: {json.dumps(event, default=str)}")
        
        # Determine the event source and handle accordingly
        if 'Records' in event:
            # S3 event trigger
            return handle_s3_event(event, context)
        elif 'httpMethod' in event or 'requestContext' in event:
            # API Gateway event - THIS IS THE MAIN FIX
            return handle_api_gateway_event(event, context)
        else:
            # Direct invocation
            return handle_direct_invocation(event, context)
            
    except Exception as e:
        logger.error(f"Error in lambda_handler: {str(e)}")
        return create_api_gateway_response(500, {
            'error': True,
            'message': f"Internal server error: {str(e)}",
            'timestamp': datetime.now().isoformat()
        })


def handle_api_gateway_event(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    COMPLETELY FIXED: Handle API Gateway request with proper response format.
    """
    try:
        start_time = time.time()
        
        logger.info(f"Processing API Gateway request: {event.get('httpMethod', 'unknown')}")
        
        # Handle CORS preflight requests
        if event.get('httpMethod') == 'OPTIONS':
            return create_api_gateway_response(200, {'message': 'CORS preflight'})
        
        # Parse the request body
        request_data = parse_request_body(event)
        if not request_data:
            return create_api_gateway_response(400, {
                'error': True,
                'message': "Request body is required"
            })
        
        # Validate request data
        validation_result = validate_translation_request(request_data)
        if not validation_result['valid']:
            logger.error(f"Validation failed: {validation_result['error']}")
            return create_api_gateway_response(400, {
                'error': True,
                'message': validation_result['error']
            })
        
        # Extract user information
        user_id = extract_user_id(event)
        
        # Generate unique ID for this request
        translation_id = str(uuid.uuid4())
        
        # Save request to S3 (optional - don't fail if it doesn't work)
        try:
            request_key = f"api-request-{datetime.now().strftime('%Y%m%d-%H%M%S')}-{translation_id}.json"
            save_request_to_s3(request_key, request_data, user_id, 'api')
        except Exception as s3_error:
            logger.warning(f"Failed to save request to S3: {s3_error}")
        
        # MAIN FIX: Perform translation and return proper format
        logger.info("Starting translation process")
        translation_result = perform_translation(request_data)
        
        # Calculate processing time
        processing_time = time.time() - start_time
        
        # Add metadata to result
        translation_result['translation_id'] = translation_id
        translation_result['processing_time'] = processing_time
        translation_result['user_id'] = user_id
        
        # Save to DynamoDB (optional)
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
            logger.warning(f"Failed to save metadata: {str(e)}")
        
        # Save result to S3 Response Bucket (optional)
        try:
            response_key = f"api-response-{datetime.now().strftime('%Y%m%d-%H%M%S')}-{translation_id}.json"
            
            # Create the complete result object for S3
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
        except Exception as s3_error:
            logger.warning(f"Failed to save response to S3: {s3_error}")
        
        logger.info("Translation completed successfully")
        
        # CRITICAL FIX: Return proper API Gateway response with translation data
        return create_api_gateway_response(200, translation_result)
        
    except Exception as e:
        logger.error(f"Error handling API Gateway event: {str(e)}")
        return create_api_gateway_response(500, {
            'error': True,
            'message': f"Error processing request: {str(e)}",
            'timestamp': datetime.now().isoformat()
        })


def create_api_gateway_response(status_code: int, body_data: Any) -> Dict[str, Any]:
    """
    CRITICAL FIX: Create proper API Gateway response format.
    """
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
            'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
            'Access-Control-Allow-Credentials': 'false'
        },
        'body': json.dumps(body_data, default=str, ensure_ascii=False)
    }


def perform_translation(request_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    ENHANCED: Perform translation with better error handling and guaranteed response format.
    """
    try:
        source_lang = request_data['source_language']
        target_lang = request_data['target_language']
        texts = request_data['texts']
        
        logger.info(f"Translating {len(texts)} texts from {source_lang} to {target_lang}")
        
        translations = []
        successful_count = 0
        failed_count = 0
        total_characters = 0
        
        for i, text in enumerate(texts):
            if not text or not text.strip():  # Skip empty texts
                translations.append({
                    'original_text': text,
                    'translated_text': '',
                    'index': i,
                    'status': 'skipped',
                    'reason': 'empty_text'
                })
                continue
            
            try:
                logger.info(f"Translating text {i+1}/{len(texts)}: {text[:50]}...")
                
                # Call AWS Translate
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
                    'target_language': response.get('TargetLanguageCode', target_lang)
                })
                
                logger.info(f"✅ Successfully translated text {i+1}: '{text[:30]}...' -> '{translated_text[:30]}...'")
                
            except Exception as translate_error:
                logger.error(f"❌ Error translating text {i}: {str(translate_error)}")
                failed_count += 1
                translations.append({
                    'original_text': text,
                    'translated_text': None,
                    'index': i,
                    'status': 'error',
                    'error': str(translate_error)
                })
        
        # Calculate statistics
        total_texts = len(texts)
        success_rate = round((successful_count / total_texts * 100), 2) if total_texts > 0 else 0
        
        # GUARANTEED response format
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
        
        logger.info(f"✅ Translation completed: {successful_count}/{total_texts} successful, {success_rate}% success rate")
        
        return result
        
    except Exception as e:
        logger.error(f"❌ Critical error in perform_translation: {str(e)}")
        
        # Return error structure that matches expected format
        return {
            'request_metadata': {
                'source_language': request_data.get('source_language', 'unknown'),
                'target_language': request_data.get('target_language', 'unknown'),
                'total_texts': len(request_data.get('texts', [])),
                'successful_translations': 0,
                'failed_translations': len(request_data.get('texts', [])),
                'timestamp': datetime.now().isoformat()
            },
            'translations': [
                {
                    'original_text': text,
                    'translated_text': None,
                    'index': i,
                    'status': 'error',
                    'error': f"Translation service error: {str(e)}"
                }
                for i, text in enumerate(request_data.get('texts', []))
            ],
            'summary': {
                'success_rate': 0,
                'total_characters_translated': 0
            }
        }


def handle_s3_event(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Handle S3 event when a file is uploaded to the request bucket.
    """
    try:
        processed_files = []
        
        for record in event['Records']:
            bucket = record['s3']['bucket']['name']
            key = unquote_plus(record['s3']['object']['key'])
            
            logger.info(f"Processing S3 file: {key} from bucket: {bucket}")
            
            if bucket != REQUEST_BUCKET:
                logger.warning(f"File from unexpected bucket: {bucket}")
                continue
            
            if not key.lower().endswith('.json'):
                logger.info(f"Skipping non-JSON file: {key}")
                continue
            
            result = process_s3_file(bucket, key)
            processed_files.append(result)
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'S3 files processed successfully',
                'processed_files': processed_files
            }, default=str)
        }
        
    except Exception as e:
        logger.error(f"Error handling S3 event: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': True,
                'message': f"Error processing S3 event: {str(e)}"
            }, default=str)
        }


def process_s3_file(bucket: str, key: str) -> Dict[str, Any]:
    """
    Process a JSON file from S3 and perform translation.
    """
    try:
        start_time = time.time()
        
        # Download the file from S3
        response = s3_client.get_object(Bucket=bucket, Key=key)
        file_content = response['Body'].read().decode('utf-8')
        
        # Parse JSON content
        file_data = json.loads(file_content)
        
        # Extract request data
        if 'request_data' in file_data:
            request_data = file_data['request_data']
            user_id = file_data.get('metadata', {}).get('user_id', 'anonymous')
        else:
            request_data = file_data
            user_id = response.get('Metadata', {}).get('user-id', 'anonymous')
        
        # Validate request data
        validation_result = validate_translation_request(request_data)
        if not validation_result['valid']:
            raise ValueError(validation_result['error'])
        
        # Perform translation
        translation_result = perform_translation(request_data)
        
        # Generate unique ID and calculate processing time
        translation_id = str(uuid.uuid4())
        processing_time = time.time() - start_time
        
        # Add metadata
        translation_result['translation_id'] = translation_id
        translation_result['processing_time'] = processing_time
        translation_result['user_id'] = user_id
        
        # Save to DynamoDB
        try:
            metadata = {
                'user_id': user_id,
                'source_language': request_data['source_language'],
                'target_language': request_data['target_language'],
                'request_type': 'file',
                'file_name': key,
                'text_count': len(request_data['texts']),
                'success_count': translation_result['request_metadata']['successful_translations'],
                'processing_time': processing_time
            }
            save_translation_metadata(translation_id, metadata)
            
            if user_id != 'anonymous':
                save_user_translation_history(user_id, translation_result)
        except Exception as e:
            logger.warning(f"Failed to save metadata: {str(e)}")
        
        # Generate result filename and save to S3
        result_key = f"s3-response-{datetime.now().strftime('%Y%m%d-%H%M%S')}-{translation_id}.json"
        
        # Create complete result object
        complete_result = {
            'original_request': request_data,
            'translation_result': translation_result,
            'metadata': {
                'processed_at': datetime.now().isoformat(),
                'lambda_request_id': '',
                'version': '1.0',
                'buckets': {
                    'request_bucket': REQUEST_BUCKET,
                    'response_bucket': RESPONSE_BUCKET
                }
            }
        }
        
        save_translation_result(result_key, complete_result)
        
        return {
            'original_file': key,
            'result_file': result_key,
            'translation_id': translation_id,
            'status': 'success',
            'translations_count': len(translation_result.get('translations', [])),
            'processing_time': processing_time,
            'response_saved_to': f"s3://{RESPONSE_BUCKET}/{result_key}"
        }
        
    except Exception as e:
        logger.error(f"Error processing S3 file {key}: {str(e)}")
        return {
            'original_file': key,
            'status': 'error',
            'error': str(e)
        }


def save_translation_result(file_key: str, complete_result: Dict[str, Any]) -> None:
    """
    Save translation result to S3 Response Bucket.
    """
    try:
        if not RESPONSE_BUCKET:
            logger.warning("Response bucket not configured")
            return
        
        # Convert to JSON
        result_json = json.dumps(complete_result, indent=2, ensure_ascii=False, default=str)
        
        # Upload to S3 Response Bucket
        s3_client.put_object(
            Bucket=RESPONSE_BUCKET,
            Key=file_key,
            Body=result_json.encode('utf-8'),
            ContentType='application/json',
            Metadata={
                'source-language': complete_result['original_request']['source_language'],
                'target-language': complete_result['original_request']['target_language'],
                'texts-count': str(len(complete_result['original_request']['texts'])),
                'successful-translations': str(complete_result['translation_result'].get('request_metadata', {}).get('successful_translations', 0)),
                'success-rate': str(complete_result['translation_result'].get('summary', {}).get('success_rate', 0)),
                'total-characters': str(complete_result['translation_result'].get('summary', {}).get('total_characters_translated', 0)),
                'processed-at': datetime.now().isoformat()
            }
        )
        
        logger.info(f"Translation result saved to {RESPONSE_BUCKET}/{file_key}")
        
    except Exception as e:
        logger.error(f"Error saving translation result: {str(e)}")
        raise


def parse_request_body(event: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Parse the request body from API Gateway event.
    """
    try:
        if not event.get('body'):
            return None
        
        body = event['body']
        if event.get('isBase64Encoded'):
            import base64
            body = base64.b64decode(body).decode('utf-8')
        
        return json.loads(body) if isinstance(body, str) else body
        
    except json.JSONDecodeError as e:
        logger.error(f"JSON decode error: {str(e)}")
        return None
    except Exception as e:
        logger.error(f"Error parsing request body: {str(e)}")
        return None


def extract_user_id(event: Dict[str, Any]) -> str:
    """
    Extract user ID from API Gateway event.
    """
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


def validate_translation_request(request_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Validate the translation request data.
    """
    try:
        if not request_data or not isinstance(request_data, dict):
            return {'valid': False, 'error': 'Request data must be a valid JSON object'}
        
        # Check required fields
        required_fields = ['source_language', 'target_language', 'texts']
        for field in required_fields:
            if field not in request_data:
                return {'valid': False, 'error': f"Missing required field: {field}"}
        
        # Validate language codes
        source_lang = request_data['source_language']
        target_lang = request_data['target_language']
        
        if source_lang not in SUPPORTED_LANGUAGES:
            return {'valid': False, 'error': f"Unsupported source language: {source_lang}"}
        
        if target_lang not in SUPPORTED_LANGUAGES:
            return {'valid': False, 'error': f"Unsupported target language: {target_lang}"}
        
        # Validate texts field
        texts = request_data['texts']
        if not isinstance(texts, list):
            return {'valid': False, 'error': "Field 'texts' must be a list"}
        
        if not texts:
            return {'valid': False, 'error': "Field 'texts' cannot be empty"}
        
        # Check text length limits
        for i, text in enumerate(texts):
            if not isinstance(text, str):
                return {'valid': False, 'error': f"Text at index {i} must be a string"}
            if len(text.encode('utf-8')) > 5000:
                return {'valid': False, 'error': f"Text at index {i} exceeds 5000 bytes limit"}
        
        return {'valid': True, 'error': None}
        
    except Exception as e:
        logger.error(f"Error validating request: {str(e)}")
        return {'valid': False, 'error': f"Validation error: {str(e)}"}


def save_request_to_s3(key: str, request_data: Dict[str, Any], user_id: str, request_type: str) -> None:
    """
    Save request data to S3 Request Bucket.
    """
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
        
        logger.info(f"Request saved to {REQUEST_BUCKET}/{key}")
        
    except Exception as e:
        logger.error(f"Error saving request to S3: {str(e)}")
        raise


def save_user_translation_history(user_id: str, translation_data: Dict[str, Any]) -> None:
    """
    Save user translation history to DynamoDB.
    """
    try:
        if not user_data_table:
            logger.warning("User data table not configured")
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
        
        logger.info(f"Saved translation history for user {user_id}")
        
    except Exception as e:
        logger.error(f"Error saving user translation history: {str(e)}")


def save_translation_metadata(translation_id: str, metadata: Dict[str, Any]) -> None:
    """
    Save translation metadata to DynamoDB.
    """
    try:
        if not translation_table:
            logger.warning("Translation table not configured")
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
        
        logger.info(f"Saved translation metadata for {translation_id}")
        
    except Exception as e:
        logger.error(f"Error saving translation metadata: {str(e)}")


def handle_direct_invocation(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Handle direct Lambda invocation.
    """
    try:
        validation_result = validate_translation_request(event)
        if not validation_result['valid']:
            return {
                'statusCode': 400,
                'body': json.dumps({
                    'error': True,
                    'message': validation_result['error']
                }, default=str)
            }
        
        translation_result = perform_translation(event)
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Translation completed successfully',
                'translation_result': translation_result
            }, default=str)
        }
        
    except Exception as e:
        logger.error(f"Error handling direct invocation: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': True,
                'message': f"Error processing direct invocation: {str(e)}"
            }, default=str)
        }


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