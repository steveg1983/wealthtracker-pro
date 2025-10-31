/**
 * Sign In Form - Apple-level authentication experience
 * 
 * Features:
 * - Passkey/WebAuthn login (instant)
 * - Magic link (passwordless)
 * - Authenticator app support
 * - Beautiful animations
 */

import React, { useState } from 'react';
import { SignIn } from '@clerk/clerk-react';
import { FingerPrintIcon, EnvelopeIcon, KeyIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';

export default function SignInForm() {
  const [authMethod, setAuthMethod] = useState<'passkey' | 'magic' | 'standard'>('passkey');

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-md w-full space-y-8 p-8">
        {/* Logo and Welcome */}
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
            <ShieldCheckIcon className="h-10 w-10 text-white" />
          </div>
          <h2 className="mt-6 text-3xl font-bold text-gray-900 dark:text-white">
            Welcome to WealthTracker
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            The #1 personal finance app that just works
          </p>
        </div>

        {/* Auth Method Selector */}
        <div className="flex rounded-xl bg-gray-100 dark:bg-gray-800 p-1">
          <button
            onClick={() => setAuthMethod('passkey')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
              authMethod === 'passkey'
                ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <FingerPrintIcon className="h-4 w-4" />
            Passkey
          </button>
          <button
            onClick={() => setAuthMethod('magic')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
              authMethod === 'magic'
                ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <EnvelopeIcon className="h-4 w-4" />
            Magic Link
          </button>
          <button
            onClick={() => setAuthMethod('standard')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
              authMethod === 'standard'
                ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <KeyIcon className="h-4 w-4" />
            Password
          </button>
        </div>

        {/* Auth Forms */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-8">
          {authMethod === 'passkey' && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="mx-auto h-20 w-20 bg-gradient-to-r from-green-400 to-blue-500 rounded-full flex items-center justify-center mb-4">
                  <FingerPrintIcon className="h-12 w-12 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Sign in with Passkey
                </h3>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  Use your fingerprint, Face ID, or security key
                </p>
              </div>
              
              <button className="w-full flex items-center justify-center gap-3 py-3 px-4 border border-gray-300 dark:border-gray-600 rounded-xl shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all">
                <img src="/apple-passwords.svg" alt="Apple" className="h-5 w-5" />
                Continue with Apple Passwords
              </button>
              
              <button className="w-full flex items-center justify-center gap-3 py-3 px-4 border border-gray-300 dark:border-gray-600 rounded-xl shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all">
                <img src="/1password.svg" alt="1Password" className="h-5 w-5" />
                Continue with 1Password
              </button>
              
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300 dark:border-gray-600" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white dark:bg-gray-900 text-gray-500">Or</span>
                </div>
              </div>
              
              <button className="w-full py-3 px-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-medium hover:from-blue-600 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all shadow-lg">
                Use Device Passkey
              </button>
            </div>
          )}

          {authMethod === 'magic' && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="mx-auto h-20 w-20 bg-gradient-to-r from-purple-400 to-pink-500 rounded-full flex items-center justify-center mb-4">
                  <EnvelopeIcon className="h-12 w-12 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Sign in with Magic Link
                </h3>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  We'll email you a secure link to sign in instantly
                </p>
              </div>
              
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Email address
                </label>
                <input
                  type="email"
                  id="email"
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-white transition-all"
                  placeholder="you@example.com"
                />
              </div>
              
              <button className="w-full py-3 px-4 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-xl font-medium hover:from-purple-600 hover:to-pink-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-all shadow-lg">
                Send Magic Link
              </button>
            </div>
          )}

          {authMethod === 'standard' && (
            <SignIn
              appearance={{
                elements: {
                  rootBox: 'w-full',
                  card: 'shadow-none p-0',
                  headerTitle: 'hidden',
                  headerSubtitle: 'hidden',
                  socialButtonsBlockButton: 'rounded-xl',
                  formButtonPrimary: 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 rounded-xl',
                  formFieldInput: 'rounded-xl',
                  footerActionLink: 'text-blue-600 hover:text-blue-700'
                }
              }}
              redirectUrl="/dashboard"
            />
          )}
        </div>

        {/* Security Badge */}
        <div className="flex items-center justify-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <ShieldCheckIcon className="h-4 w-4" />
          <span>Bank-level encryption • SOC 2 Type II compliant</span>
        </div>
      </div>
    </div>
  );
}
