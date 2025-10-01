// Portfolio Rebalancing Service
import { toDecimal } from '../utils/decimal';
import type { DecimalInstance } from '../utils/decimal';
import { logger } from './loggingService';

interface SavedPortfolioTarget {
  id: string;
  name: string;
  description?: string;
  allocations: AssetAllocation[];
  rebalanceThreshold: number;
  createdAt: string;
  lastRebalanced?: string;
}

export interface AssetAllocation {
  assetClass: string;
  subClass?: string;
  targetPercent: number;
  currentPercent: number;
  currentValue: DecimalInstance;
  targetValue: DecimalInstance;
  difference: DecimalInstance;
  differencePercent: number;
}

export interface RebalanceAction {
  symbol: string;
  name: string;
  action: 'buy' | 'sell';
  shares: DecimalInstance;
  amount: DecimalInstance;
  currentShares: DecimalInstance;
  targetShares: DecimalInstance;
  currentValue: DecimalInstance;
  targetValue: DecimalInstance;
  assetClass: string;
  priority: number; // 1-5, lower is higher priority
}

export interface PortfolioTarget {
  id: string;
  name: string;
  description?: string;
  allocations: {
    assetClass: string;
    targetPercent: number;
    tolerance?: number; // +/- percentage for rebalancing trigger
  }[];
  rebalanceThreshold?: number; // Overall portfolio drift threshold
  isActive: boolean;
  createdAt: Date;
  lastRebalanced?: Date;
}

export interface PortfolioTargetInput {
  id?: string;
  name: string;
  description?: string;
  allocations: PortfolioTarget['allocations'];
  rebalanceThreshold?: number;
  isActive: boolean;
  lastRebalanced?: Date;
}

export interface AssetClassMapping {
  symbol: string;
  assetClass: string;
  subClass?: string;
}

class PortfolioRebalanceService {
  private targets: PortfolioTarget[] = [];
  private assetMappings: AssetClassMapping[] = [];
  private storageKey = 'wealthtracker_portfolio_targets';
  private mappingsKey = 'wealthtracker_asset_mappings';

  constructor() {
    this.loadTargets();
    this.loadMappings();
    this.initializeDefaultMappings();
  }

  private loadTargets() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.targets = parsed.map((target: SavedPortfolioTarget) => ({
          ...target,
          createdAt: new Date(target.createdAt),
          lastRebalanced: target.lastRebalanced ? new Date(target.lastRebalanced) : undefined
        }));
      }
    } catch (error) {
      logger.error('Failed to load portfolio targets:', error);
      this.targets = [];
    }
  }

  private saveTargets() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.targets));
    } catch (error) {
      logger.error('Failed to save portfolio targets:', error);
    }
  }

  private loadMappings() {
    try {
      const stored = localStorage.getItem(this.mappingsKey);
      if (stored) {
        this.assetMappings = JSON.parse(stored);
      }
    } catch (error) {
      logger.error('Failed to load asset mappings:', error);
      this.assetMappings = [];
    }
  }

  private saveMappings() {
    try {
      localStorage.setItem(this.mappingsKey, JSON.stringify(this.assetMappings));
    } catch (error) {
      logger.error('Failed to save asset mappings:', error);
    }
  }

  private initializeDefaultMappings() {
    const defaults: AssetClassMapping[] = [
      // US Stocks
      { symbol: 'AAPL', assetClass: 'US Stocks', subClass: 'Large Cap' },
      { symbol: 'MSFT', assetClass: 'US Stocks', subClass: 'Large Cap' },
      { symbol: 'GOOGL', assetClass: 'US Stocks', subClass: 'Large Cap' },
      { symbol: 'AMZN', assetClass: 'US Stocks', subClass: 'Large Cap' },
      { symbol: 'META', assetClass: 'US Stocks', subClass: 'Large Cap' },
      { symbol: 'NVDA', assetClass: 'US Stocks', subClass: 'Large Cap' },
      { symbol: 'TSLA', assetClass: 'US Stocks', subClass: 'Large Cap' },
      { symbol: 'BRK.B', assetClass: 'US Stocks', subClass: 'Large Cap' },
      { symbol: 'JPM', assetClass: 'US Stocks', subClass: 'Large Cap' },
      { symbol: 'JNJ', assetClass: 'US Stocks', subClass: 'Large Cap' },
      
      // ETFs
      { symbol: 'SPY', assetClass: 'US Stocks', subClass: 'Large Cap ETF' },
      { symbol: 'VOO', assetClass: 'US Stocks', subClass: 'Large Cap ETF' },
      { symbol: 'VTI', assetClass: 'US Stocks', subClass: 'Total Market ETF' },
      { symbol: 'IWM', assetClass: 'US Stocks', subClass: 'Small Cap ETF' },
      { symbol: 'QQQ', assetClass: 'US Stocks', subClass: 'Tech ETF' },
      { symbol: 'DIA', assetClass: 'US Stocks', subClass: 'Large Cap ETF' },
      
      // International
      { symbol: 'VXUS', assetClass: 'International Stocks', subClass: 'Developed Markets' },
      { symbol: 'VEA', assetClass: 'International Stocks', subClass: 'Developed Markets' },
      { symbol: 'VWO', assetClass: 'International Stocks', subClass: 'Emerging Markets' },
      { symbol: 'EFA', assetClass: 'International Stocks', subClass: 'Developed Markets' },
      { symbol: 'EEM', assetClass: 'International Stocks', subClass: 'Emerging Markets' },
      
      // Bonds
      { symbol: 'BND', assetClass: 'Bonds', subClass: 'Total Bond Market' },
      { symbol: 'AGG', assetClass: 'Bonds', subClass: 'Total Bond Market' },
      { symbol: 'TLT', assetClass: 'Bonds', subClass: 'Long-Term Treasury' },
      { symbol: 'IEF', assetClass: 'Bonds', subClass: 'Intermediate Treasury' },
      { symbol: 'SHY', assetClass: 'Bonds', subClass: 'Short-Term Treasury' },
      { symbol: 'LQD', assetClass: 'Bonds', subClass: 'Corporate Bonds' },
      { symbol: 'HYG', assetClass: 'Bonds', subClass: 'High Yield Bonds' },
      
      // Real Estate
      { symbol: 'VNQ', assetClass: 'Real Estate', subClass: 'REIT ETF' },
      { symbol: 'O', assetClass: 'Real Estate', subClass: 'REIT' },
      { symbol: 'STOR', assetClass: 'Real Estate', subClass: 'REIT' },
      { symbol: 'SPG', assetClass: 'Real Estate', subClass: 'REIT' },
      
      // Commodities
      { symbol: 'GLD', assetClass: 'Commodities', subClass: 'Gold' },
      { symbol: 'SLV', assetClass: 'Commodities', subClass: 'Silver' },
      { symbol: 'DBC', assetClass: 'Commodities', subClass: 'Broad Commodities' },
      { symbol: 'USO', assetClass: 'Commodities', subClass: 'Oil' },
      
      // Crypto (as securities/ETFs)
      { symbol: 'GBTC', assetClass: 'Alternative', subClass: 'Crypto' },
      { symbol: 'BITO', assetClass: 'Alternative', subClass: 'Crypto' }
    ];

    // Add defaults that don't already exist
    defaults.forEach(defaultMapping => {
      if (!this.assetMappings.find(m => m.symbol === defaultMapping.symbol)) {
        this.assetMappings.push(defaultMapping);
      }
    });

    this.saveMappings();
  }

  // Get or create asset class mapping for a symbol
  getAssetClass(symbol: string): string {
    const mapping = this.assetMappings.find(m => m.symbol === symbol);
    if (mapping) return mapping.assetClass;

    // Try to guess based on symbol patterns
    if (symbol.includes('BND') || symbol.includes('AGG') || symbol.includes('TLT')) {
      return 'Bonds';
    }
    if (symbol.includes('VNQ') || symbol.endsWith('REIT')) {
      return 'Real Estate';
    }
    if (symbol.includes('GLD') || symbol.includes('SLV')) {
      return 'Commodities';
    }
    if (symbol.includes('VEA') || symbol.includes('VWO') || symbol.includes('EFA')) {
      return 'International Stocks';
    }
    
    // Default to US Stocks
    return 'US Stocks';
  }

  // Set asset class mapping
  setAssetClass(symbol: string, assetClass: string, subClass?: string) {
    const existingIndex = this.assetMappings.findIndex(m => m.symbol === symbol);
    
    const mapping: AssetClassMapping = {
      symbol,
      assetClass,
      ...(subClass !== undefined ? { subClass } : {})
    };

    if (existingIndex >= 0) {
      this.assetMappings[existingIndex] = mapping;
    } else {
      this.assetMappings.push(mapping);
    }
    
    this.saveMappings();
  }

  // Create or update portfolio target
  savePortfolioTarget(target: PortfolioTargetInput): PortfolioTarget {
    const existingIndex = target.id
      ? this.targets.findIndex(t => t.id === target.id)
      : -1;
    const existingTarget = existingIndex >= 0 ? this.targets[existingIndex] : undefined;

    const id = target.id ?? `target-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    const createdAt = existingTarget?.createdAt ?? new Date();

    const normalizedAllocations = (target.allocations ?? []).map(allocation => {
      const baseAllocation: PortfolioTarget['allocations'][number] = {
        assetClass: allocation.assetClass,
        targetPercent: allocation.targetPercent
      };
      return allocation.tolerance !== undefined
        ? { ...baseAllocation, tolerance: allocation.tolerance }
        : baseAllocation;
    });

    const name = target.name?.trim() || existingTarget?.name || 'Untitled Target';
    const description = target.description?.trim() || existingTarget?.description;
    const rebalanceThreshold = target.rebalanceThreshold ?? existingTarget?.rebalanceThreshold;
    const lastRebalanced = target.lastRebalanced ?? existingTarget?.lastRebalanced;

    const normalizedTarget: PortfolioTarget = {
      id,
      name,
      allocations: normalizedAllocations,
      isActive: target.isActive ?? existingTarget?.isActive ?? false,
      createdAt
    };

    if (description) {
      normalizedTarget.description = description;
    }

    if (rebalanceThreshold !== undefined) {
      normalizedTarget.rebalanceThreshold = rebalanceThreshold;
    }

    if (lastRebalanced) {
      normalizedTarget.lastRebalanced = lastRebalanced;
    }

    if (existingIndex >= 0) {
      this.targets[existingIndex] = { ...existingTarget, ...normalizedTarget };
    } else {
      this.targets.push(normalizedTarget);
    }

    this.saveTargets();
    return normalizedTarget;
  }

  // Get all portfolio targets
  getPortfolioTargets(): PortfolioTarget[] {
    return [...this.targets];
  }

  // Get active portfolio target
  getActiveTarget(): PortfolioTarget | null {
    return this.targets.find(t => t.isActive) || null;
  }

  // Delete portfolio target
  deletePortfolioTarget(targetId: string): boolean {
    const index = this.targets.findIndex(t => t.id === targetId);
    if (index === -1) return false;
    
    this.targets.splice(index, 1);
    this.saveTargets();
    return true;
  }

  // Calculate current allocation
  calculateCurrentAllocation(holdings: Array<{
    symbol: string;
    value: number;
    shares: number;
  }>): AssetAllocation[] {
    const totalValue = holdings.reduce((sum, h) => sum.plus(toDecimal(h.value)), toDecimal(0));
    
    if (totalValue.isZero()) return [];

    // Group by asset class
    const byAssetClass: Record<string, DecimalInstance> = {};
    
    holdings.forEach(holding => {
      const assetClass = this.getAssetClass(holding.symbol);
      if (!byAssetClass[assetClass]) {
        byAssetClass[assetClass] = toDecimal(0);
      }
      byAssetClass[assetClass] = byAssetClass[assetClass].plus(toDecimal(holding.value));
    });

    // Get active target
    const activeTarget = this.getActiveTarget();
    
    // Calculate allocations
    const allocations: AssetAllocation[] = [];
    
    Object.entries(byAssetClass).forEach(([assetClass, currentValue]) => {
      const currentPercent = currentValue.div(totalValue).times(toDecimal(100)).toNumber();
      const targetAllocation = activeTarget?.allocations.find(a => a.assetClass === assetClass);
      const targetPercent = targetAllocation?.targetPercent || 0;
      const targetValue = totalValue.times(toDecimal(targetPercent)).div(toDecimal(100));
      const difference = targetValue.minus(currentValue);
      const differencePercent = targetPercent - currentPercent;
      
      allocations.push({
        assetClass,
        targetPercent,
        currentPercent,
        currentValue,
        targetValue,
        difference,
        differencePercent
      });
    });

    // Add missing target allocations
    if (activeTarget) {
      activeTarget.allocations.forEach(targetAlloc => {
        if (!allocations.find(a => a.assetClass === targetAlloc.assetClass)) {
          const targetValue = totalValue.times(toDecimal(targetAlloc.targetPercent)).div(toDecimal(100));
          
          allocations.push({
            assetClass: targetAlloc.assetClass,
            targetPercent: targetAlloc.targetPercent,
            currentPercent: 0,
            currentValue: toDecimal(0),
            targetValue,
            difference: targetValue,
            differencePercent: targetAlloc.targetPercent
          });
        }
      });
    }

    return allocations.sort((a, b) => b.currentValue.toNumber() - a.currentValue.toNumber());
  }

  // Calculate rebalancing actions
  calculateRebalanceActions(
    holdings: Array<{
      symbol: string;
      name: string;
      shares: number;
      value: number;
      price: number;
    }>,
    cashAvailable: number = 0,
    taxConsiderations: boolean = false
  ): RebalanceAction[] {
    const activeTarget = this.getActiveTarget();
    if (!activeTarget) return [];

    const totalValue = holdings.reduce((sum, h) => sum + h.value, 0) + cashAvailable;
    const actions: RebalanceAction[] = [];

    // Calculate target values by asset class
    const targetByClass: Record<string, number> = {};
    activeTarget.allocations.forEach(alloc => {
      targetByClass[alloc.assetClass] = (totalValue * alloc.targetPercent) / 100;
    });

    // Group holdings by asset class
    const holdingsByClass: Record<string, typeof holdings> = {};
    holdings.forEach(holding => {
      const assetClass = this.getAssetClass(holding.symbol);
      if (!holdingsByClass[assetClass]) {
        holdingsByClass[assetClass] = [];
      }
      holdingsByClass[assetClass].push(holding);
    });

    // Calculate rebalancing actions
    Object.entries(targetByClass).forEach(([assetClass, targetValue]) => {
      const classHoldings = holdingsByClass[assetClass] || [];
      const currentValue = classHoldings.reduce((sum, h) => sum + h.value, 0);
      const difference = targetValue - currentValue;

      if (Math.abs(difference) < 50) return; // Skip small differences

      if (difference > 0) {
        // Need to buy - distribute proportionally or pick specific holdings
        if (classHoldings.length > 0) {
          // Buy more of existing holdings proportionally
          classHoldings.forEach(holding => {
            const proportion = holding.value / (currentValue || 1);
            const buyAmount = toDecimal(difference * proportion);
            const buyShares = buyAmount.div(toDecimal(holding.price));
            
            if (buyShares.toNumber() >= 0.1) { // Minimum fractional share
              actions.push({
                symbol: holding.symbol,
                name: holding.name,
                action: 'buy',
                shares: buyShares,
                amount: buyAmount,
                currentShares: toDecimal(holding.shares),
                targetShares: toDecimal(holding.shares).plus(buyShares),
                currentValue: toDecimal(holding.value),
                targetValue: toDecimal(holding.value).plus(buyAmount),
                assetClass,
                priority: 2
              });
            }
          });
        } else {
          // Need to buy new holdings - this would require symbol recommendations
          // For now, we'll note this as a needed action
          actions.push({
            symbol: `NEW_${assetClass.toUpperCase().replace(/\s+/g, '_')}`,
            name: `New ${assetClass} Investment`,
            action: 'buy',
            shares: toDecimal(0),
            amount: toDecimal(difference),
            currentShares: toDecimal(0),
            targetShares: toDecimal(0),
            currentValue: toDecimal(0),
            targetValue: toDecimal(difference),
            assetClass,
            priority: 3
          });
        }
      } else {
        // Need to sell - choose holdings to sell
        const sellAmount = Math.abs(difference);
        let remainingToSell = sellAmount;
        
        // Sort by value descending to sell larger positions first
        const sortedHoldings = [...classHoldings].sort((a, b) => b.value - a.value);
        
        sortedHoldings.forEach(holding => {
          if (remainingToSell <= 0) return;
          
          const maxSell = Math.min(holding.value, remainingToSell);
          const sellShares = toDecimal(maxSell).div(toDecimal(holding.price));
          
          // Consider tax implications
          let priority = 2;
          if (taxConsiderations) {
            // In reality, we'd check holding period and cost basis
            // For now, just deprioritize selling
            priority = 4;
          }
          
          if (sellShares.toNumber() >= 0.1) {
            actions.push({
              symbol: holding.symbol,
              name: holding.name,
              action: 'sell',
              shares: sellShares,
              amount: toDecimal(maxSell),
              currentShares: toDecimal(holding.shares),
              targetShares: toDecimal(holding.shares).minus(sellShares),
              currentValue: toDecimal(holding.value),
              targetValue: toDecimal(holding.value).minus(toDecimal(maxSell)),
              assetClass,
              priority
            });
            
            remainingToSell -= maxSell;
          }
        });
      }
    });

    // Sort by priority and amount
    return actions.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return b.amount.toNumber() - a.amount.toNumber();
    });
  }

  // Check if rebalancing is needed
  isRebalancingNeeded(allocations: AssetAllocation[], threshold?: number): boolean {
    const activeTarget = this.getActiveTarget();
    if (!activeTarget) return false;

    const rebalanceThreshold = threshold || activeTarget.rebalanceThreshold || 5; // 5% default

    return allocations.some(allocation => {
      const targetAlloc = activeTarget.allocations.find(a => a.assetClass === allocation.assetClass);
      const tolerance = targetAlloc?.tolerance || rebalanceThreshold;
      
      return Math.abs(allocation.differencePercent) > tolerance;
    });
  }

  // Get predefined portfolio templates
  getPortfolioTemplates(): PortfolioTarget[] {
    return [
      {
        id: 'template-conservative',
        name: 'Conservative',
        description: 'Focus on capital preservation with modest growth',
        allocations: [
          { assetClass: 'Bonds', targetPercent: 70 },
          { assetClass: 'US Stocks', targetPercent: 20 },
          { assetClass: 'International Stocks', targetPercent: 5 },
          { assetClass: 'Real Estate', targetPercent: 5 }
        ],
        rebalanceThreshold: 5,
        isActive: false,
        createdAt: new Date()
      },
      {
        id: 'template-moderate',
        name: 'Moderate',
        description: 'Balanced approach between growth and stability',
        allocations: [
          { assetClass: 'US Stocks', targetPercent: 40 },
          { assetClass: 'Bonds', targetPercent: 40 },
          { assetClass: 'International Stocks', targetPercent: 15 },
          { assetClass: 'Real Estate', targetPercent: 5 }
        ],
        rebalanceThreshold: 5,
        isActive: false,
        createdAt: new Date()
      },
      {
        id: 'template-aggressive',
        name: 'Aggressive',
        description: 'Focus on growth with higher volatility',
        allocations: [
          { assetClass: 'US Stocks', targetPercent: 60 },
          { assetClass: 'International Stocks', targetPercent: 25 },
          { assetClass: 'Bonds', targetPercent: 10 },
          { assetClass: 'Real Estate', targetPercent: 5 }
        ],
        rebalanceThreshold: 7,
        isActive: false,
        createdAt: new Date()
      },
      {
        id: 'template-three-fund',
        name: 'Three-Fund Portfolio',
        description: 'Simple, diversified portfolio with low costs',
        allocations: [
          { assetClass: 'US Stocks', targetPercent: 60 },
          { assetClass: 'International Stocks', targetPercent: 20 },
          { assetClass: 'Bonds', targetPercent: 20 }
        ],
        rebalanceThreshold: 5,
        isActive: false,
        createdAt: new Date()
      },
      {
        id: 'template-all-weather',
        name: 'All Weather',
        description: 'Ray Dalio\'s strategy for all economic conditions',
        allocations: [
          { assetClass: 'US Stocks', targetPercent: 30 },
          { assetClass: 'Bonds', targetPercent: 55 },
          { assetClass: 'Commodities', targetPercent: 7.5 },
          { assetClass: 'Real Estate', targetPercent: 7.5 }
        ],
        rebalanceThreshold: 5,
        isActive: false,
        createdAt: new Date()
      }
    ];
  }

  // Mark portfolio as rebalanced
  markRebalanced(targetId: string) {
    const target = this.targets.find(t => t.id === targetId);
    if (target) {
      target.lastRebalanced = new Date();
      this.saveTargets();
    }
  }
}

export const portfolioRebalanceService = new PortfolioRebalanceService();
