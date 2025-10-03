import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SecurityWidget from './SecurityWidget';
import { securityService } from '../../services/securityService';
import { useNavigate } from 'react-router-dom';
import type { SecuritySettings } from '../../services/securityService';

// Mock services and hooks
vi.mock('../../services/securityService');
vi.mock('react-router-dom', () => ({
  useNavigate: vi.fn(),
}));

// Mock icons
vi.mock('../icons', () => ({
  ShieldIcon: ({ size, className }: { size?: number; className?: string }) => (
    <div data-testid="ShieldIcon" data-size={size} className={className} />
  ),
  LockIcon: ({ size }: { size?: number }) => (
    <div data-testid="LockIcon" data-size={size} />
  ),
  AlertTriangleIcon: ({ size, className }: { size?: number; className?: string }) => (
    <div data-testid="AlertTriangleIcon" data-size={size} className={className} />
  ),
  CheckCircleIcon: ({ size, className }: { size?: number; className?: string }) => (
    <div data-testid="CheckCircleIcon" data-size={size} className={className} />
  ),
  EyeIcon: ({ size, className }: { size?: number; className?: string }) => (
    <div data-testid="EyeIcon" data-size={size} className={className} />
  ),
  ArrowRightIcon: ({ size }: { size?: number }) => (
    <div data-testid="ArrowRightIcon" data-size={size} />
  ),
}));

const mockNavigate = vi.fn();
const mockSecurityService = securityService as {
  getSecuritySettings: Mock;
  getAuditLogs: Mock;
};

// Mock data
const defaultSecuritySettings: SecuritySettings = {
  twoFactorEnabled: false,
  biometricEnabled: false,
  encryptionEnabled: false,
  sessionTimeout: 60,
  failedAttempts: 0,
  readOnlyMode: false,
};

const excellentSecuritySettings: SecuritySettings = {
  twoFactorEnabled: true,
  biometricEnabled: true,
  encryptionEnabled: true,
  sessionTimeout: 15,
  failedAttempts: 0,
  readOnlyMode: false,
};

describe('SecurityWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useNavigate as Mock).mockReturnValue(mockNavigate);
    mockSecurityService.getSecuritySettings.mockReturnValue(defaultSecuritySettings);
    mockSecurityService.getAuditLogs.mockReturnValue([]);
  });

  describe('Small Size', () => {
    it('renders small size with score', () => {
      render(<SecurityWidget size="small" />);
      
      expect(screen.getByText('Security')).toBeInTheDocument();
      expect(screen.getByText('Security Score')).toBeInTheDocument();
      expect(screen.getByTestId('ShieldIcon')).toHaveAttribute('data-size', '20');
    });

    it('displays calculated security score', () => {
      mockSecurityService.getSecuritySettings.mockReturnValue({
        ...defaultSecuritySettings,
        twoFactorEnabled: true,
        encryptionEnabled: true,
      });
      
      render(<SecurityWidget size="small" />);
      
      // 3 out of 5 features enabled (2FA, encryption, and 0 failed attempts) = 60%
      expect(screen.getByText('60%')).toBeInTheDocument();
    });

    it('navigates to security settings on click', () => {
      render(<SecurityWidget size="small" />);
      
      const container = screen.getByText('Security').closest('.cursor-pointer');
      fireEvent.click(container!);
      
      expect(mockNavigate).toHaveBeenCalledWith('/settings/security');
    });
  });

  describe('Security Score Calculation', () => {
    it('calculates 20% with only default features', () => {
      render(<SecurityWidget size="medium" />);
      
      // Default has 0 failed attempts = 1/5 = 20%
      expect(screen.getByText('20%')).toBeInTheDocument();
    });

    it('calculates 100% with all features enabled', () => {
      mockSecurityService.getSecuritySettings.mockReturnValue(excellentSecuritySettings);
      
      render(<SecurityWidget size="medium" />);
      
      expect(screen.getByText('100%')).toBeInTheDocument();
    });

    it('calculates partial scores correctly', () => {
      mockSecurityService.getSecuritySettings.mockReturnValue({
        ...defaultSecuritySettings,
        twoFactorEnabled: true,
        encryptionEnabled: true,
        sessionTimeout: 25, // Better than default
      });
      
      render(<SecurityWidget size="medium" />);
      
      // 4 out of 5 = 80% (2FA, encryption, short timeout, no failed attempts)
      expect(screen.getByText('80%')).toBeInTheDocument();
    });
  });

  describe('Security Status', () => {
    it('shows Poor status for low scores', () => {
      mockSecurityService.getSecuritySettings.mockReturnValue(defaultSecuritySettings);
      
      render(<SecurityWidget size="medium" />);
      
      expect(screen.getByText('Poor')).toBeInTheDocument();
      expect(screen.getByText('Poor')).toHaveClass('text-red-600');
    });

    it('shows Fair status for medium-low scores', () => {
      mockSecurityService.getSecuritySettings.mockReturnValue({
        ...defaultSecuritySettings,
        twoFactorEnabled: true,
      });
      
      render(<SecurityWidget size="medium" />);
      
      // 2 out of 5 = 40%
      expect(screen.getByText('Fair')).toBeInTheDocument();
      expect(screen.getByText('Fair')).toHaveClass('text-yellow-600');
    });

    it('shows Good status for medium-high scores', () => {
      mockSecurityService.getSecuritySettings.mockReturnValue({
        ...defaultSecuritySettings,
        twoFactorEnabled: true,
        encryptionEnabled: true,
      });
      
      render(<SecurityWidget size="medium" />);
      
      // 3 out of 5 = 60%
      expect(screen.getByText('Good')).toBeInTheDocument();
      expect(screen.getByText('Good')).toHaveClass('text-blue-600');
    });

    it('shows Excellent status for high scores', () => {
      mockSecurityService.getSecuritySettings.mockReturnValue(excellentSecuritySettings);
      
      render(<SecurityWidget size="medium" />);
      
      expect(screen.getByText('Excellent')).toBeInTheDocument();
      expect(screen.getByText('Excellent')).toHaveClass('text-green-600');
    });
  });

  describe('Security Features Display', () => {
    it('shows checkmark for enabled features', () => {
      mockSecurityService.getSecuritySettings.mockReturnValue({
        ...defaultSecuritySettings,
        twoFactorEnabled: true,
        encryptionEnabled: true,
      });
      
      render(<SecurityWidget size="medium" />);
      
      const checkIcons = screen.getAllByTestId('CheckCircleIcon');
      expect(checkIcons).toHaveLength(2);
    });

    it('shows warning for disabled features', () => {
      mockSecurityService.getSecuritySettings.mockReturnValue(defaultSecuritySettings);
      
      render(<SecurityWidget size="medium" />);
      
      const alertIcons = screen.getAllByTestId('AlertTriangleIcon');
      // 2 red alerts for critical features + 1 yellow for biometric
      expect(alertIcons.length).toBeGreaterThanOrEqual(2);
    });

    it('displays all three security features', () => {
      render(<SecurityWidget size="medium" />);
      
      expect(screen.getByText('Two-Factor Auth')).toBeInTheDocument();
      expect(screen.getByText('Data Encryption')).toBeInTheDocument();
      expect(screen.getByText('Biometric Login')).toBeInTheDocument();
    });
  });

  describe('Warnings and Alerts', () => {
    it('shows read-only mode warning when active', () => {
      mockSecurityService.getSecuritySettings.mockReturnValue({
        ...defaultSecuritySettings,
        readOnlyMode: true,
      });
      
      render(<SecurityWidget size="medium" />);
      
      expect(screen.getByText('Read-only mode is active')).toBeInTheDocument();
      expect(screen.getByTestId('EyeIcon')).toBeInTheDocument();
    });

    it('does not show read-only warning when inactive', () => {
      render(<SecurityWidget size="medium" />);
      
      expect(screen.queryByText('Read-only mode is active')).not.toBeInTheDocument();
    });

    it('shows failed login attempts warning', () => {
      mockSecurityService.getSecuritySettings.mockReturnValue({
        ...defaultSecuritySettings,
        failedAttempts: 3,
      });
      
      render(<SecurityWidget size="medium" />);
      
      expect(screen.getByText('3 failed login attempts')).toBeInTheDocument();
    });

    it('shows singular text for single failed attempt', () => {
      mockSecurityService.getSecuritySettings.mockReturnValue({
        ...defaultSecuritySettings,
        failedAttempts: 1,
      });
      
      render(<SecurityWidget size="medium" />);
      
      expect(screen.getByText('1 failed login attempt')).toBeInTheDocument();
    });

    it('does not show failed attempts warning when zero', () => {
      render(<SecurityWidget size="medium" />);
      
      expect(screen.queryByText(/failed login attempt/)).not.toBeInTheDocument();
    });
  });

  describe('Recent Activity', () => {
    it('displays recent activity count', () => {
      mockSecurityService.getAuditLogs.mockReturnValue([
        { id: '1', timestamp: new Date() },
        { id: '2', timestamp: new Date() },
        { id: '3', timestamp: new Date() },
      ]);
      
      render(<SecurityWidget size="medium" />);
      
      expect(screen.getByText('3 events (7 days)')).toBeInTheDocument();
    });

    it('queries audit logs for last 7 days', () => {
      render(<SecurityWidget size="medium" />);
      
      expect(mockSecurityService.getAuditLogs).toHaveBeenCalledWith({
        startDate: expect.any(Date),
      });
      
      const callArgs = mockSecurityService.getAuditLogs.mock.calls[0][0];
      const startDate = callArgs.startDate;
      const daysDiff = (Date.now() - startDate.getTime()) / (1000 * 60 * 60 * 24);
      expect(daysDiff).toBeCloseTo(7, 0);
    });
  });

  describe('Progress Bar', () => {
    it('renders progress bar with correct width', () => {
      mockSecurityService.getSecuritySettings.mockReturnValue({
        ...defaultSecuritySettings,
        twoFactorEnabled: true,
      });
      
      render(<SecurityWidget size="medium" />);
      
      // 2 out of 5 = 40%
      const progressBar = screen.getByText('40%').parentElement?.parentElement?.querySelector('.transition-all');
      expect(progressBar).toHaveStyle({ width: '40%' });
    });

    it('applies correct color classes based on score', () => {
      render(<SecurityWidget size="medium" />);
      
      // Default is 20% which is red
      const progressBar = screen.getByText('20%').parentElement?.parentElement?.querySelector('.transition-all');
      expect(progressBar).toHaveClass('bg-red-500');
    });

    it('applies green color for high scores', () => {
      mockSecurityService.getSecuritySettings.mockReturnValue(excellentSecuritySettings);
      
      render(<SecurityWidget size="medium" />);
      
      const progressBar = screen.getByText('100%').parentElement?.parentElement?.querySelector('.transition-all');
      expect(progressBar).toHaveClass('bg-green-500');
    });
  });

  describe('Navigation', () => {
    it('shows view security settings button', () => {
      render(<SecurityWidget size="medium" />);
      
      expect(screen.getByText('View Security Settings')).toBeInTheDocument();
      expect(screen.getByTestId('ArrowRightIcon')).toBeInTheDocument();
    });

    it('navigates to security settings on button click', () => {
      render(<SecurityWidget size="medium" />);
      
      fireEvent.click(screen.getByText('View Security Settings'));
      
      expect(mockNavigate).toHaveBeenCalledWith('/settings/security');
    });
  });

  describe('Component Structure', () => {
    it('renders with correct header', () => {
      render(<SecurityWidget size="medium" />);
      
      expect(screen.getByText('Security Status')).toBeInTheDocument();
      expect(screen.getByTestId('ShieldIcon')).toHaveClass('text-indigo-600');
    });

    it('applies correct container styles', () => {
      const { container } = render(<SecurityWidget size="medium" />);
      
      const rootDiv = container.firstChild as HTMLElement;
      expect(rootDiv).toHaveClass('h-full', 'flex', 'flex-col');
    });
  });

  describe('Return Type', () => {
    it('is a valid React component', () => {
      // Just test that it renders without errors
      expect(() => {
        render(<SecurityWidget size="medium" />);
      }).not.toThrow();
    });
  });
});