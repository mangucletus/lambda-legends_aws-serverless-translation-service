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
          <h2>Configuration Required</h2>
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
            Retry
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
              <p>Sign in to start translating text securely</p>
            </div>
          );
        },
        Footer() {
          return (
            <div className="authenticator-footer">
              <p>🔒 Powered by AWS Cognito - Your data is secure</p>
            </div>
          );
        },
        SignIn: {
          Header() {
            return (
              <div className="sign-in-header">
                <h3>👋 Welcome Back</h3>
                <p>Sign in to your translation account</p>
              </div>
            );
          },
        },
        SignUp: {
          Header() {
            return (
              <div className="sign-up-header">
                <h3>🚀 Create Account</h3>
                <p>Join us and start translating instantly</p>
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
          email: {
            placeholder: 'Enter your email address',
            label: 'Email Address',
            isRequired: true,
            order: 1,
          },
          password: {
            placeholder: 'Create a strong password (min 8 characters)',
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
        confirmSignUp: {
          confirmation_code: {
            placeholder: 'Enter the confirmation code sent to your email',
            label: 'Confirmation Code',
            isRequired: true,
          },
        },
        forceNewPassword: {
          password: {
            placeholder: 'Enter your new password',
            label: 'New Password',
            isRequired: true,
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
                <h1 className="app-title">🌐 AWS Translate</h1>
                <p className="app-subtitle">
                  Professional translation service powered by AWS
                </p>
              </div>

              <div className="header-right">
                <div className="user-info">
                  <div className="user-details">
                    <span className="user-greeting">👋 Hello</span>
                    <span className="user-email">
                      {user?.signInDetails?.loginId || user?.username || 'User'}
                    </span>
                  </div>
                  <button onClick={signOut} className="sign-out-button">
                    🚪 Sign Out
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
                    Transform your text into {Object.keys(SUPPORTED_LANGUAGES || {}).length}+ languages 
                    instantly. Enter text directly or upload a JSON file to get started.
                    Our AI-powered translation service delivers accurate results in seconds.
                  </p>
                  <div className="features-highlight">
                    <div className="feature-chip">
                      <span>⚡ Instant Results</span>
                    </div>
                    <div className="feature-chip">
                      <span>🔒 Secure & Private</span>
                    </div>
                    <div className="feature-chip">
                      <span>☁️ Cloud Powered</span>
                    </div>
                    <div className="feature-chip">
                      <span>🌍 75+ Languages</span>
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
                    <h3>Lightning Fast</h3>
                    <p>Powered by AWS Translate for instant, high-quality results</p>
                  </div>

                  <div className="feature-card">
                    <div className="feature-icon">🔒</div>
                    <h3>Enterprise Security</h3>
                    <p>Your data is protected with AWS enterprise-grade security</p>
                  </div>

                  <div className="feature-card">
                    <div className="feature-icon">🌐</div>
                    <h3>Global Reach</h3>
                    <p>Support for 75+ languages and regional variants worldwide</p>
                  </div>

                  <div className="feature-card">
                    <div className="feature-icon">📱</div>
                    <h3>Universal Access</h3>
                    <p>Works seamlessly on desktop, tablet, and mobile devices</p>
                  </div>

                  <div className="feature-card">
                    <div className="feature-icon">🚀</div>
                    <h3>Serverless Scale</h3>
                    <p>Automatically scales to handle any volume of translations</p>
                  </div>

                  <div className="feature-card">
                    <div className="feature-icon">💾</div>
                    <h3>Smart Storage</h3>
                    <p>Automatic backup and retrieval of translation history</p>
                  </div>
                </div>
              </section>
            </div>
          </main>

          {/* Footer */}
          <footer className="app-footer">
            <div className="footer-content">
              <div className="footer-left">
                <p>© 2024 Team Lambda Legends. Professional Translation Solutions.</p>
                <p>Built with React, AWS Lambda, Amazon Translate & S3</p>
              </div>

              <div className="footer-right">
                <div className="footer-links">
                  <a
                    href="https://aws.amazon.com/translate/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="footer-link"
                  >
                    🔗 AWS Translate
                  </a>
                  <a
                    href="https://docs.aws.amazon.com/translate/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="footer-link"
                  >
                    📚 Documentation
                  </a>
                  <a
                    href="https://github.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="footer-link"
                  >
                    💻 GitHub
                  </a>
                  <a
                    href="mailto:support@translate.app"
                    className="footer-link"
                  >
                    📧 Support
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