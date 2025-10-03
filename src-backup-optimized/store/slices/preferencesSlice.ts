import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { lazyLogger } from '../../services/serviceFactory';

const logger = lazyLogger.getLogger('PreferencesSlice');

export type Theme = 'light' | 'dark' | 'auto' | 'scheduled';
export type ColorTheme = 'blue' | 'green' | 'red' | 'pink';

export interface ThemeSchedule {
  enabled: boolean;
  lightStartTime: string;
  darkStartTime: string;
}

export interface PreferencesState {
  compactView: boolean;
  currency: string;
  theme: Theme;
  colorTheme: ColorTheme;
  firstName: string;
  themeSchedule: ThemeSchedule;
  showBudget: boolean;
  showGoals: boolean;
  showAnalytics: boolean;
  showInvestments: boolean;
  showEnhancedInvestments: boolean;
  showAIAnalytics: boolean;
  showFinancialPlanning: boolean;
  showDataIntelligence: boolean;
  showSummaries: boolean;
  showTaxPlanning: boolean;
  showHousehold: boolean;
  showBusinessFeatures: boolean;
  enableGoalCelebrations: boolean;
  preferences: Record<string, unknown>;
  loading: boolean;
  error: string | null;
}

const loadPreferencesFromStorage = (): Partial<PreferencesState> => {
  try {
    const stored = localStorage.getItem('preferences');
    return stored ? JSON.parse(stored) : {};
  } catch (error) {
    logger.error('Failed to load preferences from storage:', error);
    return {};
  }
};

const savePreferencesToStorage = (preferences: PreferencesState): void => {
  try {
    const { loading, error, ...prefsToSave } = preferences;
    localStorage.setItem('preferences', JSON.stringify(prefsToSave));
  } catch (error) {
    logger.error('Failed to save preferences to storage:', error);
  }
};

const initialState: PreferencesState = {
  compactView: false,
  currency: 'GBP',
  theme: 'auto',
  colorTheme: 'blue',
  firstName: '',
  themeSchedule: {
    enabled: false,
    lightStartTime: '06:00',
    darkStartTime: '18:00'
  },
  showBudget: true,
  showGoals: true,
  showAnalytics: true,
  showInvestments: false,
  showEnhancedInvestments: false,
  showAIAnalytics: false,
  showFinancialPlanning: false,
  showDataIntelligence: false,
  showSummaries: true,
  showTaxPlanning: false,
  showHousehold: false,
  showBusinessFeatures: false,
  enableGoalCelebrations: true,
  preferences: {},
  loading: false,
  error: null,
  ...loadPreferencesFromStorage(),
};

const preferencesSlice = createSlice({
  name: 'preferences',
  initialState,
  reducers: {
    setCompactView: (state, action: PayloadAction<boolean>) => {
      state.compactView = action.payload;
      savePreferencesToStorage(state);
    },
    setCurrency: (state, action: PayloadAction<string>) => {
      state.currency = action.payload;
      savePreferencesToStorage(state);
    },
    setTheme: (state, action: PayloadAction<Theme>) => {
      state.theme = action.payload;
      savePreferencesToStorage(state);
    },
    setColorTheme: (state, action: PayloadAction<ColorTheme>) => {
      state.colorTheme = action.payload;
      savePreferencesToStorage(state);
    },
    setFirstName: (state, action: PayloadAction<string>) => {
      state.firstName = action.payload;
      savePreferencesToStorage(state);
    },
    setThemeSchedule: (state, action: PayloadAction<ThemeSchedule>) => {
      state.themeSchedule = action.payload;
      savePreferencesToStorage(state);
    },
    setShowBudget: (state, action: PayloadAction<boolean>) => {
      state.showBudget = action.payload;
      savePreferencesToStorage(state);
    },
    setShowGoals: (state, action: PayloadAction<boolean>) => {
      state.showGoals = action.payload;
      savePreferencesToStorage(state);
    },
    setShowAnalytics: (state, action: PayloadAction<boolean>) => {
      state.showAnalytics = action.payload;
      savePreferencesToStorage(state);
    },
    setShowInvestments: (state, action: PayloadAction<boolean>) => {
      state.showInvestments = action.payload;
      savePreferencesToStorage(state);
    },
    setShowEnhancedInvestments: (state, action: PayloadAction<boolean>) => {
      state.showEnhancedInvestments = action.payload;
      savePreferencesToStorage(state);
    },
    setShowAIAnalytics: (state, action: PayloadAction<boolean>) => {
      state.showAIAnalytics = action.payload;
      savePreferencesToStorage(state);
    },
    setShowFinancialPlanning: (state, action: PayloadAction<boolean>) => {
      state.showFinancialPlanning = action.payload;
      savePreferencesToStorage(state);
    },
    setShowDataIntelligence: (state, action: PayloadAction<boolean>) => {
      state.showDataIntelligence = action.payload;
      savePreferencesToStorage(state);
    },
    setShowSummaries: (state, action: PayloadAction<boolean>) => {
      state.showSummaries = action.payload;
      savePreferencesToStorage(state);
    },
    setShowTaxPlanning: (state, action: PayloadAction<boolean>) => {
      state.showTaxPlanning = action.payload;
      savePreferencesToStorage(state);
    },
    setShowHousehold: (state, action: PayloadAction<boolean>) => {
      state.showHousehold = action.payload;
      savePreferencesToStorage(state);
    },
    setShowBusinessFeatures: (state, action: PayloadAction<boolean>) => {
      state.showBusinessFeatures = action.payload;
      savePreferencesToStorage(state);
    },
    setEnableGoalCelebrations: (state, action: PayloadAction<boolean>) => {
      state.enableGoalCelebrations = action.payload;
      savePreferencesToStorage(state);
    },
    updatePreferences: (state, action: PayloadAction<Record<string, unknown>>) => {
      state.preferences = { ...state.preferences, ...action.payload };
      savePreferencesToStorage(state);
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    resetPreferences: (state) => {
      const { loading, error } = state;
      Object.assign(state, {
        ...initialState,
        loading,
        error
      });
      try {
        localStorage.removeItem('preferences');
      } catch (error) {
        logger.error('Failed to clear preferences from storage:', error);
      }
    },
  },
});

export const {
  setCompactView,
  setCurrency,
  setTheme,
  setColorTheme,
  setFirstName,
  setThemeSchedule,
  setShowBudget,
  setShowGoals,
  setShowAnalytics,
  setShowInvestments,
  setShowEnhancedInvestments,
  setShowAIAnalytics,
  setShowFinancialPlanning,
  setShowDataIntelligence,
  setShowSummaries,
  setShowTaxPlanning,
  setShowHousehold,
  setShowBusinessFeatures,
  setEnableGoalCelebrations,
  updatePreferences,
  setLoading,
  setError,
  resetPreferences,
} = preferencesSlice.actions;

export { preferencesSlice };
export default preferencesSlice.reducer;