/**
 * Custom hook for sanitizing form data
 * Integrates with react-hook-form or can be used standalone
 */

import { useState, useCallback } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { logger } from '../services/loggingService';
import {
  sanitizeText,
  sanitizeHTML,
  sanitizeURL,
  sanitizeQuery,
  sanitizeNumber,
  sanitizeDecimal,
  sanitizeDate,
  sanitizeFilename,
  sanitizeJSON
} from '../security/xss-protection';

type SanitizeType = 'text' | 'html' | 'url' | 'query' | 'number' | 'decimal' | 'date' | 'filename' | 'json';

interface FieldConfig {
  type: SanitizeType;
  required?: boolean;
  decimals?: number;
}

type SanitizedFormConfig<T extends Record<string, unknown>> = Partial<Record<keyof T, FieldConfig | SanitizeType>>;

type InputEvent = ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>;

export const useSanitizedForm = <T extends Record<string, unknown>>(
  initialValues: T,
  config: SanitizedFormConfig<T>
) => {
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});

  const sanitizeField = useCallback(function sanitizeFieldValue<K extends keyof T>(
    fieldName: K,
    value: unknown,
    fieldConfig: FieldConfig | SanitizeType
  ): T[K] {
    const resolvedConfig = typeof fieldConfig === 'string'
      ? { type: fieldConfig }
      : fieldConfig;

    const isEmpty = value === null || value === undefined || value === '';

    if (resolvedConfig.required && isEmpty) {
      setErrors(prev => ({ ...prev, [fieldName]: 'This field is required' }));
      return value;
    }

    // Clear error for this field
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[fieldName as keyof T];
      return newErrors;
    });

    const rawValue = value;
    let sanitizedValue: unknown = rawValue;

    const toInputString = (input: unknown): string =>
      typeof input === 'string' ? input : input != null ? String(input) : '';

    const toNumberInput = (input: unknown): string | number => {
      if (typeof input === 'number' || typeof input === 'string') {
        return input;
      }
      return toInputString(input);
    };

    switch (resolvedConfig.type) {
      case 'text':
        sanitizedValue = sanitizeText(toInputString(rawValue));
        break;
      
      case 'html':
        sanitizedValue = sanitizeHTML(toInputString(rawValue));
        break;
      
      case 'url': {
        const sanitizedUrl = sanitizeURL(toInputString(rawValue));
        if (!isEmpty && !sanitizedUrl) {
          setErrors(prev => ({ ...prev, [fieldName]: 'Invalid URL' }));
        }
        sanitizedValue = sanitizedUrl;
        break;
      }
      
      case 'query':
        sanitizedValue = sanitizeQuery(toInputString(rawValue));
        break;
      
      case 'number': {
        const num = sanitizeNumber(toNumberInput(rawValue));
        if (!isEmpty && num === 0 && rawValue !== '0' && rawValue !== 0) {
          setErrors(prev => ({ ...prev, [fieldName]: 'Invalid number' }));
        }
        sanitizedValue = num;
        break;
      }
      
      case 'decimal':
        sanitizedValue = sanitizeDecimal(toNumberInput(rawValue), resolvedConfig.decimals);
        break;
      
      case 'date': {
        const dateInput =
          rawValue instanceof Date
            ? rawValue
            : toInputString(rawValue);

        const date = sanitizeDate(dateInput);
        if (!isEmpty && !date) {
          setErrors(prev => ({ ...prev, [fieldName]: 'Invalid date' }));
        }
        sanitizedValue = date;
        break;
      }
      
      case 'filename':
        sanitizedValue = sanitizeFilename(toInputString(rawValue));
        break;
      
      case 'json':
        try {
          const jsonInput = toInputString(rawValue) || '{}';
          sanitizedValue = sanitizeJSON(jsonInput);
        } catch {
          setErrors(prev => ({ ...prev, [fieldName]: 'Invalid JSON' }));
          sanitizedValue = '{}';
        }
        break;
      
      default:
        sanitizedValue = sanitizeText(toInputString(rawValue));
    }

    return sanitizedValue as T[K];
  }, []);

  const isInputEvent = (value: unknown): value is InputEvent =>
    typeof value === 'object' && value !== null && 'target' in value;

  const extractValue = useCallback((eventOrValue: InputEvent | unknown): unknown => {
    if (isInputEvent(eventOrValue)) {
      return eventOrValue.target.value;
    }
    return eventOrValue;
  }, []);

  const handleChange = useCallback((fieldName: keyof T) => {
    return (eventOrValue: InputEvent | T[typeof fieldName]) => {
      const value = extractValue(eventOrValue);
      const fieldConfig = config[fieldName];
      
      if (!fieldConfig) {
        logger.warn(`No sanitization config for field: ${String(fieldName)}`);
        setValues(prev => ({ ...prev, [fieldName]: value as T[typeof fieldName] }));
        return;
      }

      const sanitized = sanitizeField(fieldName, value, fieldConfig);
      setValues(prev => ({ ...prev, [fieldName]: sanitized }));
    };
  }, [config, extractValue, sanitizeField]);

  const handleSubmit = useCallback((onSubmit: (data: T) => void) => {
    return (e?: FormEvent) => {
      e?.preventDefault();

      // Sanitize all values before submission
      const sanitizedValues: Partial<T> = {};
      let hasErrors = false;

      for (const [fieldName, value] of Object.entries(values)) {
        const fieldKey = fieldName as keyof T;
        const fieldConfig = config[fieldKey];
        if (fieldConfig) {
          sanitizedValues[fieldKey] = sanitizeField(fieldKey, value, fieldConfig);
          
          // Check if field has error
          if (errors[fieldKey]) {
            hasErrors = true;
          }
        } else {
          sanitizedValues[fieldKey] = value as T[typeof fieldKey];
        }
      }

      if (!hasErrors) {
        onSubmit(sanitizedValues as T);
      }
    };
  }, [values, config, sanitizeField, errors]);

  const reset = useCallback(() => {
    setValues(initialValues);
    setErrors({});
  }, [initialValues]);

  const setValue = useCallback((fieldName: keyof T, value: T[typeof fieldName]) => {
    const fieldConfig = config[fieldName];
    
    if (!fieldConfig) {
      setValues(prev => ({ ...prev, [fieldName]: value }));
      return;
    }

    const sanitized = sanitizeField(fieldName, value, fieldConfig);
    setValues(prev => ({ ...prev, [fieldName]: sanitized }));
  }, [config, sanitizeField]);

  return {
    values,
    errors,
    handleChange,
    handleSubmit,
    reset,
    setValue,
    isValid: Object.keys(errors).length === 0
  };
};
