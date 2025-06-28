// frontend/src/aws-config.js
// SIMPLIFIED: Basic AWS configuration

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
    'userPoolId', 
    'userPoolWebClientId', 
    'identityPoolId', 
    'apiGatewayUrl'
  ];

  const missing = requiredConfigs.filter(key => !awsConfig[key]);
  
  if (missing.length > 0) {
    console.error('Missing AWS configuration:', missing);
    return false;
  }
  
  console.log('AWS Configuration validated successfully');
  return true;
};

export default awsConfig;