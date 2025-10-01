/**
 * Hook for sanitizing markdown content
 * Ensures markdown content is safe to render
 */

import { useState, useCallback, useEffect } from 'react';
import { sanitizeMarkdown } from '../security/xss-protection';

interface UseSanitizedMarkdownOptions {
  maxLength?: number;
  onChange?: (sanitized: string) => void;
  sanitizeOnBlur?: boolean;
}

export const useSanitizedMarkdown = (
  initialValue: string = '',
  options: UseSanitizedMarkdownOptions = {}
) => {
  const { maxLength = 10000, onChange, sanitizeOnBlur = true } = options;
  
  const [value, setValue] = useState(initialValue);
  const [sanitizedValue, setSanitizedValue] = useState(() => sanitizeMarkdown(initialValue));
  const [error, setError] = useState<string | null>(null);

  // Sanitize value when it changes (if not sanitizing on blur)
  useEffect(() => {
    if (!sanitizeOnBlur) {
      const sanitized = sanitizeMarkdown(value);
      setSanitizedValue(sanitized);
      onChange?.(sanitized);
    }
  }, [value, sanitizeOnBlur, onChange]);

  const handleChange = useCallback((newValue: string) => {
    if (newValue.length > maxLength) {
      setError(`Content exceeds maximum length of ${maxLength} characters`);
      return;
    }
    
    setError(null);
    setValue(newValue);
    
    if (!sanitizeOnBlur) {
      const sanitized = sanitizeMarkdown(newValue);
      setSanitizedValue(sanitized);
      onChange?.(sanitized);
    }
  }, [maxLength, sanitizeOnBlur, onChange]);

  const handleBlur = useCallback(() => {
    if (sanitizeOnBlur) {
      const sanitized = sanitizeMarkdown(value);
      setSanitizedValue(sanitized);
      onChange?.(sanitized);
    }
  }, [value, sanitizeOnBlur, onChange]);

  const reset = useCallback(() => {
    setValue(initialValue);
    setSanitizedValue(sanitizeMarkdown(initialValue));
    setError(null);
  }, [initialValue]);

  return {
    value,
    sanitizedValue,
    error,
    handleChange,
    handleBlur,
    reset,
    charactersRemaining: maxLength - value.length
  };
};