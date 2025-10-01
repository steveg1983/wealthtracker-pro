// Type definitions for theme scheduling service saved data

export interface SavedThemeSchedule {
  id: string;
  name: string;
  isActive: boolean;
  scheduleType: string;
  lightModeStart?: string;
  darkModeStart?: string;
  latitude?: number;
  longitude?: number;
  activeDays?: number[];
  holidayBehavior?: string;
  weekendBehavior?: string;
  createdAt: string;
  lastUpdated: string;
}

export interface SavedThemePreset {
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
  createdAt: string;
}