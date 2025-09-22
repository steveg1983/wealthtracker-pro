import { useState, useCallback } from 'react';
import { lazyLogger as logger } from '../services/serviceFactory';

interface UseModalFormOptions<T> {
  onSubmit: (data: T) => void | Promise<void>;
  onClose: () => void;
  resetOnClose?: boolean;
}

export function useModalForm<T>(
  initialState: T | (() => T),
  { onSubmit, onClose, resetOnClose = true }: UseModalFormOptions<T>
) {
  // Store the initial value once to avoid recalculating
  const [initialValue] = useState<T>(() => 
    typeof initialState === 'function' ? (initialState as () => T)() : initialState
  );
  
  const [formData, setFormData] = useState<T>(initialValue);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const updateField = useCallback(<K extends keyof T>(field: K, value: T[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error for this field when it's updated
    setErrors(prev => {
      if (prev[field as string]) {
        const newErrors = { ...prev };
        delete newErrors[field as string];
        return newErrors;
      }
      return prev;
    });
  }, []);

  const setFieldError = useCallback((field: keyof T, error: string) => {
    setErrors(prev => ({ ...prev, [field as string]: error }));
  }, []);

  const clearErrors = useCallback(() => {
    setErrors({});
  }, []);

  const reset = useCallback(() => {
    // Reset to the stored initial value
    setFormData(initialValue);
    setErrors({});
    setIsSubmitting(false);
  }, [initialValue]);

  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }

    setIsSubmitting(true);
    clearErrors();

    try {
      await onSubmit(formData);
      
      // Reset form after successful submission
      if (resetOnClose) {
        reset();
      }
      
      onClose();
    } catch (error) {
      logger.error('Form submission error:', error);
      setErrors({ submit: error instanceof Error ? error.message : 'An error occurred' });
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, onSubmit, onClose, resetOnClose, clearErrors, reset]);

  return {
    formData,
    setFormData,
    updateField,
    errors,
    setFieldError,
    clearErrors,
    isSubmitting,
    handleSubmit,
    reset
  };
}