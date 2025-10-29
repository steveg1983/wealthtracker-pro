/**
 * SanitizedInput Component
 * An input component that automatically sanitizes its value
 */

import React, { useState, useEffect, useCallback } from 'react';
import { sanitizeText, sanitizeNumber, sanitizeDecimal, sanitizeURL, sanitizeQuery } from '../../security/xss-protection';

type SanitizeType = 'text' | 'number' | 'decimal' | 'url' | 'query' | 'email';

interface SanitizedInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value?: string | number;
  onChange?: (value: string | number) => void;
  sanitizeType?: SanitizeType;
  decimals?: number;
  allowEmpty?: boolean;
}

export const SanitizedInput: React.FC<SanitizedInputProps> = ({
  value: propValue = '',
  onChange,
  sanitizeType = 'text',
  decimals = 2,
  allowEmpty = true,
  ...inputProps
}) => {
  const [internalValue, setInternalValue] = useState(String(propValue));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setInternalValue(String(propValue));
  }, [propValue]);

  const sanitizeValue = useCallback((value: string): string | number => {
    setError(null);

    if (!value && allowEmpty) {
      return sanitizeType === 'number' || sanitizeType === 'decimal' ? 0 : '';
    }

    switch (sanitizeType) {
      case 'text':
        return sanitizeText(value);

      case 'number': {
        const num = sanitizeNumber(value);
        if (value && num === 0 && value !== '0') {
          setError('Please enter a valid number');
        }
        return num;
      }

      case 'decimal': {
        const decimal = sanitizeDecimal(value, decimals);
        if (value && parseFloat(decimal) === 0 && value !== '0') {
          setError('Please enter a valid decimal number');
        }
        return decimal;
      }

      case 'url': {
        const url = sanitizeURL(value);
        if (value && !url) {
          setError('Please enter a valid URL');
        }
        return url;
      }

      case 'email': {
        const email = sanitizeText(value);
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (value && !emailRegex.test(email)) {
          setError('Please enter a valid email');
        }
        return email;
      }

      case 'query':
        return sanitizeQuery(value);

      default:
        return sanitizeText(value);
    }
  }, [sanitizeType, decimals, allowEmpty]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    setInternalValue(rawValue);

    // Sanitize on blur for better UX
    if (inputProps.type !== 'number' && inputProps.type !== 'email') {
      const sanitized = sanitizeValue(rawValue);
      onChange?.(sanitized);
    }
  }, [sanitizeValue, onChange, inputProps.type]);

  const handleBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    const sanitized = sanitizeValue(internalValue);
    setInternalValue(String(sanitized));
    onChange?.(sanitized);
    inputProps.onBlur?.(e);
  }, [internalValue, sanitizeValue, onChange, inputProps]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    // Prevent script injection via key combinations
    if (e.ctrlKey && e.key === 'v') {
      e.preventDefault();
      navigator.clipboard.readText().then(text => {
        const sanitized = sanitizeValue(text);
        setInternalValue(String(sanitized));
        onChange?.(sanitized);
      });
    }
    inputProps.onKeyDown?.(e);
  }, [sanitizeValue, onChange, inputProps]);

  return (
    <div className="relative">
      <input
        {...inputProps}
        value={internalValue}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className={`${inputProps.className} ${error ? 'border-red-500' : ''}`}
        aria-invalid={!!error}
        aria-describedby={error ? `${inputProps.id}-error` : undefined}
      />
      {error && (
        <p
          id={`${inputProps.id}-error`}
          className="mt-1 text-sm text-red-600"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
};