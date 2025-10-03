/**
 * @module ServiceInterfaces
 * @description World-class service interfaces defining contracts for all
 * application services. Ensures type safety and loose coupling between
 * components and services.
 * 
 * @patterns
 * - Interface segregation
 * - Dependency inversion
 * - Contract-first design
 */

import { Transaction, Account, Category, Budget, Goal } from '../../../types';

/**
 * API service interface
 */
export interface IApiService {
  get<T>(url: string, options?: RequestInit): Promise<T>;
  post<T>(url: string, data: any, options?: RequestInit): Promise<T>;
  put<T>(url: string, data: any, options?: RequestInit): Promise<T>;
  delete<T>(url: string, options?: RequestInit): Promise<T>;
  setAuthToken(token: string): void;
  clearAuthToken(): void;
}

/**
 * Authentication service interface
 */
export interface IAuthService {
  login(email: string, password: string): Promise<{ token: string; user: any }>;
  logout(): Promise<void>;
  register(email: string, password: string): Promise<{ token: string; user: any }>;
  refreshToken(): Promise<string>;
  getCurrentUser(): any | null;
  isAuthenticated(): boolean;
  onAuthStateChange(callback: (user: any | null) => void): () => void;
}

/**
 * Transaction service interface
 */
export interface ITransactionService {
  getAll(): Promise<Transaction[]>;
  getById(id: string): Promise<Transaction>;
  create(transaction: Partial<Transaction>): Promise<Transaction>;
  update(id: string, transaction: Partial<Transaction>): Promise<Transaction>;
  delete(id: string): Promise<void>;
  bulkUpdate(ids: string[], updates: Partial<Transaction>): Promise<Transaction[]>;
  search(query: string): Promise<Transaction[]>;
  getByDateRange(startDate: Date, endDate: Date): Promise<Transaction[]>;
  getByAccount(accountId: string): Promise<Transaction[]>;
  getByCategory(categoryId: string): Promise<Transaction[]>;
}

/**
 * Account service interface
 */
export interface IAccountService {
  getAll(): Promise<Account[]>;
  getById(id: string): Promise<Account>;
  create(account: Partial<Account>): Promise<Account>;
  update(id: string, account: Partial<Account>): Promise<Account>;
  delete(id: string): Promise<void>;
  getBalance(id: string): Promise<number>;
  reconcile(id: string, balance: number): Promise<void>;
  getTransactions(id: string): Promise<Transaction[]>;
}

/**
 * Analytics service interface
 */
export interface IAnalyticsService {
  getSpendingByCategory(startDate: Date, endDate: Date): Promise<Map<string, number>>;
  getIncomeVsExpenses(period: 'month' | 'quarter' | 'year'): Promise<{
    income: number;
    expenses: number;
    net: number;
  }>;
  getCashFlow(months: number): Promise<Array<{
    month: string;
    inflow: number;
    outflow: number;
    net: number;
  }>>;
  getTrends(metric: string, periods: number): Promise<any[]>;
  getForecast(months: number): Promise<any[]>;
  getInsights(): Promise<Array<{
    type: string;
    title: string;
    description: string;
    impact: 'high' | 'medium' | 'low';
  }>>;
}

/**
 * Notification service interface
 */
export interface INotificationService {
  send(title: string, message: string, type?: 'info' | 'success' | 'warning' | 'error'): void;
  schedule(notification: {
    title: string;
    message: string;
    date: Date;
  }): Promise<string>;
  cancel(id: string): Promise<void>;
  requestPermission(): Promise<boolean>;
  isSupported(): boolean;
  getAll(): Promise<any[]>;
  markAsRead(id: string): Promise<void>;
}

/**
 * Storage service interface
 */
export interface IStorageService {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
  clear(): Promise<void>;
  getKeys(): Promise<string[]>;
  getSize(): Promise<number>;
}

/**
 * Export service interface
 */
export interface IExportService {
  exportToCSV(data: any[], filename: string): Promise<void>;
  exportToJSON(data: any, filename: string): Promise<void>;
  exportToPDF(content: string, filename: string): Promise<void>;
  exportToExcel(data: any[], filename: string): Promise<void>;
  generateReport(type: string, options: any): Promise<Blob>;
}

/**
 * Import service interface
 */
export interface IImportService {
  importCSV(file: File): Promise<any[]>;
  importJSON(file: File): Promise<any>;
  importOFX(file: File): Promise<Transaction[]>;
  importQIF(file: File): Promise<Transaction[]>;
  validateData(data: any[], schema: any): Promise<{
    valid: boolean;
    errors: string[];
  }>;
  mapFields(data: any[], mapping: Record<string, string>): Promise<any[]>;
}

/**
 * Sync service interface
 */
export interface ISyncService {
  sync(): Promise<void>;
  syncUp(): Promise<void>;
  syncDown(): Promise<void>;
  resolveConflicts(conflicts: any[]): Promise<void>;
  getLastSyncTime(): Date | null;
  isOnline(): boolean;
  onStatusChange(callback: (online: boolean) => void): () => void;
}

/**
 * Encryption service interface
 */
export interface IEncryptionService {
  encrypt(data: string, key?: string): Promise<string>;
  decrypt(data: string, key?: string): Promise<string>;
  hash(data: string): Promise<string>;
  generateKey(): Promise<string>;
  compareHash(data: string, hash: string): Promise<boolean>;
}

/**
 * Logger service interface
 */
export interface ILoggerService {
  debug(message: string, data?: any): void;
  info(message: string, data?: any): void;
  warn(message: string, data?: any): void;
  error(message: string, error?: any): void;
  setLevel(level: 'debug' | 'info' | 'warn' | 'error'): void;
  getLogs(): any[];
  clearLogs(): void;
}

/**
 * Performance monitoring service interface
 */
export interface IPerformanceService {
  startTrace(name: string): void;
  endTrace(name: string): void;
  measure(name: string, startMark: string, endMark: string): void;
  getMetrics(): any[];
  clearMetrics(): void;
  reportToAnalytics(): Promise<void>;
}

/**
 * Feature flag service interface
 */
export interface IFeatureFlagService {
  isEnabled(flag: string): boolean;
  getFlags(): Record<string, boolean>;
  setFlag(flag: string, enabled: boolean): void;
  refresh(): Promise<void>;
  onFlagChange(flag: string, callback: (enabled: boolean) => void): () => void;
}

/**
 * Theme service interface
 */
export interface IThemeService {
  getCurrentTheme(): 'light' | 'dark' | 'auto';
  setTheme(theme: 'light' | 'dark' | 'auto'): void;
  toggleTheme(): void;
  getCustomColors(): Record<string, string>;
  setCustomColor(key: string, value: string): void;
  resetTheme(): void;
  onThemeChange(callback: (theme: string) => void): () => void;
}

/**
 * Service registry type
 */
export interface ServiceRegistry {
  apiService: IApiService;
  authService: IAuthService;
  transactionService: ITransactionService;
  accountService: IAccountService;
  analyticsService: IAnalyticsService;
  notificationService: INotificationService;
  storageService: IStorageService;
  exportService: IExportService;
  importService: IImportService;
  syncService: ISyncService;
  encryptionService: IEncryptionService;
  loggerService: ILoggerService;
  performanceService: IPerformanceService;
  featureFlagService: IFeatureFlagService;
  themeService: IThemeService;
}