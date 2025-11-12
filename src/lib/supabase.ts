/**
 * Supabase Client Configuration
 * 
 * This sets up our connection to Supabase for:
 * - Database operations
 * - Real-time subscriptions
 * - File storage
 * - Row Level Security with Clerk authentication
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

const fallbackLogger = typeof console !== 'undefined' ? console : undefined
const logMissingEnv = () => {
  fallbackLogger?.warn?.('Missing Supabase environment variables. App will run in local mode only.')
  fallbackLogger?.warn?.('To enable cloud features, add to your .env.local:')
  fallbackLogger?.warn?.('VITE_SUPABASE_URL=your-project-url')
  fallbackLogger?.warn?.('VITE_SUPABASE_ANON_KEY=your-anon-key')
}

if (!supabaseUrl || !supabaseAnonKey) {
  logMissingEnv()
}

export const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
      global: {
        headers: {
          'x-client-info': 'wealthtracker-web',
        },
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    })
  : null

export async function syncClerkUser(clerkUserId: string, email: string, name?: string) {
  fallbackLogger?.warn?.('syncClerkUser is deprecated. Use userIdService.ensureUserExists() instead');
  const { userIdService } = await import('../services/userIdService');
  const databaseId = await userIdService.ensureUserExists(
    clerkUserId,
    email,
    name?.split(' ')[0],
    name?.split(' ')[1]
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
