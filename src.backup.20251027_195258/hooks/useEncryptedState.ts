/**
 * useEncryptedState Hook
 * React hook for managing encrypted state values
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { enhancedEncryption } from '../security/encryption-enhanced';
import type { EncryptedData } from '../security/encryption-enhanced';
import { logger } from '../services/loggingService';

interface UseEncryptedStateOptions {
  autoDecrypt?: boolean;
  storageKey?: string;
  persist?: boolean;
}

type SetEncryptedState<T> = (value: T | ((prev: T) => T)) => void;

export function useEncryptedState<T>(
  initialValue: T,
  options: UseEncryptedStateOptions = {}
): [T, SetEncryptedState<T>, boolean, Error | null] {
  const { autoDecrypt = true, storageKey, persist = false } = options;

  const [decryptedValue, setDecryptedValue] = useState<T>(initialValue);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const isInitialized = useRef(false);

  const loadPersistedValue = useCallback(async () => {
    if (!storageKey || !persist) {
      return;
    }

    setIsLoading(true);
    try {
      const stored = localStorage.getItem(storageKey);
      if (!stored) {
        return;
      }

      const parsed = JSON.parse(stored) as EncryptedData;

      if (autoDecrypt) {
        const decrypted = enhancedEncryption.decrypt<T>(parsed);
        setDecryptedValue(decrypted);
      }
    } catch (err) {
      const loadError = err instanceof Error ? err : new Error('Failed to load encrypted value');
      setError(loadError);
      logger.error('Failed to load encrypted value:', err);
    } finally {
      setIsLoading(false);
    }
  }, [autoDecrypt, persist, storageKey]);

  useEffect(() => {
    const init = async () => {
      if (isInitialized.current) {
        return;
      }

      try {
        await enhancedEncryption.initialize();
        isInitialized.current = true;
        await loadPersistedValue();
      } catch (err) {
        const initError = err instanceof Error ? err : new Error('Failed to initialize encryption');
        setError(initError);
        logger.error('Failed to initialize encryption:', err);
      }
    };

    void init();
  }, [loadPersistedValue]);

  const setValue: SetEncryptedState<T> = useCallback((value) => {
    setError(null);

    setDecryptedValue(prev => {
      const resolvedValue = typeof value === 'function' ? (value as (previous: T) => T)(prev) : value;

      try {
        const encrypted = enhancedEncryption.encrypt(resolvedValue);

        if (storageKey && persist) {
          localStorage.setItem(storageKey, JSON.stringify(encrypted));
        }

        return resolvedValue;
      } catch (err) {
        const encryptionError = err instanceof Error ? err : new Error('Failed to encrypt value');
        setError(encryptionError);
        logger.error('Failed to encrypt value:', err);
        return prev;
      }
    });
  }, [persist, storageKey]);

  return [decryptedValue, setValue, isLoading, error];
}

// Specialized hook for encrypted form data
export function useEncryptedForm<T extends Record<string, unknown>>(
  initialValues: T,
  options: UseEncryptedStateOptions = {}
): {
  values: T;
  setFieldValue: <K extends keyof T>(field: K, value: T[K]) => void;
  setValues: SetEncryptedState<T>;
  getEncryptedValues: () => string | null;
  isLoading: boolean;
  error: Error | null;
} {
  const [values, setValues, isLoading, error] = useEncryptedState(initialValues, options);

  const setFieldValue = useCallback(<K extends keyof T>(field: K, value: T[K]) => {
    setValues(prev => ({
      ...prev,
      [field]: value
    }));
  }, [setValues]);

  const getEncryptedValues = useCallback((): string | null => {
    try {
      const encrypted = enhancedEncryption.encrypt(values);
      return JSON.stringify(encrypted);
    } catch (err) {
      logger.error('Failed to encrypt form values:', err);
      return null;
    }
  }, [values]);

  return {
    values,
    setFieldValue,
    setValues,
    getEncryptedValues,
    isLoading,
    error
  };
}
