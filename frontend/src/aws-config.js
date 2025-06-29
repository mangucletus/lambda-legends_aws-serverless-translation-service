// frontend/src/aws-config.js
// COMPATIBLE: AWS configuration that works with multiple Amplify versions

export const awsConfig = {
  region: process.env.REACT_APP_AWS_REGION || 'us-east-1',
  userPoolId: process.env.REACT_APP_USER_POOL_ID || '',
  userPoolWebClientId: process.env.REACT_APP_USER_POOL_CLIENT_ID || '',
  identityPoolId: process.env.REACT_APP_IDENTITY_POOL_ID || '',
  apiGatewayUrl: process.env.REACT_APP_API_GATEWAY_URL || '',
  requestBucketName: process.env.REACT_APP_REQUEST_BUCKET || '',
  responseBucketName: process.env.REACT_APP_RESPONSE_BUCKET || ''
};

// Enhanced validation with detailed error messages
export const validateConfig = () => {
  console.log('🔧 Validating AWS configuration...');
  
  const requiredConfigs = [
    { key: 'userPoolId', value: awsConfig.userPoolId, description: 'Cognito User Pool ID' },
    { key: 'userPoolWebClientId', value: awsConfig.userPoolWebClientId, description: 'Cognito User Pool Client ID' },
    { key: 'identityPoolId', value: awsConfig.identityPoolId, description: 'Cognito Identity Pool ID' },
    { key: 'apiGatewayUrl', value: awsConfig.apiGatewayUrl, description: 'API Gateway URL' }
  ];

  const missing = requiredConfigs.filter(config => !config.value);
  
  if (missing.length > 0) {
    console.error('❌ Missing AWS configuration:');
    missing.forEach(config => {
      console.error(`   - ${config.description} (${config.key}): ${config.value || 'MISSING'}`);
    });
    
    console.error('\n📋 Required environment variables:');
    console.error('   - REACT_APP_USER_POOL_ID');
    console.error('   - REACT_APP_USER_POOL_CLIENT_ID');
    console.error('   - REACT_APP_IDENTITY_POOL_ID');
    console.error('   - REACT_APP_API_GATEWAY_URL');
    console.error('   - REACT_APP_REQUEST_BUCKET (optional)');
    console.error('   - REACT_APP_RESPONSE_BUCKET (optional)');
    
    return false;
  }
  
  // Validate URL format
  if (awsConfig.apiGatewayUrl && !awsConfig.apiGatewayUrl.startsWith('https://')) {
    console.error('❌ API Gateway URL must start with https://');
    return false;
  }
  
  console.log('✅ AWS Configuration validated successfully');
  console.log('📊 Configuration details:');
  console.log(`   - Region: ${awsConfig.region}`);
  console.log(`   - User Pool ID: ${awsConfig.userPoolId}`);
  console.log(`   - Identity Pool ID: ${awsConfig.identityPoolId}`);
  console.log(`   - API Gateway URL: ${awsConfig.apiGatewayUrl}`);
  console.log(`   - Request Bucket: ${awsConfig.requestBucketName || 'Not configured'}`);
  console.log(`   - Response Bucket: ${awsConfig.responseBucketName || 'Not configured'}`);
  
  return true;
};

// Get Amplify configuration object (compatible with v5 and v6)
export const getAmplifyConfig = () => {
  const config = {
    Auth: {
      // V6 format
      Cognito: {
        region: awsConfig.region,
        userPoolId: awsConfig.userPoolId,
        userPoolClientId: awsConfig.userPoolWebClientId,
        identityPoolId: awsConfig.identityPoolId,
        loginWith: {
          email: true
        },
        signUpVerificationMethod: 'code',
        userAttributes: {
          email: {
            required: true
          }
        },
        passwordFormat: {
          minLength: 8,
          requireLowercase: true,
          requireUppercase: true,
          requireNumbers: true,
          requireSpecialCharacters: false
        }
      },
      // V5 format fallback
      region: awsConfig.region,
      userPoolId: awsConfig.userPoolId,
      userPoolWebClientId: awsConfig.userPoolWebClientId,
      identityPoolId: awsConfig.identityPoolId,
      mandatorySignIn: true,
      authenticationFlowType: 'USER_SRP_AUTH'
    },
    Storage: {
      S3: {
        bucket: awsConfig.requestBucketName,
        region: awsConfig.region,
        level: 'public'
      },
      // V5 fallback
      AWSS3: {
        bucket: awsConfig.requestBucketName,
        region: awsConfig.region
      }
    },
    API: {
      REST: {
        TranslateAPI: {
          endpoint: awsConfig.apiGatewayUrl,
          region: awsConfig.region
        }
      },
      // V5 fallback
      endpoints: [
        {
          name: 'TranslateAPI',
          endpoint: awsConfig.apiGatewayUrl,
          region: awsConfig.region
        }
      ]
    }
  };

  return config;
};

// Helper function to check if configuration is complete
export const isConfigComplete = () => {
  return !!(
    awsConfig.userPoolId &&
    awsConfig.userPoolWebClientId &&
    awsConfig.identityPoolId &&
    awsConfig.apiGatewayUrl
  );
};

// Debug function to log all environment variables
export const debugEnvironment = () => {
  console.log('🔍 Environment Debug Information:');
  console.log('Available environment variables:');
  
  const envVars = Object.keys(process.env)
    .filter(key => key.startsWith('REACT_APP_'))
    .sort();
  
  if (envVars.length === 0) {
    console.log('   ⚠️ No REACT_APP_ environment variables found');
  } else {
    envVars.forEach(key => {
      const value = process.env[key];
      const maskedValue = key.includes('SECRET') || key.includes('KEY') 
        ? '***masked***' 
        : value || 'undefined';
      console.log(`   - ${key}: ${maskedValue}`);
    });
  }
  
  console.log('\nCurrent AWS Configuration:');
  Object.entries(awsConfig).forEach(([key, value]) => {
    console.log(`   - ${key}: ${value || 'undefined'}`);
  });
};

// Detect Amplify version and adjust configuration accordingly
export const getAmplifyVersion = () => {
  try {
    const amplifyPackage = require('aws-amplify/package.json');
    return amplifyPackage.version;
  } catch (error) {
    console.warn('Could not detect Amplify version:', error.message);
    return 'unknown';
  }
};

// Get version-specific configuration
export const getVersionSpecificConfig = () => {
  const version = getAmplifyVersion();
  const majorVersion = version.split('.')[0];
  
  console.log(`📦 Detected AWS Amplify version: ${version} (major: ${majorVersion})`);
  
  if (majorVersion === '5') {
    console.log('🔧 Using Amplify v5 configuration format');
    return {
      Auth: {
        region: awsConfig.region,
        userPoolId: awsConfig.userPoolId,
        userPoolWebClientId: awsConfig.userPoolWebClientId,
        identityPoolId: awsConfig.identityPoolId,
        mandatorySignIn: true,
        authenticationFlowType: 'USER_SRP_AUTH'
      },
      Storage: {
        AWSS3: {
          bucket: awsConfig.requestBucketName,
          region: awsConfig.region
        }
      },
      API: {
        endpoints: [
          {
            name: 'TranslateAPI',
            endpoint: awsConfig.apiGatewayUrl,
            region: awsConfig.region
          }
        ]
      }
    };
  } else {
    console.log('🔧 Using Amplify v6+ configuration format');
    return getAmplifyConfig();
  }
};

export default awsConfig;