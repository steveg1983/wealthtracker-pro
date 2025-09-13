/**
 * Retirement Optimizer Module
 * Provides optimization strategies and recommendations
 */

import type { 
  USRetirementProjection, 
  OptimizationRecommendation,
  RetirementProjectionParams 
} from './types';

export class RetirementOptimizer {
  /**
   * Generate optimization recommendations
   */
  generateOptimizationRecommendations(
    projection: USRetirementProjection,
    params: RetirementProjectionParams
  ): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = [];
    
    // Check Social Security optimization
    if (params.socialSecurityClaimAge < 70 && projection.socialSecurity.eligible) {
      const delayImpact = this.calculateSocialSecurityDelayImpact(
        projection.socialSecurity.monthlyBenefit,
        params.socialSecurityClaimAge,
        70
      );
      
      if (delayImpact > 0) {
        recommendations.push({
          type: 'claiming',
          title: 'Delay Social Security',
          description: `Consider delaying Social Security to age 70 for maximum benefits`,
          impact: delayImpact,
          priority: 'high',
          action: 'Delay claiming until age 70 for 8% annual increase'
        });
      }
    }
    
    // Check 401(k) contribution optimization
    if (projection.retirement401k) {
      const maxContribution = params.currentAge >= 50 ? 30500 : 23500;
      const currentContribution = projection.retirement401k.employeeContribution;
      
      if (currentContribution < maxContribution) {
        const additionalSavings = (maxContribution - currentContribution) * 
          (params.retirementAge - params.currentAge);
        
        recommendations.push({
          type: 'contribution',
          title: 'Maximize 401(k) Contributions',
          description: `Increase 401(k) contributions to the maximum allowed`,
          impact: additionalSavings,
          priority: 'high',
          action: `Increase contribution to $${maxContribution.toLocaleString()} annually`
        });
      }
      
      // Check employer match optimization
      if (projection.retirement401k.employerMatch < params.employer401kMatch * params.annualSalary) {
        const missedMatch = (params.employer401kMatch * params.annualSalary) - 
          projection.retirement401k.employerMatch;
        
        recommendations.push({
          type: 'contribution',
          title: 'Capture Full Employer Match',
          description: 'You\'re not receiving the full employer 401(k) match',
          impact: missedMatch * (params.retirementAge - params.currentAge),
          priority: 'high',
          action: 'Increase contributions to capture full match'
        });
      }
    }
    
    // Check IRA opportunities
    if (!projection.traditionalIRA && !projection.rothIRA) {
      const iraLimit = params.currentAge >= 50 ? 8000 : 7000;
      const yearsToRetirement = params.retirementAge - params.currentAge;
      const potentialGrowth = this.calculateCompoundGrowth(0, iraLimit, 0.07, yearsToRetirement);
      
      recommendations.push({
        type: 'contribution',
        title: 'Open and Fund an IRA',
        description: 'Consider opening a Traditional or Roth IRA for additional tax-advantaged savings',
        impact: potentialGrowth,
        priority: 'medium',
        action: `Contribute $${iraLimit.toLocaleString()} annually to an IRA`
      });
    }
    
    // Check Roth conversion opportunity
    if (projection.traditionalIRA && params.currentAge < 60) {
      recommendations.push({
        type: 'conversion',
        title: 'Consider Roth Conversion',
        description: 'Converting Traditional IRA to Roth IRA may reduce future taxes',
        impact: projection.traditionalIRA.projectedBalance * 0.15, // Estimated tax savings
        priority: 'medium',
        action: 'Evaluate Roth conversion during low-income years'
      });
    }
    
    // Check asset allocation
    const targetStockAllocation = Math.max(40, 100 - params.currentAge);
    recommendations.push({
      type: 'allocation',
      title: 'Review Asset Allocation',
      description: `Consider ${targetStockAllocation}% stocks / ${100 - targetStockAllocation}% bonds allocation`,
      impact: 0,
      priority: 'low',
      action: 'Rebalance portfolio to match age-appropriate allocation'
    });
    
    return recommendations.sort((a, b) => b.impact - a.impact);
  }

  /**
   * Calculate optimal Social Security claiming age
   */
  calculateOptimalClaimingAge(
    monthlyPIA: number,
    fullRetirementAge: number,
    lifeExpectancy: number,
    discountRate: number = 0.03
  ): { optimalAge: number; lifetimeValue: number } {
    let maxValue = 0;
    let optimalAge = fullRetirementAge;
    
    // Test each claiming age from 62 to 70
    for (let claimAge = 62; claimAge <= 70; claimAge += 0.25) {
      const lifetimeValue = this.calculateLifetimeValue(
        monthlyPIA,
        fullRetirementAge,
        claimAge,
        lifeExpectancy,
        discountRate
      );
      
      if (lifetimeValue > maxValue) {
        maxValue = lifetimeValue;
        optimalAge = claimAge;
      }
    }
    
    return { optimalAge, lifetimeValue: maxValue };
  }

  /**
   * Calculate tax-efficient withdrawal strategy
   */
  calculateWithdrawalStrategy(
    traditional401k: number,
    rothIRA: number,
    taxableAccount: number,
    annualNeed: number,
    currentAge: number,
    rmdAge: number = 73
  ): {
    taxable: number;
    traditional: number;
    roth: number;
    estimatedTax: number;
  } {
    // Basic tax-efficient withdrawal order
    let remainingNeed = annualNeed;
    let taxableWithdrawal = 0;
    let traditionalWithdrawal = 0;
    let rothWithdrawal = 0;
    
    // 1. Withdraw from taxable first (capital gains tax only)
    if (taxableAccount > 0 && remainingNeed > 0) {
      taxableWithdrawal = Math.min(taxableAccount, remainingNeed);
      remainingNeed -= taxableWithdrawal;
    }
    
    // 2. Withdraw from traditional up to standard deduction + low tax brackets
    const standardDeduction = 14600; // Single filer
    const lowBracketLimit = 47150; // 12% bracket limit
    const taxEfficientLimit = currentAge >= rmdAge ? annualNeed : lowBracketLimit;
    
    if (traditional401k > 0 && remainingNeed > 0) {
      traditionalWithdrawal = Math.min(
        Math.min(traditional401k, taxEfficientLimit),
        remainingNeed
      );
      remainingNeed -= traditionalWithdrawal;
    }
    
    // 3. Withdraw from Roth last (tax-free)
    if (rothIRA > 0 && remainingNeed > 0) {
      rothWithdrawal = Math.min(rothIRA, remainingNeed);
      remainingNeed -= rothWithdrawal;
    }
    
    // Estimate taxes
    const capitalGainsTax = taxableWithdrawal * 0.15 * 0.5; // Assume 50% is gains
    const ordinaryIncomeTax = this.estimateIncomeTax(traditionalWithdrawal);
    const estimatedTax = capitalGainsTax + ordinaryIncomeTax;
    
    return {
      taxable: taxableWithdrawal,
      traditional: traditionalWithdrawal,
      roth: rothWithdrawal,
      estimatedTax
    };
  }

  // Helper methods
  
  private calculateSocialSecurityDelayImpact(
    currentBenefit: number,
    currentAge: number,
    delayToAge: number
  ): number {
    const yearsDelayed = delayToAge - currentAge;
    const increaseRate = 0.08; // 8% per year after FRA
    const increasedBenefit = currentBenefit * (1 + increaseRate * yearsDelayed);
    const additionalLifetime = (increasedBenefit - currentBenefit) * 12 * 15; // Assume 15 years
    return additionalLifetime;
  }

  private calculateLifetimeValue(
    monthlyPIA: number,
    fra: number,
    claimAge: number,
    lifeExpectancy: number,
    discountRate: number
  ): number {
    let monthlyBenefit = monthlyPIA;
    
    // Adjust for early/late claiming
    if (claimAge < fra) {
      const reduction = (fra - claimAge) * 0.0067; // Simplified
      monthlyBenefit *= (1 - Math.min(reduction, 0.30));
    } else if (claimAge > fra) {
      const increase = (claimAge - fra) * 0.08;
      monthlyBenefit *= (1 + increase);
    }
    
    // Calculate present value of benefits
    const monthsOfBenefits = (lifeExpectancy - claimAge) * 12;
    const monthlyDiscountRate = discountRate / 12;
    
    let presentValue = 0;
    for (let month = 0; month < monthsOfBenefits; month++) {
      presentValue += monthlyBenefit / Math.pow(1 + monthlyDiscountRate, month);
    }
    
    return presentValue;
  }

  private calculateCompoundGrowth(
    principal: number,
    annualContribution: number,
    rate: number,
    years: number
  ): number {
    if (years <= 0) return principal;
    
    const futureValuePrincipal = principal * Math.pow(1 + rate, years);
    const futureValueContributions = annualContribution * 
      ((Math.pow(1 + rate, years) - 1) / rate);
    
    return futureValuePrincipal + futureValueContributions;
  }

  private estimateIncomeTax(income: number): number {
    // Simplified 2025 tax calculation
    const standardDeduction = 14600;
    const taxableIncome = Math.max(0, income - standardDeduction);
    
    if (taxableIncome <= 11600) return taxableIncome * 0.10;
    if (taxableIncome <= 47150) return 1160 + (taxableIncome - 11600) * 0.12;
    if (taxableIncome <= 100525) return 5426 + (taxableIncome - 47150) * 0.22;
    
    return 17168.50 + (taxableIncome - 100525) * 0.24;
  }
}

export const retirementOptimizer = new RetirementOptimizer();