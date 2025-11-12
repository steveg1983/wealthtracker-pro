/**
 * Safari-specific fixes for Clerk authentication
 * Safari has stricter cookie policies and localStorage restrictions
 */

import { isSafari } from './safariCompat';
import { createScopedLogger } from '../loggers/scopedLogger';

const clerkSafariLogger = createScopedLogger('ClerkSafariFix');

// Check if third-party cookies are blocked
export const checkThirdPartyCookies = async (): Promise<boolean> => {
  try {
    // Try to set a test cookie
    document.cookie = 'test_cookie=1; SameSite=None; Secure';
    const cookieSet = document.cookie.includes('test_cookie=1');
    
    // Clean up
    if (cookieSet) {
      document.cookie = 'test_cookie=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    }
    
    return cookieSet;
  } catch (error) {
    clerkSafariLogger.warn('Cookie test failed', error);
    return false;
  }
};

// Check if localStorage is available (Safari private mode blocks it)
export const checkLocalStorage = (): boolean => {
  try {
    const test = '__localStorage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch (e) {
    return false;
  }
};

// Check if sessionStorage is available
export const checkSessionStorage = (): boolean => {
  try {
    const test = '__sessionStorage_test__';
    sessionStorage.setItem(test, test);
    sessionStorage.removeItem(test);
    return true;
  } catch (e) {
    return false;
  }
};

// Safari ITP (Intelligent Tracking Prevention) workaround
export const initClerkSafariCompat = async () => {
  if (!isSafari()) {
    return { compatible: true };
  }

  clerkSafariLogger.info('Safari detected - checking Clerk compatibility');

  const results = {
    safari: true,
    localStorage: checkLocalStorage(),
    sessionStorage: checkSessionStorage(),
    thirdPartyCookies: await checkThirdPartyCookies(),
    compatible: true,
    warnings: [] as string[]
  };

  // Check for issues
  if (!results.localStorage) {
    results.warnings.push('localStorage blocked - likely private browsing mode');
    results.compatible = false;
  }

  if (!results.sessionStorage) {
    results.warnings.push('sessionStorage blocked - authentication may fail');
    results.compatible = false;
  }

  if (!results.thirdPartyCookies) {
    results.warnings.push('Third-party cookies blocked - Clerk may not work properly');
  }

  // Apply Safari-specific fixes
  if (results.compatible) {
    applySafariFixes();
  }

  if (results.warnings.length > 0) {
    clerkSafariLogger.warn('Safari compatibility warnings', results.warnings);
  }

  return results;
};

// Apply Safari-specific workarounds
const applySafariFixes = () => {
  // 1. Force SameSite=None for Clerk cookies (if possible)
  try {
    // Intercept fetch to add credentials
    const originalFetch = window.fetch;
    window.fetch = function(...args) {
      const [url, options = {}] = args;
      
      // Add credentials for Clerk API calls
      if (typeof url === 'string' && (url.includes('clerk.') || url.includes('accounts.'))) {
        options.credentials = 'include';
        options.mode = 'cors';
      }
      
      return originalFetch.apply(this, [url, options]);
    };
  } catch (error) {
    clerkSafariLogger.error('Failed to patch fetch for Safari', error);
  }

  // 2. Add storage event listeners to sync auth state
  if (window.addEventListener) {
    window.addEventListener('storage', (e) => {
      // Sync Clerk session across tabs in Safari
      if (e.key?.includes('clerk') || e.key?.includes('__session')) {
        clerkSafariLogger.info('Safari: syncing Clerk session across tabs');
        // Force a session refresh
        window.location.reload();
      }
    });
  }

  // 3. Polyfill for Safari's missing features
  polyfillSafari();
};

// Polyfills for older Safari versions
const polyfillSafari = () => {
  // Ensure Promise.allSettled exists (Safari < 13)
  if (!Promise.allSettled) {
    Promise.allSettled = function(promises: Promise<any>[]) {
      return Promise.all(
        promises.map(p =>
          Promise.resolve(p).then(
            value => ({ status: 'fulfilled' as const, value }),
            reason => ({ status: 'rejected' as const, reason })
          )
        )
      );
    };
  }

  // Ensure queueMicrotask exists (Safari < 12.1)
  if (typeof queueMicrotask === 'undefined') {
    window.queueMicrotask = function(callback: VoidFunction) {
      Promise.resolve().then(callback);
    };
  }

  // Fix for Safari's strict cookie handling
  if (document.hasStorageAccess && document.requestStorageAccess) {
    // Request storage access for third-party contexts
    document.hasStorageAccess().then(hasAccess => {
      if (!hasAccess) {
        clerkSafariLogger.info('Requesting storage access for Safari');
        return document.requestStorageAccess();
      }
    }).catch(error => {
      clerkSafariLogger.warn('Storage access request failed', error);
    });
  }
};

// Error handler specifically for Clerk errors in Safari
export const handleClerkSafariError = (error: any): { message: string; solution: string } => {
  const errorStr = error?.message || error?.toString() || '';
  
  if (errorStr.includes('localStorage') || errorStr.includes('sessionStorage')) {
    return {
      message: 'Storage access blocked in Safari',
      solution: 'Please disable "Prevent cross-site tracking" in Safari Settings > Privacy, or try using a different browser.'
    };
  }

  if (errorStr.includes('cookie') || errorStr.includes('Cookie')) {
    return {
      message: 'Cookies are blocked in Safari',
      solution: 'Please enable cookies in Safari Settings > Privacy > "Block all cookies" should be OFF.'
    };
  }

  if (errorStr.includes('fetch') || errorStr.includes('network')) {
    return {
      message: 'Network request blocked by Safari',
      solution: 'Please check Safari content blockers or try disabling extensions.'
    };
  }

  if (errorStr.includes('crypto') || errorStr.includes('subtle')) {
    return {
      message: 'Cryptography API not available',
      solution: 'Please ensure you are using HTTPS or update Safari to the latest version.'
    };
  }

  return {
    message: 'Authentication error in Safari',
    solution: 'Please try: 1) Clear Safari cache and cookies, 2) Disable "Prevent cross-site tracking", 3) Use a different browser like Chrome or Firefox.'
  };
};

// Check if we should show Safari warning
export const shouldShowSafariWarning = (): boolean => {
  if (!isSafari()) return false;
  
  // Check if user has already dismissed the warning
  try {
    const dismissed = localStorage.getItem('safari_warning_dismissed');
    if (dismissed === 'true') return false;
  } catch {
    // localStorage might be blocked
  }
  
  return true;
};

// Dismiss Safari warning
export const dismissSafariWarning = () => {
  try {
    localStorage.setItem('safari_warning_dismissed', 'true');
  } catch {
    // Fallback to sessionStorage or cookie
    try {
      sessionStorage.setItem('safari_warning_dismissed', 'true');
    } catch {
      document.cookie = 'safari_warning_dismissed=true; max-age=2592000'; // 30 days
    }
  }
};
