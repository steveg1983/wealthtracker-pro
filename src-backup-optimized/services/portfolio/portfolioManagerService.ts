/**
 * Portfolio Manager Service
 * World-class portfolio management with Goldman Sachs-level precision
 * Implements patterns from Charles Schwab and Fidelity platforms
 */

import { toDecimal } from '../../utils/decimal';
import { validateSymbol } from '../stockPriceService';
import type { DecimalInstance } from '../../types/decimal-types';

interface StockHolding {
  id: string;
  symbol: string;
  shares: DecimalInstance;
  averageCost: DecimalInstance;
  costBasis: DecimalInstance;
  dateAdded: Date;
}

interface ValidationResult {
  isValid: boolean;
  error?: string;
}

interface HoldingFormData {
  symbol: string;
  shares: string;
  averageCost: string;
}

/**
 * Enterprise-grade portfolio management service
 */
class PortfolioManagerService {
  /**
   * Validate holding form data
   */
  async validateHoldingData(formData: HoldingFormData): Promise<ValidationResult> {
    const { symbol, shares, averageCost } = formData;

    // Basic field validation
    if (!symbol || !shares || !averageCost) {
      return { isValid: false, error: 'All fields are required' };
    }

    // Numeric validation
    const sharesNum = parseFloat(shares);
    const costNum = parseFloat(averageCost);

    if (isNaN(sharesNum) || sharesNum <= 0) {
      return { isValid: false, error: 'Shares must be a positive number' };
    }

    if (isNaN(costNum) || costNum <= 0) {
      return { isValid: false, error: 'Average cost must be a positive number' };
    }

    // Symbol validation
    try {
      const isValidSymbol = await validateSymbol(symbol);
      if (!isValidSymbol) {
        return { 
          isValid: false, 
          error: `Symbol "${symbol}" not found. Please check and try again.` 
        };
      }
    } catch (error) {
      return { 
        isValid: false, 
        error: 'Unable to validate symbol. Please try again.' 
      };
    }

    return { isValid: true };
  }

  /**
   * Create new holding from form data
   */
  createHolding(formData: HoldingFormData): StockHolding {
    const { symbol, shares, averageCost } = formData;
    const sharesDecimal = toDecimal(parseFloat(shares));
    const costDecimal = toDecimal(parseFloat(averageCost));
    const costBasis = sharesDecimal.times(costDecimal);

    return {
      id: `holding-${Date.now()}`,
      symbol: symbol.toUpperCase(),
      shares: sharesDecimal,
      averageCost: costDecimal,
      costBasis,
      dateAdded: new Date()
    };
  }

  /**
   * Update existing holding
   */
  updateHolding(
    existingHolding: StockHolding,
    formData: HoldingFormData
  ): StockHolding {
    const { symbol, shares, averageCost } = formData;
    const sharesDecimal = toDecimal(parseFloat(shares));
    const costDecimal = toDecimal(parseFloat(averageCost));
    const costBasis = sharesDecimal.times(costDecimal);

    return {
      ...existingHolding,
      symbol: symbol.toUpperCase(),
      shares: sharesDecimal,
      averageCost: costDecimal,
      costBasis
    };
  }

  /**
   * Calculate total cost basis
   */
  calculateTotalCostBasis(holdings: StockHolding[]): DecimalInstance {
    return holdings.reduce((sum, holding) => sum.plus(holding.costBasis), toDecimal(0));
  }

  /**
   * Calculate cost basis preview
   */
  calculateCostBasisPreview(shares: string, averageCost: string): DecimalInstance | null {
    const sharesNum = parseFloat(shares);
    const costNum = parseFloat(averageCost);

    if (isNaN(sharesNum) || isNaN(costNum)) {
      return null;
    }

    return toDecimal(sharesNum * costNum);
  }

  /**
   * Add holding to portfolio
   */
  addHoldingToPortfolio(
    holdings: StockHolding[],
    newHolding: StockHolding
  ): StockHolding[] {
    return [...holdings, newHolding];
  }

  /**
   * Update holding in portfolio
   */
  updateHoldingInPortfolio(
    holdings: StockHolding[],
    holdingId: string,
    updatedHolding: StockHolding
  ): StockHolding[] {
    return holdings.map(h => 
      h.id === holdingId ? updatedHolding : h
    );
  }

  /**
   * Remove holding from portfolio
   */
  removeHoldingFromPortfolio(
    holdings: StockHolding[],
    holdingId: string
  ): StockHolding[] {
    return holdings.filter(h => h.id !== holdingId);
  }

  /**
   * Get portfolio statistics
   */
  getPortfolioStats(holdings: StockHolding[]) {
    return {
      totalHoldings: holdings.length,
      totalCostBasis: this.calculateTotalCostBasis(holdings),
      uniqueSymbols: new Set(holdings.map(h => h.symbol)).size,
      averagePositionSize: holdings.length > 0 
        ? this.calculateTotalCostBasis(holdings).dividedBy(holdings.length)
        : toDecimal(0)
    };
  }

  /**
   * Prepare form data from existing holding
   */
  prepareFormDataFromHolding(holding: StockHolding): HoldingFormData {
    return {
      symbol: holding.symbol,
      shares: holding.shares.toString(),
      averageCost: holding.averageCost.toString()
    };
  }

  /**
   * Get empty form data
   */
  getEmptyFormData(): HoldingFormData {
    return {
      symbol: '',
      shares: '',
      averageCost: ''
    };
  }
}

export const portfolioManagerService = new PortfolioManagerService();
export type { StockHolding, HoldingFormData, ValidationResult };