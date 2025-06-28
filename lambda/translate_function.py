# lambda/translate_function.py
# ENHANCED: AWS Lambda function with improved error handling and API Gateway response format

import json
import boto3
import os
import uuid
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from urllib.parse import unquote_plus
import time
import traceback

# Configure logging with enhanced formatting
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize AWS clients with error handling
try:
    s3_client = boto3.client('s3')
    translate_client = boto3.client('translate')
    dynamodb = boto3.resource('dynamodb')
    logger.info("✅ AWS clients initialized successfully")
except Exception as e:
    logger.error(f"❌ Failed to initialize AWS clients: {str(e)}")
    raise

# Environment variables with validation
REQUEST_BUCKET = os.environ.get('REQUEST_BUCKET')
RESPONSE_BUCKET = os.environ.get('RESPONSE_BUCKET')
USER_DATA_TABLE = os.environ.get('USER_DATA_TABLE')
TRANSLATION_TABLE = os.environ.get('TRANSLATION_TABLE')
AWS_REGION = os.environ.get('AWS_REGION', 'us-east-1')

# Validate required environment variables
required_env_vars = {
    'REQUEST_BUCKET': REQUEST_BUCKET,
    'RESPONSE_BUCKET': RESPONSE_BUCKET,
    'USER_DATA_TABLE': USER_DATA_TABLE,
    'TRANSLATION_TABLE': TRANSLATION_TABLE
}

missing_vars = [k for k, v in required_env_vars.items() if not v]
if missing_vars:
    logger.warning(f"⚠️ Missing environment variables: {missing_vars}")

# DynamoDB tables with error handling
try:
    user_data_table = dynamodb.Table(USER_DATA_TABLE) if USER_DATA_TABLE else None
    translation_table = dynamodb.Table(TRANSLATION_TABLE) if TRANSLATION_TABLE else None
    if user_data_table:
        logger.info(f"✅ Connected to user data table: {USER_DATA_TABLE}")
    if translation_table:
        logger.info(f"✅ Connected to translation table: {TRANSLATION_TABLE}")
except Exception as e:
    logger.error(f"❌ Failed to connect to DynamoDB tables: {str(e)}")
    user_data_table = None
    translation_table = None

# Enhanced supported language codes for AWS Translate
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
    ENHANCED: Main Lambda handler with comprehensive error handling and logging.
    """
    start_time = time.time()
    request_id = context.aws_request_id if context else str(uuid.uuid4())
    
    try:
        logger.info(f"🚀 Lambda function started - Request ID: {request_id}")
        logger.info(f"📊 Event type: {determine_event_type(event)}")
        
        # Log event for debugging (truncated for security)
        event_preview = str(event)[:500] + "..." if len(str(event)) > 500 else str(event)
        logger.info(f"📋 Event preview: {event_preview}")
        
        # Determine the event source and handle accordingly
        if 'Records' in event:
            # S3 event trigger
            logger.info("📁 Processing S3 event")
            return handle_s3_event(event, context)
        elif 'httpMethod' in event or 'requestContext' in event:
            # API Gateway event
            logger.info("🌐 Processing API Gateway event")
            return handle_api_gateway_event(event, context)
        else:
            # Direct invocation
            logger.info("⚡ Processing direct invocation")
            return handle_direct_invocation(event, context)
            
    except Exception as e:
        # Enhanced error logging
        error_details = {
            'error_type': type(e).__name__,
            'error_message': str(e),
            'request_id': request_id,
            'processing_time': time.time() - start_time,
            'traceback': traceback.format_exc()
        }
        
        logger.error(f"❌ Critical error in lambda_handler: {json.dumps(error_details, indent=2)}")
        
        return create_api_gateway_response(500, {
            'error': True,
            'message': f"Internal server error: {str(e)}",
            'request_id': request_id,
            'timestamp': datetime.now().isoformat()
        })


def determine_event_type(event: Dict[str, Any]) -> str:
    """Determine the type of event received."""
    if 'Records' in event:
        return 'S3'
    elif 'httpMethod' in event:
        return 'API Gateway'
    elif 'requestContext' in event:
        return 'API Gateway v2'
    else:
        return 'Direct Invocation'


def handle_api_gateway_event(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    ENHANCED: Handle API Gateway request with comprehensive error handling and response formatting.
    """
    start_time = time.time()
    request_id = context.aws_request_id if context else str(uuid.uuid4())
    
    try:
        logger.info(f"🌐 Processing API Gateway request: {event.get('httpMethod', 'unknown')}")
        
        # Handle CORS preflight requests
        if event.get('httpMethod') == 'OPTIONS':
            logger.info("✈️ Handling CORS preflight request")
            return create_api_gateway_response(200, {
                'message': 'CORS preflight successful',
                'supported_methods': ['POST', 'OPTIONS'],
                'supported_headers': ['Content-Type', 'Authorization']
            })
        
        # Parse and validate the request body
        request_data = parse_request_body(event)
        if not request_data:
            logger.warning("⚠️ Empty or invalid request body")
            return create_api_gateway_response(400, {
                'error': True,
                'message': "Request body is required and must be valid JSON",
                'example': {
                    'source_language': 'en',
                    'target_language': 'es',
                    'texts': ['Hello, world!', 'How are you?']
                }
            })
        
        logger.info(f"📝 Request data: {json.dumps(request_data, indent=2)[:200]}...")
        
        # Validate request data structure
        validation_result = validate_translation_request(request_data)
        if not validation_result['valid']:
            logger.error(f"❌ Validation failed: {validation_result['error']}")
            return create_api_gateway_response(400, {
                'error': True,
                'message': validation_result['error'],
                'request_id': request_id
            })
        
        # Extract user information from request context
        user_id = extract_user_id(event)
        logger.info(f"👤 User ID: {user_id}")
        
        # Generate unique ID for this translation request
        translation_id = str(uuid.uuid4())
        logger.info(f"🔖 Translation ID: {translation_id}")
        
        # Save request to S3 (non-blocking)
        try:
            request_key = f"api-request-{datetime.now().strftime('%Y%m%d-%H%M%S')}-{translation_id}.json"
            save_request_to_s3(request_key, request_data, user_id, 'api')
            logger.info(f"💾 Request saved to S3: {request_key}")
        except Exception as s3_error:
            logger.warning(f"⚠️ Failed to save request to S3: {s3_error}")
        
        # Perform the actual translation
        logger.info("🔄 Starting translation process")
        translation_result = perform_translation(request_data, translation_id, user_id)
        
        # Calculate processing metrics
        processing_time = time.time() - start_time
        translation_result['processing_metrics'] = {
            'processing_time_seconds': round(processing_time, 3),
            'request_id': request_id,
            'translation_id': translation_id,
            'user_id': user_id,
            'timestamp': datetime.now().isoformat()
        }
        
        # Save metadata to DynamoDB (non-blocking)
        try:
            metadata = {
                'user_id': user_id,
                'source_language': request_data['source_language'],
                'target_language': request_data['target_language'],
                'request_type': 'api',
                'text_count': len(request_data['texts']),
                'success_count': translation_result['request_metadata']['successful_translations'],
                'processing_time': processing_time,
                'request_id': request_id
            }
            save_translation_metadata(translation_id, metadata)
            
            if user_id != 'anonymous':
                save_user_translation_history(user_id, translation_result)
                
            logger.info("💾 Metadata saved to DynamoDB")
        except Exception as db_error:
            logger.warning(f"⚠️ Failed to save metadata to DynamoDB: {db_error}")
        
        # Save result to S3 Response Bucket (non-blocking)
        try:
            response_key = f"api-response-{datetime.now().strftime('%Y%m%d-%H%M%S')}-{translation_id}.json"
            complete_result = {
                'original_request': request_data,
                'translation_result': translation_result,
                'metadata': {
                    'processed_at': datetime.now().isoformat(),
                    'lambda_request_id': request_id,
                    'version': '2.0',
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
        
        # Log successful completion
        success_count = translation_result['request_metadata']['successful_translations']
        total_count = translation_result['request_metadata']['total_texts']
        logger.info(f"✅ Translation completed: {success_count}/{total_count} successful in {processing_time:.3f}s")
        
        # Return properly formatted API Gateway response
        return create_api_gateway_response(200, translation_result)
        
    except Exception as e:
        processing_time = time.time() - start_time
        error_details = {
            'error_type': type(e).__name__,
            'error_message': str(e),
            'request_id': request_id,
            'processing_time': processing_time,
            'traceback': traceback.format_exc()
        }
        
        logger.error(f"❌ Error handling API Gateway event: {json.dumps(error_details, indent=2)}")
        
        return create_api_gateway_response(500, {
            'error': True,
            'message': f"Error processing request: {str(e)}",
            'request_id': request_id,
            'timestamp': datetime.now().isoformat()
        })


def create_api_gateway_response(status_code: int, body_data: Any) -> Dict[str, Any]:
    """
    ENHANCED: Create proper API Gateway response format with comprehensive headers.
    """
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent',
            'Access-Control-Allow-Methods': 'GET,POST,OPTIONS,PUT,DELETE',
            'Access-Control-Allow-Credentials': 'false',
            'Access-Control-Max-Age': '86400',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'DENY',
            'X-XSS-Protection': '1; mode=block'
        },
        'body': json.dumps(body_data, default=str, ensure_ascii=False, indent=None)
    }


def perform_translation(request_data: Dict[str, Any], translation_id: str, user_id: str) -> Dict[str, Any]:
    """
    ENHANCED: Perform translation with improved error handling and detailed logging.
    """
    try:
        source_lang = request_data['source_language']
        target_lang = request_data['target_language']
        texts = request_data['texts']
        
        logger.info(f"🔄 Translating {len(texts)} texts from {source_lang} to {target_lang}")
        
        translations = []
        successful_count = 0
        failed_count = 0
        total_characters = 0
        errors = []
        
        for i, text in enumerate(texts):
            if not text or not text.strip():
                logger.debug(f"⏭️ Skipping empty text at index {i}")
                translations.append({
                    'original_text': text,
                    'translated_text': '',
                    'index': i,
                    'status': 'skipped',
                    'reason': 'empty_text'
                })
                continue
            
            try:
                # Validate text length (AWS Translate limit is 5000 bytes)
                text_bytes = len(text.encode('utf-8'))
                if text_bytes > 5000:
                    logger.warning(f"⚠️ Text {i+1} exceeds 5000 bytes ({text_bytes} bytes)")
                    translations.append({
                        'original_text': text,
                        'translated_text': None,
                        'index': i,
                        'status': 'error',
                        'error': f'Text too long: {text_bytes} bytes (max 5000)'
                    })
                    failed_count += 1
                    continue
                
                logger.debug(f"🔄 Translating text {i+1}/{len(texts)}: {text[:50]}...")
                
                # Call AWS Translate with retry logic
                max_retries = 3
                retry_count = 0
                
                while retry_count < max_retries:
                    try:
                        response = translate_client.translate_text(
                            Text=text.strip(),
                            SourceLanguageCode=source_lang,
                            TargetLanguageCode=target_lang
                        )
                        break
                    except Exception as translate_error:
                        retry_count += 1
                        if retry_count >= max_retries:
                            raise translate_error
                        logger.warning(f"⚠️ Translation retry {retry_count}/{max_retries} for text {i+1}")
                        time.sleep(0.5 * retry_count)  # Exponential backoff
                
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
                
                logger.debug(f"✅ Text {i+1} translated successfully: '{text[:30]}...' -> '{translated_text[:30]}...'")
                
            except Exception as translate_error:
                error_msg = str(translate_error)
                logger.error(f"❌ Error translating text {i+1}: {error_msg}")
                errors.append(f"Text {i+1}: {error_msg}")
                failed_count += 1
                
                translations.append({
                    'original_text': text,
                    'translated_text': None,
                    'index': i,
                    'status': 'error',
                    'error': error_msg
                })
        
        # Calculate comprehensive statistics
        total_texts = len(texts)
        success_rate = round((successful_count / total_texts * 100), 2) if total_texts > 0 else 0
        avg_chars_per_translation = round(total_characters / successful_count, 2) if successful_count > 0 else 0
        
        # Create comprehensive result structure
        result = {
            'request_metadata': {
                'source_language': source_lang,
                'target_language': target_lang,
                'total_texts': total_texts,
                'successful_translations': successful_count,
                'failed_translations': failed_count,
                'skipped_translations': sum(1 for t in translations if t.get('status') == 'skipped'),
                'timestamp': datetime.now().isoformat(),
                'translation_id': translation_id,
                'user_id': user_id
            },
            'translations': translations,
            'summary': {
                'success_rate': success_rate,
                'total_characters_translated': total_characters,
                'average_characters_per_translation': avg_chars_per_translation,
                'processing_time_per_text_ms': 0  # Will be calculated later
            },
            'errors': errors if errors else None
        }
        
        logger.info(f"✅ Translation completed: {successful_count}/{total_texts} successful ({success_rate}% success rate)")
        
        if errors:
            logger.warning(f"⚠️ Encountered {len(errors)} errors during translation")
        
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
                'skipped_translations': 0,
                'timestamp': datetime.now().isoformat(),
                'translation_id': translation_id,
                'user_id': user_id
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
                'total_characters_translated': 0,
                'average_characters_per_translation': 0
            },
            'errors': [f"Critical translation error: {str(e)}"]
        }


def validate_translation_request(request_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    ENHANCED: Comprehensive validation of translation request data.
    """
    try:
        if not request_data or not isinstance(request_data, dict):
            return {'valid': False, 'error': 'Request data must be a valid JSON object'}
        
        # Check required fields
        required_fields = ['source_language', 'target_language', 'texts']
        for field in required_fields:
            if field not in request_data:
                return {'valid': False, 'error': f"Missing required field: '{field}'"}
        
        # Validate language codes
        source_lang = request_data['source_language']
        target_lang = request_data['target_language']
        
        if not isinstance(source_lang, str) or source_lang not in SUPPORTED_LANGUAGES:
            return {'valid': False, 'error': f"Unsupported source language: '{source_lang}'. Supported: {list(SUPPORTED_LANGUAGES.keys())[:10]}..."}
        
        if not isinstance(target_lang, str) or target_lang not in SUPPORTED_LANGUAGES:
            return {'valid': False, 'error': f"Unsupported target language: '{target_lang}'. Supported: {list(SUPPORTED_LANGUAGES.keys())[:10]}..."}
        
        # Validate texts field
        texts = request_data['texts']
        if not isinstance(texts, list):
            return {'valid': False, 'error': "Field 'texts' must be a list/array"}
        
        if not texts:
            return {'valid': False, 'error': "Field 'texts' cannot be empty"}
        
        if len(texts) > 100:
            return {'valid': False, 'error': f"Too many texts: {len(texts)} (maximum 100 texts per request)"}
        
        # Check individual texts
        for i, text in enumerate(texts):
            if not isinstance(text, str):
                return {'valid': False, 'error': f"Text at index {i} must be a string"}
            
            text_bytes = len(text.encode('utf-8'))
            if text_bytes > 5000:
                return {'valid': False, 'error': f"Text at index {i} exceeds 5000 bytes limit ({text_bytes} bytes)"}
        
        logger.info(f"✅ Request validation passed: {len(texts)} texts, {source_lang} -> {target_lang}")
        return {'valid': True, 'error': None}
        
    except Exception as e:
        logger.error(f"❌ Error validating request: {str(e)}")
        return {'valid': False, 'error': f"Validation error: {str(e)}"}


def parse_request_body(event: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    ENHANCED: Parse request body with comprehensive error handling.
    """
    try:
        if not event.get('body'):
            logger.warning("⚠️ No body found in request")
            return None
        
        body = event['body']
        
        # Handle base64 encoded body
        if event.get('isBase64Encoded'):
            import base64
            body = base64.b64decode(body).decode('utf-8')
            logger.debug("🔓 Decoded base64 encoded body")
        
        # Parse JSON
        if isinstance(body, str):
            parsed_body = json.loads(body)
            logger.debug(f"📋 Parsed JSON body with {len(parsed_body)} keys")
            return parsed_body
        else:
            logger.debug("📋 Body already parsed")
            return body
        
    except json.JSONDecodeError as e:
        logger.error(f"❌ JSON decode error: {str(e)}")
        return None
    except Exception as e:
        logger.error(f"❌ Error parsing request body: {str(e)}")
        return None


def extract_user_id(event: Dict[str, Any]) -> str:
    """
    ENHANCED: Extract user ID from API Gateway event with fallback strategies.
    """
    try:
        request_context = event.get('requestContext', {})
        
        # Strategy 1: Check authorizer claims
        authorizer = request_context.get('authorizer', {})
        if 'claims' in authorizer:
            user_id = authorizer['claims'].get('sub') or authorizer['claims'].get('cognito:username')
            if user_id:
                logger.debug(f"👤 User ID from claims: {user_id}")
                return user_id
        
        # Strategy 2: Check lambda authorizer
        if 'lambda' in authorizer:
            user_id = authorizer['lambda'].get('sub') or authorizer['lambda'].get('principalId')
            if user_id:
                logger.debug(f"👤 User ID from lambda authorizer: {user_id}")
                return user_id
        
        # Strategy 3: Check principalId
        if 'principalId' in authorizer:
            logger.debug(f"👤 User ID from principalId: {authorizer['principalId']}")
            return authorizer['principalId']
        
        # Strategy 4: Check identity
        identity = request_context.get('identity', {})
        if identity.get('userArn'):
            logger.debug(f"👤 User ID from userArn: {identity['userArn']}")
            return identity['userArn']
        
        # Strategy 5: Check source IP as fallback
        source_ip = identity.get('sourceIp')
        if source_ip:
            user_id = f"ip-{source_ip}"
            logger.debug(f"👤 Using source IP as user ID: {user_id}")
            return user_id
        
        logger.warning("⚠️ Could not extract user ID, using anonymous")
        return 'anonymous'
        
    except Exception as e:
        logger.warning(f"⚠️ Error extracting user ID: {str(e)}")
        return 'anonymous'


def save_translation_result(file_key: str, complete_result: Dict[str, Any]) -> None:
    """
    ENHANCED: Save translation result to S3 with comprehensive metadata.
    """
    try:
        if not RESPONSE_BUCKET:
            logger.warning("⚠️ Response bucket not configured, skipping S3 save")
            return
        
        # Convert to JSON with proper formatting
        result_json = json.dumps(complete_result, indent=2, ensure_ascii=False, default=str)
        
        # Extract metadata for S3 object metadata
        translation_result = complete_result.get('translation_result', {})
        request_metadata = translation_result.get('request_metadata', {})
        summary = translation_result.get('summary', {})
        
        # Upload to S3 Response Bucket with comprehensive metadata
        s3_client.put_object(
            Bucket=RESPONSE_BUCKET,
            Key=file_key,
            Body=result_json.encode('utf-8'),
            ContentType='application/json',
            Metadata={
                'source-language': str(request_metadata.get('source_language', '')),
                'target-language': str(request_metadata.get('target_language', '')),
                'texts-count': str(request_metadata.get('total_texts', 0)),
                'successful-translations': str(request_metadata.get('successful_translations', 0)),
                'failed-translations': str(request_metadata.get('failed_translations', 0)),
                'success-rate': str(summary.get('success_rate', 0)),
                'total-characters': str(summary.get('total_characters_translated', 0)),
                'translation-id': str(request_metadata.get('translation_id', '')),
                'user-id': str(request_metadata.get('user_id', 'anonymous')),
                'processed-at': datetime.now().isoformat(),
                'version': '2.0'
            }
        )
        
        logger.info(f"💾 Translation result saved to s3://{RESPONSE_BUCKET}/{file_key}")
        
    except Exception as e:
        logger.error(f"❌ Error saving translation result to S3: {str(e)}")
        raise


def save_request_to_s3(key: str, request_data: Dict[str, Any], user_id: str, request_type: str) -> None:
    """
    ENHANCED: Save request data to S3 with comprehensive metadata.
    """
    try:
        if not REQUEST_BUCKET:
            logger.warning("⚠️ Request bucket not configured, skipping S3 save")
            return
        
        request_object = {
            'request_data': request_data,
            'metadata': {
                'user_id': user_id,
                'request_type': request_type,
                'timestamp': datetime.now().isoformat(),
                'source_language': request_data.get('source_language'),
                'target_language': request_data.get('target_language'),
                'text_count': len(request_data.get('texts', [])),
                'version': '2.0'
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
                'timestamp': datetime.now().isoformat(),
                'version': '2.0'
            }
        )
        
        logger.info(f"💾 Request saved to s3://{REQUEST_BUCKET}/{key}")
        
    except Exception as e:
        logger.error(f"❌ Error saving request to S3: {str(e)}")
        raise


def save_translation_metadata(translation_id: str, metadata: Dict[str, Any]) -> None:
    """
    ENHANCED: Save translation metadata to DynamoDB with error handling.
    """
    try:
        if not translation_table:
            logger.warning("⚠️ Translation table not configured, skipping DynamoDB save")
            return
        
        timestamp = datetime.now().isoformat()
        ttl = int((datetime.now() + timedelta(days=90)).timestamp())
        
        item = {
            'translation_id': translation_id,
            'user_id': metadata.get('user_id', 'anonymous'),
            'source_language': metadata.get('source_language'),
            'target_language': metadata.get('target_language'),
            'request_type': metadata.get('request_type', 'api'),
            'text_count': metadata.get('text_count', 0),
            'success_count': metadata.get('success_count', 0),
            'file_name': metadata.get('file_name'),
            'request_id': metadata.get('request_id'),
            'created_at': timestamp,
            'processing_time': metadata.get('processing_time', 0),
            'ttl': ttl,
            'version': '2.0'
        }
        
        translation_table.put_item(Item=item)
        logger.info(f"💾 Translation metadata saved for {translation_id}")
        
    except Exception as e:
        logger.error(f"❌ Error saving translation metadata: {str(e)}")


def save_user_translation_history(user_id: str, translation_data: Dict[str, Any]) -> None:
    """
    ENHANCED: Save user translation history to DynamoDB.
    """
    try:
        if not user_data_table:
            logger.warning("⚠️ User data table not configured, skipping DynamoDB save")
            return
        
        timestamp = datetime.now().isoformat()
        ttl = int((datetime.now() + timedelta(days=365)).timestamp())
        
        item = {
            'user_id': user_id,
            'timestamp': timestamp,
            'translation_id': translation_data.get('request_metadata', {}).get('translation_id', str(uuid.uuid4())),
            'source_language': translation_data.get('request_metadata', {}).get('source_language'),
            'target_language': translation_data.get('request_metadata', {}).get('target_language'),
            'text_count': len(translation_data.get('translations', [])),
            'success_count': translation_data.get('request_metadata', {}).get('successful_translations', 0),
            'processing_time': translation_data.get('processing_metrics', {}).get('processing_time_seconds', 0),
            'created_at': timestamp,
            'ttl': ttl,
            'version': '2.0'
        }
        
        user_data_table.put_item(Item=item)
        logger.info(f"💾 User translation history saved for {user_id}")
        
    except Exception as e:
        logger.error(f"❌ Error saving user translation history: {str(e)}")


def handle_s3_event(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    ENHANCED: Handle S3 event with comprehensive processing.
    """
    try:
        processed_files = []
        
        for record in event['Records']:
            bucket = record['s3']['bucket']['name']
            key = unquote_plus(record['s3']['object']['key'])
            
            logger.info(f"📁 Processing S3 file: {key} from bucket: {bucket}")
            
            if bucket != REQUEST_BUCKET:
                logger.warning(f"⚠️ File from unexpected bucket: {bucket}")
                continue
            
            if not key.lower().endswith('.json'):
                logger.info(f"⏭️ Skipping non-JSON file: {key}")
                continue
            
            result = process_s3_file(bucket, key)
            processed_files.append(result)
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'S3 files processed successfully',
                'processed_files': processed_files,
                'total_files': len(processed_files)
            }, default=str)
        }
        
    except Exception as e:
        logger.error(f"❌ Error handling S3 event: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': True,
                'message': f"Error processing S3 event: {str(e)}"
            }, default=str)
        }


def process_s3_file(bucket: str, key: str) -> Dict[str, Any]:
    """
    ENHANCED: Process S3 file with comprehensive error handling.
    """
    try:
        start_time = time.time()
        
        # Download the file from S3
        response = s3_client.get_object(Bucket=bucket, Key=key)
        file_content = response['Body'].read().decode('utf-8')
        
        # Parse JSON content
        file_data = json.loads(file_content)
        
        # Extract request data and metadata
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
        
        # Generate translation ID
        translation_id = str(uuid.uuid4())
        
        # Perform translation
        translation_result = perform_translation(request_data, translation_id, user_id)
        
        # Calculate processing time
        processing_time = time.time() - start_time
        translation_result['processing_metrics'] = {
            'processing_time_seconds': round(processing_time, 3),
            'translation_id': translation_id,
            'user_id': user_id,
            'source_file': key
        }
        
        # Save metadata to DynamoDB
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
            logger.warning(f"⚠️ Failed to save metadata: {str(e)}")
        
        # Generate result filename and save to S3
        result_key = f"s3-response-{datetime.now().strftime('%Y%m%d-%H%M%S')}-{translation_id}.json"
        
        complete_result = {
            'original_request': request_data,
            'translation_result': translation_result,
            'metadata': {
                'processed_at': datetime.now().isoformat(),
                'lambda_request_id': context.aws_request_id if context else '',
                'version': '2.0',
                'source_file': key,
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
            'successful_translations': translation_result['request_metadata']['successful_translations'],
            'processing_time': processing_time,
            'response_saved_to': f"s3://{RESPONSE_BUCKET}/{result_key}"
        }
        
    except Exception as e:
        logger.error(f"❌ Error processing S3 file {key}: {str(e)}")
        return {
            'original_file': key,
            'status': 'error',
            'error': str(e),
            'error_type': type(e).__name__
        }


def handle_direct_invocation(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    ENHANCED: Handle direct Lambda invocation.
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
        
        translation_id = str(uuid.uuid4())
        translation_result = perform_translation(event, translation_id, 'direct')
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Translation completed successfully',
                'translation_result': translation_result
            }, default=str)
        }
        
    except Exception as e:
        logger.error(f"❌ Error handling direct invocation: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': True,
                'message': f"Error processing direct invocation: {str(e)}"
            }, default=str)
        }


# Health check endpoint for monitoring
def health_check() -> Dict[str, Any]:
    """Health check for the Lambda function."""
    try:
        # Test AWS service connections
        services_status = {
            'translate': 'unknown',
            's3': 'unknown',
            'dynamodb': 'unknown'
        }
        
        # Test Translate service
        try:
            translate_client.translate_text(
                Text='Hello',
                SourceLanguageCode='en',
                TargetLanguageCode='es'
            )
            services_status['translate'] = 'healthy'
        except Exception:
            services_status['translate'] = 'unhealthy'
        
        # Test S3 service
        try:
            if REQUEST_BUCKET:
                s3_client.head_bucket(Bucket=REQUEST_BUCKET)
                services_status['s3'] = 'healthy'
        except Exception:
            services_status['s3'] = 'unhealthy'
        
        # Test DynamoDB service
        try:
            if translation_table:
                translation_table.table_status
                services_status['dynamodb'] = 'healthy'
        except Exception:
            services_status['dynamodb'] = 'unhealthy'
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'status': 'healthy',
                'services': services_status,
                'environment': {
                    'request_bucket': REQUEST_BUCKET,
                    'response_bucket': RESPONSE_BUCKET,
                    'user_data_table': USER_DATA_TABLE,
                    'translation_table': TRANSLATION_TABLE,
                    'region': AWS_REGION
                },
                'supported_languages_count': len(SUPPORTED_LANGUAGES),
                'timestamp': datetime.now().isoformat()
            }, default=str)
        }
        
    except Exception as e:
        return {
            'statusCode': 500,
            'body': json.dumps({
                'status': 'unhealthy',
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            }, default=str)
        }


# For local testing and development
if __name__ == "__main__":
    # Test event for local development
    test_event = {
        'source_language': 'en',
        'target_language': 'es',
        'texts': [
            'Hello, world!',
            'How are you today?',
            'This is an enhanced test translation with better error handling.',
            'The Lambda function now includes comprehensive logging and monitoring.',
            'Translation results are saved to both S3 and DynamoDB for tracking.'
        ]
    }
    
    class MockContext:
        def __init__(self):
            self.aws_request_id = 'test-request-id-' + str(uuid.uuid4())
            self.function_name = 'test-function'
            self.memory_limit_in_mb = 256
            self.remaining_time_in_millis = lambda: 30000
    
    # Set environment variables for testing
    if not REQUEST_BUCKET:
        os.environ['REQUEST_BUCKET'] = 'test-request-bucket'
    if not RESPONSE_BUCKET:
        os.environ['RESPONSE_BUCKET'] = 'test-response-bucket'
    if not USER_DATA_TABLE:
        os.environ['USER_DATA_TABLE'] = 'test-user-data-table'
    if not TRANSLATION_TABLE:
        os.environ['TRANSLATION_TABLE'] = 'test-translation-table'
    
    print("🧪 Running local test...")
    result = lambda_handler(test_event, MockContext())
    print("📊 Test Result:")
    print(json.dumps(result, indent=2, default=str))