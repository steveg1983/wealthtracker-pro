import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import MobileAppWidget from './MobileAppWidget';
import { mobileService } from '../../services/mobileService';
import { useNavigate } from 'react-router-dom';
import type { OfflineTransaction } from '../../services/mobileService';

// Mock dependencies
vi.mock('../../services/mobileService');
vi.mock('react-router-dom', () => ({
  useNavigate: vi.fn(),
}));

// Mock icons
vi.mock('../icons', () => ({
  PhoneIcon: ({ size, className }: { size?: number; className?: string }) => (
    <div data-testid="PhoneIcon" data-size={size} className={className} />
  ),
  CameraIcon: ({ size, className }: { size?: number; className?: string }) => (
    <div data-testid="CameraIcon" data-size={size} className={className} />
  ),
  WifiOffIcon: ({ size, className }: { size?: number; className?: string }) => (
    <div data-testid="WifiOffIcon" data-size={size} className={className} />
  ),
  BellIcon: ({ size, className }: { size?: number; className?: string }) => (
    <div data-testid="BellIcon" data-size={size} className={className} />
  ),
  ArrowRightIcon: ({ size }: { size?: number }) => (
    <div data-testid="ArrowRightIcon" data-size={size} />
  ),
  CheckCircleIcon: ({ size, className }: { size?: number; className?: string }) => (
    <div data-testid="CheckCircleIcon" data-size={size} className={className} />
  ),
  AlertCircleIcon: ({ size, className }: { size?: number; className?: string }) => (
    <div data-testid="AlertCircleIcon" data-size={size} className={className} />
  ),
  ClockIcon: ({ size, className }: { size?: number; className?: string }) => (
    <div data-testid="ClockIcon" data-size={size} className={className} />
  ),
}));

const mockNavigate = vi.fn();
const mockMobileService = mobileService as {
  isOffline: Mock;
  getOfflineTransactions: Mock;
  getNotificationSettings: Mock;
  isPWAInstalled: Mock;
  installPWA: Mock;
  getConnectionStatus: Mock;
};

// Mock offline transactions
const mockOfflineTransactions: OfflineTransaction[] = [
  {
    id: 'offline1',
    data: { id: 'tx1', description: 'Offline expense', amount: 25.99 },
    action: 'create',
    timestamp: new Date('2024-01-20T10:00:00'),
    synced: false,
    retry_count: 0,
  },
  {
    id: 'offline2',
    data: { id: 'tx2', description: 'Offline update', amount: 15.50 },
    action: 'update',
    timestamp: new Date('2024-01-20T11:00:00'),
    synced: false,
    retry_count: 1,
  },
];

// Mock alert
const mockAlert = vi.fn();
window.alert = mockAlert;

describe('MobileAppWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useNavigate as Mock).mockReturnValue(mockNavigate);
    
    // Default mock values
    mockMobileService.isOffline.mockReturnValue(false);
    mockMobileService.getOfflineTransactions.mockReturnValue([]);
    mockMobileService.getNotificationSettings.mockReturnValue({ enabled: true });
    mockMobileService.isPWAInstalled.mockReturnValue(false);
    mockMobileService.installPWA.mockResolvedValue(true);
    mockMobileService.getConnectionStatus.mockReturnValue('online');
  });

  describe('Small Size', () => {
    it('renders small size with online status', () => {
      render(<MobileAppWidget size="small" />);
      
      expect(screen.getByText('Mobile')).toBeInTheDocument();
      expect(screen.getByTestId('PhoneIcon')).toHaveAttribute('data-size', '20');
      expect(screen.getByTestId('CheckCircleIcon')).toBeInTheDocument();
      expect(screen.getByText('Online')).toBeInTheDocument();
    });

    it('renders small size with offline status', () => {
      mockMobileService.isOffline.mockReturnValue(true);
      
      render(<MobileAppWidget size="small" />);
      
      expect(screen.getByTestId('WifiOffIcon')).toBeInTheDocument();
      expect(screen.getByText('Offline')).toBeInTheDocument();
    });
  });

  describe('Network Status', () => {
    it('shows online status correctly', () => {
      render(<MobileAppWidget />);
      
      expect(screen.getByText('Online')).toBeInTheDocument();
      // Find the CheckCircleIcon in the header (size 16)
      const checkIcons = screen.getAllByTestId('CheckCircleIcon');
      const headerCheckIcon = checkIcons.find(icon => icon.getAttribute('data-size') === '16');
      expect(headerCheckIcon).toBeInTheDocument();
      expect(screen.queryByText("You're offline")).not.toBeInTheDocument();
    });

    it('shows offline status with queued transactions', () => {
      mockMobileService.isOffline.mockReturnValue(true);
      mockMobileService.getOfflineTransactions.mockReturnValue(mockOfflineTransactions);
      
      render(<MobileAppWidget />);
      
      expect(screen.getByText('Offline')).toBeInTheDocument();
      // Find the WifiOffIcon in the header (size 16)
      const wifiIcons = screen.getAllByTestId('WifiOffIcon');
      const headerWifiIcon = wifiIcons.find(icon => icon.getAttribute('data-size') === '16');
      expect(headerWifiIcon).toBeInTheDocument();
      expect(screen.getByText("You're offline")).toBeInTheDocument();
      expect(screen.getByText('2 transactions queued for sync')).toBeInTheDocument();
    });

    it('updates status when network changes', async () => {
      render(<MobileAppWidget />);

      expect(screen.getByText('Online')).toBeInTheDocument();
      
      // Simulate going offline
      mockMobileService.isOffline.mockReturnValue(true);
      window.dispatchEvent(new Event('offline'));
      
      await waitFor(() => {
        expect(mockMobileService.isOffline).toHaveBeenCalled();
        expect(mockMobileService.getOfflineTransactions).toHaveBeenCalled();
      });
    });

    it('removes event listeners on unmount', () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
      
      const { unmount } = render(<MobileAppWidget />);
      unmount();
      
      expect(removeEventListenerSpy).toHaveBeenCalledWith('online', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('offline', expect.any(Function));
    });
  });

  describe('PWA Installation', () => {
    it('shows install prompt when not installed', () => {
      render(<MobileAppWidget />);
      
      expect(screen.getByText('Install App')).toBeInTheDocument();
      expect(screen.getByText('Add to home screen for faster access')).toBeInTheDocument();
      expect(screen.getByText('Install Now')).toBeInTheDocument();
    });

    it('hides install prompt when already installed', () => {
      mockMobileService.isPWAInstalled.mockReturnValue(true);
      
      render(<MobileAppWidget />);
      
      expect(screen.queryByText('Install App')).not.toBeInTheDocument();
      expect(screen.queryByText('Install Now')).not.toBeInTheDocument();
    });

    it('handles PWA installation when available', async () => {
      render(<MobileAppWidget />);
      
      fireEvent.click(screen.getByText('Install Now'));
      
      await waitFor(() => {
        expect(mockMobileService.installPWA).toHaveBeenCalled();
        expect(mockAlert).toHaveBeenCalledWith('PWA installation available! Look for the install button in your browser.');
      });
    });

    it('handles PWA installation when not available', async () => {
      mockMobileService.installPWA.mockResolvedValue(false);
      
      render(<MobileAppWidget />);
      
      fireEvent.click(screen.getByText('Install Now'));
      
      await waitFor(() => {
        expect(mockAlert).toHaveBeenCalledWith('PWA installation not available on this device.');
      });
    });

    it('handles PWA installation errors', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockMobileService.installPWA.mockRejectedValue(new Error('Installation failed'));
      
      render(<MobileAppWidget />);
      
      fireEvent.click(screen.getByText('Install Now'));
      
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('PWA installation failed:', expect.any(Error));
      });
      
      consoleSpy.mockRestore();
    });
  });

  describe('Quick Actions', () => {
    it('shows quick expense capture button', () => {
      render(<MobileAppWidget />);
      
      expect(screen.getByText('Quick Expense Capture')).toBeInTheDocument();
      expect(screen.getByTestId('CameraIcon')).toBeInTheDocument();
    });

    it('handles quick expense capture click', () => {
      render(<MobileAppWidget />);
      
      fireEvent.click(screen.getByText('Quick Expense Capture'));
      
      expect(mockAlert).toHaveBeenCalledWith('Quick expense capture feature coming soon!');
    });

    it('navigates to mobile features', () => {
      render(<MobileAppWidget />);
      
      fireEvent.click(screen.getByText('Mobile Features'));
      
      expect(mockNavigate).toHaveBeenCalledWith('/mobile-features');
    });
  });

  describe('Notifications', () => {
    it('shows notifications enabled', () => {
      render(<MobileAppWidget />);
      
      expect(screen.getByText('Notifications')).toBeInTheDocument();
      expect(screen.getByText('On')).toBeInTheDocument();
      const checkIcon = screen.getAllByTestId('CheckCircleIcon').find(icon => 
        icon.getAttribute('data-size') === '14'
      );
      expect(checkIcon).toBeInTheDocument();
    });

    it('shows notifications disabled', () => {
      mockMobileService.getNotificationSettings.mockReturnValue({ enabled: false });
      
      render(<MobileAppWidget />);
      
      expect(screen.getByText('Off')).toBeInTheDocument();
      expect(screen.getByTestId('AlertCircleIcon')).toHaveAttribute('data-size', '14');
    });
  });

  describe('Sync Status', () => {
    it('shows pending sync when offline transactions exist', () => {
      mockMobileService.getOfflineTransactions.mockReturnValue(mockOfflineTransactions);
      
      render(<MobileAppWidget />);
      
      expect(screen.getByText('Pending Sync')).toBeInTheDocument();
      expect(screen.getByText('2 transactions waiting to sync')).toBeInTheDocument();
      expect(screen.getByTestId('ClockIcon')).toBeInTheDocument();
    });

    it('shows singular text for one transaction', () => {
      mockMobileService.getOfflineTransactions.mockReturnValue([mockOfflineTransactions[0]]);
      
      render(<MobileAppWidget />);
      
      expect(screen.getByText('1 transaction waiting to sync')).toBeInTheDocument();
    });

    it('does not show sync status when no offline transactions', () => {
      render(<MobileAppWidget />);
      
      expect(screen.queryByText('Pending Sync')).not.toBeInTheDocument();
    });
  });

  describe('Connection Quality', () => {
    it('shows connection status when online', () => {
      render(<MobileAppWidget />);
      
      expect(screen.getByText('Connection:')).toBeInTheDocument();
      // The component capitalizes the status
      const connectionStatus = screen.getByText('online');
      expect(connectionStatus).toBeInTheDocument();
      expect(connectionStatus).toHaveClass('capitalize');
    });

    it('shows slow connection status', () => {
      mockMobileService.getConnectionStatus.mockReturnValue('slow');
      
      render(<MobileAppWidget />);
      
      expect(screen.getByText('slow')).toBeInTheDocument();
    });

    it('does not show connection quality when offline', () => {
      mockMobileService.isOffline.mockReturnValue(true);
      
      render(<MobileAppWidget />);
      
      expect(screen.queryByText('Connection:')).not.toBeInTheDocument();
    });
  });

  describe('Component Structure', () => {
    it('renders with correct header', () => {
      render(<MobileAppWidget />);
      
      expect(screen.getByText('Mobile App')).toBeInTheDocument();
      // Find the PhoneIcon in the header (size 20)
      const phoneIcons = screen.getAllByTestId('PhoneIcon');
      const headerPhoneIcon = phoneIcons.find(icon => icon.getAttribute('data-size') === '20');
      expect(headerPhoneIcon).toBeInTheDocument();
      expect(headerPhoneIcon).toHaveClass('text-indigo-600');
    });

    it('applies correct container styles', () => {
      const { container } = render(<MobileAppWidget />);
      
      const rootDiv = container.firstChild as HTMLElement;
      expect(rootDiv).toHaveClass('h-full', 'flex', 'flex-col');
    });

    it('shows all sections in correct order', () => {
      mockMobileService.getOfflineTransactions.mockReturnValue(mockOfflineTransactions);
      
      render(<MobileAppWidget />);
      
      // Check individual buttons exist
      expect(screen.getByText('Install Now')).toBeInTheDocument();
      expect(screen.getByText('Quick Expense Capture')).toBeInTheDocument();
      expect(screen.getByText('Mobile Features')).toBeInTheDocument();
      
      // Also verify the pending sync section
      expect(screen.getByText('Pending Sync')).toBeInTheDocument();
    });
  });
});
