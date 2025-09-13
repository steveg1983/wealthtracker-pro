/**
 * Capital Gains Tracker Module
 * Tracks and calculates capital gains for investments
 */

import type { Investment } from '../../types';
import type { CapitalGain } from './types';
import type { DecimalInstance } from '../../types/decimal-types';
import { toDecimal } from '../../utils/decimal';
import { differenceInDays } from 'date-fns';

/**
 * Capital gains tracking service
 */
export class CapitalGainsTracker {
  private readonly LONG_TERM_DAYS = 365;
  private readonly TAX_RATES = {
    shortTerm: {
      low: 0.10,
      medium: 0.24,
      high: 0.37
    },
    longTerm: {
      low: 0,
      medium: 0.15,
      high: 0.20
    }
  };

  /**
   * Calculate capital gains for all investments
   */
  calculateCapitalGains(investments: Investment[]): CapitalGain[] {
    return investments.map(inv => this.calculateGainForInvestment(inv));
  }

  /**
   * Calculate capital gain for a single investment
   */
  private calculateGainForInvestment(investment: Investment): CapitalGain {
    const costBasis = this.calculateCostBasis(investment);
    const currentValue = toDecimal(investment.currentValue);
    const gain = currentValue.minus(costBasis);
    
    const purchaseDate = new Date(investment.purchaseDate || investment.createdAt);
    const today = new Date();
    const holdingDays = differenceInDays(today, purchaseDate);
    const isLongTerm = holdingDays > this.LONG_TERM_DAYS;
    
    const taxRate = this.determineCapitalGainsTaxRate(
      gain,
      isLongTerm
    );
    
    const estimatedTax = gain.greaterThan(0) 
      ? gain.times(taxRate)
      : toDecimal(0);
    
    return {
      investmentId: investment.id,
      investmentName: investment.name,
      purchaseDate,
      costBasis,
      currentValue,
      gain,
      type: isLongTerm ? 'long-term' : 'short-term',
      taxRate: taxRate * 100,
      estimatedTax
    };
  }

  /**
   * Calculate cost basis for an investment
   */
  private calculateCostBasis(investment: Investment): DecimalInstance {
    // Use provided cost basis if available
    if (investment.costBasis) {
      return toDecimal(investment.costBasis);
    }
    
    // Otherwise calculate from quantity and average cost
    if (investment.quantity && investment.averageCost) {
      return toDecimal(investment.quantity).times(investment.averageCost);
    }
    
    // Fallback to purchase price * quantity if available
    if (investment.purchasePrice && investment.quantity) {
      return toDecimal(investment.purchasePrice * investment.quantity);
    }
    
    // Default to current value (no gain)
    return toDecimal(investment.currentValue);
  }

  /**
   * Determine capital gains tax rate based on gain and holding period
   */
  private determineCapitalGainsTaxRate(
    gain: DecimalInstance,
    isLongTerm: boolean,
    income?: DecimalInstance
  ): number {
    // Simplified rate determination
    // In reality, this depends on total income
    if (isLongTerm) {
      // Long-term capital gains rates (simplified)
      // 0% for low income, 15% for most, 20% for high income
      if (income && income.lessThan(44625)) {
        return this.TAX_RATES.longTerm.low;
      } else if (income && income.greaterThan(492300)) {
        return this.TAX_RATES.longTerm.high;
      }
      return this.TAX_RATES.longTerm.medium;
    } else {
      // Short-term gains are taxed as ordinary income
      // Using middle bracket as default
      return this.TAX_RATES.shortTerm.medium;
    }
  }

  /**
   * Calculate net capital gains/losses
   */
  calculateNetGains(capitalGains: CapitalGain[]): {
    shortTermGains: DecimalInstance;
    shortTermLosses: DecimalInstance;
    longTermGains: DecimalInstance;
    longTermLosses: DecimalInstance;
    netShortTerm: DecimalInstance;
    netLongTerm: DecimalInstance;
    totalNet: DecimalInstance;
    taxableGain: DecimalInstance;
  } {
    const shortTermGains = capitalGains
      .filter(g => g.type === 'short-term' && g.gain.greaterThan(0))
      .reduce((sum, g) => sum.plus(g.gain), toDecimal(0));
    
    const shortTermLosses = capitalGains
      .filter(g => g.type === 'short-term' && g.gain.lessThan(0))
      .reduce((sum, g) => sum.plus(g.gain), toDecimal(0));
    
    const longTermGains = capitalGains
      .filter(g => g.type === 'long-term' && g.gain.greaterThan(0))
      .reduce((sum, g) => sum.plus(g.gain), toDecimal(0));
    
    const longTermLosses = capitalGains
      .filter(g => g.type === 'long-term' && g.gain.lessThan(0))
      .reduce((sum, g) => sum.plus(g.gain), toDecimal(0));
    
    const netShortTerm = shortTermGains.plus(shortTermLosses);
    const netLongTerm = longTermGains.plus(longTermLosses);
    const totalNet = netShortTerm.plus(netLongTerm);
    
    // Apply loss limitations ($3,000 per year)
    const lossLimit = toDecimal(3000);
    let taxableGain = totalNet;
    
    if (totalNet.lessThan(0) && totalNet.abs().greaterThan(lossLimit)) {
      taxableGain = lossLimit.negated();
    }
    
    return {
      shortTermGains,
      shortTermLosses,
      longTermGains,
      longTermLosses,
      netShortTerm,
      netLongTerm,
      totalNet,
      taxableGain
    };
  }

  /**
   * Identify tax-loss harvesting opportunities
   */
  identifyHarvestingOpportunities(
    investments: Investment[]
  ): Array<{
    investment: Investment;
    loss: DecimalInstance;
    daysHeld: number;
    recommendation: string;
  }> {
    const opportunities: Array<{
      investment: Investment;
      loss: DecimalInstance;
      daysHeld: number;
      recommendation: string;
    }> = [];
    
    investments.forEach(inv => {
      const gain = this.calculateGainForInvestment(inv);
      
      if (gain.gain.lessThan(0)) {
        const daysHeld = differenceInDays(
          new Date(),
          new Date(inv.purchaseDate || inv.createdAt)
        );
        
        // Check for wash sale rule (30 days)
        const recommendation = daysHeld > 30
          ? 'Safe to harvest - no wash sale risk'
          : 'Wait to avoid wash sale rule';
        
        opportunities.push({
          investment: inv,
          loss: gain.gain.abs(),
          daysHeld,
          recommendation
        });
      }
    });
    
    return opportunities.sort((a, b) => 
      b.loss.minus(a.loss).toNumber()
    );
  }

  /**
   * Calculate tax on capital gains
   */
  calculateCapitalGainsTax(
    capitalGains: CapitalGain[]
  ): {
    shortTermTax: DecimalInstance;
    longTermTax: DecimalInstance;
    totalTax: DecimalInstance;
  } {
    const shortTermTax = capitalGains
      .filter(g => g.type === 'short-term')
      .reduce((sum, g) => sum.plus(g.estimatedTax), toDecimal(0));
    
    const longTermTax = capitalGains
      .filter(g => g.type === 'long-term')
      .reduce((sum, g) => sum.plus(g.estimatedTax), toDecimal(0));
    
    return {
      shortTermTax,
      longTermTax,
      totalTax: shortTermTax.plus(longTermTax)
    };
  }

  /**
   * Generate capital gains report
   */
  generateCapitalGainsReport(
    investments: Investment[]
  ): string {
    const gains = this.calculateCapitalGains(investments);
    const netGains = this.calculateNetGains(gains);
    const tax = this.calculateCapitalGainsTax(gains);
    
    let report = 'Capital Gains Report\n';
    report += '=' .repeat(50) + '\n\n';
    
    report += 'Summary:\n';
    report += `Short-term gains: $${netGains.shortTermGains.toFixed(2)}\n`;
    report += `Short-term losses: $${netGains.shortTermLosses.toFixed(2)}\n`;
    report += `Long-term gains: $${netGains.longTermGains.toFixed(2)}\n`;
    report += `Long-term losses: $${netGains.longTermLosses.toFixed(2)}\n`;
    report += '-'.repeat(30) + '\n';
    report += `Net short-term: $${netGains.netShortTerm.toFixed(2)}\n`;
    report += `Net long-term: $${netGains.netLongTerm.toFixed(2)}\n`;
    report += `Total net gain/loss: $${netGains.totalNet.toFixed(2)}\n`;
    report += `Taxable gain/loss: $${netGains.taxableGain.toFixed(2)}\n\n`;
    
    report += 'Estimated Tax:\n';
    report += `Short-term tax: $${tax.shortTermTax.toFixed(2)}\n`;
    report += `Long-term tax: $${tax.longTermTax.toFixed(2)}\n`;
    report += `Total tax: $${tax.totalTax.toFixed(2)}\n\n`;
    
    report += 'Individual Positions:\n';
    report += '-'.repeat(50) + '\n';
    
    gains.forEach(g => {
      report += `${g.investmentName}\n`;
      report += `  Cost basis: $${g.costBasis.toFixed(2)}\n`;
      report += `  Current value: $${g.currentValue.toFixed(2)}\n`;
      report += `  Gain/loss: $${g.gain.toFixed(2)} (${g.type})\n`;
      report += `  Tax rate: ${g.taxRate.toFixed(1)}%\n`;
      report += `  Est. tax: $${g.estimatedTax.toFixed(2)}\n\n`;
    });
    
    return report;
  }
}

export const capitalGainsTracker = new CapitalGainsTracker();