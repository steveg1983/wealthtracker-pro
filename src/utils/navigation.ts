import { isDemoModeRuntimeAllowed } from './runtimeMode';

/**
 * Utility functions for navigation and URL management
 */

/**
 * Preserves the demo=true parameter when navigating between pages
 * @param path The path to navigate to
 * @param currentSearch The current search parameters (from location.search)
 * @returns The path with demo parameter preserved if present
 */
export function preserveDemoParam(path: string, currentSearch: string = ''): string {
  if (!isDemoModeRuntimeAllowed(import.meta.env)) {
    return path;
  }
  const searchParams = new URLSearchParams(currentSearch);
  const isDemoMode = searchParams.get('demo') === 'true';
  
  if (!isDemoMode) {
    return path;
  }
  
  // Check if path already has query parameters
  const separator = path.includes('?') ? '&' : '?';
  
  // Check if demo=true is already in the path
  if (path.includes('demo=true')) {
    return path;
  }
  
  return `${path}${separator}demo=true`;
}

/**
 * Carry the demo flag onto a path, wherever the app is running.
 *
 * The difference from `preserveDemoParam` above is deliberate and is the whole
 * reason this exists: that one asks `isDemoModeRuntimeAllowed` first and so
 * drops the flag outside development, while a jump taken INSIDE a demo session
 * has to land inside the same session or the user is bounced out of it
 * mid-journey. Every deep link built by a drill-down uses this rule (see
 * transactionDeepLink, reportDrillLink); page-to-page links keep the older one.
 *
 * Never adds a flag that was not already in `currentSearch`, so outside a demo
 * session it returns the path untouched.
 */
export function carryDemoFlag(path: string, currentSearch: string): string {
  if (new URLSearchParams(currentSearch).get('demo') !== 'true') return path;
  if (path.includes('demo=true')) return path;
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}demo=true`;
}

/**
 * Creates a navigation handler that preserves demo mode
 * @param navigate The navigate function from react-router
 * @param location The location object from react-router
 * @returns A wrapped navigate function that preserves demo mode
 */
export function createDemoAwareNavigate(navigate: (path: string) => void, locationSearch: string) {
  return (path: string) => {
    navigate(preserveDemoParam(path, locationSearch));
  };
}
