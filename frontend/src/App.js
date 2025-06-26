// frontend/src/App.js
// Main React application component with improved authentication UI

import React, { useState, useEffect } from 'react';
import { Authenticator } from '@aws-amplify/ui-react';
import { getCurrentUser, signOut } from 'aws-amplify/auth';
import TranslationForm from './components/TranslationForm';
import awsConfig, { validateConfig, SUPPORTED_LANGUAGES } from './aws-config';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [configValid, setConfigValid] = useState(false);
  const [error, setError] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check authentication status and configuration on component mount
  useEffect(() => {
    checkConfiguration();
    checkAuthState();
  }, []);

  const checkConfiguration = () => {
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
      setIsAuthenticated(true);
    } catch (error) {
      console.log('No authenticated user found');
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      setUser(null);
      setIsAuthenticated(false);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleAuthSuccess = (authUser) => {
    setUser(authUser);
    setIsAuthenticated(true);
    setLoading(false);
  };

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

  if (!isAuthenticated) {
    return (
      <div className="auth-app-container">
        <div className="auth-background">
          <div className="auth-container">
            <div className="auth-content">
              <div className="auth-header">
                <div className="auth-logo">
                  <h1>🌍 AWS Translate</h1>
                  <p>Translate text between multiple languages using AWS services</p>
                </div>
              </div>
              
              <div className="auth-form-container">
                <Authenticator
                  socialProviders={[]}
                  variation="default"
                  hideSignUp={false}
                  components={{
                    Header() {
                      return (
                        <div className="authenticator-header">
                          <h3>🔐 Secure Authentication</h3>
                          <p>Sign in to start translating</p>
                        </div>
                      );
                    },
                    Footer() {
                      return (
                        <div className="authenticator-footer">
                          <p>Powered by AWS Cognito</p>
                        </div>
                      );
                    },
                    SignIn: {
                      Header() {
                        return (
                          <div className="sign-in-header">
                            <h3>Welcome Back</h3>
                            <p>Sign in to your account</p>
                          </div>
                        );
                      }
                    },
                    SignUp: {
                      Header() {
                        return (
                          <div className="sign-up-header">
                            <h3>Create Account</h3>
                            <p>Sign up to get started</p>
                          </div>
                        );
                      }
                    }
                  }}
                  formFields={{
                    signIn: {
                      username: {
                        placeholder: 'Enter your email address',
                        label: 'Email Address',
                        isRequired: true,
                      },
                      password: {
                        placeholder: 'Enter your password',
                        label: 'Password',
                        isRequired: true,
                      }
                    },
                    signUp: {
                      username: {
                        placeholder: 'Enter your email address',
                        label: 'Email Address',
                        isRequired: true,
                        order: 1
                      },
                      password: {
                        placeholder: 'Create a password',
                        label: 'Password',
                        isRequired: true,
                        order: 2
                      },
                      confirm_password: {
                        placeholder: 'Confirm your password',
                        label: 'Confirm Password',
                        isRequired: true,
                        order: 3
                      }
                    }
                  }}
                >
                  {({ signOut: amplifySignOut, user: authenticatedUser }) => {
                    if (authenticatedUser && !isAuthenticated) {
                      handleAuthSuccess(authenticatedUser);
                    }
                    return null;
                  }}
                </Authenticator>
              </div>

              <div className="auth-features">
                <div className="feature-list">
                  <div className="feature-item">
                    <span className="feature-icon">⚡</span>
                    <span>Fast & Accurate Translation</span>
                  </div>
                  <div className="feature-item">
                    <span className="feature-icon">🔒</span>
                    <span>Secure & Private</span>
                  </div>
                  <div className="feature-item">
                    <span className="feature-icon">🌐</span>
                    <span>75+ Languages Supported</span>
                  </div>
                  <div className="feature-item">
                    <span className="feature-icon">📱</span>
                    <span>Works on All Devices</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app authenticated-app" data-auth-state="authenticated">
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
          
          <div className="header-right">
            <div className="user-info">
              <span className="user-email">
                👤 {user?.signInDetails?.loginId || user?.userId || 'User'}
              </span>
              <button onClick={handleSignOut} className="sign-out-button">
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="app-main">
        <div className="main-content">
          {/* Welcome Section */}
          <section className="welcome-section">
            <div className="welcome-content">
              <h2>🎯 Ready to Translate</h2>
              <p>
                Upload a JSON file with text to translate, or enter text directly below. 
                Our serverless translation service supports {Object.keys(SUPPORTED_LANGUAGES || {}).length}+ languages.
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
      </footer> {/* ✅ FIXED closing tag */}
    </div>
  );
}

export default App;
