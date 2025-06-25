// frontend/src/index.js
// React application entry point

import React from 'react';
import ReactDOM from 'react-dom/client';
import { Amplify } from 'aws-amplify';
import '@aws-amplify/ui-react/styles.css';
import './index.css';
import App from './App';
import awsConfig from './aws-config';

// Configure Amplify with AWS settings
Amplify.configure({
  Auth: {
    Cognito: {
      region: awsConfig.region,
      userPoolId: awsConfig.userPoolId,
      userPoolClientId: awsConfig.userPoolWebClientId,
      identityPoolId: awsConfig.identityPoolId,
      loginWith: {
        email: true,
      },
    }
  },
  Storage: {
    S3: {
      bucket: awsConfig.requestBucketName,
      region: awsConfig.region,
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

// Create root element and render the application
const root = ReactDOM.createRoot(document.getElementById('root'));

// Error boundary component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log the error to console (you could also send to a logging service)
    console.error('Application error caught by boundary:', error, errorInfo);
    
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <div className="error-container">
            <h2>🚫 Application Error</h2>
            <p>Something went wrong while loading the application.</p>
            <details className="error-details">
              <summary>Error Details (Click to expand)</summary>
              <pre className="error-stack">
                {this.state.error && this.state.error.toString()}
                <br />
                {this.state.errorInfo.componentStack}
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

// Performance monitoring (optional)
function reportWebVitals(metric) {
  // Log performance metrics to console
  console.log('Web Vital:', metric);
  
  // You could send these metrics to an analytics service
  // Example: analytics.send(metric);
}

// Render the application with error boundary
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);

// Report web vitals for performance monitoring
// Uncomment the line below if you want to start measuring performance
// reportWebVitals(console.log);

// Register service worker for PWA capabilities (optional)
if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then((registration) => {
        console.log('SW registered: ', registration);
      })
      .catch((registrationError) => {
        console.log('SW registration failed: ', registrationError);
      });
  });
}