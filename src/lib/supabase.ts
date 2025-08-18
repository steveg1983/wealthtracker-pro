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

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Missing Supabase environment variables. App will run in local mode only.');
  console.warn('To enable cloud features, add to your .env.local:');
  console.warn('VITE_SUPABASE_URL=your-project-url');
  console.warn('VITE_SUPABASE_ANON_KEY=your-anon-key');
}

// Create Supabase client with enhanced configuration
export const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false, // We use Clerk for auth
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

// Helper to sync Clerk user with Supabase
export async function syncClerkUser(clerkUserId: string, email: string, name?: string) {
  if (!supabase) return false;
  
  try {
    const { data: existingProfile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('clerk_user_id', clerkUserId)
      .single();

    if (!existingProfile) {
      const { error } = await supabase
        .from('user_profiles')
        .insert({
          clerk_user_id: clerkUserId,
          email,
          full_name: name,
          subscription_tier: 'free',  // Set default tier
          subscription_status: 'active',  // Set default status
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (error) {
        console.error('Error creating user profile:', error);
        return false;
      }
    }
    return true;
  } catch (error) {
    console.error('Error syncing Clerk user:', error);
    return false;
  }
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
