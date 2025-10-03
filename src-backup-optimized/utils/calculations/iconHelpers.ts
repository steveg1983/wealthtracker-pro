/**
 * Icon Helpers Module
 * Icon mapping utilities for categories and account types
 */

import type { IconMap } from './types';

/**
 * Category icon mapping
 */
const CATEGORY_ICONS: IconMap = {
  groceries: '🛒',
  utilities: '💡',
  transport: '🚗',
  transportation: '🚗',
  dining: '🍽️',
  entertainment: '🎬',
  healthcare: '🏥',
  shopping: '🛍️',
  education: '📚',
  housing: '🏠',
  insurance: '🛡️',
  salary: '💰',
  freelance: '💼',
  investment: '📈',
  travel: '✈️',
  fitness: '💪',
  subscriptions: '📱',
  gifts: '🎁',
  charity: '❤️',
  taxes: '📋',
  fees: '💸',
  personal: '👤',
  business: '🏢',
  other: '📌'
};

/**
 * Account type icon mapping
 */
const ACCOUNT_TYPE_ICONS: IconMap = {
  current: '💳',
  checking: '💳',
  savings: '🏦',
  credit: '💳',
  investment: '📈',
  loan: '🏦',
  mortgage: '🏠',
  cash: '💵',
  assets: '🏢',
  retirement: '🏖️',
  crypto: '₿',
  other: '💰'
};

/**
 * Transaction type icon mapping
 */
const TRANSACTION_TYPE_ICONS: IconMap = {
  income: '💵',
  expense: '💸',
  transfer: '🔄',
  saving: '🐷',
  investment: '📈'
};

/**
 * Get category icon
 */
export function getCategoryIcon(category: string): string {
  const key = category.toLowerCase();
  return CATEGORY_ICONS[key] || CATEGORY_ICONS.other;
}

/**
 * Get account type icon
 */
export function getAccountTypeIcon(type: string): string {
  const key = type.toLowerCase();
  return ACCOUNT_TYPE_ICONS[key] || ACCOUNT_TYPE_ICONS.other;
}

/**
 * Get transaction type icon
 */
export function getTransactionTypeIcon(type: string): string {
  const key = type.toLowerCase();
  return TRANSACTION_TYPE_ICONS[key] || '💰';
}

/**
 * Get budget status icon
 */
export function getBudgetStatusIcon(status: 'good' | 'warning' | 'danger'): string {
  const statusIcons: IconMap = {
    good: '✅',
    warning: '⚠️',
    danger: '🚨'
  };
  
  return statusIcons[status] || '📊';
}

/**
 * Get goal status icon
 */
export function getGoalStatusIcon(percentageComplete: number): string {
  if (percentageComplete >= 100) return '🎯';
  if (percentageComplete >= 75) return '🔥';
  if (percentageComplete >= 50) return '📈';
  if (percentageComplete >= 25) return '🌱';
  return '🎯';
}

/**
 * Get trend icon
 */
export function getTrendIcon(trend: 'up' | 'down' | 'stable'): string {
  const trendIcons: IconMap = {
    up: '📈',
    down: '📉',
    stable: '➡️'
  };
  
  return trendIcons[trend] || '➡️';
}

/**
 * Get currency symbol
 */
export function getCurrencySymbol(currency: string): string {
  const currencySymbols: IconMap = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
    CNY: '¥',
    INR: '₹',
    AUD: 'A$',
    CAD: 'C$',
    CHF: 'Fr',
    SEK: 'kr',
    NZD: 'NZ$'
  };
  
  return currencySymbols[currency.toUpperCase()] || currency;
}

/**
 * Get all available category icons
 */
export function getAllCategoryIcons(): IconMap {
  return { ...CATEGORY_ICONS };
}

/**
 * Get all available account type icons
 */
export function getAllAccountTypeIcons(): IconMap {
  return { ...ACCOUNT_TYPE_ICONS };
}