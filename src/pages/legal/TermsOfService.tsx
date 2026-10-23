/**
 * The terms of service — what Reckley and the person owe each other.
 *
 * Written to describe the service as it is: the three plans and their
 * prices come from services/stripeService's catalogue, the bank-connection
 * terms from what TrueLayer's read-only consent allows, the connector terms
 * from docs/mcp-connector.md. The liability section is written to stand up
 * under UK consumer law (nothing excludes what cannot be excluded), and it
 * is the section a solicitor should read first. The operator's identity
 * comes from legalIdentity.ts.
 */

import { Link } from 'react-router-dom';
import LegalPage, { H2, LI, P, UL } from './LegalPage';
import { OPERATOR, operatorLine } from './legalIdentity';

export default function TermsOfService(): React.JSX.Element {
  return (
    <LegalPage title="Terms of Service" seeAlso={{ to: '/privacy', label: 'Privacy Policy' }}>
      <section>
        <h2 className={H2}>Who these terms are between</h2>
        <p className={P}>
          Reckley is provided by {operatorLine()}, {OPERATOR.address}, United Kingdom (“we”). By
          creating an account you agree to these terms. If you do not agree, do not use the
          service. You must be eighteen or over.
        </p>
      </section>

      <section>
        <h2 className={H2}>What Reckley is, and is not</h2>
        <p className={P}>
          Reckley is a personal finance ledger: a place to record your accounts, transactions,
          budgets, goals and holdings, to bring transactions in from files and from bank
          connections, and to see reports built from them. It is a tool for keeping your own
          records.
        </p>
        <p className={P}>
          It is not financial advice, and we are not a financial adviser, a bank, or a payment
          service. Nothing the app shows is a recommendation to buy, sell, borrow or hold anything.
          The figures it shows are computed from the records you keep, and they are only as right
          as those records. Decisions about your money are yours.
        </p>
        <p className={P}>
          Reckley never moves money. A bank connection is read-only, and a “transfer” in Reckley is
          a record of money moving between your own accounts, not the movement itself.
        </p>
      </section>

      <section>
        <h2 className={H2}>Your account</h2>
        <ul className={UL}>
          <li className={LI}>Keep your sign-in to yourself. Anything done through your account is treated as done by you until you tell us otherwise.</li>
          <li className={LI}>Give us an email address we can reach you at. We use it for your account and for notices about the service, not for marketing you did not ask for.</li>
          <li className={LI}>You may close your account at any time from Settings → Security. Closing it deletes your data, as the <Link to="/privacy" className="underline">Privacy Policy</Link> describes, and cannot be undone.</li>
        </ul>
      </section>

      <section>
        <h2 className={H2}>Plans and payment</h2>
        <p className={P}>
          The Free plan costs nothing and has limits on the number of accounts, transactions,
          budgets and goals. Premium is £7.99 a month and Pro is £15.99 a month, each billed
          monthly in advance by Stripe until you cancel. Prices include VAT where it applies.
        </p>
        <ul className={UL}>
          <li className={LI}>You can cancel at any time from the billing page. Access to the paid features continues to the end of the period you have paid for, and no further payment is taken.</li>
          <li className={LI}>Under the Consumer Contracts Regulations you have fourteen days from first subscribing to change your mind and receive a full refund, unless you have used the paid features in that time, in which case we may deduct a proportionate amount.</li>
          <li className={LI}>If we change a price, we tell you at least thirty days before it applies to you, and you may cancel before it does.</li>
          <li className={LI}>If a payment fails, we tell you and retry; if it keeps failing, your account returns to the Free plan and your data stays where it is.</li>
        </ul>
        <p className={P}>
          The desktop edition is sold separately, once, under its own licence, and is not a
          subscription.
        </p>
      </section>

      <section>
        <h2 className={H2}>Bank connections</h2>
        <p className={P}>
          When you connect a bank you do so through TrueLayer, an open-banking provider regulated by
          the Financial Conduct Authority, and you agree to TrueLayer’s terms for that connection.
          You authorise read-only access to the accounts you choose; nothing in the connection can
          pay, move or withdraw money. The authorisation lasts ninety days, after which the app asks
          you to renew it. Banks sometimes change, delay or withhold what they send; we show what we
          receive, and the register you keep remains the record.
        </p>
      </section>

      <section>
        <h2 className={H2}>Your data</h2>
        <p className={P}>
          Everything you record in Reckley is yours. You give us only the permission we need to
          store it, show it to you, compute the figures you ask for, and keep it safe. You can
          export it at any time, and you can delete it at any time. How we handle it is set out in
          the <Link to="/privacy" className="underline">Privacy Policy</Link>, which is part of
          these terms.
        </p>
      </section>

      <section>
        <h2 className={H2}>The Claude connector</h2>
        <p className={P}>
          If you connect Claude to Reckley, you are instructing Claude, and Claude’s actions in your
          ledger are yours. With the read-only connection Claude can see your records; with Complete
          Access it can also make the kinds of change you could make yourself, each one asked of
          you first by Claude and each one recorded. It cannot move money or delete anything. Your
          use of Claude is under Anthropic’s terms; what Claude says about your money is Claude’s,
          not ours, and is not financial advice. You can disconnect Claude at any time in Claude’s
          own settings.
        </p>
      </section>

      <section>
        <h2 className={H2}>Acceptable use</h2>
        <ul className={UL}>
          <li className={LI}>Do not try to reach anyone else’s data, probe or overload the service, or interfere with how it works.</li>
          <li className={LI}>Do not use Reckley for anything unlawful, or to hold records you have no right to hold.</li>
          <li className={LI}>Do not resell access to the service or let others use your account.</li>
        </ul>
        <p className={P}>We may suspend or close an account that breaks these rules, with notice where we can give it.</p>
      </section>

      <section>
        <h2 className={H2}>Availability and changes</h2>
        <p className={P}>
          We work to keep Reckley available and will tell you about planned maintenance where we
          can, but we do not promise that it will never be unavailable. We improve the service
          continually and may add, change or withdraw features; if a change takes away something
          you have paid for, you may cancel and we refund the unused part of the period.
        </p>
      </section>

      <section>
        <h2 className={H2}>Our responsibility to you</h2>
        <p className={P}>
          Nothing in these terms limits or excludes our liability for death or personal injury
          caused by our negligence, for fraud, or for anything else the law does not allow us to
          limit or exclude. Your rights as a consumer under UK law are not affected.
        </p>
        <p className={P}>
          Subject to that, because Reckley is a record-keeping tool whose figures depend on the
          records you keep, we are not responsible for losses that come from relying on those
          figures for a decision about your money, from records that were wrong or incomplete, from
          what a bank did or did not send, or from what Claude said. We are not responsible for
          losses we could not reasonably have foreseen when you agreed to these terms, or for
          business losses, since Reckley is for personal use. Where we are responsible, our
          liability to you in any twelve-month period is limited to what you paid us in that
          period, or £100 if you paid nothing.
        </p>
      </section>

      <section>
        <h2 className={H2}>Ending things</h2>
        <p className={P}>
          You may close your account at any time. We may close it if you break these terms, or if
          we stop providing the service, in which case we give you at least thirty days’ notice and
          the chance to export everything first.
        </p>
      </section>

      <section>
        <h2 className={H2}>The law that applies</h2>
        <p className={P}>
          These terms are governed by the law of England and Wales, and the courts of England and
          Wales have jurisdiction, except that if you live in Scotland or Northern Ireland you may
          bring a claim in your own courts. If any part of these terms is found not to be
          enforceable, the rest still applies.
        </p>
      </section>

      <section>
        <h2 className={H2}>Changes to these terms</h2>
        <p className={P}>
          When these terms change in substance, the date at the top changes with them, and we tell
          you in the app before the change applies. Continuing to use Reckley after that is
          agreement to the new terms; if you do not agree, close your account before they apply.
        </p>
      </section>

      <p className="text-sm text-gray-500 dark:text-gray-400 mt-8">
        Questions: {OPERATOR.supportEmail}.
      </p>
    </LegalPage>
  );
}
