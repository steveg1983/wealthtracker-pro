import React, { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContextSupabase';
import { useAuth } from '../contexts/AuthContext';
import { useRegionalCurrency } from '../hooks/useRegionalCurrency';
import { financialPlanningService } from '../services/financialPlanningService';
import Decimal from 'decimal.js';
import { Account } from '../types';

interface InsurancePlan {
  id?: string;
  type: 'life' | 'disability' | 'health' | 'property' | 'auto' | 'umbrella' | 'long-term-care';
  provider: string;
  policyNumber?: string;
  coverageAmount: number;
  deductible: number;
  monthlyPremium: number;
  annualPremium: number;
  startDate: string;
  renewalDate: string;
  beneficiaries?: string[];
  notes?: string;
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

export default function InsurancePlanner(): React.JSX.Element {
  const { accounts, transactions } = useApp();
  const { user } = useAuth();
  const { formatCurrency } = useRegionalCurrency();
  
  const [plans, setPlans] = useState<InsurancePlan[]>([]);
  const [showAddPlan, setShowAddPlan] = useState(false);
  const [editingPlan, setEditingPlan] = useState<InsurancePlan | null>(null);
  const [analysis, setAnalysis] = useState<InsuranceAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState<InsurancePlan>({
    type: 'life',
    provider: '',
    coverageAmount: 0,
    deductible: 0,
    monthlyPremium: 0,
    annualPremium: 0,
    startDate: new Date().toISOString().split('T')[0],
    renewalDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    isActive: true
  });

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
      const savedPlans = await financialPlanningService.getFinancialPlans(user.id, 'insurance');
      
      if (savedPlans && savedPlans.length > 0) {
        const parsedPlans = savedPlans.map(plan => ({
          ...plan.data as InsurancePlan,
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

  const calculateRecommendations = (): InsuranceRecommendation[] => {
    const recommendations: InsuranceRecommendation[] = [];
    
    // Calculate income and assets
    const monthlyIncome = calculateMonthlyIncome();
    const totalAssets = accounts
      .filter(a => a.type === 'asset' || a.type === 'investment')
      .reduce((sum, a) => sum + a.balance, 0);
    const totalDebts = accounts
      .filter(a => a.type === 'liability')
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
    
    // Long-term care insurance (if over 50 or specified)
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
        name: `${formData.type} Insurance - ${formData.provider}`,
        type: 'insurance' as const,
        data: formData
      };
      
      if (editingPlan?.id) {
        await financialPlanningService.updateFinancialPlan(editingPlan.id, planData);
        setPlans(prev => prev.map(p => 
          p.id === editingPlan.id ? { ...formData, id: editingPlan.id } : p
        ));
      } else {
        const savedPlan = await financialPlanningService.saveFinancialPlan(user.id, planData);
        setPlans(prev => [...prev, { ...formData, id: savedPlan.id }]);
      }
      
      // Reset form
      setShowAddPlan(false);
      setEditingPlan(null);
      setFormData({
        type: 'life',
        provider: '',
        coverageAmount: 0,
        deductible: 0,
        monthlyPremium: 0,
        annualPremium: 0,
        startDate: new Date().toISOString().split('T')[0],
        renewalDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        isActive: true
      });
    } catch (error) {
      console.error('Error saving insurance plan:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePlan = async (planId: string): Promise<void> => {
    if (!confirm('Are you sure you want to delete this insurance plan?')) return;
    
    try {
      await financialPlanningService.deleteFinancialPlan(planId);
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
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
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
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
                        className="text-blue-600 hover:text-blue-800"
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
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
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
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
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
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
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
                    onChange={(e) => setFormData({ ...formData, coverageAmount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
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
                    onChange={(e) => setFormData({ ...formData, monthlyPremium: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
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
                    onChange={(e) => setFormData({ ...formData, annualPremium: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
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
                    onChange={(e) => setFormData({ ...formData, deductible: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
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
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
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
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
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
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Additional information about this policy..."
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
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
                  setFormData({
                    type: 'life',
                    provider: '',
                    coverageAmount: 0,
                    deductible: 0,
                    monthlyPremium: 0,
                    annualPremium: 0,
                    startDate: new Date().toISOString().split('T')[0],
                    renewalDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                    isActive: true
                  });
                }}
                className="px-4 py-2 text-gray-700 hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePlan}
                disabled={saving || !formData.provider || formData.coverageAmount <= 0}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
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