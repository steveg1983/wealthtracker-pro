import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { Skeleton } from '../loading/Skeleton';
import type { SubscriptionPlan, SubscriptionStatus } from '../../types/subscription';

/**
 * Blocks a route unless the signed-in user holds a paid tier.
 *
 * Deliberately a separate component from ProtectedRoute so that the ~40 routes
 * which only need authentication never subscribe to subscription state — they
 * neither re-render on it nor require SubscriptionProvider to be mounted above
 * them.
 *
 * This is a UI paywall. The API performs no entitlement checks of its own, so
 * it keeps honest users on the plan they bought; it is not a security
 * boundary, and must not be treated as one.
 */

const isPaidTier = (tier: SubscriptionPlan): boolean => tier === 'premium' || tier === 'pro';

/**
 * Mirrors api/subscriptions/status.ts, which treats active/trialing/past_due as
 * still entitling. An absent or unrecognised status counts as entitling: the
 * tier is the primary signal, and a shape change in the subscriptions row must
 * never lock a paying user out of what they have already paid for.
 */
const statusEntitles = (status: SubscriptionStatus | undefined): boolean =>
  status !== 'cancelled' && status !== 'inactive';

export function PremiumGate({ children }: { children: ReactNode }): React.JSX.Element {
  const { subscription, tier, isLoading } = useSubscription();

  if (isLoading) {
    return (
      <div className="p-6" aria-busy="true">
        <Skeleton className="w-64 h-8 mb-4" />
        <Skeleton className="w-full h-40" />
      </div>
    );
  }

  if (isPaidTier(tier) && statusEntitles(subscription?.status)) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-8">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          A Premium feature
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          This page is part of the Premium and Pro plans. Your other accounts,
          transactions and reports are unaffected.
        </p>
        <Link
          to="/subscription"
          className="inline-block px-4 py-2 bg-[#1a2332] text-white rounded-lg hover:bg-[#2d3a4d] transition-colors text-sm"
        >
          See plans
        </Link>
      </div>
    </div>
  );
}

export default PremiumGate;
