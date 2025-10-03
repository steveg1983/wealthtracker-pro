import type { ImportProfile, BankFormat } from './types';
import { lazyLogger as logger } from '../serviceFactory';

/**
 * Import profile management
 * Handles saving and loading import configurations for different banks
 */
export class ProfileManager {
  private readonly STORAGE_KEY = 'csv_import_profiles';
  private profiles: ImportProfile[] = [];

  constructor() {
    this.loadProfiles();
  }

  /**
   * Load profiles from storage
   */
  loadProfiles(): ImportProfile[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        this.profiles = JSON.parse(stored);
      }
    } catch (error) {
      logger.error('Failed to load import profiles:', error);
      this.profiles = [];
    }
    return this.profiles;
  }

  /**
   * Save profiles to storage
   */
  saveProfiles(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.profiles));
    } catch (error) {
      logger.error('Failed to save import profiles:', error);
    }
  }

  /**
   * Get all profiles
   */
  getProfiles(): ImportProfile[] {
    return this.profiles;
  }

  /**
   * Get profile by ID
   */
  getProfile(id: string): ImportProfile | undefined {
    return this.profiles.find(p => p.id === id);
  }

  /**
   * Add or update profile
   */
  saveProfile(profile: ImportProfile): void {
    const index = this.profiles.findIndex(p => p.id === profile.id);
    
    if (index >= 0) {
      this.profiles[index] = { ...profile, lastUsed: new Date() };
    } else {
      this.profiles.push({ ...profile, lastUsed: new Date() });
    }
    
    this.saveProfiles();
  }

  /**
   * Delete profile
   */
  deleteProfile(id: string): void {
    this.profiles = this.profiles.filter(p => p.id !== id);
    this.saveProfiles();
  }

  /**
   * Get profiles for a specific bank
   */
  getProfilesByBank(bank: string): ImportProfile[] {
    return this.profiles.filter(p => p.bank === bank);
  }

  /**
   * Get most recently used profile
   */
  getMostRecentProfile(): ImportProfile | undefined {
    if (this.profiles.length === 0) return undefined;
    
    return [...this.profiles].sort((a, b) => {
      const dateA = a.lastUsed ? new Date(a.lastUsed).getTime() : 0;
      const dateB = b.lastUsed ? new Date(b.lastUsed).getTime() : 0;
      return dateB - dateA;
    })[0];
  }

  /**
   * Common bank formats
   */
  getBankFormats(): BankFormat[] {
    return [
      {
        name: 'Chase',
        dateColumn: 'Transaction Date',
        amountColumn: 'Amount',
        descriptionColumn: 'Description',
        dateFormat: 'MM/DD/YYYY',
        hasHeaders: true,
        delimiter: ','
      },
      {
        name: 'Bank of America',
        dateColumn: 'Date',
        amountColumn: 'Amount',
        descriptionColumn: 'Description',
        dateFormat: 'MM/DD/YYYY',
        hasHeaders: true,
        delimiter: ','
      },
      {
        name: 'Wells Fargo',
        dateColumn: 'Date',
        amountColumn: 'Amount',
        descriptionColumn: 'Description',
        dateFormat: 'MM/DD/YYYY',
        hasHeaders: true,
        delimiter: ','
      },
      {
        name: 'Barclays UK',
        dateColumn: 'Date',
        amountColumn: 'Amount',
        descriptionColumn: 'Memo',
        dateFormat: 'DD/MM/YYYY',
        hasHeaders: true,
        delimiter: ','
      },
      {
        name: 'HSBC',
        dateColumn: 'Date',
        amountColumn: 'Amount',
        descriptionColumn: 'Description',
        dateFormat: 'DD/MM/YYYY',
        hasHeaders: true,
        delimiter: ','
      },
      {
        name: 'Lloyds',
        dateColumn: 'Transaction Date',
        amountColumn: 'Debit Amount',
        descriptionColumn: 'Transaction Description',
        dateFormat: 'DD/MM/YYYY',
        hasHeaders: true,
        delimiter: ','
      },
      {
        name: 'Generic CSV',
        dateColumn: 'Date',
        amountColumn: 'Amount',
        descriptionColumn: 'Description',
        dateFormat: 'YYYY-MM-DD',
        hasHeaders: true,
        delimiter: ','
      }
    ];
  }
}

export const profileManager = new ProfileManager();