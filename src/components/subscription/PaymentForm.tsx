/**
 * PaymentForm Component - Secure payment processing with Stripe Elements
 * 
 * Features:
 * - Stripe Elements integration
 * - PCI-compliant payment forms
 * - Real-time validation
 * - Loading states and error handling
 */

import React, { useState, useEffect } from 'react';
import {
  PaymentElement,
  useStripe,
  useElements,
  AddressElement
} from '@stripe/react-stripe-js';
import { useUser } from '@clerk/clerk-react';
import type { SubscriptionPlan } from '../../types/subscription';
import { useLogger } from '../../services/ServiceProvider';
import { 
  CreditCardIcon, 
  ShieldIcon, 
  CheckIcon,
  AlertCircleIcon,
  LoadingIcon
} from '../icons';

interface PaymentFormProps {
  plan: SubscriptionPlan;
  onSuccess: (subscriptionId: string) => void;
  onError: (error: string) => void;
  onCancel: () => void;
  className?: string;
}

export default function PaymentForm({ plan,
  onSuccess,
  onError,
  onCancel,
  className = ''
 }: PaymentFormProps): React.JSX.Element {
  const logger = useLogger();
  const stripe = useStripe();
  const elements = useElements();
  const { user } = useUser();

  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    if (!stripe) return;

    // Check for existing payment intent on mount
    const clientSecret = new URLSearchParams(window.location.search).get(
      'payment_intent_client_secret'
    );

    if (!clientSecret) return;

    stripe.retrievePaymentIntent(clientSecret).then(({ paymentIntent }) => {
      switch (paymentIntent?.status) {
        case 'succeeded':
          setMessage('Payment succeeded!');
          break;
        case 'processing':
          setMessage('Your payment is processing.');
          break;
        case 'requires_payment_method':
          setMessage('Your payment was not successful, please try again.');
          break;
        default:
          setMessage('Something went wrong.');
          break;
      }
    });
  }, [stripe]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          // Return URL after successful payment
          return_url: `${window.location.origin}/dashboard?subscription=success`,
        },
      });

      if (error) {
        if (error.type === 'card_error' || error.type === 'validation_error') {
          setMessage(error.message || 'An error occurred.');
          onError(error.message || 'Payment failed');
        } else {
          setMessage('An unexpected error occurred.');
          onError('An unexpected error occurred');
        }
      } else {
        // Payment succeeded - this will be handled by the return_url
        onSuccess('payment-processing');
      }
    } catch (err) {
      logger.error('Payment error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Payment failed';
      setMessage(errorMessage);
      onError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const paymentElementOptions = {
    layout: 'tabs' as const,
    paymentMethodOrder: ['card', 'apple_pay', 'google_pay'],
  };

  const handleElementsChange = (event: any) => {
    setIsComplete(event.complete);
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(price);
  };

  return (
    <div className={`max-w-lg mx-auto ${className}`}>
      {/* Plan Summary */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Subscription Summary
          </h3>
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <ShieldIcon size={16} />
            Secure Payment
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-gray-600 dark:text-gray-400">Plan:</span>
            <span className="font-medium text-gray-900 dark:text-white">
              {plan.name}
            </span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-gray-600 dark:text-gray-400">Billing:</span>
            <span className="font-medium text-gray-900 dark:text-white">
              Monthly
            </span>
          </div>
          
          <div className="flex justify-between items-center pt-3 border-t border-gray-200 dark:border-gray-700">
            <span className="text-lg font-semibold text-gray-900 dark:text-white">
              Total:
            </span>
            <span className="text-lg font-bold text-gray-600 dark:text-gray-500">
              {formatPrice(plan.price)}/month
            </span>
          </div>
        </div>

        {/* Trial Info */}
        <div className="mt-4 p-3 bg-blue-50 dark:bg-gray-900/20 rounded-lg">
          <div className="flex items-start gap-2">
            <CheckIcon size={16} className="text-gray-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <p className="text-blue-900 dark:text-gray-300 font-medium">
                14-day free trial included
              </p>
              <p className="text-blue-700 dark:text-gray-500 mt-1">
                You won't be charged until {new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <CreditCardIcon size={20} />
            Payment Method
          </h3>

          {/* Payment Element */}
          <div className="mb-6">
            <PaymentElement 
              id="payment-element"
              options={paymentElementOptions}
              onChange={handleElementsChange}
            />
          </div>

          {/* Billing Address */}
          <div>
            <h4 className="text-md font-medium text-gray-900 dark:text-white mb-3">
              Billing Address
            </h4>
            <AddressElement 
              options={{ 
                mode: 'billing',
                allowedCountries: ['US', 'CA', 'GB', 'AU', 'DE', 'FR'],
              }}
            />
          </div>
        </div>

        {/* Error Message */}
        {message && (
          <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <AlertCircleIcon size={20} className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-800 dark:text-red-200 font-medium">
                Payment Error
              </p>
              <p className="text-red-700 dark:text-red-300 text-sm mt-1">
                {message}
              </p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col-reverse sm:flex-row gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 px-6 py-3 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          
          <button
            type="submit"
            disabled={isLoading || !stripe || !elements || !isComplete}
            className="flex-1 px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <LoadingIcon size={20} className="animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <ShieldIcon size={20} />
                Start Free Trial
              </>
            )}
          </button>
        </div>

        {/* Security Info */}
        <div className="text-center text-sm text-gray-600 dark:text-gray-400">
          <div className="flex items-center justify-center gap-4 mb-2">
            <div className="flex items-center gap-1">
              <ShieldIcon size={14} />
              <span>SSL Secured</span>
            </div>
            <div className="flex items-center gap-1">
              <CheckIcon size={14} />
              <span>PCI Compliant</span>
            </div>
          </div>
          <p>
            Your payment information is encrypted and secure. 
            Powered by <span className="font-medium">Stripe</span>.
          </p>
        </div>
      </form>
    </div>
  );
}