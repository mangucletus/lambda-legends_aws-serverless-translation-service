# lambda/translate_function.py
# SIMPLIFIED: Core AWS Lambda function for translation

import json
import boto3
import os
import uuid
from datetime import datetime
from typing import Dict, List, Any, Optional

# Initialize AWS clients
s3_client = boto3.client('s3')
translate_client = boto3.client('translate')

# Environment variables
REQUEST_BUCKET = os.environ.get('REQUEST_BUCKET')
RESPONSE_BUCKET = os.environ.get('RESPONSE_BUCKET')
AWS_REGION = os.environ.get('AWS_REGION', 'us-east-1')

def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Main Lambda handler for translation requests."""
    
    try:
        print(f"Processing request: {event.get('httpMethod', 'unknown')}")
        
        # Handle CORS preflight
        if event.get('httpMethod') == 'OPTIONS':
            return create_response(200, {'message': 'CORS preflight successful'})
        
        # Parse request body
        request_data = parse_request_body(event)
        if not request_data:
            return create_response(400, {
                'error': 'Request body is required',
                'example': {
                    'source_language': 'en',
                    'target_language': 'es',
                    'texts': ['Hello, world!']
                }
            })
        
        # Validate request
        validation_error = validate_request(request_data)
        if validation_error:
            return create_response(400, {'error': validation_error})
        
        # Perform translation
        translation_result = perform_translation(request_data)
        
        # Save to S3 (optional, don't fail if it doesn't work)
        try:
            save_to_s3(request_data, translation_result)
        except Exception as e:
            print(f"Warning: Failed to save to S3: {e}")
        
        return create_response(200, translation_result)
        
    except Exception as e:
        print(f"Error: {str(e)}")
        return create_response(500, {
            'error': f"Translation failed: {str(e)}"
        })


def create_response(status_code: int, body_data: Any) -> Dict[str, Any]:
    """Create API Gateway response with CORS headers."""
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type,Authorization',
            'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
        },
        'body': json.dumps(body_data, default=str)
    }


def parse_request_body(event: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Parse request body from API Gateway event."""
    try:
        body = event.get('body')
        if not body:
            return None
        
        # Handle base64 encoded body
        if event.get('isBase64Encoded'):
            import base64
            body = base64.b64decode(body).decode('utf-8')
        
        return json.loads(body) if isinstance(body, str) else body
        
    except Exception as e:
        print(f"Error parsing request body: {e}")
        return None


def validate_request(request_data: Dict[str, Any]) -> Optional[str]:
    """Validate translation request data."""
    
    # Check required fields
    required_fields = ['source_language', 'target_language', 'texts']
    for field in required_fields:
        if field not in request_data:
            return f"Missing required field: '{field}'"
    
    # Validate texts
    texts = request_data['texts']
    if not isinstance(texts, list) or not texts:
        return "Field 'texts' must be a non-empty list"
    
    if len(texts) > 100:
        return f"Too many texts: {len(texts)} (maximum 100)"
    
    # Check text length (AWS Translate limit is 5000 bytes)
    for i, text in enumerate(texts):
        if not isinstance(text, str):
            return f"Text at index {i} must be a string"
        
        if len(text.encode('utf-8')) > 5000:
            return f"Text at index {i} exceeds 5000 bytes"
    
    return None


def perform_translation(request_data: Dict[str, Any]) -> Dict[str, Any]:
    """Perform the actual translation using AWS Translate."""
    
    source_lang = request_data['source_language']
    target_lang = request_data['target_language']
    texts = request_data['texts']
    
    print(f"Translating {len(texts)} texts from {source_lang} to {target_lang}")
    
    translations = []
    successful_count = 0
    failed_count = 0
    
    for i, text in enumerate(texts):
        if not text or not text.strip():
            # Skip empty texts
            translations.append({
                'original_text': text,
                'translated_text': '',
                'index': i,
                'status': 'skipped'
            })
            continue
        
        try:
            # Call AWS Translate
            response = translate_client.translate_text(
                Text=text.strip(),
                SourceLanguageCode=source_lang,
                TargetLanguageCode=target_lang
            )
            
            translated_text = response['TranslatedText']
            successful_count += 1
            
            translations.append({
                'original_text': text,
                'translated_text': translated_text,
                'index': i,
                'status': 'success',
                'source_language_detected': response.get('SourceLanguageCode', source_lang),
                'target_language': response.get('TargetLanguageCode', target_lang)
            })
            
        except Exception as e:
            print(f"Error translating text {i+1}: {str(e)}")
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
            'total_characters_translated': sum(
                len(t.get('translated_text', '')) 
                for t in translations 
                if t.get('status') == 'success'
            )
        }
    }
    
    print(f"Translation completed: {successful_count}/{total_texts} successful")
    return result


def save_to_s3(request_data: Dict[str, Any], translation_result: Dict[str, Any]) -> None:
    """Save request and response to S3 buckets."""
    
    if not REQUEST_BUCKET or not RESPONSE_BUCKET:
        print("S3 buckets not configured, skipping save")
        return
    
    timestamp = datetime.now().strftime('%Y%m%d-%H%M%S')
    request_id = str(uuid.uuid4())[:8]
    
    try:
        # Save request
        request_key = f"request-{timestamp}-{request_id}.json"
        s3_client.put_object(
            Bucket=REQUEST_BUCKET,
            Key=request_key,
            Body=json.dumps(request_data),
            ContentType='application/json'
        )
        
        # Save response
        response_key = f"response-{timestamp}-{request_id}.json"
        complete_result = {
            'request': request_data,
            'response': translation_result,
            'metadata': {
                'timestamp': datetime.now().isoformat(),
                'request_id': request_id
            }
        }
        
        s3_client.put_object(
            Bucket=RESPONSE_BUCKET,
            Key=response_key,
            Body=json.dumps(complete_result),
            ContentType='application/json'
        )
        
        print(f"Saved to S3: {request_key} and {response_key}")
        
    except Exception as e:
        print(f"Error saving to S3: {e}")
        raise


# For local testing
if __name__ == "__main__":
    test_event = {
        'httpMethod': 'POST',
        'body': json.dumps({
            'source_language': 'en',
            'target_language': 'es',
            'texts': [
                'Hello, world!',
                'How are you today?',
                'This is a test translation.'
            ]
        })
    }
    
    class MockContext:
        aws_request_id = 'test-request-id'
    
    result = lambda_handler(test_event, MockContext())
    print("Test Result:")
    print(json.dumps(result, indent=2))