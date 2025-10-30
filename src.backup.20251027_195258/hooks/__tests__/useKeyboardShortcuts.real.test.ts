/**
 * useKeyboardShortcuts REAL Tests
 * Tests keyboard shortcut handling
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useKeyboardShortcuts, type KeyboardShortcut } from '../useKeyboardShortcuts';

describe('useKeyboardShortcuts - REAL Tests', () => {
  it('registers and handles keyboard shortcuts', () => {
    const mockCallback = vi.fn();
    const shortcuts: KeyboardShortcut[] = [
      {
        key: 's',
        ctrlKey: true,
        description: 'Save data',
        action: mockCallback,
        category: 'Testing',
      },
    ];

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(MemoryRouter, { initialEntries: ['/'] }, children);
    
    renderHook(() => {
      useKeyboardShortcuts(shortcuts);
    }, { wrapper });
    
    // Simulate keyboard event
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 's',
          ctrlKey: true,
        }),
      );
    });
    
    expect(mockCallback).toHaveBeenCalled();
  });
});
