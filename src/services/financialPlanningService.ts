/**
 * Financial Planning Service - Supabase Integration
 * Handles database operations for financial plans, mortgage calculations, etc.
 * Updated: 2025-09-02 - Migrated from localStorage to Supabase
 */

import { supabase } from '../lib/supabase';
import { userIdService } from './userIdService';
import type { 
  FinancialPlan, 
  FinancialPlanCreate, 
  FinancialPlanUpdate,
  FinancialPlanFilters,
  MortgageCalculation, 
  MortgageCalculationCreate, 
  MortgageCalculationUpdate,
  MortgageCalculationFilters,
  RetirementPlan, 
  RetirementPlanCreate, 
  RetirementPlanUpdate,
  InvestmentPlan, 
  InvestmentPlanCreate, 
  InvestmentPlanUpdate,
  SavedCalculation, 
  SavedCalculationCreate, 
  SavedCalculationUpdate
} from '../types/financial-plans';

import type {
  SavedFinancialGoal,
  SavedDebtPlan,
  SavedInsuranceNeed
} from '../types/financial-planning';

// Re-export types with aliases for backward compatibility
export type { 
  SavedFinancialGoal as FinancialGoal,
  SavedDebtPlan as DebtPayoffPlan,
  SavedInsuranceNeed as InsuranceNeed
} from '../types/financial-planning';

// Re-export financial plan types
export type {
  FinancialPlan,
  FinancialPlanCreate,
  FinancialPlanUpdate,
  FinancialPlanFilters,
  MortgageCalculation,
  RetirementPlan,
  InvestmentPlan,
  SavedCalculation
} from '../types/financial-plans';

export class FinancialPlanningService {
  /**
   * SAVED CALCULATIONS - Quick storage for any calculator results
   */
  
  static async getSavedCalculations(
    clerkUserId: string, 
    calculatorType?: string
  ): Promise<SavedCalculation[]> {
    if (!supabase) return [];
    
    try {
      const dbUserId = await userIdService.getDatabaseUserId(clerkUserId);
      if (!dbUserId) return [];

      let query = supabase
        .from('saved_calculations')
        .select('*')
        .eq('user_id', dbUserId);

      if (calculatorType) {
        query = query.eq('calculator_type', calculatorType);
      }

      query = query.order('created_at', { ascending: false });

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching saved calculations:', error);
      return [];
    }
  }

  static async saveCalculation(
    clerkUserId: string, 
    calculationData: SavedCalculationCreate
  ): Promise<SavedCalculation | null> {
    if (!supabase) return null;
    
    try {
      const dbUserId = await userIdService.getDatabaseUserId(clerkUserId);
      if (!dbUserId) return null;

      const { data, error } = await supabase
        .from('saved_calculations')
        .insert({
          ...calculationData,
          user_id: dbUserId
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error saving calculation:', error);
      return null;
    }
  }

  static async deleteCalculation(calculationId: string): Promise<boolean> {
    if (!supabase) return false;
    
    try {
      const { error } = await supabase
        .from('saved_calculations')
        .delete()
        .eq('id', calculationId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting calculation:', error);
      return false;
    }
  }

  static async toggleFavoriteCalculation(
    calculationId: string, 
    isFavorite: boolean
  ): Promise<boolean> {
    if (!supabase) return false;
    
    try {
      const { error } = await supabase
        .from('saved_calculations')
        .update({ is_favorite: isFavorite })
        .eq('id', calculationId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error toggling favorite:', error);
      return false;
    }
  }

  /**
   * MORTGAGE CALCULATIONS - Detailed mortgage data
   */
  
  static async getMortgageCalculations(
    clerkUserId: string, 
    filters?: MortgageCalculationFilters
  ): Promise<MortgageCalculation[]> {
    if (!supabase) return [];
    
    try {
      const dbUserId = await userIdService.getDatabaseUserId(clerkUserId);
      if (!dbUserId) return [];

      let query = supabase
        .from('mortgage_calculations')
        .select('*')
        .eq('user_id', dbUserId);

      // Apply filters
      if (filters?.calculation_type) {
        query = query.eq('calculation_type', filters.calculation_type);
      }
      if (filters?.region) {
        query = query.eq('region', filters.region);
      }
      if (filters?.property_price_min) {
        query = query.gte('property_price', filters.property_price_min);
      }
      if (filters?.property_price_max) {
        query = query.lte('property_price', filters.property_price_max);
      }
      if (filters?.created_after) {
        query = query.gte('created_at', filters.created_after.toISOString());
      }
      if (filters?.created_before) {
        query = query.lte('created_at', filters.created_before.toISOString());
      }

      query = query.order('created_at', { ascending: false });

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching mortgage calculations:', error);
      return [];
    }
  }

  static async saveMortgageCalculation(
    clerkUserId: string, 
    calculationData: MortgageCalculationCreate
  ): Promise<MortgageCalculation | null> {
    if (!supabase) return null;
    
    try {
      const dbUserId = await userIdService.getDatabaseUserId(clerkUserId);
      if (!dbUserId) return null;

      const { data, error } = await supabase
        .from('mortgage_calculations')
        .insert({
          ...calculationData,
          user_id: dbUserId
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error saving mortgage calculation:', error);
      return null;
    }
  }

  /**
   * FINANCIAL PLANS - Master plans that can contain multiple calculations
   */
  
  static async getFinancialPlans(
    clerkUserId: string, 
    filters?: FinancialPlanFilters
  ): Promise<FinancialPlan[]> {
    if (!supabase) return [];
    
    try {
      const dbUserId = await userIdService.getDatabaseUserId(clerkUserId);
      if (!dbUserId) return [];

      let query = supabase
        .from('financial_plans')
        .select('*')
        .eq('user_id', dbUserId);

      // Apply filters
      if (filters?.plan_type) {
        query = query.eq('plan_type', filters.plan_type);
      }
      if (filters?.region) {
        query = query.eq('region', filters.region);
      }
      if (filters?.is_active !== undefined) {
        query = query.eq('is_active', filters.is_active);
      }
      if (filters?.is_favorite !== undefined) {
        query = query.eq('is_favorite', filters.is_favorite);
      }
      if (filters?.search) {
        query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
      }

      query = query.order('updated_at', { ascending: false });

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching financial plans:', error);
      return [];
    }
  }

  static async createFinancialPlan(
    clerkUserId: string, 
    planData: FinancialPlanCreate
  ): Promise<FinancialPlan | null> {
    if (!supabase) return null;
    
    try {
      const dbUserId = await userIdService.getDatabaseUserId(clerkUserId);
      if (!dbUserId) return null;

      const { data, error } = await supabase
        .from('financial_plans')
        .insert({
          ...planData,
          user_id: dbUserId
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating financial plan:', error);
      return null;
    }
  }
  
  static async updateFinancialPlan(
    clerkUserId: string,
    planId: string,
    updates: Partial<FinancialPlanCreate>
  ): Promise<FinancialPlan | null> {
    if (!supabase) return null;
    
    try {
      const dbUserId = await userIdService.getDatabaseUserId(clerkUserId);
      if (!dbUserId) return null;

      const { data, error } = await supabase
        .from('financial_plans')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', planId)
        .eq('user_id', dbUserId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating financial plan:', error);
      return null;
    }
  }
  
  static async deleteFinancialPlan(
    clerkUserId: string,
    planId: string
  ): Promise<boolean> {
    if (!supabase) return false;
    
    try {
      const dbUserId = await userIdService.getDatabaseUserId(clerkUserId);
      if (!dbUserId) return false;

      const { error } = await supabase
        .from('financial_plans')
        .delete()
        .eq('id', planId)
        .eq('user_id', dbUserId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting financial plan:', error);
      return false;
    }
  }

  /**
   * UTILITY METHODS
   */
  
  static async searchCalculations(
    clerkUserId: string, 
    searchQuery: string
  ): Promise<SavedCalculation[]> {
    if (!supabase) return [];
    
    try {
      const dbUserId = await userIdService.getDatabaseUserId(clerkUserId);
      if (!dbUserId) return [];

      const { data, error } = await supabase
        .from('saved_calculations')
        .select('*')
        .eq('user_id', dbUserId)
        .or(`calculation_name.ilike.%${searchQuery}%`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error searching calculations:', error);
      return [];
    }
  }

  static async getCalculationStats(
    clerkUserId: string
  ): Promise<{
    totalCalculations: number;
    calculationsByType: Record<string, number>;
    favoriteCalculations: number;
    recentActivity: number; // calculations in last 30 days
  }> {
    if (!supabase) {
      return {
        totalCalculations: 0,
        calculationsByType: {},
        favoriteCalculations: 0,
        recentActivity: 0
      };
    }
    
    try {
      const dbUserId = await userIdService.getDatabaseUserId(clerkUserId);
      if (!dbUserId) throw new Error('User not found');

      // Get all calculations
      const { data: calculations, error } = await supabase
        .from('saved_calculations')
        .select('calculator_type, is_favorite, created_at')
        .eq('user_id', dbUserId);

      if (error) throw error;

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const stats = {
        totalCalculations: calculations?.length || 0,
        calculationsByType: {} as Record<string, number>,
        favoriteCalculations: calculations?.filter(c => c.is_favorite).length || 0,
        recentActivity: calculations?.filter(c => 
          new Date(c.created_at) > thirtyDaysAgo
        ).length || 0
      };

      // Count by type
      calculations?.forEach(calc => {
        stats.calculationsByType[calc.calculator_type] = 
          (stats.calculationsByType[calc.calculator_type] || 0) + 1;
      });

      return stats;
    } catch (error) {
      console.error('Error getting calculation stats:', error);
      return {
        totalCalculations: 0,
        calculationsByType: {},
        favoriteCalculations: 0,
        recentActivity: 0
      };
    }
  }

  // Legacy methods for backward compatibility
  static getRetirementPlans() {
    console.warn('Using deprecated localStorage method. Consider migrating to getFinancialPlans()');
    return [];
  }

  static getDeprecatedMortgageCalculations() {
    console.warn('Using deprecated localStorage method. Consider migrating to getMortgageCalculations()');  
    return [];
  }


  static calculateRetirementProjection(plan: any) {
    console.warn('Using deprecated method. Functionality moved to retirement calculators');
    // Return minimal object for backward compatibility
    return {
      yearsToRetirement: 0,
      totalSavingsAtRetirement: 0,
      monthlyIncomeInRetirement: 0,
      savingsShortfall: 0,
      onTrack: false
    };
  }

  static calculateMortgage() {
    console.warn('Using deprecated method. Functionality moved to mortgage calculators');
    return null;
  }

  static calculateGoalProjection(
    targetAmount: number,
    initialAmount: number = 0,
    monthlyContribution: number = 0,
    annualReturn: number = 0.07,
    timeHorizon: number = 5
  ) {
    console.warn('Using deprecated method. Functionality moved to goal calculators');
    // Simple compound interest calculation for backward compatibility
    const monthlyRate = annualReturn / 12;
    const months = timeHorizon * 12;
    
    // Future value of current amount
    const futureValue = initialAmount * Math.pow(1 + monthlyRate, months);
    
    // Future value of monthly contributions
    const contributionsFV = monthlyContribution * 
      ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate);
    
    const projectedValue = futureValue + contributionsFV;
    const shortfall = Math.max(0, targetAmount - projectedValue);
    
    return {
      projectedValue,
      shortfall,
      onTrack: projectedValue >= targetAmount,
      monthsToGoal: months,
      requiredMonthly: shortfall > 0 ? 
        shortfall / ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate) : 
        0
    };
  }

  static getDebtPlans(): SavedDebtPlan[] {
    console.warn('Using deprecated method. Consider using getFinancialPlans with plan_type filter');
    return [];
  }

  static getInsuranceNeeds(): SavedInsuranceNeed[] {
    console.warn('Using deprecated method. Insurance needs should be fetched from database');
    return [];
  }

  static getFinancialPlansSync(): SavedFinancialGoal[] {
    console.warn('Using deprecated synchronous method. Use async getFinancialPlans with clerkUserId');
    return [];
  }

  static calculateDebtPayoff(
    principal: number,
    interestRate: number,
    minimumPayment: number,
    extraPayment: number = 0
  ) {
    const monthlyRate = interestRate / 12;
    const totalPayment = minimumPayment + extraPayment;
    
    if (totalPayment <= principal * monthlyRate) {
      return {
        monthsToPayoff: Infinity,
        totalInterest: Infinity,
        totalPayment: Infinity
      };
    }
    
    const monthsToPayoff = Math.ceil(
      Math.log(totalPayment / (totalPayment - principal * monthlyRate)) / 
      Math.log(1 + monthlyRate)
    );
    
    const totalPayment_ = monthsToPayoff * totalPayment;
    const totalInterest = totalPayment_ - principal;
    
    return {
      monthsToPayoff,
      totalInterest,
      totalPayment: totalPayment_
    };
  }
}

export const financialPlanningService = FinancialPlanningService;