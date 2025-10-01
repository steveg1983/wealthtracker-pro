/**
 * SubscriptionPage Component - Main subscription management interface
 * 
 * Features:
 * - Pricing plans display
 * - Payment processing
 * - Billing dashboard
 * - Stripe Elements provider
 */

import React, { useState, useEffect } from 'react';
import { Elements } from '@stripe/react-stripe-js';
import { useUser, useSession } from '@clerk/clerk-react';
import StripeService from '../../services/stripeService';
import PricingPlans from './PricingPlans';
import PaymentForm from './PaymentForm';
import BillingDashboard from './BillingDashboard';
import SyncSubscriptionButton from './SyncSubscriptionButton';
import StripeStatusButton from './StripeStatusButton';
import type { SubscriptionPlan, UserSubscription } from '../../types/subscription';
import { ArrowLeftIcon, CheckCircleIcon } from '../icons';
import { logger } from '../../services/loggingService';

type ViewMode = 'plans' | 'payment' | 'billing' | 'success';

interface SubscriptionPageProps {
  defaultView?: ViewMode;
  className?: string;
}

export default function SubscriptionPage({
  defaultView = 'plans',
  className = ''
}: SubscriptionPageProps): React.JSX.Element {
  const { user, isSignedIn } = useUser();
  const { session } = useSession();
  const [currentView, setCurrentView] = useState<ViewMode>(defaultView);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [currentSubscription, setCurrentSubscription] = useState<UserSubscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stripePromise, setStripePromise] = useState(StripeService.getStripe());

  useEffect(() => {
    const getSessionToken = async () => {
      if (isSignedIn && session) {
        try {
          // Get the Clerk session token
          const token = await session.getToken();
          if (token) {
            loadCurrentSubscription(token);
          } else {
            setIsLoading(false);
          }
        } catch (err) {
          logger.error('Error getting auth token:', err);
          setIsLoading(false);
        }
      } else {
        setIsLoading(false);
      }
    };
    
    getSessionToken();
  }, [isSignedIn, session]);

  const loadCurrentSubscription = async (providedToken?: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      let token = providedToken;
      if (!token && session) {
        const sessionToken = await session.getToken();
        if (sessionToken) {
          token = sessionToken;
        }
      }

      if (!token) {
        logger.warn('No auth token available');
        setIsLoading(false);
        return;
      }

      const subscription = await StripeService.getCurrentSubscription(token);
      setCurrentSubscription(subscription);
      
      // If user has a subscription, show billing dashboard by default
      if (subscription && defaultView === 'plans') {
        setCurrentView('billing');
      }
    } catch (err) {
      logger.error('Error loading subscription:', err);
      setError('Failed to load subscription information');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectPlan = async (plan: SubscriptionPlan) => {
    setSelectedPlan(plan);
    
    if (plan.tier === 'free') {
      // Handle free plan selection (downgrade/cancellation)
      if (currentSubscription) {
        try {
          setIsLoading(true);
          
          if (!session) {
            setError('Authentication required. Please sign in again.');
            return;
          }
          
          const token = await session.getToken();
          if (!token) {
            setError('Failed to get authentication token');
            return;
          }
          
          if (!currentSubscription.stripeSubscriptionId) {
            setError('Unable to locate your active subscription.');
            setIsLoading(false);
            return;
          }

          const result = await StripeService.cancelSubscription(
            currentSubscription.stripeSubscriptionId,
            token,
            true
          );
          
          if (result.success) {
            // Clear local subscription state
            setCurrentSubscription(null);
            setError(null);
            
            // Show success message
            alert('Your subscription has been cancelled successfully. You will retain access until the end of your billing period.');
            
            // Reload subscription status
            await loadCurrentSubscription(token);
          } else {
            setError(result.error || 'Failed to cancel subscription');
          }
        } catch (err) {
          logger.error('Error cancelling subscription:', err);
          setError('Failed to cancel subscription. Please try again or contact support.');
        } finally {
          setIsLoading(false);
        }
      }
      return;
    }

    // For paid plans, redirect to Stripe Checkout
    try {
      if (!session) {
        setError('Authentication required. Please sign in again.');
        return;
      }
      
      setIsLoading(true);
      const token = await session.getToken();
      if (!token) {
        setError('Failed to get authentication token');
        setIsLoading(false);
        return;
      }
      
      const { url } = await StripeService.createCheckoutSession(
        plan.tier as 'premium' | 'pro',
        token
      );
      
      if (url) {
        // Redirect to Stripe Checkout
        window.location.href = url;
      } else {
        setError('Failed to create checkout session');
      }
    } catch (err) {
      logger.error('Error creating checkout:', err);
      setError('Failed to start checkout process');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePaymentSuccess = async (subscriptionId: string) => {
    setCurrentView('success');
    await loadCurrentSubscription();
  };

  const handlePaymentError = (error: string) => {
    setError(error);
  };

  const handleBackToPricing = () => {
    setCurrentView('plans');
    setSelectedPlan(null);
    setError(null);
  };

  const handleGoToBilling = () => {
    setCurrentView('billing');
    setSelectedPlan(null);
  };

  const getCurrentTier = () => {
    if (currentSubscription) {
      return currentSubscription.tier;
    }
    return 'free';
  };

  if (!isSignedIn) {
    return (
      <div className={`text-center py-12 ${className}`}>
        <div className="max-w-md mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Sign In Required
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Please sign in to manage your subscription and access premium features.
          </p>
          <button
            onClick={() => window.location.href = '/sign-in'}
            className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center py-12 ${className}`}>
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-gray-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading subscription information...</p>
        </div>
      </div>
    );
  }

  const renderHeader = () => {
    const titles = {
      plans: 'Choose Your Plan',
      payment: `Upgrade to ${selectedPlan?.name}`,
      billing: 'Billing & Subscription',
      success: 'Welcome to Premium!'
    };

    return (
      <div className="mb-8">
        {(currentView === 'payment' || currentView === 'success') && (
          <button
            onClick={handleBackToPricing}
            className="flex items-center gap-2 text-gray-600 dark:text-gray-500 hover:text-blue-700 dark:hover:text-gray-300 mb-4"
          >
            <ArrowLeftIcon size={16} />
            Back to Plans
          </button>
        )}
        
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          {titles[currentView]}
        </h1>
        
        {currentView === 'billing' && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-gray-600 dark:text-gray-400">
              Current plan: <span className="font-medium">{getCurrentTier()}</span>
            </p>
            <div className="flex items-center gap-4">
              <SyncSubscriptionButton onSync={() => {
                if (session) {
                  session.getToken().then(token => {
                    if (token) loadCurrentSubscription(token);
                  });
                }
              }} />
              <button
                onClick={() => setCurrentView('plans')}
                className="text-gray-600 dark:text-gray-500 hover:text-blue-700 dark:hover:text-gray-300"
              >
                Change Plan
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderContent = () => {
    switch (currentView) {
      case 'plans':
        return (
          <>
            <div className="mb-6 flex justify-end">
              <SyncSubscriptionButton onSync={() => {
                if (session) {
                  session.getToken().then(token => {
                    if (token) loadCurrentSubscription(token);
                  });
                }
              }} />
            </div>
            <PricingPlans
              currentTier={getCurrentTier()}
              onSelectPlan={handleSelectPlan}
              showFreePlan={true}
            />
          </>
        );

      case 'payment':
        // We don't use this view anymore - we redirect to Stripe Checkout
        setCurrentView('plans');
        return null;

      case 'billing':
        return (
          <div className="space-y-6">
            <StripeStatusButton />
            <BillingDashboard />
          </div>
        );

      case 'success':
        return (
          <div className="max-w-2xl mx-auto text-center py-12">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircleIcon size={32} className="text-green-600" />
            </div>
            
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Subscription Activated!
            </h2>
            
            <p className="text-gray-600 dark:text-gray-400 mb-8">
              Welcome to {selectedPlan?.name || 'Premium'}! Your subscription is now active and you have access 
              to all premium features. You're currently in your 14-day free trial period.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              <button
                onClick={() => window.location.href = '/dashboard'}
                className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Go to Dashboard
              </button>
              
              <button
                onClick={handleGoToBilling}
                className="px-6 py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                Manage Billing
              </button>
            </div>

            {/* Features Preview */}
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-6 shadow-md border-l-4 border-amber-400 dark:border-amber-600">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                What's Next?
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                  <CheckCircleIcon size={16} />
                  <span>Unlimited accounts & transactions</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                  <CheckCircleIcon size={16} />
                  <span>Advanced analytics & reports</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                  <CheckCircleIcon size={16} />
                  <span>CSV export functionality</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                  <CheckCircleIcon size={16} />
                  <span>Investment portfolio tracking</span>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return <PricingPlans currentTier={getCurrentTier()} onSelectPlan={handleSelectPlan} />;
    }
  };

  return (
    <div className={`min-h-screen bg-blue-50 dark:bg-gray-900 ${className}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {renderHeader()}
        
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
            <p className="text-red-800 dark:text-red-200">{error}</p>
            <button
              onClick={() => setError(null)}
              className="text-red-600 dark:text-red-400 underline text-sm mt-1 hover:no-underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {renderContent()}
      </div>
    </div>
  );
}
