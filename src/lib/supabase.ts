import { lazyLogger as logger } from '../services/serviceFactory';
/**
 * Supabase client re-export
 * Use the single client from services/api/supabaseClient to avoid duplication.
 */
export { supabase } from '../services/api/supabaseClient';

// DEPRECATED: Use userIdService.ensureUserExists() instead
// This function is kept for backward compatibility but should not be used
// It uses the wrong table (user_profiles instead of users)
export async function syncClerkUser(clerkUserId: string, email: string, name?: string) {
  logger.warn('syncClerkUser is deprecated. Use userIdService.ensureUserExists() instead');
  
  // Import userIdService and delegate to it
  const { userIdService } = await import('../services/userIdService');
  const databaseId = await userIdService.ensureUserExists(
    clerkUserId,
    email,
    name?.split(' ')[0], // firstName
    name?.split(' ')[1]  // lastName
  );
  
  return databaseId !== null;
}

// Database types
export interface DbAccount {
  id: string
  user_id: string
  name: string
  type: 'current' | 'savings' | 'credit' | 'loan' | 'investment'
  balance: number
  currency: string
  institution?: string
  last_updated: string
  created_at: string
}

export interface DbTransaction {
  id: string
  user_id: string
  account_id: string
  date: string
  description: string
  amount: number
  type: 'income' | 'expense'
  category: string
  tags?: string[]
  notes?: string
  cleared?: boolean
  reconciled_with?: string
  created_at: string
}

export interface DbBudget {
  id: string
  user_id: string
  category: string
  amount: number
  period: 'monthly' | 'yearly'
  is_active: boolean
  created_at: string
}
