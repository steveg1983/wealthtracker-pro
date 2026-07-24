import React from "react";
import {
  SignedIn,
  SignedOut,
  SignInButton,
  SignUpButton,
  UserButton,
} from "@clerk/clerk-react";
import { WalletIcon } from "../icons";

// The /login surface renders outside the app Layout, so it carries its own
// full-height background — kept to the app's surface colours, not a gradient.
//
// NB: the app locks `.text-primary`/`.bg-primary` with `!important`, so a
// `dark:` variant on those never wins. Slate elements that must flip for dark
// mode use neutral gray tokens (which aren't locked) rather than the primary
// token; the always-slate hero panel keeps `bg-primary` since it never flips.
export default function SimpleSignIn(): React.JSX.Element {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-secondary dark:bg-gray-900 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-lg p-8">
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 text-gray-900 dark:text-white">
            <WalletIcon size={22} />
            <span className="text-lg font-bold tracking-tight">WealthTracker</span>
          </div>
          <h1 className="mt-4 text-2xl font-bold text-gray-900 dark:text-white">Sign in</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Your accounts, transactions and reports, all in one place.
          </p>
        </div>

        <SignedOut>
          <div className="mt-6 space-y-3">
            <SignInButton mode="modal">
              <button
                type="button"
                className="w-full justify-center py-3 px-4 rounded-xl border border-transparent dark:border-white/20 bg-primary text-white font-semibold hover:bg-secondary transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-800"
              >
                Sign in
              </button>
            </SignInButton>

            <SignUpButton mode="modal">
              <button
                type="button"
                className="w-full justify-center py-3 px-4 rounded-xl border border-primary/20 dark:border-gray-600 text-gray-900 dark:text-white font-semibold hover:bg-surface-secondary dark:hover:bg-gray-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-800"
              >
                Create account
              </button>
            </SignUpButton>

            {/* Privacy notice at the point of collection (GDPR Art. 13) */}
            <p className="text-xs text-center text-gray-500 dark:text-gray-400 pt-2">
              By creating an account you agree to our{' '}
              <a href="/terms" className="underline hover:text-gray-700 dark:hover:text-gray-200">Terms</a>
              {' '}and{' '}
              <a href="/privacy" className="underline hover:text-gray-700 dark:hover:text-gray-200">Privacy Policy</a>.
            </p>
          </div>
        </SignedOut>

        <SignedIn>
          <div className="mt-6 text-center space-y-4">
            <p className="text-gray-600 dark:text-gray-400">You&apos;re signed in.</p>
            <div className="flex justify-center">
              <UserButton afterSignOutUrl="/" />
            </div>
            <a
              href="/dashboard"
              className="block w-full py-3 px-4 rounded-xl border border-transparent dark:border-white/20 bg-primary text-white font-semibold hover:bg-secondary transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-800"
            >
              Go to Dashboard
            </a>
          </div>
        </SignedIn>
      </div>
    </div>
  );
}
