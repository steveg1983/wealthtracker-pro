/**
 * SIMPLE Account Service - Top Tier Implementation
 * 
 * This replaces the over-engineered mess with something that JUST WORKS.
 * No redundant layers, no confusion, just clean code that works.
 * 
 * Now uses centralized userIdService for all ID conversions.
 */

import { supabase } from './supabaseClient';
import { storageAdapter, STORAGE_KEYS } from '../storageAdapter';
import { userIdService } from '../userIdService';
import type { Account } from '../../types';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { logger } from '../loggingService';

/**
 * Transform database snake_case to TypeScript camelCase
 */
function transformAccountFromDb(dbAccount: any): Account {
  return {
    id: dbAccount.id,
    name: dbAccount.name,
    // Convert US terms back to UK terms for the UI
    type: dbAccount.type === 'checking' ? 'current' : dbAccount.type,
    balance: dbAccount.balance,
    currency: dbAccount.currency,
    institution: dbAccount.institution || '',
    isActive: dbAccount.is_active,
    initialBalance: dbAccount.initial_balance,
    openingBalance: dbAccount.initial_balance,
    createdAt: dbAccount.created_at,
    updatedAt: dbAccount.updated_at,
    lastUpdated: dbAccount.updated_at || dbAccount.created_at,
    icon: dbAccount.icon,
    color: dbAccount.color,
  };
}

/**
 * Create an account - SIMPLE and WORKING
 */
export async function createAccount(
  clerkId: string, 
  account: Omit<Account, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Account> {
  console.log('[SimpleAccountService] Creating account for Clerk ID:', clerkId);
  
  // Use centralized userIdService for ID conversion
  let userId = await userIdService.getDatabaseUserId(clerkId);
  
  try {
    // Check if Supabase is configured
    if (!supabase) {
      throw new Error('Supabase not configured - using localStorage');
    }
    
    if (!userId) {
      // User doesn't exist, try to create with minimal info
      // This is a fallback - normally userIdService.ensureUserExists should be called earlier
      userId = await userIdService.ensureUserExists(
        clerkId,
        'user@example.com', // Will be updated by proper initialization
        undefined,
        undefined
      );
      
      if (!userId) {
        throw new Error('Failed to get or create database user');
      }
      
      console.log('[SimpleAccountService] Created user via userIdService:', userId);
    } else {
      console.log('[SimpleAccountService] Using existing user:', userId);
    }
    
    // Now create the account with the proper user_id (UUID)
    const accountData = {
      user_id: userId, // This is now a UUID, not the Clerk ID!
      name: account.name,
      type: account.type === 'current' ? 'checking' : account.type, // Map UK to US terms
      currency: account.currency || 'GBP',
      balance: account.balance || 0,
      initial_balance: account.initialBalance || account.balance || 0,
      is_active: account.isActive !== false,
      institution: account.institution || null,
      icon: account.icon || null,
      color: account.color || null
    };
    
    console.log('[SimpleAccountService] Creating account with data:', accountData);
    
    const { data, error } = await supabase
      .from('accounts')
      .insert(accountData)
      .select()
      .single();
    
    if (error) {
      logger.error('[SimpleAccountService] Failed to create account:', error);
      logger.error('[SimpleAccountService] Error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      throw error;
    }
    
    if (!data) {
      logger.error('[SimpleAccountService] No data returned from account creation');
      throw new Error('Account creation returned no data');
    }
    
    console.log('[SimpleAccountService] Account created successfully:', data);
    
    // Create a transfer category for this account
    try {
      const transferCategoryData = {
        user_id: userId,
        name: `To/From ${data.name}`,
        type: 'both' as const,
        level: 'detail' as const,
        parent_id: null, // Will be set to the Transfer type category ID later
        is_system: false,
        is_transfer_category: true,
        account_id: data.id,
        is_active: true
      };
      
      // First, find the Transfer type category for this user
      const { data: transferTypeCategory } = await supabase
        .from('categories')
        .select('id')
        .eq('user_id', userId)
        .eq('name', 'Transfer')
        .eq('level', 'type')
        .single();
      
      if (transferTypeCategory) {
        transferCategoryData.parent_id = transferTypeCategory.id;
      }
      
      const { data: categoryData, error: categoryError } = await supabase
        .from('categories')
        .insert(transferCategoryData)
        .select()
        .single();
      
      if (categoryError) {
        logger.error('[SimpleAccountService] Failed to create transfer category:', categoryError);
        // Don't fail the account creation if category creation fails
      } else {
        console.log('[SimpleAccountService] Transfer category created:', categoryData);
      }
    } catch (categoryError) {
      logger.error('[SimpleAccountService] Error creating transfer category:', categoryError);
      // Continue anyway - account creation is more important
    }
    
    return transformAccountFromDb(data);
    
  } catch (error) {
    logger.error('[SimpleAccountService] Error creating account, falling back to localStorage:', error);
    
    // Fallback to localStorage if Supabase fails
    const localAccount: Account = {
      ...account,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    const accounts = await storageAdapter.get<Account[]>(STORAGE_KEYS.ACCOUNTS) || [];
    accounts.push(localAccount);
    await storageAdapter.set(STORAGE_KEYS.ACCOUNTS, accounts);
    
    // Also create transfer category in localStorage
    const categories = await storageAdapter.get<any[]>(STORAGE_KEYS.CATEGORIES) || [];
    categories.push({
      id: crypto.randomUUID(),
      name: `To/From ${localAccount.name}`,
      type: 'both',
      level: 'detail',
      parentId: 'type-transfer',
      isSystem: false,
      isTransferCategory: true,
      accountId: localAccount.id,
      isActive: true
    });
    await storageAdapter.set(STORAGE_KEYS.CATEGORIES, categories);
    
    return localAccount;
  }
}

/**
 * Get all accounts for a user - SIMPLE
 */
export async function getAccounts(userIdParam: string): Promise<Account[]> {
  try {
    if (!supabase) {
      throw new Error('Supabase not configured');
    }
    
    // Check if this is a Clerk ID or database UUID
    let userId: string | null = userIdParam;
    if (userIdParam.startsWith('user_')) {
      // This is a Clerk ID, convert it
      userId = await userIdService.getDatabaseUserId(userIdParam);
      if (!userId) {
        console.log('[SimpleAccountService] No user found for Clerk ID:', userIdParam);
        return [];
      }
    }
    
    // Get accounts for the user
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: true });
    
    if (error) {
      logger.error('[SimpleAccountService] Error fetching accounts:', error);
      throw error;
    }
    
    return (data || []).map(transformAccountFromDb);
    
  } catch (error) {
    // Fallback to localStorage
    console.log('[SimpleAccountService] Using localStorage fallback');
    const accounts = await storageAdapter.get<Account[]>(STORAGE_KEYS.ACCOUNTS);
    return accounts || [];
  }
}

/**
 * Update an account - SIMPLE
 */
export async function updateAccount(
  accountId: string,
  updates: Partial<Account>
): Promise<Account> {
  try {
    if (!supabase) {
      throw new Error('Supabase not configured');
    }
    
    const { data, error } = await supabase
      .from('accounts')
      .update(updates)
      .eq('id', accountId)
      .select()
      .single();
    
    if (error) {
      logger.error('[SimpleAccountService] Error updating account:', error);
      throw error;
    }
    
    return transformAccountFromDb(data);
    
  } catch (error) {
    // Fallback to localStorage
    const accounts = await storageAdapter.get<Account[]>(STORAGE_KEYS.ACCOUNTS) || [];
    const index = accounts.findIndex(a => a.id === accountId);
    
    if (index !== -1) {
      accounts[index] = { ...accounts[index], ...updates };
      await storageAdapter.set(STORAGE_KEYS.ACCOUNTS, accounts);
      return accounts[index];
    }
    
    throw new Error('Account not found');
  }
}

/**
 * Delete an account - SIMPLE
 */
export async function deleteAccount(accountId: string): Promise<void> {
  try {
    if (!supabase) {
      throw new Error('Supabase not configured');
    }
    
    // First, soft-delete the associated transfer category
    try {
      const { error: categoryError } = await supabase
        .from('categories')
        .update({ is_active: false })
        .eq('account_id', accountId)
        .eq('is_transfer_category', true);
      
      if (categoryError) {
        logger.error('[SimpleAccountService] Error soft-deleting transfer category:', categoryError);
        // Continue with account deletion even if category update fails
      } else {
        console.log('[SimpleAccountService] Transfer category soft-deleted for account:', accountId);
      }
    } catch (categoryError) {
      logger.error('[SimpleAccountService] Error handling transfer category:', categoryError);
    }
    
    // Now delete the account
    const { error } = await supabase
      .from('accounts')
      .delete()
      .eq('id', accountId);
    
    if (error) {
      logger.error('[SimpleAccountService] Error deleting account:', error);
      throw error;
    }
    
  } catch (error) {
    // Fallback to localStorage
    const accounts = await storageAdapter.get<Account[]>(STORAGE_KEYS.ACCOUNTS) || [];
    const filtered = accounts.filter(a => a.id !== accountId);
    await storageAdapter.set(STORAGE_KEYS.ACCOUNTS, filtered);
    
    // Also soft-delete transfer category in localStorage
    const categories = await storageAdapter.get<any[]>(STORAGE_KEYS.CATEGORIES) || [];
    const updatedCategories = categories.map(cat => {
      if (cat.accountId === accountId && cat.isTransferCategory) {
        return { ...cat, isActive: false };
      }
      return cat;
    });
    await storageAdapter.set(STORAGE_KEYS.CATEGORIES, updatedCategories);
  }
}

/**
 * Subscribe to real-time account changes - SIMPLE
 * @param clerkId - The Clerk user ID
 * @param callback - Callback function when updates are received
 */
export async function subscribeToAccountChanges(
  clerkId: string,
  callback: (payload: any) => void
): Promise<() => void> {
  if (!supabase) {
    return () => {}; // No-op for localStorage
  }

  console.log('[SimpleAccountService] Setting up real-time subscription for Clerk user:', clerkId);

  // Use centralized userIdService for ID conversion
  try {
    const dbUserId = await userIdService.getDatabaseUserId(clerkId);
    
    if (!dbUserId) {
      logger.warn('[SimpleAccountService] No database user found for Clerk ID:', clerkId);
      return () => {};
    }

    console.log('[SimpleAccountService] Database user ID:', dbUserId);

    // Subscribe to account changes for this specific user
    const channel = supabase
      .channel(`accounts-${dbUserId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'accounts',
          filter: `user_id=eq.${dbUserId}` // Use database user ID for filter
        },
        (payload) => {
          console.log('🔔 [SimpleAccountService] Real-time update received!');
          console.log('   Event type:', payload.eventType);
          console.log('   Table:', payload.table);
          console.log('   Schema:', payload.schema);
          console.log('   Old record:', payload.old);
          console.log('   New record:', payload.new);
          console.log('   Commit timestamp:', payload.commit_timestamp);
          console.log('   Full payload:', payload);
          callback(payload);
        }
      )
      .subscribe((status, error) => {
        console.log(`📡 [SimpleAccountService] Subscription status: ${status}`);
        if (error) {
          logger.error('❌ [SimpleAccountService] Subscription error:', error);
        }
        if (status === 'SUBSCRIBED') {
          console.log('✅ [SimpleAccountService] Successfully subscribed!');
          console.log('   Channel:', `accounts-${dbUserId}`);
          console.log('   Filter:', `user_id=eq.${dbUserId}`);
          console.log('   Database user ID:', dbUserId);
          
          // Log all current subscriptions
          const allChannels = supabase.getChannels();
          console.log(`📊 [SimpleAccountService] Total active channels: ${allChannels.length}`);
          allChannels.forEach((ch, idx) => {
            console.log(`   ${idx + 1}. ${ch.topic} - State: ${ch.state}`);
          });
        } else if (status === 'CHANNEL_ERROR') {
          logger.error('❌ [SimpleAccountService] Channel error - check if realtime is enabled in Supabase');
          logger.error('   You may need to enable realtime for the accounts table in Supabase dashboard');
          logger.error('   Go to: Table Editor > accounts > Replication (toggle on)');
        } else if (status === 'TIMED_OUT') {
          logger.error('⏱️ [SimpleAccountService] Subscription timed out');
        } else if (status === 'CLOSED') {
          console.log('🔒 [SimpleAccountService] Channel closed');
        }
      });

    // Return unsubscribe function
    return () => {
      console.log('[SimpleAccountService] Unsubscribing from real-time updates');
      supabase.removeChannel(channel);
    };
  } catch (error) {
    logger.error('[SimpleAccountService] Error setting up subscription:', error);
    return () => {};
  }
}