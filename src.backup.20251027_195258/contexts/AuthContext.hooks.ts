import { useContext, useEffect } from 'react';
import { AuthContext } from './AuthContext.context';
import { AuthService } from '../services/authService';
import type { AuthContextType } from './AuthContext.types';

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function useRequireAuth(redirectTo = '/login') {
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      window.location.href = redirectTo;
    }
  }, [isAuthenticated, isLoading, redirectTo]);

  return { isAuthenticated, isLoading };
}

export function usePremiumFeatures() {
  const { user } = useAuth();

  return {
    hasPasskey: user?.hasPasskey ?? false,
    hasMFA: user?.hasMFA ?? false,
    hasEnhancedSecurity: user ? AuthService.hasEnhancedSecurity(user) : false,
  };
}
