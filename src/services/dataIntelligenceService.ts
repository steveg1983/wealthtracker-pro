import { Decimal } from 'decimal.js';
import type { Transaction, Category } from '../types';
import { logger } from './loggingService';
import type {
  SavedMerchantData,
  SavedSubscription,
  SavedSpendingPattern,
  SavedSmartCategory,
  SavedSpendingInsight
} from '../types/data-intelligence';

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

class DataIntelligenceService {
  private merchants: MerchantData[] = [];
  private subscriptions: Subscription[] = [];
  private spendingPatterns: SpendingPattern[] = [];
  private smartCategories: SmartCategory[] = [];
  private insights: SpendingInsight[] = [];

  constructor() {
    this.loadData();
    this.initializeSmartCategories();
    // NO SAMPLE DATA - only real data from actual transactions
  }

  private loadData() {
    try {
      const savedMerchants = localStorage.getItem('data-intelligence-merchants');
      if (savedMerchants) {
        this.merchants = JSON.parse(savedMerchants).map((merchant: SavedMerchantData) => ({
          ...merchant,
          createdAt: new Date(merchant.createdAt),
          lastUpdated: new Date(merchant.lastUpdated)
        }));
      }

      const savedSubscriptions = localStorage.getItem('data-intelligence-subscriptions');
      if (savedSubscriptions) {
        this.subscriptions = JSON.parse(savedSubscriptions).map((sub: SavedSubscription) => ({
          ...sub,
          nextPaymentDate: new Date(sub.nextPaymentDate),
          startDate: new Date(sub.startDate),
          endDate: sub.endDate ? new Date(sub.endDate) : undefined,
          createdAt: new Date(sub.createdAt),
          lastUpdated: new Date(sub.lastUpdated)
        }));
      }

      const savedPatterns = localStorage.getItem('data-intelligence-patterns');
      if (savedPatterns) {
        this.spendingPatterns = JSON.parse(savedPatterns).map((pattern: SavedSpendingPattern) => ({
          ...pattern,
          detectedAt: new Date(pattern.detectedAt)
        }));
      }

      const savedSmartCategories = localStorage.getItem('data-intelligence-smart-categories');
      if (savedSmartCategories) {
        this.smartCategories = JSON.parse(savedSmartCategories).map((cat: SavedSmartCategory) => ({
          ...cat,
          createdAt: new Date(cat.createdAt),
          lastTrained: new Date(cat.lastTrained)
        }));
      }

      const savedInsights = localStorage.getItem('data-intelligence-insights');
      if (savedInsights) {
        this.insights = JSON.parse(savedInsights).map((insight: SavedSpendingInsight) => ({
          ...insight,
          createdAt: new Date(insight.createdAt)
        }));
      }
    } catch (error) {
      logger.error('Error loading data intelligence data:', error);
    }
  }

  private saveData() {
    try {
      localStorage.setItem('data-intelligence-merchants', JSON.stringify(this.merchants));
      localStorage.setItem('data-intelligence-subscriptions', JSON.stringify(this.subscriptions));
      localStorage.setItem('data-intelligence-patterns', JSON.stringify(this.spendingPatterns));
      localStorage.setItem('data-intelligence-smart-categories', JSON.stringify(this.smartCategories));
      localStorage.setItem('data-intelligence-insights', JSON.stringify(this.insights));
    } catch (error) {
      logger.error('Error saving data intelligence data:', error);
    }
  }

  // Learn merchants from actual transactions, not hardcoded
  learnMerchantFromTransaction(transaction: Transaction): MerchantData | null {
    const cleanName = this.cleanMerchantName(transaction.description);
    
    // Check if we already know this merchant
    let merchant = this.merchants.find(m => 
      m.cleanName.toLowerCase() === cleanName.toLowerCase()
    );
    
    if (!merchant) {
      // Create new merchant entry from transaction
      const enrichment = this.performBasicEnrichment(transaction.description);
      merchant = {
        id: `merchant-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: cleanName,
        cleanName: cleanName,
        category: transaction.category || enrichment.category,
        industry: enrichment.industry,
        frequency: 'irregular',
        tags: enrichment.suggestedTags,
        confidence: enrichment.confidence,
        avgTransactionAmount: Math.abs(transaction.amount),
        createdAt: new Date(),
        lastUpdated: new Date()
      };
      
      this.merchants.push(merchant);
      this.saveData();
    } else {
      // Update existing merchant with new transaction info
      const transactions = this.getMerchantTransactionCount(merchant.cleanName);
      const newAvg = merchant.avgTransactionAmount 
        ? (merchant.avgTransactionAmount * transactions + Math.abs(transaction.amount)) / (transactions + 1)
        : Math.abs(transaction.amount);
      
      merchant.avgTransactionAmount = newAvg;
      merchant.lastUpdated = new Date();
      this.saveData();
    }
    
    return merchant;
  }
  
  private getMerchantTransactionCount(merchantName: string): number {
    // In a real implementation, this would query the database
    // For now, we'll estimate based on frequency
    return 1;
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
        createdAt: new Date(),
        lastTrained: new Date()
      }));
    }
  }

  // REMOVED: No sample data - only real data from actual transactions

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
    const cleanName = this.cleanMerchantName(description);
    
    // Comprehensive merchant patterns with better categorization
    const patterns = [
      // Streaming & Subscriptions
      { pattern: /netflix|nflx/i, category: 'Entertainment', industry: 'Streaming', confidence: 0.95 },
      { pattern: /spotify|sptfy/i, category: 'Entertainment', industry: 'Music Streaming', confidence: 0.95 },
      { pattern: /hulu|disney\+|disney plus|paramount\+|hbo|max streaming/i, category: 'Entertainment', industry: 'Streaming', confidence: 0.9 },
      { pattern: /apple\.com\/bill|itunes/i, category: 'Technology', industry: 'Digital Services', confidence: 0.85 },
      { pattern: /amazon prime|amzn mktp|amazon digital/i, category: 'Shopping', industry: 'E-commerce', confidence: 0.9 },
      { pattern: /youtube premium|youtube tv/i, category: 'Entertainment', industry: 'Streaming', confidence: 0.9 },
      
      // Cloud & Software
      { pattern: /dropbox|dbx/i, category: 'Technology', industry: 'Cloud Storage', confidence: 0.9 },
      { pattern: /adobe|creative cloud/i, category: 'Technology', industry: 'Software', confidence: 0.9 },
      { pattern: /microsoft|msft|office 365/i, category: 'Technology', industry: 'Software', confidence: 0.9 },
      { pattern: /google storage|google one/i, category: 'Technology', industry: 'Cloud Storage', confidence: 0.9 },
      
      // Food & Dining
      { pattern: /starbucks|sbux/i, category: 'Food & Dining', industry: 'Coffee', confidence: 0.95 },
      { pattern: /dunkin|dnkn/i, category: 'Food & Dining', industry: 'Coffee', confidence: 0.95 },
      { pattern: /mcdonald|mcdonalds|mcd/i, category: 'Food & Dining', industry: 'Fast Food', confidence: 0.9 },
      { pattern: /subway|chipotle|panera|wendy|burger king|taco bell|kfc/i, category: 'Food & Dining', industry: 'Fast Food', confidence: 0.85 },
      { pattern: /doordash|uber eats|grubhub|postmates|deliveroo/i, category: 'Food & Dining', industry: 'Food Delivery', confidence: 0.9 },
      { pattern: /coffee|cafe|espresso|latte/i, category: 'Food & Dining', industry: 'Coffee', confidence: 0.7 },
      { pattern: /restaurant|dining|grill|kitchen|bistro|pizz/i, category: 'Food & Dining', industry: 'Restaurant', confidence: 0.75 },
      
      // Transportation
      { pattern: /uber(?!\s*eats)|lyft/i, category: 'Transportation', industry: 'Rideshare', confidence: 0.9 },
      { pattern: /shell|exxon|chevron|bp|mobil|texaco|sunoco|citgo/i, category: 'Transportation', industry: 'Gas Station', confidence: 0.9 },
      { pattern: /parking|park/i, category: 'Transportation', industry: 'Parking', confidence: 0.8 },
      { pattern: /tesla|supercharger|electrify|chargepoint/i, category: 'Transportation', industry: 'EV Charging', confidence: 0.85 },
      
      // Groceries
      { pattern: /walmart|wal-mart|wmt/i, category: 'Groceries', industry: 'Supermarket', confidence: 0.85 },
      { pattern: /target|tgt/i, category: 'Shopping', industry: 'Retail', confidence: 0.85 },
      { pattern: /kroger|safeway|albertsons|publix|wegmans|trader joe|whole foods/i, category: 'Groceries', industry: 'Supermarket', confidence: 0.9 },
      { pattern: /costco|sam'?s club|bj'?s wholesale/i, category: 'Groceries', industry: 'Warehouse Club', confidence: 0.9 },
      { pattern: /cvs|walgreens|rite aid|pharmacy/i, category: 'Health', industry: 'Pharmacy', confidence: 0.85 },
      
      // Utilities & Bills
      { pattern: /electric|power|energy|pge|con ed|duke energy/i, category: 'Utilities', industry: 'Electricity', confidence: 0.85 },
      { pattern: /water|sewer|utility/i, category: 'Utilities', industry: 'Water', confidence: 0.8 },
      { pattern: /gas company|natural gas/i, category: 'Utilities', industry: 'Gas', confidence: 0.85 },
      { pattern: /comcast|xfinity|spectrum|at&t|verizon|t-mobile|sprint/i, category: 'Utilities', industry: 'Telecom', confidence: 0.9 },
      { pattern: /insurance|geico|state farm|allstate|progressive/i, category: 'Insurance', industry: 'Insurance', confidence: 0.85 },
      
      // Fitness & Health
      { pattern: /gym|fitness|planet fitness|la fitness|equinox|crossfit/i, category: 'Health', industry: 'Fitness', confidence: 0.85 },
      { pattern: /peloton|fitbit|strava/i, category: 'Health', industry: 'Fitness Tech', confidence: 0.9 },
      
      // E-commerce & Shopping
      { pattern: /amazon|amzn/i, category: 'Shopping', industry: 'E-commerce', confidence: 0.9 },
      { pattern: /ebay/i, category: 'Shopping', industry: 'Marketplace', confidence: 0.9 },
      { pattern: /etsy/i, category: 'Shopping', industry: 'Handmade Marketplace', confidence: 0.9 },
      { pattern: /paypal/i, category: 'Financial', industry: 'Payment Processor', confidence: 0.85 },
      
      // Travel
      { pattern: /airline|airways|delta|united|american air|southwest|jetblue/i, category: 'Travel', industry: 'Airlines', confidence: 0.85 },
      { pattern: /hotel|marriott|hilton|hyatt|airbnb|vrbo/i, category: 'Travel', industry: 'Lodging', confidence: 0.85 },
      { pattern: /expedia|booking\.com|priceline|kayak/i, category: 'Travel', industry: 'Travel Booking', confidence: 0.85 },
      
      // General patterns (lower confidence)
      { pattern: /store|shop|mart/i, category: 'Shopping', industry: 'Retail', confidence: 0.5 },
      { pattern: /gas|fuel/i, category: 'Transportation', industry: 'Gas Station', confidence: 0.6 },
      { pattern: /market/i, category: 'Groceries', industry: 'Market', confidence: 0.5 }
    ];

    // Check patterns in order of confidence
    patterns.sort((a, b) => b.confidence - a.confidence);
    
    for (const { pattern, category, industry, confidence } of patterns) {
      if (pattern.test(cleanDesc)) {
        return {
          originalName: description,
          cleanName,
          category,
          industry,
          confidence,
          suggestedTags: [category.toLowerCase(), industry.toLowerCase(), cleanName.toLowerCase()]
        };
      }
    }

    // If no pattern matches, try to extract useful info from the description
    const words = cleanName.split(/\s+/);
    const suggestedTags = words.filter(word => word.length > 3);
    
    return {
      originalName: description,
      cleanName,
      category: 'Other',
      industry: 'Unknown',
      confidence: 0.3,
      suggestedTags: ['uncategorized']
    };
  }

  private cleanMerchantName(description: string): string {
    // Remove common banking prefixes and clean up merchant names
    let cleaned = description
      .replace(/^(POS|DEBIT|CREDIT|PURCHASE|PAYMENT|CHECKCARD|CHECK CARD|VISA|MC|AMEX)\s+/gi, '')
      .replace(/^(ACH|EFT|TRANSFER|DIRECT DEBIT|DD|RECURRING)\s+/gi, '')
      .replace(/^(ONLINE|WEB|INTERNET|MOBILE)\s+/gi, '')
      .replace(/\s+\d{2}\/\d{2}\/\d{2,4}(\s|$)/g, ' ') // Remove dates
      .replace(/\s+\d{2}\/\d{2}(\s|$)/g, ' ') // Remove short dates
      .replace(/\s+#\d+(\s|$)/g, ' ') // Remove reference numbers
      .replace(/\s+\*+\d+(\s|$)/g, ' ') // Remove card numbers
      .replace(/\s+[A-Z]{2}\s+\d{5}(\s|$)/g, ' ') // Remove state + zip
      .replace(/\s+[A-Z]{2}$/, '') // Remove trailing state codes
      .replace(/\d{10,}/, '') // Remove long numbers (transaction IDs)
      .replace(/\s+USD(\s|$)/gi, ' ') // Remove currency codes
      .replace(/\s+US(\s|$)/g, ' ') // Remove country codes
      .replace(/\s{2,}/g, ' ') // Collapse multiple spaces
      .trim();
    
    // Extract the most likely merchant name (often the first part)
    // Common patterns: "MERCHANT_NAME CITY STATE" or "MERCHANT_NAME 123-456"
    const parts = cleaned.split(/\s+/);
    
    // If we have location info at the end (city/state pattern), remove it
    if (parts.length > 2) {
      // Check if last part looks like a state code
      const lastPart = parts[parts.length - 1];
      if (lastPart.length === 2 && /^[A-Z]{2}$/.test(lastPart)) {
        parts.pop(); // Remove state
        // Also remove city if it looks like one (all caps, not a known merchant)
        const secondLast = parts[parts.length - 1];
        if (secondLast && secondLast === secondLast.toUpperCase() && secondLast.length > 2) {
          parts.pop();
        }
      }
    }
    
    // Join remaining parts and do final cleanup
    cleaned = parts.join(' ')
      .replace(/\s+\d{3}-\d{3}-\d{4}$/, '') // Remove phone numbers
      .replace(/\.com$/i, '') // Remove .com suffix
      .trim();
    
    return cleaned || description.trim();
  }

  // Subscription Management
  getSubscriptions(): Subscription[] {
    return this.subscriptions.sort((a, b) => a.nextPaymentDate.getTime() - b.nextPaymentDate.getTime());
  }

  addSubscription(subscription: Omit<Subscription, 'id' | 'createdAt' | 'lastUpdated'>): Subscription {
    const newSubscription: Subscription = {
      ...subscription,
      id: Date.now().toString(),
      createdAt: new Date(),
      lastUpdated: new Date()
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
      lastUpdated: new Date()
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
    
    // Filter to only expense transactions (negative amounts)
    const expenses = transactions.filter(t => t.amount < 0);
    
    // Group transactions by merchant
    const merchantGroups = expenses.reduce((groups, transaction) => {
      const cleanMerchant = this.cleanMerchantName(transaction.description);
      if (!groups[cleanMerchant]) {
        groups[cleanMerchant] = [];
      }
      groups[cleanMerchant].push(transaction);
      return groups;
    }, {} as Record<string, Transaction[]>);

    // Analyze each merchant group for subscription patterns
    Object.entries(merchantGroups).forEach(([merchant, merchantTransactions]) => {
      // Need at least 3 transactions to detect a pattern
      if (merchantTransactions.length < 3) return;

      // Sort by date
      merchantTransactions.sort((a, b) => a.date.getTime() - b.date.getTime());

      // Check for regular intervals
      const intervals = [];
      const amounts = merchantTransactions.map(t => Math.abs(t.amount));
      
      for (let i = 1; i < merchantTransactions.length; i++) {
        const daysDiff = Math.round((merchantTransactions[i].date.getTime() - merchantTransactions[i-1].date.getTime()) / (1000 * 60 * 60 * 24));
        intervals.push(daysDiff);
      }

      // Calculate interval statistics
      const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
      const medianInterval = [...intervals].sort((a, b) => a - b)[Math.floor(intervals.length / 2)];
      
      // Check amount consistency (within 20% variance)
      const avgAmount = amounts.reduce((sum, amt) => sum + amt, 0) / amounts.length;
      const amountVariance = amounts.map(amt => Math.abs(amt - avgAmount) / avgAmount);
      const isAmountConsistent = amountVariance.every(variance => variance <= 0.2);
      
      // Use median for better interval detection (less affected by outliers)
      const intervalTolerance = medianInterval <= 35 ? 3 : 5; // Tighter tolerance for monthly
      const isRegular = intervals.every(interval => Math.abs(interval - medianInterval) <= intervalTolerance);

      // Determine if this looks like a subscription
      if (isRegular && isAmountConsistent && medianInterval >= 7 && medianInterval <= 370) {
        let frequency: Subscription['frequency'] = 'monthly';
        
        // Better frequency detection based on median interval
        if (medianInterval >= 7 && medianInterval <= 10) {
          frequency = 'weekly';
        } else if (medianInterval >= 13 && medianInterval <= 17) {
          frequency = 'bi-weekly';
        } else if (medianInterval >= 27 && medianInterval <= 35) {
          frequency = 'monthly';
        } else if (medianInterval >= 55 && medianInterval <= 65) {
          frequency = 'bi-monthly';
        } else if (medianInterval >= 85 && medianInterval <= 95) {
          frequency = 'quarterly';
        } else if (medianInterval >= 175 && medianInterval <= 190) {
          frequency = 'semi-annually';
        } else if (medianInterval >= 355 && medianInterval <= 370) {
          frequency = 'yearly';
        }

        const enrichment = this.enrichMerchant(merchant);
        const lastTransaction = merchantTransactions[merchantTransactions.length - 1];
        
        // Calculate next payment date based on frequency
        const nextPaymentDays = medianInterval;
        const nextPaymentDate = new Date(lastTransaction.date);
        nextPaymentDate.setDate(nextPaymentDate.getDate() + nextPaymentDays);

        // Check if subscription already exists to avoid duplicates
        const existingSubscription = this.subscriptions.find(sub => 
          sub.merchantName.toLowerCase() === enrichment.cleanName.toLowerCase() &&
          sub.status === 'active'
        );
        
        if (!existingSubscription) {
          potentialSubscriptions.push({
            id: `detected-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            merchantId: merchant.toLowerCase().replace(/[^a-z0-9]/g, '-'),
            merchantName: enrichment.cleanName,
            amount: avgAmount,
            frequency,
            nextPaymentDate,
            category: enrichment.category || merchantTransactions[0].category || 'Other',
            status: 'active',
            startDate: merchantTransactions[0].date,
            renewalType: 'auto',
            paymentMethod: 'Unknown',
            transactionIds: merchantTransactions.map(t => t.id),
            confidence: isAmountConsistent ? 0.9 : 0.7, // Add confidence score
            createdAt: new Date(),
            lastUpdated: new Date()
          });
        }
      }
    });

    // Sort by confidence and amount (most expensive first)
    return potentialSubscriptions.sort((a, b) => {
      const confA = (a as any).confidence || 0.5;
      const confB = (b as any).confidence || 0.5;
      if (confA !== confB) return confB - confA;
      return b.amount - a.amount;
    });
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

        patterns.push({
          id: `pattern-${Date.now()}-${category}`,
          patternType: 'recurring',
          category,
          frequency,
          amount: avgAmount,
          variance: stdDev,
          confidence: Math.min(0.9, Math.max(0.5, 1 - (stdDev / avgAmount))),
          description: `Regular ${frequency} spending in ${category}`,
          transactions: categoryTransactions.map(t => t.id),
          detectedAt: new Date(),
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

    // Check for subscription renewals
    const upcomingRenewals = this.subscriptions.filter(sub => {
      const daysUntilRenewal = Math.ceil((sub.nextPaymentDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      return daysUntilRenewal <= 7 && daysUntilRenewal > 0;
    });

    upcomingRenewals.forEach(sub => {
      const daysUntilRenewal = Math.ceil((sub.nextPaymentDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      newInsights.push({
        id: `insight-renewal-${sub.id}`,
        type: 'subscription_alert',
        title: 'Subscription Renewal Due',
        description: `${sub.merchantName} ($${sub.amount.toFixed(2)}) renews in ${daysUntilRenewal} day${daysUntilRenewal !== 1 ? 's' : ''}`,
        severity: daysUntilRenewal <= 3 ? 'high' : 'medium',
        category: sub.category,
        merchant: sub.merchantName,
        amount: sub.amount,
        transactionIds: sub.transactionIds,
        actionable: true,
        dismissed: false,
        createdAt: new Date()
      });
    });

    // Check for spending spikes
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const currentMonthTransactions = transactions.filter(t => 
      t.date.getMonth() === currentMonth && t.date.getFullYear() === currentYear
    );

    const lastMonth = new Date();
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
            description: `${category} spending is ${increasePercentage.toFixed(0)}% higher than last month`,
            severity: increasePercentage > 50 ? 'high' : 'medium',
            category,
            amount: currentAmount,
            transactionIds: currentMonthTransactions.filter(t => t.category === category).map(t => t.id),
            actionable: true,
            dismissed: false,
            createdAt: new Date()
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
      lastAnalysisRun: new Date()
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