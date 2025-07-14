import { Account, Transaction, Holding } from '../types';

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

    lines.forEach(line => {
      const [key, value] = line.split(':').map(s => s.trim());
      
      switch (key) {
        case 'Stock Code':
          data.ticker = value;
          break;
        case 'Units':
          data.shares = parseFloat(value) || 0;
          break;
        case 'Price per unit':
          data.pricePerShare = parseFloat(value) || 0;
          break;
        case 'Fees':
          data.fees = parseFloat(value) || 0;
          break;
      }
    });

    // Extract name from description
    const descMatch = transaction.description.match(/(?:Buy|Investment):\s*([^(]+)(?:\s*\([^)]+\))?/);
    if (descMatch) {
      data.name = descMatch[1].trim();
    }

    // Determine if it's a buy or sell
    data.type = transaction.type === 'expense' ? 'buy' : 'sell';

    // Validate required fields
    if (data.ticker && data.shares && data.pricePerShare !== undefined) {
      return data as InvestmentTransactionData;
    }

    return null;
  } catch (error) {
    console.error('Error parsing investment transaction:', error);
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