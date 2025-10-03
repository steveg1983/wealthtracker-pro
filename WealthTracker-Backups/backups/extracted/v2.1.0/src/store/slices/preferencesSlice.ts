import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { logger } from '../../services/loggingService';

export type Theme = 'light' | 'dark' | 'auto' | 'scheduled';
export type ColorTheme = 'green' | 'blue' | 'purple' | 'orange';

interface ThemeSchedule {
  startTime: string;
  endTime: string;
  theme: 'light' | 'dark';
}

interface PageVisibility {
  showBudget: boolean;
  showGoals: boolean;
  showAnalytics: boolean;
}

export interface PreferencesState {
  theme: Theme;
  colorTheme: ColorTheme;
  currency: string;
  compactView: boolean;
  pageVisibility: PageVisibility;
  goalCelebration: boolean;
  firstName: string;
  themeSchedule?: ThemeSchedule;
}

const loadPreferencesFromStorage = (): Partial<PreferencesState> => {
  try {
    const stored = localStorage.getItem('preferences');
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
};

const savePreferencesToStorage = (preferences: PreferencesState) => {
  try {
    localStorage.setItem('preferences', JSON.stringify(preferences));
  } catch (error) {
    logger.error('Failed to save preferences:', error);
  }
};

const initialState: PreferencesState = {
  theme: 'auto',
  colorTheme: 'green',
  currency: 'GBP',
  compactView: true, // Default to compact view
  pageVisibility: {
    showBudget: true,
    showGoals: true,
    showAnalytics: true,
  },
  goalCelebration: true,
  firstName: '',
  ...loadPreferencesFromStorage(),
};

const preferencesSlice = createSlice({
  name: 'preferences',
  initialState,
  reducers: {
    setTheme: (state, action: PayloadAction<Theme>) => {
      state.theme = action.payload;
      savePreferencesToStorage(state);
    },
    setColorTheme: (state, action: PayloadAction<ColorTheme>) => {
      state.colorTheme = action.payload;
      savePreferencesToStorage(state);
    },
    setCurrency: (state, action: PayloadAction<string>) => {
      state.currency = action.payload;
      savePreferencesToStorage(state);
    },
    setCompactView: (state, action: PayloadAction<boolean>) => {
      state.compactView = action.payload;
      savePreferencesToStorage(state);
    },
    setPageVisibility: (state, action: PayloadAction<Partial<PageVisibility>>) => {
      state.pageVisibility = { ...state.pageVisibility, ...action.payload };
      savePreferencesToStorage(state);
    },
    setGoalCelebration: (state, action: PayloadAction<boolean>) => {
      state.goalCelebration = action.payload;
      savePreferencesToStorage(state);
    },
    setFirstName: (state, action: PayloadAction<string>) => {
      state.firstName = action.payload;
      savePreferencesToStorage(state);
    },
    setThemeSchedule: (state, action: PayloadAction<ThemeSchedule | undefined>) => {
      state.themeSchedule = action.payload;
      savePreferencesToStorage(state);
    },
    updatePreferences: (state, action: PayloadAction<Partial<PreferencesState>>) => {
      Object.assign(state, action.payload);
      savePreferencesToStorage(state);
    },
  },
});

export const {
  setTheme,
  setColorTheme,
  setCurrency,
  setCompactView,
  setPageVisibility,
  setGoalCelebration,
  setFirstName,
  setThemeSchedule,
  updatePreferences,
} = preferencesSlice.actions;

export { preferencesSlice };

export default preferencesSlice.reducer;