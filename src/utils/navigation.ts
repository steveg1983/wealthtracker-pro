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
