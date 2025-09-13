import { useState, useEffect, useMemo } from 'react';
import Decimal from 'decimal.js';
import { useApp } from '../../contexts/AppContextSupabase';
import { portfolioRebalanceService } from '../../services/portfolioRebalanceService';
import type { AssetAllocation } from '../../services/portfolioRebalanceService';
import type { Investment } from '../../types';
import type { ViewMode, GroupBy } from './types';

export function useAllocationAnalysis(accountId?: string) {
  const [allocations, setAllocations] = useState<AssetAllocation[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('pie');
  const [groupBy, setGroupBy] = useState<GroupBy>('assetClass');
  const [showTargets, setShowTargets] = useState(true);
  
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

  useEffect(() => {
    analyzeAllocations();
  }, [accountId, investments, groupBy]);

  const analyzeAllocations = () => {
    if (groupBy === 'assetClass') {
      // Use the portfolio rebalance service for asset class allocation
      const holdings = investments
        .filter(inv => !accountId || inv.accountId === accountId)
        .map(inv => ({
          symbol: inv.symbol,
          value: inv.currentValue,
          shares: inv.quantity
        }));

      const allocs = portfolioRebalanceService.calculateCurrentAllocation(holdings);
      setAllocations(allocs);
    } else if (groupBy === 'account') {
      // Group by account
      const byAccount: Record<string, number> = {};
      const totalValue = investments.reduce((sum, inv) => sum + inv.currentValue, 0);

      investments.forEach(inv => {
        const account = accounts.find(a => a.id === inv.accountId);
        const accountName = account?.name || 'Unknown';
        byAccount[accountName] = (byAccount[accountName] || 0) + inv.currentValue;
      });

      const accountAllocations: AssetAllocation[] = Object.entries(byAccount).map(([name, value]) => {
        const currentVal = new Decimal(value);
        const targetVal = new Decimal(0);
        return {
          assetClass: name,
          currentPercent: (value / totalValue) * 100,
          targetPercent: 0,
          currentValue: currentVal,
          targetValue: targetVal,
          difference: currentVal.minus(targetVal),
          differencePercent: 0
        };
      });

      setAllocations(accountAllocations);
    } else {
      // Group by symbol
      const bySymbol: Record<string, { value: number; name: string }> = {};
      const totalValue = investments.reduce((sum, inv) => sum + inv.currentValue, 0);

      investments.forEach(inv => {
        if (!bySymbol[inv.symbol]) {
          bySymbol[inv.symbol] = { value: 0, name: inv.name };
        }
        bySymbol[inv.symbol].value += inv.currentValue;
      });

      const symbolAllocations: AssetAllocation[] = Object.entries(bySymbol).map(([symbol, data]) => {
        const currentVal = new Decimal(data.value);
        const targetVal = new Decimal(0);
        return {
          assetClass: `${symbol} - ${data.name}`,
          currentPercent: (data.value / totalValue) * 100,
          targetPercent: 0,
          currentValue: currentVal,
          targetValue: targetVal,
          difference: currentVal.minus(targetVal),
          differencePercent: 0
        };
      });

      setAllocations(symbolAllocations.sort((a, b) => b.currentValue.toNumber() - a.currentValue.toNumber()));
    }
  };

  const totalValue = useMemo(() => {
    return allocations.reduce((sum, alloc) => sum + alloc.currentValue.toNumber(), 0);
  }, [allocations]);

  const largestHolding = useMemo(() => {
    if (allocations.length === 0) return null;
    return allocations.reduce((max, alloc) =>
      (max ? (alloc.currentPercent > max.currentPercent ? alloc : max) : alloc)
    );
  }, [allocations]);

  const exportData = () => {
    const dataStr = JSON.stringify(allocations, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const exportFileDefaultName = `allocation-analysis-${new Date().toISOString()}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  return {
    allocations,
    viewMode,
    setViewMode,
    groupBy,
    setGroupBy,
    showTargets,
    setShowTargets,
    investments,
    totalValue,
    largestHolding,
    exportData
  };
}
