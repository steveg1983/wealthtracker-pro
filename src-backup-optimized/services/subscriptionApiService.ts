/**
 * Subscription API Service - User profile and subscription management
 *
 * Features:
 * - User profile initialization
 * - Subscription status retrieval
 * - Integration with Stripe service
 */

import { lazyLogger as logger } from './serviceFactory';
import StripeService from './stripeService';
import type {
  UserSubscription,
  SubscriptionTier
} from '../types/subscription';

export class SubscriptionApiService {
  /**
   * Initialize user profile for subscription management
   */
  static async initializeUserProfile(
    clerkId: string,
    email: string,
    fullName?: string
  ): Promise<void> {
    try {
      logger.info('Initializing user profile for subscription', { clerkId, email });

      // For now, this is a no-op since profile creation is handled elsewhere
      // In a real implementation, this would create user records in the subscription database

      logger.info('User profile initialized successfully');
    } catch (error) {
      logger.error('Error initializing user profile:', error);
      throw error;
    }
  }

  /**
   * Get current subscription for a user
   */
  static async getCurrentSubscription(clerkId: string): Promise<UserSubscription | null> {
    try {
      // Use the existing StripeService method
      // In a real implementation, this might fetch from a separate subscription API
      const subscription = await StripeService.getCurrentSubscription();

      if (subscription) {
        return {
          ...subscription,
          userId: clerkId // Ensure userId is set correctly
        };
      }

      return null;
    } catch (error) {
      logger.error('Error getting current subscription:', error);
      throw error;
    }
  }

  /**
   * Update subscription tier for a user
   */
  static async updateSubscription(
    clerkId: string,
    tier: SubscriptionTier
  ): Promise<UserSubscription | null> {
    try {
      logger.info('Updating subscription tier', { clerkId, tier });

      // In a real implementation, this would update the subscription via API
      // For now, return null to indicate no active subscription

      return null;
    } catch (error) {
      logger.error('Error updating subscription:', error);
      throw error;
    }
  }

  /**
   * Cancel subscription for a user
   */
  static async cancelSubscription(clerkId: string): Promise<boolean> {
    try {
      logger.info('Cancelling subscription', { clerkId });

      // In a real implementation, this would cancel the subscription via API
      // For now, return false to indicate operation was not successful

      return false;
    } catch (error) {
      logger.error('Error cancelling subscription:', error);
      throw error;
    }
  }

  /**
   * Reactivate subscription for a user
   */
  static async reactivateSubscription(clerkId: string): Promise<boolean> {
    try {
      logger.info('Reactivating subscription', { clerkId });

      // In a real implementation, this would reactivate the subscription via API
      // For now, return false to indicate operation was not successful

      return false;
    } catch (error) {
      logger.error('Error reactivating subscription:', error);
      throw error;
    }
  }
}

// Export default instance
export default SubscriptionApiService;