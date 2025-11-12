import { useAuth } from '@clerk/clerk-react';
import { Navigate } from 'react-router-dom';
import { ReactNode } from 'react';
import { Skeleton } from './loading/Skeleton';

interface PublicRouteProps {
  children: ReactNode;
  redirectTo?: string;
}

export function PublicRoute({ 
  children, 
  redirectTo = '/dashboard'
}: PublicRouteProps) {
  const { isLoaded, isSignedIn } = useAuth();

  // Show loading state while Clerk is initializing
  if (!isLoaded) {
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

  // Redirect to dashboard if already signed in
  if (isSignedIn) {
    // Check if there's a saved redirect path
    const savedRedirect = sessionStorage.getItem('redirectAfterLogin');
    if (savedRedirect) {
      sessionStorage.removeItem('redirectAfterLogin');
      return <Navigate to={savedRedirect} replace />;
    }
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
}