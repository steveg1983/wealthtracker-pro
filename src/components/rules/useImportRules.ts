import { useState, useEffect, useCallback } from 'react';
import { importRulesService } from '../../services/importRulesService';
import type { ImportRule } from '../../types/importRules';
import type { Transaction } from '../../types';

export function useImportRules(transactions: Transaction[]) {
  const [rules, setRules] = useState<ImportRule[]>([]);
  const [editingRule, setEditingRule] = useState<ImportRule | null>(null);
  const [showAddRule, setShowAddRule] = useState(false);
  const [testResults, setTestResults] = useState<Map<string, boolean>>(new Map());
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<Partial<ImportRule>[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Load rules on mount
  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = useCallback(() => {
    setIsLoading(true);
    try {
      const loadedRules = importRulesService.getRules();
      setRules(loadedRules);
    } catch (error) {
      console.error('Failed to load import rules:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleSaveRule = useCallback((rule: Partial<ImportRule>) => {
    try {
      if (editingRule) {
        importRulesService.updateRule(editingRule.id, rule);
      } else {
        importRulesService.addRule(rule as Omit<ImportRule, 'id' | 'createdAt' | 'updatedAt'>);
      }
      loadRules();
      setEditingRule(null);
      setShowAddRule(false);
    } catch (error) {
      console.error('Failed to save rule:', error);
    }
  }, [editingRule, loadRules]);

  const handleDeleteRule = useCallback((id: string) => {
    if (confirm('Are you sure you want to delete this rule?')) {
      try {
        importRulesService.deleteRule(id);
        loadRules();
        // Clear test results for deleted rule
        setTestResults(prev => {
          const newMap = new Map(prev);
          newMap.delete(id);
          return newMap;
        });
      } catch (error) {
        console.error('Failed to delete rule:', error);
      }
    }
  }, [loadRules]);

  const handleToggleRule = useCallback((id: string, enabled: boolean) => {
    try {
      importRulesService.updateRule(id, { enabled });
      loadRules();
    } catch (error) {
      console.error('Failed to toggle rule:', error);
    }
  }, [loadRules]);

  const handleChangePriority = useCallback((id: string, direction: 'up' | 'down') => {
    const index = rules.findIndex(r => r.id === id);
    if (index === -1) return;

    const currentRule = rules[index];
    const newPriority = direction === 'up' 
      ? Math.max(1, currentRule.priority - 1)
      : currentRule.priority + 1;

    // Swap priorities with adjacent rule
    const swapRule = rules.find(r => r.priority === newPriority);
    if (swapRule) {
      importRulesService.updateRule(swapRule.id, { priority: currentRule.priority });
    }
    
    importRulesService.updateRule(id, { priority: newPriority });
    loadRules();
  }, [rules, loadRules]);

  const testRule = useCallback((rule: ImportRule) => {
    // Test against recent transactions (limit to 50 for performance)
    const recentTransactions = transactions.slice(0, 50);
    let matches = 0;
    
    recentTransactions.forEach(t => {
      if (importRulesService.testRule(rule, {
        description: t.description,
        amount: t.amount,
        accountId: t.accountId,
        date: t.date
      })) {
        matches++;
      }
    });

    setTestResults(prev => new Map(prev).set(rule.id, matches > 0));
  }, [transactions]);

  const generateSuggestions = useCallback(() => {
    try {
      const suggested = importRulesService.suggestRules(transactions);
      setSuggestions(suggested);
      setShowSuggestions(true);
    } catch (error) {
      console.error('Failed to generate suggestions:', error);
      setSuggestions([]);
    }
  }, [transactions]);

  const applySuggestion = useCallback((suggestion: Partial<ImportRule>) => {
    try {
      importRulesService.addRule(suggestion as Omit<ImportRule, 'id' | 'createdAt' | 'updatedAt'>);
      loadRules();
      setShowSuggestions(false);
      // Clear suggestions after applying one
      setSuggestions([]);
    } catch (error) {
      console.error('Failed to apply suggestion:', error);
    }
  }, [loadRules]);

  const openAddRule = useCallback(() => {
    setEditingRule(null);
    setShowAddRule(true);
  }, []);

  const openEditRule = useCallback((rule: ImportRule) => {
    setEditingRule(rule);
    setShowAddRule(false);
  }, []);

  const closeRuleForm = useCallback(() => {
    setEditingRule(null);
    setShowAddRule(false);
  }, []);

  const closeSuggestions = useCallback(() => {
    setShowSuggestions(false);
  }, []);

  // Apply rules to a set of transactions
  const applyRulessToTransactions = useCallback((transactionsToProcess: any[]) => {
    const enabledRules = rules.filter(r => r.enabled).sort((a, b) => a.priority - b.priority);
    const processedTransactions = [...transactionsToProcess];
    
    processedTransactions.forEach(transaction => {
      // Apply all rules to the transaction (applyRules handles all enabled rules internally)
      const result = importRulesService.applyRules(transaction);
      if (result) {
        // Apply transformations from the rule result
        Object.assign(transaction, result);
      }
    });
    
    return processedTransactions;
  }, [rules]);

  return {
    // State
    rules,
    editingRule,
    showAddRule,
    testResults,
    showSuggestions,
    suggestions,
    isLoading,
    
    // Actions
    handleSaveRule,
    handleDeleteRule,
    handleToggleRule,
    handleChangePriority,
    testRule,
    generateSuggestions,
    applySuggestion,
    openAddRule,
    openEditRule,
    closeRuleForm,
    closeSuggestions,
    applyRulessToTransactions,
    
    // Utility
    loadRules
  };
}