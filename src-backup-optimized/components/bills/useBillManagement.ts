import { useState, useMemo } from 'react';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { useApp } from '../../contexts/AppContextSupabase';
import { toDecimal } from '../../utils/decimal';
import type { Bill, BillPayment } from './types';

export function useBillManagement() {
  const { addTransaction } = useApp();
  const [bills, setBills] = useLocalStorage<Bill[]>('bills', []);
  const [showAddBill, setShowAddBill] = useState(false);
  const [editingBill, setEditingBill] = useState<Bill | null>(null);
  const [selectedBill, setSelectedBill] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'overdue' | 'all' | 'history'>('upcoming');

  const calculateNextDueDate = (lastDue: Date, frequency: Bill['frequency']): Date => {
    const next = new Date(lastDue);
    
    switch (frequency) {
      case 'weekly':
        next.setDate(next.getDate() + 7);
        break;
      case 'biweekly':
        next.setDate(next.getDate() + 14);
        break;
      case 'monthly':
        next.setMonth(next.getMonth() + 1);
        break;
      case 'quarterly':
        next.setMonth(next.getMonth() + 3);
        break;
      case 'yearly':
        next.setFullYear(next.getFullYear() + 1);
        break;
      case 'one-time':
        return lastDue;
    }
    
    return next;
  };

  const { upcomingBills, overdueBills, allBills } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const activeBills = bills.filter(bill => bill.isActive);
    
    const upcomingBills = activeBills.filter(bill => {
      const dueDate = new Date(bill.nextDueDate);
      dueDate.setHours(0, 0, 0, 0);
      return dueDate >= today;
    }).sort((a, b) => new Date(a.nextDueDate).getTime() - new Date(b.nextDueDate).getTime());
    
    const overdueBills = activeBills.filter(bill => {
      const dueDate = new Date(bill.nextDueDate);
      dueDate.setHours(0, 0, 0, 0);
      return dueDate < today;
    }).sort((a, b) => new Date(a.nextDueDate).getTime() - new Date(b.nextDueDate).getTime());
    
    return { upcomingBills, overdueBills, allBills: activeBills };
  }, [bills]);

  const handleAddBill = (newBill: Omit<Bill, 'id' | 'paymentHistory' | 'createdAt' | 'nextDueDate'>) => {
    const dueDate = new Date(newBill.dueDate);
    const nextDueDate = calculateNextDueDate(dueDate, newBill.frequency);
    
    const bill: Bill = {
      ...newBill,
      id: Date.now().toString(),
      paymentHistory: [],
      createdAt: new Date(),
      nextDueDate: nextDueDate
    };
    
    setBills([...bills, bill]);
    setShowAddBill(false);
  };

  const handlePayBill = (billId: string) => {
    const bill = bills.find(b => b.id === billId);
    if (!bill) return;
    
    const today = new Date();
    const dueDate = new Date(bill.nextDueDate);
    const isLate = today > dueDate;
    
    const payment: BillPayment = {
      id: Date.now().toString(),
      billId: billId,
      amount: bill.amount,
      paidDate: today,
      dueDate: dueDate,
      isPaid: true,
      isLate: isLate,
      lateFee: isLate ? toDecimal(25) : undefined
    };
    
    const transaction = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      date: today,
      description: `Bill Payment: ${bill.name}`,
      amount: bill.amount.plus(payment.lateFee || toDecimal(0)).toNumber(),
      category: bill.category,
      accountId: bill.accountId,
      type: 'expense' as const,
      cleared: false
    };
    
    addTransaction(transaction);
    payment.transactionId = transaction.id;
    
    const updatedBills = bills.map(b => {
      if (b.id === billId) {
        return {
          ...b,
          paymentHistory: [...b.paymentHistory, payment],
          nextDueDate: calculateNextDueDate(dueDate, b.frequency)
        };
      }
      return b;
    });
    
    setBills(updatedBills);
  };

  const handleDeleteBill = (billId: string) => {
    setBills(bills.filter(b => b.id !== billId));
  };

  const handleToggleActive = (billId: string) => {
    setBills(bills.map(b => 
      b.id === billId ? { ...b, isActive: !b.isActive } : b
    ));
  };

  const handleUpdateBill = (billId: string, updates: Partial<Bill>) => {
    setBills(bills.map(b => 
      b.id === billId ? { ...b, ...updates } : b
    ));
    setEditingBill(null);
  };

  const totalUpcoming = upcomingBills.reduce((sum, bill) => sum.plus(bill.amount), toDecimal(0));
  const totalOverdue = overdueBills.reduce((sum, bill) => sum.plus(bill.amount), toDecimal(0));

  return {
    // State
    bills,
    upcomingBills,
    overdueBills,
    allBills,
    showAddBill,
    setShowAddBill,
    editingBill,
    setEditingBill,
    selectedBill,
    setSelectedBill,
    activeTab,
    setActiveTab,
    totalUpcoming,
    totalOverdue,
    
    // Actions
    handleAddBill,
    handlePayBill,
    handleDeleteBill,
    handleToggleActive,
    handleUpdateBill
  };
}