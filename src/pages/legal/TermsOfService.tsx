/**
 * Terms of service page.
 *
 * ⚠️ TEMPLATE CONTENT pending legal review — see the banner in the page.
 */

import { Link } from 'react-router-dom';

const H2 = 'text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-3';
const P = 'text-gray-700 dark:text-gray-300 mb-3 leading-relaxed';

export default function TermsOfService(): React.JSX.Element {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <Link to="/" className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
          ← Back to WealthTracker
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mt-4 mb-2">Terms of Service</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">Last updated: 11 June 2026</p>

        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-lg p-4 mb-8">
          <p className="text-sm text-yellow-900 dark:text-yellow-200 font-medium">
            DRAFT — these terms are a template pending legal review. Do not rely on
            them until this notice is removed.
          </p>
        </div>

        <h2 className={H2}>The service</h2>
        <p className={P}>
          WealthTracker provides personal finance tracking tools: account and
          transaction management, budgeting, goals, reporting, and optional
          open-banking imports. It is an information tool, not financial advice.
        </p>

        <h2 className={H2}>Your account</h2>
        <p className={P}>
          You are responsible for keeping your sign-in credentials secure and for
          the accuracy of data you enter. You may close your account at any time
          from Settings → Security; closure permanently deletes your data.
        </p>

        <h2 className={H2}>Subscriptions</h2>
        <p className={P}>
          Paid plans are billed through Stripe on a recurring basis until
          cancelled. You can cancel any time from the billing page; access
          continues until the end of the paid period.
        </p>

        <h2 className={H2}>Acceptable use</h2>
        <p className={P}>
          Do not attempt to access other users’ data, probe or disrupt the
          service, or use it for unlawful purposes.
        </p>

        <h2 className={H2}>Liability</h2>
        <p className={P}>
          [LIABILITY AND WARRANTY WORDING — REQUIRES LEGAL DRAFTING.]
        </p>

        <p className="text-sm text-gray-500 dark:text-gray-400 mt-12">
          See also our <Link to="/privacy" className="underline">Privacy Policy</Link>.
        </p>
      </div>
    </div>
  );
}
