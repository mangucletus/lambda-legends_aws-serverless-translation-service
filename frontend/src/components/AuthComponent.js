// frontend/src/components/AuthComponent.js
// Authentication component with auth utilities

import React, { useState, useEffect } from 'react';
import { getCurrentUser, signOut, fetchAuthSession } from 'aws-amplify/auth';

const AuthComponent = ({ onAuthStateChange }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authState, setAuthState] = useState('loading');

  useEffect(() => {
    checkAuthState();
  }, []);

  const checkAuthState = async () => {
    try {
      setLoading(true);
      const currentUser = await getCurrentUser();
      setUser(currentUser);
      setAuthState('signedIn');

      if (onAuthStateChange) {
        onAuthStateChange('signedIn', currentUser);
      }
    } catch (error) {
      console.log('User not authenticated');
      setUser(null);
      setAuthState('signedOut');

      if (onAuthStateChange) {
        onAuthStateChange('signedOut', null);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      setUser(null);
      setAuthState('signedOut');

      if (onAuthStateChange) {
        onAuthStateChange('signedOut', null);
      }
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const refreshSession = async () => {
    try {
      const session = await fetchAuthSession({ forceRefresh: true });
      return session;
    } catch (error) {
      console.error('Error refreshing session:', error);
      throw error;
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="auth-loading">
        <div className="loading-spinner"></div>
        <p>Checking authentication...</p>
      </div>
    );
  }

  // This component mainly provides auth utilities
  // The actual UI is handled by Amplify's Authenticator
  return (
    <div className="auth-component">
      {authState === 'signedIn' && user && (
        <div className="auth-user-info">
          <div className="user-details">
            <h4>Authenticated User</h4>
            <p><strong>User ID:</strong> {user.userId}</p>
            <p><strong>Username:</strong> {user.signInDetails?.loginId}</p>

            <div className="auth-actions">
              <button onClick={handleSignOut} className="sign-out-button">
                Sign Out
              </button>
              <button onClick={refreshSession} className="refresh-button">
                Refresh Session
              </button>
            </div>
          </div>
        </div>
      )}

      {authState === 'signedOut' && (
        <div className="auth-signed-out">
          <p>Please sign in to continue</p>
        </div>
      )}
    </div>
  );
};

// Custom hook for auth functionality
export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    } catch (error) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  return { user, loading, checkUser };
};

// Helper functions for common auth operations
export const authUtils = {
  async getCurrentUser() {
    try {
      return await getCurrentUser();
    } catch (error) {
      return null;
    }
  },

  async getCurrentSession() {
    try {
      return await fetchAuthSession();
    } catch (error) {
      return null;
    }
  },

  async getIdToken() {
    try {
      const session = await fetchAuthSession();
      return session.tokens?.idToken?.toString();
    } catch (error) {
      return null;
    }
  },

  async getAccessToken() {
    try {
      const session = await fetchAuthSession();
      return session.tokens?.accessToken?.toString();
    } catch (error) {
      return null;
    }
  },

  async signOut() {
    try {
      await signOut();
      return true;
    } catch (error) {
      console.error('Sign out error:', error);
      return false;
    }
  }
};

export default AuthComponent;