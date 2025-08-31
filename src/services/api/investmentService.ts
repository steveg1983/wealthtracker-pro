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

import { supabase } from '../../lib/supabase';
import { userIdService } from '../userIdService';
import { realTimePriceService } from '../realtimePriceService';
import { logger } from '../loggingService';

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

class InvestmentService {
  private priceUpdateInterval: NodeJS.Timeout | null = null;

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
        .order('market_value', { ascending: false, nullsLast: true });

      if (error) throw error;

      // Update prices for all investments
      const investments = data || [];
      await this.updateInvestmentPrices(investments);

      return investments.map(this.mapInvestment);
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
        .order('market_value', { ascending: false, nullsLast: true });

      if (error) throw error;

      return (data || []).map(this.mapInvestment);
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
          currentPrice = priceData.price;
        } catch (error) {
          logger.warn('Failed to fetch current price', error, 'InvestmentService');
        }
      }

      const marketValue = currentPrice ? investment.quantity * currentPrice : undefined;

      const { data, error } = await supabase
        .from('investments')
        .insert({
          user_id: userId,
          account_id: investment.accountId,
          symbol: investment.symbol,
          name: investment.name,
          quantity: investment.quantity,
          cost_basis: investment.costBasis,
          current_price: currentPrice,
          market_value: marketValue,
          asset_type: investment.assetType,
          exchange: investment.exchange,
          currency: investment.currency || 'USD',
          purchase_date: investment.purchaseDate?.toISOString().split('T')[0],
          purchase_price: investment.purchasePrice,
          notes: investment.notes,
          last_updated: new Date().toISOString()
        })
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

      return this.mapInvestment(data);
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

      const { data, error } = await supabase
        .from('investments')
        .update({
          ...updates,
          market_value: marketValue,
          last_updated: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', investmentId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw error;

      return this.mapInvestment(data);
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

      return this.mapInvestment(data);
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

      const { data, error } = await supabase
        .from('investment_transactions')
        .insert({
          investment_id: transaction.investmentId,
          user_id: userId,
          transaction_type: transaction.transactionType,
          quantity: transaction.quantity,
          price: transaction.price,
          total_amount: transaction.totalAmount,
          fees: transaction.fees || 0,
          date: transaction.date.toISOString().split('T')[0],
          notes: transaction.notes
        })
        .select()
        .single();

      if (error) throw error;

      // Update investment based on transaction
      await this.updateInvestmentFromTransaction(clerkId, transaction);

      return this.mapTransaction(data);
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

      return (data || []).map(this.mapTransaction);
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
  private async updateInvestmentPrices(investments: any[]): Promise<void> {
    const symbols = investments
      .filter(inv => inv.symbol)
      .map(inv => inv.symbol);

    if (symbols.length === 0) return;

    try {
      const quotes = await realTimePriceService.getBatchQuotes(symbols);
      
      for (const investment of investments) {
        const quote = quotes.find(q => q.symbol === investment.symbol);
        if (quote) {
          investment.current_price = quote.price;
          investment.market_value = investment.quantity * quote.price;
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
      let updates: Partial<Investment> = {};

      switch (transaction.transactionType) {
        case 'buy':
          updates.quantity = investment.quantity + transaction.quantity;
          updates.costBasis = investment.costBasis + transaction.totalAmount;
          break;
          
        case 'sell':
          updates.quantity = Math.max(0, investment.quantity - transaction.quantity);
          // Adjust cost basis proportionally
          const sellRatio = transaction.quantity / investment.quantity;
          updates.costBasis = investment.costBasis * (1 - sellRatio);
          break;
          
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
    
    this.priceUpdateInterval = setInterval(async () => {
      try {
        const investments = await this.getInvestments(clerkId);
        await this.updateInvestmentPrices(investments);
        
        // Save updated prices to database
        for (const investment of investments) {
          await supabase
            .from('investments')
            .update({
              current_price: investment.currentPrice,
              market_value: investment.marketValue,
              last_updated: new Date().toISOString()
            })
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
      clearInterval(this.priceUpdateInterval);
      this.priceUpdateInterval = null;
    }
  }

  /**
   * Map database investment to domain model
   */
  private mapInvestment(data: any): Investment {
    return {
      id: data.id,
      userId: data.user_id,
      accountId: data.account_id,
      symbol: data.symbol,
      name: data.name,
      quantity: parseFloat(data.quantity),
      costBasis: parseFloat(data.cost_basis),
      currentPrice: data.current_price ? parseFloat(data.current_price) : undefined,
      marketValue: data.market_value ? parseFloat(data.market_value) : undefined,
      assetType: data.asset_type,
      exchange: data.exchange,
      currency: data.currency,
      purchaseDate: data.purchase_date ? new Date(data.purchase_date) : undefined,
      purchasePrice: data.purchase_price ? parseFloat(data.purchase_price) : undefined,
      lastUpdated: data.last_updated ? new Date(data.last_updated) : undefined,
      notes: data.notes,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    };
  }

  /**
   * Map database transaction to domain model
   */
  private mapTransaction(data: any): InvestmentTransaction {
    return {
      id: data.id,
      investmentId: data.investment_id,
      userId: data.user_id,
      transactionType: data.transaction_type,
      quantity: parseFloat(data.quantity),
      price: parseFloat(data.price),
      totalAmount: parseFloat(data.total_amount),
      fees: parseFloat(data.fees || 0),
      date: new Date(data.date),
      notes: data.notes,
      createdAt: new Date(data.created_at)
    };
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