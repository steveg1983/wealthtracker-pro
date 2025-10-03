/**
 * useLocalStorage Hook - Persistent state management using localStorage
 *
 * Features:
 * - Automatic persistence to localStorage
 * - Type-safe with TypeScript
 * - SSR-safe (no localStorage on server)
 * - Error handling
 * - JSON serialization
 * - Optional default values
 */

import { useState, useEffect, useCallback } from 'react';

type SetValue<T> = T | ((val: T) => T);

export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: SetValue<T>) => void, () => void] {
  // Get from local storage then parse stored json or return initialValue
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return initialValue;
    }

    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  // Return a wrapped version of useState's setter function that persists the new value to localStorage
  const setValue = useCallback(
    (value: SetValue<T>) => {
      try {
        // Allow value to be a function so we have the same API as useState
        const valueToStore = value instanceof Function ? value(storedValue) : value;

        // Save state
        setStoredValue(valueToStore);

        // Save to local storage
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(key, JSON.stringify(valueToStore));
        }
      } catch (error) {
        console.error(`Error setting localStorage key "${key}":`, error);
      }
    },
    [key, storedValue]
  );

  // Remove item from localStorage
  const removeValue = useCallback(() => {
    try {
      setStoredValue(initialValue);
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(key);
      }
    } catch (error) {
      console.error(`Error removing localStorage key "${key}":`, error);
    }
  }, [key, initialValue]);

  // Listen for changes to the localStorage key from other tabs/windows
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key && e.newValue !== null) {
        try {
          setStoredValue(JSON.parse(e.newValue));
        } catch (error) {
          console.warn(`Error parsing localStorage change for key "${key}":`, error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [key]);

  return [storedValue, setValue, removeValue];
}

// Hook with additional features like expiration
export function useLocalStorageWithExpiry<T>(
  key: string,
  initialValue: T,
  ttl?: number // Time to live in milliseconds
): [T, (value: SetValue<T>) => void, () => void, boolean] {
  const [value, setValue, removeValue] = useLocalStorage(key, initialValue);
  const [isExpired, setIsExpired] = useState(false);

  // Check if stored value is expired
  useEffect(() => {
    if (typeof window === 'undefined' || !ttl) {
      return;
    }

    try {
      const item = window.localStorage.getItem(`${key}_meta`);
      if (item) {
        const meta = JSON.parse(item);
        const now = Date.now();
        if (now > meta.expiry) {
          setIsExpired(true);
          removeValue();
          window.localStorage.removeItem(`${key}_meta`);
        }
      }
    } catch (error) {
      console.warn(`Error checking expiry for localStorage key "${key}":`, error);
    }
  }, [key, ttl, removeValue]);

  // Enhanced setValue that handles expiry
  const setValueWithExpiry = useCallback(
    (newValue: SetValue<T>) => {
      setValue(newValue);

      if (ttl && typeof window !== 'undefined') {
        try {
          const expiry = Date.now() + ttl;
          window.localStorage.setItem(`${key}_meta`, JSON.stringify({ expiry }));
          setIsExpired(false);
        } catch (error) {
          console.error(`Error setting expiry for localStorage key "${key}":`, error);
        }
      }
    },
    [setValue, ttl, key]
  );

  // Enhanced removeValue that handles expiry meta
  const removeValueWithExpiry = useCallback(() => {
    removeValue();
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(`${key}_meta`);
        setIsExpired(false);
      } catch (error) {
        console.error(`Error removing expiry meta for localStorage key "${key}":`, error);
      }
    }
  }, [removeValue, key]);

  return [value, setValueWithExpiry, removeValueWithExpiry, isExpired];
}

// Hook for storing arrays with helper methods
export function useLocalStorageArray<T>(
  key: string,
  initialValue: T[] = []
): [
  T[],
  {
    add: (item: T) => void;
    remove: (predicate: (item: T) => boolean) => void;
    update: (predicate: (item: T) => boolean, updater: (item: T) => T) => void;
    clear: () => void;
    set: (items: T[]) => void;
  }
] {
  const [array, setArray] = useLocalStorage<T[]>(key, initialValue);

  const add = useCallback(
    (item: T) => {
      setArray(prev => [...prev, item]);
    },
    [setArray]
  );

  const remove = useCallback(
    (predicate: (item: T) => boolean) => {
      setArray(prev => prev.filter(item => !predicate(item)));
    },
    [setArray]
  );

  const update = useCallback(
    (predicate: (item: T) => boolean, updater: (item: T) => T) => {
      setArray(prev =>
        prev.map(item => (predicate(item) ? updater(item) : item))
      );
    },
    [setArray]
  );

  const clear = useCallback(() => {
    setArray([]);
  }, [setArray]);

  const set = useCallback(
    (items: T[]) => {
      setArray(items);
    },
    [setArray]
  );

  return [
    array,
    {
      add,
      remove,
      update,
      clear,
      set
    }
  ];
}

// Hook for storing objects with helper methods
export function useLocalStorageObject<T extends Record<string, any>>(
  key: string,
  initialValue: T
): [
  T,
  {
    updateField: <K extends keyof T>(field: K, value: T[K]) => void;
    updateFields: (updates: Partial<T>) => void;
    reset: () => void;
    set: (obj: T) => void;
  }
] {
  const [obj, setObj] = useLocalStorage<T>(key, initialValue);

  const updateField = useCallback(
    <K extends keyof T>(field: K, value: T[K]) => {
      setObj(prev => ({ ...prev, [field]: value }));
    },
    [setObj]
  );

  const updateFields = useCallback(
    (updates: Partial<T>) => {
      setObj(prev => ({ ...prev, ...updates }));
    },
    [setObj]
  );

  const reset = useCallback(() => {
    setObj(initialValue);
  }, [setObj, initialValue]);

  const set = useCallback(
    (newObj: T) => {
      setObj(newObj);
    },
    [setObj]
  );

  return [
    obj,
    {
      updateField,
      updateFields,
      reset,
      set
    }
  ];
}

// Utility functions for localStorage operations
export const localStorageUtils = {
  // Get all keys with a prefix
  getKeysWithPrefix: (prefix: string): string[] => {
    if (typeof window === 'undefined') return [];

    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        keys.push(key);
      }
    }
    return keys;
  },

  // Clear all keys with a prefix
  clearKeysWithPrefix: (prefix: string): void => {
    if (typeof window === 'undefined') return;

    const keys = localStorageUtils.getKeysWithPrefix(prefix);
    keys.forEach(key => window.localStorage.removeItem(key));
  },

  // Get storage usage estimate
  getStorageUsage: (): { used: number; total: number; available: number } => {
    if (typeof window === 'undefined') {
      return { used: 0, total: 0, available: 0 };
    }

    let used = 0;
    for (let key in window.localStorage) {
      if (window.localStorage.hasOwnProperty(key)) {
        used += window.localStorage[key].length + key.length;
      }
    }

    // Rough estimate of localStorage limit (usually 5-10MB)
    const total = 5 * 1024 * 1024; // 5MB estimate
    const available = total - used;

    return { used, total, available };
  },

  // Check if localStorage is available
  isAvailable: (): boolean => {
    if (typeof window === 'undefined') return false;

    try {
      const testKey = '__localStorage_test__';
      window.localStorage.setItem(testKey, 'test');
      window.localStorage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  }
};

export default useLocalStorage;