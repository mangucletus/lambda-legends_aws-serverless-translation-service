// frontend/src/App.js
// Main React application component using Amplify's Authenticator wrapper

import React from 'react';
import { Authenticator } from '@aws-amplify/ui-react';
import { signOut } from 'aws-amplify/auth';
import TranslationForm from './components/TranslationForm';
import awsConfig, { validateConfig, SUPPORTED_LANGUAGES } from './aws-config';

function App() {
  const configValid = typeof validateConfig === 'function' ? validateConfig() : true;
  const configError = !configValid
    ? 'Application configuration is incomplete. Please check AWS configuration.'
    : null;

  if (!configValid) {
    return (
      <div className="app-error">
        <div className="error-container">
          <h2>⚙️ Configuration Required</h2>
          <p>{configError}</p>
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
          },
        },
        SignUp: {
          Header() {
            return (
              <div className="sign-up-header">
                <h3>Create Account</h3>
                <p>Join us and start translating</p>
              </div>
            );
          },
        },
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
          },
        },
        signUp: {
          username: {
            placeholder: 'Enter your email address',
            label: 'Email Address',
            isRequired: true,
            order: 1,
          },
          password: {
            placeholder: 'Create a password (min 8 characters)',
            label: 'Password',
            isRequired: true,
            order: 2,
          },
          confirm_password: {
            placeholder: 'Confirm your password',
            label: 'Confirm Password',
            isRequired: true,
            order: 3,
          },
        },
      }}
    >
      {({ user }) => (
        <div className="app authenticated-app" data-auth-state="authenticated">
          {/* Header */}
          <header className="app-header">
            <div className="header-content">
              <div className="header-left">
                <h1 className="app-title">🌍 AWS Translate</h1>
                <p className="app-subtitle">
                  Translate text between multiple languages using AWS services
                </p>
              </div>

              <div className="header-right">
                <div className="user-info">
                  <span className="user-email">
                    👤 {user?.signInDetails?.loginId || user?.username || 'User'}
                  </span>
                  <button onClick={signOut} className="sign-out-button">
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
                  <h2> Ready to Translate</h2>
                  <p>
                    Upload a JSON file with text to translate, or enter text directly below.
                    Our serverless translation service supports{' '}
                    {Object.keys(SUPPORTED_LANGUAGES || {}).length}+ languages.
                  </p>
                  <div className="features-highlight">
                    <div className="feature-chip">
                      <span className="feature-icon">⚡</span>
                      <span>Instant Translation</span>
                    </div>
                    <div className="feature-chip">
                      <span className="feature-icon">🔒</span>
                      <span>Secure & Private</span>
                    </div>
                    <div className="feature-chip">
                      <span className="feature-icon">☁️</span>
                      <span>Cloud Powered</span>
                    </div>
                  </div>
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
                <p>&copy; Developed by Team Lambda Legends.</p>
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
      )}
    </Authenticator>
  );
}

export default App;