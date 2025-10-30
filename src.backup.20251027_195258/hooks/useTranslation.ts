import { useMemo } from 'react';
import { getUserLocale } from '../utils/dateFormatter';
import { translations as enUS } from '../locales/en-US';
import { translations as enGB } from '../locales/en-GB';

type TranslationLeaf = string;
interface TranslationObject {
  [key: string]: TranslationObject | TranslationLeaf;
}
type TranslationMap = TranslationObject;

const getNestedTranslation = (obj: TranslationMap, path: string): string => {
  const segments = path.split('.');
  let current: TranslationObject | TranslationLeaf | undefined = obj;

  for (const segment of segments) {
    if (typeof current === 'object' && current !== null && segment in current) {
      current = current[segment];
    } else {
      return path;
    }
  }

  return typeof current === 'string' ? current : path;
};

/**
 * Hook for accessing localized translations
 */
export function useTranslation() {
  const locale = getUserLocale();
  
  const translations = useMemo<TranslationMap>(() => {
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
  const t = (key: string, fallback?: string): string => {
    const translation = getNestedTranslation(translations, key);
    return translation !== key ? translation : (fallback || key);
  };
  
  return {
    t,
    locale,
    isUKSpelling: ['en-GB', 'en-IE', 'en-AU', 'en-NZ', 'en-IN', 'en-ZA'].some(loc => locale.startsWith(loc))
  };
}
