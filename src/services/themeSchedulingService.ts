import type { SavedThemeSchedule, SavedThemePreset } from '../types/theme';

export interface ThemeSchedule {
  id: string;
  name: string;
  isActive: boolean;
  scheduleType: 'time-based' | 'sunrise-sunset' | 'manual';
  
  // Time-based scheduling
  lightModeStart?: string; // HH:MM format
  darkModeStart?: string; // HH:MM format
  
  // Location-based (sunrise/sunset)
  latitude?: number;
  longitude?: number;
  
  // Days of week (0 = Sunday, 6 = Saturday)
  activeDays?: number[];
  
  // Override settings
  holidayBehavior?: 'follow-schedule' | 'always-light' | 'always-dark';
  weekendBehavior?: 'follow-schedule' | 'always-light' | 'always-dark';
  
  createdAt: Date;
  lastUpdated: Date;
}

export interface ThemePreset {
  id: string;
  name: string;
  description: string;
  lightTheme: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    text: string;
  };
  darkTheme: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    text: string;
  };
  isCustom: boolean;
  createdAt: Date;
}

class ThemeSchedulingService {
  private schedules: ThemeSchedule[] = [];
  private presets: ThemePreset[] = [];
  private currentSchedule: ThemeSchedule | null = null;
  private schedulingInterval: NodeJS.Timeout | null = null;
  private onThemeChange?: (theme: 'light' | 'dark') => void;

  constructor() {
    this.loadData();
    this.initializeDefaultPresets();
    this.initializeDefaultSchedules();
    this.startScheduling();
  }

  private loadData() {
    try {
      const savedSchedules = localStorage.getItem('theme-schedules');
      if (savedSchedules) {
        this.schedules = JSON.parse(savedSchedules).map((schedule: SavedThemeSchedule) => ({
          ...schedule,
          createdAt: new Date(schedule.createdAt),
          lastUpdated: new Date(schedule.lastUpdated)
        }));
      }

      const savedPresets = localStorage.getItem('theme-presets');
      if (savedPresets) {
        this.presets = JSON.parse(savedPresets).map((preset: SavedThemePreset) => ({
          ...preset,
          createdAt: new Date(preset.createdAt)
        }));
      }

      const savedCurrentSchedule = localStorage.getItem('current-theme-schedule');
      if (savedCurrentSchedule) {
        const scheduleId = JSON.parse(savedCurrentSchedule);
        this.currentSchedule = this.schedules.find(s => s.id === scheduleId) || null;
      }
    } catch (error) {
      console.error('Error loading theme scheduling data:', error);
    }
  }

  private saveData() {
    try {
      localStorage.setItem('theme-schedules', JSON.stringify(this.schedules));
      localStorage.setItem('theme-presets', JSON.stringify(this.presets));
      localStorage.setItem('current-theme-schedule', JSON.stringify(this.currentSchedule?.id || null));
    } catch (error) {
      console.error('Error saving theme scheduling data:', error);
    }
  }

  private initializeDefaultPresets() {
    if (this.presets.length === 0) {
      const defaultPresets: Omit<ThemePreset, 'id' | 'createdAt'>[] = [
        {
          name: 'Ocean Blue',
          description: 'Calming blue tones for focused work',
          lightTheme: {
            primary: '#0ea5e9',
            secondary: '#0284c7',
            accent: '#06b6d4',
            background: '#f8fafc',
            surface: '#ffffff',
            text: '#1e293b'
          },
          darkTheme: {
            primary: '#38bdf8',
            secondary: '#0ea5e9',
            accent: '#22d3ee',
            background: '#0f172a',
            surface: '#1e293b',
            text: '#f1f5f9'
          },
          isCustom: false
        },
        {
          name: 'Forest Green',
          description: 'Natural green themes for a refreshing experience',
          lightTheme: {
            primary: '#10b981',
            secondary: '#059669',
            accent: '#34d399',
            background: '#f0fdf4',
            surface: '#ffffff',
            text: '#1f2937'
          },
          darkTheme: {
            primary: '#34d399',
            secondary: '#10b981',
            accent: '#6ee7b7',
            background: '#064e3b',
            surface: '#065f46',
            text: '#ecfdf5'
          },
          isCustom: false
        },
        {
          name: 'Sunset Orange',
          description: 'Warm orange hues for evening comfort',
          lightTheme: {
            primary: '#f97316',
            secondary: '#ea580c',
            accent: '#fb923c',
            background: '#fffbeb',
            surface: '#ffffff',
            text: '#1c1917'
          },
          darkTheme: {
            primary: '#fb923c',
            secondary: '#f97316',
            accent: '#fdba74',
            background: '#431407',
            surface: '#7c2d12',
            text: '#fef3c7'
          },
          isCustom: false
        },
        {
          name: 'Purple Dreams',
          description: 'Creative purple palette for inspiration',
          lightTheme: {
            primary: '#8b5cf6',
            secondary: '#7c3aed',
            accent: '#a78bfa',
            background: '#faf5ff',
            surface: '#ffffff',
            text: '#1f2937'
          },
          darkTheme: {
            primary: '#a78bfa',
            secondary: '#8b5cf6',
            accent: '#c4b5fd',
            background: '#3c1362',
            surface: '#581c87',
            text: '#f3e8ff'
          },
          isCustom: false
        }
      ];

      this.presets = defaultPresets.map((preset, index) => ({
        ...preset,
        id: `preset-${index + 1}`,
        createdAt: new Date()
      }));
    }
  }

  private initializeDefaultSchedules() {
    if (this.schedules.length === 0) {
      const defaultSchedules: Omit<ThemeSchedule, 'id' | 'createdAt' | 'lastUpdated'>[] = [
        {
          name: 'Work Hours',
          isActive: false,
          scheduleType: 'time-based',
          lightModeStart: '08:00',
          darkModeStart: '18:00',
          activeDays: [1, 2, 3, 4, 5], // Monday to Friday
          holidayBehavior: 'always-light',
          weekendBehavior: 'follow-schedule'
        },
        {
          name: 'Natural Light',
          isActive: false,
          scheduleType: 'sunrise-sunset',
          latitude: 37.7749, // San Francisco default
          longitude: -122.4194,
          activeDays: [0, 1, 2, 3, 4, 5, 6], // All days
          holidayBehavior: 'follow-schedule',
          weekendBehavior: 'follow-schedule'
        },
        {
          name: 'Night Owl',
          isActive: false,
          scheduleType: 'time-based',
          lightModeStart: '10:00',
          darkModeStart: '16:00',
          activeDays: [0, 1, 2, 3, 4, 5, 6], // All days
          holidayBehavior: 'always-dark',
          weekendBehavior: 'always-dark'
        }
      ];

      this.schedules = defaultSchedules.map((schedule, index) => ({
        ...schedule,
        id: `schedule-${index + 1}`,
        createdAt: new Date(),
        lastUpdated: new Date()
      }));
    }
  }

  // Schedule Management
  getSchedules(): ThemeSchedule[] {
    return this.schedules.sort((a, b) => a.name.localeCompare(b.name));
  }

  createSchedule(schedule: Omit<ThemeSchedule, 'id' | 'createdAt' | 'lastUpdated'>): ThemeSchedule {
    const newSchedule: ThemeSchedule = {
      ...schedule,
      id: Date.now().toString(),
      createdAt: new Date(),
      lastUpdated: new Date()
    };

    this.schedules.push(newSchedule);
    this.saveData();
    return newSchedule;
  }

  updateSchedule(id: string, updates: Partial<ThemeSchedule>): ThemeSchedule | null {
    const index = this.schedules.findIndex(s => s.id === id);
    if (index === -1) return null;

    this.schedules[index] = {
      ...this.schedules[index],
      ...updates,
      lastUpdated: new Date()
    };

    // Update current schedule if it's the one being modified
    if (this.currentSchedule?.id === id) {
      this.currentSchedule = this.schedules[index];
    }

    this.saveData();
    return this.schedules[index];
  }

  deleteSchedule(id: string): boolean {
    const index = this.schedules.findIndex(s => s.id === id);
    if (index === -1) return false;

    // Deactivate if it's the current schedule
    if (this.currentSchedule?.id === id) {
      this.currentSchedule = null;
    }

    this.schedules.splice(index, 1);
    this.saveData();
    return true;
  }

  activateSchedule(id: string): boolean {
    const schedule = this.schedules.find(s => s.id === id);
    if (!schedule) return false;

    // Deactivate all other schedules
    this.schedules.forEach(s => s.isActive = false);
    
    // Activate the selected schedule
    schedule.isActive = true;
    this.currentSchedule = schedule;
    
    this.saveData();
    this.applyScheduleNow();
    return true;
  }

  deactivateSchedule(): void {
    if (this.currentSchedule) {
      this.currentSchedule.isActive = false;
      this.currentSchedule = null;
      this.saveData();
    }
  }

  getCurrentSchedule(): ThemeSchedule | null {
    return this.currentSchedule;
  }

  // Theme Presets
  getPresets(): ThemePreset[] {
    return this.presets.sort((a, b) => {
      if (!a.isCustom && b.isCustom) return -1;
      if (a.isCustom && !b.isCustom) return 1;
      return a.name.localeCompare(b.name);
    });
  }

  createPreset(preset: Omit<ThemePreset, 'id' | 'createdAt'>): ThemePreset {
    const newPreset: ThemePreset = {
      ...preset,
      id: Date.now().toString(),
      createdAt: new Date()
    };

    this.presets.push(newPreset);
    this.saveData();
    return newPreset;
  }

  updatePreset(id: string, updates: Partial<ThemePreset>): ThemePreset | null {
    const index = this.presets.findIndex(p => p.id === id);
    if (index === -1) return null;

    this.presets[index] = { ...this.presets[index], ...updates };
    this.saveData();
    return this.presets[index];
  }

  deletePreset(id: string): boolean {
    const index = this.presets.findIndex(p => p.id === id);
    if (index === -1) return false;

    this.presets.splice(index, 1);
    this.saveData();
    return true;
  }

  // Theme Application
  setThemeChangeCallback(callback: (theme: 'light' | 'dark') => void): void {
    this.onThemeChange = callback;
  }

  private startScheduling(): void {
    // Check every minute
    this.schedulingInterval = setInterval(() => {
      this.checkAndApplySchedule();
    }, 60000);

    // Check immediately
    this.checkAndApplySchedule();
  }

  private checkAndApplySchedule(): void {
    if (!this.currentSchedule || !this.currentSchedule.isActive) return;

    const shouldBeDark = this.shouldUseDarkTheme();
    const currentTheme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    
    if ((shouldBeDark && currentTheme === 'light') || (!shouldBeDark && currentTheme === 'dark')) {
      this.applyTheme(shouldBeDark ? 'dark' : 'light');
    }
  }

  private shouldUseDarkTheme(): boolean {
    if (!this.currentSchedule) return false;

    const now = new Date();
    const currentDay = now.getDay();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    // Check if today is in active days
    if (this.currentSchedule.activeDays && !this.currentSchedule.activeDays.includes(currentDay)) {
      return false;
    }

    // Handle weekend behavior
    if ((currentDay === 0 || currentDay === 6) && this.currentSchedule.weekendBehavior) {
      if (this.currentSchedule.weekendBehavior === 'always-light') return false;
      if (this.currentSchedule.weekendBehavior === 'always-dark') return true;
    }

    switch (this.currentSchedule.scheduleType) {
      case 'time-based':
        if (!this.currentSchedule.lightModeStart || !this.currentSchedule.darkModeStart) return false;
        
        const lightStart = this.currentSchedule.lightModeStart;
        const darkStart = this.currentSchedule.darkModeStart;
        
        // If dark mode starts before light mode (e.g., 18:00 to 08:00), handle day crossover
        if (darkStart < lightStart) {
          return currentTime >= darkStart || currentTime < lightStart;
        } else {
          return currentTime >= darkStart && currentTime < lightStart;
        }

      case 'sunrise-sunset':
        if (!this.currentSchedule.latitude || !this.currentSchedule.longitude) return false;
        
        const { sunrise, sunset } = this.calculateSunriseSunset(
          this.currentSchedule.latitude,
          this.currentSchedule.longitude,
          now
        );
        
        return currentTime < sunrise || currentTime >= sunset;

      case 'manual':
      default:
        return false;
    }
  }

  private calculateSunriseSunset(lat: number, lng: number, date: Date): { sunrise: string; sunset: string } {
    // Simplified sunrise/sunset calculation
    // In a real implementation, you'd use a proper astronomical library
    const dayOfYear = Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / (24 * 60 * 60 * 1000));
    const solarNoon = 12 - (lng / 15);
    const declination = 23.45 * Math.sin((360 / 365) * (dayOfYear - 81) * Math.PI / 180);
    
    // Calculate the hour angle, handling edge cases for extreme latitudes
    const tanLat = Math.tan(lat * Math.PI / 180);
    const tanDec = Math.tan(declination * Math.PI / 180);
    const cosHourAngle = -tanLat * tanDec;
    
    let sunrise: number;
    let sunset: number;
    
    // Handle extreme latitudes where sun doesn't rise or set
    if (cosHourAngle > 1) {
      // Polar night - sun never rises
      sunrise = 12;
      sunset = 12;
    } else if (cosHourAngle < -1) {
      // Polar day - sun never sets
      sunrise = 0;
      sunset = 24;
    } else {
      const hourAngle = Math.acos(cosHourAngle) * 180 / Math.PI / 15;
      sunrise = solarNoon - hourAngle;
      sunset = solarNoon + hourAngle;
    }
    
    const formatTime = (hours: number): string => {
      const h = Math.floor(hours);
      const m = Math.floor((hours - h) * 60);
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    };
    
    return {
      sunrise: formatTime(Math.max(0, Math.min(24, sunrise))),
      sunset: formatTime(Math.max(0, Math.min(24, sunset)))
    };
  }

  private applyTheme(theme: 'light' | 'dark'): void {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    // Update localStorage for persistence
    localStorage.setItem('theme', theme);

    // Notify callback
    if (this.onThemeChange) {
      this.onThemeChange(theme);
    }
  }

  applyScheduleNow(): void {
    if (this.currentSchedule && this.currentSchedule.isActive) {
      const shouldBeDark = this.shouldUseDarkTheme();
      this.applyTheme(shouldBeDark ? 'dark' : 'light');
    }
  }

  // Utility methods
  getNextThemeChange(): { time: string; theme: 'light' | 'dark' } | null {
    if (!this.currentSchedule || !this.currentSchedule.isActive) return null;

    if (this.currentSchedule.scheduleType === 'time-based') {
      const now = new Date();
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const isDark = this.shouldUseDarkTheme();
      
      if (isDark) {
        return {
          time: this.currentSchedule.lightModeStart || '08:00',
          theme: 'light'
        };
      } else {
        return {
          time: this.currentSchedule.darkModeStart || '18:00',
          theme: 'dark'
        };
      }
    }

    if (this.currentSchedule.scheduleType === 'sunrise-sunset' && 
        this.currentSchedule.latitude && this.currentSchedule.longitude) {
      const now = new Date();
      const { sunrise, sunset } = this.calculateSunriseSunset(
        this.currentSchedule.latitude,
        this.currentSchedule.longitude,
        now
      );
      
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const isDark = this.shouldUseDarkTheme();
      
      if (isDark) {
        return { time: sunrise, theme: 'light' };
      } else {
        return { time: sunset, theme: 'dark' };
      }
    }

    return null;
  }

  cleanup(): void {
    if (this.schedulingInterval) {
      clearInterval(this.schedulingInterval);
      this.schedulingInterval = null;
    }
  }
}

export const themeSchedulingService = new ThemeSchedulingService();