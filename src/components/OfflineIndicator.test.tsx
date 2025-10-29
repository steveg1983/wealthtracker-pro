/**
 * OfflineIndicator Tests
 * Tests for the offline/online status indicator component
 */

import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import OfflineIndicator from './OfflineIndicator';

// Mock the WifiOffIcon
vi.mock('./icons', () => ({
  WifiOffIcon: ({ size }: { size?: number }) => (
    <span data-testid="wifi-off-icon" style={{ fontSize: size }}>📵</span>
  )
}));

describe('OfflineIndicator', () => {
  const originalNavigatorOnLine = Object.getOwnPropertyDescriptor(window.Navigator.prototype, 'onLine');
  let onlineEventListeners: Array<() => void> = [];
  let offlineEventListeners: Array<() => void> = [];

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset event listeners
    onlineEventListeners = [];
    offlineEventListeners = [];
    
    // Mock addEventListener
    vi.spyOn(window, 'addEventListener').mockImplementation((event: string, handler: any) => {
      if (event === 'online') {
        onlineEventListeners.push(handler);
      } else if (event === 'offline') {
        offlineEventListeners.push(handler);
      }
    });
    
    // Mock removeEventListener
    vi.spyOn(window, 'removeEventListener').mockImplementation((event: string, handler: any) => {
      if (event === 'online') {
        onlineEventListeners = onlineEventListeners.filter(h => h !== handler);
      } else if (event === 'offline') {
        offlineEventListeners = offlineEventListeners.filter(h => h !== handler);
      }
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    
    // Restore original navigator.onLine
    if (originalNavigatorOnLine) {
      Object.defineProperty(window.Navigator.prototype, 'onLine', originalNavigatorOnLine);
    }
  });

  const setNavigatorOnline = (online: boolean) => {
    Object.defineProperty(window.Navigator.prototype, 'onLine', {
      writable: true,
      configurable: true,
      value: online
    });
  };

  const triggerOnlineEvent = () => {
    act(() => {
      onlineEventListeners.forEach(handler => handler());
    });
  };

  const triggerOfflineEvent = () => {
    act(() => {
      offlineEventListeners.forEach(handler => handler());
    });
  };

  describe('Initial State', () => {
    it('renders nothing when online initially', () => {
      setNavigatorOnline(true);
      
      const { container } = render(<OfflineIndicator />);
      
      expect(container.firstChild).toBeNull();
    });

    it('renders nothing when initially offline (showBanner starts false)', () => {
      setNavigatorOnline(false);
      
      const { container } = render(<OfflineIndicator />);
      
      // Component starts with showBanner=false even when offline
      expect(container.firstChild).toBeNull();
    });
  });

  describe('Online/Offline Transitions', () => {
    it('shows offline indicator when going offline', () => {
      setNavigatorOnline(true);
      
      render(<OfflineIndicator />);
      
      expect(screen.queryByText("You're offline")).not.toBeInTheDocument();
      
      triggerOfflineEvent();
      
      expect(screen.getByText("You're offline")).toBeInTheDocument();
    });

    it('shows back online message when coming online', () => {
      setNavigatorOnline(true);
      
      render(<OfflineIndicator />);
      
      // First go offline
      triggerOfflineEvent();
      expect(screen.getByText("You're offline")).toBeInTheDocument();
      
      // Then come back online
      triggerOnlineEvent();
      
      expect(screen.getByText('Back online')).toBeInTheDocument();
      expect(screen.queryByText("You're offline")).not.toBeInTheDocument();
    });

    it('shows back online message briefly', () => {
      setNavigatorOnline(true);
      
      render(<OfflineIndicator />);
      
      // Go offline then online
      triggerOfflineEvent();
      triggerOnlineEvent();
      
      expect(screen.getByText('Back online')).toBeInTheDocument();
    });

    it('keeps offline indicator visible when offline', () => {
      setNavigatorOnline(true);
      
      render(<OfflineIndicator />);
      
      triggerOfflineEvent();
      
      expect(screen.getByText("You're offline")).toBeInTheDocument();
    });
  });

  describe('Visual Styling', () => {
    it('shows orange background when offline', () => {
      setNavigatorOnline(true);
      
      render(<OfflineIndicator />);
      
      triggerOfflineEvent();
      
      const banner = screen.getByText("You're offline").closest('.bg-orange-500');
      expect(banner).toBeInTheDocument();
      expect(banner).toHaveClass('bg-orange-500', 'text-white');
    });

    it('shows green background when back online', () => {
      setNavigatorOnline(true);
      
      render(<OfflineIndicator />);
      
      // Go offline first
      triggerOfflineEvent();
      // Then come back online
      triggerOnlineEvent();
      
      const banner = screen.getByText('Back online').closest('.bg-green-500');
      expect(banner).toBeInTheDocument();
      expect(banner).toHaveClass('bg-green-500', 'text-white');
    });

    it('displays WiFi off icon when offline', () => {
      setNavigatorOnline(true);
      
      render(<OfflineIndicator />);
      
      triggerOfflineEvent();
      
      expect(screen.getByTestId('wifi-off-icon')).toBeInTheDocument();
    });

    it('displays WiFi on icon when back online', () => {
      setNavigatorOnline(true);
      
      render(<OfflineIndicator />);
      
      triggerOfflineEvent();
      triggerOnlineEvent();
      
      // SVG wifi icon
      const wifiIcon = document.querySelector('svg.w-5.h-5');
      expect(wifiIcon).toBeInTheDocument();
    });
  });

  describe('Event Listeners', () => {
    it('registers online and offline event listeners', () => {
      render(<OfflineIndicator />);
      
      expect(window.addEventListener).toHaveBeenCalledWith('online', expect.any(Function));
      expect(window.addEventListener).toHaveBeenCalledWith('offline', expect.any(Function));
    });

    it('removes event listeners on unmount', () => {
      const { unmount } = render(<OfflineIndicator />);
      
      unmount();
      
      expect(window.removeEventListener).toHaveBeenCalledWith('online', expect.any(Function));
      expect(window.removeEventListener).toHaveBeenCalledWith('offline', expect.any(Function));
    });
  });

  describe('Layout and Positioning', () => {
    it('has fixed positioning at bottom', () => {
      setNavigatorOnline(true);
      
      render(<OfflineIndicator />);
      
      triggerOfflineEvent();
      
      const container = screen.getByText("You're offline").closest('.fixed');
      expect(container).toHaveClass('fixed', 'bottom-4', 'z-50');
    });

    it('applies responsive positioning classes', () => {
      setNavigatorOnline(true);
      
      render(<OfflineIndicator />);
      
      triggerOfflineEvent();
      
      const container = screen.getByText("You're offline").closest('.fixed');
      expect(container).toHaveClass('left-4', 'right-4', 'md:left-auto', 'md:right-4', 'md:w-auto');
    });

    it('has proper shadow and rounded corners', () => {
      setNavigatorOnline(true);
      
      render(<OfflineIndicator />);
      
      triggerOfflineEvent();
      
      const banner = screen.getByText("You're offline").parentElement?.parentElement;
      expect(banner).toHaveClass('rounded-lg', 'shadow-lg');
    });
  });

  describe('Rapid State Changes', () => {
    it('handles rapid online/offline transitions', () => {
      setNavigatorOnline(true);
      
      render(<OfflineIndicator />);
      
      // Go offline
      triggerOfflineEvent();
      expect(screen.getByText("You're offline")).toBeInTheDocument();
      
      // Quickly go online
      triggerOnlineEvent();
      expect(screen.getByText('Back online')).toBeInTheDocument();
      
      // Go offline again before timeout
      triggerOfflineEvent();
      expect(screen.getByText("You're offline")).toBeInTheDocument();
    });

    it('handles multiple transitions correctly', () => {
      setNavigatorOnline(true);
      
      render(<OfflineIndicator />);
      
      // Go offline then online
      triggerOfflineEvent();
      triggerOnlineEvent();
      expect(screen.getByText('Back online')).toBeInTheDocument();
      
      // Go offline again quickly
      triggerOfflineEvent();
      
      // Should now show offline message
      expect(screen.getByText("You're offline")).toBeInTheDocument();
      expect(screen.queryByText('Back online')).not.toBeInTheDocument();
    });
  });

  describe('Content Structure', () => {
    it('shows both title and description when offline', () => {
      setNavigatorOnline(true);
      
      render(<OfflineIndicator />);
      
      triggerOfflineEvent();
      
      const title = screen.getByText("You're offline");
      const description = screen.getByText("Changes will sync when you're back online");
      
      expect(title).toHaveClass('font-medium');
      expect(description).toHaveClass('text-sm', 'opacity-90');
    });

    it('shows only title when back online', () => {
      setNavigatorOnline(true);
      
      render(<OfflineIndicator />);
      
      triggerOfflineEvent();
      triggerOnlineEvent();
      
      expect(screen.getByText('Back online')).toHaveClass('font-medium');
      expect(screen.queryByText("Changes will sync when you're back online")).not.toBeInTheDocument();
    });
  });
});