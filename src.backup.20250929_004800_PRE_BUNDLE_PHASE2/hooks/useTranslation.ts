import { useMemo } from 'react';
import { getUserLocale } from '../utils/dateFormatter';
import { translations as enUS } from '../locales/en-US';
import { translations as enGB } from '../locales/en-GB';

type TranslationPath = string;
type TranslationObject = Record<string, any>;

/**
 * Get nested translation value using dot notation
 * Example: t('navigation.transferCenter')
 */
function getNestedTranslation(obj: TranslationObject, path: string): string {
  const keys = path.split('.');
  let current: any = obj;
  
  for (const key of keys) {
    if (current && typeof current === 'object' && key in current) {
      current = current[key];
    } else {
      // Return the path if translation not found (for debugging)
      return path;
    }
  }
  
  return typeof current === 'string' ? current : path;
}

/**
 * Hook for accessing localized translations
 */
export function useTranslation() {
  const locale = getUserLocale();
  
  const translations = useMemo(() => {
    // Check if it's a UK locale (en-GB, en-IE, en-AU, en-NZ, en-IN, en-ZA)
    const ukSpellingLocales = ['en-GB', 'en-IE', 'en-AU', 'en-NZ', 'en-IN', 'en-ZA'];
    const useUKSpelling = ukSpellingLocales.some(loc => locale.startsWith(loc));
    
    return useUKSpelling ? enGB : enUS;
  }, [locale]);
  
  /**
   * Get translation for a given key
   * @param key - Translation key using dot notation (e.g., 'navigation.transferCenter')
   * @param fallback - Optional fallback value if translation not found
   */
  const t = (key: TranslationPath, fallback?: string): string => {
    const translation = getNestedTranslation(translations, key);
    return translation !== key ? translation : (fallback || key);
  };
  
  return {
    t,
    locale,
    isUKSpelling: ['en-GB', 'en-IE', 'en-AU', 'en-NZ', 'en-IN', 'en-ZA'].some(loc => locale.startsWith(loc))
  };
}