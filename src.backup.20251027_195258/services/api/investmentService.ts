/**
 * Investment Service - Complete investment tracking with Supabase integration
 * 
 * Features:
 * - Portfolio management
 * - Real-time price updates
 * - Transaction tracking
 * - Performance calculation
 * - Dividend tracking
 */

import { supabase } from '@wealthtracker/core';
import { userIdService } from '../userIdService';
import { realTimePriceService } from '../realtimePriceService';
import { logger } from '../loggingService';
import { toDecimal } from '@wealthtracker/utils';
import type { Database } from '@app-types/supabase';

type InvestmentRow = Database['public']['Tables']['investments']['Row'];
type InvestmentInsert = Database['public']['Tables']['investments']['Insert'];
type InvestmentUpdate = Database['public']['Tables']['investments']['Update'];
type InvestmentTransactionInsert = Database['public']['Tables']['investment_transactions']['Insert'];
type InvestmentTransactionRow = Database['public']['Tables']['investment_transactions']['Row'];

export interface Investment {
  id: string;
  userId: string;
  accountId?: string;
  symbol: string;
  name: string;
  quantity: number;
  costBasis: number;
  currentPrice?: number;
  marketValue?: number;
  assetType: 'stock' | 'bond' | 'etf' | 'mutual_fund' | 'crypto' | 'commodity' | 'real_estate' | 'other';
  exchange?: string;
  currency: string;
  purchaseDate?: Date;
  purchasePrice?: number;
  lastUpdated?: Date;
  notes?: string;
  currentValue?: number;
  averageCost?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface InvestmentTransaction {
  id: string;
  investmentId: string;
  userId: string;
  transactionType: 'buy' | 'sell' | 'dividend' | 'split' | 'transfer';
  quantity: number;
  price: number;
  totalAmount: number;
  fees: number;
  date: Date;
  notes?: string;
  createdAt: Date;
}

export interface PortfolioSummary {
  totalValue: number;
  totalCost: number;
  totalGainLoss: number;
  totalGainLossPercent: number;
  dayChange: number;
  dayChangePercent: number;
  investments: Investment[];
}

type DecimalLike = { toNumber: () => number };
type IntervalHandle = ReturnType<typeof globalThis.setInterval>;

// Type guard to check if value has toNumber method
const hasToNumber = (value: unknown): value is DecimalLike => {
  return typeof value === 'object' && value !== null && 'toNumber' in value && typeof (value as DecimalLike).toNumber === 'function';
};

const assetTypes: Investment['assetType'][] = [
  'stock',
  'bond',
  'etf',
  'mutual_fund',
  'crypto',
  'commodity',
  'real_estate',
  'other'
];

const isAssetType = (value: unknown): value is Investment['assetType'] => {
  return typeof value === 'string' && assetTypes.includes(value as Investment['assetType']);
};

const transactionTypes: InvestmentTransaction['transactionType'][] = [
  'buy',
  'sell',
  'dividend',
  'split',
  'transfer'
];

const isTransactionType = (value: unknown): value is InvestmentTransaction['transactionType'] => {
  return typeof value === 'string' && transactionTypes.includes(value as InvestmentTransaction['transactionType']);
};

const toOptionalString = (value: unknown): string | undefined => {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return undefined;
};

const parseDateOrThrow = (value: unknown, field: string): Date => {
  if (value instanceof Date) {
    return value;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  throw new Error(`InvestmentService: invalid "${field}" value`);
};

const coerceDecimalInput = (value: unknown): number | string => {
  if (hasToNumber(value)) {
    return value.toNumber();
  }
  if (typeof value === 'number' || typeof value === 'string') {
    return value;
  }
  return 0;
};

const toDbDateString = (date: Date): string => {
  const isoString = date.toISOString();
  const separatorIndex = isoString.indexOf('T');
  return separatorIndex === -1 ? isoString : isoString.slice(0, separatorIndex);
};

class InvestmentService {
  private priceUpdateInterval: IntervalHandle | null = null;

  /**
   * Get all investments for a user
   */
  async getInvestments(clerkId: string): Promise<Investment[]> {
    try {
      const userId = await userIdService.getDatabaseUserId(clerkId);
      if (!userId) throw new Error('User not found');

      const { data, error } = await supabase
        .from('investments')
        .select('*')
        .eq('user_id', userId)
        .order('market_value', { ascending: false });

      if (error) throw error;

      const investments = (data ?? []).map(row => this.mapInvestmentRow(row));
      await this.updateInvestmentPrices(investments);

      return investments;
    } catch (error) {
      logger.error('Error getting investments', error, 'InvestmentService');
      
      // Fallback to localStorage
      const stored = localStorage.getItem(`investments_${clerkId}`);
      return stored ? JSON.parse(stored) : [];
    }
  }

  /**
   * Get investments for a specific account
   */
  async getAccountInvestments(clerkId: string, accountId: string): Promise<Investment[]> {
    try {
      const userId = await userIdService.getDatabaseUserId(clerkId);
      if (!userId) throw new Error('User not found');

      const { data, error } = await supabase
        .from('investments')
        .select('*')
        .eq('user_id', userId)
        .eq('account_id', accountId)
        .order('market_value', { ascending: false });

      if (error) throw error;

      return (data ?? []).map(row => this.mapInvestmentRow(row));
    } catch (error) {
      logger.error('Error getting account investments', error, 'InvestmentService');
      return [];
    }
  }

  /**
   * Create a new investment
   */
  async createInvestment(
    clerkId: string,
    investment: Omit<Investment, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
  ): Promise<Investment> {
    try {
      const userId = await userIdService.getDatabaseUserId(clerkId);
      if (!userId) throw new Error('User not found');

      // Get current price if not provided
      let currentPrice = investment.currentPrice;
      if (!currentPrice && investment.symbol) {
        try {
          const priceData = await realTimePriceService.getQuote(investment.symbol);
          if (priceData) {
            currentPrice = hasToNumber(priceData.price)
              ? priceData.price.toNumber()
              : Number(priceData.price);
          }
        } catch (error) {
          logger.warn('Failed to fetch current price', error, 'InvestmentService');
        }
      }

      const marketValue = currentPrice ? investment.quantity * currentPrice : undefined;

      const insertPayload = this.buildInvestmentInsert(userId, investment, currentPrice, marketValue);

      const { data, error } = await supabase
        .from('investments')
        .insert(insertPayload)
        .select()
        .single();

      if (error) throw error;

      // Create initial transaction
      if (investment.purchaseDate && investment.purchasePrice) {
        await this.createTransaction(clerkId, {
          investmentId: data.id,
          transactionType: 'buy',
          quantity: investment.quantity,
          price: investment.purchasePrice,
          totalAmount: investment.costBasis,
          fees: 0,
          date: investment.purchaseDate,
          notes: 'Initial purchase'
        });
      }

      return this.mapInvestmentRow(data);
    } catch (error) {
      logger.error('Error creating investment', error, 'InvestmentService');
      throw error;
    }
  }

  /**
   * Update an investment
   */
  async updateInvestment(
    clerkId: string,
    investmentId: string,
    updates: Partial<Investment>
  ): Promise<Investment> {
    try {
      const userId = await userIdService.getDatabaseUserId(clerkId);
      if (!userId) throw new Error('User not found');

      // Recalculate market value if quantity or price changed
      let marketValue = updates.marketValue;
      if (updates.quantity !== undefined || updates.currentPrice !== undefined) {
        const existing = await this.getInvestment(clerkId, investmentId);
        const quantity = updates.quantity ?? existing.quantity;
        const price = updates.currentPrice ?? existing.currentPrice ?? 0;
        marketValue = quantity * price;
      }

      const overridePayload: { currentPrice?: number; marketValue?: number } = {};
      if (updates.currentPrice !== undefined) {
        overridePayload.currentPrice = updates.currentPrice;
      }
      if (marketValue !== undefined) {
        overridePayload.marketValue = marketValue;
      }

      const dbUpdates = this.buildInvestmentUpdate(updates, overridePayload);

      const { data, error } = await supabase
        .from('investments')
        .update(dbUpdates)
        .eq('id', investmentId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw error;

      return this.mapInvestmentRow(data);
    } catch (error) {
      logger.error('Error updating investment', error, 'InvestmentService');
      throw error;
    }
  }

  /**
   * Delete an investment
   */
  async deleteInvestment(clerkId: string, investmentId: string): Promise<void> {
    try {
      const userId = await userIdService.getDatabaseUserId(clerkId);
      if (!userId) throw new Error('User not found');

      const { error } = await supabase
        .from('investments')
        .delete()
        .eq('id', investmentId)
        .eq('user_id', userId);

      if (error) throw error;
    } catch (error) {
      logger.error('Error deleting investment', error, 'InvestmentService');
      throw error;
    }
  }

  /**
   * Get a single investment
   */
  async getInvestment(clerkId: string, investmentId: string): Promise<Investment> {
    try {
      const userId = await userIdService.getDatabaseUserId(clerkId);
      if (!userId) throw new Error('User not found');

      const { data, error } = await supabase
        .from('investments')
        .select('*')
        .eq('id', investmentId)
        .eq('user_id', userId)
        .single();

      if (error) throw error;

      return this.mapInvestmentRow(data);
    } catch (error) {
      logger.error('Error getting investment', error, 'InvestmentService');
      throw error;
    }
  }

  /**
   * Create an investment transaction
   */
  async createTransaction(
    clerkId: string,
    transaction: Omit<InvestmentTransaction, 'id' | 'userId' | 'createdAt'>
  ): Promise<InvestmentTransaction> {
    try {
      const userId = await userIdService.getDatabaseUserId(clerkId);
      if (!userId) throw new Error('User not found');

      const insertPayload: InvestmentTransactionInsert = {
        investment_id: transaction.investmentId,
        user_id: userId,
        transaction_type: transaction.transactionType,
        quantity: transaction.quantity,
        price: transaction.price,
        total_amount: transaction.totalAmount,
        fees: transaction.fees ?? 0,
        date: toDbDateString(transaction.date),
        notes: transaction.notes ?? null,
        created_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('investment_transactions')
        .insert(insertPayload)
        .select()
        .single();

      if (error) throw error;

      // Update investment based on transaction
      await this.updateInvestmentFromTransaction(clerkId, transaction);

      return this.mapTransaction(data as InvestmentTransactionRow);
    } catch (error) {
      logger.error('Error creating transaction', error, 'InvestmentService');
      throw error;
    }
  }

  /**
   * Get transactions for an investment
   */
  async getTransactions(clerkId: string, investmentId: string): Promise<InvestmentTransaction[]> {
    try {
      const userId = await userIdService.getDatabaseUserId(clerkId);
      if (!userId) throw new Error('User not found');

      const { data, error } = await supabase
        .from('investment_transactions')
        .select('*')
        .eq('investment_id', investmentId)
        .eq('user_id', userId)
        .order('date', { ascending: false });

      if (error) throw error;

      return (data || []).map(row => this.mapTransaction(row as InvestmentTransactionRow));
    } catch (error) {
      logger.error('Error getting transactions', error, 'InvestmentService');
      return [];
    }
  }

  /**
   * Get portfolio summary
   */
  async getPortfolioSummary(clerkId: string, accountId?: string): Promise<PortfolioSummary> {
    try {
      const investments = accountId
        ? await this.getAccountInvestments(clerkId, accountId)
        : await this.getInvestments(clerkId);

      // Update prices
      await this.updateInvestmentPrices(investments);

      const totalValue = investments.reduce((sum, inv) => sum + (inv.marketValue || 0), 0);
      const totalCost = investments.reduce((sum, inv) => sum + inv.costBasis, 0);
      const totalGainLoss = totalValue - totalCost;
      const totalGainLossPercent = totalCost > 0 ? (totalGainLoss / totalCost) * 100 : 0;

      // Calculate day change (would need historical data for accurate calculation)
      const dayChange = 0;
      const dayChangePercent = 0;

      return {
        totalValue,
        totalCost,
        totalGainLoss,
        totalGainLossPercent,
        dayChange,
        dayChangePercent,
        investments
      };
    } catch (error) {
      logger.error('Error getting portfolio summary', error, 'InvestmentService');
      return {
        totalValue: 0,
        totalCost: 0,
        totalGainLoss: 0,
        totalGainLossPercent: 0,
        dayChange: 0,
        dayChangePercent: 0,
        investments: []
      };
    }
  }

  /**
   * Update investment prices
   */
  private async updateInvestmentPrices(investments: Investment[]): Promise<void> {
    const symbols = investments
      .filter(inv => inv.symbol)
      .map(inv => inv.symbol);

    if (symbols.length === 0) return;

    try {
      const quotes = await realTimePriceService.getBatchQuotes(symbols);

      for (const investment of investments) {
        const targetSymbol = typeof investment.symbol === 'string'
          ? investment.symbol.toUpperCase()
          : investment.symbol;
        const quote = quotes.find((q) => q.symbol === targetSymbol);

        if (quote) {
          const price = hasToNumber(quote.price)
            ? quote.price.toNumber()
            : Number(quote.price);

          investment.currentPrice = price;
          investment.marketValue = Number(investment.quantity) * price;
        }
      }
    } catch (error) {
      logger.warn('Failed to update investment prices', error, 'InvestmentService');
    }
  }

  /**
   * Update investment from transaction
   */
  private async updateInvestmentFromTransaction(
    clerkId: string,
    transaction: Omit<InvestmentTransaction, 'id' | 'userId' | 'createdAt'>
  ): Promise<void> {
    try {
      const investment = await this.getInvestment(clerkId, transaction.investmentId);
      const updates: Partial<Investment> = {};

      switch (transaction.transactionType) {
        case 'buy':
          updates.quantity = investment.quantity + transaction.quantity;
          updates.costBasis = investment.costBasis + transaction.totalAmount;
          break;
          
        case 'sell': {
          updates.quantity = Math.max(0, investment.quantity - transaction.quantity);
          // Adjust cost basis proportionally
          const sellRatio = transaction.quantity / investment.quantity;
          updates.costBasis = investment.costBasis * (1 - sellRatio);
          break;
        }
          
        case 'split':
          // Stock split - adjust quantity
          updates.quantity = investment.quantity * transaction.quantity;
          break;
          
        case 'dividend':
          // Dividends don't affect quantity or cost basis
          break;
      }

      if (Object.keys(updates).length > 0) {
        await this.updateInvestment(clerkId, transaction.investmentId, updates);
      }
    } catch (error) {
      logger.error('Error updating investment from transaction', error, 'InvestmentService');
    }
  }

  /**
   * Start real-time price updates
   */
  startPriceUpdates(clerkId: string, interval: number = 60000): void {
    this.stopPriceUpdates();
    
    this.priceUpdateInterval = globalThis.setInterval(async () => {
      try {
        const investments = await this.getInvestments(clerkId);
        await this.updateInvestmentPrices(investments);
        
        // Save updated prices to database
        for (const investment of investments) {
          const updatePayload: InvestmentUpdate = {
            last_updated: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          if (investment.currentPrice !== undefined) {
            updatePayload.current_price = investment.currentPrice;
          }
          if (investment.marketValue !== undefined) {
            updatePayload.market_value = investment.marketValue;
          }

          await supabase
            .from('investments')
            .update(updatePayload)
            .eq('id', investment.id);
        }
      } catch (error) {
        logger.error('Error updating prices', error, 'InvestmentService');
      }
    }, interval);
  }

  /**
   * Stop real-time price updates
   */
  stopPriceUpdates(): void {
    if (this.priceUpdateInterval) {
      globalThis.clearInterval(this.priceUpdateInterval);
      this.priceUpdateInterval = null;
    }
  }

  /**
   * Map database investment to domain model
   */
  private mapInvestmentRow(row: InvestmentRow): Investment {
    const createdAt = row.created_at ? new Date(row.created_at) : new Date();
    const updatedAt = row.updated_at ? new Date(row.updated_at) : createdAt;
    const quantity = Number(row.quantity ?? 0);
    const costBasis = Number(row.cost_basis ?? 0);
    const currentPrice = row.current_price ?? undefined;
    const marketValue = row.market_value ?? (currentPrice !== undefined ? quantity * currentPrice : costBasis);

    const investment: Investment = {
      id: row.id,
      userId: row.user_id,
      symbol: row.symbol,
      name: row.name,
      quantity,
      costBasis,
      assetType: isAssetType(row.asset_type) ? row.asset_type : 'other',
      currency: row.currency ?? 'USD',
      createdAt,
      updatedAt,
      currentValue: marketValue,
      marketValue
    };

    if (quantity > 0) {
      investment.averageCost = costBasis / quantity;
    }

    if (currentPrice !== undefined) {
      investment.currentPrice = currentPrice;
    }

    if (row.account_id) {
      investment.accountId = row.account_id;
    }

    if (row.exchange) {
      investment.exchange = row.exchange;
    }

    if (row.purchase_date) {
      const parsed = new Date(row.purchase_date);
      if (!Number.isNaN(parsed.getTime())) {
        investment.purchaseDate = parsed;
      }
    }

    if (row.purchase_price !== null && row.purchase_price !== undefined) {
      investment.purchasePrice = row.purchase_price;
    }

    if (row.last_updated) {
      const parsed = new Date(row.last_updated);
      if (!Number.isNaN(parsed.getTime())) {
        investment.lastUpdated = parsed;
      }
    }

    if (row.notes) {
      investment.notes = row.notes;
    }

    return investment;
  }

  private buildInvestmentInsert(
    userId: string,
    investment: Omit<Investment, 'id' | 'userId' | 'createdAt' | 'updatedAt'>,
    currentPrice: number | undefined,
    marketValue: number | undefined
  ): InvestmentInsert {
    const insert: InvestmentInsert = {
      user_id: userId,
      symbol: investment.symbol,
      name: investment.name,
      quantity: investment.quantity,
      cost_basis: investment.costBasis,
      asset_type: investment.assetType,
      currency: investment.currency || 'USD',
      last_updated: new Date().toISOString()
    };

    if (investment.accountId !== undefined) {
      insert.account_id = investment.accountId ?? null;
    }

    if (typeof investment.exchange === 'string') {
      insert.exchange = investment.exchange;
    }

    if (investment.purchaseDate) {
      insert.purchase_date = toDbDateString(investment.purchaseDate);
    }

    if (investment.purchasePrice !== undefined) {
      insert.purchase_price = investment.purchasePrice ?? null;
    }

    if (investment.notes !== undefined) {
      insert.notes = investment.notes ?? null;
    }

    if (currentPrice !== undefined) {
      insert.current_price = currentPrice;
    }

    if (marketValue !== undefined) {
      insert.market_value = marketValue;
    }

    return insert;
  }

  private buildInvestmentUpdate(
    updates: Partial<Investment>,
    overrides: { currentPrice?: number; marketValue?: number }
  ): InvestmentUpdate {
    const payload: InvestmentUpdate = {
      updated_at: new Date().toISOString(),
      last_updated: new Date().toISOString()
    };

    if (updates.accountId !== undefined) {
      payload.account_id = updates.accountId ?? null;
    }
    if (updates.symbol !== undefined) {
      payload.symbol = updates.symbol;
    }
    if (updates.name !== undefined) {
      payload.name = updates.name;
    }
    if (updates.assetType !== undefined) {
      payload.asset_type = updates.assetType;
    }
    if (typeof updates.exchange === 'string') {
      payload.exchange = updates.exchange;
    }
    if (updates.currency !== undefined) {
      payload.currency = updates.currency;
    }
    if (updates.quantity !== undefined) {
      payload.quantity = updates.quantity;
    }
    if (updates.costBasis !== undefined) {
      payload.cost_basis = updates.costBasis;
    }

    if (typeof overrides.currentPrice === 'number') {
      payload.current_price = overrides.currentPrice;
    } else if (updates.currentPrice !== undefined) {
      payload.current_price = updates.currentPrice;
    }

    if (typeof overrides.marketValue === 'number') {
      payload.market_value = overrides.marketValue;
    } else if (updates.marketValue !== undefined) {
      payload.market_value = updates.marketValue;
    }

    if (updates.purchaseDate instanceof Date) {
      payload.purchase_date = toDbDateString(updates.purchaseDate);
    }
    if (updates.purchasePrice !== undefined) {
      payload.purchase_price = updates.purchasePrice ?? null;
    }
    if (updates.notes !== undefined) {
      payload.notes = updates.notes ?? null;
    }

    return payload;
  }

  /**
   * Map database transaction to domain model
   */
  private mapTransaction(data: InvestmentTransactionRow): InvestmentTransaction {
    const id = data.id;
    const investmentId = data.investment_id;
    const userId = data.user_id;
    const transactionType = isTransactionType(data.transaction_type) ? data.transaction_type : 'buy';
    const date = parseDateOrThrow(data.date, 'transaction.date');
    const createdAt = parseDateOrThrow(data.created_at, 'transaction.created_at');
    const notes = toOptionalString(data.notes);
    const quantity = toDecimal(coerceDecimalInput(data.quantity)).toNumber();
    const price = toDecimal(coerceDecimalInput(data.price)).toNumber();
    const totalAmount = toDecimal(coerceDecimalInput(data.total_amount)).toNumber();
    const fees = toDecimal(coerceDecimalInput(data.fees)).toNumber();

    const transaction: InvestmentTransaction = {
      id,
      investmentId,
      userId,
      transactionType,
      quantity,
      price,
      totalAmount,
      fees,
      date,
      createdAt
    };

    if (notes !== undefined) {
      transaction.notes = notes;
    }

    return transaction;
  }

  /**
   * Migrate investments from localStorage to Supabase
   */
  async migrateFromLocalStorage(clerkId: string): Promise<void> {
    try {
      const stored = localStorage.getItem(`investments_${clerkId}`);
      if (!stored) return;

      const localInvestments = JSON.parse(stored);
      const userId = await userIdService.getDatabaseUserId(clerkId);
      if (!userId) return;

      for (const investment of localInvestments) {
        try {
          await this.createInvestment(clerkId, {
            ...investment,
            id: undefined,
            userId: undefined,
            createdAt: undefined,
            updatedAt: undefined
          });
        } catch (error) {
          logger.warn('Failed to migrate investment', error, 'InvestmentService');
        }
      }

      // Clear localStorage after successful migration
      localStorage.removeItem(`investments_${clerkId}`);
    } catch (error) {
      logger.error('Error migrating investments', error, 'InvestmentService');
    }
  }
}

export const investmentService = new InvestmentService();
