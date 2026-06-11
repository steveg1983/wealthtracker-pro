/**
 * Privacy policy page.
 *
 * ⚠️ TEMPLATE CONTENT: the structure and processing descriptions below match
 * what the codebase actually does (verified in AUDIT_2026-06-11_PRIVACY_GDPR),
 * but this text MUST be reviewed by a qualified solicitor before public
 * launch, and the contact details/company identity filled in.
 */

import { Link } from 'react-router-dom';

const SECTION = 'mb-8';
const H2 = 'text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-3';
const P = 'text-gray-700 dark:text-gray-300 mb-3 leading-relaxed';
const LI = 'text-gray-700 dark:text-gray-300 mb-1';

export default function PrivacyPolicy(): React.JSX.Element {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <Link to="/" className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
          ← Back to WealthTracker
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mt-4 mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">Last updated: 11 June 2026</p>

        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-lg p-4 mb-8">
          <p className="text-sm text-yellow-900 dark:text-yellow-200 font-medium">
            DRAFT — this policy is a technically-accurate template pending legal review.
            Do not rely on it until this notice is removed.
          </p>
        </div>

        <section className={SECTION}>
          <h2 className={H2}>Who we are</h2>
          <p className={P}>
            WealthTracker is a personal finance application operated from the United
            Kingdom. We are the data controller for the personal data described in
            this policy. Contact: [CONTACT EMAIL — TO BE COMPLETED].
          </p>
        </section>

        <section className={SECTION}>
          <h2 className={H2}>What we collect and why</h2>
          <ul className="list-disc pl-6 mb-3">
            <li className={LI}><strong>Account data</strong> (email, name) — to create and secure your sign-in. Legal basis: contract.</li>
            <li className={LI}><strong>Financial data you enter or import</strong> (accounts, transactions, budgets, goals, documents) — the service itself. Legal basis: contract.</li>
            <li className={LI}><strong>Bank connection data</strong> (via TrueLayer open banking, only if you connect a bank) — to import your transactions. Legal basis: contract; access tokens are stored encrypted.</li>
            <li className={LI}><strong>Payment data</strong> — handled by Stripe; we never see or store your card number. Legal basis: contract.</li>
            <li className={LI}><strong>Error diagnostics</strong> — crash reports with personal data removed before sending. Legal basis: legitimate interest. Optional session-diagnostics (replay) run only with your consent.</li>
          </ul>
        </section>

        <section className={SECTION}>
          <h2 className={H2}>Who processes data on our behalf</h2>
          <ul className="list-disc pl-6 mb-3">
            <li className={LI}><strong>Clerk</strong> — authentication and sign-in.</li>
            <li className={LI}><strong>Supabase</strong> — database hosting; your records are isolated per user.</li>
            <li className={LI}><strong>Stripe</strong> — subscription payments.</li>
            <li className={LI}><strong>Sentry</strong> — error monitoring (personal data scrubbed; session replay only with consent).</li>
            <li className={LI}><strong>Vercel</strong> — application hosting.</li>
            <li className={LI}><strong>TrueLayer</strong> — open-banking connections (only if you link a bank).</li>
          </ul>
        </section>

        <section className={SECTION}>
          <h2 className={H2}>Your rights</h2>
          <ul className="list-disc pl-6 mb-3">
            <li className={LI}><strong>Access &amp; portability</strong> — export your data any time from Settings → Export (CSV, Excel, JSON).</li>
            <li className={LI}><strong>Rectification</strong> — edit any record directly in the app.</li>
            <li className={LI}><strong>Erasure</strong> — delete your account and all data from Settings → Security → Danger zone. Deletion is immediate and permanent.</li>
            <li className={LI}><strong>Complaints</strong> — you may complain to the ICO (ico.org.uk).</li>
          </ul>
        </section>

        <section className={SECTION}>
          <h2 className={H2}>Retention</h2>
          <p className={P}>
            Your data is kept while your account is active. When you delete your
            account, your records are removed immediately. Financial-operation audit
            records are retained for up to six years to meet record-keeping
            obligations, then purged automatically. Stripe retains invoice records
            under its own legal obligations.
          </p>
        </section>

        <section className={SECTION}>
          <h2 className={H2}>Cookies</h2>
          <p className={P}>
            Strictly necessary cookies keep you signed in. Optional diagnostics
            (Sentry session replay) run only after you choose “Accept all” on the
            consent banner; you can choose “Essential only” with one click.
          </p>
        </section>

        <p className="text-sm text-gray-500 dark:text-gray-400 mt-12">
          See also our <Link to="/terms" className="underline">Terms of Service</Link>.
        </p>
      </div>
    </div>
  );
}
