import { Decimal } from 'decimal.js';
import usMortgageConstants from '../data/us-mortgage-constants-2025.json';

export interface USMortgageCalculation {
  monthlyPayment: number;
  monthlyPMI: number;
  monthlyPropertyTax: number;
  monthlyInsurance: number;
  totalMonthlyPayment: number;
  totalPayment: number;
  totalInterest: number;
  totalPMI: number;
  pmiRemovalMonth?: number;
  schedule?: Array<{
    month: number;
    payment: number;
    principal: number;
    interest: number;
    balance: number;
    pmi: number;
  }>;
}

export interface PMICalculation {
  required: boolean;
  monthlyPMI: number;
  annualPMI: number;
  totalPMI: number;
  removalMonth: number;
  removalLTV: number;
}

export interface TaxDeductionCalculation {
  mortgageInterestDeduction: number;
  propertyTaxDeduction: number;
  totalDeduction: number;
  taxSavings: number;
  effectiveRate: number;
}

export interface LoanComparison {
  loanType: string;
  downPayment: number;
  monthlyPayment: number;
  totalMonthlyPayment: number;
  totalInterest: number;
  totalCost: number;
  pros: string[];
  cons: string[];
}

class USMortgageService {
  private constants = usMortgageConstants;

  /**
   * Calculate mortgage with PMI, taxes, and insurance
   */
  calculateMortgage(
    homePrice: number,
    downPayment: number,
    interestRate: number,
    termYears: number,
    state: string = 'CA',
    loanType: 'conventional' | 'fha' | 'va' | 'usda' | 'jumbo' = 'conventional'
  ): USMortgageCalculation {
    const loanAmount = homePrice - downPayment;
    const ltv = loanAmount / homePrice;
    const monthlyRate = interestRate / 12;
    const totalPayments = termYears * 12;
    
    // Calculate base monthly payment
    const monthlyPayment = this.calculateMonthlyPayment(
      loanAmount,
      monthlyRate,
      totalPayments
    );
    
    // Calculate PMI if needed
    const pmiCalc = this.calculatePMI(homePrice, downPayment, loanType);
    
    // Calculate property tax
    const propertyTaxRate = this.constants.propertyTax.byState[state as keyof typeof this.constants.propertyTax.byState] 
      || this.constants.propertyTax.nationalAverage;
    const monthlyPropertyTax = (homePrice * propertyTaxRate) / 12;
    
    // Calculate homeowners insurance
    const monthlyInsurance = this.constants.homeownersInsurance.nationalAverage / 12;
    
    // Total monthly payment (PITI)
    const totalMonthlyPayment = monthlyPayment + pmiCalc.monthlyPMI + monthlyPropertyTax + monthlyInsurance;
    
    // Calculate totals
    const totalPayment = new Decimal(monthlyPayment).mul(totalPayments).toNumber();
    const totalInterest = totalPayment - loanAmount;
    
    return {
      monthlyPayment,
      monthlyPMI: pmiCalc.monthlyPMI,
      monthlyPropertyTax,
      monthlyInsurance,
      totalMonthlyPayment,
      totalPayment,
      totalInterest,
      totalPMI: pmiCalc.totalPMI,
      pmiRemovalMonth: pmiCalc.removalMonth
    };
  }

  /**
   * Calculate PMI based on loan type and LTV
   */
  calculatePMI(
    homePrice: number,
    downPayment: number,
    loanType: 'conventional' | 'fha' | 'va' | 'usda' | 'jumbo' = 'conventional'
  ): PMICalculation {
    const loanAmount = homePrice - downPayment;
    const ltv = (loanAmount / homePrice) * 100;
    
    // VA loans don't have PMI
    if (loanType === 'va') {
      return {
        required: false,
        monthlyPMI: 0,
        annualPMI: 0,
        totalPMI: 0,
        removalMonth: 0,
        removalLTV: 0
      };
    }
    
    // FHA loans have MIP
    if (loanType === 'fha') {
      const mipRate = ltv > 95 
        ? this.constants.loanTypes.fha.mip.annual.ltv95Plus 
        : this.constants.loanTypes.fha.mip.annual.ltv95Less;
      
      const monthlyMIP = (loanAmount * mipRate) / 12;
      const upfrontMIP = loanAmount * this.constants.loanTypes.fha.mip.upfront;
      
      return {
        required: true,
        monthlyPMI: monthlyMIP,
        annualPMI: monthlyMIP * 12,
        totalPMI: upfrontMIP + (monthlyMIP * 12 * 11), // FHA MIP typically for 11 years
        removalMonth: 132, // 11 years
        removalLTV: 78
      };
    }
    
    // Conventional loans
    if (ltv <= 80) {
      return {
        required: false,
        monthlyPMI: 0,
        annualPMI: 0,
        totalPMI: 0,
        removalMonth: 0,
        removalLTV: 80
      };
    }
    
    // Find PMI rate based on LTV
    let pmiRate = 0.0085; // Default high rate
    for (const bracket of this.constants.pmi.conventional.rates) {
      if (ltv >= bracket.ltv.min && ltv <= bracket.ltv.max) {
        pmiRate = bracket.rate;
        break;
      }
    }
    
    const monthlyPMI = (loanAmount * pmiRate) / 12;
    
    // Calculate when PMI can be removed (78% LTV)
    const targetBalance = homePrice * 0.78;
    const monthsToRemoval = this.calculateMonthsToBalance(
      loanAmount,
      targetBalance,
      0.05 / 12, // Assume 5% rate for calculation
      360
    );
    
    const totalPMI = monthlyPMI * monthsToRemoval;
    
    return {
      required: true,
      monthlyPMI,
      annualPMI: monthlyPMI * 12,
      totalPMI,
      removalMonth: monthsToRemoval,
      removalLTV: 78
    };
  }

  /**
   * Calculate tax benefits from mortgage interest and property tax deductions
   */
  calculateTaxBenefits(
    loanAmount: number,
    interestRate: number,
    propertyTax: number,
    marginalTaxRate: number = 0.24,
    filingStatus: 'single' | 'married' = 'married'
  ): TaxDeductionCalculation {
    // First year interest (approximate)
    const firstYearInterest = loanAmount * interestRate;
    
    // Check if loan exceeds deduction limit
    const deductionLimit = this.constants.taxBenefits.mortgageInterestDeduction.limit;
    const deductibleInterest = Math.min(firstYearInterest, deductionLimit * interestRate);
    
    // Property tax deduction (part of SALT limit)
    const saltLimit = this.constants.taxBenefits.saltDeduction.limit;
    const deductiblePropertyTax = Math.min(propertyTax, saltLimit);
    
    const totalDeduction = deductibleInterest + deductiblePropertyTax;
    const taxSavings = totalDeduction * marginalTaxRate;
    
    // Calculate effective interest rate after tax benefit
    const effectiveRate = interestRate * (1 - marginalTaxRate);
    
    return {
      mortgageInterestDeduction: deductibleInterest,
      propertyTaxDeduction: deductiblePropertyTax,
      totalDeduction,
      taxSavings,
      effectiveRate
    };
  }

  /**
   * Compare different loan types
   */
  compareLoanTypes(
    homePrice: number,
    availableDownPayment: number,
    creditScore: number = 700,
    isVeteran: boolean = false,
    state: string = 'CA'
  ): LoanComparison[] {
    const comparisons: LoanComparison[] = [];
    
    // Conventional loan
    const conventionalDown = Math.max(availableDownPayment, homePrice * 0.03);
    const conventional = this.calculateMortgage(
      homePrice,
      conventionalDown,
      this.constants.currentRates.average30Year,
      30,
      state,
      'conventional'
    );
    
    comparisons.push({
      loanType: 'Conventional 30-Year',
      downPayment: conventionalDown,
      monthlyPayment: conventional.monthlyPayment,
      totalMonthlyPayment: conventional.totalMonthlyPayment,
      totalInterest: conventional.totalInterest,
      totalCost: conventional.totalPayment + conventional.totalPMI,
      pros: [
        'Competitive rates with good credit',
        'PMI removable at 80% LTV',
        'Flexible terms',
        'Wide availability'
      ],
      cons: [
        'Requires PMI if less than 20% down',
        'Higher credit score requirements',
        'Strict debt-to-income requirements'
      ]
    });
    
    // FHA loan
    if (creditScore >= 580) {
      const fhaDown = Math.max(availableDownPayment, homePrice * 0.035);
      const fha = this.calculateMortgage(
        homePrice,
        fhaDown,
        this.constants.currentRates.averageFHA30,
        30,
        state,
        'fha'
      );
      
      comparisons.push({
        loanType: 'FHA 30-Year',
        downPayment: fhaDown,
        monthlyPayment: fha.monthlyPayment,
        totalMonthlyPayment: fha.totalMonthlyPayment,
        totalInterest: fha.totalInterest,
        totalCost: fha.totalPayment + fha.totalPMI,
        pros: [
          'Low down payment (3.5%)',
          'Lower credit score requirements',
          'More flexible on debt-to-income',
          'Assumable loan'
        ],
        cons: [
          'MIP for life of loan (if <10% down)',
          'Upfront MIP of 1.75%',
          'Loan limits based on area',
          'Property must be primary residence'
        ]
      });
    }
    
    // VA loan
    if (isVeteran) {
      const va = this.calculateMortgage(
        homePrice,
        0, // No down payment required
        this.constants.currentRates.averageVA30,
        30,
        state,
        'va'
      );
      
      comparisons.push({
        loanType: 'VA 30-Year',
        downPayment: 0,
        monthlyPayment: va.monthlyPayment,
        totalMonthlyPayment: va.totalMonthlyPayment,
        totalInterest: va.totalInterest,
        totalCost: va.totalPayment,
        pros: [
          'No down payment required',
          'No PMI',
          'Competitive interest rates',
          'No prepayment penalties',
          'Assumable loan'
        ],
        cons: [
          'VA funding fee (can be financed)',
          'Must be veteran/active military',
          'Property must be primary residence',
          'VA appraisal required'
        ]
      });
    }
    
    // 15-year conventional
    const conventional15Down = Math.max(availableDownPayment, homePrice * 0.20);
    const conventional15 = this.calculateMortgage(
      homePrice,
      conventional15Down,
      this.constants.currentRates.average15Year,
      15,
      state,
      'conventional'
    );
    
    comparisons.push({
      loanType: 'Conventional 15-Year',
      downPayment: conventional15Down,
      monthlyPayment: conventional15.monthlyPayment,
      totalMonthlyPayment: conventional15.totalMonthlyPayment,
      totalInterest: conventional15.totalInterest,
      totalCost: conventional15.totalPayment,
      pros: [
        'Much less total interest',
        'Build equity faster',
        'Lower interest rate',
        'Pay off mortgage sooner'
      ],
      cons: [
        'Higher monthly payments',
        'Less monthly cash flow',
        'Harder to qualify',
        'Less tax deduction benefit'
      ]
    });
    
    return comparisons;
  }

  /**
   * Calculate closing costs
   */
  calculateClosingCosts(
    homePrice: number,
    loanAmount: number,
    state: string = 'CA'
  ): {
    total: number;
    breakdown: Array<{ item: string; amount: number }>;
  } {
    const costs = this.constants.closingCosts;
    const breakdown: Array<{ item: string; amount: number }> = [];
    
    // Fixed costs
    Object.entries(costs.components).forEach(([item, amount]) => {
      breakdown.push({ 
        item: item.replace(/([A-Z])/g, ' $1').trim(), 
        amount: amount as number 
      });
    });
    
    // Percentage-based costs
    const loanOriginationFee = loanAmount * 0.01; // 1% typical
    breakdown.push({ item: 'Loan Origination Fee', amount: loanOriginationFee });
    
    // State-specific transfer taxes
    const transferTax = homePrice * 0.001; // Varies by state
    breakdown.push({ item: 'Transfer Tax', amount: transferTax });
    
    // Prepaid items (estimate)
    const prepaidInterest = (loanAmount * 0.05 / 365) * 15; // 15 days
    breakdown.push({ item: 'Prepaid Interest', amount: prepaidInterest });
    
    const prepaidPropertyTax = (homePrice * this.constants.propertyTax.byState[state as keyof typeof this.constants.propertyTax.byState] || 0.01) / 12 * 6;
    breakdown.push({ item: 'Prepaid Property Tax (6 months)', amount: prepaidPropertyTax });
    
    const prepaidInsurance = this.constants.homeownersInsurance.nationalAverage;
    breakdown.push({ item: 'Prepaid Insurance (1 year)', amount: prepaidInsurance });
    
    const total = breakdown.reduce((sum, item) => sum + item.amount, 0);
    
    return { total, breakdown };
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
   * Helper: Calculate months to reach target balance
   */
  private calculateMonthsToBalance(
    currentBalance: number,
    targetBalance: number,
    monthlyRate: number,
    totalPayments: number
  ): number {
    const payment = this.calculateMonthlyPayment(currentBalance, monthlyRate, totalPayments);
    let balance = currentBalance;
    let months = 0;
    
    while (balance > targetBalance && months < totalPayments) {
      const interestPayment = balance * monthlyRate;
      const principalPayment = payment - interestPayment;
      balance -= principalPayment;
      months++;
    }
    
    return months;
  }

  /**
   * Calculate rent vs buy comparison
   */
  rentVsBuy(
    homePrice: number,
    downPayment: number,
    monthlyRent: number,
    yearsToStay: number = 5,
    homeAppreciation: number = 0.03,
    rentIncrease: number = 0.03,
    state: string = 'CA'
  ): {
    totalRentCost: number;
    totalBuyCost: number;
    homeEquity: number;
    recommendation: string;
    breakEvenYear: number;
  } {
    // Calculate buying costs
    const mortgage = this.calculateMortgage(homePrice, downPayment, 0.065, 30, state);
    const closingCosts = this.calculateClosingCosts(homePrice, homePrice - downPayment, state);
    
    let totalBuyCost = downPayment + closingCosts.total;
    let totalRentCost = 0;
    let homeEquity = downPayment;
    let breakEvenYear = 0;
    
    for (let year = 1; year <= yearsToStay; year++) {
      // Rent costs
      const yearlyRent = monthlyRent * 12 * Math.pow(1 + rentIncrease, year - 1);
      totalRentCost += yearlyRent;
      
      // Buy costs
      const yearlyPayments = mortgage.totalMonthlyPayment * 12;
      totalBuyCost += yearlyPayments;
      
      // Home appreciation
      const homeValue = homePrice * Math.pow(1 + homeAppreciation, year);
      const remainingBalance = this.calculateRemainingBalance(
        homePrice - downPayment,
        0.065 / 12,
        360,
        year * 12
      );
      homeEquity = homeValue - remainingBalance;
      
      // Check break-even
      if (breakEvenYear === 0 && totalBuyCost - homeEquity <= totalRentCost) {
        breakEvenYear = year;
      }
    }
    
    const netBuyCost = totalBuyCost - homeEquity;
    
    return {
      totalRentCost,
      totalBuyCost: netBuyCost,
      homeEquity,
      recommendation: netBuyCost < totalRentCost 
        ? `Buying saves ${(totalRentCost - netBuyCost).toLocaleString()} over ${yearsToStay} years`
        : `Renting saves ${(netBuyCost - totalRentCost).toLocaleString()} over ${yearsToStay} years`,
      breakEvenYear
    };
  }

  /**
   * Helper: Calculate remaining balance
   */
  private calculateRemainingBalance(
    initialBalance: number,
    monthlyRate: number,
    totalPayments: number,
    paymentsMade: number
  ): number {
    const payment = this.calculateMonthlyPayment(initialBalance, monthlyRate, totalPayments);
    let balance = initialBalance;
    
    for (let i = 0; i < paymentsMade; i++) {
      const interestPayment = balance * monthlyRate;
      const principalPayment = payment - interestPayment;
      balance -= principalPayment;
    }
    
    return balance;
  }
}

export const usMortgageService = new USMortgageService();