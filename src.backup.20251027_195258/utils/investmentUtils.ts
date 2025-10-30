import type { Transaction, Holding } from '../types';
import { logger } from '../services/loggingService';
import { toDecimal } from '@wealthtracker/utils';

interface InvestmentTransactionData {
  ticker: string;
  name: string;
  shares: number;
  pricePerShare: number;
  fees: number;
  type: 'buy' | 'sell';
}

/**
 * Extract investment data from transaction notes
 */
export function parseInvestmentTransaction(transaction: Transaction): InvestmentTransactionData | null {
  if (!transaction.notes || !transaction.tags?.includes('investment')) {
    return null;
  }

  try {
    // Parse the structured notes
    const lines = transaction.notes.split('\n');
    const data: Partial<InvestmentTransactionData> = {};
    const parseNumericValue = (input: string | number | null | undefined): number => {
      if (input === null || input === undefined) {
        return 0;
      }

      if (typeof input === 'number') {
        if (Number.isNaN(input)) {
          return 0;
        }
        return input;
      }

      const trimmed = input.trim();
      if (trimmed === '') {
        return 0;
      }

      const sanitized = trimmed.replace(/[^0-9.-]/g, '');
      if (sanitized === '' || sanitized === '-' || sanitized === '.' || sanitized === '-.') {
        return 0;
      }

      try {
        return toDecimal(sanitized).toNumber();
      } catch (error) {
        logger.warn('Failed to parse investment numeric value', { input, sanitized, error: String(error) });
        return 0;
      }
    };

    lines.forEach(line => {
      const [keyRaw, valueRaw] = line.split(':');
      const key = keyRaw?.trim();
      const value = valueRaw?.trim();
      if (!key) {
        return;
      }

      switch (key) {
        case 'Stock Code':
          if (value) {
            data.ticker = value;
          }
          break;
        case 'Units':
          if (value) {
            data.shares = parseNumericValue(value);
          }
          break;
        case 'Price per unit':
          if (value) {
            data.pricePerShare = parseNumericValue(value);
          }
          break;
        case 'Fees':
          if (value) {
            data.fees = parseNumericValue(value);
          }
          break;
      }
    });

    // Extract name from description
    const descMatch = transaction.description.match(/(?:Buy|Investment):\s*([^(]+)(?:\s*\([^)]+\))?/);
    if (descMatch && descMatch[1]) {
      data.name = descMatch[1].trim();
    }

    // Determine if it's a buy or sell
    data.type = transaction.type === 'expense' ? 'buy' : 'sell';

    // Validate required fields
    if (data.ticker && data.shares && data.pricePerShare !== undefined) {
      return {
        ticker: data.ticker,
        name: data.name ?? data.ticker,
        shares: data.shares,
        pricePerShare: data.pricePerShare,
        fees: data.fees ?? 0,
        type: data.type ?? 'buy'
      };
    }

    return null;
  } catch (error) {
    logger.error('Error parsing investment transaction:', error);
    return null;
  }
}

/**
 * Update account holdings based on investment transaction
 */
export function updateHoldings(
  currentHoldings: Holding[],
  investmentData: InvestmentTransactionData
): Holding[] {
  const existingIndex = currentHoldings.findIndex(h => h.ticker === investmentData.ticker);
  
  if (investmentData.type === 'buy') {
    if (existingIndex >= 0) {
      // Update existing holding
      const existing = currentHoldings[existingIndex];
      if (!existing) {
        return currentHoldings;
      }
      const newShares = existing.shares + investmentData.shares;
      const newValue = existing.value + (investmentData.shares * investmentData.pricePerShare) + investmentData.fees;
      const newAverageCost = newValue / newShares;
      
      const updatedHoldings = [...currentHoldings];
      updatedHoldings[existingIndex] = {
        ...existing,
        shares: newShares,
        value: newValue,
        averageCost: newAverageCost
      };
      
      return updatedHoldings;
    } else {
      // Add new holding
      const totalCost = (investmentData.shares * investmentData.pricePerShare) + investmentData.fees;
      const newHolding: Holding = {
        ticker: investmentData.ticker,
        name: investmentData.name,
        shares: investmentData.shares,
        value: totalCost,
        averageCost: totalCost / investmentData.shares
      };
      
      return [...currentHoldings, newHolding];
    }
  } else {
    // Handle sell transactions
    if (existingIndex >= 0) {
      const existing = currentHoldings[existingIndex];
      if (!existing) {
        return currentHoldings;
      }
      const newShares = existing.shares - investmentData.shares;
      
      if (newShares <= 0) {
        // Remove holding if all shares sold
        return currentHoldings.filter((_, index) => index !== existingIndex);
      } else {
        // Update holding with remaining shares
        const updatedHoldings = [...currentHoldings];
        updatedHoldings[existingIndex] = {
          ...existing,
          shares: newShares,
          value: newShares * (existing.averageCost || existing.value / existing.shares)
        };
        
        return updatedHoldings;
      }
    }
  }
  
  return currentHoldings;
}

/**
 * Calculate total holdings value for an account
 */
export function calculateHoldingsValue(holdings: Holding[]): number {
  return holdings.reduce((sum, holding) => sum + holding.value, 0);
}
