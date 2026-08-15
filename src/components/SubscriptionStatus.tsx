import React, { useMemo } from 'react';
import { CheckIcon, AlertCircleIcon, CreditCardIcon, CrownIcon, ZapIcon, UsersIcon } from './icons';
import { useSubscription } from '../contexts/SubscriptionContext';
import { formatDistanceToNow } from 'date-fns';
import { createScopedLogger } from '../loggers/scopedLogger';
import { NEXT_ACTION_YELLOW } from '../design-system/nextActionYellow';

interface PlanFeature {
  name: string;
  included: boolean;
}

interface PlanDetails {
  name: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  features: PlanFeature[];
  price?: string;
  badge?: string;
}

const PLAN_KEYS = ['free', 'pro', 'business'] as const;
type PlanKey = typeof PLAN_KEYS[number];

const PLAN_DETAILS: Record<PlanKey, PlanDetails> = {
  free: {
    name: 'Free',
    icon: ZapIcon,
    color: 'text-gray-600',
    bgColor: 'bg-gray-100 dark:bg-gray-700',
    features: [
      { name: 'Up to 2 accounts', included: true },
      { name: '30 day transaction history', included: true },
      { name: 'Basic budgeting', included: true },
      { name: 'Manual data entry', included: true },
      { name: 'CSV export', included: true },
      { name: 'Bank sync', included: false },
      { name: 'Unlimited accounts', included: false },
      { name: 'Advanced analytics', included: false },
      { name: 'Priority support', included: false },
    ]
  },
  pro: {
    name: 'Pro',
    icon: CrownIcon,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    price: '£9.99/month',
    badge: 'Most Popular',
    features: [
      { name: 'Unlimited accounts', included: true },
      { name: 'Full transaction history', included: true },
      { name: 'Bank sync (UK banks)', included: true },
      { name: 'Advanced budgeting', included: true },
      { name: 'Investment tracking', included: true },
      { name: 'Custom categories', included: true },
      { name: 'Excel & PDF export', included: true },
      { name: 'Email support', included: true },
      { name: 'Business features', included: false },
    ]
  },
  business: {
    name: 'Business',
    icon: UsersIcon,
    color: 'text-purple-600',
    bgColor: 'bg-purple-100 dark:bg-purple-900/30',
    price: '£24.99/month',
    features: [
      { name: 'Everything in Pro', included: true },
      { name: 'Multi-user access', included: true },
      { name: 'Business accounts', included: true },
      { name: 'Invoice management', included: true },
      { name: 'Tax reports', included: true },
      { name: 'API access', included: true },
      { name: 'Custom integrations', included: true },
      { name: 'Priority phone support', included: true },
      { name: 'Dedicated account manager', included: true },
    ]
  }
};

const resolvePlanKey = (value: unknown): PlanKey => {
  if (typeof value === 'string') {
    const match = PLAN_KEYS.find(plan => plan === value);
    if (match) {
      return match;
    }
  }
  return 'free';
};

export default function SubscriptionStatus(): React.JSX.Element {
  const {
    tier,
    subscription,
    isLoading
  } = useSubscription();

  // All hooks must be called before any conditional returns
  const logger = useMemo(() => createScopedLogger('SubscriptionStatus'), []);

  // These properties are not yet implemented in the context
  const billingCycle = subscription?.billingPeriod || 'monthly';
  const nextBillingDate = subscription?.currentPeriodEnd ? new Date(subscription.currentPeriodEnd) : null;
  const cancelAtPeriodEnd = subscription?.cancelAtPeriodEnd || false;
  const updateSubscription = async () => { /* Not yet implemented */ };
  const cancelSubscription = async () => { /* Not yet implemented */ };
  const reactivateSubscription = async () => { /* Not yet implemented */ };

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 animate-pulse">
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
      </div>
    );
  }

  const resolvedPlanKey = resolvePlanKey(tier);
  const currentPlan = PLAN_DETAILS[resolvedPlanKey];
  const Icon = currentPlan.icon;

  const handleUpgrade = async (_newTier: 'premium' | 'pro'): Promise<void> => {
    try {
      await updateSubscription();
    } catch (error) {
      logger.error('Failed to upgrade subscription', error);
    }
  };

  const handleCancel = async (): Promise<void> => {
    if (confirm('Are you sure you want to cancel your subscription? You will retain access until the end of your billing period.')) {
      try {
        await cancelSubscription();
      } catch (error) {
        logger.error('Failed to cancel subscription', error);
      }
    }
  };

  const handleReactivate = async (): Promise<void> => {
    try {
      await reactivateSubscription();
    } catch (error) {
      logger.error('Failed to reactivate subscription', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Current Plan Card */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
              Current Subscription
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Manage your subscription and billing
            </p>
          </div>
          <div className={`p-3 rounded-lg ${currentPlan.bgColor}`}>
            <Icon size={24} className={currentPlan.color} />
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">Plan</span>
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-900 dark:text-white">
                {currentPlan.name}
              </span>
              {currentPlan.badge && (
                <span className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full">
                  {currentPlan.badge}
                </span>
              )}
            </div>
          </div>

          {tier !== 'free' && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Billing</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {currentPlan.price} ({billingCycle})
                </span>
              </div>

              {nextBillingDate && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Next billing</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {formatDistanceToNow(new Date(nextBillingDate), { addSuffix: true })}
                  </span>
                </div>
              )}

              {/* ─ A NEXT ACTION, IN THE APP'S OWN YELLOW ────────────────────
                  This is Ruling A's own case: a condition, and exactly one
                  control that ends it. It was wearing hand-rolled `yellow-50`
                  with `yellow-600` text — off the palette (the app's amber is
                  amber, not yellow) and, measured, **2.84:1**, which fails
                  WCAG AA for text outright. So this was not a token tidy; the
                  sentence telling somebody their subscription is ending was
                  the least readable thing on the page.

                  `NEXT_ACTION_YELLOW` replaced it. Swapped in whole rather
                  than appended, per the constant's own constraint: Tailwind
                  resolves two utilities for one property by source order, so
                  mixing them leaves the winner to the compiler.

                  No ratio is quoted here on purpose. The two that used to be
                  had both drifted from the constant's own header, and one of
                  them was the wrong SURFACE besides — a dark figure measured
                  against the gray-900 page, quoted for a panel that sits on a
                  gray-800 card. Neither failed AA, which is precisely why
                  nobody noticed. `semantic-contrast.test.ts` measures every
                  pair on both surfaces now; read the number off that. */}
              {cancelAtPeriodEnd && (
                <div className={`p-3 rounded-lg border ${NEXT_ACTION_YELLOW}`}>
                  <div className="flex items-start gap-2">
                    <AlertCircleIcon size={16} className="mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm">
                        Your subscription will end {formatDistanceToNow(new Date(nextBillingDate!), { addSuffix: true })}
                      </p>
                      <button
                        onClick={handleReactivate}
                        className="mt-2 text-sm font-medium underline"
                      >
                        Reactivate subscription
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Plan Features */}
        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
            Your plan includes:
          </h4>
          <ul className="space-y-2">
            {currentPlan.features.filter(f => f.included).map((feature, index) => (
              <li key={index} className="flex items-start gap-2">
                <CheckIcon size={16} className="text-blue-600 dark:text-blue-400 mt-0.5" />
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {feature.name}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/*
          ─ ACTION BUTTONS, AND WHY THEY WRAP ──────────────────────────────
          `flex gap-3` with `flex-1` on the upgrades and no wrapping. At
          375px — the first card on the Settings page, so the first thing a
          phone user meets — three buttons divided one row between them and
          `flex-1` let each shrink BELOW its own text, so the labels spilled
          out of their borders and clipped at both edges: "Upgrade to
          Premium" rendered as "Upgrad / to / remiun". `flex-wrap` and
          content-width buttons instead: they sit in a row where there is
          room and stack where there is not, and a label can never be
          narrower than its own words.

          The purple went with it. `border-purple-600` and `bg-purple-600`
          were a fifth and sixth button style in a product that has four
          (P7: primary navy, secondary outline, quiet text, destructive),
          in a hue belonging to no token — the same purple that had just
          been removed from the gradient tile one card up. Upgrading is the
          primary action here and Pro is the secondary one, which is a
          hierarchy the four roles already express. Radius 6 via `rounded`,
          hairline borders, no shadows, per the shipped scale.
        */}
        <div className="mt-6 pt-6 border-t border-line dark:border-gray-700 flex flex-wrap gap-3">
          {tier === 'free' && (
            <>
              <button
                onClick={() => handleUpgrade('premium')}
                className="px-4 py-2 bg-primary text-white rounded hover:bg-secondary transition-colors duration-state"
              >
                Upgrade to Premium
              </button>
              <button
                onClick={() => handleUpgrade('pro')}
                className="px-4 py-2 border border-line-strong dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-surface-secondary dark:hover:bg-gray-700 transition-colors duration-state"
              >
                Upgrade to Pro
              </button>
            </>
          )}

          {tier === 'premium' && (
            <>
              <button
                onClick={() => handleUpgrade('pro')}
                className="px-4 py-2 bg-primary text-white rounded hover:bg-secondary transition-colors duration-state"
              >
                Upgrade to Pro
              </button>
              {!cancelAtPeriodEnd && (
                <button
                  onClick={handleCancel}
                  className="px-4 py-2 text-expense hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors duration-state"
                >
                  Cancel Subscription
                </button>
              )}
            </>
          )}

          {tier === 'pro' && !cancelAtPeriodEnd && (
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-expense hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors duration-state"
            >
              Cancel Subscription
            </button>
          )}

          <button
            onClick={() => window.open('/billing', '_blank')}
            className="px-4 py-2 border border-line-strong dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-surface-secondary dark:hover:bg-gray-700 transition-colors duration-state flex items-center gap-2"
          >
            <CreditCardIcon size={16} />
            Manage Billing
          </button>
        </div>
      </div>

      {/* The "Unlock Premium Features" block was here, and it is gone on the
          owner's ruling. Two reasons, and the second is the one that matters:
          it duplicated the Upgrade buttons six inches above it, and it
          advertised a BUSINESS tier at £24.99 "ideal for small businesses and
          freelancers" — a plan this product does not sell and is not built to
          be. Naming a price for something that does not exist is the same
          offence as a dead toggle, in a place where somebody might get out a
          card. */}
    </div>
  );
}
