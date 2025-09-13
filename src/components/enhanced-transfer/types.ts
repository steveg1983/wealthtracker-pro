import type { Transaction, Account } from '../../types';

export interface EnhancedTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction?: Transaction;
  sourceAccountId?: string;
}

export interface TransferFormData {
  sourceAccountId: string;
  targetAccountId: string;
  amount: string;
  description: string;
  date: string;
  
  // Enhanced fields for wealth management
  transferType: 'internal' | 'wire' | 'ach' | 'crypto' | 'asset_sale' | 'dividend' | 'rebalance';
  transferPurpose: string;
  
  // Fees and conversion
  fees: string;
  exchangeRate: string;
  originalCurrency: string;
  
  // Asset details
  assetType?: 'cash' | 'stock' | 'bond' | 'crypto' | 'real_estate' | 'commodity' | 'other';
  units?: string;
  pricePerUnit?: string;
  
  // Settlement
  settlementDate: string;
  reference: string;
  
  // Notes
  notes: string;
  taxImplications: string;
}

export type TransferErrors = Partial<TransferFormData>;