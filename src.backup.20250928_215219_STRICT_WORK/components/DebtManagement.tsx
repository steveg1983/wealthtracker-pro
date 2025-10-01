import React, { useState, useMemo } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { useApp } from '../contexts/AppContextSupabase';
import { toDecimal } from '../utils/decimal';
import type { DecimalInstance } from '../types/decimal-types';
import { 
  PlusIcon, 
  CreditCardIcon, 
  TrendingDownIcon,
  TrendingUpIcon,
  CalculatorIcon,
  TargetIcon,
  AlertCircleIcon,
  CheckCircleIcon,
  InfoIcon,
  EditIcon,
  DeleteIcon,
  BarChart3Icon,
  LineChartIcon,
  DollarSignIcon,
  BellIcon
} from './icons';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, BarChart, Bar } from 'recharts';
import { debtCalculationService } from '../services/debtCalculationService';

export interface Debt {
  id: string;
  name: string;
  type: 'credit_card' | 'personal_loan' | 'mortgage' | 'student_loan' | 'auto_loan' | 'other';
  balance: DecimalInstance;
  interestRate: DecimalInstance;
  minimumPayment: DecimalInstance;
  dueDate: number; // Day of month
  accountId: string;
  isActive: boolean;
  notes?: string;
  createdAt: Date;
  paymentHistory: DebtPayment[];
}

export interface DebtPayment {
  id: string;
  debtId: string;
  amount: DecimalInstance;
  date: Date;
  principalAmount: DecimalInstance;
  interestAmount: DecimalInstance;
  transactionId?: string;
}

export interface PayoffStrategy {
  type: 'snowball' | 'avalanche' | 'custom';
  debts: Array<{
    debtId: string;
    order: number;
    extraPayment: DecimalInstance;
  }>;
  totalExtraPayment: DecimalInstance;
}

export interface PayoffProjection {
  debtId: string;
  debtName: string;
  monthsToPayoff: number;
  totalInterest: DecimalInstance;
  totalPayments: DecimalInstance;
  monthlyProjection: Array<{
    month: number;
    balance: DecimalInstance;
    payment: DecimalInstance;
    principal: DecimalInstance;
    interest: DecimalInstance;
  }>;
}

export interface CreditScoreEntry {
  id: string;
  score: number;
  date: Date;
  provider: 'experian' | 'equifax' | 'transunion' | 'fico' | 'vantage' | 'other';
  notes?: string;
}

export default function DebtManagement() {
  const { accounts, addTransaction } = useApp();
  const { formatCurrency } = useCurrencyDecimal();
  const [debts, setDebts] = useLocalStorage<Debt[]>('debts', []);
  const [creditScores, setCreditScores] = useLocalStorage<CreditScoreEntry[]>('credit-scores', []);
  const [payoffStrategy, setPayoffStrategy] = useLocalStorage<PayoffStrategy>('payoff-strategy', {
    type: 'snowball',
    debts: [],
    totalExtraPayment: toDecimal(0)
  });
  
  const [showAddDebt, setShowAddDebt] = useState(false);
  const [showAddScore, setShowAddScore] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState<string | null>(null);
  const [showCalculator, setShowCalculator] = useState(false);
  const [showAmortization, setShowAmortization] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'payoff' | 'calculator' | 'credit'>('overview');
  
  const [newDebt, setNewDebt] = useState({
    name: '',
    type: 'credit_card' as Debt['type'],
    balance: '',
    interestRate: '',
    minimumPayment: '',
    dueDate: 1,
    accountId: '',
    notes: ''
  });

  const [calculatorInputs, setCalculatorInputs] = useState({
    balance: '',
    interestRate: '',
    payment: '',
    targetMonths: ''
  });

  const [newScore, setNewScore] = useState({
    score: '',
    date: new Date().toISOString().split('T')[0],
    provider: 'fico' as CreditScoreEntry['provider'],
    notes: ''
  });

  const [amortizationInputs, setAmortizationInputs] = useState({
    loanAmount: '',
    interestRate: '',
    loanTerm: '',
    startDate: new Date().toISOString().split('T')[0]
  });

  const calculatePayoffProjections = (strategy: PayoffStrategy): PayoffProjection[] => {
    const activeDebts = debts.filter(d => d.isActive);
    
    // Convert debts to service-compatible format
    const serviceDebts = activeDebts.map(debt => ({
      id: debt.id,
      name: debt.name,
      type: debt.type,
      balance: debt.balance.toNumber(),
      interestRate: debt.interestRate.toNumber(),
      minimumPayment: debt.minimumPayment.toNumber(),
      dueDate: debt.dueDate,
      accountId: debt.accountId
    }));
    
    // Calculate total extra payment
    const totalExtraPayment = strategy.totalExtraPayment.toNumber();
    
    // Use service to calculate payoff strategies
    const strategies = debtCalculationService.calculatePayoffStrategies(
      serviceDebts,
      totalExtraPayment
    );
    
    // Get the appropriate strategy result
    const strategyResult = strategy.type === 'avalanche' 
      ? strategies.avalanche 
      : strategies.snowball;
    
    // Convert service results to component format
    const projections: PayoffProjection[] = [];
    
    activeDebts.forEach(debt => {
      const debtSchedule = strategyResult.schedule
        .map(item => item.payments.find(p => p.debtId === debt.id))
        .filter(Boolean);
      
      const monthlyProjection = debtSchedule.map((payment, index) => ({
        month: index + 1,
        balance: toDecimal(payment!.remainingBalance),
        payment: toDecimal(payment!.payment),
        principal: toDecimal(payment!.principal),
        interest: toDecimal(payment!.interest)
      }));
      
      const totalPayments = monthlyProjection.reduce(
        (sum, p) => sum.plus(p.payment), 
        toDecimal(0)
      );
      
      const totalInterest = monthlyProjection.reduce(
        (sum, p) => sum.plus(p.interest), 
        toDecimal(0)
      );
      
      projections.push({
        debtId: debt.id,
        debtName: debt.name,
        monthsToPayoff: monthlyProjection.length,
        totalInterest,
        totalPayments,
        monthlyProjection
      });
    });
    
    return projections;
  };

  const { totalDebt, totalMinimumPayment, totalInterestRate, projections, debtSummary } = useMemo(() => {
    const activeDebts = debts.filter(d => d.isActive);
    
    // Convert debts to service-compatible format
    const serviceDebts = activeDebts.map(debt => ({
      id: debt.id,
      name: debt.name,
      type: debt.type,
      balance: debt.balance.toNumber(),
      interestRate: debt.interestRate.toNumber(),
      minimumPayment: debt.minimumPayment.toNumber(),
      dueDate: debt.dueDate,
      accountId: debt.accountId
    }));
    
    // Use service to calculate debt summary
    const summary = debtCalculationService.calculateDebtSummary(serviceDebts);
    
    const projections = calculatePayoffProjections(payoffStrategy);
    
    return {
      totalDebt: toDecimal(summary.totalDebt),
      totalMinimumPayment: toDecimal(summary.totalMinimumPayment),
      totalInterestRate: toDecimal(summary.weightedAverageRate),
      projections,
      debtSummary: summary
    };
  }, [debts, payoffStrategy]);

  const handleAddDebt = () => {
    if (!newDebt.name || !newDebt.balance || !newDebt.interestRate || !newDebt.minimumPayment || !newDebt.accountId) return;
    
    const debt: Debt = {
      id: Date.now().toString(),
      name: newDebt.name,
      type: newDebt.type,
      balance: toDecimal(parseFloat(newDebt.balance)),
      interestRate: toDecimal(parseFloat(newDebt.interestRate)),
      minimumPayment: toDecimal(parseFloat(newDebt.minimumPayment)),
      dueDate: newDebt.dueDate,
      accountId: newDebt.accountId,
      isActive: true,
      notes: newDebt.notes,
      createdAt: new Date(),
      paymentHistory: []
    };
    
    setDebts([...debts, debt]);
    setNewDebt({
      name: '',
      type: 'credit_card',
      balance: '',
      interestRate: '',
      minimumPayment: '',
      dueDate: 1,
      accountId: '',
      notes: ''
    });
    setShowAddDebt(false);
  };

  const handlePayoffStrategyChange = (type: PayoffStrategy['type']) => {
    const activeDebts = debts.filter(d => d.isActive);
    const sortedDebts = [...activeDebts];
    
    if (type === 'snowball') {
      sortedDebts.sort((a, b) => a.balance.minus(b.balance).toNumber());
    } else if (type === 'avalanche') {
      sortedDebts.sort((a, b) => b.interestRate.minus(a.interestRate).toNumber());
    }
    
    const newStrategy: PayoffStrategy = {
      type,
      debts: sortedDebts.map((debt, index) => ({
        debtId: debt.id,
        order: index + 1,
        extraPayment: toDecimal(0)
      })),
      totalExtraPayment: payoffStrategy.totalExtraPayment
    };
    
    setPayoffStrategy(newStrategy);
  };

  const calculateLoanPayoff = () => {
    const balance = parseFloat(calculatorInputs.balance);
    const annualRate = parseFloat(calculatorInputs.interestRate) / 100;
    const monthlyRate = annualRate / 12;
    const payment = parseFloat(calculatorInputs.payment);
    
    if (!balance || !annualRate || !payment) return null;
    
    let currentBalance = balance;
    let months = 0;
    let totalInterest = 0;
    
    while (currentBalance > 0 && months < 360) {
      const interestPayment = currentBalance * monthlyRate;
      const principalPayment = payment - interestPayment;
      
      if (principalPayment <= 0) break; // Payment too small
      
      currentBalance -= principalPayment;
      totalInterest += interestPayment;
      months++;
    }
    
    return {
      months,
      totalInterest,
      totalPayments: payment * months
    };
  };

  const payoffResult = calculateLoanPayoff();

  const handleAddScore = () => {
    if (!newScore.score || !newScore.date) return;
    
    const score: CreditScoreEntry = {
      id: Date.now().toString(),
      score: parseInt(newScore.score),
      date: new Date(newScore.date),
      provider: newScore.provider,
      notes: newScore.notes
    };
    
    setCreditScores([...creditScores, score].sort((a, b) => b.date.getTime() - a.date.getTime()));
    setNewScore({
      score: '',
      date: new Date().toISOString().split('T')[0],
      provider: 'fico',
      notes: ''
    });
    setShowAddScore(false);
  };

  const calculateAmortizationSchedule = () => {
    const loanAmount = parseFloat(amortizationInputs.loanAmount);
    const annualRate = parseFloat(amortizationInputs.interestRate) / 100;
    const loanTermYears = parseFloat(amortizationInputs.loanTerm);
    const startDateInput = amortizationInputs.startDate;

    if (!loanAmount || !annualRate || !loanTermYears || !startDateInput) {
      return null;
    }

    const startDate = new Date(startDateInput);
    if (Number.isNaN(startDate.getTime())) {
      return null;
    }
    
    const monthlyRate = annualRate / 12;
    const totalPayments = loanTermYears * 12;
    const monthlyPayment = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, totalPayments)) / (Math.pow(1 + monthlyRate, totalPayments) - 1);
    
    const schedule = [];
    let balance = loanAmount;
    let totalInterest = 0;
    
    for (let month = 1; month <= totalPayments; month++) {
      const interestPayment = balance * monthlyRate;
      const principalPayment = monthlyPayment - interestPayment;
      balance -= principalPayment;
      totalInterest += interestPayment;
      
      const paymentDate = new Date(startDate);
      paymentDate.setMonth(paymentDate.getMonth() + month - 1);
      
      schedule.push({
        month,
        date: paymentDate,
        payment: monthlyPayment,
        principal: principalPayment,
        interest: interestPayment,
        balance: Math.max(0, balance)
      });
    }
    
    return {
      schedule,
      monthlyPayment,
      totalInterest,
      totalPayments: monthlyPayment * totalPayments
    };
  };

  const amortizationResult = calculateAmortizationSchedule();

  const latestCreditScore = creditScores[0] ?? null;
  const previousCreditScore = creditScores[1] ?? null;
  const creditScoreChange = latestCreditScore && previousCreditScore
    ? latestCreditScore.score - previousCreditScore.score
    : 0;

  const getDebtTypeColor = (type: Debt['type']): string => {
    switch (type) {
      case 'credit_card': return 'text-red-600 dark:text-red-400';
      case 'mortgage': return 'text-green-600 dark:text-green-400';
      case 'student_loan': return 'text-gray-600 dark:text-gray-500';
      case 'auto_loan': return 'text-purple-600 dark:text-purple-400';
      case 'personal_loan': return 'text-orange-600 dark:text-orange-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

  const getDebtTypeIcon = (type: Debt['type']) => {
    switch (type) {
      case 'credit_card': return CreditCardIcon;
      case 'mortgage': return TargetIcon;
      case 'student_loan': return InfoIcon;
      case 'auto_loan': return TrendingUpIcon;
      case 'personal_loan': return DollarSignIcon;
      default: return InfoIcon;
    }
  };

  const renderDebtCard = (debt: Debt) => {
    const account = accounts.find(a => a.id === debt.accountId);
    const Icon = getDebtTypeIcon(debt.type);
    const projection = projections.find(p => p.debtId === debt.id);
    
    return (
      <div
        key={debt.id}
        className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6 hover:shadow-xl transition-all"
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <Icon className={getDebtTypeColor(debt.type)} size={24} />
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {debt.name}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">
                {debt.type.replace('_', ' ')}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedDebt(debt.id)}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <EditIcon size={16} />
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">Balance:</span>
            <span className="text-lg font-bold text-red-600 dark:text-red-400">
              {formatCurrency(debt.balance)}
            </span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">Interest Rate:</span>
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {debt.interestRate.toFixed(2)}%
            </span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">Min Payment:</span>
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {formatCurrency(debt.minimumPayment)}
            </span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">Due Date:</span>
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {debt.dueDate}{debt.dueDate === 1 ? 'st' : debt.dueDate === 2 ? 'nd' : debt.dueDate === 3 ? 'rd' : 'th'} of month
            </span>
          </div>
          
          {projection && (
            <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Payoff Time:</span>
                <span className="text-sm font-medium text-green-600 dark:text-green-400">
                  {Math.floor(projection.monthsToPayoff / 12)}y {projection.monthsToPayoff % 12}m
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Total Interest:</span>
                <span className="text-sm font-medium text-orange-600 dark:text-orange-400">
                  {formatCurrency(projection.totalInterest)}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Debt Management</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Track and manage your debt payoff strategy
          </p>
        </div>
        <button
          onClick={() => setShowAddDebt(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90"
        >
          <PlusIcon size={16} />
          Add Debt
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Debt</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                {formatCurrency(totalDebt)}
              </p>
            </div>
            <TrendingDownIcon className="text-red-500" size={24} />
          </div>
        </div>

        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Monthly Payments</p>
              <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                {formatCurrency(totalMinimumPayment)}
              </p>
            </div>
            <CalculatorIcon className="text-orange-500" size={24} />
          </div>
        </div>

        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Avg Interest Rate</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {totalInterestRate.toFixed(2)}%
              </p>
            </div>
            <BarChart3Icon className="text-gray-500" size={24} />
          </div>
        </div>

        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Credit Score</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {latestCreditScore ? latestCreditScore.score : 'N/A'}
              </p>
              {creditScoreChange !== 0 && (
                <p className={`text-xs ${creditScoreChange > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {creditScoreChange > 0 ? '+' : ''}{creditScoreChange}
                </p>
              )}
            </div>
            <TrendingUpIcon className="text-green-500" size={24} />
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-1 bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
        {[
          { id: 'overview', label: 'Overview', icon: BarChart3Icon },
          { id: 'payoff', label: 'Payoff Strategy', icon: TargetIcon },
          { id: 'calculator', label: 'Calculator', icon: CalculatorIcon },
          { id: 'credit', label: 'Credit Score', icon: TrendingUpIcon }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === tab.id
                ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {debts.filter(d => d.isActive).map(renderDebtCard)}
          
          {debts.filter(d => d.isActive).length === 0 && (
            <div className="col-span-full text-center py-12">
              <CreditCardIcon className="mx-auto text-gray-400 mb-4" size={48} />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                No debts tracked
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                Add your debts to start tracking and planning your payoff strategy
              </p>
              <button
                onClick={() => setShowAddDebt(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90"
              >
                <PlusIcon size={16} />
                Add Your First Debt
              </button>
            </div>
          )}
        </div>
      )}

      {activeTab === 'payoff' && (
        <div className="space-y-6">
          {/* Strategy Selection */}
          <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Payoff Strategy
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={() => handlePayoffStrategyChange('snowball')}
                className={`p-4 text-left border rounded-lg transition-colors ${
                  payoffStrategy.type === 'snowball'
                    ? 'border-[var(--color-primary)] bg-blue-50 dark:bg-gray-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                }`}
              >
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                  Debt Snowball
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Pay off smallest balances first for psychological wins
                </p>
              </button>
              
              <button
                onClick={() => handlePayoffStrategyChange('avalanche')}
                className={`p-4 text-left border rounded-lg transition-colors ${
                  payoffStrategy.type === 'avalanche'
                    ? 'border-[var(--color-primary)] bg-blue-50 dark:bg-gray-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                }`}
              >
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                  Debt Avalanche
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Pay off highest interest rates first to minimize total interest
                </p>
              </button>
            </div>
          </div>

          {/* Payoff Projections */}
          {projections.length > 0 && (
            <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Payoff Projections
              </h3>
              
              <div className="space-y-4">
                {projections.map(projection => (
                  <div
                    key={projection.debtId}
                    className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                  >
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white">
                        {projection.debtName}
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {Math.floor(projection.monthsToPayoff / 12)}y {projection.monthsToPayoff % 12}m to pay off
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600 dark:text-gray-400">Total Interest</p>
                      <p className="font-medium text-orange-600 dark:text-orange-400">
                        {formatCurrency(projection.totalInterest)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'calculator' && (
        <div className="space-y-6">
          <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Debt Payoff Calculator
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Current Balance
                  </label>
                  <input
                    type="number"
                    value={calculatorInputs.balance}
                    onChange={(e) => setCalculatorInputs({...calculatorInputs, balance: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="10000"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Annual Interest Rate (%)
                  </label>
                  <input
                    type="number"
                    value={calculatorInputs.interestRate}
                    onChange={(e) => setCalculatorInputs({...calculatorInputs, interestRate: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="18.5"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Monthly Payment
                  </label>
                  <input
                    type="number"
                    value={calculatorInputs.payment}
                    onChange={(e) => setCalculatorInputs({...calculatorInputs, payment: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="300"
                  />
                </div>
              </div>
              
              <div className="space-y-4">
                {payoffResult && (
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <h4 className="font-medium text-green-900 dark:text-green-100 mb-3">
                      Payoff Results
                    </h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-green-800 dark:text-green-200">Time to pay off:</span>
                        <span className="text-sm font-medium text-green-900 dark:text-green-100">
                          {Math.floor(payoffResult.months / 12)}y {payoffResult.months % 12}m
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-green-800 dark:text-green-200">Total interest:</span>
                        <span className="text-sm font-medium text-green-900 dark:text-green-100">
                          {formatCurrency(payoffResult.totalInterest)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-green-800 dark:text-green-200">Total payments:</span>
                        <span className="text-sm font-medium text-green-900 dark:text-green-100">
                          {formatCurrency(payoffResult.totalPayments)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Amortization Schedule */}
          <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Loan Amortization Schedule
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Loan Amount
                  </label>
                  <input
                    type="number"
                    value={amortizationInputs.loanAmount}
                    onChange={(e) => setAmortizationInputs({...amortizationInputs, loanAmount: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="200000"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Annual Interest Rate (%)
                  </label>
                  <input
                    type="number"
                    value={amortizationInputs.interestRate}
                    onChange={(e) => setAmortizationInputs({...amortizationInputs, interestRate: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="4.5"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Loan Term (Years)
                  </label>
                  <input
                    type="number"
                    value={amortizationInputs.loanTerm}
                    onChange={(e) => setAmortizationInputs({...amortizationInputs, loanTerm: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="30"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={amortizationInputs.startDate}
                    onChange={(e) => setAmortizationInputs({...amortizationInputs, startDate: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>
              
              <div className="space-y-4">
                {amortizationResult && (
                  <div className="p-4 bg-blue-50 dark:bg-gray-900/20 rounded-lg">
                    <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-3">
                      Loan Summary
                    </h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-blue-800 dark:text-blue-200">Monthly Payment:</span>
                        <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                          {formatCurrency(amortizationResult.monthlyPayment)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-blue-800 dark:text-blue-200">Total Interest:</span>
                        <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                          {formatCurrency(amortizationResult.totalInterest)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-blue-800 dark:text-blue-200">Total Payments:</span>
                        <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                          {formatCurrency(amortizationResult.totalPayments)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {amortizationResult && (
              <div className="mt-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-medium text-gray-900 dark:text-white">Payment Schedule</h4>
                  <button
                    onClick={() => setShowAmortization(!showAmortization)}
                    className="text-sm text-gray-600 hover:text-blue-800"
                  >
                    {showAmortization ? 'Hide' : 'Show'} Schedule
                  </button>
                </div>
                
                {showAmortization && (
                  <div className="max-h-96 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                          <th className="px-3 py-2 text-left">Month</th>
                          <th className="px-3 py-2 text-left">Date</th>
                          <th className="px-3 py-2 text-left">Payment</th>
                          <th className="px-3 py-2 text-left">Principal</th>
                          <th className="px-3 py-2 text-left">Interest</th>
                          <th className="px-3 py-2 text-left">Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {amortizationResult.schedule.slice(0, 12).map((payment, index) => (
                          <tr key={index} className="border-b border-gray-200 dark:border-gray-600">
                            <td className="px-3 py-2">{payment.month}</td>
                            <td className="px-3 py-2">{payment.date.toLocaleDateString()}</td>
                            <td className="px-3 py-2">{formatCurrency(payment.payment)}</td>
                            <td className="px-3 py-2">{formatCurrency(payment.principal)}</td>
                            <td className="px-3 py-2">{formatCurrency(payment.interest)}</td>
                            <td className="px-3 py-2">{formatCurrency(payment.balance)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {amortizationResult.schedule.length > 12 && (
                      <p className="text-center text-gray-500 mt-2">
                        Showing first 12 payments of {amortizationResult.schedule.length} total
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'credit' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Credit Score Tracking
            </h3>
            <button
              onClick={() => setShowAddScore(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90"
            >
              <PlusIcon size={16} />
              Add Score
            </button>
          </div>

          {/* Credit Score History */}
          <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6">
            <h4 className="font-medium text-gray-900 dark:text-white mb-4">Score History</h4>
            
            {creditScores.length === 0 ? (
              <div className="text-center py-12">
                <TrendingUpIcon className="mx-auto text-gray-400 mb-4" size={48} />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  No credit scores recorded
                </h3>
                <p className="text-gray-500 dark:text-gray-400 mb-4">
                  Start tracking your credit score to monitor your financial health
                </p>
                <button
                  onClick={() => setShowAddScore(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90"
                >
                  <PlusIcon size={16} />
                  Add Your First Score
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {creditScores.map((score, index) => {
                  const nextScore = creditScores[index + 1];
                  const scoreDelta = nextScore ? score.score - nextScore.score : 0;
                  const trendClass = scoreDelta > 0
                    ? 'text-green-600 dark:text-green-400'
                    : scoreDelta < 0
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-gray-600 dark:text-gray-400';

                  return (
                    <div key={score.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {score.score}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {score.provider.toUpperCase()} • {score.date.toLocaleDateString()}
                      </p>
                      {score.notes && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {score.notes}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      {nextScore ? (
                        <p className={`text-sm font-medium ${trendClass}`}>
                          {scoreDelta > 0 ? '+' : ''}
                          {scoreDelta}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Debt Modal */}
      {showAddDebt && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Add New Debt</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Debt Name
                </label>
                <input
                  type="text"
                  value={newDebt.name}
                  onChange={(e) => setNewDebt({...newDebt, name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="e.g., Credit Card"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Debt Type
                </label>
                <select
                  value={newDebt.type}
                  onChange={(e) => setNewDebt({...newDebt, type: e.target.value as Debt['type']})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="credit_card">Credit Card</option>
                  <option value="personal_loan">Personal Loan</option>
                  <option value="mortgage">Mortgage</option>
                  <option value="student_loan">Student Loan</option>
                  <option value="auto_loan">Auto Loan</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Balance
                  </label>
                  <input
                    type="number"
                    value={newDebt.balance}
                    onChange={(e) => setNewDebt({...newDebt, balance: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="10000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Interest Rate (%)
                  </label>
                  <input
                    type="number"
                    value={newDebt.interestRate}
                    onChange={(e) => setNewDebt({...newDebt, interestRate: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="18.5"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Minimum Payment
                  </label>
                  <input
                    type="number"
                    value={newDebt.minimumPayment}
                    onChange={(e) => setNewDebt({...newDebt, minimumPayment: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="200"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Due Date (Day of Month)
                  </label>
                  <input
                    type="number"
                    value={newDebt.dueDate}
                    onChange={(e) => setNewDebt({...newDebt, dueDate: parseInt(e.target.value) || 1})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    min="1"
                    max="31"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Account
                </label>
                <select
                  value={newDebt.accountId}
                  onChange={(e) => setNewDebt({...newDebt, accountId: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Select account...</option>
                  {accounts.map(account => (
                    <option key={account.id} value={account.id}>{account.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Notes (Optional)
                </label>
                <textarea
                  value={newDebt.notes}
                  onChange={(e) => setNewDebt({...newDebt, notes: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  rows={2}
                  placeholder="Additional notes..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowAddDebt(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleAddDebt}
                className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90"
              >
                Add Debt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Credit Score Modal */}
      {showAddScore && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Add Credit Score</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Credit Score
                </label>
                <input
                  type="number"
                  value={newScore.score}
                  onChange={(e) => setNewScore({...newScore, score: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="750"
                  min="300"
                  max="850"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Date
                </label>
                <input
                  type="date"
                  value={newScore.date}
                  onChange={(e) => setNewScore({...newScore, date: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Provider
                </label>
                <select
                  value={newScore.provider}
                  onChange={(e) => setNewScore({...newScore, provider: e.target.value as CreditScoreEntry['provider']})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="fico">FICO</option>
                  <option value="vantage">VantageScore</option>
                  <option value="experian">Experian</option>
                  <option value="equifax">Equifax</option>
                  <option value="transunion">TransUnion</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Notes (Optional)
                </label>
                <textarea
                  value={newScore.notes}
                  onChange={(e) => setNewScore({...newScore, notes: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  rows={2}
                  placeholder="Any notes about this score..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowAddScore(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleAddScore}
                className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90"
              >
                Add Score
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
