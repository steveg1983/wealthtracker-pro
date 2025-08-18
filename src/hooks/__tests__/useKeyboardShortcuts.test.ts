/**
 * useKeyboardShortcuts Tests
 * Tests for the keyboard shortcuts hooks
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useKeyboardShortcuts, useGlobalKeyboardShortcuts, getAllShortcuts, type KeyboardShortcut } from '../useKeyboardShortcuts';
import { AllProviders } from '../../test/testUtils';

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('useKeyboardShortcuts', () => {
  let keydownEvent: (event: Partial<KeyboardEvent>) => void;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Capture the keydown event listener
    vi.spyOn(window, 'addEventListener').mockImplementation((event, handler) => {
      if (event === 'keydown') {
        keydownEvent = handler as any;
      }
    });
    
    vi.spyOn(window, 'removeEventListener');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('basic functionality', () => {
    it('registers keyboard event listener on mount', () => {
      const shortcuts: KeyboardShortcut[] = [{
        key: 'a',
        description: 'Test shortcut',
        action: vi.fn(),
        category: 'Test'
      }];

      renderHook(() => useKeyboardShortcuts(shortcuts));

      expect(window.addEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
    });

    it('removes keyboard event listener on unmount', () => {
      const shortcuts: KeyboardShortcut[] = [{
        key: 'a',
        description: 'Test shortcut',
        action: vi.fn(),
        category: 'Test'
      }];

      const { unmount } = renderHook(() => useKeyboardShortcuts(shortcuts));
      unmount();

      expect(window.removeEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
    });

    it('triggers action when matching shortcut is pressed', () => {
      const mockAction = vi.fn();
      const shortcuts: KeyboardShortcut[] = [{
        key: 'a',
        description: 'Test shortcut',
        action: mockAction,
        category: 'Test'
      }];

      renderHook(() => useKeyboardShortcuts(shortcuts));

      // Simulate pressing 'a' key
      keydownEvent({
        key: 'a',
        ctrlKey: false,
        altKey: false,
        shiftKey: false,
        metaKey: false,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        target: document.body
      });

      expect(mockAction).toHaveBeenCalled();
    });

    it('respects modifier keys', () => {
      const mockAction = vi.fn();
      const shortcuts: KeyboardShortcut[] = [{
        key: 'a',
        ctrlKey: true,
        description: 'Test shortcut',
        action: mockAction,
        category: 'Test'
      }];

      renderHook(() => useKeyboardShortcuts(shortcuts));

      // Press 'a' without Ctrl - should not trigger
      keydownEvent({
        key: 'a',
        ctrlKey: false,
        altKey: false,
        shiftKey: false,
        metaKey: false,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        target: document.body
      });

      expect(mockAction).not.toHaveBeenCalled();

      // Press 'a' with Ctrl - should trigger
      keydownEvent({
        key: 'a',
        ctrlKey: true,
        altKey: false,
        shiftKey: false,
        metaKey: false,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        target: document.body
      });

      expect(mockAction).toHaveBeenCalledTimes(1);
    });

    it('ignores shortcuts when typing in input fields', () => {
      const mockAction = vi.fn();
      const shortcuts: KeyboardShortcut[] = [{
        key: 'a',
        description: 'Test shortcut',
        action: mockAction,
        category: 'Test'
      }];

      renderHook(() => useKeyboardShortcuts(shortcuts));

      // Create input element
      const input = document.createElement('input');

      // Simulate pressing 'a' while focused on input
      keydownEvent({
        key: 'a',
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        target: input
      });

      expect(mockAction).not.toHaveBeenCalled();
    });

    it('ignores shortcuts when modal is open', () => {
      const mockAction = vi.fn();
      const shortcuts: KeyboardShortcut[] = [{
        key: 'a',
        description: 'Test shortcut',
        action: mockAction,
        category: 'Test'
      }];

      renderHook(() => useKeyboardShortcuts(shortcuts));

      // Add a modal element
      const modal = document.createElement('div');
      modal.setAttribute('role', 'dialog');
      document.body.appendChild(modal);

      // Simulate pressing 'a' with modal open
      keydownEvent({
        key: 'a',
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        target: document.body
      });

      expect(mockAction).not.toHaveBeenCalled();

      // Cleanup
      document.body.removeChild(modal);
    });
  });
});

describe('useGlobalKeyboardShortcuts', () => {
  let keydownHandlers: ((event: Partial<KeyboardEvent>) => void)[] = [];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers(); // Reset timers first
    vi.useFakeTimers();
    keydownHandlers = [];
    
    // Mock matchMedia for ThemeProvider
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
    
    // Capture all keydown event listeners
    vi.spyOn(window, 'addEventListener').mockImplementation((event, handler) => {
      if (event === 'keydown') {
        keydownHandlers.push(handler as any);
      }
    });
    
    vi.spyOn(window, 'removeEventListener');
    
    // Mock document.querySelector for search input
    vi.spyOn(document, 'querySelector').mockImplementation((selector) => {
      if (selector === '[data-search-input]') {
        const input = document.createElement('input');
        input.focus = vi.fn();
        return input;
      }
      return null;
    });
  });

  const triggerKeydown = (event: Partial<KeyboardEvent>) => {
    // Trigger all keydown handlers
    keydownHandlers.forEach(handler => handler(event));
  };

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('returns shortcuts array and active sequence', () => {
    const { result } = renderHook(() => useGlobalKeyboardShortcuts(), {
      wrapper: AllProviders
    });

    expect(result.current.shortcuts).toBeInstanceOf(Array);
    expect(result.current.shortcuts.length).toBeGreaterThan(0);
    expect(result.current.activeSequence).toBeNull();
  });

  it('handles single-key navigation shortcuts with Alt', () => {
    renderHook(() => useGlobalKeyboardShortcuts(), {
      wrapper: AllProviders
    });

    // Test Alt+D for dashboard
    triggerKeydown({
      key: 'd',
      ctrlKey: false,
      altKey: true,
      shiftKey: false,
      metaKey: false,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
      target: document.body
    });

    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });

  it('handles two-key sequence shortcuts', () => {
    const { result } = renderHook(() => useGlobalKeyboardShortcuts(), {
      wrapper: AllProviders
    });

    // Find the 'g' shortcut and call its action directly
    const gShortcut = result.current.shortcuts.find(s => s.key === 'g' && s.sequence);
    expect(gShortcut).toBeDefined();
    
    act(() => {
      gShortcut!.action();
    });

    // Active sequence should be set
    expect(result.current.activeSequence).toBe('g');

    // Press 'h' to complete sequence (go home)
    act(() => {
      triggerKeydown({
        key: 'h',
        ctrlKey: false,
        altKey: false,
        shiftKey: false,
        metaKey: false,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        target: document.body
      });
    });

    expect(mockNavigate).toHaveBeenCalledWith('/');
    expect(result.current.activeSequence).toBeNull();
  });

  it('times out two-key sequences after 2 seconds', () => {
    const { result } = renderHook(() => useGlobalKeyboardShortcuts(), {
      wrapper: AllProviders
    });

    // Find the 'g' shortcut and call its action directly
    const gShortcut = result.current.shortcuts.find(s => s.key === 'g' && s.sequence);
    expect(gShortcut).toBeDefined();
    
    act(() => {
      gShortcut!.action();
    });

    expect(result.current.activeSequence).toBe('g');

    // Advance time by 2 seconds
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(result.current.activeSequence).toBeNull();
  });

  it('handles search focus shortcut', () => {
    renderHook(() => useGlobalKeyboardShortcuts(), {
      wrapper: AllProviders
    });

    const mockFocus = vi.fn();
    const mockSearchInput = document.createElement('input');
    mockSearchInput.focus = mockFocus;
    
    vi.spyOn(document, 'querySelector').mockReturnValue(mockSearchInput);

    // Press '/' to focus search
    triggerKeydown({
      key: '/',
      ctrlKey: false,
      altKey: false,
      shiftKey: false,
      metaKey: false,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
      target: document.body
    });

    expect(mockFocus).toHaveBeenCalled();
  });

  it('handles help shortcut', () => {
    const mockHelpOpen = vi.fn();
    renderHook(() => useGlobalKeyboardShortcuts(mockHelpOpen), {
      wrapper: AllProviders
    });

    // Press '?' to open help
    triggerKeydown({
      key: '?',
      ctrlKey: false,
      altKey: false,
      shiftKey: false,
      metaKey: false,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
      target: document.body
    });

    expect(mockHelpOpen).toHaveBeenCalled();
  });

  it('clears timeout on unmount', () => {
    const { unmount } = renderHook(() => useGlobalKeyboardShortcuts(), {
      wrapper: AllProviders
    });

    // Start a sequence
    triggerKeydown({
      key: 'g',
      ctrlKey: false,
      altKey: false,
      shiftKey: false,
      metaKey: false,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
      target: document.body
    });

    // Unmount before timeout
    unmount();

    // Should not throw when advancing timers
    expect(() => {
      vi.advanceTimersByTime(3000);
    }).not.toThrow();
  });
});

describe('getAllShortcuts', () => {
  it('returns all available shortcuts for help dialog', () => {
    const shortcuts = getAllShortcuts();

    expect(shortcuts).toBeInstanceOf(Array);
    expect(shortcuts.length).toBeGreaterThan(0);
    
    // Check that shortcuts have required properties
    shortcuts.forEach(shortcut => {
      expect(shortcut).toHaveProperty('key');
      expect(shortcut).toHaveProperty('description');
      expect(shortcut).toHaveProperty('category');
      expect(shortcut).toHaveProperty('action');
    });

    // Check for specific shortcuts
    const categories = new Set(shortcuts.map(s => s.category));
    expect(categories).toContain('Navigation');
    expect(categories).toContain('Quick Actions');
    expect(categories).toContain('Global');
    expect(categories).toContain('Utility');
  });
});