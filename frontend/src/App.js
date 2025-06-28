import React from 'react';
import { Amplify } from 'aws-amplify';
import { Authenticator } from '@aws-amplify/ui-react';
import { signOut } from 'aws-amplify/auth';
import TranslationForm from './components/TranslationForm';
import awsConfig, { validateConfig, SUPPORTED_LANGUAGES } from './aws-config';

// Initialize Amplify with configuration
try {
  Amplify.configure({
    Auth: {
      region: awsConfig.region,
      userPoolId: awsConfig.userPoolId,
      userPoolWebClientId: awsConfig.userPoolWebClientId,
      identityPoolId: awsConfig.identityPoolId,
      mandatorySignIn: true,
      authenticationFlowType: 'USER_SRP_AUTH',
      // Explicitly disable OAuth
      oauth: null
    },
    API: {
      endpoints: [
        {
          name: 'translateApi',
          endpoint: awsConfig.apiGatewayUrl,
          region: awsConfig.region,
        },
      ],
    },
    Storage: {
      AWSS3: {
        bucket: awsConfig.requestBucketName,
        region: awsConfig.region,
      },
    },
  });
  console.log('Amplify configured successfully');
} catch (error) {
  console.error('Amplify configuration failed:', error);
}

function App() {
  const configValid = typeof validateConfig === 'function' ? validateConfig() : true;
  const configError = !configValid
    ? 'Application configuration is incomplete. Please check AWS configuration.'
    : null;

  // Show configuration error if needed
  if (!configValid) {
    return (
      <div className="app-error">
        <div className="error-container">
          <h2>⚠️ Configuration Required</h2>
          <p>{configError}</p>
          
          <div className="config-help">
            <h3>🛠️ For Developers:</h3>
            <ol>
              <li>Deploy the infrastructure using Terraform</li>
              <li>Update the AWS configuration in <code>aws-config.js</code></li>
              <li>Or set the required environment variables</li>
            </ol>
            
            <h4>📋 Required Environment Variables:</h4>
            <pre>{`REACT_APP_AWS_REGION=us-east-1
REACT_APP_USER_POOL_ID=your-user-pool-id
REACT_APP_USER_POOL_CLIENT_ID=your-client-id
REACT_APP_IDENTITY_POOL_ID=your-identity-pool-id
REACT_APP_API_GATEWAY_URL=your-api-gateway-url
REACT_APP_REQUEST_BUCKET=your-request-bucket
REACT_APP_RESPONSE_BUCKET=your-response-bucket`}</pre>
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
      formFields={{
        signIn: {
          username: {
            placeholder: 'Enter your email address',
            label: 'Email Address',
            isRequired: true,
            autocomplete: 'email'
          },
          password: {
            placeholder: 'Enter your password',
            label: 'Password',
            isRequired: true,
            autocomplete: 'current-password'
          },
        },
        signUp: {
          email: {
            placeholder: 'Enter your email address',
            label: 'Email Address',
            isRequired: true,
            order: 1,
            autocomplete: 'email'
          },
          password: {
            placeholder: 'Create a strong password (min 8 characters)',
            label: 'Password',
            isRequired: true,
            order: 2,
            autocomplete: 'new-password'
          },
          confirm_password: {
            placeholder: 'Confirm your password',
            label: 'Confirm Password',
            isRequired: true,
            order: 3,
            autocomplete: 'new-password'
          },
        },
        confirmSignUp: {
          confirmation_code: {
            placeholder: 'Enter the 6-digit code sent to your email',
            label: 'Verification Code',
            isRequired: true,
            autocomplete: 'one-time-code'
          },
        },
        forceNewPassword: {
          password: {
            placeholder: 'Enter your new password',
            label: 'New Password',
            isRequired: true,
            autocomplete: 'new-password'
          },
        },
        resetPassword: {
          username: {
            placeholder: 'Enter your email address',
            label: 'Email Address',
            isRequired: true,
            autocomplete: 'email'
          },
        },
        confirmResetPassword: {
          confirmation_code: {
            placeholder: 'Enter the code sent to your email',
            label: 'Verification Code',
            isRequired: true,
            autocomplete: 'one-time-code'
          },
          confirm_password: {
            placeholder: 'Enter your new password',
            label: 'New Password',
            isRequired: true,
            autocomplete: 'new-password'
          },
        },
      }}
      components={{
        Header() {
          return (
            <div className="authenticator-header">
              <div className="auth-logo">
                <h1>🌐 AWS Translate</h1>
                <p>Professional translation service powered by AWS</p>
              </div>
            </div>
          );
        },
        Footer() {
          return (
            <div className="authenticator-footer">
              <p>🔒 Secured by AWS Cognito - Your data is protected</p>
              <p>✨ Start translating in 75+ languages instantly</p>
            </div>
          );
        },
        SignIn: {
          Header() {
            return (
              <div className="sign-in-header">
                <h3>👋 Welcome Back</h3>
                <p>Sign in to your translation account</p>
                <div className="auth-features">
                  <span>⚡ Instant Translation</span>
                  <span>🔒 Secure Access</span>
                  <span>☁️ Cloud Storage</span>
                </div>
              </div>
            );
          },
          Footer() {
            return (
              <div className="auth-help">
                <p>💡 New to our platform? Create an account to get started</p>
                <p>🔑 Forgot your password? Use the reset option above</p>
              </div>
            );
          }
        },
        SignUp: {
          Header() {
            return (
              <div className="sign-up-header">
                <h3>🚀 Create Your Account</h3>
                <p>Join thousands of users translating globally</p>
                <div className="signup-benefits">
                  <div className="benefit">✅ Free translation service</div>
                  <div className="benefit">✅ 75+ supported languages</div>
                  <div className="benefit">✅ Secure cloud storage</div>
                  <div className="benefit">✅ Translation history</div>
                </div>
              </div>
            );
          },
          Footer() {
            return (
              <div className="auth-help">
                <p>📧 We'll send a verification code to your email</p>
                <p>🔐 Your password must be at least 8 characters</p>
              </div>
            );
          }
        },
        ConfirmSignUp: {
          Header() {
            return (
              <div className="confirm-header">
                <h3>📧 Check Your Email</h3>
                <p>We've sent a verification code to your email address</p>
              </div>
            );
          },
          Footer() {
            return (
              <div className="auth-help">
                <p>🔍 Check your spam folder if you don't see the email</p>
                <p>⏰ The code expires in 24 hours</p>
              </div>
            );
          }
        },
      }}
      loginMechanisms={['email']}
      signUpAttributes={['email']}
      // Enhanced error handling
      onError={(error) => {
        console.error('Authenticator error:', error);
      }}
    >
      {({ user, signOut: amplifySignOut }) => (
        <div className="app authenticated-app" data-auth-state="authenticated">
          <header className="app-header">
            <div className="header-content">
              <div className="header-left">
                <h1 className="app-title">🌐 AWS Translate</h1>
                <p className="app-subtitle">
                  Professional translation service powered by AWS
                </p>
                <div className="header-stats">
                  <span className="stat-item">🌍 {Object.keys(SUPPORTED_LANGUAGES || {}).length}+ Languages</span>
                  <span className="stat-item">⚡ Instant Results</span>
                  <span className="stat-item">🔒 Enterprise Security</span>
                </div>
              </div>

              <div className="header-right">
                <div className="user-info">
                  <div className="user-details">
                    <div className="user-greeting">
                      <span className="greeting-text">👋 Welcome</span>
                      <span className="user-email">
                        {user?.signInDetails?.loginId || user?.username || 'User'}
                      </span>
                    </div>
                    <div className="user-status">
                      <span className="status-indicator">🟢 Online</span>
                    </div>
                  </div>
                  <button 
                    onClick={async () => {
                      try {
                        await signOut();
                        window.location.reload();
                      } catch (error) {
                        console.error('Sign out error:', error);
                        amplifySignOut();
                      }
                    }} 
                    className="sign-out-button"
                    title="Sign out of your account"
                  >
                    🚪 Sign Out
                  </button>
                </div>
              </div>
            </div>
          </header>

          <main className="app-main">
            <div className="main-content">
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

              <section className="translation-section">
                <TranslationForm user={user} />
              </section>

              <section className="features-section">
                <h2 className="features-title">🌟 Why Choose AWS Translate?</h2>
                <div className="features-grid">
                  <div className="feature-card">
                    <div className="feature-icon">⚡</div>
                    <h3>Lightning Fast</h3>
                    <p>Powered by AWS Translate for instant, high-quality results with enterprise-grade performance</p>
                  </div>

                  <div className="feature-card">
                    <div className="feature-icon">🔒</div>
                    <h3>Enterprise Security</h3>
                    <p>Your data is protected with AWS enterprise-grade security, encryption, and compliance standards</p>
                  </div>

                  <div className="feature-card">
                    <div className="feature-icon">🌐</div>
                    <h3>Global Reach</h3>
                    <p>Support for 75+ languages and regional variants worldwide with continuous updates</p>
                  </div>

                  <div className="feature-card">
                    <div className="feature-icon">📱</div>
                    <h3>Universal Access</h3>
                    <p>Works seamlessly on desktop, tablet, and mobile devices with responsive design</p>
                  </div>

                  <div className="feature-card">
                    <div className="feature-icon">🚀</div>
                    <h3>Serverless Scale</h3>
                    <p>Automatically scales to handle any volume of translations without infrastructure management</p>
                  </div>

                  <div className="feature-card">
                    <div className="feature-icon">💾</div>
                    <h3>Smart Storage</h3>
                    <p>Automatic backup and retrieval of translation history with intelligent caching</p>
                  </div>
                </div>
              </section>

              <section className="tips-section">
                <h2>💡 Translation Tips</h2>
                <div className="tips-grid">
                  <div className="tip-card">
                    <h4>📝 Text Input</h4>
                    <p>Each line is translated separately. Break long content into logical chunks for better results.</p>
                  </div>
                  <div className="tip-card">
                    <h4>📁 File Upload</h4>
                    <p>Use JSON format with 'source_language', 'target_language', and 'texts' fields for batch processing.</p>
                  </div>
                  <div className="tip-card">
                    <h4>🌍 Language Selection</h4>
                    <p>Use the quick selection buttons for common language pairs or choose from the full list.</p>
                  </div>
                  <div className="tip-card">
                    <h4>📋 Results</h4>
                    <p>Copy individual translations or all results at once. Download JSON for record keeping.</p>
                  </div>
                </div>
              </section>
            </div>
          </main>

          <footer className="app-footer">
            <div className="footer-content">
              <div className="footer-left">
                <div className="footer-brand">
                  <h4>🌐 AWS Translate</h4>
                  <p>© 2024 Team Lambda Legends. Professional Translation Solutions.</p>
                </div>
                <div className="footer-tech">
                  <p>Built with React, AWS Lambda, Amazon Translate & S3</p>
                  <p>Powered by serverless architecture for maximum reliability</p>
                </div>
              </div>

              <div className="footer-right">
                <div className="footer-links">
                  <div className="link-group">
                    <h5>Resources</h5>
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
                  </div>
                  <div className="link-group">
                    <h5>Support</h5>
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
            </div>
          </footer>
        </div>
      )}
    </Authenticator>
  );
}

export default App;