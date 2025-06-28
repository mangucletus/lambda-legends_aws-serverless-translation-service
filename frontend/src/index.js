// frontend/src/index.js
// FIXED: React application entry point with enhanced Amplify configuration and error handling

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
    console.error('🚨 Application error caught by boundary:', error, errorInfo);
    this.setState({ error: error, errorInfo: errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <div className="error-container">
            <h2>⚠️ Application Error</h2>
            <p>Something went wrong while loading the application.</p>
            
            {this.state.error?.message?.includes('region') && (
              <div className="config-error-help">
                <h3>🔧 Configuration Issue Detected</h3>
                <p>This appears to be an AWS configuration problem.</p>
                <ol>
                  <li>Deploy the infrastructure: <code>cd infrastructure &amp;&amp; terraform apply</code></li>
                  <li>Get outputs: <code>terraform output -json</code></li>
                  <li>Update environment variables or aws-config.js</li>
                  <li>Restart the application</li>
                </ol>
              </div>
            )}

            <details className="error-details">
              <summary>🔍 Error Details (Click to expand)</summary>
              <pre className="error-stack">
                {this.state.error && this.state.error.toString()}
                <br />
                {this.state.errorInfo && this.state.errorInfo.componentStack}
              </pre>
            </details>

            <button
              className="retry-button"
              onClick={() => window.location.reload()}
            >
              🔄 Reload Application
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Configuration validation with user-friendly error handling
const initializeAmplify = () => {
  try {
    console.log('🚀 Initializing AWS Amplify...');
    
    // Validate configuration first
    const isConfigValid = validateConfig();
    
    if (!isConfigValid && process.env.NODE_ENV === 'production') {
      throw new Error(
        'AWS configuration is incomplete. Please check your deployment pipeline or environment variables.'
      );
    }

    // FIXED: Enhanced Amplify configuration for proper authentication
    const amplifyConfig = {
      Auth: {
        Cognito: {
          region: awsConfig.region,
          userPoolId: awsConfig.userPoolId,
          userPoolClientId: awsConfig.userPoolWebClientId,
          identityPoolId: awsConfig.identityPoolId,
          loginWith: {
            email: true,
            username: false, // Disable username login
            phone: false,    // Disable phone login
          },
          signUpVerificationMethod: 'code', // Email verification
          userAttributes: {
            email: {
              required: true,
            },
          },
        }
      },
      Storage: {
        S3: {
          bucket: awsConfig.requestBucketName,
          region: awsConfig.region,
          // Remove any path prefix - let the component handle paths
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
    };

    Amplify.configure(amplifyConfig);
    
    console.log('✅ AWS Amplify configured successfully');
    console.log('📍 Region:', awsConfig.region);
    console.log('🔐 User Pool ID:', awsConfig.userPoolId.substring(0, 20) + '...');
    console.log('🌐 API Gateway:', awsConfig.apiGatewayUrl.substring(0, 40) + '...');
    
    return true;
  } catch (error) {
    console.error('❌ Failed to initialize Amplify:', error);
    
    // In development, continue anyway for debugging
    if (process.env.NODE_ENV === 'development') {
      console.warn('⚠️ Continuing in development mode with incomplete configuration');
      try {
        // Try to configure with whatever we have
        Amplify.configure({
          Auth: {
            Cognito: {
              region: awsConfig.region || 'us-east-1',
              userPoolId: awsConfig.userPoolId,
              userPoolClientId: awsConfig.userPoolWebClientId,
              identityPoolId: awsConfig.identityPoolId,
              loginWith: { email: true },
            }
          }
        });
        return true;
      } catch (devError) {
        console.error('❌ Failed to configure even in development mode:', devError);
        return false;
      }
    }
    
    throw error;
  }
};

// Configuration check component
const ConfigurationChecker = ({ children }) => {
  const [configStatus, setConfigStatus] = React.useState('checking');
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    try {
      const success = initializeAmplify();
      setConfigStatus(success ? 'ready' : 'error');
    } catch (err) {
      setError(err);
      setConfigStatus('error');
    }
  }, []);

  if (configStatus === 'checking') {
    return (
      <div className="app-loading">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <h2>🔧 Initializing Application</h2>
          <p>Checking AWS configuration...</p>
        </div>
      </div>
    );
  }

  if (configStatus === 'error') {
    return (
      <div className="app-error">
        <div className="error-container">
          <h2>⚠️ Configuration Required</h2>
          <p>{error?.message || 'Application configuration is incomplete.'}</p>
          
          <div className="config-help">
            <h3>🛠️ For Developers:</h3>
            <ol>
              <li>
                <strong>Deploy Infrastructure:</strong>
                <pre><code>cd infrastructure &amp;&amp; terraform apply</code></pre>
              </li>
              <li>
                <strong>Get Terraform Outputs:</strong>
                <pre><code>terraform output -json &gt; outputs.json</code></pre>
              </li>
              <li>
                <strong>Update Configuration:</strong>
                <ul>
                  <li>Set environment variables in <code>.env</code> file</li>
                  <li>Or manually update <code>src/aws-config.js</code></li>
                </ul>
              </li>
              <li>
                <strong>Restart Application:</strong>
                <pre><code>npm start</code></pre>
              </li>
            </ol>
          </div>

          <div className="config-status">
            <h4>📋 Current Configuration Status:</h4>
            <ul>
              <li>User Pool ID: {awsConfig.userPoolId.includes('XXXXXXXX') ? '❌ Missing' : '✅ Set'}</li>
              <li>Client ID: {awsConfig.userPoolWebClientId.includes('XXXXXXXX') ? '❌ Missing' : '✅ Set'}</li>
              <li>Identity Pool: {awsConfig.identityPoolId.includes('XXXXXXXX') ? '❌ Missing' : '✅ Set'}</li>
              <li>API Gateway: {awsConfig.apiGatewayUrl.includes('XXXXXXXX') ? '❌ Missing' : '✅ Set'}</li>
            </ul>
          </div>

          <button onClick={() => window.location.reload()} className="retry-button">
            🔄 Retry
          </button>
        </div>
      </div>
    );
  }

  return children;
};

// Performance monitoring function
function reportWebVitals(metric) {
  console.log('📊 Web Vital:', metric.name, metric.value);
  
  // Log performance warnings
  if (metric.name === 'FCP' && metric.value > 3000) {
    console.warn('⚠️ Slow First Contentful Paint detected');
  }
  if (metric.name === 'CLS' && metric.value > 0.1) {
    console.warn('⚠️ High Cumulative Layout Shift detected');
  }
}

// Create root element and render the application
const root = ReactDOM.createRoot(document.getElementById('root'));

// Render the application with enhanced error boundaries and configuration checking
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <ConfigurationChecker>
        <App />
      </ConfigurationChecker>
    </ErrorBoundary>
  </React.StrictMode>
);

// Report web vitals for performance monitoring
if (process.env.NODE_ENV === 'development') {
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

// Service worker registration (disabled for now to avoid errors)
if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then((registration) => {
        console.log('✅ SW registered: ', registration);
      })
      .catch((registrationError) => {
        console.log('ℹ️ SW registration skipped: ', registrationError.message);
      });
  });
}

// Global error handler for unhandled promise rejections
window.addEventListener('unhandledrejection', event => {
  console.error('🚨 Unhandled promise rejection:', event.reason);
  
  // Don't break the app for certain types of errors
  if (event.reason && typeof event.reason === 'string') {
    if (event.reason.includes('ServiceWorker') || 
        event.reason.includes('manifest') || 
        event.reason.includes('icon')) {
      event.preventDefault();
      return;
    }
  }
});

console.log('🚀 AWS Translate Application initialized');
console.log('Environment:', process.env.NODE_ENV);
console.log('React Version:', React.version);