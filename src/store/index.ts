import { configureStore, type PreloadedState } from '@reduxjs/toolkit';
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

const rootReducer = {
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

type RootReducer = typeof rootReducer;

export type RootState = {
  [K in keyof RootReducer]: ReturnType<RootReducer[K]>;
};

export const createAppStore = (preloadedState?: PreloadedState<RootState>) =>
  configureStore({
    reducer: rootReducer,
    preloadedState,
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
  });

export const store = createAppStore();

export type AppStore = typeof store;
// Infer the `AppDispatch` type from the store itself
export type AppDispatch = AppStore['dispatch'];

// Export typed hooks
export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
