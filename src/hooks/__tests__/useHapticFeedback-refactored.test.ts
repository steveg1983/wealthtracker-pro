/**
 * @test useHapticFeedback
 * @description World-class unit tests for haptic feedback hook ensuring
 * comprehensive coverage of all haptic patterns and device capabilities.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useHapticFeedback, HapticPattern } from '../useHapticFeedback-refactored';
import { hapticService } from '../../services/haptic/hapticService';

// Mock the haptic service
vi.mock('../../services/haptic/hapticService', () => ({
  hapticService: {
    isAvailable: vi.fn(),
    trigger: vi.fn(),
    enable: vi.fn(),
    disable: vi.fn(),
    toggle: vi.fn(),
    getEnabled: vi.fn()
  }
}));

describe('useHapticFeedback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock implementations
    vi.mocked(hapticService.isAvailable).mockReturnValue(true);
    vi.mocked(hapticService.getEnabled).mockReturnValue(true);
    vi.mocked(hapticService.toggle).mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with correct default state', () => {
      const { result } = renderHook(() => useHapticFeedback());

      expect(result.current.isEnabled).toBe(true);
      expect(result.current.isAvailable()).toBe(true);
      expect(typeof result.current.trigger).toBe('function');
      expect(typeof result.current.enable).toBe('function');
      expect(typeof result.current.disable).toBe('function');
      expect(typeof result.current.toggle).toBe('function');
    });

    it('should detect when haptic is not available', () => {
      vi.mocked(hapticService.isAvailable).mockReturnValue(false);
      
      const { result } = renderHook(() => useHapticFeedback());
      
      expect(result.current.isAvailable()).toBe(false);
    });
  });

  describe('Trigger Haptic', () => {
    it('should trigger light haptic pattern', async () => {
      const { result } = renderHook(() => useHapticFeedback());

      await act(async () => {
        await result.current.trigger(HapticPattern.LIGHT);
      });

      expect(hapticService.trigger).toHaveBeenCalledWith(
        HapticPattern.LIGHT,
        {}
      );
    });

    it('should trigger haptic with custom options', async () => {
      const { result } = renderHook(() => useHapticFeedback());
      const options = { 
        delay: 100, 
        intensity: 0.5,
        force: true 
      };

      await act(async () => {
        await result.current.trigger(HapticPattern.HEAVY, options);
      });

      expect(hapticService.trigger).toHaveBeenCalledWith(
        HapticPattern.HEAVY,
        options
      );
    });

    it('should handle all haptic patterns', async () => {
      const { result } = renderHook(() => useHapticFeedback());
      
      const patterns = [
        HapticPattern.LIGHT,
        HapticPattern.MEDIUM,
        HapticPattern.HEAVY,
        HapticPattern.SUCCESS,
        HapticPattern.WARNING,
        HapticPattern.ERROR,
        HapticPattern.SELECTION,
        HapticPattern.IMPACT,
        HapticPattern.NOTIFICATION
      ];

      for (const pattern of patterns) {
        await act(async () => {
          await result.current.trigger(pattern);
        });
      }

      expect(hapticService.trigger).toHaveBeenCalledTimes(patterns.length);
    });

    it('should handle trigger errors gracefully', async () => {
      vi.mocked(hapticService.trigger).mockRejectedValueOnce(
        new Error('Haptic failed')
      );

      const { result } = renderHook(() => useHapticFeedback());

      // Should not throw
      await expect(
        act(async () => {
          await result.current.trigger(HapticPattern.LIGHT);
        })
      ).resolves.not.toThrow();
    });
  });

  describe('Enable/Disable', () => {
    it('should enable haptic feedback', () => {
      const { result } = renderHook(() => useHapticFeedback());

      act(() => {
        result.current.enable();
      });

      expect(hapticService.enable).toHaveBeenCalled();
    });

    it('should disable haptic feedback', () => {
      const { result } = renderHook(() => useHapticFeedback());

      act(() => {
        result.current.disable();
      });

      expect(hapticService.disable).toHaveBeenCalled();
    });

    it('should toggle haptic feedback', () => {
      const { result } = renderHook(() => useHapticFeedback());

      act(() => {
        const newState = result.current.toggle();
        expect(newState).toBe(true);
      });

      expect(hapticService.toggle).toHaveBeenCalled();
    });

    it('should reflect enabled state changes', () => {
      vi.mocked(hapticService.getEnabled)
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false);

      const { result, rerender } = renderHook(() => useHapticFeedback());
      
      expect(result.current.isEnabled).toBe(true);
      
      rerender();
      
      expect(result.current.isEnabled).toBe(false);
    });
  });

  describe('Performance', () => {
    it('should memoize trigger function', () => {
      const { result, rerender } = renderHook(() => useHapticFeedback());
      
      const trigger1 = result.current.trigger;
      rerender();
      const trigger2 = result.current.trigger;
      
      expect(trigger1).toBe(trigger2);
    });

    it('should memoize other functions', () => {
      const { result, rerender } = renderHook(() => useHapticFeedback());
      
      const enable1 = result.current.enable;
      const disable1 = result.current.disable;
      const toggle1 = result.current.toggle;
      
      rerender();
      
      const enable2 = result.current.enable;
      const disable2 = result.current.disable;
      const toggle2 = result.current.toggle;
      
      expect(enable1).toBe(enable2);
      expect(disable1).toBe(disable2);
      expect(toggle1).toBe(toggle2);
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid trigger calls', async () => {
      const { result } = renderHook(() => useHapticFeedback());

      await act(async () => {
        // Fire multiple triggers rapidly
        await Promise.all([
          result.current.trigger(HapticPattern.LIGHT),
          result.current.trigger(HapticPattern.MEDIUM),
          result.current.trigger(HapticPattern.HEAVY)
        ]);
      });

      // Service should handle debouncing internally
      expect(hapticService.trigger).toHaveBeenCalledTimes(3);
    });

    it('should handle undefined pattern gracefully', async () => {
      const { result } = renderHook(() => useHapticFeedback());

      await act(async () => {
        await result.current.trigger();
      });

      // Should use default pattern
      expect(hapticService.trigger).toHaveBeenCalledWith(
        HapticPattern.LIGHT,
        {}
      );
    });

    it('should work when service is not available', async () => {
      vi.mocked(hapticService.isAvailable).mockReturnValue(false);
      vi.mocked(hapticService.trigger).mockResolvedValue(undefined);

      const { result } = renderHook(() => useHapticFeedback());

      await act(async () => {
        await result.current.trigger(HapticPattern.SUCCESS);
      });

      // Should still call trigger (service handles availability internally)
      expect(hapticService.trigger).toHaveBeenCalled();
    });
  });

  describe('Integration', () => {
    it('should work with custom haptic patterns', async () => {
      const { result } = renderHook(() => useHapticFeedback());

      // Test custom intensity
      await act(async () => {
        await result.current.trigger(HapticPattern.LIGHT, {
          intensity: 0.3
        });
      });

      expect(hapticService.trigger).toHaveBeenCalledWith(
        HapticPattern.LIGHT,
        { intensity: 0.3 }
      );
    });

    it('should support delayed haptic feedback', async () => {
      const { result } = renderHook(() => useHapticFeedback());

      await act(async () => {
        await result.current.trigger(HapticPattern.NOTIFICATION, {
          delay: 500
        });
      });

      expect(hapticService.trigger).toHaveBeenCalledWith(
        HapticPattern.NOTIFICATION,
        { delay: 500 }
      );
    });

    it('should force haptic even when disabled', async () => {
      vi.mocked(hapticService.getEnabled).mockReturnValue(false);

      const { result } = renderHook(() => useHapticFeedback());

      await act(async () => {
        await result.current.trigger(HapticPattern.ERROR, {
          force: true
        });
      });

      expect(hapticService.trigger).toHaveBeenCalledWith(
        HapticPattern.ERROR,
        { force: true }
      );
    });
  });
});