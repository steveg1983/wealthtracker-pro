/**
 * preferencesSlice Tests
 * Redux slice actions and reducers
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import preferencesReducer, { 
  setTheme, 
  setColorTheme, 
  setCurrency, 
  setCompactView, 
  setPageVisibility, 
  setGoalCelebration, 
  setFirstName,
  setThemeSchedule,
  updatePreferences,
  type PreferencesState
} from './preferencesSlice';

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
global.localStorage = mockLocalStorage as any;

describe('preferencesSlice', () => {
  let store: any;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue(null);
    
    store = configureStore({
      reducer: {
        preferences: preferencesReducer,
      },
    });
  });

  it('has correct initial state', () => {
    const state = store.getState().preferences;
    expect(state).toEqual({
      theme: 'auto',
      colorTheme: 'green',
      currency: 'GBP',
      compactView: true,
      pageVisibility: {
        showBudget: true,
        showGoals: true,
        showAnalytics: true,
      },
      goalCelebration: true,
      firstName: '',
    });
  });

  it('loads preferences from localStorage', async () => {
    const storedPrefs = {
      theme: 'dark',
      colorTheme: 'blue', 
      currency: 'USD',
    };
    mockLocalStorage.getItem.mockReturnValue(JSON.stringify(storedPrefs));
    
    // Need to re-import the module to trigger initial state loading
    vi.resetModules();
    const { default: freshReducer } = await import('./preferencesSlice');
    
    const newStore = configureStore({
      reducer: {
        preferences: freshReducer,
      },
    });
    
    const state = newStore.getState().preferences;
    expect(state.theme).toBe('dark');
    expect(state.colorTheme).toBe('blue');
    expect(state.currency).toBe('USD');
  });

  it('handles setTheme action', () => {
    store.dispatch(setTheme('dark'));
    
    const state = store.getState().preferences;
    expect(state.theme).toBe('dark');
    expect(mockLocalStorage.setItem).toHaveBeenCalled();
  });

  it('handles setColorTheme action', () => {
    store.dispatch(setColorTheme('purple'));
    
    const state = store.getState().preferences;
    expect(state.colorTheme).toBe('purple');
    expect(mockLocalStorage.setItem).toHaveBeenCalled();
  });

  it('handles setCurrency action', () => {
    store.dispatch(setCurrency('EUR'));
    
    const state = store.getState().preferences;
    expect(state.currency).toBe('EUR');
    expect(mockLocalStorage.setItem).toHaveBeenCalled();
  });

  it('handles setCompactView action', () => {
    store.dispatch(setCompactView(false));
    
    const state = store.getState().preferences;
    expect(state.compactView).toBe(false);
    expect(mockLocalStorage.setItem).toHaveBeenCalled();
  });

  it('handles setPageVisibility action', () => {
    store.dispatch(setPageVisibility({ showBudget: false, showGoals: false }));
    
    const state = store.getState().preferences;
    expect(state.pageVisibility).toEqual({
      showBudget: false,
      showGoals: false,
      showAnalytics: true, // Unchanged
    });
    expect(mockLocalStorage.setItem).toHaveBeenCalled();
  });

  it('handles setGoalCelebration action', () => {
    store.dispatch(setGoalCelebration(false));
    
    const state = store.getState().preferences;
    expect(state.goalCelebration).toBe(false);
    expect(mockLocalStorage.setItem).toHaveBeenCalled();
  });

  it('handles setFirstName action', () => {
    store.dispatch(setFirstName('John'));
    
    const state = store.getState().preferences;
    expect(state.firstName).toBe('John');
    expect(mockLocalStorage.setItem).toHaveBeenCalled();
  });

  it('handles setThemeSchedule action', () => {
    const schedule = {
      startTime: '08:00',
      endTime: '20:00',
      theme: 'light' as const,
    };
    
    store.dispatch(setThemeSchedule(schedule));
    
    const state = store.getState().preferences;
    expect(state.themeSchedule).toEqual(schedule);
    expect(mockLocalStorage.setItem).toHaveBeenCalled();
  });

  it('handles updatePreferences action', () => {
    const updates: Partial<PreferencesState> = {
      theme: 'scheduled',
      currency: 'JPY',
      firstName: 'Jane',
    };
    
    store.dispatch(updatePreferences(updates));
    
    const state = store.getState().preferences;
    expect(state.theme).toBe('scheduled');
    expect(state.currency).toBe('JPY');
    expect(state.firstName).toBe('Jane');
    expect(mockLocalStorage.setItem).toHaveBeenCalled();
  });

  it('handles localStorage errors gracefully', () => {
    // Mock localStorage.setItem to throw an error
    mockLocalStorage.setItem.mockImplementation(() => {
      throw new Error('Storage full');
    });
    
    // This should not throw
    expect(() => {
      store.dispatch(setTheme('dark'));
    }).not.toThrow();
  });
});
