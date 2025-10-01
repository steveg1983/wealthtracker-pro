import React, { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import type { AppDispatch } from '../store';
import { setAccounts } from '../store/slices/accountsSlice';
import { setTransactions } from '../store/slices/transactionsSlice';
import { setCategories } from '../store/slices/categoriesSlice';
import { setTags } from '../store/slices/tagsSlice';
import { setBudgets } from '../store/slices/budgetsSlice';
import { setGoals } from '../store/slices/goalsSlice';
import { setRecurringTransactions } from '../store/slices/recurringTransactionsSlice';
import { updatePreferences } from '../store/slices/preferencesSlice';
import { useApp } from '../contexts/AppContextSupabase';
import { usePreferences } from '../contexts/PreferencesContext';
import { serializeForRedux } from '../utils/serializeForRedux';
import type { RecurringTransaction } from '../types';

/**
 * This component syncs data from existing contexts to Redux store
 * during the migration period. Once migration is complete, this
 * component can be removed.
 */
export function ReduxMigrationWrapper({ children }: { children: React.ReactNode }) {
  const dispatch = useDispatch<AppDispatch>();
  
  // Get data from existing contexts
  const { 
    accounts, 
    transactions, 
    categories, 
    tags,
    budgets,
    goals,
    recurringTransactions
  } = useApp();
  
  const preferences = usePreferences();

  // Sync app context data to Redux
  useEffect(() => {
    dispatch(setAccounts(serializeForRedux(accounts)));
  }, [dispatch, accounts]);

  useEffect(() => {
    dispatch(setTransactions(serializeForRedux(transactions)));
  }, [dispatch, transactions]);

  useEffect(() => {
    dispatch(setCategories(categories));
  }, [dispatch, categories]);

  useEffect(() => {
    dispatch(setTags(tags.map(tag => tag.name)));
  }, [dispatch, tags]);

  useEffect(() => {
    dispatch(setBudgets(serializeForRedux(budgets)));
  }, [dispatch, budgets]);

  useEffect(() => {
    dispatch(setGoals(serializeForRedux(goals)));
  }, [dispatch, goals]);

  useEffect(() => {
    // Pass through context transactions; serialization handles Date fields
    const serialized = serializeForRedux(recurringTransactions);
    dispatch(setRecurringTransactions(serialized as RecurringTransaction[]));
  }, [dispatch, recurringTransactions]);

  // Sync preferences to Redux
  useEffect(() => {
    // Map PreferencesContext properties to Redux state structure
    // Handle color theme mapping - Context uses 'red'/'pink' but Redux expects 'purple'/'orange'
    let mappedColorTheme: 'green' | 'blue' | 'purple' | 'orange' = 'green';
    switch (preferences.colorTheme) {
      case 'green':
        mappedColorTheme = 'green';
        break;
      case 'blue':
        mappedColorTheme = 'blue';
        break;
      case 'red':
        mappedColorTheme = 'purple'; // Map red to purple
        break;
      case 'pink':
        mappedColorTheme = 'orange'; // Map pink to orange
        break;
    }
    
    const basePreferences = {
      theme: preferences.theme,
      colorTheme: mappedColorTheme,
      currency: preferences.currency,
      compactView: preferences.compactView,
      pageVisibility: {
        showBudget: preferences.showBudget,
        showGoals: preferences.showGoals,
        showAnalytics: preferences.showAnalytics,
      },
      goalCelebration: preferences.enableGoalCelebrations,
      firstName: preferences.firstName,
    };

    const reduxPreferences = preferences.themeSchedule.enabled
      ? {
          ...basePreferences,
          themeSchedule: {
            startTime: preferences.themeSchedule.lightStartTime,
            endTime: preferences.themeSchedule.darkStartTime,
            theme: 'light' as const
          }
        }
      : basePreferences;

    dispatch(updatePreferences(reduxPreferences));
  }, [dispatch, preferences]);

  return <>{children}</>;
}
