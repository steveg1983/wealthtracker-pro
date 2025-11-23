/**
 * useEncryptedState Hook
 * React hook for managing encrypted state values
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { enhancedEncryption, EncryptedData } from '../security/encryption-enhanced';
import { useMemoizedLogger } from '../loggers/useMemoizedLogger';

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
  const { autoDecrypt: _autoDecrypt = true, storageKey, persist = false } = options;
  const logger = useMemoizedLogger('useEncryptedState');
  
  const [decryptedValue, setDecryptedValue] = useState<T>(initialValue);
  const [encryptedData, setEncryptedData] = useState<EncryptedData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const isInitialized = useRef(false);

  // Load value from storage
  const loadPersistedValue = useCallback(async () => {
    if (!storageKey) return;

    setIsLoading(true);
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const encryptedData = JSON.parse(stored) as EncryptedData;
        const decrypted = enhancedEncryption.decrypt<T>(encryptedData);
        setDecryptedValue(decrypted);
        setEncryptedData(encryptedData);
      }
    } catch (err) {
      setError(err as Error);
      logger.error?.('Failed to load encrypted value', err);
    } finally {
      setIsLoading(false);
    }
  }, [storageKey, logger]);

  // Initialize encryption service
  useEffect(() => {
    const init = async () => {
      if (isInitialized.current) return;

      try {
        await enhancedEncryption.initialize();
        isInitialized.current = true;

        // Load persisted value if storage key is provided
        if (storageKey && persist) {
          await loadPersistedValue();
        }
      } catch (err) {
        setError(err as Error);
        logger.error?.('Failed to initialize encryption', err);
      }
    };

    init();
  }, [storageKey, persist, logger, loadPersistedValue]);

  // Set encrypted value
  const setValue: SetEncryptedState<T> = useCallback((value) => {
    setError(null);
    
    try {
      // Handle function updates
      const newValue = typeof value === 'function' 
        ? (value as (prev: T) => T)(decryptedValue)
        : value;
      
      // Update decrypted value immediately
      setDecryptedValue(newValue);
      
      // Encrypt the new value
      const encrypted = enhancedEncryption.encrypt(newValue);
      setEncryptedData(encrypted);
      
      // Persist if enabled
      if (storageKey && persist) {
        localStorage.setItem(storageKey, JSON.stringify(encrypted));
      }
    } catch (err) {
      setError(err as Error);
      logger.error?.('Failed to encrypt value', err);
    }
  }, [decryptedValue, storageKey, persist, logger]);

  // Get encrypted data as string
  const _getEncryptedString = useCallback((): string | null => {
    return encryptedData ? JSON.stringify(encryptedData) : null;
  }, [encryptedData]);

  // Clear encrypted data
  const _clear = useCallback(() => {
    setDecryptedValue(initialValue);
    setEncryptedData(null);
    setError(null);

    if (storageKey) {
      localStorage.removeItem(storageKey);
    }
  }, [initialValue, storageKey]);

  // Export encrypted data
  const _exportEncryptedData = useCallback((): EncryptedData | null => {
    return encryptedData;
  }, [encryptedData]);

  // Import encrypted data
  const _importEncryptedData = useCallback((data: EncryptedData) => {
    try {
      const decrypted = enhancedEncryption.decrypt<T>(data);
      setDecryptedValue(decrypted);
      setEncryptedData(data);
      
      if (storageKey && persist) {
        localStorage.setItem(storageKey, JSON.stringify(data));
      }
    } catch (err) {
      setError(err as Error);
      logger.error?.('Failed to import encrypted data', err);
    }
  }, [storageKey, persist, logger]);

  return [decryptedValue, setValue, isLoading, error];
}

// Specialized hook for encrypted form data
export function useEncryptedForm<T extends Record<string, unknown>>(
  initialValues: T,
  options: UseEncryptedStateOptions = {}
): {
  values: T;
  setFieldValue: (field: keyof T, value: unknown) => void;
  setValues: (values: T) => void;
  getEncryptedValues: () => string | null;
  isLoading: boolean;
  error: Error | null;
} {
  const [values, setValues, isLoading, error] = useEncryptedState(initialValues, options);

  const setFieldValue = useCallback((field: keyof T, value: unknown) => {
    setValues(prev => ({
      ...prev,
      [field]: value
    }));
  }, [setValues]);

  const getEncryptedValues = useCallback((): string | null => {
    try {
      const encrypted = enhancedEncryption.encrypt(values);
      return JSON.stringify(encrypted);
    } catch {
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
