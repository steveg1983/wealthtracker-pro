/**
 * Authentication and authorization message constants
 * Extracted to prevent Fast Refresh warnings in React components
 */

export const HAS_REQUIRED_SUBSCRIPTION_MESSAGE =
  'This feature requires a premium subscription. Upgrade to unlock advanced features and unlimited usage.';

export const PREMIUM_FEATURE_TITLE = 'Premium Feature';

export const UPGRADE_TO_PREMIUM_TEXT = 'Upgrade to Premium';

export const GO_BACK_TEXT = 'Go Back';

export const PREMIUM_INCLUDES_TITLE = 'Premium includes:';

export const PREMIUM_FEATURES = [
  'Unlimited accounts & transactions',
  'Advanced analytics & reports',
  'Investment tracking',
  'Bank connections',
  'Priority support'
] as const;

export const ACCESS_DENIED_TITLE = 'Access Denied';

export const ACCESS_DENIED_MESSAGE = (requiredRole: string) =>
  `You don't have permission to access this page. Required role: ${requiredRole}`;

export const RETURN_TO_DASHBOARD_TEXT = 'Return to Dashboard';

export const DEVELOPMENT_MODE_BANNER_TEXT = 'Development Mode - Authentication Bypassed';

export const CHECKING_SUBSCRIPTION_TEXT = 'Checking subscription status...';

export const SECURITY_BADGE_TEXT = 'Bank-level encryption • SOC 2 Type II compliant';
