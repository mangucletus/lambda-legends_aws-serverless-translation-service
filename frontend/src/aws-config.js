// aws-config.js - Fixed AWS configuration with proper validation
export const awsConfig = {
  region: process.env.REACT_APP_AWS_REGION || 'us-east-1',
  userPoolId: process.env.REACT_APP_USER_POOL_ID || '',
  userPoolWebClientId: process.env.REACT_APP_USER_POOL_CLIENT_ID || '',
  identityPoolId: process.env.REACT_APP_IDENTITY_POOL_ID || '',
  apiGatewayUrl: process.env.REACT_APP_API_GATEWAY_URL || '',
  requestBucketName: process.env.REACT_APP_REQUEST_BUCKET || '',
  responseBucketName: process.env.REACT_APP_RESPONSE_BUCKET || ''
};

export const validateConfig = () => {
  const requiredConfigs = [
    'region', 'userPoolId', 'userPoolWebClientId', 
    'identityPoolId', 'apiGatewayUrl', 'requestBucketName', 'responseBucketName'
  ];

  const missing = requiredConfigs.filter(key => !awsConfig[key] || awsConfig[key].includes('XXXXXXXX'));
  
  if (missing.length > 0) {
    console.error('❌ Missing AWS configuration:', missing);
    console.error('Current config:', Object.keys(awsConfig).reduce((obj, key) => {
      obj[key] = awsConfig[key] ? `${awsConfig[key].substring(0, 10)}...` : 'MISSING';
      return obj;
    }, {}));
    return false;
  }
  
  console.log('✅ AWS Configuration validated successfully');
  return true;
};

export const SUPPORTED_LANGUAGES = {
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
  'mn': 'Mongolian', 'no': 'Norwegian', 'ps': 'Pashto', 'pl': 'Polish',
  'pt': 'Portuguese', 'pt-PT': 'Portuguese (Portugal)', 'pa': 'Punjabi',
  'ro': 'Romanian', 'ru': 'Russian', 'sr': 'Serbian', 'si': 'Sinhala',
  'sk': 'Slovak', 'sl': 'Slovenian', 'so': 'Somali', 'es': 'Spanish',
  'es-MX': 'Spanish (Mexico)', 'sw': 'Swahili', 'sv': 'Swedish',
  'ta': 'Tamil', 'te': 'Telugu', 'th': 'Thai', 'tr': 'Turkish',
  'uk': 'Ukrainian', 'ur': 'Urdu', 'uz': 'Uzbek', 'vi': 'Vietnamese', 'cy': 'Welsh'
};

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