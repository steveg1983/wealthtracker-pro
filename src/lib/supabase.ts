import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables. App will run in local mode only.');
  console.error('VITE_SUPABASE_URL:', supabaseUrl ? 'Set' : 'Missing');
  console.error('VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? 'Set' : 'Missing');
}

export const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

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
