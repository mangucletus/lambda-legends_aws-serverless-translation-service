// frontend/src/index.js
// SIMPLIFIED: Clean React application entry point

import React from 'react';
import ReactDOM from 'react-dom/client';
import { Amplify } from 'aws-amplify';
import '@aws-amplify/ui-react/styles.css';
import './index.css';
import App from './App';
import awsConfig, { validateConfig } from './aws-config';

// Simple error boundary
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Application error:', error, errorInfo);
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
          fontFamily: 'sans-serif'
        }}>
          <h1 style={{ color: '#0073bb', marginBottom: '1rem' }}>🌐 AWS Translate</h1>
          <p style={{ marginBottom: '2rem' }}>
            Something went wrong. Please refresh the page.
          </p>
          <button 
            onClick={() => window.location.reload()}
            style={{
              background: '#0073bb',
              color: 'white',
              border: 'none',
              padding: '1rem 2rem',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Refresh Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Configuration and initialization
const initializeApp = () => {
  try {
    console.log('Initializing AWS Translate Application...');
    
    // Validate configuration
    if (!validateConfig()) {
      throw new Error('AWS configuration is incomplete');
    }

    // Configure Amplify
    Amplify.configure({
      Auth: {
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

    console.log('Amplify configured successfully');
    return true;
  } catch (error) {
    console.error('Initialization error:', error);
    return false;
  }
};

// Initialize and render app
const root = ReactDOM.createRoot(document.getElementById('root'));

if (initializeApp()) {
  root.render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  );
} else {
  // Show configuration error
  root.render(
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '2rem',
      textAlign: 'center',
      fontFamily: 'sans-serif'
    }}>
      <h1 style={{ color: '#ef4444', marginBottom: '1rem' }}>⚠️ Configuration Error</h1>
      <p style={{ marginBottom: '2rem' }}>
        AWS configuration is missing or incomplete. Please check your environment variables.
      </p>
      <button 
        onClick={() => window.location.reload()}
        style={{
          background: '#0073bb',
          color: 'white',
          border: 'none',
          padding: '1rem 2rem',
          borderRadius: '4px',
          cursor: 'pointer'
        }}
      >
        Retry
      </button>
    </div>
  );
}

console.log('AWS Translate Application loaded');