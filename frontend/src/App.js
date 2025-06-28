// frontend/src/App.js
// SIMPLIFIED: Main application component with basic Amplify authentication

import React from 'react';
import { Authenticator } from '@aws-amplify/ui-react';
import TranslationForm from './components/TranslationForm';

function App() {
  return (
    <Authenticator
      loginMechanisms={['email']}
      signUpAttributes={['email']}
    >
      {({ signOut, user }) => (
        <div className="app">
          <header className="app-header">
            <h1>🌐 AWS Translate</h1>
            <div className="user-section">
              <span>Welcome, {user?.signInDetails?.loginId || 'User'}</span>
              <button onClick={signOut} className="sign-out-btn">
                Sign Out
              </button>
            </div>
          </header>

          <main className="app-main">
            <div className="container">
              <h2>Translation Service</h2>
              <p>Translate text between different languages using AWS Translate.</p>
              <TranslationForm user={user} />
            </div>
          </main>
        </div>
      )}
    </Authenticator>
  );
}

export default App;