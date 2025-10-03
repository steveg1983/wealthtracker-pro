import React, { createContext, useContext, useState, ReactNode } from 'react';

interface AccountContextType {
  // Add properties here
}

const AccountContext = createContext<AccountContextType | undefined>(undefined);

export const useAccount = () => {
  const context = useContext(AccountContext);
  if (!context) {
    throw new Error('useAccount must be used within AccountProvider');
  }
  return context;
};

// Alias for compatibility
export const useAccounts = useAccount;

interface AccountProviderProps {
  children: ReactNode;
  initialAccounts?: any[];
  initialTransactions?: any[];
  initialRecurringTransactions?: any[];
}

export const AccountProvider: React.FC<AccountProviderProps> = ({ children }) => {
  const value: AccountContextType = {
    // Add implementation here
  };

  return (
    <AccountContext.Provider value={value}>
      {children}
    </AccountContext.Provider>
  );
};