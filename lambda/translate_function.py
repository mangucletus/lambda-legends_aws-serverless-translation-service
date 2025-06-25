def handle_api_gateway_event(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Handle API Gateway request for direct translation.
    
    Args:
        event: API Gateway event data
        context: Lambda context
        
    Returns:
        Dict containing the translation result
    """
    try:
        start_time = time.time()
        
        # Parse the request body
        if event.get('body'):
            if event.get('isBase64Encoded'):
                import base64
                body = base64.b64decode(event['body']).decode('utf-8')
            else:
                body = event['body']
            
            request_data = json.loads(body)
        else:
            return create_error_response(400, "Request body is required")
            
        # Validate request data
        validation_result = validate_translation_request(request_data)
        if not validation_result['valid']:
            return create_error_response(400, validation_result['error'])
            
        # Perform translation
        translation_result = perform_translation(request_data)
        
        # Generate unique ID for this request
        translation_id = str(uuid.uuid4())
        processing_time = time.time() - start_time
        
        # Extract user ID from request context (if available)
        user_id = event.get('requestContext', {}).get('authorizer', {}).get('claims', {}).get('sub', 'anonymous')
        
        # Save metadata to DynamoDB
        metadata = {
            'user_id': user_id,
            'source_language': request_data['source_language'],
            'target_language': request_data['target_language'],
            'request_type': 'api',
            'text_count': len(request_data['texts']),
            'success_count': len([t for t in translation_result.get('translations', []) if t.get('status') == 'success']),
            'processing_time': processing_time
        }
        save_translation_metadata(translation_id, metadata)
        
        # Save user history
        if user_id != 'anonymous':
            translation_data = {
                'translation_id': translation_id,
                'source_language': request_data['source_language'],
                'target_language': request_data['target_language'],
                'translations': translation_result.get('translations', [])
            }
            save_user_translation_history(user_id, translation_data)
        
        # Add translation ID to result
        translation_result['translation_id'] = translation_id
        
        # Save result to response bucket
        save_translation_result(f"api_{translation_id}.json", translation_result, request_data)
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
                'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
            },
            'body': json.dumps({
                'message': 'Translation completed successfully',
                'translation_id': translation_id,
                'translation_result': translation_result
            })
        }
        
    except json.JSONDecodeError as e:
        logger.error(f"JSON decode error: {str(e)}")
        return create_error_response(400, "Invalid JSON in request body")
    except Exception as e:
        logger.error(f"Error handling API Gateway event: {str(e)}")
        return create_error_response(500, f"Error processing request: {str(e)}")# lambda/translate_function.py
# AWS Lambda function for handling translation requests using AWS Translate service

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


def save_user_translation_history(user_id: str, translation_data: Dict[str, Any]) -> None:
    """
    Save user translation history to DynamoDB.
    
    Args:
        user_id: User identifier
        translation_data: Translation result data
    """
    try:
        if not user_data_table:
            logger.warning("User data table not configured")
            return
            
        timestamp = datetime.now().isoformat()
        ttl = int((datetime.now() + timedelta(days=365)).timestamp())  # Keep for 1 year
        
        # Save to user data table
        user_data_table.put_item(
            Item={
                'user_id': user_id,
                'timestamp': timestamp,
                'translation_id': translation_data.get('translation_id', str(uuid.uuid4())),
                'source_language': translation_data.get('source_language'),
                'target_language': translation_data.get('target_language'),
                'text_count': len(translation_data.get('translations', [])),
                'success_count': len([t for t in translation_data.get('translations', []) if t.get('status') == 'success']),
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
    
    Args:
        translation_id: Unique translation identifier
        metadata: Translation metadata
    """
    try:
        if not translation_table:
            logger.warning("Translation table not configured")
            return
            
        timestamp = datetime.now().isoformat()
        ttl = int((datetime.now() + timedelta(days=90)).timestamp())  # Keep for 90 days
        
        translation_table.put_item(
            Item={
                'translation_id': translation_id,
                'user_id': metadata.get('user_id', 'anonymous'),
                'source_language': metadata.get('source_language'),
                'target_language': metadata.get('target_language'),
                'request_type': metadata.get('request_type', 'api'),  # 'api' or 'file'
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


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Main Lambda handler function that processes translation requests.
    
    This function can be triggered by:
    1. S3 events when files are uploaded to the request bucket
    2. Direct API Gateway calls with translation data
    
    Args:
        event: AWS Lambda event object
        context: AWS Lambda context object
        
    Returns:
        Dict containing the response with status code and body
    """
    try:
        logger.info(f"Received event: {json.dumps(event, default=str)}")
        
        # Determine the event source and handle accordingly
        if 'Records' in event:
            # S3 event trigger
            return handle_s3_event(event, context)
        elif 'httpMethod' in event:
            # API Gateway event
            return handle_api_gateway_event(event, context)
        else:
            # Direct invocation or unknown event type
            return handle_direct_invocation(event, context)
            
    except Exception as e:
        logger.error(f"Error in lambda_handler: {str(e)}")
        return create_error_response(500, f"Internal server error: {str(e)}")


def handle_s3_event(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Handle S3 event when a file is uploaded to the request bucket.
    
    Args:
        event: S3 event data
        context: Lambda context
        
    Returns:
        Dict containing the processing result
    """
    try:
        processed_files = []
        
        for record in event['Records']:
            # Extract S3 bucket and object information
            bucket = record['s3']['bucket']['name']
            key = unquote_plus(record['s3']['object']['key'])
            
            logger.info(f"Processing file: {key} from bucket: {bucket}")
            
            # Validate that this is the correct bucket
            if bucket != REQUEST_BUCKET:
                logger.warning(f"File from unexpected bucket: {bucket}")
                continue
                
            # Process only JSON files
            if not key.lower().endswith('.json'):
                logger.info(f"Skipping non-JSON file: {key}")
                continue
                
            # Download and process the file
            result = process_s3_file(bucket, key)
            processed_files.append(result)
            
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'S3 files processed successfully',
                'processed_files': processed_files
            })
        }
        
    except Exception as e:
        logger.error(f"Error handling S3 event: {str(e)}")
        return create_error_response(500, f"Error processing S3 event: {str(e)}")


def handle_api_gateway_event(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Handle API Gateway request for direct translation.
    
    Args:
        event: API Gateway event data
        context: Lambda context
        
    Returns:
        Dict containing the translation result
    """
    try:
        # Parse the request body
        if event.get('body'):
            if event.get('isBase64Encoded'):
                import base64
                body = base64.b64decode(event['body']).decode('utf-8')
            else:
                body = event['body']
            
            request_data = json.loads(body)
        else:
            return create_error_response(400, "Request body is required")
            
        # Validate request data
        validation_result = validate_translation_request(request_data)
        if not validation_result['valid']:
            return create_error_response(400, validation_result['error'])
            
        # Perform translation
        translation_result = perform_translation(request_data)
        
        # Generate unique ID for this request
        request_id = str(uuid.uuid4())
        
        # Save result to response bucket
        save_translation_result(request_id, translation_result, request_data)
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
                'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
            },
            'body': json.dumps({
                'message': 'Translation completed successfully',
                'request_id': request_id,
                'translation_result': translation_result
            })
        }
        
    except json.JSONDecodeError as e:
        logger.error(f"JSON decode error: {str(e)}")
        return create_error_response(400, "Invalid JSON in request body")
    except Exception as e:
        logger.error(f"Error handling API Gateway event: {str(e)}")
        return create_error_response(500, f"Error processing request: {str(e)}")


def handle_direct_invocation(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Handle direct Lambda invocation.
    
    Args:
        event: Direct invocation event data
        context: Lambda context
        
    Returns:
        Dict containing the processing result
    """
    try:
        # Validate request data
        validation_result = validate_translation_request(event)
        if not validation_result['valid']:
            return create_error_response(400, validation_result['error'])
            
        # Perform translation
        translation_result = perform_translation(event)
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Translation completed successfully',
                'translation_result': translation_result
            })
        }
        
    except Exception as e:
        logger.error(f"Error handling direct invocation: {str(e)}")
        return create_error_response(500, f"Error processing direct invocation: {str(e)}")


def process_s3_file(bucket: str, key: str) -> Dict[str, Any]:
    """
    Process a JSON file from S3 and perform translation.
    
    Args:
        bucket: S3 bucket name
        key: S3 object key
        
    Returns:
        Dict containing the processing result
    """
    try:
        start_time = time.time()
        
        # Download the file from S3
        response = s3_client.get_object(Bucket=bucket, Key=key)
        file_content = response['Body'].read().decode('utf-8')
        
        # Parse JSON content
        request_data = json.loads(file_content)
        
        # Validate request data
        validation_result = validate_translation_request(request_data)
        if not validation_result['valid']:
            raise ValueError(validation_result['error'])
            
        # Perform translation
        translation_result = perform_translation(request_data)
        
        # Generate unique ID and calculate processing time
        translation_id = str(uuid.uuid4())
        processing_time = time.time() - start_time
        
        # Extract user ID from file metadata (if available)
        user_id = response.get('Metadata', {}).get('uploadedby', 'anonymous')
        
        # Generate result filename
        result_key = f"translated_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{translation_id}_{key}"
        
        # Save metadata to DynamoDB
        metadata = {
            'user_id': user_id,
            'source_language': request_data['source_language'],
            'target_language': request_data['target_language'],
            'request_type': 'file',
            'file_name': key,
            'text_count': len(request_data['texts']),
            'success_count': len([t for t in translation_result.get('translations', []) if t.get('status') == 'success']),
            'processing_time': processing_time
        }
        save_translation_metadata(translation_id, metadata)
        
        # Save user history
        if user_id != 'anonymous':
            translation_data = {
                'translation_id': translation_id,
                'source_language': request_data['source_language'],
                'target_language': request_data['target_language'],
                'translations': translation_result.get('translations', [])
            }
            save_user_translation_history(user_id, translation_data)
        
        # Add translation ID to result
        translation_result['translation_id'] = translation_id
        
        # Save result to response bucket
        save_translation_result(result_key, translation_result, request_data)
        
        return {
            'original_file': key,
            'result_file': result_key,
            'translation_id': translation_id,
            'status': 'success',
            'translations_count': len(translation_result.get('translations', [])),
            'processing_time': processing_time
        }
        
    except Exception as e:
        logger.error(f"Error processing S3 file {key}: {str(e)}")
        return {
            'original_file': key,
            'status': 'error',
            'error': str(e)
        }


def validate_translation_request(request_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Validate the translation request data.
    
    Args:
        request_data: Dictionary containing translation request
        
    Returns:
        Dict with validation result
    """
    try:
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
            
        # Check text length limits (AWS Translate has a 5000 byte limit per request)
        for i, text in enumerate(texts):
            if not isinstance(text, str):
                return {'valid': False, 'error': f"Text at index {i} must be a string"}
            if len(text.encode('utf-8')) > 5000:
                return {'valid': False, 'error': f"Text at index {i} exceeds 5000 bytes limit"}
                
        return {'valid': True, 'error': None}
        
    except Exception as e:
        logger.error(f"Error validating request: {str(e)}")
        return {'valid': False, 'error': f"Validation error: {str(e)}"}


def perform_translation(request_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Perform the actual translation using AWS Translate.
    
    Args:
        request_data: Dictionary containing translation request
        
    Returns:
        Dict containing translation results
    """
    try:
        source_lang = request_data['source_language']
        target_lang = request_data['target_language']
        texts = request_data['texts']
        
        logger.info(f"Translating {len(texts)} texts from {source_lang} to {target_lang}")
        
        translations = []
        
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
                # Call AWS Translate
                response = translate_client.translate_text(
                    Text=text,
                    SourceLanguageCode=source_lang,
                    TargetLanguageCode=target_lang
                )
                
                translations.append({
                    'original_text': text,
                    'translated_text': response['TranslatedText'],
                    'index': i,
                    'status': 'success',
                    'source_language_detected': response.get('SourceLanguageCode'),
                    'target_language': response.get('TargetLanguageCode')
                })
                
                logger.info(f"Successfully translated text {i+1}/{len(texts)}")
                
            except Exception as e:
                logger.error(f"Error translating text {i}: {str(e)}")
                translations.append({
                    'original_text': text,
                    'translated_text': None,
                    'index': i,
                    'status': 'error',
                    'error': str(e)
                })
                
        # Prepare result summary
        successful_translations = [t for t in translations if t['status'] == 'success']
        failed_translations = [t for t in translations if t['status'] == 'error']
        
        result = {
            'request_metadata': {
                'source_language': source_lang,
                'target_language': target_lang,
                'total_texts': len(texts),
                'successful_translations': len(successful_translations),
                'failed_translations': len(failed_translations),
                'timestamp': datetime.now().isoformat()
            },
            'translations': translations,
            'summary': {
                'success_rate': len(successful_translations) / len(texts) * 100 if texts else 0,
                'total_characters_translated': sum(len(t['translated_text'] or '') for t in successful_translations)
            }
        }
        
        logger.info(f"Translation completed: {len(successful_translations)}/{len(texts)} successful")
        
        return result
        
    except Exception as e:
        logger.error(f"Error performing translation: {str(e)}")
        raise


def save_translation_result(file_key: str, translation_result: Dict[str, Any], 
                          original_request: Dict[str, Any]) -> None:
    """
    Save translation result to S3 response bucket.
    
    Args:
        file_key: S3 key for the result file
        translation_result: Translation result data
        original_request: Original request data
    """
    try:
        # Prepare the complete result object
        complete_result = {
            'original_request': original_request,
            'translation_result': translation_result,
            'metadata': {
                'processed_at': datetime.now().isoformat(),
                'lambda_request_id': '',  # Will be set in the context if available
                'version': '1.0'
            }
        }
        
        # Convert to JSON
        result_json = json.dumps(complete_result, indent=2, ensure_ascii=False)
        
        # Upload to S3
        s3_client.put_object(
            Bucket=RESPONSE_BUCKET,
            Key=file_key,
            Body=result_json.encode('utf-8'),
            ContentType='application/json',
            Metadata={
                'source-language': original_request['source_language'],
                'target-language': original_request['target_language'],
                'texts-count': str(len(original_request['texts'])),
                'processed-at': datetime.now().isoformat()
            }
        )
        
        logger.info(f"Translation result saved to {RESPONSE_BUCKET}/{file_key}")
        
    except Exception as e:
        logger.error(f"Error saving translation result: {str(e)}")
        raise


def create_error_response(status_code: int, message: str) -> Dict[str, Any]:
    """
    Create a standardized error response.
    
    Args:
        status_code: HTTP status code
        message: Error message
        
    Returns:
        Dict containing error response
    """
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
            'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
        },
        'body': json.dumps({
            'error': True,
            'message': message,
            'timestamp': datetime.now().isoformat()
        })
    }


# For local testing
if __name__ == "__main__":
    # Test data
    test_event = {
        'source_language': 'en',
        'target_language': 'es',
        'texts': [
            'Hello, world!',
            'How are you today?',
            'This is a test translation.'
        ]
    }
    
    # Mock context
    class MockContext:
        def __init__(self):
            self.aws_request_id = 'test-request-id'
            self.function_name = 'test-function'
            self.memory_limit_in_mb = 256
            self.remaining_time_in_millis = lambda: 30000
    
    # Set environment variables for testing
    if not REQUEST_BUCKET:
        os.environ['REQUEST_BUCKET'] = 'test-request-bucket'
    if not RESPONSE_BUCKET:
        os.environ['RESPONSE_BUCKET'] = 'test-response-bucket'
    
    # Run test
    result = lambda_handler(test_event, MockContext())
    print(json.dumps(result, indent=2))