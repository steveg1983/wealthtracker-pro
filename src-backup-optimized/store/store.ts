import { configureStore } from '@reduxjs/toolkit';
import accountsReducer from './slices/accountsSlice';
import transactionsReducer from './slices/transactionsSlice';
import budgetsReducer from './slices/budgetsSlice';
import categoriesReducer from './slices/categoriesSlice';
import tagsReducer from './slices/tagsSlice';
import goalsReducer from './slices/goalsSlice';
import recurringTransactionsReducer from './slices/recurringTransactionsSlice';
import preferencesReducer from './slices/preferencesSlice';
import notificationsReducer from './slices/notificationsSlice';
import layoutReducer from './slices/layoutSlice';
import demoReducer from './slices/demoSlice';

export const store = configureStore({
  reducer: {
    accounts: accountsReducer,
    transactions: transactionsReducer,
    budgets: budgetsReducer,
    categories: categoriesReducer,
    tags: tagsReducer,
    goals: goalsReducer,
    recurringTransactions: recurringTransactionsReducer,
    preferences: preferencesReducer,
    notifications: notificationsReducer,
    layout: layoutReducer,
    demo: demoReducer,
  },
  middleware: (getDefaultMiddleware) =>
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
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
