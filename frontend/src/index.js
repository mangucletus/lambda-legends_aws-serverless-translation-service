// frontend/src/index.js
// COMPATIBLE: React application entry point that works with multiple Amplify versions

import React from 'react';
import ReactDOM from 'react-dom/client';
import '@aws-amplify/ui-react/styles.css';
import './index.css';
import App from './App';
import { validateConfig, getVersionSpecificConfig, isConfigComplete, debugEnvironment } from './aws-config';

// Dynamic import handling for different Amplify versions
let Amplify;
let amplifyVersion = 'unknown';

// Try to import Amplify with version detection
const initializeAmplify = async () => {
  try {
    // Try v6 import first
    const amplifyModule = await import('aws-amplify');
    Amplify = amplifyModule.Amplify;
    amplifyVersion = '6';
    console.log('✅ Loaded AWS Amplify v6');
  } catch (error) {
    try {
      // Fallback to v5 import
      const amplifyModule = await import('aws-amplify');
      Amplify = amplifyModule.default || amplifyModule.Amplify;
      amplifyVersion = '5';
      console.log('✅ Loaded AWS Amplify v5');
    } catch (fallbackError) {
      console.error('❌ Failed to load AWS Amplify:', fallbackError);
      throw new Error('Could not load AWS Amplify. Please check your installation.');
    }
  }
};

// Enhanced error boundary with detailed error information
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null,
      isConfigError: false,
      isAmplifyError: false
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('🚨 Application error:', error, errorInfo);
    
    // Check if this is a configuration error
    const isConfigError = error.message?.includes('configuration') || 
                         error.message?.includes('AWS') ||
                         error.message?.includes('environment');
    
    // Check if this is an Amplify-related error
    const isAmplifyError = error.message?.includes('@aws-amplify') ||
                          error.message?.includes('Amplify') ||
                          error.stack?.includes('@aws-amplify');
    
    this.setState({
      error,
      errorInfo,
      isConfigError,
      isAmplifyError
    });
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
          fontFamily: 'Inter, sans-serif',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: '#2d3436'
        }}>
          <div style={{
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(20px)',
            borderRadius: '24px',
            padding: '3rem',
            boxShadow: '0 20px 25px rgba(0, 0, 0, 0.15)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            maxWidth: '700px',
            width: '100%'
          }}>
            <h1 style={{ 
              color: '#667eea', 
              marginBottom: '1rem',
              fontSize: '2rem',
              fontWeight: '800'
            }}>
              🌐 AWS Translate Application
            </h1>
            
            <h2 style={{ 
              color: '#e17055', 
              marginBottom: '1rem',
              fontSize: '1.5rem',
              fontWeight: '700'
            }}>
              {this.state.isAmplifyError ? '📦 Dependency Error' : 
               this.state.isConfigError ? '⚙️ Configuration Error' : 
               '🚨 Application Error'}
            </h2>
            
            <p style={{ 
              marginBottom: '2rem',
              fontSize: '1.1rem',
              lineHeight: '1.6',
              color: '#636e72'
            }}>
              {this.state.isAmplifyError ? 
                'There\'s an issue with AWS Amplify dependencies. This can usually be fixed by running the dependency fix script.' :
                this.state.isConfigError ? 
                'The application configuration is incomplete or invalid. Please check your environment variables.' :
                'Something went wrong. Please try refreshing the page.'
              }
            </p>

            {this.state.isAmplifyError && (
              <div style={{
                background: 'rgba(116, 185, 255, 0.1)',
                padding: '1.5rem',
                borderRadius: '12px',
                marginBottom: '2rem',
                textAlign: 'left'
              }}>
                <h3 style={{ color: '#74b9ff', marginBottom: '1rem', fontSize: '1.2rem' }}>
                  🛠️ Quick Fix:
                </h3>
                <pre style={{
                  fontSize: '0.9rem',
                  background: '#2d3436',
                  color: '#ffffff',
                  padding: '1rem',
                  borderRadius: '8px',
                  overflow: 'auto'
                }}>
{`# Run the dependency fix script:
chmod +x fix-dependencies.sh
./fix-dependencies.sh

# Or manually fix:
rm -rf node_modules package-lock.json
npm install aws-amplify@^6.3.8 @aws-amplify/ui-react@^6.1.13
npm run build`}
                </pre>
              </div>
            )}
            
            {this.state.error && (
              <details style={{
                background: 'rgba(225, 112, 85, 0.1)',
                padding: '1rem',
                borderRadius: '12px',
                marginBottom: '2rem',
                textAlign: 'left'
              }}>
                <summary style={{ 
                  cursor: 'pointer', 
                  fontWeight: '600',
                  color: '#e17055',
                  marginBottom: '0.5rem'
                }}>
                  🔍 Technical Details
                </summary>
                <pre style={{ 
                  fontSize: '0.8rem', 
                  overflow: 'auto',
                  color: '#2d3436',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word'
                }}>
                  {this.state.error.toString()}
                  {this.state.errorInfo && this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}
            
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button 
                onClick={() => window.location.reload()}
                style={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  border: 'none',
                  padding: '1rem 2rem',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '1rem',
                  transition: 'all 0.2s ease'
                }}
                onMouseOver={(e) => e.target.style.transform = 'translateY(-2px)'}
                onMouseOut={(e) => e.target.style.transform = 'translateY(0)'}
              >
                🔄 Refresh Page
              </button>
              
              {(this.state.isConfigError || this.state.isAmplifyError) && (
                <button 
                  onClick={() => {
                    debugEnvironment();
                    alert('Check the browser console for detailed diagnostic information');
                  }}
                  style={{
                    background: 'rgba(116, 185, 255, 0.2)',
                    color: '#74b9ff',
                    border: '2px solid #74b9ff',
                    padding: '1rem 2rem',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '1rem',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseOver={(e) => {
                    e.target.style.background = '#74b9ff';
                    e.target.style.color = 'white';
                  }}
                  onMouseOut={(e) => {
                    e.target.style.background = 'rgba(116, 185, 255, 0.2)';
                    e.target.style.color = '#74b9ff';
                  }}
                >
                  🔧 Debug Info
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Configuration fallback component
const ConfigurationFallback = ({ onRetry, isDependencyError = false }) => (
  <div style={{
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    padding: '2rem',
    textAlign: 'center',
    fontFamily: 'Inter, sans-serif',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
  }}>
    <div style={{
      background: 'rgba(255, 255, 255, 0.95)',
      backdropFilter: 'blur(20px)',
      borderRadius: '24px',
      padding: '3rem',
      boxShadow: '0 20px 25px rgba(0, 0, 0, 0.15)',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      maxWidth: '700px',
      width: '100%'
    }}>
      <h1 style={{ color: '#ef4444', marginBottom: '1rem', fontSize: '2rem', fontWeight: '800' }}>
        {isDependencyError ? '📦 Dependency Issue' : '⚠️ Configuration Required'}
      </h1>
      
      <p style={{ marginBottom: '2rem', fontSize: '1.1rem', lineHeight: '1.6', color: '#636e72' }}>
        {isDependencyError ? 
          'AWS Amplify dependencies need to be fixed. Run the fix script or manually install compatible versions.' :
          'AWS configuration is missing or incomplete. Please set up your environment variables and redeploy.'
        }
      </p>
      
      {isDependencyError ? (
        <div style={{
          background: 'rgba(225, 112, 85, 0.1)',
          padding: '1.5rem',
          borderRadius: '12px',
          marginBottom: '2rem',
          textAlign: 'left'
        }}>
          <h3 style={{ color: '#e17055', marginBottom: '1rem', fontSize: '1.2rem' }}>
            🛠️ Fix Commands:
          </h3>
          <pre style={{
            fontSize: '0.9rem',
            background: '#2d3436',
            color: '#ffffff',
            padding: '1rem',
            borderRadius: '8px',
            overflow: 'auto'
          }}>
{`# Option 1: Use fix script
./fix-dependencies.sh

# Option 2: Manual fix
rm -rf node_modules package-lock.json
npm install aws-amplify@^6.3.8 @aws-amplify/ui-react@^6.1.13

# Option 3: Use older stable versions
npm install aws-amplify@^5.3.12 @aws-amplify/ui-react@^5.3.2`}
          </pre>
        </div>
      ) : (
        <div style={{
          background: 'rgba(116, 185, 255, 0.1)',
          padding: '1.5rem',
          borderRadius: '12px',
          marginBottom: '2rem',
          textAlign: 'left'
        }}>
          <h3 style={{ color: '#74b9ff', marginBottom: '1rem', fontSize: '1.2rem' }}>
            📋 Required Environment Variables:
          </h3>
          <ul style={{ color: '#2d3436', fontSize: '0.9rem', lineHeight: '1.8' }}>
            <li><code>REACT_APP_USER_POOL_ID</code></li>
            <li><code>REACT_APP_USER_POOL_CLIENT_ID</code></li>
            <li><code>REACT_APP_IDENTITY_POOL_ID</code></li>
            <li><code>REACT_APP_API_GATEWAY_URL</code></li>
            <li><code>REACT_APP_REQUEST_BUCKET</code> (optional)</li>
            <li><code>REACT_APP_RESPONSE_BUCKET</code> (optional)</li>
          </ul>
        </div>
      )}
      
      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
        <button 
          onClick={onRetry}
          style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            border: 'none',
            padding: '1rem 2rem',
            borderRadius: '12px',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '1rem'
          }}
        >
          🔄 Retry
        </button>
        
        <button 
          onClick={() => {
            debugEnvironment();
            alert('Check the browser console for environment details');
          }}
          style={{
            background: 'rgba(116, 185, 255, 0.2)',
            color: '#74b9ff',
            border: '2px solid #74b9ff',
            padding: '1rem 2rem',
            borderRadius: '12px',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '1rem'
          }}
        >
          🔍 Debug Info
        </button>
      </div>
    </div>
  </div>
);

// Enhanced initialization function
const initializeApp = async () => {
  try {
    console.log('🚀 Initializing AWS Translate Application...');
    console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
    
    // Debug environment in development
    if (process.env.NODE_ENV === 'development') {
      debugEnvironment();
    }
    
    // Initialize Amplify
    await initializeAmplify();
    
    // Validate configuration
    if (!validateConfig()) {
      console.error('❌ AWS configuration validation failed');
      return { success: false, error: 'Configuration validation failed' };
    }

    // Configure Amplify with version-specific configuration
    const amplifyConfig = getVersionSpecificConfig();
    console.log(`🔧 Configuring Amplify v${amplifyVersion}...`);
    
    Amplify.configure(amplifyConfig);

    console.log('✅ Amplify configured successfully');
    return { success: true };
    
  } catch (error) {
    console.error('❌ Initialization error:', error);
    return { success: false, error: error.message, isAmplifyError: error.message?.includes('@aws-amplify') };
  }
};

// Main rendering function
const renderApp = async () => {
  const root = ReactDOM.createRoot(document.getElementById('root'));
  
  // Hide loading indicator if it exists
  const loadingIndicator = document.getElementById('loading-indicator');
  if (loadingIndicator) {
    loadingIndicator.style.display = 'none';
  }

  try {
    const initResult = await initializeApp();

    if (initResult.success && isConfigComplete()) {
      // Successful initialization
      root.render(
        <React.StrictMode>
          <ErrorBoundary>
            <App />
          </ErrorBoundary>
        </React.StrictMode>
      );
      console.log('✅ AWS Translate Application rendered successfully');
    } else {
      // Configuration or dependency error
      root.render(
        <ConfigurationFallback 
          isDependencyError={initResult.isAmplifyError}
          onRetry={() => {
            console.log('🔄 Retrying application initialization...');
            window.location.reload();
          }} 
        />
      );
      console.log('⚠️ Rendered configuration fallback');
    }
  } catch (error) {
    console.error('🚨 Critical initialization error:', error);
    
    // Check if it's an Amplify dependency error
    const isAmplifyError = error.message?.includes('@aws-amplify') || 
                          error.message?.includes('Cannot resolve module');
    
    root.render(
      <ConfigurationFallback 
        isDependencyError={isAmplifyError}
        onRetry={() => window.location.reload()} 
      />
    );
  }
};

// Initialize and render
try {
  renderApp();
} catch (error) {
  console.error('🚨 Critical rendering error:', error);
  
  // Last resort fallback
  const root = ReactDOM.createRoot(document.getElementById('root'));
  root.render(
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '2rem',
      textAlign: 'center',
      fontFamily: 'sans-serif',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    }}>
      <div style={{
        background: 'rgba(255, 255, 255, 0.95)',
        padding: '3rem',
        borderRadius: '24px',
        boxShadow: '0 20px 25px rgba(0, 0, 0, 0.15)'
      }}>
        <h1 style={{ color: '#e17055', marginBottom: '1rem' }}>
          🚨 Critical Error
        </h1>
        <p style={{ marginBottom: '2rem', color: '#636e72' }}>
          Failed to initialize the application. Please run the dependency fix script.
        </p>
        <button 
          onClick={() => window.location.reload()}
          style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            border: 'none',
            padding: '1rem 2rem',
            borderRadius: '12px',
            cursor: 'pointer',
            fontWeight: '600'
          }}
        >
          Refresh Page
        </button>
      </div>
    </div>
  );
}

console.log('🌐 AWS Translate Application initialization complete');