import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { portfolioRebalanceService } from '../services/portfolioRebalanceService';
import type { AssetAllocation, RebalanceAction, PortfolioTarget } from '../services/portfolioRebalanceService';
import { parseMoneyInput } from '../utils/decimal';
import { useApp } from '../contexts/AppContextSupabase';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import type { Investment } from '../types';
import {
  AlertCircleIcon,
  CheckCircleIcon,
  RefreshCwIcon,
  TargetIcon,
  InfoIcon,
  EditIcon,
} from './icons';
import { TargetManagementModal } from './PortfolioTargetModal';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { formatDecimal } from '../utils/decimal-format';

interface PortfolioRebalancerProps {
  accountId?: string;
}

export default function PortfolioRebalancer({ accountId }: PortfolioRebalancerProps) {
  const [allocations, setAllocations] = useState<AssetAllocation[]>([]);
  const [rebalanceActions, setRebalanceActions] = useState<RebalanceAction[]>([]);
  const [portfolioTargets, setPortfolioTargets] = useState<PortfolioTarget[]>([]);
  const [activeTarget, setActiveTarget] = useState<PortfolioTarget | null>(null);
  const [showTargetModal, setShowTargetModal] = useState(false);
  const [editingTarget, setEditingTarget] = useState<PortfolioTarget | null>(null);
  const [prefillTarget, setPrefillTarget] = useState<Partial<PortfolioTarget> | null>(null);
  const [rebalanceNeeded, setRebalanceNeeded] = useState(false);
  const [cashAvailable, setCashAvailable] = useState(0);
  const [taxConsiderations, setTaxConsiderations] = useState(true);
  
  const { accounts } = useApp();
  const { formatCurrency } = useCurrencyDecimal();

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
  }, [accountId, cashAvailable, investments, taxConsiderations]);

  // Load data
  useEffect(() => {
    loadPortfolioData();
  }, [loadPortfolioData]);

  const handleSaveTarget = (target: Partial<PortfolioTarget>) => {
    if (!target.name || !(target.allocations && target.allocations.length > 0)) {
      alert('Please provide a target name and allocations');
      return;
    }

    const savedTarget = portfolioRebalanceService.savePortfolioTarget({
      id: editingTarget?.id || crypto.randomUUID(),
      name: target.name!,
      description: target.description || '',
      allocations: target.allocations!,
      rebalanceThreshold: target.rebalanceThreshold ?? 5,
      isActive: true,
      lastRebalanced: editingTarget?.lastRebalanced
    });

    // Deactivate other targets if this one is active
    if (savedTarget.isActive) {
      portfolioTargets.forEach(t => {
        if (t.id !== savedTarget.id && t.isActive) {
          portfolioRebalanceService.savePortfolioTarget({ ...t, isActive: false });
        }
      });
    }

    loadPortfolioData();
    setShowTargetModal(false);
    setEditingTarget(null);
    setPrefillTarget(null);
  };

  const handleDeleteTarget = (targetId: string) => {
    if (confirm('Are you sure you want to delete this portfolio target?')) {
      portfolioRebalanceService.deletePortfolioTarget(targetId);
      loadPortfolioData();
    }
  };

  const handleSetActiveTarget = (target: PortfolioTarget) => {
    // Deactivate all targets
    portfolioTargets.forEach(t => {
      portfolioRebalanceService.savePortfolioTarget({ ...t, isActive: false });
    });
    
    // Activate selected target
    portfolioRebalanceService.savePortfolioTarget({ ...target, isActive: true });
    loadPortfolioData();
  };

  const handleUseTemplate = (template: PortfolioTarget) => {
    setEditingTarget(null);
    setPrefillTarget({
      name: `${template.name} (Copy)`,
      description: template.description,
      allocations: template.allocations,
      rebalanceThreshold: template.rebalanceThreshold,
      isActive: true
    });
    setShowTargetModal(true);
  };

  const handleExecuteRebalance = () => {
    if (!activeTarget) return;
    
    // In a real app, this would create orders or transaction drafts
    alert('Rebalancing actions have been generated. Review and execute them through your broker.');
    
    // Mark as rebalanced
    portfolioRebalanceService.markRebalanced(activeTarget.id);
    loadPortfolioData();
  };

  // Chart data
  const chartData = allocations.map(alloc => ({
    name: alloc.assetClass,
    value: alloc.currentValue.toNumber(),
    percent: alloc.currentPercent
  }));

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#6B7280'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-semibold">Portfolio Rebalancing</h2>
          {rebalanceNeeded && (
            <span className="flex items-center gap-1 px-3 py-1 bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 rounded-full text-sm">
              <AlertCircleIcon size={16} />
              Rebalancing Recommended
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTargetModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
          >
            <TargetIcon size={20} />
            Manage Targets
          </button>
          
          <button
            onClick={loadPortfolioData}
            className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            title="Refresh"
          >
            <RefreshCwIcon size={20} />
          </button>
        </div>
      </div>

      {/* Active Target */}
      {activeTarget && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">{activeTarget.name}</h3>
            <button
              onClick={() => {
                setEditingTarget(activeTarget);
                setShowTargetModal(true);
              }}
              className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-gray-700 rounded-lg"
            >
              <EditIcon size={20} />
            </button>
          </div>
          
          {activeTarget.description && (
            <p className="text-gray-600 dark:text-gray-400 mb-4">{activeTarget.description}</p>
          )}
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            {activeTarget.allocations.map(alloc => (
              <div key={alloc.assetClass}>
                <span className="text-gray-600 dark:text-gray-400">{alloc.assetClass}:</span>
                <span className="ml-2 font-medium">{alloc.targetPercent}%</span>
              </div>
            ))}
          </div>
          
          {activeTarget.lastRebalanced && (
            <p className="text-xs text-gray-500 mt-4">
              Last rebalanced: {activeTarget.lastRebalanced.toLocaleDateString()}
            </p>
          )}
        </div>
      )}

      {/* Current Allocation */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4">Current Allocation</h3>
          
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${formatDecimal((percent ?? 0) as number, 1)}%`}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(value as number)} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-gray-500 py-8">No holdings to display</p>
          )}
        </div>

        {/* Allocation Table */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4">Allocation Details</h3>
          
          <div className="space-y-2">
            {allocations.map((alloc, index) => (
              <div key={alloc.assetClass} className="border-b dark:border-gray-700 pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span className="font-medium">{alloc.assetClass}</span>
                  </div>
                  <span className="font-medium">{formatCurrency(alloc.currentValue.toNumber())}</span>
                </div>
                
                <div className="flex items-center justify-between mt-1 text-sm">
                  <div className="flex items-center gap-4">
                    <span className="text-gray-600 dark:text-gray-400">
                      Current: {formatDecimal(alloc.currentPercent, 1)}%
                    </span>
                    <span className="text-gray-600 dark:text-gray-400">
                      Target: {formatDecimal(alloc.targetPercent, 1)}%
                    </span>
                  </div>
                  <span className={`font-medium ${
                    Math.abs(alloc.differencePercent) < 2 ? 'text-green-600' :
                    Math.abs(alloc.differencePercent) < 5 ? 'text-yellow-600' :
                    'text-red-600'
                  }`}>
                    {alloc.differencePercent > 0 ? '+' : ''}{formatDecimal(alloc.differencePercent, 1)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Rebalancing Actions */}
      {rebalanceActions.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Rebalancing Actions</h3>
            <button
              onClick={handleExecuteRebalance}
              className="flex items-center gap-2 px-4 py-2 bg-[#1a2332] text-white rounded-lg hover:bg-[#2d3a4d]"
            >
              <CheckCircleIcon size={20} />
              Mark as Rebalanced
            </button>
          </div>
          
          <div className="mb-4 flex items-center gap-4">
            <label className="flex items-center gap-2">
              <input
                type="number"
                step="100"
                value={cashAvailable}
                onChange={(e) => setCashAvailable(parseMoneyInput(e.target.value) ?? 0)}
                className="w-32 px-3 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                placeholder="0"
              />
              <span className="text-sm">Cash Available</span>
            </label>
            
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={taxConsiderations}
                onChange={(e) => setTaxConsiderations(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm">Consider Tax Implications</span>
            </label>
          </div>
          
          {/* Mobile card view */}
          <div className="sm:hidden space-y-3">
            {rebalanceActions.map((action, index) => (
              <div key={index} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-bold ${
                        action.action === 'buy' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {action.action.toUpperCase()}
                      </span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {action.symbol}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{action.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                      {action.assetClass}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded ${
                    action.priority <= 2 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                    action.priority === 3 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                    'bg-gray-100 text-gray-700 dark:bg-gray-600 dark:text-gray-300'
                  }`}>
                    Priority {action.priority}
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500 dark:text-gray-400 block text-xs">Shares</span>
                    <span className="text-gray-900 dark:text-white font-medium">
                      {formatDecimal(action.shares, 2)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400 block text-xs">Amount</span>
                    <span className="text-gray-900 dark:text-white font-medium">
                      {formatCurrency(action.amount.toNumber())}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table view */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full">
              <thead className="bg-secondary dark:bg-gray-700">
                <tr className="border-b border-[#5A729A] dark:border-gray-600">
                  <th className="text-left py-3 px-4 text-white text-sm font-medium">Action</th>
                  <th className="text-left py-3 px-4 text-white text-sm font-medium">Symbol</th>
                  <th className="text-left py-3 px-4 text-white text-sm font-medium">Asset Class</th>
                  <th className="text-right py-3 px-4 text-white text-sm font-medium">Shares</th>
                  <th className="text-right py-3 px-4 text-white text-sm font-medium">Amount</th>
                  <th className="text-center py-3 px-4 text-white text-sm font-medium">Priority</th>
                </tr>
              </thead>
              <tbody>
                {rebalanceActions.map((action, index) => (
                  <tr key={index} className="border-b dark:border-gray-700">
                    <td className="py-3 px-4">
                      <span className={`text-sm font-medium ${
                        action.action === 'buy' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {action.action.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div>
                        <div className="font-medium">{action.symbol}</div>
                        <div className="text-xs text-gray-500">{action.name}</div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm">{action.assetClass}</td>
                    <td className="py-3 px-4 text-right">
                      {formatDecimal(action.shares, 2)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {formatCurrency(action.amount.toNumber())}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`text-xs px-2 py-1 rounded ${
                        action.priority <= 2 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                        action.priority === 3 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                        'bg-gray-100 text-gray-700 dark:bg-gray-600 dark:text-gray-300'
                      }`}>
                        P{action.priority}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="flex items-start gap-2">
              <InfoIcon size={20} className="text-blue-600 mt-0.5" />
              <div className="text-sm text-blue-800 dark:text-blue-300">
                <p className="font-medium mb-1">How to execute:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Review the suggested actions above</li>
                  <li>Place orders through your broker</li>
                  <li>Once complete, click "Mark as Rebalanced"</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Target Management Modal */}
      {showTargetModal && (
        <TargetManagementModal
          targets={portfolioTargets}
          editingTarget={editingTarget}
          prefillTarget={prefillTarget}
          onSave={handleSaveTarget}
          onDelete={handleDeleteTarget}
          onSetActive={handleSetActiveTarget}
          onUseTemplate={handleUseTemplate}
          onClose={() => {
            setShowTargetModal(false);
            setEditingTarget(null);
            setPrefillTarget(null);
          }}
        />
      )}
    </div>
  );
}

