import { useCallback } from 'react';
import type { Account } from '../../types';
import type { DecimalAccount } from '../../types/decimal-types';
import { toDecimalAccount, fromDecimalAccount } from '../../utils/decimal-converters';
import { smartCategorizationService } from '../../services/smartCategorizationService';

/**
 * Custom hook for account management operations
 * Handles CRUD operations for accounts with Decimal precision
 */
export function useAccountManagement(
  decimalAccounts: DecimalAccount[],
  setDecimalAccounts: React.Dispatch<React.SetStateAction<DecimalAccount[]>>
) {
  const accounts = decimalAccounts.map(fromDecimalAccount);

  const addAccount = useCallback((account: Omit<Account, 'id' | 'lastUpdated'>) => {
    const decimalAccount = toDecimalAccount({
      ...account,
      id: crypto.randomUUID(),
      lastUpdated: new Date()
    });
    
    setDecimalAccounts(prev => [...prev, decimalAccount]);
    
    // Learn from new account for categorization
    // Note: Learning happens when transactions are added
  }, [setDecimalAccounts]);

  const updateAccount = useCallback((id: string, updates: Partial<Account>) => {
    setDecimalAccounts(prev => prev.map(account => 
      account.id === id 
        ? { 
            ...account, 
            ...toDecimalAccount({ 
              ...fromDecimalAccount(account), 
              ...updates, 
              lastUpdated: new Date() 
            }) 
          }
        : account
    ));
  }, [setDecimalAccounts]);

  const deleteAccount = useCallback((id: string) => {
    setDecimalAccounts(prev => prev.filter(account => account.id !== id));
  }, [setDecimalAccounts]);

  return {
    accounts,
    addAccount,
    updateAccount,
    deleteAccount
  };
}