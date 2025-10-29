import { BaseService } from './base/BaseService';
import Decimal from 'decimal.js';

export interface Debt {
  id: string;
  name: string;
  type: 'credit_card' | 'mortgage' | 'auto_loan' | 'student_loan' | 'personal_loan' | 'other';
  balance: number;
  interestRate: number;
  minimumPayment: number;
  dueDate: number; // Day of month
  accountId?: string;
}

export interface DebtSummary {
  totalDebt: number;
  totalMinimumPayment: number;
  averageInterestRate: number;
  weightedAverageRate: number;
  monthlyInterestCost: number;
  debts: DebtWithAnalysis[];
}

export interface DebtWithAnalysis extends Debt {
  monthlyInterest: number;
  principalPayment: number;
  payoffMonths: number;
  totalInterestCost: number;
}

export interface PayoffStrategy {
  name: 'avalanche' | 'snowball' | 'custom';
  order: Debt[];
  totalPayoffMonths: number;
  totalInterestPaid: number;
  savings: number; // vs minimum payments
  schedule: PayoffScheduleItem[];
}

export interface PayoffScheduleItem {
  month: number;
  date: Date;
  payments: Array<{
    debtId: string;
    payment: number;
    principal: number;
    interest: number;
    remainingBalance: number;
  }>;
  totalPayment: number;
  remainingDebt: number;
}

export interface AmortizationSchedule {
  payment: number;
  schedule: Array<{
    period: number;
    payment: number;
    principal: number;
    interest: number;
    balance: number;
  }>;
  totalInterest: number;
}

class DebtCalculationService extends BaseService {
  constructor() {
    super('DebtCalculationService');
  }

  /**
   * Calculate comprehensive debt summary
   */
  calculateDebtSummary(debts: Debt[]): DebtSummary {
    if (debts.length === 0) {
      return {
        totalDebt: 0,
        totalMinimumPayment: 0,
        averageInterestRate: 0,
        weightedAverageRate: 0,
        monthlyInterestCost: 0,
        debts: []
      };
    }

    const debtsWithAnalysis: DebtWithAnalysis[] = debts.map(debt => {
      const analysis = this.analyzeDebt(debt);
      return { ...debt, ...analysis };
    });

    const totalDebt = debtsWithAnalysis.reduce((sum, d) => 
      new Decimal(sum).plus(d.balance).toNumber(), 0
    );

    const totalMinimumPayment = debtsWithAnalysis.reduce((sum, d) => 
      new Decimal(sum).plus(d.minimumPayment).toNumber(), 0
    );

    const averageInterestRate = debtsWithAnalysis.reduce((sum, d) => 
      sum + d.interestRate, 0
    ) / debtsWithAnalysis.length;

    const weightedAverageRate = this.calculateWeightedAverageRate(debtsWithAnalysis);

    const monthlyInterestCost = debtsWithAnalysis.reduce((sum, d) => 
      new Decimal(sum).plus(d.monthlyInterest).toNumber(), 0
    );

    return {
      totalDebt,
      totalMinimumPayment,
      averageInterestRate,
      weightedAverageRate,
      monthlyInterestCost,
      debts: debtsWithAnalysis
    };
  }

  /**
   * Analyze individual debt
   */
  private analyzeDebt(debt: Debt): {
    monthlyInterest: number;
    principalPayment: number;
    payoffMonths: number;
    totalInterestCost: number;
  } {
    const monthlyRate = new Decimal(debt.interestRate).dividedBy(100).dividedBy(12);
    const monthlyInterest = monthlyRate.times(debt.balance).toNumber();
    const principalPayment = Math.max(0, debt.minimumPayment - monthlyInterest);

    // Calculate payoff time with minimum payments
    let payoffMonths = 0;
    let totalInterestCost = 0;
    
    if (principalPayment > 0) {
      let remainingBalance = new Decimal(debt.balance);
      
      while (remainingBalance.gt(0) && payoffMonths < 600) { // Cap at 50 years
        const interest = remainingBalance.times(monthlyRate);
        const principal = new Decimal(debt.minimumPayment).minus(interest);
        
        if (principal.lte(0)) {
          // Minimum payment doesn't cover interest
          payoffMonths = 999;
          break;
        }
        
        remainingBalance = remainingBalance.minus(principal);
        totalInterestCost = new Decimal(totalInterestCost).plus(interest).toNumber();
        payoffMonths++;
      }
    } else {
      payoffMonths = 999; // Infinite
    }

    return {
      monthlyInterest,
      principalPayment,
      payoffMonths,
      totalInterestCost
    };
  }

  /**
   * Calculate weighted average interest rate
   */
  private calculateWeightedAverageRate(debts: DebtWithAnalysis[]): number {
    const totalDebt = debts.reduce((sum, d) => sum + d.balance, 0);
    if (totalDebt === 0) return 0;

    const weightedSum = debts.reduce((sum, d) => {
      const weight = d.balance / totalDebt;
      return sum + (d.interestRate * weight);
    }, 0);

    return weightedSum;
  }

  /**
   * Calculate payoff strategies
   */
  calculatePayoffStrategies(
    debts: Debt[],
    extraPayment: number = 0
  ): {
    avalanche: PayoffStrategy;
    snowball: PayoffStrategy;
  } {
    const avalanche = this.calculateAvalancheStrategy(debts, extraPayment);
    const snowball = this.calculateSnowballStrategy(debts, extraPayment);

    return { avalanche, snowball };
  }

  /**
   * Calculate avalanche strategy (highest interest rate first)
   */
  private calculateAvalancheStrategy(
    debts: Debt[],
    extraPayment: number
  ): PayoffStrategy {
    const orderedDebts = [...debts].sort((a, b) => b.interestRate - a.interestRate);
    return this.calculatePayoffSchedule(orderedDebts, extraPayment, 'avalanche');
  }

  /**
   * Calculate snowball strategy (lowest balance first)
   */
  private calculateSnowballStrategy(
    debts: Debt[],
    extraPayment: number
  ): PayoffStrategy {
    const orderedDebts = [...debts].sort((a, b) => a.balance - b.balance);
    return this.calculatePayoffSchedule(orderedDebts, extraPayment, 'snowball');
  }

  /**
   * Calculate detailed payoff schedule
   */
  private calculatePayoffSchedule(
    orderedDebts: Debt[],
    extraPayment: number,
    strategyName: 'avalanche' | 'snowball'
  ): PayoffStrategy {
    const schedule: PayoffScheduleItem[] = [];
    const debtBalances = new Map<string, InstanceType<typeof Decimal>>();
    
    // Initialize balances
    orderedDebts.forEach(debt => {
      debtBalances.set(debt.id, new Decimal(debt.balance));
    });

    let month = 0;
    let totalInterestPaid = new Decimal(0);
    const availableExtra = new Decimal(extraPayment);

    while (Array.from(debtBalances.values()).some(b => b.gt(0)) && month < 600) {
      month++;
      const date = new Date();
      date.setMonth(date.getMonth() + month);

      const monthPayments: PayoffScheduleItem['payments'] = [];
      let totalPayment = new Decimal(0);
      let freedUpPayments = new Decimal(0);

      // Process each debt
      orderedDebts.forEach(debt => {
        const balance = debtBalances.get(debt.id)!;
        if (balance.lte(0)) {
          // Debt is paid off, add its minimum payment to available extra
          freedUpPayments = freedUpPayments.plus(debt.minimumPayment);
          return;
        }

        const monthlyRate = new Decimal(debt.interestRate).dividedBy(100).dividedBy(12);
        const interest = balance.times(monthlyRate);
        
        // Determine payment amount
        let payment = new Decimal(debt.minimumPayment);
        
        // Add extra payment to the first unpaid debt
        const isFirstUnpaid = orderedDebts.find(d => 
          debtBalances.get(d.id)!.gt(0)
        )?.id === debt.id;
        
        if (isFirstUnpaid) {
          payment = payment.plus(availableExtra).plus(freedUpPayments);
        }

        // Don't pay more than the balance
        payment = Decimal.min(payment, balance.plus(interest));

        const principal = payment.minus(interest);
        const newBalance = balance.minus(principal);
        
        debtBalances.set(debt.id, Decimal.max(newBalance, new Decimal(0)));
        totalInterestPaid = totalInterestPaid.plus(interest);
        totalPayment = totalPayment.plus(payment);

        monthPayments.push({
          debtId: debt.id,
          payment: payment.toNumber(),
          principal: principal.toNumber(),
          interest: interest.toNumber(),
          remainingBalance: debtBalances.get(debt.id)!.toNumber()
        });
      });

      const remainingDebt = Array.from(debtBalances.values())
        .reduce((sum, b) => sum.plus(b), new Decimal(0))
        .toNumber();

      schedule.push({
        month,
        date,
        payments: monthPayments,
        totalPayment: totalPayment.toNumber(),
        remainingDebt
      });

      if (remainingDebt === 0) break;
    }

    // Calculate savings vs minimum payments only
    const minimumOnlyInterest = this.calculateMinimumPaymentInterest(orderedDebts);
    const savings = minimumOnlyInterest - totalInterestPaid.toNumber();

    return {
      name: strategyName,
      order: orderedDebts,
      totalPayoffMonths: month,
      totalInterestPaid: totalInterestPaid.toNumber(),
      savings,
      schedule
    };
  }

  /**
   * Calculate total interest with minimum payments only
   */
  private calculateMinimumPaymentInterest(debts: Debt[]): number {
    let totalInterest = new Decimal(0);

    debts.forEach(debt => {
      const analysis = this.analyzeDebt(debt);
      totalInterest = totalInterest.plus(analysis.totalInterestCost);
    });

    return totalInterest.toNumber();
  }

  /**
   * Calculate amortization schedule for a loan
   */
  calculateAmortizationSchedule(
    principal: number,
    annualRate: number,
    termMonths: number,
    extraPayment: number = 0
  ): AmortizationSchedule {
    const monthlyRate = new Decimal(annualRate).dividedBy(100).dividedBy(12);
    
    // Calculate standard payment
    const payment = this.calculateMonthlyPayment(principal, annualRate, termMonths);
    const totalPayment = new Decimal(payment).plus(extraPayment);

    const schedule: AmortizationSchedule['schedule'] = [];
    let balance = new Decimal(principal);
    let totalInterest = new Decimal(0);
    let period = 0;

    while (balance.gt(0.01) && period < termMonths * 2) { // Safety limit
      period++;
      
      const interest = balance.times(monthlyRate);
      const principalPayment = Decimal.min(totalPayment.minus(interest), balance);
      balance = balance.minus(principalPayment);
      totalInterest = totalInterest.plus(interest);

      schedule.push({
        period,
        payment: totalPayment.toNumber(),
        principal: principalPayment.toNumber(),
        interest: interest.toNumber(),
        balance: balance.toNumber()
      });
    }

    return {
      payment: payment,
      schedule,
      totalInterest: totalInterest.toNumber()
    };
  }

  /**
   * Calculate monthly payment for a loan
   */
  calculateMonthlyPayment(
    principal: number,
    annualRate: number,
    termMonths: number
  ): number {
    if (annualRate === 0) {
      return principal / termMonths;
    }

    const monthlyRate = new Decimal(annualRate).dividedBy(100).dividedBy(12);
    const onePlusR = monthlyRate.plus(1);
    const powerTerm = onePlusR.pow(termMonths);
    
    const payment = new Decimal(principal)
      .times(monthlyRate)
      .times(powerTerm)
      .dividedBy(powerTerm.minus(1));

    return payment.toNumber();
  }

  /**
   * Calculate how much extra payment is needed to pay off debt by target date
   */
  calculateRequiredExtraPayment(
    debt: Debt,
    targetMonths: number
  ): number {
    if (targetMonths <= 0) return 0;

    const monthlyRate = new Decimal(debt.interestRate).dividedBy(100).dividedBy(12);
    
    // Binary search for the extra payment amount
    let low = 0;
    let high = debt.balance;
    let result = 0;

    while (high - low > 0.01) {
      const mid = (low + high) / 2;
      const months = this.calculatePayoffTime(debt, mid);
      
      if (months <= targetMonths) {
        result = mid;
        high = mid;
      } else {
        low = mid;
      }
    }

    return Math.ceil(result);
  }

  /**
   * Calculate payoff time with extra payment
   */
  private calculatePayoffTime(debt: Debt, extraPayment: number): number {
    const monthlyRate = new Decimal(debt.interestRate).dividedBy(100).dividedBy(12);
    const totalPayment = new Decimal(debt.minimumPayment).plus(extraPayment);
    
    let balance = new Decimal(debt.balance);
    let months = 0;

    while (balance.gt(0.01) && months < 600) {
      const interest = balance.times(monthlyRate);
      const principal = totalPayment.minus(interest);
      
      if (principal.lte(0)) return 999;
      
      balance = balance.minus(principal);
      months++;
    }

    return months;
  }
}

export const debtCalculationService = new DebtCalculationService();