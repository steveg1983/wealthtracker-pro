import { themeSchedulingService } from './themeSchedulingService';
import type { ThemeSchedule, ThemePreset } from './themeSchedulingService';

export type ActiveTab = 'schedules' | 'presets' | 'settings';

interface ThemeData {
  schedules: ThemeSchedule[];
  presets: ThemePreset[];
  currentSchedule: ThemeSchedule | null;
}

export interface SystemSettings {
  followSystemTheme: boolean;
  overrideSystemPreferences: boolean;
  smoothTransitions: boolean;
  reduceMotion: boolean;
}

class ThemeSettingsPageService {
  async loadThemeData(): Promise<ThemeData> {
    return {
      schedules: themeSchedulingService.getSchedules(),
      presets: themeSchedulingService.getPresets(),
      currentSchedule: themeSchedulingService.getCurrentSchedule()
    };
  }

  activateSchedule(id: string): void {
    themeSchedulingService.activateSchedule(id);
  }

  deactivateSchedule(): void {
    themeSchedulingService.deactivateSchedule();
  }

  deleteSchedule(id: string): boolean {
    if (!confirm('Are you sure you want to delete this schedule?')) {
      return false;
    }
    themeSchedulingService.deleteSchedule(id);
    return true;
  }

  deletePreset(id: string, presets: ThemePreset[]): boolean {
    const preset = presets.find(p => p.id === id);
    if (preset && !preset.isCustom) {
      alert('Cannot delete default presets');
      return false;
    }
    
    if (!confirm('Are you sure you want to delete this preset?')) {
      return false;
    }
    
    themeSchedulingService.deletePreset(id);
    return true;
  }

  createSchedule(scheduleData: Omit<ThemeSchedule, 'id' | 'createdAt' | 'lastUpdated'>): void {
    themeSchedulingService.createSchedule(scheduleData);
  }

  getCurrentTheme(): 'light' | 'dark' {
    return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  }

  formatTime(time: string): string {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${minutes} ${ampm}`;
  }

  formatDays(days: number[]): string {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days.map(day => dayNames[day]).join(', ');
  }

  getNextThemeChange(): { time: string; theme: 'light' | 'dark' } | null {
    return themeSchedulingService.getNextThemeChange();
  }

  setThemeChangeCallback(callback: (theme: 'light' | 'dark') => void): void {
    themeSchedulingService.setThemeChangeCallback(callback);
  }

  getTabButtonClass(isActive: boolean): string {
    return isActive
      ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
      : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300';
  }

  getScheduleBorderClass(isActive: boolean): string {
    return isActive
      ? 'border-green-500 dark:border-green-400'
      : 'border-transparent';
  }

  getDefaultSystemSettings(): SystemSettings {
    return {
      followSystemTheme: false,
      overrideSystemPreferences: true,
      smoothTransitions: true,
      reduceMotion: false
    };
  }
}

export const themeSettingsPageService = new ThemeSettingsPageService();