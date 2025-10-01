import { useAuth, useUser, useSession } from '@clerk/clerk-react';
import { Navigate, useLocation } from 'react-router-dom';
import { type ReactNode, useEffect, useState, useCallback } from 'react';
import { Skeleton } from '../loading/Skeleton';
import StripeService from '../../services/stripeService';
import { AlertCircleIcon, LockIcon } from '../icons';
import { logger } from '../../services/loggingService';

interface ProtectedRouteProps {
  children: ReactNode;
  requirePremium?: boolean | undefined;
  requiredRole?: string | undefined;
  requiredTier?: 'free' | 'premium' | 'pro' | undefined;
  fallbackPath?: string | undefined;
}

export function ProtectedRoute({ 
  children, 
  requirePremium = false,
  requiredRole,
  fallbackPath = '/'
}: ProtectedRouteProps) {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const { user } = useUser();
  const { session } = useSession();
  const location = useLocation();
  const [subscription, setSubscription] = useState<any>(null);
  const [isCheckingSubscription, setIsCheckingSubscription] = useState(false);
  
  // Check if we're in test mode (for Playwright tests) or demo mode (for UI/UX testing)
  const isTestMode = typeof window !== 'undefined' && (
    window.localStorage.getItem('isTestMode') === 'true' ||
    new URLSearchParams(window.location.search).get('testMode') === 'true'
  );
  
  const isDemoMode = typeof window !== 'undefined' && (
    new URLSearchParams(window.location.search).get('demo') === 'true'
  );

  // Check if we're in development mode on localhost
  const isDevelopmentMode = typeof window !== 'undefined' && (
    window.location.hostname === 'localhost' || 
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname.startsWith('192.168.') ||
    import.meta.env.DEV === true
  );

  // Show loading state while Clerk is initializing (skip in test mode, demo mode, or development)
  if (!isLoaded && !isTestMode && !isDemoMode && !isDevelopmentMode) {
    return (
      <div className="min-h-screen bg-blue-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Skeleton className="w-32 h-32 rounded-full mx-auto mb-4" />
          <Skeleton className="w-48 h-6 mx-auto mb-2" />
          <Skeleton className="w-64 h-4 mx-auto" />
        </div>
      </div>
    );
  }

  // Redirect to home if not signed in (unless in test mode, demo mode, or development)
  if (!isSignedIn && !isTestMode && !isDemoMode && !isDevelopmentMode) {
    // Store the attempted location for redirect after login
    sessionStorage.setItem('redirectAfterLogin', location.pathname);
    return <Navigate to={fallbackPath} replace />;
  }

  // Check subscription status if premium is required
  const checkSubscriptionStatus = useCallback(async () => {
    if (!session) return;
    
    setIsCheckingSubscription(true);
    try {
      const token = await session.getToken();
      if (token) {
        const sub = await StripeService.getCurrentSubscription(token);
        setSubscription(sub);
      }
    } catch (error) {
      logger.error('Failed to check subscription:', error);
    } finally {
      setIsCheckingSubscription(false);
    }
  }, [session]);

  useEffect(() => {
    if (requirePremium && isSignedIn) {
      checkSubscriptionStatus();
    }
  }, [requirePremium, isSignedIn, checkSubscriptionStatus]);

  // Check for premium features
  if (requirePremium && !isTestMode && !isDemoMode && !isDevelopmentMode) {
    if (isCheckingSubscription) {
      return (
        <div className="min-h-screen bg-blue-50 dark:bg-gray-900 flex items-center justify-center">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-gray-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Checking subscription status...</p>
          </div>
        </div>
      );
    }

    if (!subscription || subscription.tier === 'free') {
      return (
        <div className="min-h-screen bg-blue-50 dark:bg-gray-900 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
            <div className="flex items-center justify-center w-16 h-16 bg-yellow-100 dark:bg-yellow-900/30 rounded-full mx-auto mb-4">
              <LockIcon size={32} className="text-yellow-600 dark:text-yellow-400" />
            </div>
            
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white text-center mb-4">
              Premium Feature
            </h2>
            
            <p className="text-gray-600 dark:text-gray-400 text-center mb-6">
              This feature requires a premium subscription. Upgrade to unlock advanced features and unlimited usage.
            </p>

            <div className="space-y-3">
              <button
                onClick={() => window.location.href = '/subscription'}
                className="w-full px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
              >
                Upgrade to Premium
              </button>
              
              <button
                onClick={() => window.history.back()}
                className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Go Back
              </button>
            </div>

            <div className="mt-6 p-4 bg-blue-50 dark:bg-gray-900/20 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircleIcon size={16} className="text-gray-600 dark:text-gray-500 mt-0.5" />
                <div className="text-sm text-blue-800 dark:text-blue-200">
                  <p className="font-medium mb-1">Premium includes:</p>
                  <ul className="space-y-1 text-xs">
                    <li>• Unlimited accounts & transactions</li>
                    <li>• Advanced analytics & reports</li>
                    <li>• Investment tracking</li>
                    <li>• Bank connections</li>
                    <li>• Priority support</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }
  }

  // Check role requirements
  if (requiredRole && user) {
    const userRole = user.publicMetadata?.role as string;
    if (userRole !== requiredRole && !isTestMode && !isDemoMode && !isDevelopmentMode) {
      return (
        <div className="min-h-screen bg-blue-50 dark:bg-gray-900 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
            <div className="flex items-center justify-center w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full mx-auto mb-4">
              <AlertCircleIcon size={32} className="text-red-600 dark:text-red-400" />
            </div>
            
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white text-center mb-4">
              Access Denied
            </h2>
            
            <p className="text-gray-600 dark:text-gray-400 text-center mb-6">
              You don't have permission to access this page. Required role: {requiredRole}
            </p>

            <button
              onClick={() => window.location.href = '/'}
              className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      );
    }
  }
  
  // Show development mode banner only on localhost
  return (
    <>
      {isDevelopmentMode && (
        <div className="bg-amber-500 text-white text-xs py-2 px-2 text-center relative z-50 mb-2">
          Development Mode - Authentication Bypassed
        </div>
      )}
      {children}
    </>
  );
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
