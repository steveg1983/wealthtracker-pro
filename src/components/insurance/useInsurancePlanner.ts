import { useState, useEffect } from 'react';
import { useApp } from '../../contexts/AppContextSupabase';
import { useAuth } from '../../contexts/AuthContext';
import { financialPlanningService } from '../../services/financialPlanningService';
import type { 
  InsurancePlan, 
  InsuranceAnalysis, 
  InsuranceRecommendation
} from './types';
import { DEFAULT_INSURANCE_PLAN } from './types';

export function useInsurancePlanner() {
  const { accounts, transactions } = useApp();
  const { user } = useAuth();
  
  const [plans, setPlans] = useState<InsurancePlan[]>([]);
  const [showAddPlan, setShowAddPlan] = useState(false);
  const [editingPlan, setEditingPlan] = useState<InsurancePlan | null>(null);
  const [analysis, setAnalysis] = useState<InsuranceAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<InsurancePlan>(DEFAULT_INSURANCE_PLAN);

  useEffect(() => {
    loadInsurancePlans();
  }, [user]);

  useEffect(() => {
    if (plans.length > 0) {
      analyzeInsurance();
    }
  }, [plans, accounts]);

  const loadInsurancePlans = async (): Promise<void> => {
    if (!user?.id) return;
    
    try {
      setLoading(true);
      const savedPlans = await financialPlanningService.getFinancialPlans(user.id, { plan_type: 'insurance' });
      
      if (savedPlans && savedPlans.length > 0) {
        const parsedPlans = savedPlans.map(plan => ({
          ...(plan.data as unknown as InsurancePlan),
          id: plan.id
        }));
        setPlans(parsedPlans);
      }
    } catch (error) {
      console.error('Error loading insurance plans:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateMonthlyIncome = (): number => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    return transactions
      .filter(t => 
        t.type === 'income' && 
        new Date(t.date) >= thirtyDaysAgo
      )
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  };

  const calculateRecommendations = (): InsuranceRecommendation[] => {
    const recommendations: InsuranceRecommendation[] = [];
    
    const monthlyIncome = calculateMonthlyIncome();
    const totalAssets = accounts
      .filter(a => a.type === 'asset' || a.type === 'investment')
      .reduce((sum, a) => sum + a.balance, 0);
    const totalDebts = accounts
      .filter(a => a.type === 'loan' || a.type === 'credit' || a.type === 'mortgage')
      .reduce((sum, a) => sum + Math.abs(a.balance), 0);
    
    // Life insurance recommendation (10x annual income)
    const currentLifeCoverage = plans
      .filter(p => p.type === 'life' && p.isActive)
      .reduce((sum, p) => sum + p.coverageAmount, 0);
    const recommendedLifeCoverage = monthlyIncome * 12 * 10;
    
    if (recommendedLifeCoverage > currentLifeCoverage) {
      recommendations.push({
        type: 'Life Insurance',
        reason: 'Experts recommend 10x annual income for life insurance coverage',
        recommendedCoverage: recommendedLifeCoverage,
        currentCoverage: currentLifeCoverage,
        gap: recommendedLifeCoverage - currentLifeCoverage,
        priority: 'high'
      });
    }
    
    // Disability insurance recommendation (60-80% of income)
    const currentDisabilityCoverage = plans
      .filter(p => p.type === 'disability' && p.isActive)
      .reduce((sum, p) => sum + p.coverageAmount, 0);
    const recommendedDisabilityCoverage = monthlyIncome * 0.7;
    
    if (recommendedDisabilityCoverage > currentDisabilityCoverage) {
      recommendations.push({
        type: 'Disability Insurance',
        reason: 'Disability insurance should cover 60-80% of monthly income',
        recommendedCoverage: recommendedDisabilityCoverage,
        currentCoverage: currentDisabilityCoverage,
        gap: recommendedDisabilityCoverage - currentDisabilityCoverage,
        priority: 'high'
      });
    }
    
    // Umbrella insurance recommendation (if high net worth)
    const netWorth = totalAssets - totalDebts;
    const currentUmbrellaCoverage = plans
      .filter(p => p.type === 'umbrella' && p.isActive)
      .reduce((sum, p) => sum + p.coverageAmount, 0);
    
    if (netWorth > 500000 && currentUmbrellaCoverage < 1000000) {
      recommendations.push({
        type: 'Umbrella Insurance',
        reason: 'High net worth individuals should have umbrella coverage',
        recommendedCoverage: Math.max(1000000, netWorth * 2),
        currentCoverage: currentUmbrellaCoverage,
        gap: Math.max(1000000, netWorth * 2) - currentUmbrellaCoverage,
        priority: 'medium'
      });
    }
    
    // Long-term care insurance
    const currentLTCCoverage = plans
      .filter(p => p.type === 'long-term-care' && p.isActive)
      .reduce((sum, p) => sum + p.coverageAmount, 0);
    
    if (currentLTCCoverage === 0) {
      recommendations.push({
        type: 'Long-Term Care Insurance',
        reason: 'Consider long-term care insurance for future healthcare needs',
        recommendedCoverage: 200000,
        currentCoverage: 0,
        gap: 200000,
        priority: 'low'
      });
    }
    
    return recommendations;
  };

  const analyzeInsurance = (): void => {
    const activePlans = plans.filter(p => p.isActive);
    
    const totalMonthlyPremiums = activePlans.reduce((sum, p) => sum + p.monthlyPremium, 0);
    const totalAnnualPremiums = activePlans.reduce((sum, p) => sum + p.annualPremium, 0);
    const totalCoverage = activePlans.reduce((sum, p) => sum + p.coverageAmount, 0);
    
    const coverageByType = activePlans.reduce((acc, plan) => {
      const type = plan.type;
      acc[type] = (acc[type] || 0) + plan.coverageAmount;
      return acc;
    }, {} as Record<string, number>);
    
    const recommendations = calculateRecommendations();
    
    // Calculate coverage score (0-100)
    let score = 50; // Base score
    
    // Add points for having essential coverage
    if (coverageByType['life']) score += 15;
    if (coverageByType['health']) score += 15;
    if (coverageByType['disability']) score += 10;
    if (coverageByType['property'] || coverageByType['auto']) score += 10;
    
    // Subtract points for high-priority gaps
    recommendations.forEach(rec => {
      if (rec.priority === 'high') score -= 10;
      else if (rec.priority === 'medium') score -= 5;
    });
    
    score = Math.max(0, Math.min(100, score));
    
    setAnalysis({
      totalMonthlyPremiums,
      totalAnnualPremiums,
      totalCoverage,
      coverageByType,
      recommendations,
      coverageScore: score
    });
  };

  const handleSavePlan = async (): Promise<void> => {
    if (!user?.id) return;
    
    try {
      setSaving(true);
      
      // Calculate annual premium if only monthly is provided
      if (formData.monthlyPremium && !formData.annualPremium) {
        formData.annualPremium = formData.monthlyPremium * 12;
      }
      
      // Calculate monthly premium if only annual is provided
      if (formData.annualPremium && !formData.monthlyPremium) {
        formData.monthlyPremium = formData.annualPremium / 12;
      }
      
      const planData = {
        user_id: user.id,
        name: `${formData.type} Insurance - ${formData.provider}`,
        plan_type: 'insurance' as const,
        data: formData as unknown as any,
        region: 'US',
        currency: 'USD',
        is_active: true,
        is_favorite: false,
      };
      
      if (editingPlan?.id) {
        await financialPlanningService.updateFinancialPlan(user.id, editingPlan.id, planData);
        setPlans(prev => prev.map(p => 
          p.id === editingPlan.id ? { ...formData, id: editingPlan.id } : p
        ));
      } else {
        const savedPlan = await financialPlanningService.createFinancialPlan(user.id, planData);
        if (savedPlan) {
          setPlans(prev => [...prev, { ...formData, id: savedPlan.id }]);
        }
      }
      
      // Reset form
      setShowAddPlan(false);
      setEditingPlan(null);
      setFormData(DEFAULT_INSURANCE_PLAN);
    } catch (error) {
      console.error('Error saving insurance plan:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePlan = async (planId: string): Promise<void> => {
    if (!confirm('Are you sure you want to delete this insurance plan?')) return;
    
    try {
      await financialPlanningService.deleteFinancialPlan(user?.id || '', planId);
      setPlans(prev => prev.filter(p => p.id !== planId));
    } catch (error) {
      console.error('Error deleting insurance plan:', error);
    }
  };

  const handleEditPlan = (plan: InsurancePlan): void => {
    setEditingPlan(plan);
    setFormData(plan);
    setShowAddPlan(true);
  };

  const resetForm = (): void => {
    setShowAddPlan(false);
    setEditingPlan(null);
    setFormData(DEFAULT_INSURANCE_PLAN);
  };

  return {
    plans,
    analysis,
    loading,
    saving,
    showAddPlan,
    editingPlan,
    formData,
    setShowAddPlan,
    setFormData,
    handleSavePlan,
    handleDeletePlan,
    handleEditPlan,
    resetForm
  };
}
