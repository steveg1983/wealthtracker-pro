import { useAuth } from '@clerk/clerk-react';
import { Navigate, useLocation } from 'react-router-dom';
import { ReactNode } from 'react';
import { Skeleton } from '../loading/Skeleton';
import { isAuthBypassRuntimeAllowed as isAuthBypassRuntimeAllowedFromRuntimeMode } from '../../utils/runtimeMode';

export interface ProtectedRouteProps {
  children: ReactNode;
  requirePremium?: boolean;
  requiredRole?: string;
  fallbackPath?: string;
}

// eslint-disable-next-line react-refresh/only-export-components -- Utility function closely related to ProtectedRoute component
export const isAuthBypassRuntimeAllowed = isAuthBypassRuntimeAllowedFromRuntimeMode;

const ProtectedRoute = ({ 
  children, 
  requirePremium = false,
  requiredRole,
  fallbackPath = '/'
}: ProtectedRouteProps): React.ReactElement | null => {
  const { isLoaded, isSignedIn } = useAuth();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  void requirePremium;
  void requiredRole;

  const bypassAllowed = isAuthBypassRuntimeAllowed(import.meta.env);
  const queryTestModeEnabled = queryParams.get('testMode') === 'true';
  const localStorageTestModeEnabled = typeof window !== 'undefined' &&
    window.localStorage.getItem('isTestMode') === 'true';
  const isTestMode = bypassAllowed && (queryTestModeEnabled || localStorageTestModeEnabled);

  const isDemoMode = bypassAllowed && queryParams.get('demo') === 'true';

  // Show loading state while Clerk is initializing (skip in test mode or demo mode)
  if (!isLoaded && !isTestMode && !isDemoMode) {
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

  // Redirect to home if not signed in (unless in test mode or demo mode)
  if (!isSignedIn && !isTestMode && !isDemoMode) {
    // Store the attempted location for redirect after login
    sessionStorage.setItem('redirectAfterLogin', location.pathname);
    return <Navigate to={fallbackPath} replace />;
  }

  // TODO: Add premium and role checks when subscription system is implemented
  // For now, just check authentication
  
  return <>{children}</>;
};

export default ProtectedRoute;
export { ProtectedRoute };
