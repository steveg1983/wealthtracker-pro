import React, { useState, useEffect, useCallback } from 'react';
import { RadioCheckbox } from './common/RadioCheckbox';
import { useApp } from '../contexts/AppContextSupabase';
import { useAuth } from '../contexts/AuthContext';
import { useRegionalCurrency } from '../hooks/useRegionalCurrency';
import { useRegionalSettings } from '../hooks/useRegionalSettings';
import { parseCurrencyDecimal } from '../utils/currency-decimal';
import { financialPlanningService } from '../services/financialPlanningService';
import type { FinancialPlan, FinancialPlanCreate } from '../types/financial-plans';

interface InsurancePlan {
  id?: string;
  type: 'life' | 'disability' | 'health' | 'property' | 'auto' | 'umbrella' | 'long-term-care';
  provider: string;
  policyNumber: string;
  coverageAmount: number;
  deductible: number;
  monthlyPremium: number;
  annualPremium: number;
  startDate: string;
  renewalDate: string;
  beneficiaries: string[];
  notes: string;
  isActive: boolean;
}

interface InsuranceRecommendation {
  type: string;
  reason: string;
  recommendedCoverage: number;
  currentCoverage: number;
  gap: number;
  priority: 'high' | 'medium' | 'low';
}

interface InsuranceAnalysis {
  totalMonthlyPremiums: number;
  totalAnnualPremiums: number;
  totalCoverage: number;
  coverageByType: Record<string, number>;
  recommendations: InsuranceRecommendation[];
  coverageScore: number;
}

const isoDate = (value?: string | Date): string => {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length > 0) {
      const [datePart] = trimmed.split('T');
      if (datePart && datePart.length > 0) {
        return datePart;
      }
    }
  }

  return new Date().toISOString().slice(0, 10);
};

const toInsurancePlan = (plan: FinancialPlan): InsurancePlan => {
  const data = (plan.data ?? {}) as Partial<InsurancePlan>;
  return {
    id: plan.id,
    type: data.type ?? 'life',
    provider: data.provider ?? '',
    policyNumber: data.policyNumber ?? '',
    coverageAmount: data.coverageAmount ?? 0,
    deductible: data.deductible ?? 0,
    monthlyPremium: data.monthlyPremium ?? 0,
    annualPremium: data.annualPremium ?? 0,
    startDate: isoDate(data.startDate),
    renewalDate: isoDate(data.renewalDate),
    beneficiaries: Array.isArray(data.beneficiaries) ? data.beneficiaries : [],
    notes: data.notes ?? '',
    isActive: data.isActive ?? plan.is_active
  };
};

const buildDefaultPlan = (): InsurancePlan => ({
  type: 'life',
  provider: '',
  policyNumber: '',
  coverageAmount: 0,
  deductible: 0,
  monthlyPremium: 0,
  annualPremium: 0,
  startDate: isoDate(),
  renewalDate: isoDate(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)),
  beneficiaries: [],
  notes: '',
  isActive: true
});

export default function InsurancePlanner(): React.JSX.Element {
  const { accounts, transactions } = useApp();
  const { user } = useAuth();
  const { formatCurrency, currency } = useRegionalCurrency();
  const { region } = useRegionalSettings();

  const [plans, setPlans] = useState<InsurancePlan[]>([]);
  const [showAddPlan, setShowAddPlan] = useState(false);
  const [editingPlan, setEditingPlan] = useState<InsurancePlan | null>(null);
  const [analysis, setAnalysis] = useState<InsuranceAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState<InsurancePlan>(() => buildDefaultPlan());

  const loadInsurancePlans = useCallback(async (): Promise<void> => {
    if (!user?.id) return;

    try {
      setLoading(true);
      const savedPlans = await financialPlanningService.getFinancialPlans(user.id, { plan_type: 'insurance' });
      const parsedPlans = (savedPlans ?? []).map(toInsurancePlan);
      setPlans(parsedPlans);
      if (parsedPlans.length === 0) {
        setAnalysis(null);
      }
    } catch (error) {
      console.error('Error loading insurance plans:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadInsurancePlans();
  }, [loadInsurancePlans]);

  const calculateMonthlyIncome = useCallback((): number => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    return transactions
      .filter(t =>
        t.type === 'income' &&
        (t.date instanceof Date ? t.date : new Date(t.date)) >= thirtyDaysAgo
      )
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  }, [transactions]);

  const calculateRecommendations = useCallback((): InsuranceRecommendation[] => {
    const recommendations: InsuranceRecommendation[] = [];

    const monthlyIncome = calculateMonthlyIncome();
    const totalAssets = accounts
      .filter(a => ['asset', 'investment'].includes(a.type))
      .reduce((sum, a) => sum + a.balance, 0);
    const totalDebts = accounts
      .filter(a => ['loan', 'credit', 'mortgage'].includes(a.type))
      .reduce((sum, a) => sum + Math.abs(a.balance), 0);

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

    const netWorth = totalAssets - totalDebts;
    const currentUmbrellaCoverage = plans
      .filter(p => p.type === 'umbrella' && p.isActive)
      .reduce((sum, p) => sum + p.coverageAmount, 0);

    if (netWorth > 500000 && currentUmbrellaCoverage < 1000000) {
      const recommendedCoverage = Math.max(1000000, netWorth * 2);
      recommendations.push({
        type: 'Umbrella Insurance',
        reason: 'High net worth individuals should have umbrella coverage',
        recommendedCoverage,
        currentCoverage: currentUmbrellaCoverage,
        gap: recommendedCoverage - currentUmbrellaCoverage,
        priority: 'medium'
      });
    }

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
  }, [accounts, calculateMonthlyIncome, plans]);

  const analyzeInsurance = useCallback((): void => {
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

    let score = 50;
    if (coverageByType['life']) score += 15;
    if (coverageByType['health']) score += 15;
    if (coverageByType['disability']) score += 10;
    if (coverageByType['property'] || coverageByType['auto']) score += 10;

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
  }, [calculateRecommendations, plans]);

  useEffect(() => {
    if (plans.length > 0) {
      analyzeInsurance();
    } else {
      setAnalysis(null);
    }
  }, [analyzeInsurance, plans.length]);

  const handleSavePlan = async (): Promise<void> => {
    if (!user?.id) return;
    
    try {
      setSaving(true);
      
      const monthlyPremium = formData.monthlyPremium || (formData.annualPremium ? formData.annualPremium / 12 : 0);
      const annualPremium = formData.annualPremium || (formData.monthlyPremium ? formData.monthlyPremium * 12 : 0);

      const noteText = formData.notes ? formData.notes.trim() : '';

      const normalizedPlan: InsurancePlan = {
        ...formData,
        provider: formData.provider.trim(),
        coverageAmount: Number.isFinite(formData.coverageAmount) ? formData.coverageAmount : 0,
        deductible: Number.isFinite(formData.deductible) ? formData.deductible : 0,
        monthlyPremium,
        annualPremium,
        startDate: isoDate(formData.startDate),
        renewalDate: isoDate(formData.renewalDate),
        beneficiaries: formData.beneficiaries ?? [],
        notes: noteText
      };

      const formatPlanLabel = (value: string): string => value
        .split('-')
        .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
        .join(' ');

      const { id: existingId, ...planDetails } = normalizedPlan;
      const planName = normalizedPlan.provider
        ? `${formatPlanLabel(normalizedPlan.type)} - ${normalizedPlan.provider}`
        : `${formatPlanLabel(normalizedPlan.type)} Plan`;

      const planPayload: Omit<FinancialPlanCreate, 'user_id'> = {
        plan_type: 'insurance',
        name: planName,
        description: planDetails.notes,
        data: {
          ...planDetails,
          notes: planDetails.notes
        },
        region,
        currency,
        is_active: planDetails.isActive,
        is_favorite: false
      };

      if (editingPlan?.id) {
        const updatedPlan = await financialPlanningService.updateFinancialPlan(
          user.id,
          editingPlan.id,
          planPayload
        );

        if (updatedPlan) {
          const mapped = toInsurancePlan(updatedPlan);
          setPlans(prev => prev.map(p => (p.id === editingPlan.id ? mapped : p)));
        }
      } else {
        const createdPlan = await financialPlanningService.createFinancialPlan(
          user.id,
          { ...planPayload, user_id: '' } as FinancialPlanCreate
        );

        if (createdPlan) {
          setPlans(prev => [...prev, toInsurancePlan(createdPlan)]);
        }
      }

      await loadInsurancePlans();

      setShowAddPlan(false);
      setEditingPlan(null);
      setFormData(buildDefaultPlan());
    } catch (error) {
      console.error('Error saving insurance plan:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePlan = async (planId: string): Promise<void> => {
    if (!confirm('Are you sure you want to delete this insurance plan?')) return;
    
    try {
      if (!user?.id) return;

      await financialPlanningService.deleteFinancialPlan(user.id, planId);
      setPlans(prev => {
        const nextPlans = prev.filter(p => p.id !== planId);
        if (nextPlans.length === 0) {
          setAnalysis(null);
        }
        return nextPlans;
      });
      await loadInsurancePlans();
    } catch (error) {
      console.error('Error deleting insurance plan:', error);
    }
  };

  const handleEditPlan = (plan: InsurancePlan): void => {
    const sanitized: InsurancePlan = {
      ...plan,
      startDate: isoDate(plan.startDate),
      renewalDate: isoDate(plan.renewalDate),
      beneficiaries: plan.beneficiaries ?? []
    };
    setEditingPlan(sanitized);
    setFormData(sanitized);
    setShowAddPlan(true);
  };

  const getCoverageScoreColor = (score: number): string => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getInsuranceIcon = (type: string): string => {
    const icons: Record<string, string> = {
      life: '❤️',
      disability: '🦽',
      health: '🏥',
      property: '🏠',
      auto: '🚗',
      umbrella: '☂️',
      'long-term-care': '🏥'
    };
    return icons[type] || '📋';
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-6">
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Insurance Planner</h2>
          <button
            onClick={() => setShowAddPlan(true)}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Add Insurance Plan
          </button>
        </div>

        {analysis && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Coverage Score</p>
              <p className={`text-2xl font-bold ${getCoverageScoreColor(analysis.coverageScore)}`}>
                {analysis.coverageScore}/100
              </p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Monthly Premiums</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(analysis.totalMonthlyPremiums)}
              </p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Annual Premiums</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(analysis.totalAnnualPremiums)}
              </p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Total Coverage</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(analysis.totalCoverage)}
              </p>
            </div>
          </div>
        )}

        {/* Current Insurance Plans */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Current Insurance Plans</h3>
          {plans.length === 0 ? (
            <p className="text-gray-500">No insurance plans added yet.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {plans.map(plan => (
                <div key={plan.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center">
                      <span className="text-2xl mr-2">{getInsuranceIcon(plan.type)}</span>
                      <div>
                        <h4 className="font-semibold capitalize">{plan.type.replace('-', ' ')}</h4>
                        <p className="text-sm text-gray-600">{plan.provider}</p>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleEditPlan(plan)}
                        className="text-gray-600 hover:text-blue-800"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => plan.id && handleDeletePlan(plan.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Coverage:</span>
                      <span className="font-medium">{formatCurrency(plan.coverageAmount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Monthly:</span>
                      <span className="font-medium">{formatCurrency(plan.monthlyPremium)}</span>
                    </div>
                    {plan.deductible > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Deductible:</span>
                        <span className="font-medium">{formatCurrency(plan.deductible)}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-600">Renewal:</span>
                      <span className="font-medium">
                        {new Date(plan.renewalDate).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Status:</span>
                      <span className={`font-medium ${plan.isActive ? 'text-green-600' : 'text-gray-400'}`}>
                        {plan.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recommendations */}
        {analysis && analysis.recommendations.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Coverage Recommendations</h3>
            <div className="space-y-3">
              {analysis.recommendations.map((rec, index) => (
                <div key={index} className="border rounded-lg p-4 bg-gray-50">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center mb-2">
                        <h4 className="font-semibold text-gray-900">{rec.type}</h4>
                        <span className={`ml-2 px-2 py-1 text-xs rounded-full ${
                          rec.priority === 'high' ? 'bg-red-100 text-red-700' :
                          rec.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {rec.priority} priority
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{rec.reason}</p>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Current:</span>
                          <p className="font-medium">{formatCurrency(rec.currentCoverage)}</p>
                        </div>
                        <div>
                          <span className="text-gray-600">Recommended:</span>
                          <p className="font-medium">{formatCurrency(rec.recommendedCoverage)}</p>
                        </div>
                        <div>
                          <span className="text-gray-600">Gap:</span>
                          <p className="font-medium text-red-600">{formatCurrency(rec.gap)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Insurance Plan Modal */}
      {showAddPlan && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">
              {editingPlan ? 'Edit Insurance Plan' : 'Add Insurance Plan'}
            </h3>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Insurance Type
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as InsurancePlan['type'] })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-gray-500"
                  >
                    <option value="life">Life Insurance</option>
                    <option value="disability">Disability Insurance</option>
                    <option value="health">Health Insurance</option>
                    <option value="property">Property Insurance</option>
                    <option value="auto">Auto Insurance</option>
                    <option value="umbrella">Umbrella Insurance</option>
                    <option value="long-term-care">Long-Term Care</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Provider
                  </label>
                  <input
                    type="text"
                    value={formData.provider}
                    onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-gray-500"
                    placeholder="Insurance company name"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Policy Number (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.policyNumber || ''}
                    onChange={(e) => setFormData({ ...formData, policyNumber: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-gray-500"
                    placeholder="Policy #"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Coverage Amount
                  </label>
                  <input
                    type="number"
                    value={formData.coverageAmount}
                    onChange={(e) => setFormData({ ...formData, coverageAmount: parseCurrencyDecimal(e.target.value || '0').toNumber() })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-gray-500"
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Monthly Premium
                  </label>
                  <input
                    type="number"
                    value={formData.monthlyPremium}
                    onChange={(e) => setFormData({ ...formData, monthlyPremium: parseCurrencyDecimal(e.target.value || '0').toNumber() })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-gray-500"
                    placeholder="0"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Annual Premium
                  </label>
                  <input
                    type="number"
                    value={formData.annualPremium}
                    onChange={(e) => setFormData({ ...formData, annualPremium: parseCurrencyDecimal(e.target.value || '0').toNumber() })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-gray-500"
                    placeholder="0"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Deductible
                  </label>
                  <input
                    type="number"
                    value={formData.deductible}
                    onChange={(e) => setFormData({ ...formData, deductible: parseCurrencyDecimal(e.target.value || '0').toNumber() })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-gray-500"
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-gray-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Renewal Date
                  </label>
                  <input
                    type="date"
                    value={formData.renewalDate}
                    onChange={(e) => setFormData({ ...formData, renewalDate: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-gray-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes (Optional)
                </label>
                <textarea
                  value={formData.notes || ''}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-gray-500"
                  rows={3}
                  placeholder="Additional information about this policy..."
                />
              </div>

              <div className="flex items-center">
                <RadioCheckbox
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(checked) => setFormData({ ...formData, isActive: checked })}
                  className="mr-2"
                />
                <label htmlFor="isActive" className="text-sm font-medium text-gray-700">
                  Active Policy
                </label>
              </div>
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowAddPlan(false);
                  setEditingPlan(null);
                  setFormData(buildDefaultPlan());
                }}
                className="px-4 py-2 text-gray-700 hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePlan}
                disabled={saving || !formData.provider || formData.coverageAmount <= 0}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : editingPlan ? 'Update Plan' : 'Add Plan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
