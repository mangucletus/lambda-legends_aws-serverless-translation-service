// frontend/src/aws-config.js
// AWS configuration for the React application
// This file will be automatically updated by the CI/CD pipeline

// Default configuration for local development
// These values will be replaced during deployment
const awsConfig = {
  // AWS Region where resources are deployed
  region: process.env.REACT_APP_AWS_REGION || 'us-east-1',
  
  // Cognito User Pool ID for authentication
  userPoolId: process.env.REACT_APP_USER_POOL_ID || 'us-east-1_XXXXXXXXX',
  
  // Cognito User Pool Client ID
  userPoolWebClientId: process.env.REACT_APP_USER_POOL_CLIENT_ID || 'XXXXXXXXXXXXXXXXXXXXXXXXXX',
  
  // Cognito Identity Pool ID for AWS resource access
  identityPoolId: process.env.REACT_APP_IDENTITY_POOL_ID || 'us-east-1:XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX',
  
  // API Gateway URL for translation service
  apiGatewayUrl: process.env.REACT_APP_API_GATEWAY_URL || 'https://XXXXXXXXXX.execute-api.us-east-1.amazonaws.com/dev',
  
  // S3 bucket for storing translation requests
  requestBucketName: process.env.REACT_APP_REQUEST_BUCKET || 'aws-translate-app-requests-XXXXXXXX',
  
  // S3 bucket for storing translation responses
  responseBucketName: process.env.REACT_APP_RESPONSE_BUCKET || 'aws-translate-app-responses-XXXXXXXX',
  
  // CloudFront URL for the frontend (optional)
  cloudfrontUrl: process.env.REACT_APP_CLOUDFRONT_URL || 'https://XXXXXXXXXXXXXX.cloudfront.net'
};

// Validation function to check if configuration is properly set
export const validateConfig = () => {
  const requiredFields = [
    'region',
    'userPoolId',
    'userPoolWebClientId',
    'identityPoolId',
    'apiGatewayUrl',
    'requestBucketName',
    'responseBucketName'
  ];
  
  const missingFields = requiredFields.filter(field => {
    const value = awsConfig[field];
    return !value || value.includes('XXXXXXXX') || value.includes('XXXXXXXXXX');
  });
  
  if (missingFields.length > 0) {
    console.warn('AWS configuration incomplete. Missing or default values for:', missingFields);
    
    // In development, show a helpful message
    if (process.env.NODE_ENV === 'development') {
      console.log(`
🔧 Development Setup Required:

To run this application locally, you need to:

1. Deploy the infrastructure using Terraform:
   cd infrastructure && terraform apply

2. Update this file (aws-config.js) with the actual values from Terraform outputs:
   terraform output -json

3. Or set environment variables in a .env file:
   REACT_APP_AWS_REGION=us-east-1
   REACT_APP_USER_POOL_ID=your-user-pool-id
   REACT_APP_USER_POOL_CLIENT_ID=your-client-id
   REACT_APP_IDENTITY_POOL_ID=your-identity-pool-id
   REACT_APP_API_GATEWAY_URL=your-api-gateway-url
   REACT_APP_REQUEST_BUCKET=your-request-bucket
   REACT_APP_RESPONSE_BUCKET=your-response-bucket

Note: The CI/CD pipeline will automatically update this configuration during deployment.
      `);
    }
    
    return false;
  }
  
  return true;
};

// Log configuration status
if (process.env.NODE_ENV === 'development') {
  console.log('AWS Configuration:', {
    region: awsConfig.region,
    userPoolId: awsConfig.userPoolId ? '✅ Set' : '❌ Missing',
    userPoolWebClientId: awsConfig.userPoolWebClientId ? '✅ Set' : '❌ Missing',
    identityPoolId: awsConfig.identityPoolId ? '✅ Set' : '❌ Missing',
    apiGatewayUrl: awsConfig.apiGatewayUrl ? '✅ Set' : '❌ Missing',
    requestBucketName: awsConfig.requestBucketName ? '✅ Set' : '❌ Missing',
    responseBucketName: awsConfig.responseBucketName ? '✅ Set' : '❌ Missing'
  });
}

// Supported languages for the translation service
export const SUPPORTED_LANGUAGES = {
  'af': 'Afrikaans',
  'sq': 'Albanian', 
  'am': 'Amharic',
  'ar': 'Arabic',
  'hy': 'Armenian',
  'az': 'Azerbaijani',
  'bn': 'Bengali',
  'bs': 'Bosnian',
  'bg': 'Bulgarian',
  'ca': 'Catalan',
  'zh': 'Chinese (Simplified)',
  'zh-TW': 'Chinese (Traditional)',
  'hr': 'Croatian',
  'cs': 'Czech',
  'da': 'Danish',
  'fa-AF': 'Dari',
  'nl': 'Dutch',
  'en': 'English',
  'et': 'Estonian',
  'fa': 'Farsi (Persian)',
  'tl': 'Filipino, Tagalog',
  'fi': 'Finnish',
  'fr': 'French',
  'fr-CA': 'French (Canada)',
  'ka': 'Georgian',
  'de': 'German',
  'el': 'Greek',
  'gu': 'Gujarati',
  'ht': 'Haitian Creole',
  'ha': 'Hausa',
  'he': 'Hebrew',
  'hi': 'Hindi',
  'hu': 'Hungarian',
  'is': 'Icelandic',
  'id': 'Indonesian',
  'ga': 'Irish',
  'it': 'Italian',
  'ja': 'Japanese',
  'kn': 'Kannada',
  'kk': 'Kazakh',
  'ko': 'Korean',
  'lv': 'Latvian',
  'lt': 'Lithuanian',
  'mk': 'Macedonian',
  'ms': 'Malay',
  'ml': 'Malayalam',
  'mt': 'Maltese',
  'mr': 'Marathi',
  'mn': 'Mongolian',
  'no': 'Norwegian (Bokmål)',
  'ps': 'Pashto',
  'pl': 'Polish',
  'pt': 'Portuguese (Brazil)',
  'pt-PT': 'Portuguese (Portugal)',
  'pa': 'Punjabi',
  'ro': 'Romanian',
  'ru': 'Russian',
  'sr': 'Serbian',
  'si': 'Sinhala',
  'sk': 'Slovak',
  'sl': 'Slovenian',
  'so': 'Somali',
  'es': 'Spanish',
  'es-MX': 'Spanish (Mexico)',
  'sw': 'Swahili',
  'sv': 'Swedish',
  'ta': 'Tamil',
  'te': 'Telugu',
  'th': 'Thai',
  'tr': 'Turkish',
  'uk': 'Ukrainian',
  'ur': 'Urdu',
  'uz': 'Uzbek',
  'vi': 'Vietnamese',
  'cy': 'Welsh'
};

// Common language pairs for quick selection
export const COMMON_LANGUAGE_PAIRS = [
  { source: 'en', target: 'es', label: 'English → Spanish' },
  { source: 'en', target: 'fr', label: 'English → French' },
  { source: 'en', target: 'de', label: 'English → German' },
  { source: 'en', target: 'zh', label: 'English → Chinese' },
  { source: 'en', target: 'ja', label: 'English → Japanese' },
  { source: 'en', target: 'ko', label: 'English → Korean' },
  { source: 'es', target: 'en', label: 'Spanish → English' },
  { source: 'fr', target: 'en', label: 'French → English' },
  { source: 'de', target: 'en', label: 'German → English' },
  { source: 'zh', target: 'en', label: 'Chinese → English' }
];

export default awsConfig;