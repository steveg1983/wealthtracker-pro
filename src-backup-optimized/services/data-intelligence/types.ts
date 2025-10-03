import type { Transaction, Category } from '../../types';

export interface MerchantData {
  id: string;
  name: string;
  cleanName: string;
  category: string;
  industry: string;
  logo?: string;
  website?: string;
  description?: string;
  avgTransactionAmount?: number;
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'irregular';
  tags: string[];
  confidence: number; // 0-1 confidence score
  createdAt: Date;
  lastUpdated: Date;
}

export interface Subscription {
  id: string;
  merchantId: string;
  merchantName: string;
  amount: number;
  frequency: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  nextPaymentDate: Date;
  category: string;
  status: 'active' | 'cancelled' | 'paused' | 'trial';
  startDate: Date;
  endDate?: Date;
  description?: string;
  renewalType: 'auto' | 'manual';
  paymentMethod: string;
  transactionIds: string[];
  createdAt: Date;
  lastUpdated: Date;
}

export interface SpendingPattern {
  id: string;
  patternType: 'recurring' | 'seasonal' | 'trend' | 'anomaly';
  category: string;
  merchant?: string;
  frequency: string;
  amount: number;
  variance: number;
  confidence: number;
  description: string;
  transactions: string[];
  detectedAt: Date;
  isActive: boolean;
}

export interface SmartCategory {
  id: string;
  name: string;
  confidence: number;
  rules: SmartCategoryRule[];
  merchantPatterns: string[];
  descriptionPatterns: string[];
  amountRanges: { min: number; max: number; weight: number }[];
  createdAt: Date;
  lastTrained: Date;
}

export interface SmartCategoryRule {
  type: 'merchant' | 'description' | 'amount' | 'frequency';
  condition: 'contains' | 'equals' | 'starts_with' | 'ends_with' | 'regex' | 'range';
  value: string | number;
  weight: number;
}

export interface MerchantEnrichment {
  originalName: string;
  cleanName: string;
  category: string;
  industry: string;
  confidence: number;
  logo?: string;
  website?: string;
  description?: string;
  suggestedTags: string[];
}

export interface SpendingInsight {
  id: string;
  type: 'subscription_alert' | 'spending_spike' | 'new_merchant' | 'category_trend' | 'duplicate_transaction';
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  category?: string;
  merchant?: string;
  amount?: number;
  date?: Date;
  actionRequired?: boolean;
  transactions?: string[];
  createdAt: Date;
}

export interface PatternDetectionOptions {
  minConfidence?: number;
  minTransactions?: number;
  lookbackDays?: number;
  excludeCategories?: string[];
}

export interface EnrichmentOptions {
  useCache?: boolean;
  updateExisting?: boolean;
  minConfidence?: number;
}