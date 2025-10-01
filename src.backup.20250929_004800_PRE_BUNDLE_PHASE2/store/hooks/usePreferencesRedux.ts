import { useCallback, useMemo } from 'react';
import { useAppDispatch, useAppSelector } from '../index';
import {
  setTheme,
  setColorTheme,
  setCurrency,
  setCompactView,
  setPageVisibility,
  setGoalCelebration,
  setFirstName,
  setThemeSchedule,
  updatePreferences,
  type Theme,
  type ColorTheme,
  type PreferencesState
} from '../slices/preferencesSlice';

// This hook provides the same interface as the existing PreferencesContext
export function usePreferencesRedux() {
  const dispatch = useAppDispatch();
  
  // Select all preferences state
  const theme = useAppSelector(state => state.preferences.theme);
  const colorTheme = useAppSelector(state => state.preferences.colorTheme);
  const currency = useAppSelector(state => state.preferences.currency);
  const compactView = useAppSelector(state => state.preferences.compactView);
  const pageVisibility = useAppSelector(state => state.preferences.pageVisibility);
  const goalCelebration = useAppSelector(state => state.preferences.goalCelebration);
  const firstName = useAppSelector(state => state.preferences.firstName);
  const themeSchedule = useAppSelector(state => state.preferences.themeSchedule);
  
  // Methods that match the PreferencesContext interface
  const setThemeMethod = useCallback((newTheme: Theme) => {
    dispatch(setTheme(newTheme));
  }, [dispatch]);
  
  const setColorThemeMethod = useCallback((newColorTheme: ColorTheme) => {
    dispatch(setColorTheme(newColorTheme));
  }, [dispatch]);
  
  const setCurrencyMethod = useCallback((newCurrency: string) => {
    dispatch(setCurrency(newCurrency));
  }, [dispatch]);
  
  const setCompactViewMethod = useCallback((newCompactView: boolean) => {
    dispatch(setCompactView(newCompactView));
  }, [dispatch]);
  
  const setPageVisibilityMethod = useCallback((visibility: Partial<{
    showBudget: boolean;
    showGoals: boolean;
    showAnalytics: boolean;
  }>) => {
    dispatch(setPageVisibility(visibility));
  }, [dispatch]);
  
  const setGoalCelebrationMethod = useCallback((enabled: boolean) => {
    dispatch(setGoalCelebration(enabled));
  }, [dispatch]);
  
  const setFirstNameMethod = useCallback((name: string) => {
    dispatch(setFirstName(name));
  }, [dispatch]);
  
  const setThemeScheduleMethod = useCallback((schedule: {
    startTime: string;
    endTime: string;
    theme: 'light' | 'dark';
  } | undefined) => {
    dispatch(setThemeSchedule(schedule));
  }, [dispatch]);
  
  const updatePreferencesMethod = useCallback((updates: Partial<PreferencesState>) => {
    dispatch(updatePreferences(updates));
  }, [dispatch]);
  
  // Return the same interface as PreferencesContext
  return useMemo(() => ({
    // State
    theme,
    colorTheme,
    currency,
    compactView,
    pageVisibility,
    goalCelebration,
    firstName,
    themeSchedule,
    
    // Methods
    setTheme: setThemeMethod,
    setColorTheme: setColorThemeMethod,
    setCurrency: setCurrencyMethod,
    setCompactView: setCompactViewMethod,
    setPageVisibility: setPageVisibilityMethod,
    setGoalCelebration: setGoalCelebrationMethod,
    setFirstName: setFirstNameMethod,
    setThemeSchedule: setThemeScheduleMethod,
    updatePreferences: updatePreferencesMethod
  }), [
    theme, colorTheme, currency, compactView, pageVisibility, 
    goalCelebration, firstName, themeSchedule,
    setThemeMethod, setColorThemeMethod, setCurrencyMethod, 
    setCompactViewMethod, setPageVisibilityMethod, setGoalCelebrationMethod,
    setFirstNameMethod, setThemeScheduleMethod, updatePreferencesMethod
  ]);
}