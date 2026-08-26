/**
 * PreferencesContext — context provider and consumer behaviour.
 *
 * These read and write through `preferences` (services/preferencesService)
 * rather than through `localStorage`, because that is where the context now
 * keeps its values: the point of the change is that a currency or a theme
 * belongs to the ACCOUNT and follows it, instead of living in one browser and
 * vanishing from every backup.
 *
 * The store is used for real, not mocked. It is a plain in-memory document with
 * an injectable browser mirror, so there is nothing to fake — and a mock would
 * only prove that the context calls a function, whereas these prove the value
 * comes back.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { PreferencesProvider, usePreferences } from './PreferencesContext';
import { preferences } from '../services/preferencesService';

describe('PreferencesContext', () => {
  beforeEach(() => {
    // Empties the in-memory document the way signing out does. The service is a
    // module-level singleton shared with every other suite in the process, so
    // without this a value set here would leak into the next case.
    preferences.detach();
    localStorage.clear();
  });

  it('provides default preferences values', () => {
    const { result } = renderHook(() => usePreferences(), {
      wrapper: PreferencesProvider,
    });

    expect(result.current.compactView).toBe(true); // Default is true (compact view)
    expect(result.current.currency).toBe('GBP');
    expect(result.current.theme).toBe('light');
  });

  it('loads preferences from the stored document', () => {
    preferences.setItem('money_management_compact_view', 'true');
    preferences.setItem('money_management_currency', 'USD');
    preferences.setItem('money_management_theme', 'dark');

    const { result } = renderHook(() => usePreferences(), {
      wrapper: PreferencesProvider,
    });

    expect(result.current.compactView).toBe(true);
    expect(result.current.currency).toBe('USD');
    expect(result.current.theme).toBe('dark');
  });

  it('reads a preference this browser holds but the document has not seen yet', () => {
    // The first boot after this shipped: every setting the user already has is
    // in browser storage under exactly these keys, and must not be forgotten in
    // the window before the account's document arrives.
    localStorage.setItem('money_management_currency', 'USD');

    const { result } = renderHook(() => usePreferences(), {
      wrapper: PreferencesProvider,
    });

    expect(result.current.currency).toBe('USD');
  });

  it('saves preferences when changed', async () => {
    const { result } = renderHook(() => usePreferences(), {
      wrapper: PreferencesProvider,
    });

    act(() => {
      result.current.setCurrency('EUR');
    });

    // The context batches its write-through by 300ms.
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 400));
    });

    expect(preferences.getItem('money_management_currency')).toBe('EUR');
    // …and into the browser mirror as well, which is what makes the setting
    // survive a reload with no network.
    expect(localStorage.getItem('money_management_currency')).toBe('EUR');
  });

  it('falls back to defaults when a stored value is unusable', () => {
    preferences.setItem('money_management_theme', 'chartreuse');
    preferences.setItem('money_management_theme_schedule', '{not json');

    const { result } = renderHook(() => usePreferences(), {
      wrapper: PreferencesProvider,
    });

    expect(result.current.currency).toBe('GBP');
    expect(result.current.theme).toBe('light');
    expect(result.current.themeSchedule).toEqual({
      enabled: false,
      lightStartTime: '06:00',
      darkStartTime: '18:00',
    });
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
