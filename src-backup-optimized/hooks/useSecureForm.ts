/**
 * Secure Form Hook - Phase 6
 * Automatically sanitizes and validates all form inputs for financial components
 * Enforces security standards across all user input
 */

import { useState, useCallback } from 'react';
import { sanitizeText, sanitizeNumber } from '../security/xss-protection';
import { useLogger } from '../../services/ServiceProvider';
import { ValidationService } from '../services/validationService';
import { createUserFriendlyError } from '../services/ErrorTaxonomyService';

interface SecureFormConfig {
  sanitize?: boolean;
  validate?: boolean;
  logActivity?: boolean;
}

interface SecureFormField {
  value: string;
  sanitizedValue: string;
  isValid: boolean;
  error?: string;
}

interface SecureFormState<T> {
  data: T;
  sanitizedData: T;
  errors: Partial<Record<keyof T, string>>;
  isValid: boolean;
  isSubmitting: boolean;
}

/**
 * Hook for secure form handling with automatic sanitization
 */
export function useSecureForm<T extends Record<string, any>>(
  initialData: T,
  config: SecureFormConfig = {
  sanitize: true, validate: true, logActivity: true }
) {
  const [state, setState] = useState<SecureFormState<T>>({
    data: initialData,
    sanitizedData: initialData,
    errors: {},
    isValid: false,
    isSubmitting: false
  });

  /**
   * Sanitize a single field value based on its type
   */
  const sanitizeField = useCallback((key: keyof T, value: any): any => {
    if (!config.sanitize) return value;

    // Handle different field types
    if (typeof value === 'string') {
      // Financial fields need special handling
      if (key.toString().includes('amount') || key.toString().includes('balance')) {
        return sanitizeNumber(value).toString();
      }

      // Account numbers and sort codes need text sanitization
      if (key.toString().includes('account') || key.toString().includes('sort')) {
        return sanitizeText(value);
      }

      // Default to text sanitization
      return sanitizeText(value);
    }

    if (typeof value === 'number') {
      return sanitizeNumber(value);
    }

    return value;
  }, [config.sanitize]);

  /**
   * Update a single field with automatic sanitization
   */
  const updateField = useCallback((key: keyof T, value: any) => {
    const sanitizedValue = sanitizeField(key, value);

    setState(prevState => {
      const newData = { ...prevState.data, [key]: value };
      const newSanitizedData = { ...prevState.sanitizedData, [key]: sanitizedValue };

      // Log potentially dangerous input
      if (config.logActivity && value !== sanitizedValue) {
        logger.warn('Input sanitized:', {
          field: key.toString(),
          original: value,
          sanitized: sanitizedValue
        });
      }

      return {
        ...prevState,
        data: newData,
        sanitizedData: newSanitizedData,
        errors: { ...prevState.errors, [key]: undefined } // Clear field error
      };
    });
  }, [sanitizeField, config.logActivity]);

  /**
   * Validate all form data
   */
  const validateForm = useCallback((): boolean => {
    if (!config.validate) return true;

    try {
      // Use ValidationService if available
      const errors: Partial<Record<keyof T, string>> = {};
      let isValid = true;

      // Basic validation for required fields
      Object.entries(state.sanitizedData).forEach(([key, value]) => {
        if (!value && typeof value === 'string' && value.trim() === '') {
          if (key === 'name' || key === 'description' || key === 'amount') {
            errors[key as keyof T] = 'This field is required';
            isValid = false;
          }
        }

        // Validate financial amounts
        if ((key === 'amount' || key === 'balance') && value) {
          const numValue = Number(value);
          if (isNaN(numValue)) {
            errors[key as keyof T] = 'Please enter a valid number';
            isValid = false;
          }
        }
      });

      setState(prevState => ({
        ...prevState,
        errors,
        isValid
      }));

      return isValid;
    } catch (error) {
      logger.error('Form validation failed:', error);
      return false;
    }
  }, [state.sanitizedData, config.validate]);

  /**
   * Submit form with comprehensive security checks
   */
  const submitForm = useCallback(async (onSubmit: (data: T) => Promise<void>) => {
    setState(prevState => ({ ...prevState, isSubmitting: true }));

    try {
      // Validate before submission
      if (!validateForm()) {
        throw new Error('Please correct the highlighted errors');
      }

      // Submit with sanitized data
      await onSubmit(state.sanitizedData);

      // Log successful submission
      if (config.logActivity) {
        logger.info('Secure form submitted successfully', {
          dataKeys: Object.keys(state.sanitizedData)
        });
      }

    } catch (error) {
      // Use error taxonomy for user-friendly messages
      const userError = createUserFriendlyError(error as Error, {
        formType: 'financial',
        operation: 'submit'
      });

      setState(prevState => ({
        ...prevState,
        errors: { general: userError.message } as any
      }));

      throw userError;
    } finally {
      setState(prevState => ({ ...prevState, isSubmitting: false }));
    }
  }, [state.sanitizedData, validateForm, config.logActivity]);

  /**
   * Reset form to initial state
   */
  const resetForm = useCallback(() => {
    setState({
      data: initialData,
      sanitizedData: initialData,
      errors: {},
      isValid: false,
      isSubmitting: false
    });
  }, [initialData]);

  /**
   * Get security audit report for form
   */
  const getSecurityAudit = useCallback(() => {
    const sanitizationEvents = Object.keys(state.data).filter(key =>
      state.data[key] !== state.sanitizedData[key]
    );

    return {
      fieldCount: Object.keys(state.data).length,
      sanitizationEvents: sanitizationEvents.length,
      sanitizedFields: sanitizationEvents,
      isSecure: sanitizationEvents.length === 0,
      lastValidation: state.isValid
    };
  }, [state.data, state.sanitizedData, state.isValid]);

  return {
    // Form state
    data: state.data,
    sanitizedData: state.sanitizedData,
    errors: state.errors,
    isValid: state.isValid,
    isSubmitting: state.isSubmitting,

    // Actions
    updateField,
    validateForm,
    submitForm,
    resetForm,

    // Security utilities
    getSecurityAudit,

    // Individual field sanitization
    sanitizeField
  };
}