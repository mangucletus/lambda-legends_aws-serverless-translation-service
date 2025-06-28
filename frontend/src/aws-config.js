export const awsConfig = {
  region: process.env.REACT_APP_AWS_REGION || 'us-east-1',
  userPoolId: process.env.REACT_APP_USER_POOL_ID || 'XXXXXXXX',
  userPoolWebClientId: process.env.REACT_APP_USER_POOL_CLIENT_ID || 'XXXXXXXX',
  identityPoolId: process.env.REACT_APP_IDENTITY_POOL_ID || 'XXXXXXXX',
  apiGatewayUrl: process.env.REACT_APP_API_GATEWAY_URL || 'XXXXXXXX',
  requestBucketName: process.env.REACT_APP_REQUEST_BUCKET || 'XXXXXXXX',
  responseBucketName: process.env.REACT_APP_RESPONSE_BUCKET || 'XXXXXXXX',
  cloudfrontUrl: process.env.REACT_APP_CLOUDFRONT_URL || 'XXXXXXXX',
  // Explicitly disable OAuth
  oauth: null
};

export const validateConfig = () => {
  const requiredConfigs = [
    'region',
    'userPoolId',
    'userPoolWebClientId',
    'identityPoolId',
    'apiGatewayUrl',
    'requestBucketName',
    'responseBucketName',
    'cloudfrontUrl'
  ];

  for (const key of requiredConfigs) {
    if (awsConfig[key] === 'XXXXXXXX' || !awsConfig[key]) {
      console.error(`Configuration error: ${key} is missing or invalid`);
      return false;
    }
  }
  return true;
};

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
  'no': 'Norwegian',
  'ps': 'Pashto',
  'fa': 'Persian',
  'pl': 'Polish',
  'pt': 'Portuguese',
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
  'tl': 'Tagalog',
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

export const COMMON_LANGUAGE_PAIRS = [
  { source: 'en', target: 'es', label: 'English to Spanish' },
  { source: 'en', target: 'fr', label: 'English to French' },
  { source: 'en', target: 'de', label: 'English to German' },
  { source: 'en', target: 'zh', label: 'English to Chinese (Simplified)' },
  { source: 'es', target: 'en', label: 'Spanish to English' },
  { source: 'fr', target: 'en', label: 'French to English' },
  { source: 'de', target: 'en', label: 'German to English' },
  { source: 'zh', target: 'en', label: 'Chinese (Simplified) to English' }
];

export default awsConfig;