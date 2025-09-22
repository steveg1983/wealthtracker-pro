import { useState, useEffect, useMemo } from 'react';
import { dividendService } from '../../services/dividendService';
import { useApp } from '../../contexts/AppContextSupabase';
import type { 
  Dividend, 
  DividendSummary, 
  DividendProjection,
  Investment,
  DateRange 
} from './types';

export function useDividendTracker(accountId?: string, investmentId?: string) {
  const [dividends, setDividends] = useState<Dividend[]>([]);
  const [summary, setSummary] = useState<DividendSummary | null>(null);
  const [projections, setProjections] = useState<DividendProjection[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingDividend, setEditingDividend] = useState<Dividend | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>('1y');
  const [selectedSymbol, setSelectedSymbol] = useState<string>('');
  
  const { accounts } = useApp();

  // Extract investments from accounts with holdings
  const investments = useMemo(() => {
    const allInvestments: Investment[] = [];
    accounts.forEach(account => {
      if (account.type === 'investment' && account.holdings) {
        account.holdings.forEach(holding => {
          allInvestments.push({
            id: `${account.id}-${holding.ticker}`,
            accountId: account.id,
            symbol: holding.ticker,
            name: holding.name,
            quantity: holding.shares,
            purchasePrice: holding.averageCost || 0,
            purchaseDate: new Date(),
            currentPrice: holding.currentPrice,
            currentValue: holding.marketValue || holding.value,
            averageCost: holding.averageCost || 0,
            createdAt: new Date()
          } as Investment);
        });
      }
    });
    return allInvestments;
  }, [accounts]);

  // Get unique symbols from investments
  const symbols = Array.from(new Set(investments.map(inv => inv.symbol))).sort();

  // Load data
  useEffect(() => {
    loadDividends();
  }, [accountId, investmentId, dateRange, selectedSymbol]);

  const loadDividends = () => {
    // Calculate date range
    let startDate: Date | undefined;
    const today = new Date();
    
    switch (dateRange) {
      case 'ytd':
        startDate = new Date(today.getFullYear(), 0, 1);
        break;
      case '1y':
        startDate = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
        break;
      case '3y':
        startDate = new Date(today.getFullYear() - 3, today.getMonth(), today.getDate());
        break;
      case 'all':
        startDate = undefined;
        break;
    }

    // Load dividends
    const filters = {
      accountId,
      investmentId,
      symbol: selectedSymbol || undefined,
      startDate
    };
    
    const divs = dividendService.getDividends(filters);
    setDividends(divs);

    // Load summary
    const sum = dividendService.getDividendSummary(startDate);
    setSummary(sum);

    // Load projections
    const holdings = investments
      .filter(inv => !accountId || inv.accountId === accountId)
      .map(inv => ({
        symbol: inv.symbol,
        shares: inv.quantity,
        currentValue: inv.currentValue
      }));
    
    const proj = dividendService.getDividendProjections(holdings);
    setProjections(proj);
  };

  const handleAddDividend = async (data: Partial<Dividend>) => {
    if (!data.symbol || !data.amount) return;

    const investment = investments.find(inv => inv.symbol === data.symbol);
    if (!investment) return;

    const dividend: Omit<Dividend, 'id'> = {
      investmentId: investment.id,
      accountId: investment.accountId,
      symbol: data.symbol,
      amount: data.amount,
      amountPerShare: data.amountPerShare || data.amount / investment.quantity,
      shares: investment.quantity,
      currency: 'USD',
      paymentDate: data.paymentDate || new Date(),
      exDividendDate: data.exDividendDate || new Date(),
      recordDate: data.recordDate,
      declarationDate: data.declarationDate,
      frequency: data.frequency || 'quarterly',
      type: data.type || 'regular',
      taxWithheld: data.taxWithheld,
      reinvested: data.reinvested || false,
      reinvestmentPrice: data.reinvestmentPrice,
      reinvestmentShares: data.reinvestmentShares,
      notes: data.notes
    };

    dividendService.addDividend(dividend);
    loadDividends();
    setShowAddModal(false);
  };

  const handleUpdateDividend = (dividendData: Partial<Dividend>) => {
    if (!editingDividend || !dividendData) return;
    
    const updatedDividend: Dividend = {
      ...editingDividend,
      ...dividendData
    };
    
    dividendService.updateDividend(updatedDividend.id, updatedDividend);
    loadDividends();
    setEditingDividend(null);
  };

  const handleDeleteDividend = (dividendId: string) => {
    if (confirm('Are you sure you want to delete this dividend record?')) {
      dividendService.deleteDividend(dividendId);
      loadDividends();
    }
  };

  const handleExport = () => {
    const csv = dividendService.exportToCSV();
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dividends-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return {
    dividends,
    summary,
    projections,
    showAddModal,
    editingDividend,
    dateRange,
    selectedSymbol,
    symbols,
    investments,
    setShowAddModal,
    setEditingDividend,
    setDateRange,
    setSelectedSymbol,
    handleAddDividend,
    handleUpdateDividend,
    handleDeleteDividend,
    handleExport
  };
}