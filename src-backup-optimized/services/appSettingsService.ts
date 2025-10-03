/**
 * App Settings Service
 * Business logic for application settings management
 */

import { taxDataService } from './taxDataService';
import { SunIcon, MoonIcon, MonitorIcon, ClockIcon } from '../components/icons';

export interface Currency {
  code: string;
  name: string;
  symbol: string;
}

export interface ThemeOption {
  value: string;
  label: string;
  icon: typeof SunIcon;
}

export interface ColorTheme {
  value: string;
  label: string;
  colors: string[];
  description: string;
}

export interface PageToggle {
  title: string;
  description: string;
  value: boolean;
  onChange: (value: boolean) => void;
  icon: any;
}

export interface TaxUpdateResult {
  status: 'idle' | 'checking' | 'success' | 'error';
  message: string;
  verificationStatus?: 'valid' | 'invalid' | 'needs_update';
  lastChecked?: Date;
}

class AppSettingsService {
  /**
   * Get available currencies
   */
  getCurrencies(): Currency[] {
    return [
      { code: 'USD', name: 'US Dollar', symbol: '$' },
      { code: 'EUR', name: 'Euro', symbol: '¬' },
      { code: 'GBP', name: 'British Pound', symbol: '£' },
      { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
      { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
      { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
      { code: 'CHF', name: 'Swiss Franc', symbol: 'Fr' },
      { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
      { code: 'INR', name: 'Indian Rupee', symbol: '¹' },
      { code: 'MXN', name: 'Mexican Peso', symbol: '$' },
    ];
  }

  /**
   * Get theme options
   */
  getThemeOptions(): ThemeOption[] {
    return [
      { value: 'light', label: 'Light', icon: SunIcon },
      { value: 'dark', label: 'Dark', icon: MoonIcon },
      { value: 'auto', label: 'Auto', icon: MonitorIcon },
      { value: 'scheduled', label: 'Scheduled', icon: ClockIcon },
    ];
  }

  /**
   * Get color themes
   */
  getColorThemes(): ColorTheme[] {
    return [
      { 
        value: 'blue', 
        label: 'Ocean Blue', 
        colors: ['#7ba8d1', '#5a729a', '#b8d4f1'],
        description: 'Calm and professional'
      },
      { 
        value: 'green', 
        label: 'Forest Green', 
        colors: ['#a9d08e', '#7fa86b', '#d4e6c4'],
        description: 'Natural and growth-focused'
      },
      { 
        value: 'red', 
        label: 'Sunset Red', 
        colors: ['#e2a8a8', '#b88585', '#f1d4d4'],
        description: 'Warm and energetic'
      },
      { 
        value: 'pink', 
        label: 'Blossom Pink', 
        colors: ['#e2a8d4', '#b885a5', '#f1d4e8'],
        description: 'Creative and elegant'
      },
    ];
  }

  /**
   * Check for tax data updates
   */
  async checkTaxUpdates(region: string): Promise<TaxUpdateResult> {
    try {
      const result = await taxDataService.manualUpdateCheck();
      
      if (result.verificationResult) {
        const { status, errors, warnings } = result.verificationResult;
        
        if (status === 'valid') {
          return {
            status: 'success',
            message: `Tax data is up to date and verified for ${region}`,
            verificationStatus: 'valid',
            lastChecked: new Date()
          };
        } else if (status === 'needs_update') {
          return {
            status: 'success',
            message: `Tax data needs attention: ${warnings.join(', ')}`,
            verificationStatus: 'needs_update',
            lastChecked: new Date()
          };
        } else {
          return {
            status: 'error',
            message: `Tax data verification failed: ${errors.join(', ')}`,
            verificationStatus: 'invalid',
            lastChecked: new Date()
          };
        }
      }
      
      let message = `Tax data is up to date and verified for ${region}`;
      if (result.hasUpdates) {
        message += ` (${result.notifications.length} update${result.notifications.length > 1 ? 's' : ''} available)`;
      }
      
      return {
        status: 'success',
        message,
        lastChecked: new Date()
      };
    } catch (error) {
      return {
        status: 'error',
        message: 'Failed to check for tax updates. Please try again later.',
        lastChecked: new Date()
      };
    }
  }

  /**
   * Get tax data source info
   */
  getTaxDataSource(region: string): string {
    return region === 'US' 
      ? 'IRS Publication 15-T (2024)' 
      : 'HMRC Tax Calculator & GOV.UK API (2024/25)';
  }

  /**
   * Get tax verification source
   */
  getTaxVerificationSource(region: string): string {
    return region === 'US' 
      ? 'IRS Publication 15-T' 
      : 'HMRC Tax Calculator';
  }
}

export const appSettingsService = new AppSettingsService();