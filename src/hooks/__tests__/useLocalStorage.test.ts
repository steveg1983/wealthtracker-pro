import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLocalStorage } from '../useLocalStorage';

describe('useLocalStorage', () => {
  const storage = new Map<string, string>();
  
  beforeEach(() => {
    // Clear and setup localStorage mock
    storage.clear();
    vi.mocked(localStorage.getItem).mockImplementation(key => storage.get(key) || null);
    vi.mocked(localStorage.setItem).mockImplementation((key, value) => {
      storage.set(key, value);
    });
    vi.mocked(localStorage.removeItem).mockImplementation(key => {
      storage.delete(key);
    });
    vi.mocked(localStorage.clear).mockImplementation(() => {
      storage.clear();
    });
  });

  it('returns initial value when no stored value exists', () => {
    const { result } = renderHook(() => useLocalStorage('testKey', 'initialValue'));
    
    expect(result.current[0]).toBe('initialValue');
  });

  it('returns stored value when it exists', async () => {
    storage.set('testKey', JSON.stringify('storedValue'));
    
    const { result } = renderHook(() => useLocalStorage('testKey', 'initialValue'));
    
    expect(result.current[0]).toBe('storedValue');
  });

  it('updates localStorage when value changes', async () => {
    const { result } = renderHook(() => useLocalStorage('testKey', 'initialValue'));
    
    await act(async () => {
      result.current[1]('newValue');
    });
    
    expect(result.current[0]).toBe('newValue');
    expect(localStorage.getItem('testKey')).toBe(JSON.stringify('newValue'));
  });

  it('handles complex objects', async () => {
    const complexObject = {
      name: 'Test',
      nested: {
        value: 123,
        array: [1, 2, 3]
      }
    };
    
    const { result } = renderHook(() => useLocalStorage('testKey', complexObject));
    
    expect(result.current[0]).toEqual(complexObject);
    
    const updatedObject = { ...complexObject, name: 'Updated' };
    
    await act(async () => {
      result.current[1](updatedObject);
    });
    
    expect(result.current[0]).toEqual(updatedObject);
    expect(JSON.parse(storage.get('testKey')!)).toEqual(updatedObject);
  });

  it('handles errors when parsing invalid JSON', () => {
    storage.set('testKey', 'invalid json');
    
    const { result } = renderHook(() => useLocalStorage('testKey', 'fallback'));
    
    expect(result.current[0]).toBe('fallback');
  });

  it('updates value when localStorage changes in another tab', async () => {
    const { result } = renderHook(() => useLocalStorage('testKey', 'initialValue'));
    
    // Simulate storage event from another tab
    await act(async () => {
      storage.set('testKey', JSON.stringify('valueFromAnotherTab'));
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'testKey',
        newValue: JSON.stringify('valueFromAnotherTab')
      }));
    });
    
    // Wait for the event to be processed
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    
    expect(result.current[0]).toBe('valueFromAnotherTab');
  });

  it('ignores storage events for different keys', async () => {
    const { result } = renderHook(() => useLocalStorage('testKey', 'initialValue'));
    
    await act(async () => {
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'differentKey',
        newValue: JSON.stringify('someValue')
      }));
    });
    
    expect(result.current[0]).toBe('initialValue');
  });

  it('handles null values', async () => {
    const { result } = renderHook(() => useLocalStorage('testKey', null));
    
    expect(result.current[0]).toBe(null);
    
    await act(async () => {
      result.current[1]('notNull');
    });
    
    expect(result.current[0]).toBe('notNull');
    
    await act(async () => {
      result.current[1](null);
    });
    
    expect(result.current[0]).toBe(null);
  });

  it('uses function initializer', () => {
    const initializer = () => ({ computed: true, value: 42 });
    
    const { result } = renderHook(() => useLocalStorage('testKey', initializer));
    
    expect(result.current[0]).toEqual({ computed: true, value: 42 });
  });

  it('clears value when setting undefined', async () => {
    const { result } = renderHook(() => useLocalStorage('testKey', 'initialValue'));
    
    await act(async () => {
      result.current[1]('someValue');
    });
    
    expect(storage.get('testKey')).toBe(JSON.stringify('someValue'));
    
    await act(async () => {
      result.current[1](undefined);
    });
    
    expect(storage.get('testKey')).toBe(undefined);
  });
});