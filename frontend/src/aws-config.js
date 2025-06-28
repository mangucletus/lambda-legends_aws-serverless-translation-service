// frontend/src/aws-config.js
// FIXED: AWS configuration for the React application
// This file will be automatically updated by the CI/CD pipeline

// Configuration validation function
const getConfigValue = (envVar, fallback, configName) => {
  const value = process.env[envVar] || fallback;
  if (value && !value.includes('XXXXXXXX') && !value.includes('XXXXXXXXXX')) {
    return value;
  }
  
  console.error(`❌ Invalid ${configName}: ${value}`);
  console.error(`Please check your deployment or set ${envVar} environment variable`);
  return value; // Return anyway for development, but log the error
};

// AWS configuration with proper validation
const awsConfig = {
  // AWS Region where resources are deployed
  region: getConfigValue('REACT_APP_AWS_REGION', 'us-east-1', 'AWS Region'),
  
  // Cognito User Pool ID for authentication
  userPoolId: getConfigValue('REACT_APP_USER_POOL_ID', 'us-east-1_XXXXXXXXX', 'User Pool ID'),
  
  // Cognito User Pool Client ID
  userPoolWebClientId: getConfigValue('REACT_APP_USER_POOL_CLIENT_ID', 'XXXXXXXXXXXXXXXXXXXXXXXXXX', 'User Pool Client ID'),
  
  // Cognito Identity Pool ID for AWS resource access
  identityPoolId: getConfigValue('REACT_APP_IDENTITY_POOL_ID', 'us-east-1:XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX', 'Identity Pool ID'),
  
  // API Gateway URL for translation service
  apiGatewayUrl: getConfigValue('REACT_APP_API_GATEWAY_URL', 'https://XXXXXXXXXX.execute-api.us-east-1.amazonaws.com/dev', 'API Gateway URL'),
  
  // S3 bucket for storing translation requests
  requestBucketName: getConfigValue('REACT_APP_REQUEST_BUCKET', 'aws-translate-app-requests-XXXXXXXX', 'Request Bucket'),
  
  // S3 bucket for storing translation responses
  responseBucketName: getConfigValue('REACT_APP_RESPONSE_BUCKET', 'aws-translate-app-responses-XXXXXXXX', 'Response Bucket'),
  
  // CloudFront URL for the frontend (optional)
  cloudfrontUrl: getConfigValue('REACT_APP_CLOUDFRONT_URL', 'https://XXXXXXXXXXXXXX.cloudfront.net', 'CloudFront URL')
};

// Enhanced validation function
export const validateConfig = () => {
  const requiredFields = [
    { field: 'region', value: awsConfig.region },
    { field: 'userPoolId', value: awsConfig.userPoolId },
    { field: 'userPoolWebClientId', value: awsConfig.userPoolWebClientId },
    { field: 'identityPoolId', value: awsConfig.identityPoolId },
    { field: 'apiGatewayUrl', value: awsConfig.apiGatewayUrl },
    { field: 'requestBucketName', value: awsConfig.requestBucketName },
    { field: 'responseBucketName', value: awsConfig.responseBucketName }
  ];
  
  const invalidFields = requiredFields.filter(({field, value}) => {
    return !value || value.includes('XXXXXXXX') || value.includes('XXXXXXXXXX');
  });
  
  if (invalidFields.length > 0) {
    console.warn('⚠️ AWS configuration incomplete. Invalid fields:', invalidFields.map(f => f.field));
    
    // In development, show a helpful message
    if (process.env.NODE_ENV === 'development') {
      console.log(`
🔧 DEVELOPMENT SETUP REQUIRED:

❌ Configuration Issues Found:
${invalidFields.map(f => `   - ${f.field}: ${f.value}`).join('\n')}

✅ To fix this:

1. Deploy infrastructure first:
   cd infrastructure && terraform apply

2. Get the outputs:
   terraform output -json > outputs.json

3. Set environment variables in .env file:
   REACT_APP_AWS_REGION=us-east-1
   REACT_APP_USER_POOL_ID=<your-user-pool-id>
   REACT_APP_USER_POOL_CLIENT_ID=<your-client-id>
   REACT_APP_IDENTITY_POOL_ID=<your-identity-pool-id>
   REACT_APP_API_GATEWAY_URL=<your-api-gateway-url>
   REACT_APP_REQUEST_BUCKET=<your-request-bucket>
   REACT_APP_RESPONSE_BUCKET=<your-response-bucket>

4. Or manually update this file with the real values

📝 The CI/CD pipeline will automatically populate these during deployment.
      `);
    }
    
    return false;
  }
  
  console.log('✅ AWS configuration is valid');
  return true;
};

// Configuration status logging
const configStatus = {
  region: awsConfig.region !== 'us-east-1' ? '✅ Custom region' : '⚠️ Default region',
  userPoolId: !awsConfig.userPoolId.includes('XXXXXXXX') ? '✅ Set' : '❌ Missing',
  userPoolWebClientId: !awsConfig.userPoolWebClientId.includes('XXXXXXXX') ? '✅ Set' : '❌ Missing',
  identityPoolId: !awsConfig.identityPoolId.includes('XXXXXXXX') ? '✅ Set' : '❌ Missing',
  apiGatewayUrl: !awsConfig.apiGatewayUrl.includes('XXXXXXXX') ? '✅ Set' : '❌ Missing',
  requestBucketName: !awsConfig.requestBucketName.includes('XXXXXXXX') ? '✅ Set' : '❌ Missing',
  responseBucketName: !awsConfig.responseBucketName.includes('XXXXXXXX') ? '✅ Set' : '❌ Missing'
};

if (process.env.NODE_ENV === 'development') {
  console.log('🔧 AWS Configuration Status:', configStatus);
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

// Helper function to get configuration for debugging
export const getConfigurationInfo = () => ({
  isValid: validateConfig(),
  configuration: awsConfig,
  status: configStatus,
  environment: process.env.NODE_ENV,
  timestamp: new Date().toISOString()
});

export default awsConfig;