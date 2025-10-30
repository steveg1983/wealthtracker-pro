import { configureStore } from '@reduxjs/toolkit';
import type { AnyAction, ThunkDispatch, ConfigureStoreOptions } from '@reduxjs/toolkit';
import { combineReducers } from 'redux';
import { useDispatch, useSelector } from 'react-redux';
import type { TypedUseSelectorHook } from 'react-redux';

// Import slices (to be added)
import accountsReducer from './slices/accountsSlice';
import transactionsReducer from './slices/transactionsSlice';
import budgetsReducer from './slices/budgetsSlice';
import categoriesReducer from './slices/categoriesSlice';
import goalsReducer from './slices/goalsSlice';
import tagsReducer from './slices/tagsSlice';
import recurringTransactionsReducer from './slices/recurringTransactionsSlice';
import preferencesReducer from './slices/preferencesSlice';
import notificationsReducer from './slices/notificationsSlice';
import layoutReducer from './slices/layoutSlice';
import demoReducer from './slices/demoSlice';

const reducers = {
  accounts: accountsReducer,
  transactions: transactionsReducer,
  budgets: budgetsReducer,
  categories: categoriesReducer,
  goals: goalsReducer,
  tags: tagsReducer,
  recurringTransactions: recurringTransactionsReducer,
  preferences: preferencesReducer,
  notifications: notificationsReducer,
  layout: layoutReducer,
  demo: demoReducer,
};

const rootReducer = combineReducers(reducers);

export type RootState = ReturnType<typeof rootReducer>;

export type RootPreloadedState = Partial<RootState>;

export const createAppStore = (preloadedState?: RootPreloadedState) => {
  const config: ConfigureStoreOptions<RootState> = {
    reducer: rootReducer,
    middleware: getDefaultMiddleware =>
      getDefaultMiddleware({
        serializableCheck: {
          // Ignore these action types
          ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
          // Ignore these field paths in all actions
          ignoredActionPaths: ['meta.arg', 'payload.timestamp'],
          // Ignore these paths in the state
          ignoredPaths: ['items.dates'],
        },
      }),
    devTools: process.env.NODE_ENV !== 'production',
  };

  if (preloadedState && Object.keys(preloadedState).length > 0) {
    config.preloadedState = preloadedState as RootState;
  }

  return configureStore(config);
};

export const store = createAppStore();

export type AppStore = typeof store;
export type AppDispatch = ThunkDispatch<RootState, unknown, AnyAction>;

// Export typed hooks
export const useAppDispatch = (): AppDispatch => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
