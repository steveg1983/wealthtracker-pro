import { Decimal } from 'decimal.js';
import ukMortgageConstants from '../data/uk-mortgage-constants-2025.json';

export interface UKMortgageCalculation {
  monthlyPayment: number;
  totalPayment: number;
  totalInterest: number;
  affordabilityCheck: {
    passed: boolean;
    maxLoan: number;
    stressTestedRate: number;
    stressTestedPayment: number;
  };
  // Two-tier rate support
  initialPeriod?: {
    rate: number;
    years: number;
    monthlyPayment: number;
    totalPayments: number;
    totalInterest: number;
  };
  subsequentPeriod?: {
    rate: number;
    years: number;
    monthlyPayment: number;
    totalPayments: number;
    totalInterest: number;
  };
  schedule?: Array<{
    month: number;
    payment: number;
    principal: number;
    interest: number;
    balance: number;
    period: 'initial' | 'subsequent';
  }>;
}

export interface StampDutyCalculation {
  propertyPrice: number;
  stampDuty: number;
  effectiveRate: number;
  breakdown: Array<{
    band: string;
    amount: number;
    rate: number;
  }>;
  firstTimeBuyer: boolean;
  additionalProperty: boolean;
  region: 'england' | 'scotland' | 'wales';
}

export interface HelpToBuyCalculation {
  equityLoan: number;
  deposit: number;
  mortgage: number;
  monthlyMortgagePayment: number;
  year6Interest: number;
  totalCost: number;
}

class UKMortgageService {
  private constants = ukMortgageConstants;

  /**
   * Calculate monthly mortgage payment using UK method
   */
  calculateMortgage(
    loanAmount: number,
    interestRate: number,
    termYears: number,
    mortgageType: 'fixed' | 'variable' | 'tracker' = 'fixed',
    fixedTermYears?: number
  ): UKMortgageCalculation {
    const monthlyRate = new Decimal(interestRate).div(12);
    const totalPayments = termYears * 12;
    
    // Calculate monthly payment
    const monthlyPayment = this.calculateMonthlyPayment(
      loanAmount,
      monthlyRate.toNumber(),
      totalPayments
    );
    
    const totalPayment = new Decimal(monthlyPayment).mul(totalPayments).toNumber();
    const totalInterest = new Decimal(totalPayment).minus(loanAmount).toNumber();
    
    // Affordability stress test
    const stressTestedRate = interestRate + this.constants.affordability.stressTest.rate;
    const stressTestedPayment = this.calculateMonthlyPayment(
      loanAmount,
      stressTestedRate / 12,
      totalPayments
    );
    
    return {
      monthlyPayment,
      totalPayment,
      totalInterest,
      affordabilityCheck: {
        passed: true, // Would need income to properly check
        maxLoan: 0, // Would need income to calculate
        stressTestedRate,
        stressTestedPayment
      }
    };
  }

  /**
   * Calculate two-tier mortgage (e.g., fixed then variable)
   */
  calculateTwoTierMortgage(
    loanAmount: number,
    initialRate: number,
    initialYears: number,
    subsequentRate: number,
    totalTermYears: number
  ): UKMortgageCalculation {
    const subsequentYears = totalTermYears - initialYears;
    
    // Initial fixed period calculation
    const initialMonthlyRate = initialRate / 12;
    const totalPayments = totalTermYears * 12;
    const initialPayments = initialYears * 12;
    const subsequentPayments = subsequentYears * 12;
    
    // Calculate payment for initial period (based on full term)
    const initialMonthlyPayment = this.calculateMonthlyPayment(
      loanAmount,
      initialMonthlyRate,
      totalPayments
    );
    
    // Calculate balance after initial period
    let remainingBalance = loanAmount;
    let initialTotalInterest = 0;
    
    for (let month = 1; month <= initialPayments; month++) {
      const interestPayment = remainingBalance * initialMonthlyRate;
      const principalPayment = initialMonthlyPayment - interestPayment;
      remainingBalance -= principalPayment;
      initialTotalInterest += interestPayment;
    }
    
    // Calculate payment for subsequent period
    const subsequentMonthlyRate = subsequentRate / 12;
    const subsequentMonthlyPayment = this.calculateMonthlyPayment(
      remainingBalance,
      subsequentMonthlyRate,
      subsequentPayments
    );
    
    // Calculate total interest for subsequent period
    let subsequentTotalInterest = 0;
    let tempBalance = remainingBalance;
    
    for (let month = 1; month <= subsequentPayments; month++) {
      const interestPayment = tempBalance * subsequentMonthlyRate;
      const principalPayment = subsequentMonthlyPayment - interestPayment;
      tempBalance -= principalPayment;
      subsequentTotalInterest += interestPayment;
    }
    
    // Calculate overall totals
    const totalInterest = initialTotalInterest + subsequentTotalInterest;
    const totalPayment = (initialMonthlyPayment * initialPayments) + 
                        (subsequentMonthlyPayment * subsequentPayments);
    
    // Weighted average monthly payment
    const averageMonthlyPayment = totalPayment / totalPayments;
    
    // Affordability stress test
    const stressTestedRate = Math.max(initialRate, subsequentRate) + this.constants.affordability.stressTest.rate;
    const stressTestedPayment = this.calculateMonthlyPayment(
      loanAmount,
      stressTestedRate / 12,
      totalPayments
    );
    
    return {
      monthlyPayment: averageMonthlyPayment,
      totalPayment,
      totalInterest,
      affordabilityCheck: {
        passed: true,
        maxLoan: 0,
        stressTestedRate,
        stressTestedPayment
      },
      initialPeriod: {
        rate: initialRate,
        years: initialYears,
        monthlyPayment: initialMonthlyPayment,
        totalPayments: initialMonthlyPayment * initialPayments,
        totalInterest: initialTotalInterest
      },
      subsequentPeriod: {
        rate: subsequentRate,
        years: subsequentYears,
        monthlyPayment: subsequentMonthlyPayment,
        totalPayments: subsequentMonthlyPayment * subsequentPayments,
        totalInterest: subsequentTotalInterest
      }
    };
  }

  /**
   * Calculate stamp duty based on region and circumstances
   */
  calculateStampDuty(
    propertyPrice: number,
    region: 'england' | 'scotland' | 'wales' = 'england',
    firstTimeBuyer: boolean = false,
    additionalProperty: boolean = false
  ): StampDutyCalculation {
    const regionalData = this.constants.stampDuty[region];
    const thresholds = regionalData.residential.thresholds;
    let totalTax = 0;
    const breakdown: Array<{ band: string; amount: number; rate: number }> = [];
    
    // Handle first-time buyer relief
    if (firstTimeBuyer && region === 'england') {
      const ftbData = regionalData.residential.firstTimeBuyer;
      if (propertyPrice <= ftbData.reliefThreshold) {
        return {
          propertyPrice,
          stampDuty: 0,
          effectiveRate: 0,
          breakdown: [{ band: '£0 - £425,000', amount: 0, rate: 0 }],
          firstTimeBuyer,
          additionalProperty,
          region
        };
      } else if (propertyPrice <= ftbData.zeroRateThreshold) {
        const taxableAmount = propertyPrice - ftbData.reliefThreshold;
        totalTax = taxableAmount * 0.05;
        breakdown.push({ 
          band: `£425,001 - £${propertyPrice.toLocaleString()}`, 
          amount: totalTax, 
          rate: 0.05 
        });
        return {
          propertyPrice,
          stampDuty: totalTax,
          effectiveRate: totalTax / propertyPrice,
          breakdown,
          firstTimeBuyer,
          additionalProperty,
          region
        };
      }
    }
    
    // Calculate standard stamp duty
    for (const threshold of thresholds) {
      const min = threshold.min;
      const max = threshold.max || propertyPrice;
      const rate = threshold.rate;
      
      if (propertyPrice > min) {
        const taxableAmount = Math.min(propertyPrice, max) - min;
        const tax = new Decimal(taxableAmount).mul(rate).toNumber();
        
        if (tax > 0) {
          breakdown.push({
            band: `£${min.toLocaleString()} - £${max.toLocaleString()}`,
            amount: tax,
            rate
          });
          totalTax += tax;
        }
      }
    }
    
    // Add surcharge for additional properties
    if (additionalProperty) {
      const surcharge = new Decimal(propertyPrice)
        .mul(regionalData.additionalProperty.surcharge)
        .toNumber();
      totalTax += surcharge;
      breakdown.push({
        band: 'Additional Property Surcharge',
        amount: surcharge,
        rate: regionalData.additionalProperty.surcharge
      });
    }
    
    return {
      propertyPrice,
      stampDuty: totalTax,
      effectiveRate: totalTax / propertyPrice,
      breakdown,
      firstTimeBuyer,
      additionalProperty,
      region
    };
  }

  /**
   * Calculate Help to Buy equity loan
   */
  calculateHelpToBuy(
    propertyPrice: number,
    depositAmount: number,
    isLondon: boolean = false
  ): HelpToBuyCalculation {
    const htb = this.constants.helpToBuy.equityLoan;
    
    // Check eligibility
    if (propertyPrice > htb.maxPropertyPrice) {
      throw new Error(`Property price exceeds maximum of £${htb.maxPropertyPrice}`);
    }
    
    const depositPercent = depositAmount / propertyPrice;
    if (depositPercent < htb.minDeposit) {
      throw new Error('Minimum deposit is 5%');
    }
    
    // Calculate equity loan
    const maxLoanPercent = isLondon ? htb.londonMaxLoanPercent : htb.maxLoanPercent;
    const equityLoan = propertyPrice * maxLoanPercent;
    
    // Calculate mortgage needed
    const mortgage = propertyPrice - depositAmount - equityLoan;
    
    // Estimate monthly mortgage payment (assuming 4% rate, 25 years)
    const monthlyMortgagePayment = this.calculateMonthlyPayment(
      mortgage,
      0.04 / 12,
      25 * 12
    );
    
    // Calculate year 6 interest on equity loan
    const year6Interest = new Decimal(equityLoan)
      .mul(htb.year6Rate)
      .div(12)
      .toNumber();
    
    // Total cost over 25 years (simplified)
    const totalMortgageCost = monthlyMortgagePayment * 25 * 12;
    const totalEquityLoanInterest = year6Interest * 12 * 20; // 20 years of interest
    const totalCost = totalMortgageCost + equityLoan + totalEquityLoanInterest;
    
    return {
      equityLoan,
      deposit: depositAmount,
      mortgage,
      monthlyMortgagePayment,
      year6Interest,
      totalCost
    };
  }

  /**
   * Calculate maximum affordable loan based on income
   */
  calculateAffordability(
    annualIncome: number,
    monthlyExpenses: number = 0,
    existingMonthlyDebt: number = 0
  ): {
    maxLoan: number;
    maxMonthlyPayment: number;
    loanToIncome: number;
  } {
    // Apply loan-to-income ratio
    const maxLoanByIncome = annualIncome * this.constants.affordability.maxLTI;
    
    // Calculate max monthly payment (typically 35% of gross monthly income minus expenses)
    const monthlyIncome = annualIncome / 12;
    const maxMonthlyPayment = (monthlyIncome * 0.35) - monthlyExpenses - existingMonthlyDebt;
    
    // Calculate max loan based on monthly payment (assuming 4% rate, 25 years)
    const maxLoanByPayment = this.calculateLoanAmount(
      maxMonthlyPayment,
      0.04 / 12,
      25 * 12
    );
    
    // Take the lower of the two
    const maxLoan = Math.min(maxLoanByIncome, maxLoanByPayment);
    
    return {
      maxLoan,
      maxMonthlyPayment,
      loanToIncome: maxLoan / annualIncome
    };
  }

  /**
   * Helper: Calculate monthly payment
   */
  private calculateMonthlyPayment(
    principal: number,
    monthlyRate: number,
    totalPayments: number
  ): number {
    if (monthlyRate === 0) {
      return principal / totalPayments;
    }
    
    const rate = new Decimal(monthlyRate);
    const n = totalPayments;
    const factor = rate.mul(rate.plus(1).pow(n)).div(rate.plus(1).pow(n).minus(1));
    
    return new Decimal(principal).mul(factor).toNumber();
  }

  /**
   * Helper: Calculate loan amount from payment
   */
  private calculateLoanAmount(
    monthlyPayment: number,
    monthlyRate: number,
    totalPayments: number
  ): number {
    if (monthlyRate === 0) {
      return monthlyPayment * totalPayments;
    }
    
    const rate = new Decimal(monthlyRate);
    const n = totalPayments;
    const factor = rate.plus(1).pow(n).minus(1).div(rate.mul(rate.plus(1).pow(n)));
    
    return new Decimal(monthlyPayment).mul(factor).toNumber();
  }

  /**
   * Compare different mortgage types
   */
  compareMortgageTypes(
    loanAmount: number,
    termYears: number
  ): Array<{
    type: string;
    rate: number;
    monthlyPayment: number;
    totalInterest: number;
    pros: string[];
    cons: string[];
  }> {
    const rates = this.constants.currentRates;
    const comparisons = [];
    
    // 2-year fixed
    const twoYear = this.calculateMortgage(loanAmount, rates.typical2Year, termYears, 'fixed', 2);
    comparisons.push({
      type: '2-Year Fixed',
      rate: rates.typical2Year,
      monthlyPayment: twoYear.monthlyPayment,
      totalInterest: twoYear.totalInterest,
      pros: ['Payment certainty for 2 years', 'Lower initial rate', 'Good for short-term'],
      cons: ['Need to remortgage soon', 'Rates may rise after fixed period']
    });
    
    // 5-year fixed
    const fiveYear = this.calculateMortgage(loanAmount, rates.typical5Year, termYears, 'fixed', 5);
    comparisons.push({
      type: '5-Year Fixed',
      rate: rates.typical5Year,
      monthlyPayment: fiveYear.monthlyPayment,
      totalInterest: fiveYear.totalInterest,
      pros: ['Longer payment certainty', 'Protection from rate rises', 'Peace of mind'],
      cons: ['Higher initial rate', 'Early repayment charges', 'Locked in if rates fall']
    });
    
    // Tracker
    const tracker = this.calculateMortgage(loanAmount, rates.typicalTracker, termYears, 'tracker');
    comparisons.push({
      type: 'Tracker (Base + 1%)',
      rate: rates.typicalTracker,
      monthlyPayment: tracker.monthlyPayment,
      totalInterest: tracker.totalInterest,
      pros: ['Follows Bank of England rate', 'Benefits if rates fall', 'Often no early repayment charges'],
      cons: ['Payments increase if rates rise', 'No payment certainty', 'Budget uncertainty']
    });
    
    // Standard Variable Rate
    const svr = this.calculateMortgage(loanAmount, rates.typicalSVR, termYears, 'variable');
    comparisons.push({
      type: 'Standard Variable',
      rate: rates.typicalSVR,
      monthlyPayment: svr.monthlyPayment,
      totalInterest: svr.totalInterest,
      pros: ['No early repayment charges', 'Flexibility to leave anytime'],
      cons: ['Highest rate', 'Lender can change rate anytime', 'Most expensive option']
    });
    
    return comparisons;
  }

  /**
   * Calculate comprehensive mortgage costs including all fees
   */
  calculateTotalMortgageCosts(
    propertyPrice: number,
    deposit: number,
    interestRate: number,
    termYears: number,
    region: 'england' | 'scotland' | 'wales' = 'england',
    firstTimeBuyer: boolean = false,
    additionalProperty: boolean = false,
    arrangementFee: number = 999
  ): {
    mortgage: UKMortgageCalculation;
    stampDuty: StampDutyCalculation;
    fees: {
      arrangement: number;
      valuation: number;
      legal: number;
      broker: number;
      total: number;
    };
    totalCashRequired: number;
    totalCostOfOwnership: number;
  } {
    const loanAmount = propertyPrice - deposit;
    
    // Calculate mortgage
    const mortgage = this.calculateMortgage(loanAmount, interestRate, termYears);
    
    // Calculate stamp duty
    const stampDuty = this.calculateStampDuty(propertyPrice, region, firstTimeBuyer, additionalProperty);
    
    // Calculate fees
    const fees = {
      arrangement: arrangementFee,
      valuation: this.constants.fees.valuation.homebuyers,
      legal: this.constants.fees.legal.solicitor + this.constants.fees.legal.searches + this.constants.fees.legal.landRegistry,
      broker: this.constants.fees.broker.typical,
      total: 0
    };
    fees.total = fees.arrangement + fees.valuation + fees.legal + fees.broker;
    
    // Total cash required upfront
    const totalCashRequired = deposit + stampDuty.stampDuty + fees.total;
    
    // Total cost of ownership over full term
    const totalCostOfOwnership = totalCashRequired + mortgage.totalInterest;
    
    return {
      mortgage,
      stampDuty,
      fees,
      totalCashRequired,
      totalCostOfOwnership
    };
  }
}

export const ukMortgageService = new UKMortgageService();