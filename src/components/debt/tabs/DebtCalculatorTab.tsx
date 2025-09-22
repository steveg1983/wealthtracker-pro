import React, { useEffect, useState, useMemo } from 'react';
import { useLogger } from '../services/ServiceProvider';

interface DebtCalculatorTabProps {
  formatCurrency: (value: number) => string;
}

export function DebtCalculatorTab({ formatCurrency  }: DebtCalculatorTabProps): React.JSX.Element {
  const logger = useLogger();
  const [calculatorInputs, setCalculatorInputs] = useState({
    balance: '',
    interestRate: '',
    payment: '',
    targetMonths: ''
  });

  const [amortizationInputs, setAmortizationInputs] = useState({
    loanAmount: '',
    interestRate: '',
    loanTerm: '',
    startDate: new Date().toISOString().split('T')[0]
  });

  const [showAmortization, setShowAmortization] = useState(false);

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
      
      if (principalPayment <= 0) break;
      
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

  const calculateAmortizationSchedule = () => {
    const loanAmount = parseFloat(amortizationInputs.loanAmount);
    const annualRate = parseFloat(amortizationInputs.interestRate) / 100;
    const loanTermYears = parseFloat(amortizationInputs.loanTerm);
    const startDate = new Date(amortizationInputs.startDate);
    
    if (!loanAmount || !annualRate || !loanTermYears) return null;
    
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

  const payoffResult = useMemo(() => calculateLoanPayoff(), [calculatorInputs]);
  const amortizationResult = useMemo(() => calculateAmortizationSchedule(), [amortizationInputs]);

  return (
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
  );
}