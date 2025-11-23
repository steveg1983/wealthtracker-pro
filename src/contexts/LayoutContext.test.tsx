/**
 * LayoutContext Tests
 * Comprehensive tests for the layout context provider
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { ReactNode } from 'react';
import { LayoutProvider, useLayout } from './LayoutContext';

describe('LayoutContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <LayoutProvider>{children}</LayoutProvider>
  );

  describe('initialization', () => {
    it('provides default isWideView as false', () => {
      const { result } = renderHook(() => useLayout(), { wrapper });

      expect(result.current.isWideView).toBe(false);
    });

    it('provides setIsWideView function', () => {
      const { result } = renderHook(() => useLayout(), { wrapper });

      expect(typeof result.current.setIsWideView).toBe('function');
    });

    it('maintains consistent interface across renders', () => {
      const { result, rerender } = renderHook(() => useLayout(), { wrapper });

      const initialSetIsWideView = result.current.setIsWideView;

      rerender();

      expect(result.current.setIsWideView).toBe(initialSetIsWideView);
    });
  });

  describe('setIsWideView functionality', () => {
    it('updates isWideView to true', () => {
      const { result } = renderHook(() => useLayout(), { wrapper });

      expect(result.current.isWideView).toBe(false);

      act(() => {
        result.current.setIsWideView(true);
      });

      expect(result.current.isWideView).toBe(true);
    });

    it('updates isWideView to false', () => {
      const { result } = renderHook(() => useLayout(), { wrapper });

      // Set to true first
      act(() => {
        result.current.setIsWideView(true);
      });

      expect(result.current.isWideView).toBe(true);

      // Then set to false
      act(() => {
        result.current.setIsWideView(false);
      });

      expect(result.current.isWideView).toBe(false);
    });

    it('allows multiple state changes', () => {
      const { result } = renderHook(() => useLayout(), { wrapper });

      const states = [true, false, true, true, false, false, true];

      states.forEach((state) => {
        act(() => {
          result.current.setIsWideView(state);
        });

        expect(result.current.isWideView).toBe(state);
      });
    });

    it('handles rapid state changes', () => {
      const { result } = renderHook(() => useLayout(), { wrapper });

      act(() => {
        for (let i = 0; i < 100; i++) {
          result.current.setIsWideView(i % 2 === 0);
        }
      });

      // Should end up false (99 % 2 !== 0, so last call was setIsWideView(false))
      expect(result.current.isWideView).toBe(false);
    });

    it('allows multiple components to access same state', () => {
      const { result } = renderHook(() => {
        // Simulate multiple components using the hook
        const layout1 = useLayout();
        const layout2 = useLayout();
        return { layout1, layout2 };
      }, { wrapper });

      // Both should reference the same context state
      expect(result.current.layout1.isWideView).toBe(result.current.layout2.isWideView);

      act(() => {
        result.current.layout1.setIsWideView(true);
      });

      // Both should reflect the same state change
      expect(result.current.layout1.isWideView).toBe(true);
      expect(result.current.layout2.isWideView).toBe(true);

      act(() => {
        result.current.layout2.setIsWideView(false);
      });

      // Both should reflect the new state
      expect(result.current.layout1.isWideView).toBe(false);
      expect(result.current.layout2.isWideView).toBe(false);
    });
  });

  describe('state persistence', () => {
    it('maintains state across hook re-renders', () => {
      const { result, rerender } = renderHook(() => useLayout(), { wrapper });

      act(() => {
        result.current.setIsWideView(true);
      });

      expect(result.current.isWideView).toBe(true);

      rerender();

      expect(result.current.isWideView).toBe(true);
    });

    it('resets state when provider remounts', () => {
      const { result, unmount } = renderHook(() => useLayout(), { wrapper });

      act(() => {
        result.current.setIsWideView(true);
      });

      expect(result.current.isWideView).toBe(true);

      unmount();

      // Create new hook with new provider instance
      const { result: result2 } = renderHook(() => useLayout(), { wrapper });

      expect(result2.current.isWideView).toBe(false); // Back to default
    });
  });

  describe('error handling', () => {
    it('throws error when useLayout is used outside provider', () => {
      expect(() => {
        renderHook(() => useLayout());
      }).toThrow('useLayout must be used within a LayoutProvider');
    });

    it('provides proper error message', () => {
      let errorMessage = '';
      
      try {
        renderHook(() => useLayout());
      } catch (error) {
        errorMessage = (error as Error).message;
      }

      expect(errorMessage).toBe('useLayout must be used within a LayoutProvider');
    });
  });

  describe('boolean value handling', () => {
    it('handles explicit boolean values correctly', () => {
      const { result } = renderHook(() => useLayout(), { wrapper });

      act(() => {
        result.current.setIsWideView(true);
      });
      expect(result.current.isWideView).toBe(true);

      act(() => {
        result.current.setIsWideView(false);
      });
      expect(result.current.isWideView).toBe(false);
    });

    it('handles Boolean constructor calls', () => {
      const { result } = renderHook(() => useLayout(), { wrapper });

      act(() => {
        result.current.setIsWideView(Boolean(true));
      });
      expect(result.current.isWideView).toBe(true);

      act(() => {
        result.current.setIsWideView(Boolean(false));
      });
      expect(result.current.isWideView).toBe(false);

      act(() => {
        result.current.setIsWideView(Boolean(1));
      });
      expect(result.current.isWideView).toBe(true);

      act(() => {
        result.current.setIsWideView(Boolean(0));
      });
      expect(result.current.isWideView).toBe(false);

      act(() => {
        result.current.setIsWideView(Boolean('test'));
      });
      expect(result.current.isWideView).toBe(true);

      act(() => {
        result.current.setIsWideView(Boolean(''));
      });
      expect(result.current.isWideView).toBe(false);
    });

    it('handles double negation coercion', () => {
      const { result } = renderHook(() => useLayout(), { wrapper });

      act(() => {
        result.current.setIsWideView(!!'truthy');
      });
      expect(result.current.isWideView).toBe(true);

      act(() => {
        result.current.setIsWideView(!!0);
      });
      expect(result.current.isWideView).toBe(false);

      act(() => {
        result.current.setIsWideView(!!{});
      });
      expect(result.current.isWideView).toBe(true);

      act(() => {
        result.current.setIsWideView(!!null);
      });
      expect(result.current.isWideView).toBe(false);
    });
  });

  describe('real-world usage patterns', () => {
    it('simulates responsive design toggle', () => {
      const { result } = renderHook(() => useLayout(), { wrapper });

      // Simulate mobile view (default)
      expect(result.current.isWideView).toBe(false);

      // User switches to desktop/wide view
      act(() => {
        result.current.setIsWideView(true);
      });

      expect(result.current.isWideView).toBe(true);

      // User switches back to mobile view
      act(() => {
        result.current.setIsWideView(false);
      });

      expect(result.current.isWideView).toBe(false);
    });

    it('simulates window resize handling', () => {
      const { result } = renderHook(() => useLayout(), { wrapper });

      // Simulate different screen widths
      const screenSizes = [
        { width: 320, expected: false },   // Mobile
        { width: 768, expected: false },   // Tablet
        { width: 1024, expected: true },   // Desktop
        { width: 1440, expected: true },   // Large desktop
        { width: 600, expected: false },   // Back to tablet
      ];

      screenSizes.forEach(({ width, expected }) => {
        act(() => {
          // Simulate window resize logic
          result.current.setIsWideView(width >= 1024);
        });

        expect(result.current.isWideView).toBe(expected);
      });
    });

    it('simulates user preference toggle', () => {
      const { result } = renderHook(() => useLayout(), { wrapper });

      // User prefers compact view initially
      expect(result.current.isWideView).toBe(false);

      // User toggles to wide view
      act(() => {
        result.current.setIsWideView(!result.current.isWideView);
      });

      expect(result.current.isWideView).toBe(true);

      // User toggles back to compact view
      act(() => {
        result.current.setIsWideView(!result.current.isWideView);
      });

      expect(result.current.isWideView).toBe(false);

      // Multiple toggles
      for (let i = 0; i < 5; i++) {
        const currentState = result.current.isWideView;
        
        act(() => {
          result.current.setIsWideView(!result.current.isWideView);
        });

        expect(result.current.isWideView).toBe(!currentState);
      }
    });

    it('simulates conditional rendering based on layout', () => {
      const { result } = renderHook(() => useLayout(), { wrapper });

      // Compact view: show limited content
      expect(result.current.isWideView).toBe(false);
      const compactContent = result.current.isWideView ? 'full-sidebar' : 'mobile-menu';
      expect(compactContent).toBe('mobile-menu');

      // Wide view: show full content
      act(() => {
        result.current.setIsWideView(true);
      });

      const wideContent = result.current.isWideView ? 'full-sidebar' : 'mobile-menu';
      expect(wideContent).toBe('full-sidebar');
    });
  });

  describe('performance considerations', () => {
    it('does not cause unnecessary re-renders when setting same value', () => {
      const { result: _result } = renderHook(() => useLayout(), { wrapper });
      
      let renderCount = 0;
      const { result: trackingResult } = renderHook(() => {
        renderCount++;
        return useLayout();
      }, { wrapper });

      const initialRenderCount = renderCount;

      // Set to same value multiple times
      act(() => {
        trackingResult.current.setIsWideView(false);
        trackingResult.current.setIsWideView(false);
        trackingResult.current.setIsWideView(false);
      });

      // Should not cause additional renders since value doesn't change
      expect(renderCount).toBe(initialRenderCount);
    });

    it('handles state updates efficiently', () => {
      const { result } = renderHook(() => useLayout(), { wrapper });

      const startTime = performance.now();

      // Perform many state updates
      act(() => {
        for (let i = 0; i < 1000; i++) {
          result.current.setIsWideView(i % 2 === 0);
        }
      });

      const endTime = performance.now();

      // Should complete quickly (less than 50ms for 1000 updates)
      expect(endTime - startTime).toBeLessThan(50);
      
      // Final state should be correct
      expect(result.current.isWideView).toBe(false); // 999 % 2 !== 0
    });
  });

  describe('edge cases', () => {
    it('handles function calls without state change', () => {
      const { result } = renderHook(() => useLayout(), { wrapper });

      const initialState = result.current.isWideView;
      const setFunction = result.current.setIsWideView;

      // Call function multiple times without act (simulating edge case)
      // Note: In real usage, act should always be used for state updates
      expect(() => {
        act(() => {
          setFunction(initialState);
          setFunction(initialState);
          setFunction(initialState);
        });
      }).not.toThrow();

      expect(result.current.isWideView).toBe(initialState);
    });

    it('maintains function reference stability', () => {
      const { result, rerender } = renderHook(() => useLayout(), { wrapper });

      const initialSetFunction = result.current.setIsWideView;

      // Change state
      act(() => {
        result.current.setIsWideView(true);
      });

      rerender();

      // Function reference should remain stable
      expect(result.current.setIsWideView).toBe(initialSetFunction);
    });

    it('handles provider nesting correctly', () => {
      const NestedWrapper = ({ children }: { children: ReactNode }) => (
        <LayoutProvider>
          <LayoutProvider>
            {children}
          </LayoutProvider>
        </LayoutProvider>
      );

      const { result } = renderHook(() => useLayout(), { wrapper: NestedWrapper });

      // Should work with nested providers (inner provider takes precedence)
      expect(result.current.isWideView).toBe(false);

      act(() => {
        result.current.setIsWideView(true);
      });

      expect(result.current.isWideView).toBe(true);
    });
  });
});