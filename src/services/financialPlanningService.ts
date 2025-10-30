import Decimal from 'decimal.js';
import type { Transaction } from '../types';
import type {
  SavedRetirementPlan,
  SavedMortgageCalculation,
  SavedAmortizationEntry,
  SavedCollegePlan,
  SavedDebtPlan,
  SavedFinancialGoal,
  SavedInsuranceNeed
} from '../types/financial-planning';

export interface RetirementPlan {
  id: string;
  name: string;
  currentAge: number;
  retirementAge: number;
  currentSavings: number;
  monthlyContribution: number;
  expectedReturn: number; // Annual percentage
  inflationRate: number;
  targetRetirementIncome: number; // Monthly income needed
  createdAt: Date;
  lastUpdated: Date;
}

export interface RetirementProjection {
  totalSavingsAtRetirement: number;
  monthlyIncomeAvailable: number;
  shortfall: number;
  recommendedMonthlyContribution: number;
  yearsToRetirement: number;
  projectionsByYear: Array<{
    year: number;
    age: number;
    balance: number;
    contribution: number;
    growth: number;
  }>;
}

export interface MortgageCalculation {
  id: string;
  loanAmount: number;
  interestRate: number; // Annual percentage
  loanTermYears: number;
  monthlyPayment: number;
  totalInterest: number;
  totalCost: number;
  payoffDate: Date;
  createdAt: Date;
  amortizationSchedule: AmortizationEntry[];
}

export interface AmortizationEntry {
  paymentNumber: number;
  paymentDate: Date;
  monthlyPayment: number;
  principalPayment: number;
  interestPayment: number;
  remainingBalance: number;
}

export interface CollegePlan {
  id: string;
  childName: string;
  currentAge: number;
  collegeStartAge: number;
  currentSavings: number;
  monthlyContribution: number;
  expectedReturn: number;
  estimatedCost: number; // Total cost of college
  inflationRate: number;
  createdAt: Date;
}

export interface CollegeProjection {
  totalSavingsAtCollegeStart: number;
  adjustedCollegeCost: number; // Adjusted for inflation
  shortfall: number;
  recommendedMonthlyContribution: number;
  yearsToCollegeStart: number;
  projectionsByYear: Array<{
    year: number;
    childAge: number;
    balance: number;
    contribution: number;
    growth: number;
  }>;
}

export interface DebtPayoffPlan {
  id: string;
  debtName: string;
  currentBalance: number;
  interestRate: number; // Annual percentage
  minimumPayment: number;
  additionalPayment: number;
  strategy: 'minimum' | 'snowball' | 'avalanche';
  createdAt: Date;
}

export interface DebtPayoffProjection {
  monthsToPayoff: number;
  totalInterest: number;
  totalPaid: number;
  payoffDate: Date;
  paymentSchedule: Array<{
    month: number;
    payment: number;
    principal: number;
    interest: number;
    remainingBalance: number;
  }>;
}

export interface FinancialGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentSavings: number;
  monthlyContribution: number;
  targetDate: Date;
  priority: 'high' | 'medium' | 'low';
  category: 'retirement' | 'emergency' | 'vacation' | 'home' | 'car' | 'other';
  expectedReturn: number;
  createdAt: Date;
}

export interface GoalProjection {
  projectedAmount: number;
  shortfall: number;
  monthsToGoal: number;
  recommendedMonthlyContribution: number;
  onTrack: boolean;
  projectionsByMonth: Array<{
    month: number;
    balance: number;
    contribution: number;
    growth: number;
  }>;
}

export interface InsuranceNeed {
  id: string;
  type: 'life' | 'disability' | 'health' | 'property' | 'auto';
  currentCoverage: number;
  recommendedCoverage: number;
  monthlyPremium: number;
  provider: string;
  notes: string;
  createdAt: Date;
}

export interface NetWorthProjection {
  currentNetWorth: number;
  projectedNetWorth: number;
  growthRate: number;
  timeframe: number; // years
  projectionsByYear: Array<{
    year: number;
    netWorth: number;
    assets: number;
    liabilities: number;
  }>;
}

class FinancialPlanningService {
  private retirementPlans: RetirementPlan[] = [];
  private mortgageCalculations: MortgageCalculation[] = [];
  private collegePlans: CollegePlan[] = [];
  private debtPlans: DebtPayoffPlan[] = [];
  private financialGoals: FinancialGoal[] = [];
  private insuranceNeeds: InsuranceNeed[] = [];

  constructor() {
    this.loadData();
    this.createSampleData();
  }

  private loadData() {
    try {
      const savedRetirementPlans = localStorage.getItem('financial-retirement-plans');
      if (savedRetirementPlans) {
        this.retirementPlans = JSON.parse(savedRetirementPlans).map((plan: SavedRetirementPlan) => ({
          ...plan,
          createdAt: new Date(plan.createdAt),
          lastUpdated: new Date(plan.lastUpdated)
        }));
      }

      const savedMortgageCalculations = localStorage.getItem('financial-mortgage-calculations');
      if (savedMortgageCalculations) {
        this.mortgageCalculations = JSON.parse(savedMortgageCalculations).map((calc: SavedMortgageCalculation) => ({
          ...calc,
          payoffDate: new Date(calc.payoffDate),
          createdAt: new Date(calc.createdAt),
          amortizationSchedule: calc.amortizationSchedule.map((entry: SavedAmortizationEntry) => ({
            ...entry,
            paymentDate: new Date(entry.paymentDate)
          }))
        }));
      }

      const savedCollegePlans = localStorage.getItem('financial-college-plans');
      if (savedCollegePlans) {
        this.collegePlans = JSON.parse(savedCollegePlans).map((plan: SavedCollegePlan) => ({
          ...plan,
          createdAt: new Date(plan.createdAt)
        }));
      }

      const savedDebtPlans = localStorage.getItem('financial-debt-plans');
      if (savedDebtPlans) {
        this.debtPlans = JSON.parse(savedDebtPlans).map((plan: SavedDebtPlan) => ({
          ...plan,
          createdAt: new Date(plan.createdAt)
        }));
      }

      const savedFinancialGoals = localStorage.getItem('financial-goals');
      if (savedFinancialGoals) {
        this.financialGoals = JSON.parse(savedFinancialGoals).map((goal: SavedFinancialGoal) => ({
          ...goal,
          targetDate: new Date(goal.targetDate),
          createdAt: new Date(goal.createdAt)
        }));
      }

      const savedInsuranceNeeds = localStorage.getItem('financial-insurance-needs');
      if (savedInsuranceNeeds) {
        this.insuranceNeeds = JSON.parse(savedInsuranceNeeds).map((need: SavedInsuranceNeed) => ({
          ...need,
          createdAt: new Date(need.createdAt)
        }));
      }
    } catch (error) {
      console.error('Error loading financial planning data:', error);
    }
  }

  private saveData() {
    try {
      localStorage.setItem('financial-retirement-plans', JSON.stringify(this.retirementPlans));
      localStorage.setItem('financial-mortgage-calculations', JSON.stringify(this.mortgageCalculations));
      localStorage.setItem('financial-college-plans', JSON.stringify(this.collegePlans));
      localStorage.setItem('financial-debt-plans', JSON.stringify(this.debtPlans));
      localStorage.setItem('financial-goals', JSON.stringify(this.financialGoals));
      localStorage.setItem('financial-insurance-needs', JSON.stringify(this.insuranceNeeds));
    } catch (error) {
      console.error('Error saving financial planning data:', error);
    }
  }

  private createSampleData() {
    if (this.retirementPlans.length === 0) {
      const sampleRetirementPlan: RetirementPlan = {
        id: '1',
        name: 'Primary Retirement Plan',
        currentAge: 35,
        retirementAge: 65,
        currentSavings: 125000,
        monthlyContribution: 1000,
        expectedReturn: 0.07,
        inflationRate: 0.025,
        targetRetirementIncome: 5000,
        createdAt: new Date('2024-01-15'),
        lastUpdated: new Date('2024-01-15')
      };
      this.retirementPlans.push(sampleRetirementPlan);
    }

    if (this.mortgageCalculations.length === 0) {
      const sampleMortgage = this.calculateMortgage(400000, 0.065, 30);
      this.mortgageCalculations.push(sampleMortgage);
    }

    if (this.collegePlans.length === 0) {
      const sampleCollegePlan: CollegePlan = {
        id: '1',
        childName: 'Emma',
        currentAge: 8,
        collegeStartAge: 18,
        currentSavings: 15000,
        monthlyContribution: 300,
        expectedReturn: 0.06,
        estimatedCost: 200000,
        inflationRate: 0.03,
        createdAt: new Date('2024-01-15')
      };
      this.collegePlans.push(sampleCollegePlan);
    }

    if (this.debtPlans.length === 0) {
      const sampleDebtPlan: DebtPayoffPlan = {
        id: '1',
        debtName: 'Credit Card Debt',
        currentBalance: 8500,
        interestRate: 0.1899,
        minimumPayment: 250,
        additionalPayment: 100,
        strategy: 'avalanche',
        createdAt: new Date('2024-01-15')
      };
      this.debtPlans.push(sampleDebtPlan);
    }

    if (this.financialGoals.length === 0) {
      const sampleGoals: FinancialGoal[] = [
        {
          id: '1',
          name: 'Emergency Fund',
          targetAmount: 25000,
          currentSavings: 8000,
          monthlyContribution: 500,
          targetDate: new Date('2025-12-31'),
          priority: 'high',
          category: 'emergency',
          expectedReturn: 0.04,
          createdAt: new Date('2024-01-15')
        },
        {
          id: '2',
          name: 'European Vacation',
          targetAmount: 12000,
          currentSavings: 2000,
          monthlyContribution: 400,
          targetDate: new Date('2025-06-15'),
          priority: 'medium',
          category: 'vacation',
          expectedReturn: 0.02,
          createdAt: new Date('2024-01-15')
        }
      ];
      this.financialGoals.push(...sampleGoals);
    }

    if (this.insuranceNeeds.length === 0) {
      const sampleInsuranceNeeds: InsuranceNeed[] = [
        {
          id: '1',
          type: 'life',
          currentCoverage: 250000,
          recommendedCoverage: 500000,
          monthlyPremium: 85,
          provider: 'State Farm',
          notes: 'Consider increasing coverage due to mortgage',
          createdAt: new Date('2024-01-15')
        },
        {
          id: '2',
          type: 'disability',
          currentCoverage: 0,
          recommendedCoverage: 60000,
          monthlyPremium: 120,
          provider: 'Not yet purchased',
          notes: 'Essential for income protection',
          createdAt: new Date('2024-01-15')
        }
      ];
      this.insuranceNeeds.push(...sampleInsuranceNeeds);
    }

    this.saveData();
  }

  // Retirement Planning
  getRetirementPlans(): RetirementPlan[] {
    return this.retirementPlans;
  }

  addRetirementPlan(plan: Omit<RetirementPlan, 'id' | 'createdAt' | 'lastUpdated'>): RetirementPlan {
    const newPlan: RetirementPlan = {
      ...plan,
      id: Date.now().toString(),
      createdAt: new Date(),
      lastUpdated: new Date()
    };
    this.retirementPlans.push(newPlan);
    this.saveData();
    return newPlan;
  }

  updateRetirementPlan(id: string, updates: Partial<RetirementPlan>): RetirementPlan | null {
    const index = this.retirementPlans.findIndex(plan => plan.id === id);
    if (index === -1) return null;

    this.retirementPlans[index] = {
      ...this.retirementPlans[index],
      ...updates,
      lastUpdated: new Date()
    };
    this.saveData();
    return this.retirementPlans[index];
  }

  deleteRetirementPlan(id: string): boolean {
    const index = this.retirementPlans.findIndex(plan => plan.id === id);
    if (index === -1) return false;

    this.retirementPlans.splice(index, 1);
    this.saveData();
    return true;
  }

  calculateRetirementProjection(plan: RetirementPlan): RetirementProjection {
    const yearsToRetirement = plan.retirementAge - plan.currentAge;
    const monthsToRetirement = yearsToRetirement * 12;
    const monthlyReturn = plan.expectedReturn / 12;

    // Calculate future value of current savings
    const currentSavingsFV = new Decimal(plan.currentSavings)
      .times(new Decimal(1 + monthlyReturn).pow(monthsToRetirement));

    // Calculate future value of monthly contributions (annuity)
    const monthlyContributionsFV = new Decimal(plan.monthlyContribution)
      .times(new Decimal(1 + monthlyReturn).pow(monthsToRetirement).minus(1))
      .div(monthlyReturn);

    const totalSavingsAtRetirement = currentSavingsFV.plus(monthlyContributionsFV).toNumber();

    // Calculate sustainable withdrawal rate (4% rule adjusted for inflation)
    const withdrawalRate = 0.04;
    const monthlyIncomeAvailable = totalSavingsAtRetirement * withdrawalRate / 12;

    // Adjust target income for inflation
    const adjustedTargetIncome = plan.targetRetirementIncome * 
      Math.pow(1 + plan.inflationRate, yearsToRetirement);

    const shortfall = Math.max(0, adjustedTargetIncome - monthlyIncomeAvailable);

    // Calculate recommended monthly contribution to meet target
    let recommendedMonthlyContribution = plan.monthlyContribution;
    if (shortfall > 0) {
      const additionalNeeded = shortfall * 12 / withdrawalRate;
      const additionalContribution = new Decimal(additionalNeeded)
        .div(new Decimal(1 + monthlyReturn).pow(monthsToRetirement).minus(1))
        .times(monthlyReturn)
        .toNumber();
      recommendedMonthlyContribution = plan.monthlyContribution + additionalContribution;
    }

    // Generate year-by-year projections
    const projectionsByYear: RetirementProjection['projectionsByYear'] = [];
    let currentBalance = plan.currentSavings;
    
    for (let year = 1; year <= yearsToRetirement; year++) {
      const yearlyContribution = plan.monthlyContribution * 12;
      const yearlyGrowth = currentBalance * plan.expectedReturn;
      
      currentBalance = currentBalance + yearlyContribution + yearlyGrowth;
      
      projectionsByYear.push({
        year,
        age: plan.currentAge + year,
        balance: currentBalance,
        contribution: yearlyContribution,
        growth: yearlyGrowth
      });
    }

    return {
      totalSavingsAtRetirement,
      monthlyIncomeAvailable,
      shortfall,
      recommendedMonthlyContribution,
      yearsToRetirement,
      projectionsByYear
    };
  }

  // Mortgage Calculations
  getMortgageCalculations(): MortgageCalculation[] {
    return this.mortgageCalculations;
  }

  calculateMortgage(loanAmount: number, annualRate: number, years: number): MortgageCalculation {
    const monthlyRate = annualRate / 12;
    const numberOfPayments = years * 12;
    
    // Calculate monthly payment using standard mortgage formula
    const monthlyPayment = new Decimal(loanAmount)
      .times(monthlyRate)
      .times(new Decimal(1 + monthlyRate).pow(numberOfPayments))
      .div(new Decimal(1 + monthlyRate).pow(numberOfPayments).minus(1))
      .toNumber();

    const totalCost = monthlyPayment * numberOfPayments;
    const totalInterest = totalCost - loanAmount;
    const payoffDate = new Date();
    payoffDate.setMonth(payoffDate.getMonth() + numberOfPayments);

    // Generate amortization schedule
    const amortizationSchedule: AmortizationEntry[] = [];
    let remainingBalance = loanAmount;
    const currentDate = new Date();

    for (let payment = 1; payment <= numberOfPayments; payment++) {
      const interestPayment = remainingBalance * monthlyRate;
      const principalPayment = monthlyPayment - interestPayment;
      remainingBalance = Math.max(0, remainingBalance - principalPayment);

      const paymentDate = new Date(currentDate);
      paymentDate.setMonth(paymentDate.getMonth() + payment);

      amortizationSchedule.push({
        paymentNumber: payment,
        paymentDate,
        monthlyPayment,
        principalPayment,
        interestPayment,
        remainingBalance
      });

      if (remainingBalance <= 0) break;
    }

    const calculation: MortgageCalculation = {
      id: Date.now().toString(),
      loanAmount,
      interestRate: annualRate,
      loanTermYears: years,
      monthlyPayment,
      totalInterest,
      totalCost,
      payoffDate,
      createdAt: new Date(),
      amortizationSchedule
    };

    this.mortgageCalculations.push(calculation);
    this.saveData();
    return calculation;
  }

  deleteMortgageCalculation(id: string): boolean {
    const index = this.mortgageCalculations.findIndex(calc => calc.id === id);
    if (index === -1) return false;

    this.mortgageCalculations.splice(index, 1);
    this.saveData();
    return true;
  }

  // College Planning
  getCollegePlans(): CollegePlan[] {
    return this.collegePlans;
  }

  addCollegePlan(plan: Omit<CollegePlan, 'id' | 'createdAt'>): CollegePlan {
    const newPlan: CollegePlan = {
      ...plan,
      id: Date.now().toString(),
      createdAt: new Date()
    };
    this.collegePlans.push(newPlan);
    this.saveData();
    return newPlan;
  }

  updateCollegePlan(id: string, updates: Partial<CollegePlan>): CollegePlan | null {
    const index = this.collegePlans.findIndex(plan => plan.id === id);
    if (index === -1) return null;

    this.collegePlans[index] = { ...this.collegePlans[index], ...updates };
    this.saveData();
    return this.collegePlans[index];
  }

  deleteCollegePlan(id: string): boolean {
    const index = this.collegePlans.findIndex(plan => plan.id === id);
    if (index === -1) return false;

    this.collegePlans.splice(index, 1);
    this.saveData();
    return true;
  }

  calculateCollegeProjection(plan: CollegePlan): CollegeProjection {
    const yearsToCollegeStart = plan.collegeStartAge - plan.currentAge;
    const monthsToCollegeStart = yearsToCollegeStart * 12;
    const monthlyReturn = plan.expectedReturn / 12;

    // Calculate future value of current savings
    const currentSavingsFV = new Decimal(plan.currentSavings)
      .times(new Decimal(1 + monthlyReturn).pow(monthsToCollegeStart));

    // Calculate future value of monthly contributions
    const monthlyContributionsFV = new Decimal(plan.monthlyContribution)
      .times(new Decimal(1 + monthlyReturn).pow(monthsToCollegeStart).minus(1))
      .div(monthlyReturn);

    const totalSavingsAtCollegeStart = currentSavingsFV.plus(monthlyContributionsFV).toNumber();

    // Adjust college cost for inflation
    const adjustedCollegeCost = plan.estimatedCost * 
      Math.pow(1 + plan.inflationRate, yearsToCollegeStart);

    const shortfall = Math.max(0, adjustedCollegeCost - totalSavingsAtCollegeStart);

    // Calculate recommended monthly contribution
    let recommendedMonthlyContribution = plan.monthlyContribution;
    if (shortfall > 0) {
      recommendedMonthlyContribution = new Decimal(shortfall)
        .div(new Decimal(1 + monthlyReturn).pow(monthsToCollegeStart).minus(1))
        .times(monthlyReturn)
        .plus(plan.monthlyContribution)
        .toNumber();
    }

    // Generate year-by-year projections
    const projectionsByYear: CollegeProjection['projectionsByYear'] = [];
    let currentBalance = plan.currentSavings;
    
    for (let year = 1; year <= yearsToCollegeStart; year++) {
      const yearlyContribution = plan.monthlyContribution * 12;
      const yearlyGrowth = currentBalance * plan.expectedReturn;
      
      currentBalance = currentBalance + yearlyContribution + yearlyGrowth;
      
      projectionsByYear.push({
        year,
        childAge: plan.currentAge + year,
        balance: currentBalance,
        contribution: yearlyContribution,
        growth: yearlyGrowth
      });
    }

    return {
      totalSavingsAtCollegeStart,
      adjustedCollegeCost,
      shortfall,
      recommendedMonthlyContribution,
      yearsToCollegeStart,
      projectionsByYear
    };
  }

  // Debt Payoff Planning
  getDebtPlans(): DebtPayoffPlan[] {
    return this.debtPlans;
  }

  addDebtPlan(plan: Omit<DebtPayoffPlan, 'id' | 'createdAt'>): DebtPayoffPlan {
    const newPlan: DebtPayoffPlan = {
      ...plan,
      id: Date.now().toString(),
      createdAt: new Date()
    };
    this.debtPlans.push(newPlan);
    this.saveData();
    return newPlan;
  }

  updateDebtPlan(id: string, updates: Partial<DebtPayoffPlan>): DebtPayoffPlan | null {
    const index = this.debtPlans.findIndex(plan => plan.id === id);
    if (index === -1) return null;

    this.debtPlans[index] = { ...this.debtPlans[index], ...updates };
    this.saveData();
    return this.debtPlans[index];
  }

  deleteDebtPlan(id: string): boolean {
    const index = this.debtPlans.findIndex(plan => plan.id === id);
    if (index === -1) return false;

    this.debtPlans.splice(index, 1);
    this.saveData();
    return true;
  }

  calculateDebtPayoff(plan: DebtPayoffPlan): DebtPayoffProjection {
    const monthlyRate = plan.interestRate / 12;
    const totalMonthlyPayment = plan.minimumPayment + plan.additionalPayment;
    
    let remainingBalance = plan.currentBalance;
    let totalInterest = 0;
    let month = 0;
    const paymentSchedule: DebtPayoffProjection['paymentSchedule'] = [];

    while (remainingBalance > 0 && month < 600) { // Cap at 50 years
      month++;
      const interestPayment = remainingBalance * monthlyRate;
      const principalPayment = Math.min(totalMonthlyPayment - interestPayment, remainingBalance);
      
      remainingBalance = Math.max(0, remainingBalance - principalPayment);
      totalInterest += interestPayment;

      paymentSchedule.push({
        month,
        payment: principalPayment + interestPayment,
        principal: principalPayment,
        interest: interestPayment,
        remainingBalance
      });

      if (remainingBalance <= 0) break;
    }

    const totalPaid = plan.currentBalance + totalInterest;
    const payoffDate = new Date();
    payoffDate.setMonth(payoffDate.getMonth() + month);

    return {
      monthsToPayoff: month,
      totalInterest,
      totalPaid,
      payoffDate,
      paymentSchedule
    };
  }

  // Financial Goals
  getFinancialGoals(): FinancialGoal[] {
    return this.financialGoals;
  }

  addFinancialGoal(goal: Omit<FinancialGoal, 'id' | 'createdAt'>): FinancialGoal {
    const newGoal: FinancialGoal = {
      ...goal,
      id: Date.now().toString(),
      createdAt: new Date()
    };
    this.financialGoals.push(newGoal);
    this.saveData();
    return newGoal;
  }

  updateFinancialGoal(id: string, updates: Partial<FinancialGoal>): FinancialGoal | null {
    const index = this.financialGoals.findIndex(goal => goal.id === id);
    if (index === -1) return null;

    this.financialGoals[index] = { ...this.financialGoals[index], ...updates };
    this.saveData();
    return this.financialGoals[index];
  }

  deleteFinancialGoal(id: string): boolean {
    const index = this.financialGoals.findIndex(goal => goal.id === id);
    if (index === -1) return false;

    this.financialGoals.splice(index, 1);
    this.saveData();
    return true;
  }

  calculateGoalProjection(goal: FinancialGoal): GoalProjection {
    const now = new Date();
    const monthsToGoal = Math.max(1, Math.ceil((goal.targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30)));
    const monthlyReturn = goal.expectedReturn / 12;

    // Calculate future value of current savings
    const currentSavingsFV = new Decimal(goal.currentSavings)
      .times(new Decimal(1 + monthlyReturn).pow(monthsToGoal));

    // Calculate future value of monthly contributions
    const monthlyContributionsFV = monthsToGoal > 1 
      ? new Decimal(goal.monthlyContribution)
          .times(new Decimal(1 + monthlyReturn).pow(monthsToGoal).minus(1))
          .div(monthlyReturn)
      : new Decimal(goal.monthlyContribution);

    const projectedAmount = currentSavingsFV.plus(monthlyContributionsFV).toNumber();
    const shortfall = Math.max(0, goal.targetAmount - projectedAmount);
    const onTrack = shortfall <= 0;

    // Calculate recommended monthly contribution
    let recommendedMonthlyContribution = goal.monthlyContribution;
    if (shortfall > 0) {
      recommendedMonthlyContribution = new Decimal(shortfall)
        .div(new Decimal(1 + monthlyReturn).pow(monthsToGoal).minus(1))
        .times(monthlyReturn)
        .plus(goal.monthlyContribution)
        .toNumber();
    }

    // Generate month-by-month projections
    const projectionsByMonth: GoalProjection['projectionsByMonth'] = [];
    let currentBalance = goal.currentSavings;
    
    for (let month = 1; month <= Math.min(monthsToGoal, 120); month++) {
      const monthlyGrowth = currentBalance * monthlyReturn;
      currentBalance = currentBalance + goal.monthlyContribution + monthlyGrowth;
      
      projectionsByMonth.push({
        month,
        balance: currentBalance,
        contribution: goal.monthlyContribution,
        growth: monthlyGrowth
      });
    }

    return {
      projectedAmount,
      shortfall,
      monthsToGoal,
      recommendedMonthlyContribution,
      onTrack,
      projectionsByMonth
    };
  }

  // Insurance Planning
  getInsuranceNeeds(): InsuranceNeed[] {
    return this.insuranceNeeds;
  }

  addInsuranceNeed(need: Omit<InsuranceNeed, 'id' | 'createdAt'>): InsuranceNeed {
    const newNeed: InsuranceNeed = {
      ...need,
      id: Date.now().toString(),
      createdAt: new Date()
    };
    this.insuranceNeeds.push(newNeed);
    this.saveData();
    return newNeed;
  }

  updateInsuranceNeed(id: string, updates: Partial<InsuranceNeed>): InsuranceNeed | null {
    const index = this.insuranceNeeds.findIndex(need => need.id === id);
    if (index === -1) return null;

    this.insuranceNeeds[index] = { ...this.insuranceNeeds[index], ...updates };
    this.saveData();
    return this.insuranceNeeds[index];
  }

  deleteInsuranceNeed(id: string): boolean {
    const index = this.insuranceNeeds.findIndex(need => need.id === id);
    if (index === -1) return false;

    this.insuranceNeeds.splice(index, 1);
    this.saveData();
    return true;
  }

  // Net Worth Projections
  calculateNetWorthProjection(
    currentNetWorth: number,
    monthlyIncome: number,
    monthlyExpenses: number,
    expectedReturn: number,
    timeframe: number
  ): NetWorthProjection {
    const monthlyNetIncome = monthlyIncome - monthlyExpenses;
    const monthlyReturn = expectedReturn / 12;
    const projectionsByYear: NetWorthProjection['projectionsByYear'] = [];
    
    let currentAssets = Math.max(0, currentNetWorth + 100000); // Estimate assets
    let currentLiabilities = Math.max(0, 100000 - currentNetWorth); // Estimate liabilities
    
    for (let year = 1; year <= timeframe; year++) {
      // Add monthly savings and compound growth
      for (let month = 1; month <= 12; month++) {
        currentAssets = currentAssets + monthlyNetIncome + (currentAssets * monthlyReturn);
        // Assume liabilities decrease by 5% per year
        currentLiabilities = currentLiabilities * 0.995;
      }
      
      const yearNetWorth = currentAssets - currentLiabilities;
      
      projectionsByYear.push({
        year,
        netWorth: yearNetWorth,
        assets: currentAssets,
        liabilities: currentLiabilities
      });
    }

    const projectedNetWorth = projectionsByYear[projectionsByYear.length - 1]?.netWorth || currentNetWorth;
    const growthRate = ((projectedNetWorth - currentNetWorth) / currentNetWorth) * 100;

    return {
      currentNetWorth,
      projectedNetWorth,
      growthRate,
      timeframe,
      projectionsByYear
    };
  }

  // Utility methods
  exportFinancialPlan(): {
    retirementPlans: RetirementPlan[];
    mortgageCalculations: MortgageCalculation[];
    collegePlans: CollegePlan[];
    debtPlans: DebtPayoffPlan[];
    financialGoals: FinancialGoal[];
    insuranceNeeds: InsuranceNeed[];
  } {
    return {
      retirementPlans: this.retirementPlans,
      mortgageCalculations: this.mortgageCalculations,
      collegePlans: this.collegePlans,
      debtPlans: this.debtPlans,
      financialGoals: this.financialGoals,
      insuranceNeeds: this.insuranceNeeds
    };
  }
}

export const financialPlanningService = new FinancialPlanningService();