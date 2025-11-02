import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { render, screen } from '@testing-library/react';
import { PreferencesProvider, usePreferences } from '../PreferencesContextSafe';

describe('PreferencesContextSafe', () => {
  beforeEach(() => {
    // Clear console mocks
    vi.clearAllMocks();
  });

  describe('PreferencesProvider', () => {
    it('provides default values', () => {
      const { result } = renderHook(() => usePreferences(), {
        wrapper: PreferencesProvider
      });

      expect(result.current.compactView).toBe(true);
      expect(result.current.currency).toBe('GBP');
      expect(result.current.theme).toBe('light');
      expect(result.current.actualTheme).toBe('light');
      expect(result.current.colorTheme).toBe('blue');
      expect(result.current.firstName).toBe('');
      expect(result.current.showBudget).toBe(true);
      expect(result.current.showGoals).toBe(true);
      expect(result.current.showAnalytics).toBe(true);
      expect(result.current.enableGoalCelebrations).toBe(true);
      expect(result.current.themeSchedule).toEqual({
        enabled: false,
        lightStartTime: '06:00',
        darkStartTime: '18:00'
      });
    });

    it('logs initialization messages', () => {
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      render(
        <PreferencesProvider>
          <div>Test</div>
        </PreferencesProvider>
      );

      expect(consoleLogSpy).toHaveBeenCalledWith('PreferencesProvider initializing...');
      expect(consoleLogSpy).toHaveBeenCalledWith('PreferencesProvider state initialized');
      expect(consoleLogSpy).toHaveBeenCalledWith('PreferencesProvider rendering with value:', expect.any(Object));

      consoleLogSpy.mockRestore();
    });

    it('renders children', () => {
      render(
        <PreferencesProvider>
          <div data-testid="child">Test Child</div>
        </PreferencesProvider>
      );

      expect(screen.getByTestId('child')).toBeInTheDocument();
      expect(screen.getByText('Test Child')).toBeInTheDocument();
    });
  });

  describe('usePreferences hook', () => {
    it('throws error when used outside provider', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => usePreferences());
      }).toThrow('usePreferences must be used within PreferencesProvider');

      consoleErrorSpy.mockRestore();
    });

    it('updates compactView', () => {
      const { result } = renderHook(() => usePreferences(), {
        wrapper: PreferencesProvider
      });

      expect(result.current.compactView).toBe(true);

      act(() => {
        result.current.setCompactView(false);
      });

      expect(result.current.compactView).toBe(false);
    });

    it('updates currency', () => {
      const { result } = renderHook(() => usePreferences(), {
        wrapper: PreferencesProvider
      });

      expect(result.current.currency).toBe('GBP');

      act(() => {
        result.current.setCurrency('USD');
      });

      expect(result.current.currency).toBe('USD');
    });

    it('updates theme', () => {
      const { result } = renderHook(() => usePreferences(), {
        wrapper: PreferencesProvider
      });

      expect(result.current.theme).toBe('light');

      act(() => {
        result.current.setTheme('dark');
      });

      expect(result.current.theme).toBe('dark');

      act(() => {
        result.current.setTheme('auto');
      });

      expect(result.current.theme).toBe('auto');

      act(() => {
        result.current.setTheme('scheduled');
      });

      expect(result.current.theme).toBe('scheduled');
    });

    it('updates color theme', () => {
      const { result } = renderHook(() => usePreferences(), {
        wrapper: PreferencesProvider
      });

      expect(result.current.colorTheme).toBe('blue');

      act(() => {
        result.current.setColorTheme('green');
      });

      expect(result.current.colorTheme).toBe('green');

      act(() => {
        result.current.setColorTheme('red');
      });

      expect(result.current.colorTheme).toBe('red');

      act(() => {
        result.current.setColorTheme('pink');
      });

      expect(result.current.colorTheme).toBe('pink');
    });

    it('updates first name', () => {
      const { result } = renderHook(() => usePreferences(), {
        wrapper: PreferencesProvider
      });

      expect(result.current.firstName).toBe('');

      act(() => {
        result.current.setFirstName('John');
      });

      expect(result.current.firstName).toBe('John');
    });

    it('updates theme schedule', () => {
      const { result } = renderHook(() => usePreferences(), {
        wrapper: PreferencesProvider
      });

      const newSchedule = {
        enabled: true,
        lightStartTime: '07:00',
        darkStartTime: '19:00'
      };

      act(() => {
        result.current.setThemeSchedule(newSchedule);
      });

      expect(result.current.themeSchedule).toEqual(newSchedule);
    });

    it('updates page visibility settings', () => {
      const { result } = renderHook(() => usePreferences(), {
        wrapper: PreferencesProvider
      });

      // Test showBudget
      expect(result.current.showBudget).toBe(true);
      act(() => {
        result.current.setShowBudget(false);
      });
      expect(result.current.showBudget).toBe(false);

      // Test showGoals
      expect(result.current.showGoals).toBe(true);
      act(() => {
        result.current.setShowGoals(false);
      });
      expect(result.current.showGoals).toBe(false);

      // Test showAnalytics
      expect(result.current.showAnalytics).toBe(true);
      act(() => {
        result.current.setShowAnalytics(false);
      });
      expect(result.current.showAnalytics).toBe(false);
    });

    it('updates goal celebrations setting', () => {
      const { result } = renderHook(() => usePreferences(), {
        wrapper: PreferencesProvider
      });

      expect(result.current.enableGoalCelebrations).toBe(true);

      act(() => {
        result.current.setEnableGoalCelebrations(false);
      });

      expect(result.current.enableGoalCelebrations).toBe(false);
    });

    it('maintains actualTheme as light', () => {
      const { result } = renderHook(() => usePreferences(), {
        wrapper: PreferencesProvider
      });

      // actualTheme should always be 'light' in this safe version
      expect(result.current.actualTheme).toBe('light');

      // Even after changing theme setting
      act(() => {
        result.current.setTheme('dark');
      });

      expect(result.current.actualTheme).toBe('light');
    });

    it('preserves state across re-renders', () => {
      const { result, rerender } = renderHook(() => usePreferences(), {
        wrapper: PreferencesProvider
      });

      act(() => {
        result.current.setCurrency('EUR');
        result.current.setFirstName('Jane');
        result.current.setCompactView(false);
      });

      expect(result.current.currency).toBe('EUR');
      expect(result.current.firstName).toBe('Jane');
      expect(result.current.compactView).toBe(false);

      rerender();

      expect(result.current.currency).toBe('EUR');
      expect(result.current.firstName).toBe('Jane');
      expect(result.current.compactView).toBe(false);
    });

    it('handles multiple simultaneous updates', () => {
      const { result } = renderHook(() => usePreferences(), {
        wrapper: PreferencesProvider
      });

      act(() => {
        result.current.setCurrency('USD');
        result.current.setTheme('dark');
        result.current.setColorTheme('green');
        result.current.setFirstName('Test User');
        result.current.setCompactView(false);
        result.current.setShowBudget(false);
        result.current.setShowGoals(false);
        result.current.setShowAnalytics(false);
        result.current.setEnableGoalCelebrations(false);
        result.current.setThemeSchedule({
          enabled: true,
          lightStartTime: '08:00',
          darkStartTime: '20:00'
        });
      });

      expect(result.current.currency).toBe('USD');
      expect(result.current.theme).toBe('dark');
      expect(result.current.colorTheme).toBe('green');
      expect(result.current.firstName).toBe('Test User');
      expect(result.current.compactView).toBe(false);
      expect(result.current.showBudget).toBe(false);
      expect(result.current.showGoals).toBe(false);
      expect(result.current.showAnalytics).toBe(false);
      expect(result.current.enableGoalCelebrations).toBe(false);
      expect(result.current.themeSchedule.enabled).toBe(true);
      expect(result.current.themeSchedule.lightStartTime).toBe('08:00');
      expect(result.current.themeSchedule.darkStartTime).toBe('20:00');
    });
  });

  describe('Component integration', () => {
    it('provides preferences to nested components', () => {
      const TestComponent = () => {
        const prefs = usePreferences();
        return (
          <div>
            <div data-testid="currency">{prefs.currency}</div>
            <div data-testid="theme">{prefs.theme}</div>
            <div data-testid="compact">{prefs.compactView ? 'true' : 'false'}</div>
          </div>
        );
      };

      render(
        <PreferencesProvider>
          <TestComponent />
        </PreferencesProvider>
      );

      expect(screen.getByTestId('currency')).toHaveTextContent('GBP');
      expect(screen.getByTestId('theme')).toHaveTextContent('light');
      expect(screen.getByTestId('compact')).toHaveTextContent('true');
    });

    it('updates are reflected in all consumers', () => {
      const TestComponent1 = () => {
        const { currency } = usePreferences();
        return <div data-testid="comp1">{currency}</div>;
      };

      const TestComponent2 = () => {
        const { currency, setCurrency } = usePreferences();
        return (
          <div>
            <div data-testid="comp2">{currency}</div>
            <button onClick={() => setCurrency('JPY')}>Change Currency</button>
          </div>
        );
      };

      const { getByRole } = render(
        <PreferencesProvider>
          <TestComponent1 />
          <TestComponent2 />
        </PreferencesProvider>
      );

      expect(screen.getByTestId('comp1')).toHaveTextContent('GBP');
      expect(screen.getByTestId('comp2')).toHaveTextContent('GBP');

      act(() => {
        getByRole('button').click();
      });

      expect(screen.getByTestId('comp1')).toHaveTextContent('JPY');
      expect(screen.getByTestId('comp2')).toHaveTextContent('JPY');
    });
  });
});
