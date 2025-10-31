/**
 * NotificationBell Tests
 * Tests for the notification bell dropdown component
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import NotificationBell from './NotificationBell';

// Mock icons
vi.mock('./icons', () => ({
  BellIcon: ({ size }: { size?: number }) => (
    <span data-testid="bell-icon" style={{ fontSize: size }}>🔔</span>
  ),
  BellOffIcon: ({ size, className }: { size?: number; className?: string }) => (
    <span data-testid="bell-off-icon" className={className} style={{ fontSize: size }}>🔕</span>
  ),
  CheckIcon: ({ size }: { size?: number }) => (
    <span data-testid="check-icon" style={{ fontSize: size }}>✓</span>
  ),
  XIcon: ({ size }: { size?: number }) => (
    <span data-testid="x-icon" style={{ fontSize: size }}>✕</span>
  ),
  AlertCircleIcon: ({ size, className }: { size?: number; className?: string }) => (
    <span data-testid="alert-circle-icon" className={className} style={{ fontSize: size }}>⚠️</span>
  ),
  InfoIcon: ({ size, className }: { size?: number; className?: string }) => (
    <span data-testid="info-icon" className={className} style={{ fontSize: size }}>ℹ️</span>
  ),
  CheckCircleIcon: ({ size, className }: { size?: number; className?: string }) => (
    <span data-testid="check-circle-icon" className={className} style={{ fontSize: size }}>✅</span>
  ),
  XCircleIcon: ({ size, className }: { size?: number; className?: string }) => (
    <span data-testid="x-circle-icon" className={className} style={{ fontSize: size }}>❌</span>
  ),
  SettingsIcon: ({ size }: { size?: number }) => (
    <span data-testid="settings-icon" style={{ fontSize: size }}>⚙️</span>
  )
}));

// Mock NotificationCenter
vi.mock('./NotificationCenter', () => ({
  default: ({ isOpen, onClose: _onClose }: { isOpen: boolean; onClose: () => void }) => 
    isOpen ? <div data-testid="notification-center">Notification Center</div> : null
}));

// Mock notification context
let mockNotifications: any[] = [];

const mockContextValue: any = {
  notifications: mockNotifications,
  unreadCount: 2,
  markAsRead: vi.fn(),
  markAllAsRead: vi.fn(),
  removeNotification: vi.fn(),
  clearAll: vi.fn(),
  addNotification: vi.fn(),
  addNotifications: vi.fn(),
  budgetAlertsEnabled: true,
  setBudgetAlertsEnabled: vi.fn(),
  alertThreshold: 80,
  setAlertThreshold: vi.fn(),
  largeTransactionAlertsEnabled: true,
  setLargeTransactionAlertsEnabled: vi.fn(),
  largeTransactionThreshold: 1000,
  setLargeTransactionThreshold: vi.fn(),
  checkBudgetAlerts: vi.fn(),
  checkLargeTransaction: vi.fn(),
  checkEnhancedBudgetAlerts: vi.fn(),
  checkEnhancedTransactionAlerts: vi.fn(),
  checkGoalProgress: vi.fn()
};

// Mock the context module
vi.mock('../contexts/NotificationContext', () => ({
  useNotifications: () => mockContextValue,
  NotificationProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

// Helper to render with context
const renderWithContext = (ui: React.ReactElement) => {
  return render(ui);
};

describe('NotificationBell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.setSystemTime(new Date('2024-01-15T12:00:00'));
    
    // Create notifications with correct timestamps relative to fake time
    mockNotifications = [
      {
        id: '1',
        type: 'success' as const,
        title: 'Transaction added',
        message: 'Your transaction has been successfully added to the system',
        timestamp: new Date('2024-01-15T11:59:00'), // 1 minute ago
        read: false
      },
      {
        id: '2',
        type: 'warning' as const,
        title: 'Budget limit reached',
        message: "You've reached 90% of your monthly budget",
        timestamp: new Date('2024-01-15T11:00:00'), // 1 hour ago
        read: true,
        action: {
          label: 'View Budget',
          onClick: vi.fn()
        }
      },
      {
        id: '3',
        type: 'error' as const,
        title: 'Sync failed',
        message: 'Unable to sync your data',
        timestamp: new Date('2024-01-14T12:00:00'), // 1 day ago
        read: false
      }
    ];
    
    // Update mock context with new notifications
    mockContextValue.notifications = mockNotifications;
    mockContextValue.unreadCount = 2;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Basic Rendering', () => {
    it('renders bell icon button', () => {
      renderWithContext(<NotificationBell />);
      
      expect(screen.getByTestId('bell-icon')).toBeInTheDocument();
    });

    it('shows unread count badge when there are unread notifications', () => {
      renderWithContext(<NotificationBell />);
      
      expect(screen.getByText('2')).toBeInTheDocument();
    });

    it('shows 9+ when unread count exceeds 9', () => {
      // Update mock context for this test
      mockContextValue.unreadCount = 15;
      
      render(<NotificationBell />);
      
      // Reset for other tests
      mockContextValue.unreadCount = 2;
      
      expect(screen.getByText('9+')).toBeInTheDocument();
    });

    it('does not show badge when no unread notifications', () => {
      // Update mock context for this test
      mockContextValue.unreadCount = 0;
      
      render(<NotificationBell />);
      
      // Reset for other tests
      mockContextValue.unreadCount = 2;
      
      expect(screen.queryByText('0')).not.toBeInTheDocument();
    });
  });

  describe('Dropdown Behavior', () => {
    it('toggles dropdown when bell is clicked', () => {
      renderWithContext(<NotificationBell />);
      
      expect(screen.queryByText('Notifications')).not.toBeInTheDocument();
      
      fireEvent.click(screen.getByTestId('bell-icon').parentElement!);
      
      expect(screen.getByText('Notifications')).toBeInTheDocument();
    });

    it('closes dropdown when clicking outside', () => {
      renderWithContext(<NotificationBell />);
      
      fireEvent.click(screen.getByTestId('bell-icon').parentElement!);
      expect(screen.getByText('Notifications')).toBeInTheDocument();
      
      fireEvent.mouseDown(document.body);
      
      expect(screen.queryByText('Notifications')).not.toBeInTheDocument();
    });

    it('shows notification list when open', () => {
      renderWithContext(<NotificationBell />);
      
      fireEvent.click(screen.getByTestId('bell-icon').parentElement!);
      
      expect(screen.getByText('Transaction added')).toBeInTheDocument();
      expect(screen.getByText('Budget limit reached')).toBeInTheDocument();
      expect(screen.getByText('Sync failed')).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('shows empty state when no notifications', () => {
      // Save original values
      const originalNotifications = mockContextValue.notifications;
      const originalUnreadCount = mockContextValue.unreadCount;
      
      // Update mock context for this test
      mockContextValue.notifications = [];
      mockContextValue.unreadCount = 0;
      
      render(<NotificationBell />);
      
      fireEvent.click(screen.getByTestId('bell-icon').parentElement!);
      
      expect(screen.getByTestId('bell-off-icon')).toBeInTheDocument();
      expect(screen.getByText('No notifications yet')).toBeInTheDocument();
      
      // Reset for other tests
      mockContextValue.notifications = originalNotifications;
      mockContextValue.unreadCount = originalUnreadCount;
    });
  });

  describe('Notification Display', () => {
    it('shows correct icon for each notification type', () => {
      renderWithContext(<NotificationBell />);
      
      fireEvent.click(screen.getByTestId('bell-icon').parentElement!);
      
      expect(screen.getByTestId('check-circle-icon')).toBeInTheDocument();
      expect(screen.getByTestId('alert-circle-icon')).toBeInTheDocument();
      expect(screen.getByTestId('x-circle-icon')).toBeInTheDocument();
    });

    it('highlights unread notifications', () => {
      renderWithContext(<NotificationBell />);
      
      fireEvent.click(screen.getByTestId('bell-icon').parentElement!);
      
      const unreadNotification = screen.getByText('Transaction added').closest('div[class*="hover:bg-gray-50"]');
      expect(unreadNotification).toHaveClass('bg-blue-50/50');
    });

    it('shows message preview for long messages', () => {
      renderWithContext(<NotificationBell />);
      
      fireEvent.click(screen.getByTestId('bell-icon').parentElement!);
      
      const longMessage = screen.getByText('e system');
      expect(longMessage).toBeInTheDocument();
    });

    it('shows action button when notification has action', () => {
      renderWithContext(<NotificationBell />);
      
      fireEvent.click(screen.getByTestId('bell-icon').parentElement!);
      
      expect(screen.getByText('View Budget')).toBeInTheDocument();
    });

    it('shows mark as read button for unread notifications', () => {
      renderWithContext(<NotificationBell />);
      
      fireEvent.click(screen.getByTestId('bell-icon').parentElement!);
      
      const markAsReadButtons = screen.getAllByText('Mark as read');
      expect(markAsReadButtons).toHaveLength(2); // Two unread notifications
    });
  });

  describe('Time Formatting', () => {
    it('shows "Just now" for very recent notifications', () => {
      // Save original notifications
      const originalNotifications = mockContextValue.notifications;
      
      const recentNotification = {
        ...mockNotifications[0],
        timestamp: new Date('2024-01-15T11:59:45') // 15 seconds ago
      };
      
      // Update mock context for this test
      mockContextValue.notifications = [recentNotification];
      
      render(<NotificationBell />);
      
      fireEvent.click(screen.getByTestId('bell-icon').parentElement!);
      
      expect(screen.getByText('Just now')).toBeInTheDocument();
      
      // Reset for other tests
      mockContextValue.notifications = originalNotifications;
    });

    it('shows minutes for notifications less than an hour old', () => {
      renderWithContext(<NotificationBell />);
      
      fireEvent.click(screen.getByTestId('bell-icon').parentElement!);
      
      expect(screen.getByText('1m ago')).toBeInTheDocument();
    });

    it('shows hours for notifications less than a day old', () => {
      renderWithContext(<NotificationBell />);
      
      fireEvent.click(screen.getByTestId('bell-icon').parentElement!);
      
      expect(screen.getByText('1h ago')).toBeInTheDocument();
    });

    it('shows days for notifications less than a week old', () => {
      renderWithContext(<NotificationBell />);
      
      fireEvent.click(screen.getByTestId('bell-icon').parentElement!);
      
      expect(screen.getByText('1d ago')).toBeInTheDocument();
    });

  });

  describe('Actions', () => {
    it('calls markAsRead when clicking mark as read button', () => {
      renderWithContext(<NotificationBell />);
      
      fireEvent.click(screen.getByTestId('bell-icon').parentElement!);
      
      const markAsReadButton = screen.getAllByText('Mark as read')[0];
      fireEvent.click(markAsReadButton);
      
      expect(mockContextValue.markAsRead).toHaveBeenCalledWith('1');
    });

    it('calls markAllAsRead when clicking mark all read', () => {
      renderWithContext(<NotificationBell />);
      
      fireEvent.click(screen.getByTestId('bell-icon').parentElement!);
      
      fireEvent.click(screen.getByText('Mark all read'));
      
      expect(mockContextValue.markAllAsRead).toHaveBeenCalled();
    });

    it('calls clearAll when clicking clear all', () => {
      renderWithContext(<NotificationBell />);
      
      fireEvent.click(screen.getByTestId('bell-icon').parentElement!);
      
      fireEvent.click(screen.getByText('Clear all'));
      
      expect(mockContextValue.clearAll).toHaveBeenCalled();
    });

    it('calls removeNotification when clicking remove button', () => {
      renderWithContext(<NotificationBell />);
      
      fireEvent.click(screen.getByTestId('bell-icon').parentElement!);
      
      const removeButtons = screen.getAllByTestId('x-icon');
      fireEvent.click(removeButtons[0].parentElement!);
      
      expect(mockContextValue.removeNotification).toHaveBeenCalledWith('1');
    });

    it('executes action and closes dropdown when action button clicked', () => {
      renderWithContext(<NotificationBell />);
      
      fireEvent.click(screen.getByTestId('bell-icon').parentElement!);
      
      fireEvent.click(screen.getByText('View Budget'));
      
      expect(mockContextValue.markAsRead).toHaveBeenCalledWith('2');
      expect(mockNotifications[1].action!.onClick).toHaveBeenCalled();
      
      // Dropdown should close
      expect(screen.queryByText('Notifications')).not.toBeInTheDocument();
    });

    it('opens notification center when settings clicked', () => {
      renderWithContext(<NotificationBell />);
      
      fireEvent.click(screen.getByTestId('bell-icon').parentElement!);
      fireEvent.click(screen.getByTestId('settings-icon').parentElement!);
      
      expect(screen.getByTestId('notification-center')).toBeInTheDocument();
      expect(screen.queryByText('Notifications')).not.toBeInTheDocument();
    });
  });

  describe('Header Actions', () => {
    it('shows mark all read only when there are unread notifications', () => {
      renderWithContext(<NotificationBell />);
      
      fireEvent.click(screen.getByTestId('bell-icon').parentElement!);
      
      expect(screen.getByText('Mark all read')).toBeInTheDocument();
    });

    it('hides mark all read when no unread notifications', () => {
      // Update mock context for this test
      mockContextValue.unreadCount = 0;
      
      render(<NotificationBell />);
      
      fireEvent.click(screen.getByTestId('bell-icon').parentElement!);
      
      expect(screen.queryByText('Mark all read')).not.toBeInTheDocument();
      
      // Reset for other tests
      mockContextValue.unreadCount = 2;
    });

    it('shows clear all when there are notifications', () => {
      renderWithContext(<NotificationBell />);
      
      fireEvent.click(screen.getByTestId('bell-icon').parentElement!);
      
      expect(screen.getByText('Clear all')).toBeInTheDocument();
    });

    it('hides action buttons when no notifications', () => {
      // Save original values
      const originalNotifications = mockContextValue.notifications;
      const originalUnreadCount = mockContextValue.unreadCount;
      
      // Update mock context for this test
      mockContextValue.notifications = [];
      mockContextValue.unreadCount = 0;
      
      render(<NotificationBell />);
      
      fireEvent.click(screen.getByTestId('bell-icon').parentElement!);
      
      expect(screen.queryByText('Mark all read')).not.toBeInTheDocument();
      expect(screen.queryByText('Clear all')).not.toBeInTheDocument();
      
      // Reset for other tests
      mockContextValue.notifications = originalNotifications;
      mockContextValue.unreadCount = originalUnreadCount;
    });
  });

  describe('Styling', () => {
    it('applies correct badge styling', () => {
      renderWithContext(<NotificationBell />);
      
      const badge = screen.getByText('2');
      expect(badge).toHaveClass(
        'absolute',
        '-top-0.5',
        '-right-0.5',
        'h-5',
        'w-5',
        'bg-red-500',
        'text-white',
        'text-xs',
        'rounded-full'
      );
    });

    it('applies correct dropdown styling', () => {
      renderWithContext(<NotificationBell />);
      
      fireEvent.click(screen.getByTestId('bell-icon').parentElement!);
      
      const dropdown = screen.getByText('Notifications').closest('.absolute');
      expect(dropdown).toHaveClass(
        'absolute',
        'right-0',
        'mt-2',
        'w-80',
        'bg-white',
        'dark:bg-gray-800',
        'rounded-2xl',
        'shadow-lg'
      );
    });

    it('applies hover states to notifications', () => {
      renderWithContext(<NotificationBell />);
      
      fireEvent.click(screen.getByTestId('bell-icon').parentElement!);
      
      const notification = screen.getByText('Transaction added').closest('div[class*="hover:bg-gray-50"]');
      expect(notification).toHaveClass('hover:bg-gray-50', 'dark:hover:bg-gray-700/50');
    });
  });
});
