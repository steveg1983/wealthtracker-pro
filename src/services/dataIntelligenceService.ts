import type { Transaction } from '../types';
import type {
  SavedMerchantData,
  SavedSubscription,
  SavedSpendingPattern,
  SavedSmartCategory,
  SavedSpendingInsight
} from '../types/data-intelligence';
import { formatDecimal } from '../utils/decimal-format';

const DAY_IN_MS = 24 * 60 * 60 * 1000;

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

type Logger = Pick<Console, 'warn' | 'error'>;

export interface DataIntelligenceServiceOptions {
  storage?: StorageLike | null;
  logger?: Logger;
  now?: () => number;
}

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
  transactionIds: string[];
  actionable: boolean;
  dismissed: boolean;
  createdAt: Date;
}

export interface DataIntelligenceStats {
  totalMerchants: number;
  enrichedMerchants: number;
  activeSubscriptions: number;
  cancelledSubscriptions: number;
  patternsDetected: number;
  monthlySubscriptionCost: number;
  topMerchants: Array<{
    name: string;
    amount: number;
    transactionCount: number;
    category: string;
  }>;
  categoryAccuracy: number;
  lastAnalysisRun: Date;
}

export class DataIntelligenceService {
  private merchants: MerchantData[] = [];
  private subscriptions: Subscription[] = [];
  private spendingPatterns: SpendingPattern[] = [];
  private smartCategories: SmartCategory[] = [];
  private insights: SpendingInsight[] = [];
  private readonly storage: StorageLike | null;
  private readonly logger: Logger;
  private readonly nowProvider: () => number;

  constructor(options: DataIntelligenceServiceOptions = {}) {
    this.storage = options.storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
    const fallbackLogger = typeof console !== 'undefined' ? console : undefined;
    const noop = () => {};
    this.logger = {
      warn: options.logger?.warn ?? (fallbackLogger?.warn?.bind(fallbackLogger) ?? noop),
      error: options.logger?.error ?? (fallbackLogger?.error?.bind(fallbackLogger) ?? noop)
    };
    this.nowProvider = options.now ?? (() => Date.now());
    this.loadData();
    this.initializeMerchantDatabase();
    this.initializeSmartCategories();
    this.createSampleData();
  }

  private createDate(offsetMs = 0): Date {
    return new Date(this.nowProvider() + offsetMs);
  }

  private readJsonFromStorage<T>(key: string): T | null {
    if (!this.storage) return null;
    try {
      const raw = this.storage.getItem(key);
      return raw ? JSON.parse(raw) as T : null;
    } catch (error) {
      this.logger.warn(`Failed to read ${key} from storage:`, error as Error);
      return null;
    }
  }

  private loadData() {
    if (!this.storage) return;
    try {
      const savedMerchants = this.readJsonFromStorage<SavedMerchantData[]>('data-intelligence-merchants');
      if (savedMerchants) {
        this.merchants = savedMerchants.map((merchant: SavedMerchantData) => ({
          ...merchant,
          createdAt: new Date(merchant.createdAt),
          lastUpdated: new Date(merchant.lastUpdated)
        }));
      }

      const savedSubscriptions = this.readJsonFromStorage<SavedSubscription[]>('data-intelligence-subscriptions');
      if (savedSubscriptions) {
        this.subscriptions = savedSubscriptions.map((sub: SavedSubscription) => ({
          ...sub,
          nextPaymentDate: new Date(sub.nextPaymentDate),
          startDate: new Date(sub.startDate),
          endDate: sub.endDate ? new Date(sub.endDate) : undefined,
          createdAt: new Date(sub.createdAt),
          lastUpdated: new Date(sub.lastUpdated)
        }));
      }

      const savedPatterns = this.readJsonFromStorage<SavedSpendingPattern[]>('data-intelligence-patterns');
      if (savedPatterns) {
        this.spendingPatterns = savedPatterns.map((pattern: SavedSpendingPattern) => ({
          ...pattern,
          detectedAt: new Date(pattern.detectedAt)
        }));
      }

      const savedSmartCategories = this.readJsonFromStorage<SavedSmartCategory[]>('data-intelligence-smart-categories');
      if (savedSmartCategories) {
        this.smartCategories = savedSmartCategories.map((cat: SavedSmartCategory) => ({
          ...cat,
          createdAt: new Date(cat.createdAt),
          lastTrained: new Date(cat.lastTrained)
        }));
      }

      const savedInsights = this.readJsonFromStorage<SavedSpendingInsight[]>('data-intelligence-insights');
      if (savedInsights) {
        this.insights = savedInsights.map((insight: SavedSpendingInsight) => ({
          ...insight,
          createdAt: new Date(insight.createdAt)
        }));
      }
    } catch (error) {
      this.logger.error('Error loading data intelligence data:', error as Error);
    }
  }

  private saveData() {
    if (!this.storage) return;
    try {
      this.storage.setItem('data-intelligence-merchants', JSON.stringify(this.merchants));
      this.storage.setItem('data-intelligence-subscriptions', JSON.stringify(this.subscriptions));
      this.storage.setItem('data-intelligence-patterns', JSON.stringify(this.spendingPatterns));
      this.storage.setItem('data-intelligence-smart-categories', JSON.stringify(this.smartCategories));
      this.storage.setItem('data-intelligence-insights', JSON.stringify(this.insights));
    } catch (error) {
      this.logger.error('Error saving data intelligence data:', error as Error);
    }
  }

  private initializeMerchantDatabase() {
    if (this.merchants.length === 0) {
      // Common merchant patterns for enrichment
      const commonMerchants = [
        {
          patterns: ['amazon', 'amzn', 'amazon.com'],
          name: 'Amazon',
          category: 'Shopping',
          industry: 'E-commerce',
          frequency: 'monthly' as const,
          tags: ['online', 'retail', 'marketplace']
        },
        {
          patterns: ['netflix', 'netflix.com'],
          name: 'Netflix',
          category: 'Entertainment',
          industry: 'Streaming',
          frequency: 'monthly' as const,
          tags: ['subscription', 'streaming', 'entertainment']
        },
        {
          patterns: ['spotify', 'spotify.com'],
          name: 'Spotify',
          category: 'Entertainment',
          industry: 'Music Streaming',
          frequency: 'monthly' as const,
          tags: ['subscription', 'music', 'streaming']
        },
        {
          patterns: ['uber', 'uber*'],
          name: 'Uber',
          category: 'Transportation',
          industry: 'Rideshare',
          frequency: 'weekly' as const,
          tags: ['transportation', 'rideshare', 'mobile']
        },
        {
          patterns: ['starbucks', 'sbux'],
          name: 'Starbucks',
          category: 'Food & Dining',
          industry: 'Coffee',
          frequency: 'daily' as const,
          tags: ['coffee', 'food', 'chain']
        },
        {
          patterns: ['whole foods', 'wfm'],
          name: 'Whole Foods Market',
          category: 'Groceries',
          industry: 'Grocery',
          frequency: 'weekly' as const,
          tags: ['grocery', 'organic', 'food']
        },
        {
          patterns: ['target', 'target.com'],
          name: 'Target',
          category: 'Shopping',
          industry: 'Retail',
          frequency: 'monthly' as const,
          tags: ['retail', 'department', 'shopping']
        },
        {
          patterns: ['apple', 'apple.com', 'itunes'],
          name: 'Apple',
          category: 'Technology',
          industry: 'Technology',
          frequency: 'monthly' as const,
          tags: ['technology', 'apps', 'devices']
        }
      ];

      commonMerchants.forEach((merchant, index) => {
        const createdAt = this.createDate();
        const lastUpdated = this.createDate();
        this.merchants.push({
          id: `merchant-${index + 1}`,
          name: merchant.name,
          cleanName: merchant.name,
          category: merchant.category,
          industry: merchant.industry,
          frequency: merchant.frequency,
          tags: merchant.tags,
          confidence: 0.95,
          createdAt,
          lastUpdated
        });
      });
    }
  }

  private initializeSmartCategories() {
    if (this.smartCategories.length === 0) {
      const defaultCategories: Omit<SmartCategory, 'id' | 'createdAt' | 'lastTrained'>[] = [
        {
          name: 'Subscriptions',
          confidence: 0.9,
          rules: [
            { type: 'merchant', condition: 'contains', value: 'netflix', weight: 0.9 },
            { type: 'merchant', condition: 'contains', value: 'spotify', weight: 0.9 },
            { type: 'merchant', condition: 'contains', value: 'adobe', weight: 0.8 }
          ],
          merchantPatterns: ['netflix', 'spotify', 'adobe', 'microsoft', 'google'],
          descriptionPatterns: ['subscription', 'monthly', 'plan', 'premium'],
          amountRanges: [
            { min: 5, max: 50, weight: 0.8 },
            { min: 50, max: 200, weight: 0.6 }
          ]
        },
        {
          name: 'Coffee & Quick Bites',
          confidence: 0.85,
          rules: [
            { type: 'merchant', condition: 'contains', value: 'starbucks', weight: 0.9 },
            { type: 'merchant', condition: 'contains', value: 'coffee', weight: 0.8 },
            { type: 'amount', condition: 'range', value: 15, weight: 0.7 }
          ],
          merchantPatterns: ['starbucks', 'dunkin', 'coffee', 'cafe'],
          descriptionPatterns: ['coffee', 'latte', 'espresso', 'cafe'],
          amountRanges: [
            { min: 2, max: 25, weight: 0.9 }
          ]
        },
        {
          name: 'Gas & Fuel',
          confidence: 0.9,
          rules: [
            { type: 'merchant', condition: 'contains', value: 'shell', weight: 0.9 },
            { type: 'merchant', condition: 'contains', value: 'exxon', weight: 0.9 },
            { type: 'merchant', condition: 'contains', value: 'chevron', weight: 0.9 }
          ],
          merchantPatterns: ['shell', 'exxon', 'chevron', 'bp', 'mobil', 'gas'],
          descriptionPatterns: ['fuel', 'gas', 'gasoline', 'petrol'],
          amountRanges: [
            { min: 20, max: 100, weight: 0.8 }
          ]
        }
      ];

      this.smartCategories = defaultCategories.map((cat, index) => ({
        ...cat,
        id: `smart-cat-${index + 1}`,
        createdAt: this.createDate(),
        lastTrained: this.createDate()
      }));
    }
  }

  private createSampleData() {
    if (this.subscriptions.length === 0) {
      const sampleSubscriptions: Subscription[] = [
        {
          id: '1',
          merchantId: 'merchant-2',
          merchantName: 'Netflix',
          amount: 15.99,
          frequency: 'monthly',
          nextPaymentDate: this.createDate(7 * DAY_IN_MS),
          category: 'Entertainment',
          status: 'active',
          startDate: new Date('2023-06-15'),
          description: 'Standard Plan',
          renewalType: 'auto',
          paymentMethod: 'Credit Card',
          transactionIds: ['trans-netflix-1', 'trans-netflix-2'],
          createdAt: new Date('2023-06-15'),
          lastUpdated: this.createDate()
        },
        {
          id: '2',
          merchantId: 'merchant-3',
          merchantName: 'Spotify',
          amount: 9.99,
          frequency: 'monthly',
          nextPaymentDate: this.createDate(12 * DAY_IN_MS),
          category: 'Entertainment',
          status: 'active',
          startDate: new Date('2023-03-10'),
          description: 'Premium Individual',
          renewalType: 'auto',
          paymentMethod: 'Credit Card',
          transactionIds: ['trans-spotify-1', 'trans-spotify-2'],
          createdAt: new Date('2023-03-10'),
          lastUpdated: this.createDate()
        },
        {
          id: '3',
          merchantId: 'merchant-8',
          merchantName: 'Adobe Creative Cloud',
          amount: 52.99,
          frequency: 'monthly',
          nextPaymentDate: this.createDate(3 * DAY_IN_MS),
          category: 'Software',
          status: 'active',
          startDate: new Date('2023-01-01'),
          description: 'All Apps Plan',
          renewalType: 'auto',
          paymentMethod: 'Credit Card',
          transactionIds: ['trans-adobe-1', 'trans-adobe-2'],
          createdAt: new Date('2023-01-01'),
          lastUpdated: this.createDate()
        }
      ];

      this.subscriptions = sampleSubscriptions;
    }

    if (this.spendingPatterns.length === 0) {
      const samplePatterns: SpendingPattern[] = [
        {
          id: '1',
          patternType: 'recurring',
          category: 'Food & Dining',
          merchant: 'Starbucks',
          frequency: 'daily',
          amount: 5.85,
          variance: 1.2,
          confidence: 0.87,
          description: 'Daily coffee purchase at Starbucks',
          transactions: ['trans-sb-1', 'trans-sb-2', 'trans-sb-3'],
          detectedAt: new Date('2024-01-15'),
          isActive: true
        },
        {
          id: '2',
          patternType: 'seasonal',
          category: 'Shopping',
          frequency: 'yearly',
          amount: 250.00,
          variance: 45.0,
          confidence: 0.72,
          description: 'Holiday shopping spike in December',
          transactions: ['trans-holiday-1', 'trans-holiday-2'],
          detectedAt: new Date('2024-01-10'),
          isActive: true
        },
        {
          id: '3',
          patternType: 'trend',
          category: 'Transportation',
          merchant: 'Uber',
          frequency: 'weekly',
          amount: 35.00,
          variance: 12.5,
          confidence: 0.75,
          description: 'Increasing ride-share usage trend',
          transactions: ['trans-uber-1', 'trans-uber-2', 'trans-uber-3'],
          detectedAt: new Date('2024-01-12'),
          isActive: true
        }
      ];

      this.spendingPatterns = samplePatterns;
    }

    if (this.insights.length === 0) {
      const sampleInsights: SpendingInsight[] = [
        {
          id: '1',
          type: 'subscription_alert',
          title: 'Subscription Renewal Due',
          description: 'Adobe Creative Cloud ($52.99) renews in 3 days',
          severity: 'medium',
          category: 'Software',
          merchant: 'Adobe Creative Cloud',
          amount: 52.99,
          transactionIds: ['trans-adobe-3'],
          actionable: true,
          dismissed: false,
          createdAt: this.createDate()
        },
        {
          id: '2',
          type: 'spending_spike',
          title: 'Unusual Spending Detected',
          description: 'Food & Dining spending is 40% higher than usual this month',
          severity: 'medium',
          category: 'Food & Dining',
          transactionIds: ['trans-food-1', 'trans-food-2'],
          actionable: true,
          dismissed: false,
          createdAt: this.createDate(-2 * DAY_IN_MS)
        },
        {
          id: '3',
          type: 'new_merchant',
          title: 'New Merchant Detected',
          description: 'First transaction with "HelloFresh" - looks like a meal kit subscription',
          severity: 'low',
          category: 'Groceries',
          merchant: 'HelloFresh',
          amount: 89.99,
          transactionIds: ['trans-hellofresh-1'],
          actionable: true,
          dismissed: false,
          createdAt: this.createDate(-1 * DAY_IN_MS)
        }
      ];

      this.insights = sampleInsights;
    }

    this.saveData();
  }

  // Merchant Enrichment
  enrichMerchant(transactionDescription: string): MerchantEnrichment {
    const cleanDescription = transactionDescription.toLowerCase().trim();
    
    // Find matching merchant
    const merchant = this.merchants.find(m => 
      m.tags.some(tag => cleanDescription.includes(tag.toLowerCase())) ||
      cleanDescription.includes(m.name.toLowerCase()) ||
      cleanDescription.includes(m.cleanName.toLowerCase())
    );

    if (merchant) {
      return {
        originalName: transactionDescription,
        cleanName: merchant.cleanName,
        category: merchant.category,
        industry: merchant.industry,
        confidence: merchant.confidence,
        logo: merchant.logo,
        website: merchant.website,
        description: merchant.description,
        suggestedTags: merchant.tags
      };
    }

    // Fallback enrichment based on patterns
    return this.performBasicEnrichment(transactionDescription);
  }

  private performBasicEnrichment(description: string): MerchantEnrichment {
    const cleanDesc = description.toLowerCase();
    
    // Basic patterns
    const patterns = [
      { pattern: /coffee|starbucks|dunkin|cafe/i, category: 'Food & Dining', industry: 'Coffee' },
      { pattern: /gas|shell|exxon|chevron|bp|fuel/i, category: 'Transportation', industry: 'Gas Station' },
      { pattern: /grocery|supermarket|kroger|safeway|whole foods/i, category: 'Groceries', industry: 'Grocery' },
      { pattern: /restaurant|dining|food|pizza|burger/i, category: 'Food & Dining', industry: 'Restaurant' },
      { pattern: /uber|lyft|taxi|ride/i, category: 'Transportation', industry: 'Rideshare' },
      { pattern: /amazon|ebay|shopping|retail/i, category: 'Shopping', industry: 'E-commerce' },
      { pattern: /netflix|spotify|subscription|streaming/i, category: 'Entertainment', industry: 'Streaming' }
    ];

    for (const { pattern, category, industry } of patterns) {
      if (pattern.test(cleanDesc)) {
        return {
          originalName: description,
          cleanName: this.cleanMerchantName(description),
          category,
          industry,
          confidence: 0.6,
          suggestedTags: [category.toLowerCase(), industry.toLowerCase()]
        };
      }
    }

    return {
      originalName: description,
      cleanName: this.cleanMerchantName(description),
      category: 'Other',
      industry: 'Unknown',
      confidence: 0.3,
      suggestedTags: ['uncategorized']
    };
  }

  private cleanMerchantName(description: string): string {
    // Remove common prefixes/suffixes and clean up merchant names
    return description
      .replace(/^(POS|DEBIT|CREDIT|PURCHASE|PAYMENT)\s+/i, '')
      .replace(/\s+\d{2}\/\d{2}$/, '') // Remove date suffixes
      .replace(/\s+#\d+$/, '') // Remove reference numbers
      .replace(/\s+\*\d+$/, '') // Remove card numbers
      .trim();
  }

  // Subscription Management
  getSubscriptions(): Subscription[] {
    return this.subscriptions.sort((a, b) => a.nextPaymentDate.getTime() - b.nextPaymentDate.getTime());
  }

  addSubscription(subscription: Omit<Subscription, 'id' | 'createdAt' | 'lastUpdated'>): Subscription {
    const now = this.nowProvider();
    const newSubscription: Subscription = {
      ...subscription,
      id: now.toString(),
      createdAt: this.createDate(),
      lastUpdated: this.createDate()
    };

    this.subscriptions.push(newSubscription);
    this.saveData();
    return newSubscription;
  }

  updateSubscription(id: string, updates: Partial<Subscription>): Subscription | null {
    const index = this.subscriptions.findIndex(sub => sub.id === id);
    if (index === -1) return null;

    this.subscriptions[index] = {
      ...this.subscriptions[index],
      ...updates,
      lastUpdated: this.createDate()
    };
    this.saveData();
    return this.subscriptions[index];
  }

  deleteSubscription(id: string): boolean {
    const index = this.subscriptions.findIndex(sub => sub.id === id);
    if (index === -1) return false;

    this.subscriptions.splice(index, 1);
    this.saveData();
    return true;
  }

  detectSubscriptions(transactions: Transaction[]): Subscription[] {
    const potentialSubscriptions: Subscription[] = [];
    
    // Group transactions by merchant
    const merchantGroups = transactions.reduce((groups, transaction) => {
      const cleanMerchant = this.cleanMerchantName(transaction.description);
      if (!groups[cleanMerchant]) {
        groups[cleanMerchant] = [];
      }
      groups[cleanMerchant].push(transaction);
      return groups;
    }, {} as Record<string, Transaction[]>);

    // Analyze each merchant group for subscription patterns
    Object.entries(merchantGroups).forEach(([merchant, merchantTransactions]) => {
      if (merchantTransactions.length < 2) return;

      // Sort by date
      merchantTransactions.sort((a, b) => a.date.getTime() - b.date.getTime());

      // Check for regular intervals
      const intervals = [];
      for (let i = 1; i < merchantTransactions.length; i++) {
        const daysDiff = Math.round((merchantTransactions[i].date.getTime() - merchantTransactions[i-1].date.getTime()) / (1000 * 60 * 60 * 24));
        intervals.push(daysDiff);
      }

      // Check if intervals are consistent (within 3 days)
      const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
      const isRegular = intervals.every(interval => Math.abs(interval - avgInterval) <= 3);

      if (isRegular && avgInterval >= 7) {
        let frequency: Subscription['frequency'] = 'monthly';
        if (avgInterval <= 10) frequency = 'weekly';
        else if (avgInterval <= 35) frequency = 'monthly';
        else if (avgInterval <= 100) frequency = 'quarterly';
        else frequency = 'yearly';

        const enrichment = this.enrichMerchant(merchant);
        const avgAmount = merchantTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0) / merchantTransactions.length;

        const detectedId = `detected-${this.nowProvider()}-${merchant}`;
        potentialSubscriptions.push({
          id: detectedId,
          merchantId: 'unknown',
          merchantName: enrichment.cleanName,
          amount: avgAmount,
          frequency,
          nextPaymentDate: new Date(merchantTransactions[merchantTransactions.length - 1].date.getTime() + avgInterval * 24 * 60 * 60 * 1000),
          category: enrichment.category,
          status: 'active',
          startDate: merchantTransactions[0].date,
          renewalType: 'auto',
          paymentMethod: 'Unknown',
          transactionIds: merchantTransactions.map(t => t.id),
          createdAt: this.createDate(),
          lastUpdated: this.createDate()
        });
      }
    });

    return potentialSubscriptions;
  }

  // Spending Pattern Analysis
  getSpendingPatterns(): SpendingPattern[] {
    return this.spendingPatterns.filter(pattern => pattern.isActive);
  }

  analyzeSpendingPatterns(transactions: Transaction[]): SpendingPattern[] {
    const patterns: SpendingPattern[] = [];
    
    // Group transactions by category
    const categoryGroups = transactions.reduce((groups, transaction) => {
      if (!groups[transaction.category]) {
        groups[transaction.category] = [];
      }
      groups[transaction.category].push(transaction);
      return groups;
    }, {} as Record<string, Transaction[]>);

    // Analyze each category for patterns
    Object.entries(categoryGroups).forEach(([category, categoryTransactions]) => {
      if (categoryTransactions.length < 3) return;

      // Sort by date
      categoryTransactions.sort((a, b) => a.date.getTime() - b.date.getTime());

      // Calculate statistics
      const amounts = categoryTransactions.map(t => Math.abs(t.amount));
      const avgAmount = amounts.reduce((sum, amt) => sum + amt, 0) / amounts.length;
      const variance = amounts.reduce((sum, amt) => sum + Math.pow(amt - avgAmount, 2), 0) / amounts.length;
      const stdDev = Math.sqrt(variance);

      // Check for recurring patterns
      const intervals = [];
      for (let i = 1; i < categoryTransactions.length; i++) {
        const daysDiff = Math.round((categoryTransactions[i].date.getTime() - categoryTransactions[i-1].date.getTime()) / (1000 * 60 * 60 * 24));
        intervals.push(daysDiff);
      }

      const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
      const intervalVariance = intervals.reduce((sum, interval) => sum + Math.pow(interval - avgInterval, 2), 0) / intervals.length;
      const isRegular = Math.sqrt(intervalVariance) < avgInterval * 0.3;

      if (isRegular && avgInterval > 0) {
        let frequency = 'irregular';
        if (avgInterval <= 2) frequency = 'daily';
        else if (avgInterval <= 10) frequency = 'weekly';
        else if (avgInterval <= 35) frequency = 'monthly';
        else if (avgInterval <= 100) frequency = 'quarterly';
        else frequency = 'yearly';

        const patternId = `pattern-${this.nowProvider()}-${category}`;
        patterns.push({
          id: patternId,
          patternType: 'recurring',
          category,
          frequency,
          amount: avgAmount,
          variance: stdDev,
          confidence: Math.min(0.9, Math.max(0.5, 1 - (stdDev / avgAmount))),
          description: `Regular ${frequency} spending in ${category}`,
          transactions: categoryTransactions.map(t => t.id),
          detectedAt: this.createDate(),
          isActive: true
        });
      }
    });

    return patterns;
  }

  // Smart Categorization
  suggestCategory(transaction: Transaction): { category: string; confidence: number } {
    const description = transaction.description.toLowerCase();
    const amount = Math.abs(transaction.amount);

    let bestMatch = { category: 'Other', confidence: 0.3 };

    for (const smartCategory of this.smartCategories) {
      let score = 0;
      let totalWeight = 0;

      // Check merchant patterns
      for (const pattern of smartCategory.merchantPatterns) {
        if (description.includes(pattern.toLowerCase())) {
          score += 0.8;
          totalWeight += 0.8;
        }
      }

      // Check description patterns
      for (const pattern of smartCategory.descriptionPatterns) {
        if (description.includes(pattern.toLowerCase())) {
          score += 0.6;
          totalWeight += 0.6;
        }
      }

      // Check amount ranges
      for (const range of smartCategory.amountRanges) {
        if (amount >= range.min && amount <= range.max) {
          score += range.weight;
          totalWeight += range.weight;
        }
      }

      if (totalWeight > 0) {
        const confidence = Math.min(0.95, (score / totalWeight) * smartCategory.confidence);
        if (confidence > bestMatch.confidence) {
          bestMatch = { category: smartCategory.name, confidence };
        }
      }
    }

    return bestMatch;
  }

  // Insights Generation
  getInsights(): SpendingInsight[] {
    return this.insights.filter(insight => !insight.dismissed)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  generateInsights(transactions: Transaction[]): SpendingInsight[] {
    const newInsights: SpendingInsight[] = [];
    const now = this.nowProvider();

    // Check for subscription renewals
    const upcomingRenewals = this.subscriptions.filter(sub => {
      const daysUntilRenewal = Math.ceil((sub.nextPaymentDate.getTime() - now) / DAY_IN_MS);
      return daysUntilRenewal <= 7 && daysUntilRenewal > 0;
    });

    upcomingRenewals.forEach(sub => {
      const daysUntilRenewal = Math.ceil((sub.nextPaymentDate.getTime() - now) / DAY_IN_MS);
      newInsights.push({
        id: `insight-renewal-${sub.id}`,
        type: 'subscription_alert',
        title: 'Subscription Renewal Due',
        description: `${sub.merchantName} ($${formatDecimal(sub.amount, 2)}) renews in ${daysUntilRenewal} day${daysUntilRenewal !== 1 ? 's' : ''}`,
        severity: daysUntilRenewal <= 3 ? 'high' : 'medium',
        category: sub.category,
        merchant: sub.merchantName,
        amount: sub.amount,
        transactionIds: sub.transactionIds,
        actionable: true,
        dismissed: false,
        createdAt: this.createDate()
      });
    });

    // Check for spending spikes
    const currentDate = this.createDate();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();
    const currentMonthTransactions = transactions.filter(t => 
      t.date.getMonth() === currentMonth && t.date.getFullYear() === currentYear
    );

    const lastMonth = new Date(currentDate.getTime());
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    const lastMonthTransactions = transactions.filter(t => 
      t.date.getMonth() === lastMonth.getMonth() && t.date.getFullYear() === lastMonth.getFullYear()
    );

    // Group by category and compare
    const currentMonthByCategory = this.groupTransactionsByCategory(currentMonthTransactions);
    const lastMonthByCategory = this.groupTransactionsByCategory(lastMonthTransactions);

    Object.entries(currentMonthByCategory).forEach(([category, currentAmount]) => {
      const lastAmount = lastMonthByCategory[category] || 0;
      if (lastAmount > 0) {
        const increasePercentage = ((currentAmount - lastAmount) / lastAmount) * 100;
        
        if (increasePercentage > 30) {
          newInsights.push({
            id: `insight-spike-${category}`,
            type: 'spending_spike',
            title: 'Unusual Spending Detected',
            description: `${category} spending is ${formatDecimal(increasePercentage, 0)}% higher than last month`,
            severity: increasePercentage > 50 ? 'high' : 'medium',
            category,
            amount: currentAmount,
            transactionIds: currentMonthTransactions.filter(t => t.category === category).map(t => t.id),
            actionable: true,
            dismissed: false,
            createdAt: this.createDate()
          });
        }
      }
    });

    return newInsights;
  }

  private groupTransactionsByCategory(transactions: Transaction[]): Record<string, number> {
    return transactions.reduce((groups, transaction) => {
      const category = transaction.category;
      if (!groups[category]) {
        groups[category] = 0;
      }
      groups[category] += Math.abs(transaction.amount);
      return groups;
    }, {} as Record<string, number>);
  }

  dismissInsight(id: string): void {
    const insight = this.insights.find(i => i.id === id);
    if (insight) {
      insight.dismissed = true;
      this.saveData();
    }
  }

  // Statistics
  getStats(): DataIntelligenceStats {
    const totalMerchants = this.merchants.length;
    const enrichedMerchants = this.merchants.filter(m => m.confidence > 0.7).length;
    const activeSubscriptions = this.subscriptions.filter(s => s.status === 'active').length;
    const cancelledSubscriptions = this.subscriptions.filter(s => s.status === 'cancelled').length;
    const patternsDetected = this.spendingPatterns.filter(p => p.isActive).length;
    
    const monthlySubscriptionCost = this.subscriptions
      .filter(s => s.status === 'active')
      .reduce((sum, s) => {
        const monthlyAmount = s.frequency === 'monthly' ? s.amount :
                             s.frequency === 'yearly' ? s.amount / 12 :
                             s.frequency === 'quarterly' ? s.amount / 3 :
                             s.frequency === 'weekly' ? s.amount * 4.33 : s.amount;
        return sum + monthlyAmount;
      }, 0);

    const topMerchants = this.merchants
      .slice(0, 5)
      .map(m => ({
        name: m.name,
        amount: m.avgTransactionAmount || 0,
        transactionCount: 0,
        category: m.category
      }));

    return {
      totalMerchants,
      enrichedMerchants,
      activeSubscriptions,
      cancelledSubscriptions,
      patternsDetected,
      monthlySubscriptionCost,
      topMerchants,
      categoryAccuracy: enrichedMerchants > 0 ? (enrichedMerchants / totalMerchants) * 100 : 0,
      lastAnalysisRun: this.createDate()
    };
  }

  // Export functionality
  exportData(): {
    merchants: MerchantData[];
    subscriptions: Subscription[];
    patterns: SpendingPattern[];
    insights: SpendingInsight[];
    stats: DataIntelligenceStats;
  } {
    return {
      merchants: this.merchants,
      subscriptions: this.subscriptions,
      patterns: this.spendingPatterns,
      insights: this.insights,
      stats: this.getStats()
    };
  }
}

export const dataIntelligenceService = new DataIntelligenceService();
