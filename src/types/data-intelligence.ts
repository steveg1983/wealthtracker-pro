// Type definitions for data intelligence service saved data

export interface SavedMerchantData {
  id: string;
  name: string;
  cleanName: string;
  category: string;
  industry: string;
  logo?: string;
  website?: string;
  description?: string;
  avgTransactionAmount?: number;
  frequency: string;
  tags: string[];
  confidence: number;
  createdAt: string;
  lastUpdated: string;
}

export interface SavedSubscription {
  id: string;
  merchantId: string;
  merchantName: string;
  amount: number;
  frequency: string;
  nextPaymentDate: string;
  category: string;
  status: string;
  startDate: string;
  endDate?: string;
  description?: string;
  renewalType: string;
  paymentMethod: string;
  transactionIds: string[];
  createdAt: string;
  lastUpdated: string;
}

export interface SavedSpendingPattern {
  id: string;
  patternType: string;
  category: string;
  merchant?: string;
  frequency: string;
  amount: number;
  variance: number;
  confidence: number;
  description: string;
  transactions: string[];
  detectedAt: string;
  isActive: boolean;
}

export interface SavedSmartCategory {
  id: string;
  name: string;
  confidence: number;
  rules: Array<{
    type: string;
    condition: string;
    value: string | number;
    weight: number;
  }>;
  merchantPatterns: string[];
  descriptionPatterns: string[];
  amountRanges: Array<{ min: number; max: number; weight: number }>;
  createdAt: string;
  lastTrained: string;
}

export interface SavedSpendingInsight {
  id: string;
  type: string;
  title: string;
  description: string;
  severity: string;
  category?: string;
  merchant?: string;
  amount?: number;
  transactionIds: string[];
  actionable: boolean;
  dismissed: boolean;
  createdAt: string;
}