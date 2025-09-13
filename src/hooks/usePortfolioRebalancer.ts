import { useState, useEffect, useMemo, useCallback } from 'react';
import { portfolioRebalanceService } from '../services/portfolioRebalanceService';
import type { AssetAllocation, RebalanceAction, PortfolioTarget } from '../services/portfolioRebalanceService';
import type { Investment } from '../types';
import type { Account } from '../types';

export function usePortfolioRebalancer(accountId: string | undefined, accounts: Account[]) {
  const [allocations, setAllocations] = useState<AssetAllocation[]>([]);
  const [rebalanceActions, setRebalanceActions] = useState<RebalanceAction[]>([]);
  const [portfolioTargets, setPortfolioTargets] = useState<PortfolioTarget[]>([]);
  const [activeTarget, setActiveTarget] = useState<PortfolioTarget | null>(null);
  const [rebalanceNeeded, setRebalanceNeeded] = useState(false);
  const [cashAvailable, setCashAvailable] = useState(0);
  const [taxConsiderations, setTaxConsiderations] = useState(true);

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

  const loadPortfolioData = useCallback(() => {
    // Get holdings
    const holdings = investments
      .filter(inv => !accountId || inv.accountId === accountId)
      .map(inv => ({
        symbol: inv.symbol,
        name: inv.name,
        shares: inv.quantity,
        value: inv.currentValue,
        price: inv.currentPrice || inv.currentValue / inv.quantity
      }));

    if (holdings.length === 0) return;

    // Calculate allocations
    const allocs = portfolioRebalanceService.calculateCurrentAllocation(holdings);
    setAllocations(allocs);

    // Load targets
    const targets = portfolioRebalanceService.getPortfolioTargets();
    setPortfolioTargets(targets);
    
    const active = portfolioRebalanceService.getActiveTarget();
    setActiveTarget(active);

    // Check if rebalancing needed
    const needsRebalance = portfolioRebalanceService.isRebalancingNeeded(allocs);
    setRebalanceNeeded(needsRebalance);

    // Calculate rebalance actions if needed
    if (needsRebalance && active) {
      const actions = portfolioRebalanceService.calculateRebalanceActions(
        holdings,
        cashAvailable,
        taxConsiderations
      );
      setRebalanceActions(actions);
    } else {
      setRebalanceActions([]);
    }
  }, [accountId, investments, cashAvailable, taxConsiderations]);

  // Load data on mount and when dependencies change
  useEffect(() => {
    loadPortfolioData();
  }, [loadPortfolioData]);

  const handleSaveTarget = useCallback((target: Partial<PortfolioTarget>) => {
    const savedTarget = portfolioRebalanceService.savePortfolioTarget({
      ...target,
      isActive: true,
      allocations: target.allocations || []
    } as PortfolioTarget);

    // Deactivate other targets if this one is active
    if (savedTarget.isActive) {
      portfolioTargets.forEach(t => {
        if (t.id !== savedTarget.id && t.isActive) {
          portfolioRebalanceService.savePortfolioTarget({ ...t, isActive: false });
        }
      });
    }

    loadPortfolioData();
    return savedTarget;
  }, [portfolioTargets, loadPortfolioData]);

  const handleDeleteTarget = useCallback((targetId: string) => {
    portfolioRebalanceService.deletePortfolioTarget(targetId);
    loadPortfolioData();
  }, [loadPortfolioData]);

  const handleSetActiveTarget = useCallback((target: PortfolioTarget) => {
    // Deactivate all targets
    portfolioTargets.forEach(t => {
      portfolioRebalanceService.savePortfolioTarget({ ...t, isActive: false });
    });
    
    // Activate selected target
    portfolioRebalanceService.savePortfolioTarget({ ...target, isActive: true });
    loadPortfolioData();
  }, [portfolioTargets, loadPortfolioData]);

  const handleExecuteRebalance = useCallback(() => {
    if (!activeTarget) return;
    
    // Mark as rebalanced
    portfolioRebalanceService.markRebalanced(activeTarget.id);
    loadPortfolioData();
  }, [activeTarget, loadPortfolioData]);

  return {
    allocations,
    rebalanceActions,
    portfolioTargets,
    activeTarget,
    rebalanceNeeded,
    cashAvailable,
    setCashAvailable,
    taxConsiderations,
    setTaxConsiderations,
    loadPortfolioData,
    handleSaveTarget,
    handleDeleteTarget,
    handleSetActiveTarget,
    handleExecuteRebalance
  };
}