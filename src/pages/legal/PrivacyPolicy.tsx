/**
 * The privacy policy — what Reckley does with a person's data, said plainly.
 *
 * Every statement here is checked against the code it describes: the
 * processors are the ones in api/ and src/services, the deletion steps are
 * api/account/delete.ts's, the retention is api/cron/retention.ts's, the
 * consent split is ConsentBanner's. When one of those changes, this page
 * changes with it, in the same pull request. The operator's identity comes
 * from legalIdentity.ts and is the owner's to fill in.
 *
 * Diagnostics consent can be changed HERE as well as at the banner: PECR
 * asks that withdrawing be as easy as giving, and the banner only ever asks
 * once. Switching diagnostics off reloads the page so the session recorder,
 * which only ever starts at boot, is not running afterwards.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { getConsent, setConsent, type ConsentLevel } from '../../utils/consent';
import { enableAnalyticsConsent } from '../../lib/sentry';
import LegalPage, { H2, H3, LI, P, UL } from './LegalPage';
import { OPERATOR, operatorLine } from './legalIdentity';

function DiagnosticsChoice(): React.JSX.Element {
  const [level, setLevel] = useState<ConsentLevel | null>(() => getConsent());
  const choose = (next: ConsentLevel): void => {
    setConsent(next);
    setLevel(next);
    if (next === 'all') {
      enableAnalyticsConsent();
    } else {
      // The recorder starts at boot and nowhere else; a reload is what stops it.
      window.location.reload();
    }
  };
  const current = level === 'all' ? 'diagnostics allowed' : level === 'essential' ? 'essential only' : 'not chosen yet';
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 mb-3">
      <p className={P}>Your current choice on this device: <strong>{current}</strong>.</p>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => choose('essential')}
          disabled={level === 'essential'}
          className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-900 dark:text-white disabled:opacity-50"
        >
          Essential only
        </button>
        <button
          type="button"
          onClick={() => choose('all')}
          disabled={level === 'all'}
          className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-900 dark:text-white disabled:opacity-50"
        >
          Allow diagnostics
        </button>
      </div>
    </div>
  );
}

export default function PrivacyPolicy(): React.JSX.Element {
  return (
    <LegalPage title="Privacy Policy" seeAlso={{ to: '/terms', label: 'Terms of Service' }}>
      <section>
        <h2 className={H2}>In short</h2>
        <ul className={UL}>
          <li className={LI}>Reckley holds the financial records you put in it, and uses them for one purpose: showing them back to you.</li>
          <li className={LI}>We do not sell your data, share it with advertisers, or use it to build a profile of you for anyone.</li>
          <li className={LI}>Your records live in a database in London, isolated from every other person’s by rules the database itself enforces.</li>
          <li className={LI}>Reckley never moves money. A bank connection is read-only, and a “transfer” in Reckley is bookkeeping between your own accounts.</li>
          <li className={LI}>You can export everything at any time, and delete everything at any time, from inside the app.</li>
        </ul>
      </section>

      <section>
        <h2 className={H2}>Who we are</h2>
        <p className={P}>
          Reckley is operated by {operatorLine()}, {OPERATOR.address}, United Kingdom. We are the
          data controller for the personal data this policy describes. Questions about your data,
          and requests to exercise your rights, go to {OPERATOR.contactEmail}. We answer within one
          month.
        </p>
        <p className={P}>
          This policy covers the Reckley web app, the Reckley iPhone app, and the Reckley connector
          for Claude. The desktop edition stores nothing with us and is governed by its own licence.
        </p>
      </section>

      <section>
        <h2 className={H2}>What we hold, and why</h2>

        <h3 className={H3}>Your sign-in</h3>
        <p className={P}>
          Your email address, your name if you give one, and how you sign in: a password, or Apple,
          Google or Microsoft sign-in. Our sign-in provider, Clerk, holds these so that only you can
          open your ledger. Basis: our contract with you.
        </p>

        <h3 className={H3}>Your financial records</h3>
        <p className={P}>
          Accounts, transactions, categories, budgets, goals, holdings and anything else you enter,
          import from a file, or bring in from a bank. This is the service, and it is yours: we read
          it only to show it to you, to compute the figures the app shows, and to keep it safe.
          Basis: our contract with you.
        </p>

        <h3 className={H3}>Bank connections, only if you connect one</h3>
        <p className={P}>
          If you connect a bank, you authorise it through TrueLayer, a UK open-banking provider
          regulated by the Financial Conduct Authority. What we then receive is the accounts you
          chose, their balances and their transactions, and nothing else: no ability to pay, move or
          withdraw money exists in that connection. The access token the bank issues is stored
          encrypted (AES-256-GCM) with a key that lives only on our servers. Your authorisation
          lasts ninety days, as open banking requires, and then asks to be renewed. You can
          disconnect a bank in the app at any time, and we tell TrueLayer to end the authorisation
          when you do, and again when you delete your account. Basis: our contract with you, on
          your explicit instruction.
        </p>

        <h3 className={H3}>Payments</h3>
        <p className={P}>
          Paid plans are billed by Stripe. Your card details go to Stripe and never to us; we hold
          your Stripe customer reference, which plan you are on and whether it is paid. Stripe
          keeps invoice records under its own legal obligations. Basis: our contract with you.
        </p>

        <h3 className={H3}>Notifications, only if you turn them on</h3>
        <p className={P}>
          If you allow notifications in the iPhone app, Apple gives the app a device token and we
          keep it so that we can tell that phone when something needs you, such as a bank
          connection that has stopped. When Apple reports a token dead, we retire it. Basis: your
          consent, which you withdraw by turning notifications off.
        </p>

        <h3 className={H3}>Market data</h3>
        <p className={P}>
          To price a holding, we send its ticker symbol to Twelve Data; to convert a currency, we
          ask Frankfurter, which publishes the European Central Bank’s rates. Neither request
          carries anything about you: a symbol or a pair of currency codes, nothing more. Basis:
          our legitimate interest in showing you current values.
        </p>

        <h3 className={H3}>Error reports</h3>
        <p className={P}>
          When something goes wrong, a report goes to Sentry so that we can fix it. Before it
          leaves your browser, every name, email address, account number, token and amount we can
          recognise is replaced with a placeholder, and the report names you only by an opaque
          identifier. Basis: our legitimate interest in keeping the app working. Optional
          <strong> session diagnostics</strong>, a masked recording of what the screen did before
          an error and timing information, run only if you choose “Allow diagnostics”, and you can
          change that choice below. Basis: your consent.
        </p>

        <h3 className={H3}>The audit trail</h3>
        <p className={P}>
          Every change to a financial record, what it was before and what it became, is written to
          an audit log. It is how a mistaken bulk edit is put back, and it is the record-keeping a
          financial tool owes you. It is kept for six years and then purged automatically; it is
          deleted at once if you delete your account. Basis: our legitimate interest, and yours, in
          a ledger that can be put right.
        </p>

        <h3 className={H3}>The Claude connector, only if you connect it</h3>
        <p className={P}>
          You can let Claude, Anthropic’s assistant, read your Reckley ledger, and, with the
          Complete Access connection, make the kinds of change you could make yourself: file a
          category, confirm one, mark a row cleared, link a transfer, add a transaction. Nothing it
          can do moves money or deletes a record. The connection is made through our sign-in
          provider with a token that carries only the permission you granted, and you end it at any
          time in Claude’s own settings. What Claude reads is then held by Anthropic under
          Anthropic’s terms and privacy policy, which are theirs, not ours. A record Claude changes
          is stamped so that you can see it was Claude, and a category it files is marked as a
          suggestion for you to confirm. Basis: your consent.
        </p>
      </section>

      <section>
        <h2 className={H2}>Where your data lives, and who handles it for us</h2>
        <p className={P}>
          Your records are held by Supabase in a database in London (the United Kingdom), with
          encrypted backups kept for seven days. The app itself is served by Vercel. The following
          providers process data on our behalf, each under a contract that limits what they may do
          with it:
        </p>
        <ul className={UL}>
          <li className={LI}><strong>Supabase</strong>, database and backups, London.</li>
          <li className={LI}><strong>Clerk</strong>, sign-in and the tokens behind it.</li>
          <li className={LI}><strong>Vercel</strong>, hosting of the app and its server functions.</li>
          <li className={LI}><strong>Stripe</strong>, payments.</li>
          <li className={LI}><strong>TrueLayer</strong>, bank connections, United Kingdom, only if you connect a bank.</li>
          <li className={LI}><strong>Sentry</strong>, error reports with personal data removed, and session diagnostics only with your consent.</li>
          <li className={LI}><strong>Apple</strong>, notification delivery, only if you turn notifications on.</li>
          <li className={LI}><strong>Twelve Data</strong> and <strong>Frankfurter</strong>, prices and exchange rates, receiving no personal data.</li>
          <li className={LI}><strong>Anthropic</strong>, only if you connect Claude, and only what Claude reads at your request.</li>
        </ul>
        <p className={P}>
          Some of these providers operate in the United States. Where data leaves the United
          Kingdom, it does so under the UK’s International Data Transfer Agreement or Addendum, the
          safeguards UK law provides for such transfers.
        </p>
      </section>

      <section>
        <h2 className={H2}>Data on your own device</h2>
        <p className={P}>
          The app keeps a working copy of your records in your browser or phone so that it opens
          quickly and works offline. That copy is encrypted at rest. If you export an encrypted
          backup, it is sealed with a passphrase only you hold (PBKDF2 and AES-GCM); we cannot open
          it, and neither can anyone who finds the file without the passphrase.
        </p>
      </section>

      <section>
        <h2 className={H2}>Your rights</h2>
        <ul className={UL}>
          <li className={LI}><strong>See and take your data.</strong> Export your records at any time from the Export page, as CSV, PDF, a plain backup, or an encrypted backup. That export is also your subject access request, answered instantly.</li>
          <li className={LI}><strong>Correct it.</strong> Every record is editable in the app, and every edit is logged.</li>
          <li className={LI}><strong>Delete it.</strong> Settings → Security → Danger zone deletes your account. In order: your Stripe customer is closed so billing stops, every bank authorisation is ended at the provider, every row you own is removed from the database together with the audit log, and your sign-in is deleted. It is immediate and cannot be undone. Deleted data persists in the seven-day database backups until they roll off.</li>
          <li className={LI}><strong>Object, restrict, or withdraw consent.</strong> Write to {OPERATOR.contactEmail}; for diagnostics, use the choice below; for notifications, turn them off on the phone; for Claude, disconnect it in Claude.</li>
          <li className={LI}><strong>Complain.</strong> You may complain to the Information Commissioner’s Office at ico.org.uk. We would rather hear from you first.</li>
        </ul>
      </section>

      <section>
        <h2 className={H2}>How long we keep things</h2>
        <p className={P}>
          Your records, for as long as your account exists. The audit log, six years, purged weekly
          past that. A retired notification token, until Apple reports it dead. Stripe’s invoice
          records, for as long as Stripe is required to keep them. Everything we hold, gone when you
          delete your account, subject to the seven-day backups above.
        </p>
      </section>

      <section>
        <h2 className={H2}>Cookies and diagnostics</h2>
        <p className={P}>
          Strictly necessary cookies keep you signed in and protect the app from cross-site
          requests; they need no consent and we set nothing else. There is no advertising, no
          tracking across other sites, and no analytics beyond the optional diagnostics described
          above, which you choose once at the banner and can change here:
        </p>
        <DiagnosticsChoice />
      </section>

      <section>
        <h2 className={H2}>Security</h2>
        <p className={P}>
          Every connection is encrypted in transit. Your rows are isolated from everyone else’s by
          row-level security in the database, enforced by the database rather than by the app.
          Bank tokens are encrypted at rest with a key held only on the server. Card details never
          reach us. The keys that could read every ledger are held only by our servers and never
          shipped to a browser.
        </p>
      </section>

      <section>
        <h2 className={H2}>Children</h2>
        <p className={P}>Reckley is for adults. You must be eighteen or over to open an account.</p>
      </section>

      <section>
        <h2 className={H2}>Changes</h2>
        <p className={P}>
          When this policy changes in substance, the date at the top changes with it, and we tell
          you in the app before the change applies. The current version is always at this address.
        </p>
      </section>

      <p className="text-sm text-gray-500 dark:text-gray-400 mt-8">
        Support: {OPERATOR.supportEmail}. The <Link to="/terms" className="underline">Terms of Service</Link> say what we owe each other.
      </p>
    </LegalPage>
  );
}
