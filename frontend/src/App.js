// frontend/src/App.js
// Main React application component

import React, { useState, useEffect } from 'react';
import { Authenticator } from '@aws-amplify/ui-react';
import { getCurrentUser, signOut } from 'aws-amplify/auth';
import AuthComponent from './components/AuthComponent';
import TranslationForm from './components/TranslationForm';
import awsConfig, { validateConfig } from './aws-config';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [configValid, setConfigValid] = useState(false);
  const [error, setError] = useState(null);

  // Check authentication status and configuration on component mount
  useEffect(() => {
    checkAuthState();
    checkConfiguration();
  }, []);

  const checkConfiguration = () => {
    // Check if validateConfig function exists, otherwise assume valid for deployed version
    const isValid = typeof validateConfig === 'function' ? validateConfig() : true;
    setConfigValid(isValid);
    
    if (!isValid) {
      setError('Application configuration is incomplete. Please check AWS configuration.');
    }
  };

  const checkAuthState = async () => {
    try {
      setLoading(true);
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    } catch (error) {
      console.log('No authenticated user found');
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      setUser(null);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="app-loading">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading AWS Translate Application...</p>
        </div>
      </div>
    );
  }

  // Configuration error state
  if (!configValid) {
    return (
      <div className="app-error">
        <div className="error-container">
          <h2>⚙️ Configuration Required</h2>
          <p>{error}</p>
          <div className="config-help">
            <h3>For Developers:</h3>
            <ol>
              <li>Deploy the infrastructure using Terraform</li>
              <li>Update the AWS configuration in <code>aws-config.js</code></li>
              <li>Or set the required environment variables</li>
            </ol>
          </div>
          <button onClick={() => window.location.reload()} className="retry-button">
            🔄 Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app" data-auth-state={user ? "authenticated" : "unauthenticated"}>
      {/* Header */}
      <header className="app-header">
        <div className="header-content">
          <div className="header-left">
            <h1 className="app-title">
              🌍 AWS Translate
            </h1>
            <p className="app-subtitle">
              Translate text between multiple languages using AWS services
            </p>
          </div>
          
          {user && (
            <div className="header-right">
              <div className="user-info">
                <span className="user-email">
                  👤 {user.signInDetails?.loginId || user.userId}
                </span>
                <button onClick={handleSignOut} className="sign-out-button">
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="app-main">
        {!user ? (
          // Authentication flow
          <div className="auth-container">
            <div className="auth-content">
              <div className="auth-header">
                <h2>Welcome to AWS Translate</h2>
                <p>Sign in to start translating text between multiple languages</p>
              </div>
              
              <Authenticator
                socialProviders={[]}
                variation="modal"
                components={{
                  Header() {
                    return (
                      <div className="auth-logo">
                        <h3>🔐 Secure Authentication</h3>
                      </div>
                    );
                  },
                  Footer() {
                    return (
                      <div className="auth-footer">
                        <p>Powered by AWS Cognito</p>
                      </div>
                    );
                  }
                }}
              >
                {({ signOut, user: authenticatedUser }) => {
                  // Update user state when authenticated
                  if (authenticatedUser && !user) {
                    setUser(authenticatedUser);
                  }
                  
                  return (
                    <div className="authenticated-content">
                      <p>Authentication successful! Redirecting...</p>
                    </div>
                  );
                }}
              </Authenticator>
            </div>
          </div>
        ) : (
          // Main application content
          <div className="main-content">
            {/* Welcome Section */}
            <section className="welcome-section">
              <div className="welcome-content">
                <h2>🎯 Ready to Translate</h2>
                <p>
                  Upload a JSON file with text to translate, or enter text directly below. 
                  Our serverless translation service supports {Object.keys(awsConfig.SUPPORTED_LANGUAGES || {}).length}+ languages.
                </p>
              </div>
            </section>

            {/* Translation Interface */}
            <section className="translation-section">
              <TranslationForm user={user} />
            </section>

            {/* Features Section */}
            <section className="features-section">
              <div className="features-grid">
                <div className="feature-card">
                  <div className="feature-icon">⚡</div>
                  <h3>Fast Translation</h3>
                  <p>Powered by AWS Translate for quick and accurate results</p>
                </div>
                
                <div className="feature-card">
                  <div className="feature-icon">🔒</div>
                  <h3>Secure</h3>
                  <p>Your data is protected with AWS security best practices</p>
                </div>
                
                <div className="feature-card">
                  <div className="feature-icon">🌐</div>
                  <h3>Multi-Language</h3>
                  <p>Support for 75+ languages and language variants</p>
                </div>
                
                <div className="feature-card">
                  <div className="feature-icon">📱</div>
                  <h3>Responsive</h3>
                  <p>Works seamlessly on desktop, tablet, and mobile devices</p>
                </div>
              </div>
            </section>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="app-footer">
        <div className="footer-content">
          <div className="footer-left">
            <p>&copy; 2024 AWS Translate Application. Built with ❤️ using AWS services.</p>
          </div>
          
          <div className="footer-right">
            <div className="footer-links">
              <a 
                href="https://aws.amazon.com/translate/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="footer-link"
              >
                AWS Translate
              </a>
              <a 
                href="https://docs.aws.amazon.com/translate/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="footer-link"
              >
                Documentation
              </a>
              <a 
                href="https://github.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="footer-link"
              >
                GitHub
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;