/**
 * PreferencesContext Tests
 * Context provider and consumer behavior
 */

import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, fireEvent, waitFor, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderHook, act } from '@testing-library/react';
import { PreferencesProvider, usePreferences } from './PreferencesContext';

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
global.localStorage = mockLocalStorage as any;

describe('PreferencesContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock localStorage to return null initially
    mockLocalStorage.getItem.mockReturnValue(null);
  });

  it('provides default preferences values', () => {
    const { result } = renderHook(() => usePreferences(), {
      wrapper: PreferencesProvider,
    });

    expect(result.current.compactView).toBe(false);
    expect(result.current.currency).toBe('GBP');
    expect(result.current.theme).toBe('light');
    expect(result.current.colorTheme).toBe('blue');
    expect(result.current.firstName).toBe('');
  });

  it('loads preferences from localStorage', () => {
    mockLocalStorage.getItem.mockImplementation((key) => {
      switch (key) {
        case 'money_management_compact_view':
          return 'true';
        case 'money_management_currency':
          return 'USD';
        case 'money_management_theme':
          return 'dark';
        case 'money_management_color_theme':
          return 'green';
        case 'money_management_first_name':
          return 'John';
        default:
          return null;
      }
    });

    const { result } = renderHook(() => usePreferences(), {
      wrapper: PreferencesProvider,
    });

    expect(result.current.compactView).toBe(true);
    expect(result.current.currency).toBe('USD');
    expect(result.current.theme).toBe('dark');
    expect(result.current.colorTheme).toBe('green');
    expect(result.current.firstName).toBe('John');
  });

  it('saves preferences to localStorage when changed', async () => {
    const { result } = renderHook(() => usePreferences(), {
      wrapper: PreferencesProvider,
    });

    // Clear the initial calls to setItem
    mockLocalStorage.setItem.mockClear();

    act(() => {
      result.current.setCurrency('EUR');
    });

    // Wait for the debounced save (300ms + buffer)
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 400));
    });

    expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
      'money_management_currency',
      'EUR'
    );
  });

  it('handles invalid localStorage data gracefully', () => {
    mockLocalStorage.getItem.mockReturnValue(null);

    const { result } = renderHook(() => usePreferences(), {
      wrapper: PreferencesProvider,
    });

    // Should fall back to defaults
    expect(result.current.currency).toBe('GBP');
    expect(result.current.theme).toBe('light');
  });

  it('provides actualTheme based on system preference', () => {
    // Mock matchMedia
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(query => ({
        matches: query === '(prefers-color-scheme: dark)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    const { result } = renderHook(() => usePreferences(), {
      wrapper: PreferencesProvider,
    });

    act(() => {
      result.current.setTheme('auto');
    });

    expect(result.current.actualTheme).toBe('dark');
  });

});
