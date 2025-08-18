import { useAuth } from '@clerk/clerk-react';
import { Navigate, useLocation } from 'react-router-dom';
import { ReactNode, useEffect } from 'react';
import { Skeleton } from '../loading/Skeleton';

interface ProtectedRouteProps {
  children: ReactNode;
  requirePremium?: boolean;
  requiredRole?: string;
  fallbackPath?: string;
}

export function ProtectedRoute({ 
  children, 
  requirePremium = false,
  requiredRole,
  fallbackPath = '/'
}: ProtectedRouteProps) {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const location = useLocation();
  
  // Check if we're in test mode (for Playwright tests)
  const isTestMode = typeof window !== 'undefined' && (
    window.localStorage.getItem('isTestMode') === 'true' ||
    new URLSearchParams(window.location.search).get('testMode') === 'true'
  );

  // Show loading state while Clerk is initializing (skip in test mode)
  if (!isLoaded && !isTestMode) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Skeleton className="w-32 h-32 rounded-full mx-auto mb-4" />
          <Skeleton className="w-48 h-6 mx-auto mb-2" />
          <Skeleton className="w-64 h-4 mx-auto" />
        </div>
      </div>
    );
  }

  // Redirect to home if not signed in (unless in test mode)
  if (!isSignedIn && !isTestMode) {
    // Store the attempted location for redirect after login
    sessionStorage.setItem('redirectAfterLogin', location.pathname);
    return <Navigate to={fallbackPath} replace />;
  }

  // TODO: Add premium and role checks when subscription system is implemented
  // For now, just check authentication
  
  return <>{children}</>;
}

// Higher-order component for protecting routes
export function withProtectedRoute<P extends object>(
  Component: React.ComponentType<P>,
  options?: Omit<ProtectedRouteProps, 'children'>
) {
  return function ProtectedComponent(props: P) {
    return (
      <ProtectedRoute {...options}>
        <Component {...props} />
      </ProtectedRoute>
    );
  };
}