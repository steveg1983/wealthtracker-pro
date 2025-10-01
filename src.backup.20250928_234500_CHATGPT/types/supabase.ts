export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          clerk_id: string
          email: string
          first_name: string | null
          last_name: string | null
          avatar_url: string | null
          subscription_tier: 'free' | 'pro' | 'business'
          subscription_status: 'active' | 'past_due' | 'canceled' | 'trialing'
          stripe_customer_id: string | null
          created_at: string
          updated_at: string
          last_sync_at: string | null
          settings: Json
          preferences: Json
        }
        Insert: {
          id?: string
          clerk_id: string
          email: string
          first_name?: string | null
          last_name?: string | null
          avatar_url?: string | null
          subscription_tier?: 'free' | 'pro' | 'business'
          subscription_status?: 'active' | 'past_due' | 'canceled' | 'trialing'
          stripe_customer_id?: string | null
          created_at?: string
          updated_at?: string
          last_sync_at?: string | null
          settings?: Json
          preferences?: Json
        }
        Update: {
          id?: string
          clerk_id?: string
          email?: string
          first_name?: string | null
          last_name?: string | null
          avatar_url?: string | null
          subscription_tier?: 'free' | 'pro' | 'business'
          subscription_status?: 'active' | 'past_due' | 'canceled' | 'trialing'
          stripe_customer_id?: string | null
          created_at?: string
          updated_at?: string
          last_sync_at?: string | null
          settings?: Json
          preferences?: Json
        }
      }
      accounts: {
        Row: {
          id: string
          user_id: string
          name: string
          type: 'checking' | 'savings' | 'credit' | 'cash' | 'investment' | 'other'
          currency: string
          balance: number
          initial_balance: number
          icon: string | null
          color: string | null
          is_active: boolean
          institution: string | null
          account_number: string | null
          sort_code: string | null
          created_at: string
          updated_at: string
          metadata: Json
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          type: 'checking' | 'savings' | 'credit' | 'cash' | 'investment' | 'other'
          currency?: string
          balance?: number
          initial_balance?: number
          icon?: string | null
          color?: string | null
          is_active?: boolean
          institution?: string | null
          account_number?: string | null
          sort_code?: string | null
          created_at?: string
          updated_at?: string
          metadata?: Json
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          type?: 'checking' | 'savings' | 'credit' | 'cash' | 'investment' | 'other'
          currency?: string
          balance?: number
          initial_balance?: number
          icon?: string | null
          color?: string | null
          is_active?: boolean
          institution?: string | null
          account_number?: string | null
          sort_code?: string | null
          created_at?: string
          updated_at?: string
          metadata?: Json
        }
      }
      categories: {
        Row: {
          id: string
          user_id: string
          parent_id: string | null
          name: string
          level: 'type' | 'sub' | 'detail'
          type: 'income' | 'expense' | 'transfer' | null
          icon: string | null
          color: string | null
          is_system: boolean
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          parent_id?: string | null
          name: string
          level: 'type' | 'sub' | 'detail'
          type?: 'income' | 'expense' | 'transfer' | null
          icon?: string | null
          color?: string | null
          is_system?: boolean
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          parent_id?: string | null
          name?: string
          level?: 'type' | 'sub' | 'detail'
          type?: 'income' | 'expense' | 'transfer' | null
          icon?: string | null
          color?: string | null
          is_system?: boolean
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      transactions: {
        Row: {
          id: string
          user_id: string
          account_id: string
          category_id: string | null
          description: string
          amount: number
          type: 'income' | 'expense' | 'transfer'
          date: string
          notes: string | null
          tags: string[] | null
          is_recurring: boolean
          recurring_template_id: string | null
          transfer_account_id: string | null
          created_at: string
          updated_at: string
          metadata: Json
        }
        Insert: {
          id?: string
          user_id: string
          account_id: string
          category_id?: string | null
          description: string
          amount: number
          type: 'income' | 'expense' | 'transfer'
          date: string
          notes?: string | null
          tags?: string[] | null
          is_recurring?: boolean
          recurring_template_id?: string | null
          transfer_account_id?: string | null
          created_at?: string
          updated_at?: string
          metadata?: Json
        }
        Update: {
          id?: string
          user_id?: string
          account_id?: string
          category_id?: string | null
          description?: string
          amount?: number
          type?: 'income' | 'expense' | 'transfer'
          date?: string
          notes?: string | null
          tags?: string[] | null
          is_recurring?: boolean
          recurring_template_id?: string | null
          transfer_account_id?: string | null
          created_at?: string
          updated_at?: string
          metadata?: Json
        }
      }
      budgets: {
        Row: {
          id: string
          user_id: string
          category_id: string | null
          name: string
          amount: number
          period: 'monthly' | 'weekly' | 'yearly' | 'custom'
          start_date: string
          end_date: string | null
          rollover_enabled: boolean
          rollover_amount: number
          alert_enabled: boolean
          alert_threshold: number
          is_active: boolean
          created_at: string
          updated_at: string
          metadata: Json
        }
        Insert: {
          id?: string
          user_id: string
          category_id?: string | null
          name: string
          amount: number
          period: 'monthly' | 'weekly' | 'yearly' | 'custom'
          start_date: string
          end_date?: string | null
          rollover_enabled?: boolean
          rollover_amount?: number
          alert_enabled?: boolean
          alert_threshold?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
          metadata?: Json
        }
        Update: {
          id?: string
          user_id?: string
          category_id?: string | null
          name?: string
          amount?: number
          period?: 'monthly' | 'weekly' | 'yearly' | 'custom'
          start_date?: string
          end_date?: string | null
          rollover_enabled?: boolean
          rollover_amount?: number
          alert_enabled?: boolean
          alert_threshold?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
          metadata?: Json
        }
      }
      goals: {
        Row: {
          id: string
          user_id: string
          name: string
          description: string | null
          target_amount: number
          current_amount: number
          target_date: string | null
          category: string | null
          priority: 'low' | 'medium' | 'high' | null
          status: 'active' | 'completed' | 'paused' | 'canceled'
          auto_contribute: boolean
          contribution_amount: number | null
          contribution_frequency: 'daily' | 'weekly' | 'monthly' | 'yearly' | null
          created_at: string
          updated_at: string
          completed_at: string | null
          metadata: Json
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          description?: string | null
          target_amount: number
          current_amount?: number
          target_date?: string | null
          category?: string | null
          priority?: 'low' | 'medium' | 'high' | null
          status?: 'active' | 'completed' | 'paused' | 'canceled'
          auto_contribute?: boolean
          contribution_amount?: number | null
          contribution_frequency?: 'daily' | 'weekly' | 'monthly' | 'yearly' | null
          created_at?: string
          updated_at?: string
          completed_at?: string | null
          metadata?: Json
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          description?: string | null
          target_amount?: number
          current_amount?: number
          target_date?: string | null
          category?: string | null
          priority?: 'low' | 'medium' | 'high' | null
          status?: 'active' | 'completed' | 'paused' | 'canceled'
          auto_contribute?: boolean
          contribution_amount?: number | null
          contribution_frequency?: 'daily' | 'weekly' | 'monthly' | 'yearly' | null
          created_at?: string
          updated_at?: string
          completed_at?: string | null
          metadata?: Json
        }
      }
      recurring_templates: {
        Row: {
          id: string
          user_id: string
          account_id: string
          category_id: string | null
          description: string
          amount: number
          type: 'income' | 'expense' | 'transfer'
          frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly'
          day_of_month: number | null
          day_of_week: number | null
          next_date: string
          end_date: string | null
          is_active: boolean
          created_at: string
          updated_at: string
          metadata: Json
        }
        Insert: {
          id?: string
          user_id: string
          account_id: string
          category_id?: string | null
          description: string
          amount: number
          type: 'income' | 'expense' | 'transfer'
          frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly'
          day_of_month?: number | null
          day_of_week?: number | null
          next_date: string
          end_date?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
          metadata?: Json
        }
        Update: {
          id?: string
          user_id?: string
          account_id?: string
          category_id?: string | null
          description?: string
          amount?: number
          type?: 'income' | 'expense' | 'transfer'
          frequency?: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly'
          day_of_month?: number | null
          day_of_week?: number | null
          next_date?: string
          end_date?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
          metadata?: Json
        }
      }
      tags: {
        Row: {
          id: string
          user_id: string
          name: string
          color: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          color?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          color?: string | null
          created_at?: string
        }
      }
      sync_queue: {
        Row: {
          id: string
          user_id: string
          entity_type: string
          entity_id: string | null
          operation: 'create' | 'update' | 'delete'
          data: Json
          device_id: string | null
          sync_status: 'pending' | 'processing' | 'completed' | 'failed'
          retry_count: number
          error_message: string | null
          created_at: string
          processed_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          entity_type: string
          entity_id?: string | null
          operation: 'create' | 'update' | 'delete'
          data: Json
          device_id?: string | null
          sync_status?: 'pending' | 'processing' | 'completed' | 'failed'
          retry_count?: number
          error_message?: string | null
          created_at?: string
          processed_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          entity_type?: string
          entity_id?: string | null
          operation?: 'create' | 'update' | 'delete'
          data?: Json
          device_id?: string | null
          sync_status?: 'pending' | 'processing' | 'completed' | 'failed'
          retry_count?: number
          error_message?: string | null
          created_at?: string
          processed_at?: string | null
        }
      }
      audit_log: {
        Row: {
          id: string
          user_id: string
          entity_type: string
          entity_id: string | null
          action: string
          changes: Json | null
          ip_address: string | null
          user_agent: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          entity_type: string
          entity_id?: string | null
          action: string
          changes?: Json | null
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          entity_type?: string
          entity_id?: string | null
          action?: string
          changes?: Json | null
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_default_categories: {
        Args: {
          p_user_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
  }
}