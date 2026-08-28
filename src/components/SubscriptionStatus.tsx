/**
 * The Settings → General signpost to Subscription. A SIGNPOST, not a second
 * copy of the page.
 *
 * It used to state the plan itself, from its own code path (the
 * SubscriptionContext's direct Supabase read) beside the Subscription
 * page's own (the /api/subscriptions/status endpoint). Two paths, two
 * answers: the owner is Pro, the page said Pro, and this card said Free —
 * which is the confusion he reported on 28 Aug ("we have it in 2 areas…
 * a bit confusing for the user"), on top of a plan list that still offered
 * a 'business' tier this app has not sold for months.
 *
 * So it names no plan. There is ONE place that answers "what am I on", and
 * this is the door to it — which is also the answer to the duplication:
 * delete the claim, keep the way there.
 *
 * The seam still decides whether it renders at all: a device window has no
 * subscription to have (editions/service.ts).
 */
import { Link } from 'react-router-dom';
import { CreditCardIcon, ChevronRightIcon } from './icons';

export default function SubscriptionStatus(): React.JSX.Element {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-line dark:border-gray-700">
      <Link
        to="/settings/subscription"
        className="flex items-center gap-4 p-6 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors rounded-lg"
      >
        <span className="shrink-0 grid place-items-center h-10 w-10 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
          <CreditCardIcon size={20} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-card font-semibold text-theme-heading dark:text-white">
            Subscription
          </span>
          <span className="block text-body text-gray-500 dark:text-gray-400">
            Your plan, what it includes, and your billing.
          </span>
        </span>
        <ChevronRightIcon size={18} className="shrink-0 text-gray-400" aria-hidden="true" />
      </Link>
    </div>
  );
}
