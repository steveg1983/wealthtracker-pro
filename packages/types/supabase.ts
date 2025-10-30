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
          full_name: string | null
          image_url: string | null
          subscription_tier: 'free' | 'pro' | 'business'
          subscription_status: 'active' | 'past_due' | 'canceled' | 'trialing'
          stripe_customer_id: string | null
          created_at: string
          updated_at: string
          last_sync_at: string | null
          settings: Json
          preferences: Json
          last_sign_in_at: string | null
          email_verified: boolean | null
          has_mfa: boolean | null
        }
        Insert: {
          id?: string
          clerk_id: string
          email: string
          first_name?: string | null
          last_name?: string | null
          avatar_url?: string | null
          full_name?: string | null
          image_url?: string | null
          subscription_tier?: 'free' | 'pro' | 'business'
          subscription_status?: 'active' | 'past_due' | 'canceled' | 'trialing'
          stripe_customer_id?: string | null
          created_at?: string
          updated_at?: string
          last_sync_at?: string | null
          settings?: Json
          preferences?: Json
          last_sign_in_at?: string | null
          email_verified?: boolean | null
          has_mfa?: boolean | null
        }
        Update: {
          id?: string
          clerk_id?: string
          email?: string
          first_name?: string | null
          last_name?: string | null
          avatar_url?: string | null
          full_name?: string | null
          image_url?: string | null
          subscription_tier?: 'free' | 'pro' | 'business'
          subscription_status?: 'active' | 'past_due' | 'canceled' | 'trialing'
          stripe_customer_id?: string | null
          created_at?: string
          updated_at?: string
          last_sync_at?: string | null
          settings?: Json
          preferences?: Json
          last_sign_in_at?: string | null
          email_verified?: boolean | null
          has_mfa?: boolean | null
        }
        Relationships: []
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
        Relationships: []
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
        Relationships: []
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
        Relationships: []
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
        Relationships: []
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
        Relationships: []
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
        Relationships: []
      }
      plaid_connections: {
        Row: {
          id: string
          user_id: string
          institution_id: string
          institution_name: string
          item_id: string
          status: 'active' | 'error' | 'updating'
          access_token: string
          last_sync: string | null
          error_message: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          institution_id: string
          institution_name: string
          item_id: string
          status?: 'active' | 'error' | 'updating'
          access_token: string
          last_sync?: string | null
          error_message?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          institution_id?: string
          institution_name?: string
          item_id?: string
          status?: 'active' | 'error' | 'updating'
          access_token?: string
          last_sync?: string | null
          error_message?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      plaid_accounts: {
        Row: {
          id: string
          connection_id: string
          account_id: string
          name: string
          official_name: string | null
          type: string
          subtype: string | null
          mask: string | null
          balance_current: number
          balance_available: number | null
          currency: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          connection_id: string
          account_id: string
          name: string
          official_name?: string | null
          type?: string
          subtype?: string | null
          mask?: string | null
          balance_current: number
          balance_available?: number | null
          currency: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          connection_id?: string
          account_id?: string
          name?: string
          official_name?: string | null
          type?: string
          subtype?: string | null
          mask?: string | null
          balance_current?: number
          balance_available?: number | null
          currency?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
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
        Relationships: []
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
        Relationships: []
      },
      dashboard_layouts: {
        Row: {
          id: string
          user_id: string
          name: string
          widgets: Json
          is_default: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          widgets?: Json
          is_default?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          widgets?: Json
          is_default?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      },
      user_profiles: {
        Row: {
          id: string
          clerk_user_id: string
          user_id: string | null
          email: string
          full_name: string | null
          subscription_tier: 'free' | 'pro' | 'business'
          subscription_status: 'active' | 'past_due' | 'canceled' | 'trialing'
          feature_flags: Json | null
          usage_limits: Json | null
          preferences: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          clerk_user_id: string
          user_id?: string | null
          email: string
          full_name?: string | null
          subscription_tier?: 'free' | 'pro' | 'business'
          subscription_status?: 'active' | 'past_due' | 'canceled' | 'trialing'
          feature_flags?: Json | null
          usage_limits?: Json | null
          preferences?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          clerk_user_id?: string
          user_id?: string | null
          email?: string
          full_name?: string | null
          subscription_tier?: 'free' | 'pro' | 'business'
          subscription_status?: 'active' | 'past_due' | 'canceled' | 'trialing'
          feature_flags?: Json | null
          usage_limits?: Json | null
          preferences?: Json | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      },
      user_id_mappings: {
        Row: {
          id: string
          clerk_id: string
          database_user_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          clerk_id: string
          database_user_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          clerk_id?: string
          database_user_id?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      },
      subscriptions: {
        Row: {
          id: string
          user_id: string
          tier: 'free' | 'premium' | 'pro' | 'business'
          status:
            | 'active'
            | 'cancelled'
            | 'incomplete'
            | 'incomplete_expired'
            | 'past_due'
            | 'trialing'
            | 'unpaid'
            | 'paused'
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          stripe_price_id: string | null
          cancel_at_period_end: boolean
          current_period_start: string | null
          current_period_end: string | null
          trial_start: string | null
          trial_end: string | null
          cancelled_at: string | null
          created_at: string
          updated_at: string
          metadata: Json | null
        }
        Insert: {
          id?: string
          user_id: string
          tier?: 'free' | 'premium' | 'pro' | 'business'
          status?:
            | 'active'
            | 'cancelled'
            | 'incomplete'
            | 'incomplete_expired'
            | 'past_due'
            | 'trialing'
            | 'unpaid'
            | 'paused'
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          stripe_price_id?: string | null
          cancel_at_period_end?: boolean
          current_period_start?: string | null
          current_period_end?: string | null
          trial_start?: string | null
          trial_end?: string | null
          cancelled_at?: string | null
          created_at?: string
          updated_at?: string
          metadata?: Json | null
        }
        Update: {
          id?: string
          user_id?: string
          tier?: 'free' | 'premium' | 'pro' | 'business'
          status?:
            | 'active'
            | 'cancelled'
            | 'incomplete'
            | 'incomplete_expired'
            | 'past_due'
            | 'trialing'
            | 'unpaid'
            | 'paused'
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          stripe_price_id?: string | null
          cancel_at_period_end?: boolean
          current_period_start?: string | null
          current_period_end?: string | null
          trial_start?: string | null
          trial_end?: string | null
          cancelled_at?: string | null
          created_at?: string
          updated_at?: string
          metadata?: Json | null
        }
        Relationships: []
      },
      subscription_usage: {
        Row: {
          id: string
          user_id: string
          accounts_count: number
          transactions_count: number
          budgets_count: number
          goals_count: number
          last_calculated: string
        }
        Insert: {
          id?: string
          user_id: string
          accounts_count?: number
          transactions_count?: number
          budgets_count?: number
          goals_count?: number
          last_calculated?: string
        }
        Update: {
          id?: string
          user_id?: string
          accounts_count?: number
          transactions_count?: number
          budgets_count?: number
          goals_count?: number
          last_calculated?: string
        }
        Relationships: []
      },
      subscription_events: {
        Row: {
          id: string
          user_id: string
          event_type: string
          payload: Json
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          event_type: string
          payload: Json
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          event_type?: string
          payload?: Json
          created_at?: string
        }
        Relationships: []
      },
      payment_methods: {
        Row: {
          id: string
          user_id: string
          stripe_payment_method_id: string
          brand: string
          last4: string
          expiry_month: number
          expiry_year: number
          is_default: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          stripe_payment_method_id: string
          brand: string
          last4: string
          expiry_month: number
          expiry_year: number
          is_default?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          stripe_payment_method_id?: string
          brand?: string
          last4?: string
          expiry_month?: number
          expiry_year?: number
          is_default?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      },
      notifications: {
        Row: {
          id: string
          user_id: string
          type: string
          title: string
          message: string | null
          is_read: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type: string
          title: string
          message?: string | null
          is_read?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          type?: string
          title?: string
          message?: string | null
          is_read?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      },
      invoices: {
        Row: {
          id: string
          user_id: string
          stripe_invoice_id: string
          amount: number
          currency: string
          status: string
          paid_at: string | null
          due_date: string | null
          invoice_url: string | null
          invoice_pdf: string | null
          description: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          stripe_invoice_id: string
          amount: number
          currency: string
          status: string
          paid_at?: string | null
          due_date?: string | null
          invoice_url?: string | null
          invoice_pdf?: string | null
          description?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          stripe_invoice_id?: string
          amount?: number
          currency?: string
          status?: string
          paid_at?: string | null
          due_date?: string | null
          invoice_url?: string | null
          invoice_pdf?: string | null
          description?: string | null
          created_at?: string
        }
        Relationships: []
      },
      investments: {
        Row: {
          id: string
          user_id: string
          account_id: string | null
          symbol: string
          name: string
          asset_type: string
          quantity: number
          cost_basis: number
          market_value: number
          currency: string
          current_price: number | null
          purchase_price: number | null
          purchase_date: string | null
          exchange: string | null
          notes: string | null
          last_updated: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          account_id?: string | null
          symbol: string
          name: string
          asset_type?: string
          quantity?: number
          cost_basis?: number
          market_value?: number
          currency: string
          current_price?: number | null
          purchase_price?: number | null
          purchase_date?: string | null
          exchange?: string | null
          notes?: string | null
          last_updated?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          account_id?: string | null
          symbol?: string
          name?: string
          asset_type?: string
          quantity?: number
          cost_basis?: number
          market_value?: number
          currency?: string
          current_price?: number | null
          purchase_price?: number | null
          purchase_date?: string | null
          exchange?: string | null
          notes?: string | null
          last_updated?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      },
      investment_transactions: {
        Row: {
          id: string
          investment_id: string
          user_id: string
          transaction_type: string
          quantity: number
          price: number
          total_amount: number
          fees: number
          date: string
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          investment_id: string
          user_id: string
          transaction_type?: string
          quantity: number
          price: number
          total_amount: number
          fees?: number
          date: string
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          investment_id?: string
          user_id?: string
          transaction_type?: string
          quantity?: number
          price?: number
          total_amount?: number
          fees?: number
          date?: string
          notes?: string | null
          created_at?: string
        }
        Relationships: []
      },
      goal_contributions: {
        Row: {
          id: string
          goal_id: string
          user_id: string
          amount: number
          transaction_id: string | null
          date: string
          created_at: string
        }
        Insert: {
          id?: string
          goal_id: string
          user_id: string
          amount: number
          transaction_id?: string | null
          date: string
          created_at?: string
        }
        Update: {
          id?: string
          goal_id?: string
          user_id?: string
          amount?: number
          transaction_id?: string | null
          date?: string
          created_at?: string
        }
        Relationships: []
      },
      mortgage_calculations: {
        Row: {
          id: string
          user_id: string
          financial_plan_id: string | null
          property_price: number
          down_payment: number
          loan_amount: number
          interest_rate: number
          term_years: number
          mortgage_type: string
          region: string
          state_county: string | null
          calculation_type: string
          monthly_payment: number
          total_interest: number
          results: Json
          stamp_duty: number | null
          pmi_amount: number | null
          property_tax: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          financial_plan_id?: string | null
          property_price: number
          down_payment: number
          loan_amount: number
          interest_rate: number
          term_years: number
          mortgage_type: string
          region: string
          state_county?: string | null
          calculation_type: string
          monthly_payment: number
          total_interest: number
          results?: Json
          stamp_duty?: number | null
          pmi_amount?: number | null
          property_tax?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          financial_plan_id?: string | null
          property_price?: number
          down_payment?: number
          loan_amount?: number
          interest_rate?: number
          term_years?: number
          mortgage_type?: string
          region?: string
          state_county?: string | null
          calculation_type?: string
          monthly_payment?: number
          total_interest?: number
          results?: Json
          stamp_duty?: number | null
          pmi_amount?: number | null
          property_tax?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      },
      financial_plans: {
        Row: {
          id: string
          user_id: string
          plan_type: string
          name: string
          description: string | null
          data: Json
          region: string
          currency: string
          is_active: boolean
          is_favorite: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          plan_type: string
          name: string
          description?: string | null
          data?: Json
          region: string
          currency: string
          is_active?: boolean
          is_favorite?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          plan_type?: string
          name?: string
          description?: string | null
          data?: Json
          region?: string
          currency?: string
          is_active?: boolean
          is_favorite?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      },
      saved_calculations: {
        Row: {
          id: string
          user_id: string
          calculator_type: string
          calculation_name: string | null
          inputs: Json
          results: Json
          region: string | null
          currency: string
          tags: Json | null
          is_favorite: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          calculator_type: string
          calculation_name?: string | null
          inputs?: Json
          results?: Json
          region?: string | null
          currency: string
          tags?: Json | null
          is_favorite?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          calculator_type?: string
          calculation_name?: string | null
          inputs?: Json
          results?: Json
          region?: string | null
          currency?: string
          tags?: Json | null
          is_favorite?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      },
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
        Relationships: []
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
      update_usage_counts: {
        Args: {
          p_user_id: string
        }
        Returns: undefined
      }
      has_feature_access: {
        Args: {
          p_user_id: string
          p_feature: string
        }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
  }
}
