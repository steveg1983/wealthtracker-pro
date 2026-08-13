import React, { useEffect } from 'react';
import { SignInButton, SignUpButton, useAuth } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { usePreferences } from '../contexts/PreferencesContext';
import { WalletIcon, TagIcon, PieChartIcon, UploadIcon, ArrowRightIcon } from '../components/icons';
import type { IconProps } from '../components/icons/IconBase';

// Plain statements of what the app does — no claims, no counts, no adjectives
// doing the work a screenshot should. Each maps to a real part of the product.
const FEATURES: ReadonlyArray<{ Icon: React.FC<IconProps>; title: string; body: string }> = [
  {
    Icon: WalletIcon,
    title: 'All your accounts in one place',
    body: 'Current accounts, savings, cards and investments, side by side.',
  },
  {
    Icon: TagIcon,
    title: 'Every transaction categorised',
    body: 'Sorted and searchable, so you can see where your money goes.',
  },
  {
    Icon: PieChartIcon,
    title: 'Reports that match reality',
    body: 'Net worth over time, and income and expenses by month.',
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
          Your money, all in one place
        </h1>

        <p className="mt-4 mx-auto max-w-2xl text-base sm:text-lg leading-relaxed text-white/75">
          Every account, every transaction and every report together — a modern take on
          Microsoft Money.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <SignUpButton mode="modal">
            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-white text-primary font-semibold shadow-sm hover:bg-white/90 transition-colors"
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
