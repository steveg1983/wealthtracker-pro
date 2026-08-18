import React, { useEffect } from 'react';
import { SignInButton, SignUpButton, useAuth } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { usePreferences } from '../contexts/PreferencesContext';
import { WalletIcon, TagIcon, PieChartIcon, UploadIcon, ArrowRightIcon } from '../components/icons';
import type { IconProps } from '../components/icons/IconBase';

// THE ETHOS, not the aggregator's pitch (Design handover, 17 Aug; owner
// approved the copy). "All in one place" was close to verbatim what the
// aggregators lead with — competing on their strongest ground with none of
// their plumbing — and it undersold the one capability nobody else has:
// every figure here traces to a line you entered and reconciled. The claim
// no report can leave out leads, because it is the most unusual one in the
// market.
const FEATURES: ReadonlyArray<{ Icon: React.FC<IconProps>; title: string; body: string }> = [
  {
    Icon: PieChartIcon,
    title: 'Every report says what it leaves out',
    body: 'Uncategorised rows, excluded currencies, the rate used and when — stated on the page, never buried.',
  },
  {
    Icon: WalletIcon,
    title: 'Everything counts, not just what a bank will tell you',
    body: 'The house, the pension, the loan to your brother. An API can only see accounts a bank chose to expose.',
  },
  {
    Icon: TagIcon,
    title: 'You decide what everything is',
    body: 'No machine quietly filing your mortgage under shopping — and no way for that to go unnoticed.',
  },
  {
    Icon: UploadIcon,
    title: 'Bring your history with you',
    body: 'Import from Microsoft Money, CSV, QIF and OFX, or connect a bank feed.',
  },
];

export default function Welcome(): React.JSX.Element {
  const { isSignedIn } = useAuth();
  const { firstName } = usePreferences();
  const navigate = useNavigate();

  // Signed-in visitors have no business on the landing page — send them home.
  useEffect(() => {
    if (isSignedIn) {
      navigate('/dashboard');
    }
  }, [isSignedIn, navigate]);

  // Brief interstitial while the redirect above runs.
  if (isSignedIn) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Welcome back{firstName ? `, ${firstName}` : ''}
        </h1>
        <p className="mt-2 text-gray-500 dark:text-gray-400">Taking you to your dashboard…</p>
      </div>
    );
  }

  const year = new Date().getFullYear();

  return (
    <div className="mx-auto max-w-5xl py-2 md:py-6">
      {/* Hero — the app's own dark slate, so the landing page and the product
          read as one thing. */}
      <section
        aria-labelledby="welcome-heading"
        className="focus-ring-on-dark rounded-2xl bg-primary px-6 py-12 sm:px-10 sm:py-14 text-center shadow-lg"
      >
        <div className="flex items-center justify-center gap-2 text-white/70">
          <WalletIcon size={20} />
          <span className="text-sm font-semibold uppercase tracking-wider">WealthTracker</span>
        </div>

        <h1
          id="welcome-heading"
          className="mt-5 text-3xl sm:text-4xl md:text-5xl font-bold text-white"
        >
          Other apps show you a number.
          <br />
          WealthTracker lets you prove it.
        </h1>

        <p className="mt-4 mx-auto max-w-2xl text-base sm:text-lg leading-relaxed text-white/75">
          Every figure traces back to a line you entered, categorised and reconciled
          against your own statements. Nothing is guessed. Import twenty years of
          Microsoft Money and carry on.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <SignUpButton mode="modal">
            <button
              type="button"
              /* `text-nav-bg`, NOT `text-primary` — and the difference is the
                 whole bug. `.dark .text-primary` is `#f9fafb !important`,
                 added so the app's primary ink stays readable on dark
                 SURFACES. This button's surface is not dark: it is `bg-white`
                 in both modes, deliberately, because it is the one loud thing
                 on a navy hero. So in dark mode the remap painted near-white
                 text on a white button and the label vanished.

                 A utility that means "the app's ink, inverted for dark" cannot
                 serve an element whose own background does not invert. Both
                 resolve to #1a2332 in light, which is why this looked
                 identical until someone opened the sign-in page in dark. */
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-white text-nav-bg font-semibold shadow-sm hover:bg-white/90 transition-colors"
            >
              Get started
              <ArrowRightIcon size={18} />
            </button>
          </SignUpButton>
          <SignInButton mode="modal">
            <button
              type="button"
              className="inline-flex items-center justify-center px-6 py-3 rounded-xl border border-white/25 text-white font-semibold hover:bg-white/10 transition-colors"
            >
              Sign in
            </button>
          </SignInButton>
        </div>
      </section>

      {/* What it does — four plain points, matching the app's card idiom. */}
      <section aria-label="What WealthTracker does" className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map(({ Icon, title, body }) => (
          <div
            key={title}
            className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm p-5"
          >
            {/* Neutral gray, not `text-primary` — the app locks `.text-primary`
                with `!important`, which would pin the icon to slate on the dark
                card and swallow it. Gray tokens flip cleanly for dark mode. */}
            <Icon size={22} className="text-gray-800 dark:text-gray-300" />
            <h2 className="mt-3 text-sm font-semibold text-gray-900 dark:text-white">{title}</h2>
            <p className="mt-1 text-sm leading-relaxed text-gray-500 dark:text-gray-400">{body}</p>
          </div>
        ))}
      </section>

      <footer className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400">
        <p>© {year} WealthTracker</p>
        <nav aria-label="Legal" className="flex gap-4">
          <a href="/privacy" className="underline-offset-2 hover:underline hover:text-gray-700 dark:hover:text-gray-200">
            Privacy
          </a>
          <a href="/terms" className="underline-offset-2 hover:underline hover:text-gray-700 dark:hover:text-gray-200">
            Terms
          </a>
        </nav>
      </footer>
    </div>
  );
}
