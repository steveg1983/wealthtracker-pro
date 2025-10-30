// Re-export slice reducers for consumers that want direct access
export { default as accountsReducer, accountsSlice } from './accountsSlice';
export { default as transactionsReducer, transactionsSlice } from './transactionsSlice';
export { default as budgetsReducer, budgetsSlice } from './budgetsSlice';
export { default as goalsReducer, goalsSlice } from './goalsSlice';
export { default as categoriesReducer, categoriesSlice } from './categoriesSlice';
export { default as preferencesReducer, preferencesSlice } from './preferencesSlice';
export { default as notificationsReducer, notificationsSlice } from './notificationsSlice';
export { default as layoutReducer, layoutSlice } from './layoutSlice';
export { default as tagsReducer, tagsSlice } from './tagsSlice';
export { default as recurringTransactionsReducer, recurringTransactionsSlice } from './recurringTransactionsSlice';
