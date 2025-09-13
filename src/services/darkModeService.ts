import { logger } from './loggingService';

export interface DarkModeSettings {
  mode: 'light' | 'dark' | 'system' | 'auto';
  autoSchedule?: {
    enabled: boolean;
    lightStart: string; // "06:00"
    darkStart: string;  // "18:00"
  };
  contrastMode: 'normal' | 'high' | 'highest';
  smoothTransitions: boolean;
  preserveColorPreference: boolean;
}

export type Theme = 'light' | 'dark';

/**
 * Service for managing dark mode settings and theme calculations
 */
export class DarkModeService {
  private static readonly STORAGE_KEY = 'wealthtracker_darkModeSettings';

  /**
   * Load saved settings from localStorage
   */
  static loadSettings(): DarkModeSettings {
    const saved = localStorage.getItem(this.STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        logger.error('Failed to parse dark mode settings:', e);
      }
    }
    return this.getDefaultSettings();
  }

  /**
   * Save settings to localStorage
   */
  static saveSettings(settings: DarkModeSettings): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(settings));
  }

  /**
   * Get default settings
   */
  static getDefaultSettings(): DarkModeSettings {
    return {
      mode: 'system',
      autoSchedule: {
        enabled: false,
        lightStart: '06:00',
        darkStart: '18:00'
      },
      contrastMode: 'normal',
      smoothTransitions: true,
      preserveColorPreference: true
    };
  }

  /**
   * Determine current theme based on settings
   */
  static determineTheme(settings: DarkModeSettings): Theme {
    if (settings.mode === 'light') return 'light';
    if (settings.mode === 'dark') return 'dark';
    
    if (settings.mode === 'auto' && settings.autoSchedule?.enabled) {
      return this.getScheduledTheme(settings.autoSchedule);
    }
    
    if (settings.mode === 'system') {
      return this.getSystemTheme();
    }
    
    return 'light';
  }

  /**
   * Get theme based on schedule
   */
  static getScheduledTheme(schedule: { lightStart: string; darkStart: string }): Theme {
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    
    const [lightHour, lightMin] = schedule.lightStart.split(':').map(Number);
    const [darkHour, darkMin] = schedule.darkStart.split(':').map(Number);
    
    const lightTime = lightHour * 60 + lightMin;
    const darkTime = darkHour * 60 + darkMin;
    
    if (currentTime >= lightTime && currentTime < darkTime) {
      return 'light';
    }
    return 'dark';
  }

  /**
   * Get system theme preference
   */
  static getSystemTheme(): Theme {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  /**
   * Apply theme to document
   */
  static applyTheme(theme: Theme, settings: DarkModeSettings): void {
    const root = document.documentElement;
    
    // Apply smooth transition if enabled
    if (settings.smoothTransitions) {
      root.style.transition = 'background-color 0.3s ease, color 0.3s ease';
      setTimeout(() => {
        root.style.transition = '';
      }, 300);
    }
    
    // Apply theme class
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    
    // Apply contrast mode
    root.setAttribute('data-contrast', settings.contrastMode);
    
    // Apply contrast multiplier
    this.applyContrastMultiplier(settings.contrastMode);
  }

  /**
   * Apply contrast multiplier CSS variable
   */
  static applyContrastMultiplier(contrastMode: 'normal' | 'high' | 'highest'): void {
    const root = document.documentElement;
    
    if (contrastMode === 'high') {
      root.style.setProperty('--contrast-multiplier', '1.2');
    } else if (contrastMode === 'highest') {
      root.style.setProperty('--contrast-multiplier', '1.5');
    } else {
      root.style.setProperty('--contrast-multiplier', '1');
    }
  }

  /**
   * Get theme mode options
   */
  static getThemeModeOptions() {
    return [
      { value: 'light', label: 'Light' },
      { value: 'dark', label: 'Dark' },
      { value: 'system', label: 'System' },
      { value: 'auto', label: 'Auto' }
    ] as const;
  }

  /**
   * Get contrast mode options
   */
  static getContrastModeOptions() {
    return [
      { value: 'normal', label: 'Normal', desc: 'WCAG AA compliant' },
      { value: 'high', label: 'High', desc: 'Enhanced contrast' },
      { value: 'highest', label: 'Highest', desc: 'Maximum contrast' }
    ] as const;
  }
}

export const darkModeService = new DarkModeService();