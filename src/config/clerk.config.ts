import { logger } from '../services/loggingService';
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
      colorPrimary: '#3B82F6',           // Blue-500
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
      formButtonPrimary: 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 shadow-lg',
      socialButtonsBlockButton: 'border-2 hover:bg-gray-50 dark:hover:bg-gray-800',
      
      // Inputs
      formFieldInput: 'rounded-xl border-gray-300 dark:border-gray-600 dark:bg-gray-800',
      formFieldLabel: 'text-gray-700 dark:text-gray-300 font-medium',
      
      // Links
      footerActionLink: 'text-blue-600 hover:text-blue-700 font-medium',
      
      // Passkey button
      alternativeMethodsBlockButton: 'bg-gradient-to-r from-green-500 to-blue-600 text-white hover:from-green-600 hover:to-blue-700',
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
    logger.error('Missing VITE_CLERK_PUBLISHABLE_KEY in environment variables');
    console.info('Please add it to your .env.local file');
    console.info('Get your key from: https://dashboard.clerk.com/apps/[your-app]/api-keys');
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