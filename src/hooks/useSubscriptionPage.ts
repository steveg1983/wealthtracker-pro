/**
 * Custom Hook for Subscription Page
 * Manages subscription state and interactions
 */

import { useState, useEffect, useCallback } from 'react';
import { useUser, useSession } from '@clerk/clerk-react';
import { subscriptionPageService, type ViewMode } from '../services/subscriptionPageService';
import StripeService from '../services/stripeService';
import type { SubscriptionPlan, UserSubscription } from '../types/subscription';
import { logger } from '../services/loggingService';

export interface UseSubscriptionPageReturn {
  // State
  currentView: ViewMode;
  selectedPlan: SubscriptionPlan | null;
  currentSubscription: UserSubscription | null;
  isLoading: boolean;
  error: string | null;
  stripePromise: any;
  isSignedIn: boolean;
  user: any;
  
  // Actions
  setCurrentView: (view: ViewMode) => void;
  handleSelectPlan: (plan: SubscriptionPlan) => Promise<void>;
  handleBackToPricing: () => void;
  handleGoToBilling: () => void;
  clearError: () => void;
  loadCurrentSubscription: () => Promise<void>;
  getCurrentTier: () => string;
  getViewTitle: () => string;
}

export function useSubscriptionPage(defaultView: ViewMode = 'plans'): UseSubscriptionPageReturn {
  const { user, isSignedIn } = useUser();
  const { session } = useSession();
  
  const [currentView, setCurrentView] = useState<ViewMode>(defaultView);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [currentSubscription, setCurrentSubscription] = useState<UserSubscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stripePromise] = useState(StripeService.getStripe());

  // Get session token helper
  const getToken = useCallback(async (): Promise<string | null> => {
    if (!session) return null;
    try {
      return await session.getToken();
    } catch (err) {
      logger.error('Error getting auth token:', err);
      return null;
    }
  }, [session]);

  // Load current subscription
  const loadCurrentSubscription = useCallback(async () => {
    if (!isSignedIn || !session) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      const token = await getToken();
      if (!token) {
        logger.warn('No auth token available');
        setIsLoading(false);
        return;
      }
      
      const subscription = await subscriptionPageService.loadSubscription(token);
      setCurrentSubscription(subscription);
      
      // Determine initial view
      const initialView = subscriptionPageService.getInitialView(
        defaultView,
        !!subscription
      );
      setCurrentView(initialView);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [isSignedIn, session, getToken, defaultView]);

  // Initialize on mount
  useEffect(() => {
    loadCurrentSubscription();
  }, [loadCurrentSubscription]);

  // Handle plan selection
  const handleSelectPlan = useCallback(async (plan: SubscriptionPlan) => {
    setSelectedPlan(plan);
    setError(null);
    
    // Validate authentication
    const authValidation = subscriptionPageService.validateAuth(isSignedIn || false, session);
    if (!authValidation.valid) {
      setError(authValidation.error!);
      return;
    }

    setIsLoading(true);
    
    try {
      if (plan.tier === 'free') {
        // Handle free plan (cancellation)
        const result = await subscriptionPageService.handleFreePlan(
          currentSubscription,
          getToken
        );
        
        if (result.success) {
          setCurrentSubscription(null);
          alert('Your subscription has been cancelled successfully. You will retain access until the end of your billing period.');
          await loadCurrentSubscription();
        } else {
          setError(result.error || 'Failed to cancel subscription');
        }
      } else {
        // Handle paid plan (checkout)
        const result = await subscriptionPageService.handlePaidPlan(plan, getToken);
        if (!result.success) {
          setError(result.error || 'Failed to start checkout');
        }
      }
    } catch (err) {
      logger.error('Error handling plan selection:', err);
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [isSignedIn, session, currentSubscription, getToken, loadCurrentSubscription]);

  // Navigation handlers
  const handleBackToPricing = useCallback(() => {
    setCurrentView('plans');
    setSelectedPlan(null);
    setError(null);
  }, []);

  const handleGoToBilling = useCallback(() => {
    setCurrentView('billing');
    setSelectedPlan(null);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Get current tier
  const getCurrentTier = useCallback(() => {
    return subscriptionPageService.getCurrentTier(currentSubscription);
  }, [currentSubscription]);

  // Get view title
  const getViewTitle = useCallback(() => {
    return subscriptionPageService.getViewTitle(currentView, selectedPlan?.name);
  }, [currentView, selectedPlan]);

  return {
    // State
    currentView,
    selectedPlan,
    currentSubscription,
    isLoading,
    error,
    stripePromise,
    isSignedIn: isSignedIn ?? false,
    user,
    
    // Actions
    setCurrentView,
    handleSelectPlan,
    handleBackToPricing,
    handleGoToBilling,
    clearError,
    loadCurrentSubscription,
    getCurrentTier,
    getViewTitle
  };
}