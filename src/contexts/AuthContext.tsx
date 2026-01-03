/**
 * Authentication Context - Provides auth state throughout the app
 * 
 * Features:
 * - Seamless integration with Clerk
 * - Custom auth hooks
 * - Session management
 * - Security status tracking
 */

/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useUser, useAuth as useClerkAuth, useSession } from '@clerk/clerk-react';
import { AuthService, AuthUser } from '../services/authService';
import { setSentryUser, clearSentryUser } from '../lib/sentry';

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  securityScore: number;
  securityRecommendations: string[];
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { user: clerkUser, isLoaded } = useUser();
  const { signOut: clerkSignOut, getToken: _getToken } = useClerkAuth();
  const { session } = useSession();
  
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [securityScore, setSecurityScore] = useState(0);
  const [securityRecommendations, setSecurityRecommendations] = useState<string[]>([]);

  useEffect(() => {
    if (isLoaded && clerkUser) {
      const mappedUser = AuthService.mapClerkUser(clerkUser);
      setAuthUser(mappedUser);
      setSecurityScore(AuthService.getSecurityScore(mappedUser));
      setSecurityRecommendations(AuthService.getSecurityRecommendations(mappedUser));
      
      // Set Sentry user context
      setSentryUser({
        id: clerkUser.id,
        email: clerkUser.primaryEmailAddress?.emailAddress,
        username: clerkUser.username || clerkUser.fullName || undefined
      });

      // Note: User sync with Supabase is handled by AppContextSupabase and SubscriptionContext
      // Removed deprecated syncClerkUser() call to prevent duplicate user creation attempts
    } else if (isLoaded && !clerkUser) {
      setAuthUser(null);
      setSecurityScore(0);
      setSecurityRecommendations([]);
      
      // Clear Sentry user context
      clearSentryUser();
    }
  }, [clerkUser, isLoaded]);

  const signOut = async () => {
    await clerkSignOut();
    setAuthUser(null);
    
    // Clear Sentry user context
    clearSentryUser();
  };

  const refreshSession = async () => {
    if (session) {
      await session.reload();
    }
  };

  const value: AuthContextType = {
    user: authUser,
    isLoading: !isLoaded,
    isAuthenticated: !!authUser,
    securityScore,
    securityRecommendations,
    signOut,
    refreshSession
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// Custom hook for using auth context
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Custom hook for requiring authentication
export function useRequireAuth(redirectTo = '/login') {
  const { isAuthenticated, isLoading } = useAuth();
  
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      // In a real app, you'd use React Router to redirect
      window.location.href = redirectTo;
    }
  }, [isAuthenticated, isLoading, redirectTo]);

  return { isAuthenticated, isLoading };
}

// Custom hook for checking premium features
export function usePremiumFeatures() {
  const { user } = useAuth();
  
  return {
    hasPasskey: user?.hasPasskey || false,
    hasMFA: user?.hasMFA || false,
    hasEnhancedSecurity: user ? AuthService.hasEnhancedSecurity(user) : false
  };
}
