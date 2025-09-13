import { useState, useEffect, useCallback } from 'react';
import { useApp } from '../contexts/AppContextSupabase';
import { useRegionalSettings, useRegionalCurrency } from './useRegionalSettings';
import { taxDataService, UKTaxYear } from '../services/taxDataService';
import { 
  financialPlanningPageService, 
  type ActiveTab
} from '../services/financialPlanningPageService';
// Local view types aligned with UI needs
type RetirementPlan = { id: string; name?: string };
type MortgageCalculation = { id: string };
type DebtPayoffPlan = { id: string; debtName: string; currentBalance: number; interestRate: number };
type FinancialGoal = { id: string };
type InsuranceNeed = { id: string; type: string; currentCoverage: number; recommendedCoverage: number; monthlyPremium: number };
import { logger } from '../services/loggingService';

export interface UseFinancialPlanningPageReturn {
  // State
  activeTab: ActiveTab;
  retirementPlans: RetirementPlan[];
  mortgageCalculations: MortgageCalculation[];
  debtPlans: DebtPayoffPlan[];
  financialGoals: FinancialGoal[];
  insuranceNeeds: InsuranceNeed[];
  isLoading: boolean;
  selectedTaxYear: UKTaxYear;
  
  // Actions
  setActiveTab: (tab: ActiveTab) => void;
  setSelectedTaxYear: (year: UKTaxYear) => void;
  handleDataChange: () => void;
  
  // Formatting
  formatCurrency: (amount: number) => string;
  formatDate: (date: Date) => string;
  
  // Regional settings
  regionalSettings: ReturnType<typeof useRegionalSettings>;
  currencySymbol: string;
  
  // Service methods
  getGoalStatusColor: typeof financialPlanningPageService.getGoalStatusColor;
  getGoalStatusIcon: typeof financialPlanningPageService.getGoalStatusIcon;
  getInsuranceCoverageStatus: typeof financialPlanningPageService.getInsuranceCoverageStatus;
  getGoalProgress: typeof financialPlanningPageService.getGoalProgress;
  getRetirementProjection: typeof financialPlanningPageService.getRetirementProjection;
  getDebtPayoffProjection: typeof financialPlanningPageService.getDebtPayoffProjection;
  getTabButtonClass: typeof financialPlanningPageService.getTabButtonClass;
}

export function useFinancialPlanningPage(): UseFinancialPlanningPageReturn {
  const { accounts, transactions, budgets } = useApp();
  const regionalSettings = useRegionalSettings();
  const { formatCurrency: formatRegionalCurrency, currencySymbol } = useRegionalCurrency();
  
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [retirementPlans, setRetirementPlans] = useState<RetirementPlan[]>([]);
  const [mortgageCalculations, setMortgageCalculations] = useState<MortgageCalculation[]>([]);
  const [debtPlans, setDebtPlans] = useState<DebtPayoffPlan[]>([]);
  const [financialGoals, setFinancialGoals] = useState<FinancialGoal[]>([]);
  const [insuranceNeeds, setInsuranceNeeds] = useState<InsuranceNeed[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTaxYear, setSelectedTaxYear] = useState<UKTaxYear>(taxDataService.getSelectedUKTaxYear());

  // Load data
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await financialPlanningPageService.loadData();
      setRetirementPlans(data.retirementPlans);
      setMortgageCalculations(data.mortgageCalculations);
      setDebtPlans(data.debtPlans);
      setFinancialGoals(data.financialGoals);
      setInsuranceNeeds(data.insuranceNeeds);
    } catch (error) {
      logger.error('Error loading financial planning data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Handle data change
  const handleDataChange = useCallback(() => {
    loadData();
  }, [loadData]);

  // Format currency
  const formatCurrency = useCallback((amount: number) => {
    return formatRegionalCurrency(amount);
  }, [formatRegionalCurrency]);

  // Format date
  const formatDate = useCallback((date: Date) => {
    const format = regionalSettings.region === 'UK' ? 'en-GB' : 'en-US';
    return date.toLocaleDateString(format, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }, [regionalSettings.region]);

  // Load data on mount
  useEffect(() => {
    loadData();
  }, [loadData]);

  return {
    // State
    activeTab,
    retirementPlans,
    mortgageCalculations,
    debtPlans,
    financialGoals,
    insuranceNeeds,
    isLoading,
    selectedTaxYear,
    
    // Actions
    setActiveTab,
    setSelectedTaxYear,
    handleDataChange,
    
    // Formatting
    formatCurrency,
    formatDate,
    
    // Regional settings
    regionalSettings,
    currencySymbol,
    
    // Service methods
    getGoalStatusColor: financialPlanningPageService.getGoalStatusColor,
    getGoalStatusIcon: financialPlanningPageService.getGoalStatusIcon,
    getInsuranceCoverageStatus: financialPlanningPageService.getInsuranceCoverageStatus,
    getGoalProgress: financialPlanningPageService.getGoalProgress,
    getRetirementProjection: financialPlanningPageService.getRetirementProjection,
    getDebtPayoffProjection: financialPlanningPageService.getDebtPayoffProjection,
    getTabButtonClass: financialPlanningPageService.getTabButtonClass
  };
}
