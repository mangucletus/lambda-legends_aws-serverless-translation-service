// frontend/src/App.js
// FIXED: Enhanced main application component with proper authentication and error handling

import React, { useState, useEffect } from 'react';
import { Authenticator, useAuthenticator } from '@aws-amplify/ui-react';
import { getCurrentUser } from 'aws-amplify/auth';
import TranslationForm from './components/TranslationForm';

// Custom themed Authenticator
const CustomAuthenticator = ({ children }) => {
  return (
    <Authenticator
      loginMechanisms={['email']}
      signUpAttributes={['email']}
      formFields={{
        signUp: {
          email: {
            order: 1,
            placeholder: 'Enter your email address',
            label: 'Email *',
            inputProps: { required: true }
          },
          password: {
            order: 2,
            placeholder: 'Create a strong password',
            label: 'Password *',
            inputProps: { required: true }
          },
          confirm_password: {
            order: 3,
            placeholder: 'Confirm your password',
            label: 'Confirm Password *',
            inputProps: { required: true }
          }
        },
        signIn: {
          email: {
            placeholder: 'Enter your email address',
            label: 'Email',
            inputProps: { required: true }
          },
          password: {
            placeholder: 'Enter your password',
            label: 'Password',
            inputProps: { required: true }
          }
        }
      }}
      components={{
        Header() {
          return (
            <div style={{ 
              textAlign: 'center', 
              padding: '2rem 0 1rem',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>
              <h1 style={{ 
                fontSize: '2.5rem', 
                fontWeight: '800', 
                margin: '0 0 0.5rem',
                textShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}>
                🌐 AWS Translate
              </h1>
              <p style={{ 
                fontSize: '1.1rem', 
                color: '#636e72',
                margin: 0,
                fontWeight: 500
              }}>
                Professional translation service powered by AWS
              </p>
            </div>
          );
        },
        Footer() {
          return (
            <div style={{ 
              textAlign: 'center', 
              padding: '1rem 0',
              fontSize: '0.875rem',
              color: '#b2bec3'
            }}>
              <p>Secure authentication • Multi-language support • Cloud-powered</p>
            </div>
          );
        }
      }}
    >
      {children}
    </Authenticator>
  );
};

// Enhanced user info component
const UserInfo = ({ user, onSignOut }) => {
  const [userDetails, setUserDetails] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserDetails = async () => {
      try {
        setLoading(true);
        const currentUser = await getCurrentUser();
        setUserDetails(currentUser);
      } catch (error) {
        console.error('Error fetching user details:', error);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchUserDetails();
    }
  }, [user]);

  if (loading) {
    return (
      <div className="user-section">
        <span style={{ color: '#b2bec3' }}>Loading...</span>
      </div>
    );
  }

  const userEmail = userDetails?.signInDetails?.loginId || 
                   user?.signInDetails?.loginId || 
                   user?.username || 
                   'User';

  return (
    <div className="user-section">
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'flex-end',
        gap: '0.25rem'
      }}>
        <span style={{ 
          fontSize: '0.875rem',
          fontWeight: '600',
          color: '#2d3436'
        }}>
          Welcome back!
        </span>
        <span style={{ 
          fontSize: '0.75rem',
          color: '#636e72',
          maxWidth: '200px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          {userEmail}
        </span>
      </div>
      <button 
        onClick={onSignOut} 
        className="sign-out-btn"
        style={{
          background: 'linear-gradient(135deg, #e17055 0%, #f093fb 100%)',
          color: '#ffffff',
          border: 'none',
          padding: '0.75rem 1.5rem',
          borderRadius: '12px',
          cursor: 'pointer',
          fontWeight: '600',
          fontSize: '0.875rem',
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}
        onMouseOver={(e) => {
          e.target.style.transform = 'translateY(-2px)';
          e.target.style.boxShadow = '0 8px 25px rgba(225, 112, 85, 0.25)';
        }}
        onMouseOut={(e) => {
          e.target.style.transform = 'translateY(0)';
          e.target.style.boxShadow = 'none';
        }}
      >
        <span>🚪</span>
        <span>Sign Out</span>
      </button>
    </div>
  );
};

// Main application content
const AppContent = () => {
  const { user, signOut } = useAuthenticator((context) => [context.user]);
  const [appError, setAppError] = useState(null);

  // Error handler for the translation form
  const handleTranslationError = (error) => {
    console.error('Translation error in App:', error);
    setAppError({
      type: 'translation',
      message: error.message || 'Translation failed'
    });
  };

  // Clear error handler
  const clearError = () => {
    setAppError(null);
  };

  return (
    <div className="app">
      <header className="app-header">
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          width: '100%',
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '0 1rem'
        }}>
          <div>
            <h1 style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              fontSize: '1.8rem',
              fontWeight: '800',
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              🌐 AWS Translate
            </h1>
            <p style={{
              margin: '0.25rem 0 0',
              fontSize: '0.875rem',
              color: '#636e72',
              fontWeight: '500'
            }}>
              Professional translation service
            </p>
          </div>
          
          <UserInfo user={user} onSignOut={signOut} />
        </div>
      </header>

      <main className="app-main">
        <div className="container">
          {/* Application error display */}
          {appError && (
            <div style={{
              background: 'rgba(225, 112, 85, 0.1)',
              border: '1px solid rgba(225, 112, 85, 0.3)',
              borderRadius: '12px',
              padding: '1rem',
              margin: '1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '1.5rem' }}>⚠️</span>
                <div>
                  <h4 style={{ margin: 0, color: '#e17055', fontSize: '1rem', fontWeight: '600' }}>
                    Application Error
                  </h4>
                  <p style={{ margin: '0.25rem 0 0', color: '#636e72', fontSize: '0.875rem' }}>
                    {appError.message}
                  </p>
                </div>
              </div>
              <button
                onClick={clearError}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '0.5rem',
                  borderRadius: '8px',
                  color: '#e17055',
                  fontSize: '1.25rem',
                  transition: 'all 0.2s ease'
                }}
                onMouseOver={(e) => e.target.style.background = 'rgba(225, 112, 85, 0.1)'}
                onMouseOut={(e) => e.target.style.background = 'transparent'}
              >
                ✕
              </button>
            </div>
          )}

          {/* Main content header */}
          <div style={{ padding: '2rem 2rem 0' }}>
            <h2 style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              fontSize: '2rem',
              fontWeight: '700',
              margin: '0 0 0.5rem',
              textAlign: 'center'
            }}>
              Translation Service
            </h2>
            <p style={{
              color: '#636e72',
              fontSize: '1.125rem',
              margin: '0 0 2rem',
              textAlign: 'center',
              lineHeight: '1.6'
            }}>
              Translate text between multiple languages using AWS Translate. 
              Support for 20+ languages with high accuracy and fast processing.
            </p>
          </div>

          {/* Translation form */}
          <TranslationForm 
            user={user} 
            onError={handleTranslationError}
          />
        </div>
      </main>

      {/* Footer */}
      <footer style={{
        background: 'rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(10px)',
        padding: '1.5rem',
        textAlign: 'center',
        borderTop: '1px solid rgba(255, 255, 255, 0.2)',
        marginTop: 'auto'
      }}>
        <p style={{
          margin: 0,
          fontSize: '0.875rem',
          color: 'rgba(255, 255, 255, 0.8)'
        }}>
          🚀 Powered by AWS • Built with React & Amplify • 
          <span style={{ margin: '0 0.5rem' }}>•</span>
          Secure & Scalable Translation Service
        </p>
      </footer>
    </div>
  );
};

// Main App component
function App() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Small delay to ensure Amplify is fully configured
    const timer = setTimeout(() => {
      setIsReady(true);
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  if (!isReady) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
      }}>
        <div style={{
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(20px)',
          borderRadius: '24px',
          padding: '2rem',
          boxShadow: '0 20px 25px rgba(0, 0, 0, 0.15)',
          textAlign: 'center'
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            border: '4px solid rgba(102, 126, 234, 0.2)',
            borderTop: '4px solid #667eea',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 1rem'
          }} />
          <h2 style={{ color: '#667eea', margin: '0 0 0.5rem', fontSize: '1.5rem' }}>
            🌐 AWS Translate
          </h2>
          <p style={{ color: '#636e72', margin: 0, fontSize: '1rem' }}>
            Loading application...
          </p>
        </div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <CustomAuthenticator>
      <AppContent />
    </CustomAuthenticator>
  );
}

export default App;