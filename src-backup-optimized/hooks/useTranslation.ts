// Minimal translation hook - replace with proper i18n later
export function useTranslation() {
  const t = (key: string): string => {
    // For now, just return the key as the translation
    return key;
  };

  return { t };
}