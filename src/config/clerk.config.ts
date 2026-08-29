/**
 * Clerk Configuration - Setup for world-class authentication
 * 
 * To get started:
 * 1. Sign up at https://clerk.com
 * 2. Create a new application
 * 3. Get your publishable key
 * 4. Add to .env.local:
 *    VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
 * 
 * Features to enable in Clerk Dashboard:
 * - Email (magic links)
 * - Passkeys/WebAuthn
 * - Google OAuth (optional)
 * - Apple OAuth (optional)
 * - Multi-factor authentication
 */

import { createScopedLogger } from '../loggers/scopedLogger';

const clerkConfigLogger = createScopedLogger('ClerkConfig');

export const clerkConfig = {
  // Sign in methods (enable in Clerk dashboard)
  signInMethods: {
    emailCode: true,        // Magic links
    passkey: true,          // WebAuthn/Passkeys
    password: false,        // Optional - we prefer passwordless
    googleOAuth: true,      // Optional
    appleOAuth: true,       // Optional for iOS users
  },

  // Security settings
  security: {
    // Passkey settings
    passkey: {
      allowCredentials: true,
      userVerification: 'preferred',
      residentKey: 'preferred',
      authenticatorAttachment: 'platform', // Use device authenticator
    },

    // Session settings
    session: {
      singleSessionMode: false,  // Allow multiple devices
      inactivityTimeout: 60,      // Minutes before requiring re-auth
    },

    // MFA settings
    mfa: {
      enabled: true,
      required: false,  // Optional for users
      methods: ['totp', 'sms', 'backup_codes'],
    },
  },

  // UI customization
  appearance: {
    // Brand colors
    variables: {
      // The brand navy (--color-primary), not a stock blue-500: the sign-in
      // card is the first surface of this app and it may as well be this app.
      // Clerk derives its own hover and label from this one value.
      colorPrimary: '#1a2332',
      colorDanger: '#EF4444',            // Red-500
      colorSuccess: '#10B981',           // Green-500
      colorWarning: '#F59E0B',           // Yellow-500
      colorTextOnPrimaryBackground: '#FFFFFF',
      borderRadius: '0.75rem',           // Rounded corners
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    },

    // Element styling
    elements: {
      // Cards and containers
      card: 'shadow-xl rounded-2xl',
      rootBox: 'w-full',
      
      // Buttons
      // Flat, and on the app's primary-action token pair. The gradient was
      // two stock blues doing the work one token does (28 Aug ruling, §5).
      formButtonPrimary: 'bg-primary-action text-on-primary-action hover:bg-primary-action-hover shadow-lg',
      socialButtonsBlockButton: 'border-2 hover:bg-gray-50 dark:hover:bg-gray-800',
      
      // Inputs
      formFieldInput: 'rounded-xl border-gray-300 dark:border-gray-600 dark:bg-gray-800',
      formFieldLabel: 'text-gray-700 dark:text-gray-300 font-medium',
      
      // Links
      // In-app navigation ("sign up instead"), so the navy — link blue is for
      // an <a> that hands the reader to a tab this app does not control.
      footerActionLink: 'text-primary hover:text-secondary font-medium',
      
      // Passkey button
      // A second way in is a lesser action than the primary one: the quiet
      // bordered secondary, not a green-to-blue gradient louder than the
      // button it sits under.
      alternativeMethodsBlockButton: 'border-2 border-gray-300 text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-800',
    },

    // Layout
    layout: {
      socialButtonsPlacement: 'top',
      showOptionalFields: false,
      shimmer: true,  // Loading animations
      animations: true,
    },
  },

  // Redirect URLs
  redirects: {
    signIn: '/dashboard',
    signUp: '/onboarding',
    afterSignOut: '/',
    afterMFASetup: '/settings/security',
  },

  // Localization
  localization: {
    locale: 'en-US',
    fallbackLocale: 'en',
  },
};

// Helper to get Clerk publishable key
export function getClerkPublishableKey(): string {
  const key = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
  
  if (!key) {
    clerkConfigLogger.error('Missing VITE_CLERK_PUBLISHABLE_KEY in environment variables');
    clerkConfigLogger.info('Please add it to your .env.local file');
    clerkConfigLogger.info('Get your key from: https://dashboard.clerk.com/apps/[your-app]/api-keys');
  }
  
  return key || '';
}

// Development helpers
export const clerkDevHelpers = {
  // Test accounts for development
  testAccounts: [
    { email: 'test@wealthtracker.app', name: 'Test User' },
    { email: 'premium@wealthtracker.app', name: 'Premium User' },
  ],
  
  // Mock passkey for development
  mockPasskey: {
    credentialId: 'mock-credential-id',
    publicKey: 'mock-public-key',
  },
};
