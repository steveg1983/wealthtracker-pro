export interface InsurancePlan {
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

export interface InsuranceRecommendation {
  type: string;
  reason: string;
  recommendedCoverage: number;
  currentCoverage: number;
  gap: number;
  priority: 'high' | 'medium' | 'low';
}

export interface InsuranceAnalysis {
  totalMonthlyPremiums: number;
  totalAnnualPremiums: number;
  totalCoverage: number;
  coverageByType: Record<string, number>;
  recommendations: InsuranceRecommendation[];
  coverageScore: number;
}

export const INSURANCE_ICONS: Record<string, string> = {
  life: '❤️',
  disability: '🦽',
  health: '🏥',
  property: '🏠',
  auto: '🚗',
  umbrella: '☂️',
  'long-term-care': '🏥'
};

export const DEFAULT_INSURANCE_PLAN: InsurancePlan = {
  type: 'life',
  provider: '',
  coverageAmount: 0,
  deductible: 0,
  monthlyPremium: 0,
  annualPremium: 0,
  startDate: new Date().toISOString().split('T')[0],
  renewalDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  isActive: true
};