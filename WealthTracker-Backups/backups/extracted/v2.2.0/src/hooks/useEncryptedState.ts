/**
 * useEncryptedState Hook
 * React hook for managing encrypted state values
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { enhancedEncryption, EncryptedData } from '../security/encryption-enhanced';
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
  const [encryptedData, setEncryptedData] = useState<EncryptedData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const isInitialized = useRef(false);

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
        logger.error('Failed to initialize encryption:', err);
      }
    };
    
    init();
  }, [storageKey, persist]);

  // Load value from storage
  const loadPersistedValue = async () => {
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
      logger.error('Failed to load encrypted value:', err);
    } finally {
      setIsLoading(false);
    }
  };

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
      logger.error('Failed to encrypt value:', err);
    }
  }, [decryptedValue, storageKey, persist]);

  // Get encrypted data as string
  const getEncryptedString = useCallback((): string | null => {
    return encryptedData ? JSON.stringify(encryptedData) : null;
  }, [encryptedData]);

  // Clear encrypted data
  const clear = useCallback(() => {
    setDecryptedValue(initialValue);
    setEncryptedData(null);
    setError(null);
    
    if (storageKey) {
      localStorage.removeItem(storageKey);
    }
  }, [initialValue, storageKey]);

  // Export encrypted data
  const exportEncryptedData = useCallback((): EncryptedData | null => {
    return encryptedData;
  }, [encryptedData]);

  // Import encrypted data
  const importEncryptedData = useCallback((data: EncryptedData) => {
    try {
      const decrypted = enhancedEncryption.decrypt<T>(data);
      setDecryptedValue(decrypted);
      setEncryptedData(data);
      
      if (storageKey && persist) {
        localStorage.setItem(storageKey, JSON.stringify(data));
      }
    } catch (err) {
      setError(err as Error);
      logger.error('Failed to import encrypted data:', err);
    }
  }, [storageKey, persist]);

  return [decryptedValue, setValue, isLoading, error];
}

// Specialized hook for encrypted form data
export function useEncryptedForm<T extends Record<string, unknown>>(
  initialValues: T,
  options: UseEncryptedStateOptions = {}
): {
  values: T;
  setFieldValue: <K extends keyof T>(field: K, value: T[K]) => void;
  setValues: (values: T) => void;
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