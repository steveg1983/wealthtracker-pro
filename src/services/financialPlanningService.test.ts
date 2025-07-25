import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type {
  RetirementPlan,
  MortgageCalculation,
  CollegePlan,
  DebtPayoffPlan,
  FinancialGoal,
  InsuranceNeed
} from './financialPlanningService';

// Mock localStorage
const localStorageMock = {
  store: {} as Record<string, string>,
  getItem: vi.fn((key: string) => localStorageMock.store[key] || null),
  setItem: vi.fn((key: string, value: string) => { localStorageMock.store[key] = value; }),
  removeItem: vi.fn((key: string) => { delete localStorageMock.store[key]; }),
  clear: vi.fn(() => { localStorageMock.store = {}; })
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true
});

// Import after mocking localStorage
import { financialPlanningService } from './financialPlanningService';

describe('FinancialPlanningService', () => {
  // Store initial state
  let initialRetirementPlans: RetirementPlan[] = [];
  let initialMortgageCalculations: MortgageCalculation[] = [];
  let initialCollegePlans: CollegePlan[] = [];
  let initialDebtPlans: DebtPayoffPlan[] = [];
  let initialFinancialGoals: FinancialGoal[] = [];
  let initialInsuranceNeeds: InsuranceNeed[] = [];

  beforeEach(() => {
    vi.clearAllMocks();
    // Store initial state (service creates sample data on initialization)
    initialRetirementPlans = [...financialPlanningService.getRetirementPlans()];
    initialMortgageCalculations = [...financialPlanningService.getMortgageCalculations()];
    initialCollegePlans = [...financialPlanningService.getCollegePlans()];
    initialDebtPlans = [...financialPlanningService.getDebtPlans()];
    initialFinancialGoals = [...financialPlanningService.getFinancialGoals()];
    initialInsuranceNeeds = [...financialPlanningService.getInsuranceNeeds()];
  });

  afterEach(() => {
    // Clean up any added items
    const currentRetirementPlans = financialPlanningService.getRetirementPlans();
    const currentMortgageCalcs = financialPlanningService.getMortgageCalculations();
    const currentCollegePlans = financialPlanningService.getCollegePlans();
    const currentDebtPlans = financialPlanningService.getDebtPlans();
    const currentGoals = financialPlanningService.getFinancialGoals();
    const currentNeeds = financialPlanningService.getInsuranceNeeds();

    // Remove any items not in initial state
    currentRetirementPlans.forEach(plan => {
      if (!initialRetirementPlans.find(p => p.id === plan.id)) {
        financialPlanningService.deleteRetirementPlan(plan.id);
      }
    });
    currentMortgageCalcs.forEach(calc => {
      if (!initialMortgageCalculations.find(c => c.id === calc.id)) {
        financialPlanningService.deleteMortgageCalculation(calc.id);
      }
    });
    currentCollegePlans.forEach(plan => {
      if (!initialCollegePlans.find(p => p.id === plan.id)) {
        financialPlanningService.deleteCollegePlan(plan.id);
      }
    });
    currentDebtPlans.forEach(plan => {
      if (!initialDebtPlans.find(p => p.id === plan.id)) {
        financialPlanningService.deleteDebtPlan(plan.id);
      }
    });
    currentGoals.forEach(goal => {
      if (!initialFinancialGoals.find(g => g.id === goal.id)) {
        financialPlanningService.deleteFinancialGoal(goal.id);
      }
    });
    currentNeeds.forEach(need => {
      if (!initialInsuranceNeeds.find(n => n.id === need.id)) {
        financialPlanningService.deleteInsuranceNeed(need.id);
      }
    });
  });

  describe('Retirement Planning', () => {
    const mockRetirementPlan: Omit<RetirementPlan, 'id' | 'createdAt' | 'lastUpdated'> = {
      name: 'Test Retirement Plan',
      currentAge: 30,
      retirementAge: 65,
      currentSavings: 50000,
      monthlyContribution: 1000,
      expectedReturn: 0.07,
      inflationRate: 0.03,
      targetRetirementIncome: 5000
    };

    it('should get initial retirement plans with sample data', () => {
      const plans = financialPlanningService.getRetirementPlans();
      expect(plans.length).toBeGreaterThanOrEqual(1);
      expect(plans[0].name).toBe('Primary Retirement Plan');
    });

    it('should add a new retirement plan', () => {
      const initialCount = financialPlanningService.getRetirementPlans().length;
      const newPlan = financialPlanningService.addRetirementPlan(mockRetirementPlan);
      
      expect(newPlan).toMatchObject(mockRetirementPlan);
      expect(newPlan.id).toBeDefined();
      expect(newPlan.createdAt).toBeInstanceOf(Date);
      expect(newPlan.lastUpdated).toBeInstanceOf(Date);
      
      const plans = financialPlanningService.getRetirementPlans();
      expect(plans).toHaveLength(initialCount + 1);
    });

    it('should update an existing retirement plan', () => {
      const plans = financialPlanningService.getRetirementPlans();
      const planId = plans[0].id;
      const originalDate = plans[0].createdAt;
      
      const updates = { monthlyContribution: 1500, currentAge: 36 };
      const updatedPlan = financialPlanningService.updateRetirementPlan(planId, updates);
      
      expect(updatedPlan).not.toBeNull();
      expect(updatedPlan?.monthlyContribution).toBe(1500);
      expect(updatedPlan?.currentAge).toBe(36);
      expect(updatedPlan?.createdAt).toEqual(originalDate);
      expect(updatedPlan?.lastUpdated.getTime()).toBeGreaterThan(originalDate.getTime());
    });

    it('should return null when updating non-existent plan', () => {
      const result = financialPlanningService.updateRetirementPlan('non-existent', {});
      expect(result).toBeNull();
    });

    it('should delete a retirement plan', () => {
      const newPlan = financialPlanningService.addRetirementPlan(mockRetirementPlan);
      const planId = newPlan.id;
      const countBefore = financialPlanningService.getRetirementPlans().length;
      
      const result = financialPlanningService.deleteRetirementPlan(planId);
      expect(result).toBe(true);
      
      const remainingPlans = financialPlanningService.getRetirementPlans();
      expect(remainingPlans).toHaveLength(countBefore - 1);
      expect(remainingPlans.find(p => p.id === planId)).toBeUndefined();
    });

    it('should return false when deleting non-existent plan', () => {
      const result = financialPlanningService.deleteRetirementPlan('non-existent');
      expect(result).toBe(false);
    });

    it('should calculate retirement projection correctly', () => {
      const plan = financialPlanningService.getRetirementPlans()[0];
      const projection = financialPlanningService.calculateRetirementProjection(plan);
      
      expect(projection.yearsToRetirement).toBe(plan.retirementAge - plan.currentAge);
      expect(projection.totalSavingsAtRetirement).toBeGreaterThan(plan.currentSavings);
      expect(projection.monthlyIncomeAvailable).toBeGreaterThan(0);
      expect(projection.projectionsByYear).toHaveLength(plan.retirementAge - plan.currentAge);
      
      // Check year-by-year projections
      const firstYear = projection.projectionsByYear[0];
      expect(firstYear.year).toBe(1);
      expect(firstYear.age).toBe(plan.currentAge + 1);
      expect(firstYear.contribution).toBe(plan.monthlyContribution * 12);
      expect(firstYear.growth).toBeGreaterThan(0);
      
      // Balance should increase each year
      for (let i = 1; i < projection.projectionsByYear.length; i++) {
        expect(projection.projectionsByYear[i].balance).toBeGreaterThan(
          projection.projectionsByYear[i - 1].balance
        );
      }
    });

    it('should calculate recommended contribution when there is a shortfall', () => {
      const plan: RetirementPlan = {
        ...mockRetirementPlan,
        id: '1',
        currentSavings: 10000, // Low savings
        monthlyContribution: 200, // Low contribution
        targetRetirementIncome: 10000, // High target
        createdAt: new Date(),
        lastUpdated: new Date()
      };
      
      const projection = financialPlanningService.calculateRetirementProjection(plan);
      expect(projection.shortfall).toBeGreaterThan(0);
      expect(projection.recommendedMonthlyContribution).toBeGreaterThan(plan.monthlyContribution);
    });
  });

  describe('Mortgage Calculations', () => {
    it('should get initial mortgage calculations with sample data', () => {
      const calculations = financialPlanningService.getMortgageCalculations();
      expect(calculations.length).toBeGreaterThanOrEqual(1);
      expect(calculations[0].loanAmount).toBe(400000);
    });

    it('should calculate mortgage correctly', () => {
      const loanAmount = 300000;
      const annualRate = 0.05;
      const years = 30;
      
      const calculation = financialPlanningService.calculateMortgage(loanAmount, annualRate, years);
      
      expect(calculation.loanAmount).toBe(loanAmount);
      expect(calculation.interestRate).toBe(annualRate);
      expect(calculation.loanTermYears).toBe(years);
      expect(calculation.monthlyPayment).toBeGreaterThan(0);
      expect(calculation.totalInterest).toBeGreaterThan(0);
      expect(calculation.totalCost).toBe(calculation.loanAmount + calculation.totalInterest);
      expect(calculation.amortizationSchedule).toHaveLength(360); // 30 years * 12 months
      
      // Check first payment
      const firstPayment = calculation.amortizationSchedule[0];
      expect(firstPayment.paymentNumber).toBe(1);
      expect(firstPayment.monthlyPayment).toBe(calculation.monthlyPayment);
      expect(firstPayment.principalPayment).toBeGreaterThan(0);
      expect(firstPayment.interestPayment).toBeGreaterThan(0);
      expect(firstPayment.principalPayment + firstPayment.interestPayment).toBeCloseTo(calculation.monthlyPayment, 2);
      
      // Check last payment
      const lastPayment = calculation.amortizationSchedule[calculation.amortizationSchedule.length - 1];
      expect(lastPayment.remainingBalance).toBeCloseTo(0, 2);
      
      // Interest should decrease over time, principal should increase
      const midPayment = calculation.amortizationSchedule[180];
      expect(midPayment.interestPayment).toBeLessThan(firstPayment.interestPayment);
      expect(midPayment.principalPayment).toBeGreaterThan(firstPayment.principalPayment);
    });

    it('should delete a mortgage calculation', () => {
      const initialCalcs = financialPlanningService.getMortgageCalculations();
      const initialCount = initialCalcs.length;
      const initialIds = initialCalcs.map(c => c.id);
      
      const calculation = financialPlanningService.calculateMortgage(250000, 0.045, 15);
      const calcId = calculation.id;
      
      // Verify it was added
      const afterAddCalcs = financialPlanningService.getMortgageCalculations();
      expect(afterAddCalcs).toHaveLength(initialCount + 1);
      expect(afterAddCalcs.find(c => c.id === calcId)).toBeDefined();
      
      const result = financialPlanningService.deleteMortgageCalculation(calcId);
      expect(result).toBe(true);
      
      const remaining = financialPlanningService.getMortgageCalculations();
      expect(remaining).toHaveLength(initialCount);
      // Verify the specific calculation was removed
      expect(remaining.find(c => c.id === calcId && !initialIds.includes(c.id))).toBeUndefined();
    });

    it('should return false when deleting non-existent calculation', () => {
      const result = financialPlanningService.deleteMortgageCalculation('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('College Planning', () => {
    const mockCollegePlan: Omit<CollegePlan, 'id' | 'createdAt'> = {
      childName: 'Test Child',
      currentAge: 5,
      collegeStartAge: 18,
      currentSavings: 10000,
      monthlyContribution: 500,
      expectedReturn: 0.06,
      estimatedCost: 150000,
      inflationRate: 0.04
    };

    it('should get initial college plans with sample data', () => {
      const plans = financialPlanningService.getCollegePlans();
      expect(plans.length).toBeGreaterThanOrEqual(1);
      expect(plans[0].childName).toBe('Emma');
    });

    it('should add a new college plan', () => {
      const initialCount = financialPlanningService.getCollegePlans().length;
      const newPlan = financialPlanningService.addCollegePlan(mockCollegePlan);
      
      expect(newPlan).toMatchObject(mockCollegePlan);
      expect(newPlan.id).toBeDefined();
      expect(newPlan.createdAt).toBeInstanceOf(Date);
      
      const plans = financialPlanningService.getCollegePlans();
      expect(plans).toHaveLength(initialCount + 1);
    });

    it('should update a college plan', () => {
      const plans = financialPlanningService.getCollegePlans();
      const planId = plans[0].id;
      
      const updates = { monthlyContribution: 400, currentAge: 9 };
      const updatedPlan = financialPlanningService.updateCollegePlan(planId, updates);
      
      expect(updatedPlan).not.toBeNull();
      expect(updatedPlan?.monthlyContribution).toBe(400);
      expect(updatedPlan?.currentAge).toBe(9);
    });

    it('should delete a college plan', () => {
      const newPlan = financialPlanningService.addCollegePlan(mockCollegePlan);
      const planId = newPlan.id;
      
      const result = financialPlanningService.deleteCollegePlan(planId);
      expect(result).toBe(true);
      
      const remaining = financialPlanningService.getCollegePlans();
      expect(remaining.find(p => p.id === planId)).toBeUndefined();
    });

    it('should calculate college projection correctly', () => {
      const plan = financialPlanningService.getCollegePlans()[0];
      const projection = financialPlanningService.calculateCollegeProjection(plan);
      
      expect(projection.yearsToCollegeStart).toBe(plan.collegeStartAge - plan.currentAge);
      expect(projection.totalSavingsAtCollegeStart).toBeGreaterThan(plan.currentSavings);
      expect(projection.adjustedCollegeCost).toBeGreaterThan(plan.estimatedCost);
      expect(projection.projectionsByYear).toHaveLength(plan.collegeStartAge - plan.currentAge);
      
      // Check projections
      const firstYear = projection.projectionsByYear[0];
      expect(firstYear.year).toBe(1);
      expect(firstYear.childAge).toBe(plan.currentAge + 1);
      expect(firstYear.contribution).toBe(plan.monthlyContribution * 12);
      expect(firstYear.growth).toBeGreaterThan(0);
    });

    it('should calculate recommended contribution when there is a shortfall', () => {
      const plan: CollegePlan = {
        ...mockCollegePlan,
        id: '1',
        currentSavings: 1000, // Low savings
        monthlyContribution: 100, // Low contribution
        estimatedCost: 300000, // High cost
        createdAt: new Date()
      };
      
      const projection = financialPlanningService.calculateCollegeProjection(plan);
      expect(projection.shortfall).toBeGreaterThan(0);
      expect(projection.recommendedMonthlyContribution).toBeGreaterThan(plan.monthlyContribution);
    });
  });

  describe('Debt Payoff Planning', () => {
    const mockDebtPlan: Omit<DebtPayoffPlan, 'id' | 'createdAt'> = {
      debtName: 'Test Debt',
      currentBalance: 5000,
      interestRate: 0.15,
      minimumPayment: 150,
      additionalPayment: 50,
      strategy: 'avalanche'
    };

    it('should get initial debt plans with sample data', () => {
      const plans = financialPlanningService.getDebtPlans();
      expect(plans.length).toBeGreaterThanOrEqual(1);
      expect(plans[0].debtName).toBe('Credit Card Debt');
    });

    it('should add a new debt plan', () => {
      const initialCount = financialPlanningService.getDebtPlans().length;
      const newPlan = financialPlanningService.addDebtPlan(mockDebtPlan);
      
      expect(newPlan).toMatchObject(mockDebtPlan);
      expect(newPlan.id).toBeDefined();
      expect(newPlan.createdAt).toBeInstanceOf(Date);
      
      const plans = financialPlanningService.getDebtPlans();
      expect(plans).toHaveLength(initialCount + 1);
    });

    it('should update a debt plan', () => {
      const plans = financialPlanningService.getDebtPlans();
      const planId = plans[0].id;
      
      const updates = { additionalPayment: 200, strategy: 'snowball' as const };
      const updatedPlan = financialPlanningService.updateDebtPlan(planId, updates);
      
      expect(updatedPlan).not.toBeNull();
      expect(updatedPlan?.additionalPayment).toBe(200);
      expect(updatedPlan?.strategy).toBe('snowball');
    });

    it('should delete a debt plan', () => {
      const newPlan = financialPlanningService.addDebtPlan(mockDebtPlan);
      const planId = newPlan.id;
      
      const result = financialPlanningService.deleteDebtPlan(planId);
      expect(result).toBe(true);
      
      const remaining = financialPlanningService.getDebtPlans();
      expect(remaining.find(p => p.id === planId)).toBeUndefined();
    });

    it('should calculate debt payoff correctly', () => {
      const plan = financialPlanningService.getDebtPlans()[0];
      const projection = financialPlanningService.calculateDebtPayoff(plan);
      
      expect(projection.monthsToPayoff).toBeGreaterThan(0);
      expect(projection.totalInterest).toBeGreaterThan(0);
      expect(projection.totalPaid).toBeCloseTo(plan.currentBalance + projection.totalInterest, 2);
      expect(projection.payoffDate).toBeInstanceOf(Date);
      expect(projection.paymentSchedule.length).toBe(projection.monthsToPayoff);
      
      // Check payment schedule
      const firstPayment = projection.paymentSchedule[0];
      expect(firstPayment.month).toBe(1);
      expect(firstPayment.payment).toBeGreaterThan(0);
      expect(firstPayment.principal).toBeGreaterThan(0);
      expect(firstPayment.interest).toBeGreaterThan(0);
      
      // Last payment should have zero remaining balance
      const lastPayment = projection.paymentSchedule[projection.paymentSchedule.length - 1];
      expect(lastPayment.remainingBalance).toBe(0);
    });

    it('should handle minimum payment scenarios', () => {
      const plan: DebtPayoffPlan = {
        ...mockDebtPlan,
        id: '1',
        currentBalance: 10000,
        interestRate: 0.20,
        minimumPayment: 200,
        additionalPayment: 0,
        createdAt: new Date()
      };
      
      const projection = financialPlanningService.calculateDebtPayoff(plan);
      expect(projection.monthsToPayoff).toBeGreaterThan(60); // Should take many years
      expect(projection.totalInterest).toBeGreaterThan(plan.currentBalance * 0.5); // High interest
    });
  });

  describe('Financial Goals', () => {
    const mockGoal: Omit<FinancialGoal, 'id' | 'createdAt'> = {
      name: 'Test Goal',
      targetAmount: 20000,
      currentSavings: 5000,
      monthlyContribution: 500,
      targetDate: new Date(new Date().setFullYear(new Date().getFullYear() + 2)),
      priority: 'high',
      category: 'home',
      expectedReturn: 0.05
    };

    it('should get initial financial goals with sample data', () => {
      const goals = financialPlanningService.getFinancialGoals();
      expect(goals.length).toBeGreaterThanOrEqual(2);
      expect(goals[0].name).toBe('Emergency Fund');
      expect(goals[1].name).toBe('European Vacation');
    });

    it('should add a new financial goal', () => {
      const initialCount = financialPlanningService.getFinancialGoals().length;
      const newGoal = financialPlanningService.addFinancialGoal(mockGoal);
      
      expect(newGoal).toMatchObject(mockGoal);
      expect(newGoal.id).toBeDefined();
      expect(newGoal.createdAt).toBeInstanceOf(Date);
      
      const goals = financialPlanningService.getFinancialGoals();
      expect(goals).toHaveLength(initialCount + 1);
    });

    it('should update a financial goal', () => {
      const goals = financialPlanningService.getFinancialGoals();
      const goalId = goals[0].id;
      
      const updates = { monthlyContribution: 600, priority: 'medium' as const };
      const updatedGoal = financialPlanningService.updateFinancialGoal(goalId, updates);
      
      expect(updatedGoal).not.toBeNull();
      expect(updatedGoal?.monthlyContribution).toBe(600);
      expect(updatedGoal?.priority).toBe('medium');
    });

    it('should delete a financial goal', () => {
      const newGoal = financialPlanningService.addFinancialGoal(mockGoal);
      const goalId = newGoal.id;
      
      const result = financialPlanningService.deleteFinancialGoal(goalId);
      expect(result).toBe(true);
      
      const remaining = financialPlanningService.getFinancialGoals();
      expect(remaining.find(g => g.id === goalId)).toBeUndefined();
    });

    it('should calculate goal projection correctly', () => {
      const goal = financialPlanningService.getFinancialGoals()[0];
      const projection = financialPlanningService.calculateGoalProjection(goal);
      
      expect(projection.monthsToGoal).toBeGreaterThan(0);
      expect(projection.projectedAmount).toBeGreaterThan(goal.currentSavings);
      expect(projection.projectionsByMonth).toHaveLength(Math.min(projection.monthsToGoal, 120));
      
      if (projection.projectedAmount >= goal.targetAmount) {
        expect(projection.onTrack).toBe(true);
        expect(projection.shortfall).toBe(0);
      } else {
        expect(projection.onTrack).toBe(false);
        expect(projection.shortfall).toBeGreaterThan(0);
        expect(projection.recommendedMonthlyContribution).toBeGreaterThan(goal.monthlyContribution);
      }
    });

    it('should handle very short-term goals', () => {
      const goal: FinancialGoal = {
        ...mockGoal,
        id: '1',
        targetDate: new Date(new Date().setMonth(new Date().getMonth() + 1)),
        createdAt: new Date()
      };
      
      const projection = financialPlanningService.calculateGoalProjection(goal);
      expect(projection.monthsToGoal).toBeGreaterThanOrEqual(1);
      expect(projection.projectionsByMonth).toHaveLength(Math.min(projection.monthsToGoal, 120));
    });
  });

  describe('Insurance Planning', () => {
    const mockInsuranceNeed: Omit<InsuranceNeed, 'id' | 'createdAt'> = {
      type: 'auto',
      currentCoverage: 50000,
      recommendedCoverage: 100000,
      monthlyPremium: 150,
      provider: 'Test Insurance Co',
      notes: 'Test notes'
    };

    it('should get initial insurance needs with sample data', () => {
      const needs = financialPlanningService.getInsuranceNeeds();
      expect(needs.length).toBeGreaterThanOrEqual(2);
      expect(needs[0].type).toBe('life');
      expect(needs[1].type).toBe('disability');
    });

    it('should add a new insurance need', () => {
      const initialCount = financialPlanningService.getInsuranceNeeds().length;
      const newNeed = financialPlanningService.addInsuranceNeed(mockInsuranceNeed);
      
      expect(newNeed).toMatchObject(mockInsuranceNeed);
      expect(newNeed.id).toBeDefined();
      expect(newNeed.createdAt).toBeInstanceOf(Date);
      
      const needs = financialPlanningService.getInsuranceNeeds();
      expect(needs).toHaveLength(initialCount + 1);
    });

    it('should update an insurance need', () => {
      const needs = financialPlanningService.getInsuranceNeeds();
      const needId = needs[0].id;
      
      const updates = { monthlyPremium: 100, provider: 'New Provider' };
      const updatedNeed = financialPlanningService.updateInsuranceNeed(needId, updates);
      
      expect(updatedNeed).not.toBeNull();
      expect(updatedNeed?.monthlyPremium).toBe(100);
      expect(updatedNeed?.provider).toBe('New Provider');
    });

    it('should delete an insurance need', () => {
      const newNeed = financialPlanningService.addInsuranceNeed(mockInsuranceNeed);
      const needId = newNeed.id;
      
      const result = financialPlanningService.deleteInsuranceNeed(needId);
      expect(result).toBe(true);
      
      const remaining = financialPlanningService.getInsuranceNeeds();
      expect(remaining.find(n => n.id === needId)).toBeUndefined();
    });
  });

  describe('Net Worth Projections', () => {
    it('should calculate net worth projection correctly', () => {
      const currentNetWorth = 100000;
      const monthlyIncome = 8000;
      const monthlyExpenses = 5000;
      const expectedReturn = 0.07;
      const timeframe = 10;
      
      const projection = financialPlanningService.calculateNetWorthProjection(
        currentNetWorth,
        monthlyIncome,
        monthlyExpenses,
        expectedReturn,
        timeframe
      );
      
      expect(projection.currentNetWorth).toBe(currentNetWorth);
      expect(projection.projectedNetWorth).toBeGreaterThan(currentNetWorth);
      expect(projection.growthRate).toBeGreaterThan(0);
      expect(projection.timeframe).toBe(timeframe);
      expect(projection.projectionsByYear).toHaveLength(timeframe);
      
      // Check year-over-year growth
      for (let i = 1; i < projection.projectionsByYear.length; i++) {
        const prevYear = projection.projectionsByYear[i - 1];
        const currentYear = projection.projectionsByYear[i];
        expect(currentYear.netWorth).toBeGreaterThan(prevYear.netWorth);
        expect(currentYear.assets).toBeGreaterThan(prevYear.assets);
        // Liabilities should decrease or stay the same
        expect(currentYear.liabilities).toBeLessThanOrEqual(prevYear.liabilities);
      }
    });

    it('should handle negative net worth scenarios', () => {
      const currentNetWorth = -50000; // Negative net worth
      const monthlyIncome = 5000;
      const monthlyExpenses = 4000;
      const expectedReturn = 0.05;
      const timeframe = 5;
      
      const projection = financialPlanningService.calculateNetWorthProjection(
        currentNetWorth,
        monthlyIncome,
        monthlyExpenses,
        expectedReturn,
        timeframe
      );
      
      expect(projection.currentNetWorth).toBe(currentNetWorth);
      // Should improve over time with positive cash flow
      expect(projection.projectedNetWorth).toBeGreaterThan(currentNetWorth);
    });
  });

  describe('Data Persistence', () => {
    it('should save data to localStorage', () => {
      financialPlanningService.addRetirementPlan({
        name: 'Test Save Plan',
        currentAge: 40,
        retirementAge: 65,
        currentSavings: 100000,
        monthlyContribution: 2000,
        expectedReturn: 0.06,
        inflationRate: 0.025,
        targetRetirementIncome: 6000
      });
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'financial-retirement-plans',
        expect.any(String)
      );
    });

    it('should export all financial planning data', () => {
      const exportedData = financialPlanningService.exportFinancialPlan();
      
      expect(exportedData).toHaveProperty('retirementPlans');
      expect(exportedData).toHaveProperty('mortgageCalculations');
      expect(exportedData).toHaveProperty('collegePlans');
      expect(exportedData).toHaveProperty('debtPlans');
      expect(exportedData).toHaveProperty('financialGoals');
      expect(exportedData).toHaveProperty('insuranceNeeds');
      
      expect(Array.isArray(exportedData.retirementPlans)).toBe(true);
      expect(Array.isArray(exportedData.mortgageCalculations)).toBe(true);
      expect(Array.isArray(exportedData.collegePlans)).toBe(true);
      expect(Array.isArray(exportedData.debtPlans)).toBe(true);
      expect(Array.isArray(exportedData.financialGoals)).toBe(true);
      expect(Array.isArray(exportedData.insuranceNeeds)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle localStorage errors gracefully', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      // Simulate localStorage error
      localStorageMock.setItem.mockImplementationOnce(() => {
        throw new Error('Storage quota exceeded');
      });
      
      // Should not throw when saving fails
      expect(() => {
        financialPlanningService.addRetirementPlan({
          name: 'Test Error Plan',
          currentAge: 30,
          retirementAge: 65,
          currentSavings: 50000,
          monthlyContribution: 1000,
          expectedReturn: 0.07,
          inflationRate: 0.03,
          targetRetirementIncome: 5000
        });
      }).not.toThrow();
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error saving financial planning data:',
        expect.any(Error)
      );
      
      consoleErrorSpy.mockRestore();
    });
  });
});