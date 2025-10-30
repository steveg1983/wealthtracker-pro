/**
 * Financial Planning Service - Supabase Integration
 * Handles database operations for financial plans, mortgage calculations, etc.
 * Updated: 2025-09-02 - Migrated from localStorage to Supabase
 */

import { supabase } from '@wealthtracker/core';
import { userIdService } from './userIdService';
import type {
  FinancialPlan,
  FinancialPlanCreate,
  FinancialPlanFilters,
  MortgageCalculation,
  MortgageCalculationCreate,
  MortgageCalculationFilters,
  SavedCalculation,
  SavedCalculationCreate,
} from '../types/financial-plans';
import type { Database, Json } from '@app-types/supabase';

type FinancialPlanRow = Database['public']['Tables']['financial_plans']['Row'];
type SavedCalculationRow = Database['public']['Tables']['saved_calculations']['Row'];
type MortgageCalculationRow = Database['public']['Tables']['mortgage_calculations']['Row'];

const FINANCIAL_PLAN_TYPES: ReadonlySet<FinancialPlan['plan_type']> = new Set([
  'retirement',
  'mortgage',
  'investment',
  'tax',
  'insurance',
  'education',
  'networth',
]);

const MORTGAGE_CALCULATION_TYPES: ReadonlySet<MortgageCalculation['calculation_type']> = new Set([
  'standard',
  'helpToBuy',
  'sharedOwnership',
  'remortgage',
  'affordability',
  'arm',
]);

const MORTGAGE_REGIONS: ReadonlySet<MortgageCalculation['region']> = new Set(['UK', 'US']);

const toDate = (value: Date | string | null | undefined, fallback = new Date()): Date => {
  if (value instanceof Date) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return fallback;
};

const toEnumValue = <T extends string>(value: string | null | undefined, allowed: ReadonlySet<T>, fallback: T): T => {
  if (value && allowed.has(value as T)) {
    return value as T;
  }
  return fallback;
};

const ensureObject = (value: Json | null | undefined): Record<string, unknown> => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
};

const toStringArray = (value: Json | null | undefined): string[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const strings = value.filter((item): item is string => typeof item === 'string');
  return strings.length > 0 ? strings : undefined;
};

const mapFinancialPlanRow = (row: FinancialPlanRow): FinancialPlan => {
  const plan: FinancialPlan = {
    id: row.id,
    user_id: row.user_id,
    plan_type: toEnumValue(row.plan_type, FINANCIAL_PLAN_TYPES, 'networth'),
    name: row.name,
    data: ensureObject(row.data),
    region: row.region,
    currency: row.currency,
    is_active: row.is_active,
    is_favorite: row.is_favorite,
    created_at: toDate(row.created_at),
    updated_at: toDate(row.updated_at),
  };

  if (row.description) {
    plan.description = row.description;
  }

  return plan;
};

const mapSavedCalculationRow = (row: SavedCalculationRow): SavedCalculation => {
  const calculation: SavedCalculation = {
    id: row.id,
    user_id: row.user_id,
    calculator_type: row.calculator_type,
    inputs: ensureObject(row.inputs),
    results: ensureObject(row.results),
    currency: row.currency,
    is_favorite: row.is_favorite,
    created_at: toDate(row.created_at),
    updated_at: toDate(row.updated_at),
  };

  if (row.calculation_name) {
    calculation.calculation_name = row.calculation_name;
  }
  if (row.region) {
    calculation.region = row.region;
  }
  const tags = toStringArray(row.tags);
  if (tags) {
    calculation.tags = tags;
  }

  return calculation;
};

const mapMortgageCalculationRow = (row: MortgageCalculationRow): MortgageCalculation => {
  const calculation: MortgageCalculation = {
    id: row.id,
    user_id: row.user_id,
    property_price: row.property_price,
    down_payment: row.down_payment,
    loan_amount: row.loan_amount,
    interest_rate: row.interest_rate,
    term_years: row.term_years,
    mortgage_type: row.mortgage_type ?? 'standard',
    region: toEnumValue(row.region, MORTGAGE_REGIONS, 'UK'),
    calculation_type: toEnumValue(row.calculation_type, MORTGAGE_CALCULATION_TYPES, 'standard'),
    monthly_payment: row.monthly_payment,
    total_interest: row.total_interest,
    results: ensureObject(row.results),
    created_at: toDate(row.created_at),
    updated_at: toDate(row.updated_at),
  };

  if (row.financial_plan_id) {
    calculation.financial_plan_id = row.financial_plan_id;
  }
  if (row.state_county) {
    calculation.state_county = row.state_county;
  }
  if (row.stamp_duty !== null && row.stamp_duty !== undefined) {
    calculation.stamp_duty = row.stamp_duty;
  }
  if (row.pmi_amount !== null && row.pmi_amount !== undefined) {
    calculation.pmi_amount = row.pmi_amount;
  }
  if (row.property_tax !== null && row.property_tax !== undefined) {
    calculation.property_tax = row.property_tax;
  }

  return calculation;
};

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
      return (data ?? []).map(mapSavedCalculationRow);
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
      return data ? mapSavedCalculationRow(data) : null;
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
      return (data ?? []).map(mapMortgageCalculationRow);
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
      return data ? mapMortgageCalculationRow(data) : null;
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
      return (data ?? []).map(mapFinancialPlanRow);
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
      return data ? mapFinancialPlanRow(data) : null;
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
      return data ? mapFinancialPlanRow(data) : null;
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
      return (data ?? []).map(mapSavedCalculationRow);
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

  static calculateRetirementProjection() {
    console.warn('Using deprecated method. Functionality moved to retirement calculators');
    return null;
  }

  static calculateMortgage() {
    console.warn('Using deprecated method. Functionality moved to mortgage calculators');
    return null;
  }
}

export const financialPlanningService = FinancialPlanningService;
