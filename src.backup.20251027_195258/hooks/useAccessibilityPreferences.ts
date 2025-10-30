import { useCallback, useEffect, useState } from 'react';

const matchMediaSupportsListener = (mediaQuery: MediaQueryList): mediaQuery is MediaQueryList & {
  addEventListener: (type: 'change', listener: (event: MediaQueryListEvent) => void) => void;
  removeEventListener: (type: 'change', listener: (event: MediaQueryListEvent) => void) => void;
} => typeof mediaQuery.addEventListener === 'function';

const matchMediaSupportsLegacyListener = (mediaQuery: MediaQueryList): mediaQuery is MediaQueryList & {
  addListener: (listener: (event: MediaQueryListEvent) => void) => void;
  removeListener: (listener: (event: MediaQueryListEvent) => void) => void;
} => typeof mediaQuery.addListener === 'function';

const useMediaPreference = (query: string) => {
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }
    return window.matchMedia(query).matches;
  });

  const handleChange = useCallback((event: MediaQueryListEvent) => {
    setMatches(event.matches);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return () => undefined;
    }

    const mediaQuery = window.matchMedia(query);
    setMatches(mediaQuery.matches);

    if (matchMediaSupportsListener(mediaQuery)) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }

    if (matchMediaSupportsLegacyListener(mediaQuery)) {
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }

    return () => undefined;
  }, [handleChange, query]);

  return matches;
};

export const useHighContrastMode = () => useMediaPreference('(prefers-contrast: high)');

export const useReducedMotion = () => useMediaPreference('(prefers-reduced-motion: reduce)');
