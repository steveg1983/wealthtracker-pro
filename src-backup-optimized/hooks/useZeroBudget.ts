import { useState, useEffect, useCallback, useMemo } from 'react';
import type { ZeroBudgetItem, ZeroBudgetPeriod, SavedZeroBudgetPeriod } from '../components/zero-budget/types';

export function useZeroBudget() {
  const [periods, setPeriods] = useState<ZeroBudgetPeriod[]>([]);
  const [activePeriod, setActivePeriod] = useState<ZeroBudgetPeriod | null>(null);

  // Load periods from localStorage
  useEffect(() => {
    loadPeriods();
  }, []);

  const loadPeriods = () => {
    const stored = localStorage.getItem('wealthtracker_zbb_periods');
    if (stored) {
      const parsed = JSON.parse(stored);
      const periods = parsed.map((p: SavedZeroBudgetPeriod) => ({
        ...p,
        startDate: new Date(p.startDate),
        endDate: new Date(p.endDate),
        createdAt: new Date(p.createdAt),
        items: p.items.map((item) => ({
          ...item,
          frequency: item.frequency as ZeroBudgetItem['frequency'],
          priority: item.priority as ZeroBudgetItem['priority'],
          startDate: item.startDate ? new Date(item.startDate) : undefined,
          endDate: item.endDate ? new Date(item.endDate) : undefined
        }))
      }));
      setPeriods(periods);
      
      // Set active period
      const active = periods.find((p: ZeroBudgetPeriod) => p.status === 'active');
      setActivePeriod(active || null);
    }
  };

  const savePeriods = useCallback((newPeriods: ZeroBudgetPeriod[]) => {
    localStorage.setItem('wealthtracker_zbb_periods', JSON.stringify(newPeriods));
    setPeriods(newPeriods);
  }, []);

  const createNewPeriod = useCallback((data: Partial<ZeroBudgetPeriod>, copyFromActive: boolean = false) => {
    const newPeriod: ZeroBudgetPeriod = {
      id: `period-${Date.now()}`,
      name: data.name || 'New Budget Period',
      startDate: data.startDate || new Date(),
      endDate: data.endDate || new Date(new Date().setMonth(new Date().getMonth() + 1)),
      totalIncome: data.totalIncome || 0,
      items: [],
      status: 'draft',
      createdAt: new Date()
    };

    // Copy items from previous period if requested
    if (copyFromActive && activePeriod) {
      newPeriod.items = activePeriod.items.map(item => ({
        ...item,
        id: `item-${Date.now()}-${Math.random()}`,
        isApproved: false
      }));
    }

    const updatedPeriods = [...periods, newPeriod];
    savePeriods(updatedPeriods);
    setActivePeriod(newPeriod);
    return newPeriod;
  }, [periods, activePeriod, savePeriods]);

  const updatePeriod = useCallback((periodId: string, updates: Partial<ZeroBudgetPeriod>) => {
    const updatedPeriods = periods.map(p => 
      p.id === periodId ? { ...p, ...updates } : p
    );
    savePeriods(updatedPeriods);
    
    if (activePeriod?.id === periodId) {
      setActivePeriod({ ...activePeriod, ...updates });
    }
  }, [periods, activePeriod, savePeriods]);

  const activatePeriod = useCallback((periodId: string) => {
    const updatedPeriods = periods.map(p => ({
      ...p,
      status: p.id === periodId ? 'active' : p.status === 'active' ? 'completed' : p.status
    })) as ZeroBudgetPeriod[];
    
    savePeriods(updatedPeriods);
    const newActive = updatedPeriods.find(p => p.id === periodId);
    setActivePeriod(newActive || null);
  }, [periods, savePeriods]);

  const addOrUpdateItem = useCallback((item: ZeroBudgetItem, editingItemId?: string) => {
    if (!activePeriod) return;

    let updatedItems: ZeroBudgetItem[];
    
    if (editingItemId) {
      updatedItems = activePeriod.items.map(i => 
        i.id === editingItemId ? item : i
      );
    } else {
      updatedItems = [...activePeriod.items, {
        ...item,
        id: `item-${Date.now()}`
      }];
    }

    updatePeriod(activePeriod.id, { items: updatedItems });
  }, [activePeriod, updatePeriod]);

  const deleteItem = useCallback((itemId: string) => {
    if (!activePeriod) return;
    
    const updatedItems = activePeriod.items.filter(i => i.id !== itemId);
    updatePeriod(activePeriod.id, { items: updatedItems });
  }, [activePeriod, updatePeriod]);

  const toggleItemApproval = useCallback((itemId: string) => {
    if (!activePeriod) return;
    
    const updatedItems = activePeriod.items.map(i => 
      i.id === itemId ? { ...i, isApproved: !i.isApproved } : i
    );
    updatePeriod(activePeriod.id, { items: updatedItems });
  }, [activePeriod, updatePeriod]);

  // Calculate totals
  const calculateTotals = useMemo(() => {
    if (!activePeriod) return { allocated: 0, approved: 0, remaining: 0 };

    const allocated = activePeriod.items.reduce((sum, item) => {
      let amount = item.amount;
      
      // Adjust for frequency
      switch (item.frequency) {
        case 'weekly':
          amount = amount * 4.33; // Average weeks per month
          break;
        case 'quarterly':
          amount = amount / 3;
          break;
        case 'annual':
          amount = amount / 12;
          break;
      }
      
      return sum + amount;
    }, 0);

    const approved = activePeriod.items
      .filter(i => i.isApproved)
      .reduce((sum, item) => {
        let amount = item.amount;
        switch (item.frequency) {
          case 'weekly':
            amount = amount * 4.33;
            break;
          case 'quarterly':
            amount = amount / 3;
            break;
          case 'annual':
            amount = amount / 12;
            break;
        }
        return sum + amount;
      }, 0);

    const remaining = activePeriod.totalIncome - allocated;

    return { allocated, approved, remaining };
  }, [activePeriod]);

  return {
    periods,
    activePeriod,
    setActivePeriod,
    createNewPeriod,
    updatePeriod,
    activatePeriod,
    addOrUpdateItem,
    deleteItem,
    toggleItemApproval,
    totals: calculateTotals
  };
}