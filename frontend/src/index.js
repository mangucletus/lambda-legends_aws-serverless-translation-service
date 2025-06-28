// frontend/src/index.js
// FIXED: React application entry point with Amplify v6 and enhanced error handling

import React from 'react';
import ReactDOM from 'react-dom/client';
import { Amplify } from 'aws-amplify';
import '@aws-amplify/ui-react/styles.css';
import './index.css';
import App from './App';
import awsConfig, { validateConfig } from './aws-config';

// Enhanced error boundary component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('🚨 React Error Boundary:', error, errorInfo);
    this.setState({ error: error, errorInfo: errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          padding: '2rem',
          textAlign: 'center',
          background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
          fontFamily: 'Inter, sans-serif'
        }}>
          <div style={{
            background: 'white',
            padding: '3rem',
            borderRadius: '16px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
            maxWidth: '600px',
            border: '3px solid #0073bb'
          }}>
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🌐</div>
            <h1 style={{ color: '#0073bb', marginBottom: '1rem' }}>AWS Translate</h1>
            <p style={{ color: '#6b7280', marginBottom: '2rem' }}>
              There was an error loading the application. Please refresh the page.
            </p>
            <button 
              onClick={() => window.location.reload()}
              style={{
                background: '#0073bb',
                color: 'white',
                border: 'none',
                padding: '1rem 2rem',
                borderRadius: '8px',
                fontSize: '1rem',
                fontWeight: '600',
                cursor: 'pointer',
                marginBottom: '1rem'
              }}
            >
              🔄 Refresh Page
            </button>
            {this.state.error && (
              <details style={{ marginTop: '2rem', textAlign: 'left' }}>
                <summary style={{ cursor: 'pointer', color: '#f59e0b', fontWeight: '600' }}>
                  🔍 Technical Details
                </summary>
                <div style={{
                  background: '#f3f4f6',
                  padding: '1rem',
                  borderRadius: '8px',
                  fontSize: '0.8rem',
                  marginTop: '0.5rem',
                  border: '1px solid #d1d5db'
                }}>
                  <strong>Error:</strong> {this.state.error.toString()}
                  {this.state.errorInfo && (
                    <>
                      <br /><br />
                      <strong>Component Stack:</strong>
                      <pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.7rem' }}>
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </>
                  )}
                </div>
              </details>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Configuration checker and Amplify initializer component
const ConfigurationChecker = ({ children }) => {
  const [configStatus, setConfigStatus] = React.useState('checking');
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    const initializeApp = async () => {
      try {
        console.log('🔧 Initializing AWS Translate Application...');
        
        // Validate configuration first
        const isValid = validateConfig();
        
        if (!isValid) {
          throw new Error('AWS configuration is incomplete. Please check your environment variables or deployment pipeline.');
        }

        // Configure Amplify with v6 syntax
        Amplify.configure({
          Auth: {
            Cognito: {
              region: awsConfig.region,
              userPoolId: awsConfig.userPoolId,
              userPoolClientId: awsConfig.userPoolWebClientId,
              identityPoolId: awsConfig.identityPoolId,
              loginWith: {
                email: true,
                username: false,
                phone: false
              },
              signUpVerificationMethod: 'code',
              userAttributes: {
                email: {
                  required: true
                }
              },
              allowGuestAccess: false,
              passwordFormat: {
                minLength: 8,
                requireLowercase: true,
                requireUppercase: true,
                requireNumbers: true,
                requireSpecialCharacters: false
              }
            }
          },
          Storage: {
            S3: {
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
            }
          }
        });

        console.log('✅ Amplify configured successfully');
        console.log('📍 Region:', awsConfig.region);
        console.log('🔐 User Pool:', awsConfig.userPoolId.substring(0, 20) + '...');
        console.log('🌐 API Gateway:', awsConfig.apiGatewayUrl.substring(0, 40) + '...');
        
        setConfigStatus('ready');
      } catch (err) {
        console.error('❌ Configuration error:', err);
        setError(err);
        setConfigStatus('error');
      }
    };

    initializeApp();
  }, []);

  if (configStatus === 'checking') {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)'
      }}>
        <div style={{
          background: 'white',
          padding: '3rem',
          borderRadius: '16px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
          textAlign: 'center',
          border: '2px solid #0073bb'
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '4px solid #e5e7eb',
            borderTop: '4px solid #0073bb',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 1.5rem'
          }}></div>
          <h2 style={{ color: '#0073bb', marginBottom: '0.5rem', fontSize: '1.5rem' }}>
            🔧 Initializing Application
          </h2>
          <p style={{ color: '#6b7280', margin: 0 }}>Checking AWS configuration...</p>
        </div>
      </div>
    );
  }

  if (configStatus === 'error') {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        padding: '2rem',
        background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)'
      }}>
        <div style={{
          background: 'white',
          padding: '3rem',
          borderRadius: '16px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
          maxWidth: '700px',
          textAlign: 'center',
          border: '3px solid #ef4444'
        }}>
          <h2 style={{ color: '#ef4444', marginBottom: '1rem', fontSize: '2rem' }}>
            ⚠️ Configuration Required
          </h2>
          <p style={{ color: '#6b7280', marginBottom: '2rem', fontSize: '1.1rem' }}>
            {error?.message || 'AWS configuration is incomplete or invalid'}
          </p>
          
          <div style={{
            background: '#fef3c7',
            padding: '1.5rem',
            borderRadius: '8px',
            textAlign: 'left',
            marginBottom: '2rem',
            borderLeft: '4px solid #f59e0b'
          }}>
            <h3 style={{ color: '#92400e', marginBottom: '1rem' }}>
              🛠️ For Developers (CI/CD):
            </h3>
            <ol style={{ color: '#92400e', paddingLeft: '1.5rem', margin: 0 }}>
              <li>Check that Terraform outputs are being passed to the build</li>
              <li>Verify environment variables in deployment pipeline</li>
              <li>Ensure the build process sets REACT_APP_* variables correctly</li>
              <li>Check CloudFormation/Terraform deployment logs</li>
            </ol>
          </div>

          <div style={{
            background: '#f3f4f6',
            padding: '1rem',
            borderRadius: '8px',
            textAlign: 'left',
            marginBottom: '2rem',
            fontSize: '0.9rem'
          }}>
            <h4 style={{ margin: '0 0 0.5rem 0', color: '#374151' }}>Missing Configuration:</h4>
            <ul style={{ margin: 0, paddingLeft: '1.5rem', color: '#6b7280' }}>
              {Object.entries(awsConfig).map(([key, value]) => (
                <li key={key}>
                  {key}: {value ? '✅ Set' : '❌ Missing'}
                </li>
              ))}
            </ul>
          </div>

          <button 
            onClick={() => window.location.reload()}
            style={{
              background: '#0073bb',
              color: 'white',
              border: 'none',
              padding: '1rem 2rem',
              borderRadius: '8px',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            🔄 Retry
          </button>
        </div>
      </div>
    );
  }

  return children;
};

// Add CSS animations and prevent duplicate style injection
if (!document.getElementById('aws-translate-styles')) {
  const style = document.createElement('style');
  style.id = 'aws-translate-styles';
  style.textContent = `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    
    /* Ensure critical translation display styles */
    .translation-output-section {
      display: block !important;
      visibility: visible !important;
      opacity: 1 !important;
    }
    
    .translated-texts-container {
      display: flex !important;
      flex-direction: column !important;
      visibility: visible !important;
      opacity: 1 !important;
    }
  `;
  document.head.appendChild(style);
}

// Create root and render the application
const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <ConfigurationChecker>
        <App />
      </ConfigurationChecker>
    </ErrorBoundary>
  </React.StrictMode>
);

// Performance monitoring for development
if (process.env.NODE_ENV === 'development') {
  const reportWebVitals = (metric) => {
    console.log('📊 Web Vital:', metric.name, metric.value);
    
    // Log performance warnings
    if (metric.name === 'FCP' && metric.value > 3000) {
      console.warn('⚠️ Slow First Contentful Paint detected');
    }
    if (metric.name === 'CLS' && metric.value > 0.1) {
      console.warn('⚠️ High Cumulative Layout Shift detected');
    }
  };

  // Dynamic import for web-vitals
  import('web-vitals').then(({ getCLS, getFID, getFCP, getLCP, getTTFB }) => {
    getCLS(reportWebVitals);
    getFID(reportWebVitals);
    getFCP(reportWebVitals);
    getLCP(reportWebVitals);
    getTTFB(reportWebVitals);
  }).catch(() => {
    console.log('📊 Web vitals not available');
  });
}

// Global error handlers for better debugging
window.addEventListener('error', (event) => {
  console.error('🚨 Global error:', event.error);
  
  // Handle specific bundle loading errors
  if (event.error && event.error.message) {
    const errorMessage = event.error.message.toLowerCase();
    
    if (errorMessage.includes('unexpected token') && errorMessage.includes('<')) {
      console.error('🚨 Bundle loading error detected - likely configuration issue');
      console.error('🔧 Check environment variables and build process');
    }
  }
});

window.addEventListener('unhandledrejection', (event) => {
  console.warn('🔧 Unhandled promise rejection:', event.reason);
  
  // Don't break the app for certain promise rejections
  if (event.reason && typeof event.reason === 'string') {
    if (event.reason.includes('ServiceWorker') || 
        event.reason.includes('manifest') || 
        event.reason.includes('icon')) {
      event.preventDefault();
      return false;
    }
  }
});

console.log('🚀 AWS Translate Application initialized');
console.log('🏗️ Environment:', process.env.NODE_ENV);
console.log('⚛️ React Version:', React.version);