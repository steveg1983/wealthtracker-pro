import { Decimal } from 'decimal.js';
import usRetirementConstants from '../data/us-retirement-constants-2025.json';
import { taxDataService } from './taxDataService';

export interface SocialSecurityCalculation {
  monthlyBenefit: number;
  annualBenefit: number;
  fullRetirementAge: number;
  claimingAge: number;
  reduction: number; // Percentage reduction if claiming early
  credits: number; // Number of quarters earned
  eligible: boolean;
  breakEvenAge?: number; // Age where early claiming catches up to FRA
}

export interface Retirement401kCalculation {
  employeeContribution: number;
  employerMatch: number;
  totalMonthlyContribution: number;
  annualContribution: number;
  projectedBalance: number;
  vestedAmount: number;
  taxDeferred: number;
  catchUpEligible: boolean;
  catchUpAmount?: number;
}

export interface IRACalculation {
  type: 'traditional' | 'roth';
  monthlyContribution: number;
  annualContribution: number;
  taxBenefit: number; // Deduction for traditional, or tax-free growth for Roth
  projectedBalance: number;
  deductible: boolean; // For traditional IRA
  phaseOut?: { // Income phase-out status
    percentage: number;
    reduced: boolean;
  };
}

export interface MedicareEstimate {
  eligibilityAge: number;
  partAPremium: number;
  partBPremium: number;
  partDPremium: number;
  totalMonthlyPremium: number;
  irmaaApplies: boolean; // Income-related adjustment
  adjustedPremium?: number;
}

export interface USRetirementProjection {
  socialSecurity: SocialSecurityCalculation;
  retirement401k?: Retirement401kCalculation;
  traditionalIRA?: IRACalculation;
  rothIRA?: IRACalculation;
  medicare: MedicareEstimate;
  totalRetirementIncome: {
    annual: number;
    monthly: number;
    afterTax: number;
  };
  requiredMinimumDistribution?: {
    age: number;
    amount: number;
    penalty: number;
  };
}

class USRetirementService {
  private constants = usRetirementConstants;

  /**
   * Calculate Social Security benefits based on claiming age
   */
  calculateSocialSecurity(
    averageIndexedMonthlyEarnings: number, // AIME
    birthYear: number,
    claimingAge: number,
    yearsWorked: number = 35
  ): SocialSecurityCalculation {
    // Calculate quarters of coverage
    const credits = Math.min(yearsWorked * 4, 40);
    const eligible = credits >= this.constants.socialSecurity.quarters.minimumCredits;
    
    if (!eligible) {
      return {
        monthlyBenefit: 0,
        annualBenefit: 0,
        fullRetirementAge: this.getFullRetirementAge(birthYear),
        claimingAge,
        reduction: 0,
        credits,
        eligible: false
      };
    }
    
    // Calculate Primary Insurance Amount (PIA) using bend points
    // 2025 bend points: $1,174 and $7,078
    const bendPoint1 = 1174;
    const bendPoint2 = 7078;
    
    let pia = 0;
    if (averageIndexedMonthlyEarnings <= bendPoint1) {
      pia = averageIndexedMonthlyEarnings * 0.90;
    } else if (averageIndexedMonthlyEarnings <= bendPoint2) {
      pia = bendPoint1 * 0.90 + (averageIndexedMonthlyEarnings - bendPoint1) * 0.32;
    } else {
      pia = bendPoint1 * 0.90 + (bendPoint2 - bendPoint1) * 0.32 + 
            (averageIndexedMonthlyEarnings - bendPoint2) * 0.15;
    }
    
    // Apply adjustments based on claiming age
    const fra = this.getFullRetirementAge(birthYear);
    let monthlyBenefit = pia;
    let reduction = 0;
    
    if (claimingAge < fra) {
      // Early retirement reduction
      const monthsEarly = (fra - claimingAge) * 12;
      if (monthsEarly <= 36) {
        reduction = monthsEarly * this.constants.socialSecurity.earlyRetirement.reductionPerMonth;
      } else {
        reduction = 36 * this.constants.socialSecurity.earlyRetirement.reductionPerMonth +
                   (monthsEarly - 36) * this.constants.socialSecurity.earlyRetirement.additionalReductionPerMonth;
      }
      monthlyBenefit = pia * (1 - reduction);
    } else if (claimingAge > fra) {
      // Delayed retirement credits
      const monthsDelayed = Math.min((claimingAge - fra) * 12, (70 - fra) * 12);
      const increase = monthsDelayed * this.constants.socialSecurity.delayedRetirement.creditPerMonth;
      monthlyBenefit = pia * (1 + increase);
    }
    
    // Apply COLA adjustment
    monthlyBenefit = monthlyBenefit * (1 + this.constants.socialSecurity.cola2025);
    
    // Calculate break-even age for early claiming
    let breakEvenAge;
    if (claimingAge < fra) {
      const earlyMonthly = monthlyBenefit;
      const fraMonthly = pia * (1 + this.constants.socialSecurity.cola2025);
      const monthsEarly = (fra - claimingAge) * 12;
      const totalEarlyBeforeFRA = earlyMonthly * monthsEarly;
      const monthlyDifference = fraMonthly - earlyMonthly;
      const monthsToBreakEven = totalEarlyBeforeFRA / monthlyDifference;
      breakEvenAge = fra + (monthsToBreakEven / 12);
    }
    
    return {
      monthlyBenefit: Math.min(monthlyBenefit, this.constants.socialSecurity.maximumBenefit.at70),
      annualBenefit: monthlyBenefit * 12,
      fullRetirementAge: fra,
      claimingAge,
      reduction,
      credits,
      eligible: true,
      breakEvenAge
    };
  }

  /**
   * Get Full Retirement Age based on birth year
   */
  private getFullRetirementAge(birthYear: number): number {
    const ages = this.constants.socialSecurity.fullRetirementAge;
    
    if (birthYear <= 1954) return ages.born1943to1954;
    if (birthYear === 1955) return ages.born1955;
    if (birthYear === 1956) return ages.born1956;
    if (birthYear === 1957) return ages.born1957;
    if (birthYear === 1958) return ages.born1958;
    if (birthYear === 1959) return ages.born1959;
    return ages.born1960OrLater;
  }

  /**
   * Calculate 401(k) contributions and projections
   */
  calculate401k(
    annualSalary: number,
    employeeContributionRate: number,
    employerMatchRate: number,
    employerMatchLimit: number, // e.g., 0.06 for "up to 6%"
    currentAge: number,
    retirementAge: number,
    currentBalance: number = 0,
    yearsOfService: number = 0,
    growthRate: number = 0.07
  ): Retirement401kCalculation {
    const limits = this.constants.retirement401k.contributionLimits;
    
    // Determine catch-up eligibility and amount
    let catchUpEligible = currentAge >= 50;
    let catchUpAmount = 0;
    let employeeLimit = limits.employee.regular;
    
    if (catchUpEligible) {
      if (currentAge >= 60 && currentAge <= 63) {
        catchUpAmount = limits.employee.catchUp60to63;
        employeeLimit = limits.employee.total60to63;
      } else {
        catchUpAmount = limits.employee.catchUp50to59;
        employeeLimit = limits.employee.total50to59;
      }
    }
    
    // Calculate contributions
    const employeeContribution = Math.min(
      annualSalary * employeeContributionRate,
      employeeLimit
    );
    
    // Calculate employer match (typically matches up to a certain percentage)
    const eligibleForMatch = Math.min(
      annualSalary * employeeContributionRate,
      annualSalary * employerMatchLimit
    );
    const employerMatch = eligibleForMatch * employerMatchRate;
    
    // Check combined limit
    const totalAnnualContribution = Math.min(
      employeeContribution + employerMatch,
      catchUpEligible ? 
        (currentAge >= 60 && currentAge <= 63 ? limits.combined.withCatchUp60to63 : limits.combined.withCatchUp50to59) :
        limits.combined.regular
    );
    
    const monthlyContribution = totalAnnualContribution / 12;
    
    // Calculate vesting
    const vestedAmount = this.calculateVesting(currentBalance, employerMatch, yearsOfService);
    
    // Project future value
    const yearsToRetirement = retirementAge - currentAge;
    const projectedBalance = this.calculateCompoundGrowth(
      currentBalance,
      totalAnnualContribution,
      growthRate,
      yearsToRetirement
    );
    
    // Calculate tax deferred (what you're saving in taxes now)
    const marginalRate = this.estimateMarginalTaxRate(annualSalary);
    const taxDeferred = employeeContribution * marginalRate;
    
    return {
      employeeContribution: employeeContribution / 12,
      employerMatch: employerMatch / 12,
      totalMonthlyContribution: monthlyContribution,
      annualContribution: totalAnnualContribution,
      projectedBalance,
      vestedAmount,
      taxDeferred,
      catchUpEligible,
      catchUpAmount
    };
  }

  /**
   * Calculate IRA contributions and projections
   */
  calculateIRA(
    type: 'traditional' | 'roth',
    annualContribution: number,
    adjustedGrossIncome: number,
    filingStatus: 'single' | 'married' | 'separate',
    currentAge: number,
    retirementAge: number,
    currentBalance: number = 0,
    has401k: boolean = false,
    growthRate: number = 0.06
  ): IRACalculation {
    const limits = this.constants.ira;
    
    // Apply contribution limits
    const catchUpEligible = currentAge >= 50;
    const maxContribution = catchUpEligible ? 
      limits.contributionLimits.totalWithCatchUp : 
      limits.contributionLimits.regular;
    
    let actualContribution = Math.min(annualContribution, maxContribution);
    let deductible = true;
    let phaseOut;
    
    if (type === 'traditional') {
      // Check deductibility based on income and 401(k) participation
      if (has401k) {
        const thresholds = limits.traditional.deductibility[
          filingStatus === 'married' ? 'marriedJoint' : 'single'
        ];
        
        if (adjustedGrossIncome > thresholds.phaseoutEnd) {
          deductible = false;
        } else if (adjustedGrossIncome > thresholds.phaseoutStart) {
          // Partial deduction
          const phaseOutRange = thresholds.phaseoutEnd - thresholds.phaseoutStart;
          const excess = adjustedGrossIncome - thresholds.phaseoutStart;
          const phaseOutPercentage = 1 - (excess / phaseOutRange);
          phaseOut = {
            percentage: phaseOutPercentage,
            reduced: true
          };
        }
      }
    } else {
      // Roth IRA income limits
      const thresholds = limits.roth.incomeLimits[
        filingStatus === 'married' ? 'marriedJoint' : 'single'
      ];
      
      if (adjustedGrossIncome > thresholds.noContribution) {
        actualContribution = 0;
      } else if (adjustedGrossIncome > thresholds.phaseoutStart) {
        // Phase-out calculation
        const phaseOutRange = thresholds.phaseoutEnd - thresholds.phaseoutStart;
        const excess = adjustedGrossIncome - thresholds.phaseoutStart;
        const phaseOutPercentage = 1 - (excess / phaseOutRange);
        actualContribution = actualContribution * phaseOutPercentage;
        phaseOut = {
          percentage: phaseOutPercentage,
          reduced: true
        };
      }
    }
    
    // Calculate tax benefit
    const marginalRate = this.estimateMarginalTaxRate(adjustedGrossIncome);
    let taxBenefit = 0;
    
    if (type === 'traditional' && deductible) {
      taxBenefit = actualContribution * marginalRate * (phaseOut?.percentage || 1);
    } else if (type === 'roth') {
      // Tax-free growth benefit (estimated)
      const futureValue = this.calculateCompoundGrowth(
        currentBalance,
        actualContribution,
        growthRate,
        retirementAge - currentAge
      );
      const growth = futureValue - currentBalance - (actualContribution * (retirementAge - currentAge));
      taxBenefit = growth * marginalRate; // Tax saved on growth
    }
    
    // Project future value
    const projectedBalance = this.calculateCompoundGrowth(
      currentBalance,
      actualContribution,
      growthRate,
      retirementAge - currentAge
    );
    
    return {
      type,
      monthlyContribution: actualContribution / 12,
      annualContribution: actualContribution,
      taxBenefit,
      projectedBalance,
      deductible,
      phaseOut
    };
  }

  /**
   * Calculate Medicare premiums based on income
   */
  calculateMedicare(
    modifiedAdjustedGrossIncome: number,
    filingStatus: 'single' | 'married',
    age: number
  ): MedicareEstimate {
    const medicare = this.constants.medicare;
    const eligibilityAge = medicare.eligibilityAge;
    
    // Base premiums
    let partBPremium = medicare.partB.standardPremium;
    let partAPremium = medicare.partA.premium; // Usually $0 with 40 quarters
    const partDPremium = medicare.partD.averagePremium;
    
    // Apply IRMAA (Income-Related Monthly Adjustment Amount) for Part B
    let irmaaApplies = false;
    let adjustedPremium = partBPremium;
    
    if (age >= eligibilityAge) {
      const irmaaThresholds = medicare.partB.irmaa[filingStatus === 'married' ? 'married' : 'single'];
      
      for (const threshold of irmaaThresholds) {
        if (modifiedAdjustedGrossIncome >= threshold.income) {
          partBPremium = threshold.premium;
          irmaaApplies = true;
          adjustedPremium = threshold.premium;
        }
      }
    }
    
    const totalMonthlyPremium = partAPremium + partBPremium + partDPremium;
    
    return {
      eligibilityAge,
      partAPremium,
      partBPremium,
      partDPremium,
      totalMonthlyPremium,
      irmaaApplies,
      adjustedPremium: irmaaApplies ? adjustedPremium : undefined
    };
  }

  /**
   * Calculate Required Minimum Distributions
   */
  calculateRMD(
    accountBalance: number,
    age: number,
    birthYear: number
  ): { age: number; amount: number; penalty: number } | undefined {
    const rmdRules = this.constants.retirement401k.requiredMinimumDistributions;
    
    // Determine RMD start age based on birth year
    const rmdStartAge = birthYear >= 1960 ? rmdRules.born1960OrLater : rmdRules.startAge;
    
    if (age < rmdStartAge) {
      return undefined;
    }
    
    // IRS Uniform Lifetime Table factors (simplified)
    const lifetimeFactors: { [key: number]: number } = {
      73: 26.5, 74: 25.5, 75: 24.6, 76: 23.7, 77: 22.9,
      78: 22.0, 79: 21.1, 80: 20.2, 81: 19.4, 82: 18.5,
      83: 17.7, 84: 16.8, 85: 16.0, 86: 15.2, 87: 14.4,
      88: 13.7, 89: 12.9, 90: 12.2
    };
    
    const factor = lifetimeFactors[Math.min(age, 90)] || 11.5;
    const rmdAmount = accountBalance / factor;
    
    // Calculate penalty if not taken
    const penalty = rmdAmount * rmdRules.penalty;
    
    return {
      age: rmdStartAge,
      amount: rmdAmount,
      penalty
    };
  }

  /**
   * Calculate complete US retirement projection
   */
  calculateFullRetirementProjection(params: {
    currentAge: number;
    retirementAge: number;
    birthYear: number;
    annualSalary: number;
    averageIndexedEarnings: number;
    yearsWorked: number;
    current401kBalance: number;
    employee401kRate: number;
    employer401kMatch: number;
    employer401kMatchLimit: number;
    iraType?: 'traditional' | 'roth';
    iraContribution: number;
    currentIRABalance: number;
    filingStatus: 'single' | 'married' | 'separate';
    socialSecurityClaimAge: number;
    growthRate?: number;
  }): USRetirementProjection {
    const {
      currentAge,
      retirementAge,
      birthYear,
      annualSalary,
      averageIndexedEarnings,
      yearsWorked,
      current401kBalance,
      employee401kRate,
      employer401kMatch,
      employer401kMatchLimit,
      iraType,
      iraContribution,
      currentIRABalance,
      filingStatus,
      socialSecurityClaimAge,
      growthRate = 0.07
    } = params;
    
    // Calculate Social Security
    const socialSecurity = this.calculateSocialSecurity(
      averageIndexedEarnings / 12, // Convert annual to monthly
      birthYear,
      socialSecurityClaimAge,
      yearsWorked
    );
    
    // Calculate 401(k)
    let retirement401k;
    if (annualSalary > 0 && employee401kRate > 0) {
      retirement401k = this.calculate401k(
        annualSalary,
        employee401kRate,
        employer401kMatch,
        employer401kMatchLimit,
        currentAge,
        retirementAge,
        current401kBalance,
        yearsWorked,
        growthRate
      );
    }
    
    // Calculate IRA
    let traditionalIRA;
    let rothIRA;
    if (iraContribution > 0) {
      if (iraType === 'traditional') {
        traditionalIRA = this.calculateIRA(
          'traditional',
          iraContribution,
          annualSalary,
          filingStatus === 'married' ? 'married' : 'single',
          currentAge,
          retirementAge,
          currentIRABalance,
          !!retirement401k,
          growthRate
        );
      } else if (iraType === 'roth') {
        rothIRA = this.calculateIRA(
          'roth',
          iraContribution,
          annualSalary,
          filingStatus === 'married' ? 'married' : 'single',
          currentAge,
          retirementAge,
          currentIRABalance,
          !!retirement401k,
          growthRate
        );
      }
    }
    
    // Calculate Medicare
    const estimatedRetirementIncome = socialSecurity.annualBenefit + 
      (retirement401k ? retirement401k.projectedBalance * 0.04 : 0) +
      (traditionalIRA ? traditionalIRA.projectedBalance * 0.04 : 0) +
      (rothIRA ? rothIRA.projectedBalance * 0.04 : 0);
    
    const medicare = this.calculateMedicare(
      estimatedRetirementIncome,
      filingStatus === 'married' ? 'married' : 'single',
      retirementAge
    );
    
    // Calculate total retirement income
    const withdrawalRate = this.constants.safeWithdrawalRate.traditional4Percent;
    let totalRetirementSavings = 0;
    
    if (retirement401k) totalRetirementSavings += retirement401k.projectedBalance;
    if (traditionalIRA) totalRetirementSavings += traditionalIRA.projectedBalance;
    if (rothIRA) totalRetirementSavings += rothIRA.projectedBalance;
    
    const privateIncome = totalRetirementSavings * withdrawalRate;
    const totalAnnualIncome = socialSecurity.annualBenefit + privateIncome;
    
    // Calculate tax on retirement income (excluding Roth distributions)
    const taxableIncome = socialSecurity.annualBenefit * 0.85 + // 85% of SS is taxable
      (retirement401k ? retirement401k.projectedBalance * withdrawalRate : 0) +
      (traditionalIRA ? traditionalIRA.projectedBalance * withdrawalRate : 0);
    
    const taxResult = taxDataService.calculateTax(taxableIncome, 'US', {
      filingStatus: filingStatus === 'married' ? 'married' : 'single'
    });
    
    const afterTaxIncome = totalAnnualIncome - taxResult.incomeTax;
    
    // Calculate RMD if applicable
    const totalTraditionalBalance = (retirement401k?.projectedBalance || 0) + 
                                   (traditionalIRA?.projectedBalance || 0);
    const rmd = this.calculateRMD(totalTraditionalBalance, retirementAge, birthYear);
    
    return {
      socialSecurity,
      retirement401k,
      traditionalIRA,
      rothIRA,
      medicare,
      totalRetirementIncome: {
        annual: totalAnnualIncome,
        monthly: totalAnnualIncome / 12,
        afterTax: afterTaxIncome
      },
      requiredMinimumDistribution: rmd
    };
  }

  /**
   * Calculate vesting based on years of service
   */
  private calculateVesting(
    currentBalance: number,
    employerContribution: number,
    yearsOfService: number
  ): number {
    const vesting = this.constants.retirement401k.vesting;
    
    // Using graded vesting schedule
    let vestingPercentage = 0;
    if (yearsOfService >= 6) vestingPercentage = 1;
    else if (yearsOfService >= 5) vestingPercentage = vesting.graded.year5;
    else if (yearsOfService >= 4) vestingPercentage = vesting.graded.year4;
    else if (yearsOfService >= 3) vestingPercentage = vesting.graded.year3;
    else if (yearsOfService >= 2) vestingPercentage = vesting.graded.year2;
    
    return currentBalance + (employerContribution * vestingPercentage);
  }

  /**
   * Estimate marginal tax rate based on income
   */
  private estimateMarginalTaxRate(income: number): number {
    const brackets = this.constants.taxRates.federal.single;
    
    for (const bracket of brackets) {
      if (bracket.max === null || income <= bracket.max) {
        return bracket.rate;
      }
    }
    
    return brackets[brackets.length - 1].rate;
  }

  /**
   * Helper function for compound growth calculations
   */
  private calculateCompoundGrowth(
    currentValue: number,
    annualContribution: number,
    growthRate: number,
    years: number
  ): number {
    const futureValueCurrent = new Decimal(currentValue)
      .mul(new Decimal(1 + growthRate).pow(years));
    
    const futureValueContributions = new Decimal(annualContribution)
      .mul(new Decimal(1 + growthRate).pow(years).minus(1))
      .div(growthRate);
    
    return futureValueCurrent.plus(futureValueContributions).toNumber();
  }

  /**
   * Social Security optimization - find best claiming age
   */
  optimizeSocialSecurityClaiming(
    averageIndexedMonthlyEarnings: number,
    birthYear: number,
    lifeExpectancy: number = 85
  ): {
    optimalAge: number;
    lifetimeBenefit: number;
    monthlyBenefit: number;
    analysis: Array<{
      age: number;
      monthly: number;
      lifetime: number;
    }>;
  } {
    const analysis = [];
    let maxLifetimeBenefit = 0;
    let optimalAge = 62;
    let optimalMonthly = 0;
    
    // Test each claiming age from 62 to 70
    for (let age = 62; age <= 70; age += 0.25) {
      const calc = this.calculateSocialSecurity(
        averageIndexedMonthlyEarnings,
        birthYear,
        age,
        35 // Assume full work history
      );
      
      const monthsOfBenefits = (lifeExpectancy - age) * 12;
      const lifetimeBenefit = calc.monthlyBenefit * monthsOfBenefits;
      
      analysis.push({
        age,
        monthly: calc.monthlyBenefit,
        lifetime: lifetimeBenefit
      });
      
      if (lifetimeBenefit > maxLifetimeBenefit) {
        maxLifetimeBenefit = lifetimeBenefit;
        optimalAge = age;
        optimalMonthly = calc.monthlyBenefit;
      }
    }
    
    return {
      optimalAge,
      lifetimeBenefit: maxLifetimeBenefit,
      monthlyBenefit: optimalMonthly,
      analysis
    };
  }
}

export const usRetirementService = new USRetirementService();