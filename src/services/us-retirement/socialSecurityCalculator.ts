/**
 * Social Security Calculator Module
 * Handles Social Security benefit calculations
 */

import Decimal from 'decimal.js';
import usRetirementConstants from '../../data/us-retirement-constants-2025.json';
import type { SocialSecurityCalculation } from './types';

export class SocialSecurityCalculator {
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
    const bendPoint1 = 1174;
    const bendPoint2 = 7078;
    
    let pia = 0;
    
    if (averageIndexedMonthlyEarnings <= bendPoint1) {
      pia = averageIndexedMonthlyEarnings * 0.90;
    } else if (averageIndexedMonthlyEarnings <= bendPoint2) {
      pia = bendPoint1 * 0.90 + (averageIndexedMonthlyEarnings - bendPoint1) * 0.32;
    } else {
      pia = bendPoint1 * 0.90 + 
            (bendPoint2 - bendPoint1) * 0.32 + 
            (averageIndexedMonthlyEarnings - bendPoint2) * 0.15;
    }
    
    // Apply early or delayed retirement adjustments
    const fullRetirementAge = this.getFullRetirementAge(birthYear);
    let monthlyBenefit = pia;
    let reduction = 0;
    
    if (claimingAge < fullRetirementAge) {
      // Early retirement reduction
      const monthsEarly = (fullRetirementAge - claimingAge) * 12;
      
      if (monthsEarly <= 36) {
        reduction = monthsEarly * (5/9) / 100;
      } else {
        reduction = (36 * (5/9) + (monthsEarly - 36) * (5/12)) / 100;
      }
      
      monthlyBenefit = pia * (1 - reduction);
    } else if (claimingAge > fullRetirementAge) {
      // Delayed retirement credits
      const yearsDelayed = Math.min(claimingAge - fullRetirementAge, 70 - fullRetirementAge);
      const creditRate = birthYear >= 1943 ? 0.08 : 0.075; // 8% per year for those born 1943 or later
      const increase = yearsDelayed * creditRate;
      monthlyBenefit = pia * (1 + increase);
    }
    
    // Calculate break-even age
    const breakEvenAge = this.calculateBreakEvenAge(
      pia,
      claimingAge,
      fullRetirementAge,
      birthYear
    );
    
    return {
      monthlyBenefit: Math.round(monthlyBenefit),
      annualBenefit: Math.round(monthlyBenefit * 12),
      fullRetirementAge,
      claimingAge,
      reduction: reduction * 100,
      credits,
      eligible: true,
      breakEvenAge
    };
  }

  /**
   * Get full retirement age based on birth year
   */
  getFullRetirementAge(birthYear: number): number {
    const retirementAges = this.constants.socialSecurity.fullRetirementAge;
    
    if (birthYear <= 1937) return 65;
    if (birthYear === 1938) return 65.167;
    if (birthYear === 1939) return 65.333;
    if (birthYear === 1940) return 65.5;
    if (birthYear === 1941) return 65.667;
    if (birthYear === 1942) return 65.833;
    if (birthYear >= 1943 && birthYear <= 1954) return 66;
    if (birthYear === 1955) return 66.167;
    if (birthYear === 1956) return 66.333;
    if (birthYear === 1957) return 66.5;
    if (birthYear === 1958) return 66.667;
    if (birthYear === 1959) return 66.833;
    if (birthYear >= 1960) return 67;
    
    return 67; // Default to 67 for future birth years
  }

  /**
   * Calculate break-even age for early vs full retirement claiming
   */
  private calculateBreakEvenAge(
    pia: number,
    claimingAge: number,
    fullRetirementAge: number,
    birthYear: number
  ): number | undefined {
    if (claimingAge >= fullRetirementAge) {
      return undefined; // No break-even for delayed claiming
    }
    
    const earlyBenefit = this.calculateSocialSecurity(
      pia / 0.9 * 1000, // Reverse engineer AIME from PIA
      birthYear,
      claimingAge,
      40
    ).monthlyBenefit;
    
    const fullBenefit = pia;
    
    // Calculate cumulative benefits
    const monthsEarly = (fullRetirementAge - claimingAge) * 12;
    const cumulativeEarlyStart = earlyBenefit * monthsEarly;
    
    // Find break-even point
    const monthlyDifference = fullBenefit - earlyBenefit;
    if (monthlyDifference <= 0) {
      return undefined;
    }
    
    const monthsToBreakEven = cumulativeEarlyStart / monthlyDifference;
    const breakEvenAge = fullRetirementAge + (monthsToBreakEven / 12);
    
    return Math.round(breakEvenAge * 10) / 10;
  }

  /**
   * Calculate spousal benefits
   */
  calculateSpousalBenefit(
    primaryPIA: number,
    spouseBirthYear: number,
    spouseClaimingAge: number
  ): number {
    const spouseFRA = this.getFullRetirementAge(spouseBirthYear);
    let spousalBenefit = primaryPIA * 0.5; // 50% of primary's PIA
    
    // Apply reduction if claiming before FRA
    if (spouseClaimingAge < spouseFRA) {
      const monthsEarly = (spouseFRA - spouseClaimingAge) * 12;
      const reduction = monthsEarly * (25/36) / 100;
      spousalBenefit = spousalBenefit * (1 - Math.min(reduction, 0.25));
    }
    
    return Math.round(spousalBenefit);
  }

  /**
   * Calculate survivor benefits
   */
  calculateSurvivorBenefit(
    deceasedBenefit: number,
    survivorBirthYear: number,
    survivorClaimingAge: number
  ): number {
    const survivorFRA = this.getFullRetirementAge(survivorBirthYear);
    let survivorBenefit = deceasedBenefit;
    
    // Apply reduction if claiming before FRA
    if (survivorClaimingAge < survivorFRA && survivorClaimingAge >= 60) {
      const monthsEarly = (survivorFRA - survivorClaimingAge) * 12;
      const maxReduction = 0.285; // Maximum reduction is 28.5%
      const reduction = Math.min(monthsEarly * 0.00475, maxReduction);
      survivorBenefit = deceasedBenefit * (1 - reduction);
    }
    
    return Math.round(survivorBenefit);
  }
}

export const socialSecurityCalculator = new SocialSecurityCalculator();