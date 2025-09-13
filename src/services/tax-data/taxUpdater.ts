import type { Region } from '../../hooks/useRegionalSettings';
import type { 
  TaxDataVersion, 
  TaxUpdateNotification,
  TaxConstants,
  TaxDataUpdate 
} from './types';
import { logger } from '../loggingService';

/**
 * Tax data update service
 * Manages tax data versions and updates
 */
export class TaxUpdater {
  private taxVersions: Map<string, TaxDataVersion> = new Map();
  private notifications: TaxUpdateNotification[] = [];
  private readonly STORAGE_KEY = 'taxDataUpdates';

  constructor() {
    this.loadNotifications();
    this.initializeVersions();
  }

  /**
   * Initialize tax data versions
   */
  private initializeVersions(): void {
    // US 2024 version
    this.taxVersions.set('US-2024', {
      year: 2024,
      lastUpdated: '2024-01-01',
      source: 'IRS Revenue Procedure 2023-32',
      isActive: true,
      changeNotes: [
        'Standard deduction increased to $14,600 (single)',
        'Tax brackets adjusted for inflation',
        'Social Security wage base increased to $168,600'
      ]
    });

    // UK 2024/25 version
    this.taxVersions.set('UK-2024/25', {
      year: '2024/25',
      lastUpdated: '2024-04-06',
      source: 'HMRC Budget 2024',
      isActive: true,
      changeNotes: [
        'Personal allowance remains at £12,570',
        'Higher rate threshold remains at £50,270',
        'Additional rate threshold remains at £125,140',
        'National Insurance rates: 8% main rate, 2% additional rate'
      ]
    });

    // UK 2025/26 version (preview)
    this.taxVersions.set('UK-2025/26', {
      year: '2025/26',
      lastUpdated: '2025-01-01',
      source: 'HMRC Autumn Statement 2024',
      isActive: false,
      changeNotes: [
        'Tax thresholds frozen until 2028',
        'National Insurance changes pending'
      ]
    });
  }

  /**
   * Load notifications from storage
   */
  private loadNotifications(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        this.notifications = JSON.parse(stored);
      }
    } catch (error) {
      logger.error('Failed to load tax notifications:', error);
    }
  }

  /**
   * Save notifications to storage
   */
  private saveNotifications(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.notifications));
    } catch (error) {
      logger.error('Failed to save tax notifications:', error);
    }
  }

  /**
   * Check for tax updates
   */
  async checkForUpdates(region: Region): Promise<TaxUpdateNotification[]> {
    const newNotifications: TaxUpdateNotification[] = [];
    
    // In production, this would check an API for updates
    // For now, we'll simulate update detection
    const currentYear = new Date().getFullYear();
    const versionKey = region === 'US' ? `US-${currentYear}` : `UK-${currentYear}/${(currentYear + 1).toString().slice(2)}`;
    const version = this.taxVersions.get(versionKey);
    
    if (version && !this.hasNotificationForVersion(versionKey)) {
      const notification: TaxUpdateNotification = {
        id: `tax-update-${versionKey}-${Date.now()}`,
        region,
        taxYear: version.year.toString(),
        changes: version.changeNotes || [],
        effectiveDate: version.lastUpdated,
        dismissed: false
      };
      
      newNotifications.push(notification);
      this.notifications.push(notification);
      this.saveNotifications();
    }
    
    return newNotifications;
  }

  /**
   * Check if notification exists for version
   */
  private hasNotificationForVersion(versionKey: string): boolean {
    return this.notifications.some(n => 
      n.taxYear === this.taxVersions.get(versionKey)?.year.toString()
    );
  }

  /**
   * Get active notifications
   */
  getActiveNotifications(region?: Region): TaxUpdateNotification[] {
    return this.notifications.filter(n => 
      !n.dismissed && (region === undefined || n.region === region)
    );
  }

  /**
   * Dismiss notification
   */
  dismissNotification(id: string): void {
    const notification = this.notifications.find(n => n.id === id);
    if (notification) {
      notification.dismissed = true;
      this.saveNotifications();
    }
  }

  /**
   * Get tax data version
   */
  getVersion(region: Region, year?: number | string): TaxDataVersion | null {
    const targetYear = year || (region === 'US' ? new Date().getFullYear() : `${new Date().getFullYear()}/${(new Date().getFullYear() + 1).toString().slice(2)}`);
    const versionKey = `${region}-${targetYear}`;
    return this.taxVersions.get(versionKey) || null;
  }

  /**
   * Get all versions for region
   */
  getVersionsForRegion(region: Region): TaxDataVersion[] {
    const versions: TaxDataVersion[] = [];
    
    this.taxVersions.forEach((version, key) => {
      if (key.startsWith(region)) {
        versions.push(version);
      }
    });
    
    return versions.sort((a, b) => {
      const yearA = typeof a.year === 'number' ? a.year : parseInt(a.year.split('/')[0]);
      const yearB = typeof b.year === 'number' ? b.year : parseInt(b.year.split('/')[0]);
      return yearB - yearA;
    });
  }

  /**
   * Validate tax data update
   */
  validateUpdate(update: TaxDataUpdate): boolean {
    try {
      // Validate structure
      if (!update.region || !update.year || !update.data || !update.source) {
        logger.error('Invalid tax update structure');
        return false;
      }
      
      // Validate data ranges
      if (update.data.brackets) {
        for (const bracket of update.data.brackets) {
          if (bracket.rate < 0 || bracket.rate > 1) {
            logger.error('Invalid tax rate in bracket', bracket);
            return false;
          }
          if (bracket.min < 0) {
            logger.error('Invalid bracket minimum', bracket);
            return false;
          }
        }
      }
      
      // Validate deductions
      if (update.data.standardDeduction) {
        const deductions = Object.values(update.data.standardDeduction);
        if (deductions.some(d => d < 0)) {
          logger.error('Invalid standard deduction');
          return false;
        }
      }
      
      return true;
    } catch (error) {
      logger.error('Tax update validation failed', error);
      return false;
    }
  }

  /**
   * Apply tax data update
   */
  applyUpdate(update: TaxDataUpdate): boolean {
    if (!this.validateUpdate(update)) {
      return false;
    }
    
    const versionKey = `${update.region}-${update.year}`;
    
    // Create new version
    const newVersion: TaxDataVersion = {
      year: update.year,
      lastUpdated: update.effectiveDate.toISOString().split('T')[0],
      source: update.source,
      isActive: true,
      changeNotes: this.generateChangeNotes(update)
    };
    
    // Deactivate old version
    const oldVersion = this.taxVersions.get(versionKey);
    if (oldVersion) {
      oldVersion.isActive = false;
    }
    
    // Add new version
    this.taxVersions.set(versionKey, newVersion);
    
    // Create notification
    const notification: TaxUpdateNotification = {
      id: `tax-update-${versionKey}-${Date.now()}`,
      region: update.region,
      taxYear: update.year.toString(),
      changes: newVersion.changeNotes || [],
      effectiveDate: newVersion.lastUpdated,
      dismissed: false
    };
    
    this.notifications.push(notification);
    this.saveNotifications();
    
    logger.info('Tax update applied successfully', { versionKey });
    return true;
  }

  /**
   * Generate change notes from update
   */
  private generateChangeNotes(update: TaxDataUpdate): string[] {
    const notes: string[] = [];
    
    if (update.data.standardDeduction) {
      notes.push('Standard deduction amounts updated');
    }
    
    if (update.data.brackets && update.data.brackets.length > 0) {
      notes.push('Tax brackets adjusted');
    }
    
    if (update.data.personalAllowance !== undefined) {
      notes.push(`Personal allowance set to £${update.data.personalAllowance.toLocaleString()}`);
    }
    
    notes.push(`Source: ${update.source}`);
    
    return notes;
  }
}

export const taxUpdater = new TaxUpdater();