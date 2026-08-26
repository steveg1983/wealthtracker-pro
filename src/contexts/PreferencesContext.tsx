/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { preferences } from '../services/preferencesService';

/**
 * App-wide display preferences.
 *
 * These used to be read from and written to `window.localStorage` directly, and
 * that is why a restored backup came up in the wrong currency with the wrong
 * name and the wrong theme: they were never in the database, so they were never
 * in the file. They now go through the preferences document, which travels with
 * the account (services/preferencesService).
 *
 * The VALUES are stored exactly as before — `'true'`, `'GBP'`, the schedule as
 * JSON — so nothing about the format changed and an existing browser is read
 * back unchanged. Only the home moved.
 *
 * This provider mounts ABOVE AppProvider, so the signed-in identity does not
 * exist when it first renders. It therefore reads the service's synchronous
 * snapshot (which starts from this browser's own copy) and SUBSCRIBES: when the
 * account's document arrives a moment later, every value here corrects itself
 * once. Without that subscription a new machine would show defaults for the
 * whole session and then save them over the real ones.
 */

interface PreferencesContextType {
  compactView: boolean;
  setCompactView: (value: boolean) => void;
  currency: string;
  setCurrency: (value: string) => void;
  theme: 'light' | 'dark' | 'auto' | 'scheduled';
  setTheme: (value: 'light' | 'dark' | 'auto' | 'scheduled') => void;
  actualTheme: 'light' | 'dark';
  // Theme scheduling
  themeSchedule: {
    enabled: boolean;
    lightStartTime: string; // HH:MM format
    darkStartTime: string; // HH:MM format
  };
  setThemeSchedule: (schedule: { enabled: boolean; lightStartTime: string; darkStartTime: string }) => void;
}

const PreferencesContext = createContext<PreferencesContextType | undefined>(undefined);

type ThemeChoice = 'light' | 'dark' | 'auto' | 'scheduled';
type ThemeSchedule = { enabled: boolean; lightStartTime: string; darkStartTime: string };

const DEFAULT_THEME_SCHEDULE: ThemeSchedule = {
  enabled: false,
  lightStartTime: '06:00',
  darkStartTime: '18:00',
};

const isThemeChoice = (value: string | null): value is ThemeChoice =>
  value === 'light' || value === 'dark' || value === 'auto' || value === 'scheduled';

/**
 * Each reader keeps its own defence against a bad stored value, exactly as it
 * did when the store was localStorage: these strings are hand-editable there
 * and travel through a JSON document here, so neither is a place to assume a
 * shape. A value that cannot be read costs that one preference.
 */
function readThemeSchedule(): ThemeSchedule {
  const saved = preferences.getItem('money_management_theme_schedule');
  if (!saved) return DEFAULT_THEME_SCHEDULE;
  try {
    const parsed: unknown = JSON.parse(saved);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return DEFAULT_THEME_SCHEDULE;
    const record: Record<string, unknown> = { ...parsed };
    return {
      enabled: record.enabled === true,
      lightStartTime: typeof record.lightStartTime === 'string' ? record.lightStartTime : DEFAULT_THEME_SCHEDULE.lightStartTime,
      darkStartTime: typeof record.darkStartTime === 'string' ? record.darkStartTime : DEFAULT_THEME_SCHEDULE.darkStartTime,
    };
  } catch {
    return DEFAULT_THEME_SCHEDULE;
  }
}

export function PreferencesProvider({ children }: { children: ReactNode }): React.JSX.Element {
  // Compact view defaults ON: `null` means "never chosen", which is not the
  // same as having chosen the roomy one.
  const [compactView, setCompactView] = useState(
    (): boolean => preferences.getItem('money_management_compact_view') !== 'false'
  );

  const [currency, setCurrency] = useState(
    (): string => preferences.getItem('money_management_currency') || 'GBP'
  );

  const [theme, setTheme] = useState<ThemeChoice>((): ThemeChoice => {
    const saved = preferences.getItem('money_management_theme');
    return isThemeChoice(saved) ? saved : 'light';
  });

  const [themeSchedule, setThemeSchedule] = useState<ThemeSchedule>(readThemeSchedule);

  /**
   * Adopt the account's document when it lands.
   *
   * Only for values the user has NOT changed since this component mounted:
   * `hydrated` flips on the first notification, and after that the state here is
   * the truth and the service is downstream of it. Re-reading on every
   * notification would fight the write-through — a click would set the value,
   * schedule a save, and be overwritten by the notification the save itself
   * caused.
   */
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    if (hydrated) return;
    const unsubscribe = preferences.subscribe(() => {
      setHydrated(true);
      setCompactView(preferences.getItem('money_management_compact_view') !== 'false');
      setCurrency(preferences.getItem('money_management_currency') || 'GBP');
      const storedTheme = preferences.getItem('money_management_theme');
      setTheme(isThemeChoice(storedTheme) ? storedTheme : 'light');
      setThemeSchedule(readThemeSchedule());
    });
    return unsubscribe;
  }, [hydrated]);

  const [actualTheme, setActualTheme] = useState<'light' | 'dark'>('light');

  // Memoize updateActualTheme to avoid recreating it
  const updateActualTheme = useCallback((): void => {
    let newTheme: 'light' | 'dark' = 'light';
    
    if (theme === 'dark') {
      newTheme = 'dark';
    } else if (theme === 'auto') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      newTheme = prefersDark ? 'dark' : 'light';
    } else if (theme === 'scheduled' && themeSchedule.enabled) {
      // Get current time in HH:MM format
      const now = new Date();
      const currentTime = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
      
      const lightStart = themeSchedule.lightStartTime;
      const darkStart = themeSchedule.darkStartTime;
      
      // Handle cases where dark start is before light start (crosses midnight)
      if (darkStart < lightStart) {
        // Dark period crosses midnight
        newTheme = currentTime >= darkStart || currentTime < lightStart ? 'dark' : 'light';
      } else {
        // Normal case
        newTheme = currentTime >= darkStart || currentTime < lightStart ? 'dark' : 'light';
      }
    } else {
      newTheme = 'light';
    }
    
    setActualTheme(newTheme);
  }, [theme, themeSchedule]);

  // Handle theme changes and auto theme
  useEffect(() => {
    updateActualTheme();

    if (theme === 'auto') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = (): void => updateActualTheme();
      
      // Use the modern addEventListener/removeEventListener pattern
      mediaQuery.addEventListener('change', handleChange);
      return (): void => mediaQuery.removeEventListener('change', handleChange);
    } else if (theme === 'scheduled' && themeSchedule.enabled) {
      // Update theme every minute when scheduled
      const interval = setInterval(updateActualTheme, 60000);
      return (): void => clearInterval(interval);
    }
  }, [theme, themeSchedule, updateActualTheme]);

  // Apply theme classes
  useEffect(() => {
    const applyTheme = (): void => {
      const root = document.documentElement;
      
      root.classList.remove('dark');
      
      requestAnimationFrame((): void => {
        if (actualTheme === 'dark') {
          root.classList.add('dark');
        } else {
          root.classList.remove('dark');
        }
      });
    };
    
    applyTheme();
    
    const timer = setTimeout(applyTheme, 100);
    
    return (): void => clearTimeout(timer);
  }, [actualTheme]);

  // Colour-theme variants were retired 2026-07-10 — one brand scheme (:root)
  // plus light/dark. Clear any theme-* class a previous session applied and
  // drop the stored preference.
  useEffect(() => {
    const root = document.documentElement;
    ['theme-blue', 'theme-green', 'theme-red', 'theme-pink'].forEach(className => {
      root.classList.remove(className);
    });
    try {
      localStorage.removeItem('money_management_color_theme');
    } catch {
      // storage may be unavailable; nothing to clean up
    }
  }, []);

  // One write-through for all seven. The service does its own debouncing of the
  // network write, so the 300ms here is only about not re-serialising the
  // theme schedule on every change.
  useEffect(() => {
    const savePreferences = (): void => {
      preferences.setItem('money_management_compact_view', compactView.toString());
      preferences.setItem('money_management_currency', currency);
      preferences.setItem('money_management_theme', theme);
      preferences.setItem('money_management_theme_schedule', JSON.stringify(themeSchedule));
    };

    const timeoutId = setTimeout(savePreferences, 300);

    return (): void => clearTimeout(timeoutId);
  }, [compactView, currency, theme, themeSchedule]);

  return (
    <PreferencesContext.Provider value={{
      compactView,
      setCompactView,
      currency,
      setCurrency,
      theme,
      setTheme,
      actualTheme,
      themeSchedule,
      setThemeSchedule,
    }}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences(): PreferencesContextType {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error('usePreferences must be used within PreferencesProvider');
  }
  return context;
}
