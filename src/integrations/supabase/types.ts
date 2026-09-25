export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      alert_history: {
        Row: {
          acknowledged_at: string | null
          alert_id: string | null
          alert_type: string
          created_at: string
          id: string
          is_acknowledged: boolean
          is_snoozed: boolean
          notification_email_sent: boolean | null
          notification_push_sent: boolean | null
          notification_sms_sent: boolean | null
          notification_webhook_sent: boolean | null
          snooze_reason: string | null
          snoozed_until: string | null
          symbol: string
          threshold_percent: number | null
          trigger_details: string | null
          trigger_value: number | null
          triggered_at: string
          user_id: string
        }
        Insert: {
          acknowledged_at?: string | null
          alert_id?: string | null
          alert_type: string
          created_at?: string
          id?: string
          is_acknowledged?: boolean
          is_snoozed?: boolean
          notification_email_sent?: boolean | null
          notification_push_sent?: boolean | null
          notification_sms_sent?: boolean | null
          notification_webhook_sent?: boolean | null
          snooze_reason?: string | null
          snoozed_until?: string | null
          symbol: string
          threshold_percent?: number | null
          trigger_details?: string | null
          trigger_value?: number | null
          triggered_at?: string
          user_id: string
        }
        Update: {
          acknowledged_at?: string | null
          alert_id?: string | null
          alert_type?: string
          created_at?: string
          id?: string
          is_acknowledged?: boolean
          is_snoozed?: boolean
          notification_email_sent?: boolean | null
          notification_push_sent?: boolean | null
          notification_sms_sent?: boolean | null
          notification_webhook_sent?: boolean | null
          snooze_reason?: string | null
          snoozed_until?: string | null
          symbol?: string
          threshold_percent?: number | null
          trigger_details?: string | null
          trigger_value?: number | null
          triggered_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alert_history_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "portfolio_alerts"
            referencedColumns: ["id"]
          },
        ]
      }
      analysis_watchlist: {
        Row: {
          created_at: string
          id: string
          note: string | null
          position: number
          symbol: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          position?: number
          symbol: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          position?: number
          symbol?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action_type: string
          created_at: string
          details: Json | null
          id: string
          ip_address: string | null
          target_id: string | null
          target_type: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action_type: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          target_id?: string | null
          target_type: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          target_id?: string | null
          target_type?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      broker_connections: {
        Row: {
          api_key_encrypted: string | null
          connection_type: string
          created_at: string
          id: string
          last_sync: string | null
          metadata: Json | null
          provider_name: string
          provider_type: string
          status: string
          sync_error: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          api_key_encrypted?: string | null
          connection_type: string
          created_at?: string
          id?: string
          last_sync?: string | null
          metadata?: Json | null
          provider_name: string
          provider_type: string
          status?: string
          sync_error?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          api_key_encrypted?: string | null
          connection_type?: string
          created_at?: string
          id?: string
          last_sync?: string | null
          metadata?: Json | null
          provider_name?: string
          provider_type?: string
          status?: string
          sync_error?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      broker_providers: {
        Row: {
          api_docs_url: string | null
          created_at: string
          id: string
          is_enabled: boolean | null
          logo_url: string | null
          name: string
          supports_api: boolean | null
          supports_csv: boolean | null
          type: string
        }
        Insert: {
          api_docs_url?: string | null
          created_at?: string
          id?: string
          is_enabled?: boolean | null
          logo_url?: string | null
          name: string
          supports_api?: boolean | null
          supports_csv?: boolean | null
          type: string
        }
        Update: {
          api_docs_url?: string | null
          created_at?: string
          id?: string
          is_enabled?: boolean | null
          logo_url?: string | null
          name?: string
          supports_api?: boolean | null
          supports_csv?: boolean | null
          type?: string
        }
        Relationships: []
      }
      broker_sync_data: {
        Row: {
          connection_id: string
          created_at: string
          id: string
          last_synced_at: string
          portfolio_id: string
          positions: Json
          raw_data: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          connection_id: string
          created_at?: string
          id?: string
          last_synced_at?: string
          portfolio_id: string
          positions?: Json
          raw_data?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          connection_id?: string
          created_at?: string
          id?: string
          last_synced_at?: string
          portfolio_id?: string
          positions?: Json
          raw_data?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "broker_sync_data_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: true
            referencedRelation: "broker_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "broker_sync_data_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
        ]
      }
      community_posts: {
        Row: {
          comments_count: number
          content: string
          created_at: string
          id: string
          likes_count: number
          tickers: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          comments_count?: number
          content: string
          created_at?: string
          id?: string
          likes_count?: number
          tickers?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          comments_count?: number
          content?: string
          created_at?: string
          id?: string
          likes_count?: number
          tickers?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      dividend_income_snapshots: {
        Row: {
          annual_income: number
          average_yield: number
          created_at: string
          id: string
          month: string
          monthly_income: number
          updated_at: string
          user_id: string
        }
        Insert: {
          annual_income?: number
          average_yield?: number
          created_at?: string
          id?: string
          month: string
          monthly_income?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          annual_income?: number
          average_yield?: number
          created_at?: string
          id?: string
          month?: string
          monthly_income?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      dividend_safety_history: {
        Row: {
          annual_dividend: number | null
          created_at: string
          dividend_yield: number | null
          grade: string
          id: string
          recorded_on: string
          score: number
          symbol: string
        }
        Insert: {
          annual_dividend?: number | null
          created_at?: string
          dividend_yield?: number | null
          grade: string
          id?: string
          recorded_on?: string
          score: number
          symbol: string
        }
        Update: {
          annual_dividend?: number | null
          created_at?: string
          dividend_yield?: number | null
          grade?: string
          id?: string
          recorded_on?: string
          score?: number
          symbol?: string
        }
        Relationships: []
      }
      dividend_safety_ratings: {
        Row: {
          annual_dividend: number | null
          coverage_ratio: number | null
          dividend_yield: number | null
          five_yr_growth: number | null
          frequency: string | null
          grade: string
          growth_streak: number | null
          last_ex_date: string | null
          name: string | null
          next_ex_date: string | null
          next_pay_date: string | null
          payout_ratio: number | null
          risks: Json
          score: number
          source: string | null
          symbol: string
          updated_at: string
        }
        Insert: {
          annual_dividend?: number | null
          coverage_ratio?: number | null
          dividend_yield?: number | null
          five_yr_growth?: number | null
          frequency?: string | null
          grade?: string
          growth_streak?: number | null
          last_ex_date?: string | null
          name?: string | null
          next_ex_date?: string | null
          next_pay_date?: string | null
          payout_ratio?: number | null
          risks?: Json
          score?: number
          source?: string | null
          symbol: string
          updated_at?: string
        }
        Update: {
          annual_dividend?: number | null
          coverage_ratio?: number | null
          dividend_yield?: number | null
          five_yr_growth?: number | null
          frequency?: string | null
          grade?: string
          growth_streak?: number | null
          last_ex_date?: string | null
          name?: string | null
          next_ex_date?: string | null
          next_pay_date?: string | null
          payout_ratio?: number | null
          risks?: Json
          score?: number
          source?: string | null
          symbol?: string
          updated_at?: string
        }
        Relationships: []
      }
      dividends: {
        Row: {
          amount: number
          created_at: string
          ex_date: string
          frequency: string | null
          holding_id: string
          id: string
          is_estimated: boolean | null
          pay_date: string | null
          portfolio_id: string
          symbol: string
        }
        Insert: {
          amount: number
          created_at?: string
          ex_date: string
          frequency?: string | null
          holding_id: string
          id?: string
          is_estimated?: boolean | null
          pay_date?: string | null
          portfolio_id: string
          symbol: string
        }
        Update: {
          amount?: number
          created_at?: string
          ex_date?: string
          frequency?: string | null
          holding_id?: string
          id?: string
          is_estimated?: boolean | null
          pay_date?: string | null
          portfolio_id?: string
          symbol?: string
        }
        Relationships: [
          {
            foreignKeyName: "dividends_holding_id_fkey"
            columns: ["holding_id"]
            isOneToOne: false
            referencedRelation: "holdings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dividends_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
        ]
      }
      drip_transactions: {
        Row: {
          created_at: string
          dividend_amount: number
          holding_id: string | null
          id: string
          portfolio_id: string
          purchase_date: string
          purchase_price: number
          shares_purchased: number
          symbol: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dividend_amount: number
          holding_id?: string | null
          id?: string
          portfolio_id: string
          purchase_date?: string
          purchase_price: number
          shares_purchased: number
          symbol: string
          user_id: string
        }
        Update: {
          created_at?: string
          dividend_amount?: number
          holding_id?: string | null
          id?: string
          portfolio_id?: string
          purchase_date?: string
          purchase_price?: number
          shares_purchased?: number
          symbol?: string
          user_id?: string
        }
        Relationships: []
      }
      halal_planner: {
        Row: {
          completed_steps: number[]
          created_at: string
          emergency_months: number
          emergency_saved: number
          expected_return: number
          id: string
          invest_years: number
          monthly_expenses: number
          monthly_invest: number
          notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_steps?: number[]
          created_at?: string
          emergency_months?: number
          emergency_saved?: number
          expected_return?: number
          id?: string
          invest_years?: number
          monthly_expenses?: number
          monthly_invest?: number
          notes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_steps?: number[]
          created_at?: string
          emergency_months?: number
          emergency_saved?: number
          expected_return?: number
          id?: string
          invest_years?: number
          monthly_expenses?: number
          monthly_invest?: number
          notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      halal_stocks: {
        Row: {
          business_screen_passed: boolean | null
          cash_to_market_cap: number | null
          compliance_grade: string
          created_at: string
          debt_to_market_cap: number | null
          dividend_yield: number | null
          financial_screen_passed: boolean | null
          id: string
          market_cap: number | null
          name: string
          non_permissible_revenue_pct: number | null
          overall_compliant: boolean | null
          pe_ratio: number | null
          price: number
          purification_per_share: number | null
          receivables_to_market_cap: number | null
          screened_at: string
          screening_notes: string | null
          sector: string
          symbol: string
          updated_at: string
        }
        Insert: {
          business_screen_passed?: boolean | null
          cash_to_market_cap?: number | null
          compliance_grade?: string
          created_at?: string
          debt_to_market_cap?: number | null
          dividend_yield?: number | null
          financial_screen_passed?: boolean | null
          id?: string
          market_cap?: number | null
          name: string
          non_permissible_revenue_pct?: number | null
          overall_compliant?: boolean | null
          pe_ratio?: number | null
          price?: number
          purification_per_share?: number | null
          receivables_to_market_cap?: number | null
          screened_at?: string
          screening_notes?: string | null
          sector?: string
          symbol: string
          updated_at?: string
        }
        Update: {
          business_screen_passed?: boolean | null
          cash_to_market_cap?: number | null
          compliance_grade?: string
          created_at?: string
          debt_to_market_cap?: number | null
          dividend_yield?: number | null
          financial_screen_passed?: boolean | null
          id?: string
          market_cap?: number | null
          name?: string
          non_permissible_revenue_pct?: number | null
          overall_compliant?: boolean | null
          pe_ratio?: number | null
          price?: number
          purification_per_share?: number | null
          receivables_to_market_cap?: number | null
          screened_at?: string
          screening_notes?: string | null
          sector?: string
          symbol?: string
          updated_at?: string
        }
        Relationships: []
      }
      holding_categories: {
        Row: {
          category: string
          created_at: string
          id: string
          symbol: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          id?: string
          symbol: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          symbol?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      holdings: {
        Row: {
          asset_type: string
          avg_price: number
          country: string | null
          created_at: string
          current_price: number | null
          dividend_yield: number | null
          expense_ratio: number | null
          id: string
          logo_url: string | null
          name: string
          portfolio_id: string
          sector: string | null
          shares: number
          symbol: string
          target_allocation: number | null
          updated_at: string
        }
        Insert: {
          asset_type: string
          avg_price: number
          country?: string | null
          created_at?: string
          current_price?: number | null
          dividend_yield?: number | null
          expense_ratio?: number | null
          id?: string
          logo_url?: string | null
          name: string
          portfolio_id: string
          sector?: string | null
          shares: number
          symbol: string
          target_allocation?: number | null
          updated_at?: string
        }
        Update: {
          asset_type?: string
          avg_price?: number
          country?: string | null
          created_at?: string
          current_price?: number | null
          dividend_yield?: number | null
          expense_ratio?: number | null
          id?: string
          logo_url?: string | null
          name?: string
          portfolio_id?: string
          sector?: string | null
          shares?: number
          symbol?: string
          target_allocation?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "holdings_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
        ]
      }
      investment_theses: {
        Row: {
          conviction: string
          created_at: string
          fair_value: number | null
          holding_id: string | null
          id: string
          status: string
          symbol: string
          tags: string[] | null
          thesis: string
          updated_at: string
          user_id: string
        }
        Insert: {
          conviction?: string
          created_at?: string
          fair_value?: number | null
          holding_id?: string | null
          id?: string
          status?: string
          symbol: string
          tags?: string[] | null
          thesis?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          conviction?: string
          created_at?: string
          fair_value?: number | null
          holding_id?: string | null
          id?: string
          status?: string
          symbol?: string
          tags?: string[] | null
          thesis?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "investment_theses_holding_id_fkey"
            columns: ["holding_id"]
            isOneToOne: false
            referencedRelation: "holdings"
            referencedColumns: ["id"]
          },
        ]
      }
      market_data_cache: {
        Row: {
          change: number | null
          change_percent: number | null
          created_at: string
          dividend_yield: number | null
          eps: number | null
          high_52w: number | null
          id: string
          low_52w: number | null
          market_cap: number | null
          pe_ratio: number | null
          price: number
          sector: string | null
          source: string
          symbol: string
          updated_at: string
          volume: number | null
        }
        Insert: {
          change?: number | null
          change_percent?: number | null
          created_at?: string
          dividend_yield?: number | null
          eps?: number | null
          high_52w?: number | null
          id?: string
          low_52w?: number | null
          market_cap?: number | null
          pe_ratio?: number | null
          price: number
          sector?: string | null
          source?: string
          symbol: string
          updated_at?: string
          volume?: number | null
        }
        Update: {
          change?: number | null
          change_percent?: number | null
          created_at?: string
          dividend_yield?: number | null
          eps?: number | null
          high_52w?: number | null
          id?: string
          low_52w?: number | null
          market_cap?: number | null
          pe_ratio?: number | null
          price?: number
          sector?: string | null
          source?: string
          symbol?: string
          updated_at?: string
          volume?: number | null
        }
        Relationships: []
      }
      market_sync_logs: {
        Row: {
          created_at: string
          duration_ms: number | null
          error_count: number
          error_message: string | null
          id: string
          success_count: number
          symbols_count: number
          sync_type: string
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          error_count?: number
          error_message?: string | null
          id?: string
          success_count?: number
          symbols_count: number
          sync_type: string
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          error_count?: number
          error_message?: string | null
          id?: string
          success_count?: number
          symbols_count?: number
          sync_type?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          created_at: string
          email_dividend_alerts: boolean
          email_new_comments: boolean | null
          email_new_followers: boolean | null
          email_new_likes: boolean | null
          email_portfolio_alerts: boolean
          email_price_alerts: boolean
          email_security_alerts: boolean
          email_tax_alerts: boolean
          email_weekly_summary: boolean
          id: string
          push_portfolio_alerts: boolean
          push_tax_alerts: boolean
          sms_dividend_alerts: boolean
          sms_portfolio_alerts: boolean
          sms_price_alerts: boolean
          sms_security_alerts: boolean
          sms_tax_alerts: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email_dividend_alerts?: boolean
          email_new_comments?: boolean | null
          email_new_followers?: boolean | null
          email_new_likes?: boolean | null
          email_portfolio_alerts?: boolean
          email_price_alerts?: boolean
          email_security_alerts?: boolean
          email_tax_alerts?: boolean
          email_weekly_summary?: boolean
          id?: string
          push_portfolio_alerts?: boolean
          push_tax_alerts?: boolean
          sms_dividend_alerts?: boolean
          sms_portfolio_alerts?: boolean
          sms_price_alerts?: boolean
          sms_security_alerts?: boolean
          sms_tax_alerts?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email_dividend_alerts?: boolean
          email_new_comments?: boolean | null
          email_new_followers?: boolean | null
          email_new_likes?: boolean | null
          email_portfolio_alerts?: boolean
          email_price_alerts?: boolean
          email_security_alerts?: boolean
          email_tax_alerts?: boolean
          email_weekly_summary?: boolean
          id?: string
          push_portfolio_alerts?: boolean
          push_tax_alerts?: boolean
          sms_dividend_alerts?: boolean
          sms_portfolio_alerts?: boolean
          sms_price_alerts?: boolean
          sms_security_alerts?: boolean
          sms_tax_alerts?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          actor_id: string
          content: string | null
          created_at: string
          id: string
          is_read: boolean
          target_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          actor_id: string
          content?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          target_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          actor_id?: string
          content?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          target_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      options_flow_presets: {
        Row: {
          created_at: string
          filters: Json
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          filters?: Json
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          filters?: Json
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_gateway_settings: {
        Row: {
          api_key_encrypted: string | null
          api_secret_encrypted: string | null
          created_at: string
          gateway_type: string
          id: string
          is_enabled: boolean
          metadata: Json | null
          updated_at: string
          webhook_secret_encrypted: string | null
        }
        Insert: {
          api_key_encrypted?: string | null
          api_secret_encrypted?: string | null
          created_at?: string
          gateway_type: string
          id?: string
          is_enabled?: boolean
          metadata?: Json | null
          updated_at?: string
          webhook_secret_encrypted?: string | null
        }
        Update: {
          api_key_encrypted?: string | null
          api_secret_encrypted?: string | null
          created_at?: string
          gateway_type?: string
          id?: string
          is_enabled?: boolean
          metadata?: Json | null
          updated_at?: string
          webhook_secret_encrypted?: string | null
        }
        Relationships: []
      }
      portfolio_alerts: {
        Row: {
          alert_type: string
          created_at: string
          id: string
          is_active: boolean
          notes: string | null
          symbol: string
          threshold_percent: number | null
          trigger_value: number | null
          triggered_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          alert_type: string
          created_at?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          symbol: string
          threshold_percent?: number | null
          trigger_value?: number | null
          triggered_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          alert_type?: string
          created_at?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          symbol?: string
          threshold_percent?: number | null
          trigger_value?: number | null
          triggered_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      portfolio_snapshots: {
        Row: {
          cash_balance: number | null
          created_at: string
          id: string
          portfolio_id: string
          snapshot_date: string
          total_value: number
          user_id: string
        }
        Insert: {
          cash_balance?: number | null
          created_at?: string
          id?: string
          portfolio_id: string
          snapshot_date: string
          total_value: number
          user_id: string
        }
        Update: {
          cash_balance?: number | null
          created_at?: string
          id?: string
          portfolio_id?: string
          snapshot_date?: string
          total_value?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_snapshots_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio_updates: {
        Row: {
          created_at: string
          details: Json | null
          id: string
          is_read: boolean
          significance: string
          summary: string | null
          symbol: string
          title: string
          update_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          details?: Json | null
          id?: string
          is_read?: boolean
          significance?: string
          summary?: string | null
          symbol: string
          title: string
          update_type: string
          user_id: string
        }
        Update: {
          created_at?: string
          details?: Json | null
          id?: string
          is_read?: boolean
          significance?: string
          summary?: string | null
          symbol?: string
          title?: string
          update_type?: string
          user_id?: string
        }
        Relationships: []
      }
      portfolios: {
        Row: {
          cash_balance: number | null
          created_at: string
          currency: string | null
          description: string | null
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cash_balance?: number | null
          created_at?: string
          currency?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cash_balance?: number | null
          created_at?: string
          currency?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      post_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_likes: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      price_alerts: {
        Row: {
          alert_type: string
          created_at: string
          id: string
          is_active: boolean
          symbol: string
          target_price: number
          triggered_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          alert_type: string
          created_at?: string
          id?: string
          is_active?: boolean
          symbol: string
          target_price: number
          triggered_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          alert_type?: string
          created_at?: string
          id?: string
          is_active?: boolean
          symbol?: string
          target_price?: number
          triggered_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone_number: string | null
          plan: string | null
          role: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          phone_number?: string | null
          plan?: string | null
          role?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone_number?: string | null
          plan?: string | null
          role?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      proof_of_wealth: {
        Row: {
          created_at: string
          currency: string
          expires_at: string | null
          full_name: string
          generated_at: string
          holdings_snapshot: Json
          id: string
          is_active: boolean
          net_worth: number
          share_code: string
          total_assets: number
          total_liabilities: number
          updated_at: string
          user_id: string
          views_count: number
        }
        Insert: {
          created_at?: string
          currency?: string
          expires_at?: string | null
          full_name: string
          generated_at?: string
          holdings_snapshot?: Json
          id?: string
          is_active?: boolean
          net_worth?: number
          share_code: string
          total_assets?: number
          total_liabilities?: number
          updated_at?: string
          user_id: string
          views_count?: number
        }
        Update: {
          created_at?: string
          currency?: string
          expires_at?: string | null
          full_name?: string
          generated_at?: string
          holdings_snapshot?: Json
          id?: string
          is_active?: boolean
          net_worth?: number
          share_code?: string
          total_assets?: number
          total_liabilities?: number
          updated_at?: string
          user_id?: string
          views_count?: number
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth_key: string
          created_at: string
          device_info: Json | null
          endpoint: string
          id: string
          p256dh_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auth_key: string
          created_at?: string
          device_info?: Json | null
          endpoint: string
          id?: string
          p256dh_key: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auth_key?: string
          created_at?: string
          device_info?: Json | null
          endpoint?: string
          id?: string
          p256dh_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      quarterly_tax_payments: {
        Row: {
          amount_paid: number
          confirmation_number: string | null
          created_at: string
          estimated_amount: number
          id: string
          notes: string | null
          payment_date: string | null
          payment_method: string | null
          quarter: string
          tax_year: number
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_paid?: number
          confirmation_number?: string | null
          created_at?: string
          estimated_amount?: number
          id?: string
          notes?: string | null
          payment_date?: string | null
          payment_method?: string | null
          quarter: string
          tax_year: number
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_paid?: number
          confirmation_number?: string | null
          created_at?: string
          estimated_amount?: number
          id?: string
          notes?: string | null
          payment_date?: string | null
          payment_method?: string | null
          quarter?: string
          tax_year?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      rate_limit_attempts: {
        Row: {
          action_type: string
          attempt_count: number
          cooldown_until: string | null
          created_at: string
          id: string
          updated_at: string
          user_id: string
          window_start: string
        }
        Insert: {
          action_type: string
          attempt_count?: number
          cooldown_until?: string | null
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
          window_start?: string
        }
        Update: {
          action_type?: string
          attempt_count?: number
          cooldown_until?: string | null
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
          window_start?: string
        }
        Relationships: []
      }
      shared_portfolios: {
        Row: {
          created_at: string
          id: string
          is_public: boolean
          portfolio_id: string
          share_code: string | null
          updated_at: string
          user_id: string
          views_count: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_public?: boolean
          portfolio_id: string
          share_code?: string | null
          updated_at?: string
          user_id: string
          views_count?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_public?: boolean
          portfolio_id?: string
          share_code?: string | null
          updated_at?: string
          user_id?: string
          views_count?: number
        }
        Relationships: []
      }
      state_tax_rates: {
        Row: {
          capital_gains_rate: number | null
          created_at: string
          has_separate_cg_rate: boolean
          id: string
          income_tax_rate: number
          notes: string | null
          state_code: string
          state_name: string
        }
        Insert: {
          capital_gains_rate?: number | null
          created_at?: string
          has_separate_cg_rate?: boolean
          id?: string
          income_tax_rate?: number
          notes?: string | null
          state_code: string
          state_name: string
        }
        Update: {
          capital_gains_rate?: number | null
          created_at?: string
          has_separate_cg_rate?: boolean
          id?: string
          income_tax_rate?: number
          notes?: string | null
          state_code?: string
          state_name?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          amount: number | null
          billing_cycle: string | null
          cancel_at_period_end: boolean | null
          created_at: string
          currency: string | null
          current_period_end: string | null
          current_period_start: string | null
          external_customer_id: string | null
          external_subscription_id: string | null
          id: string
          metadata: Json | null
          payment_method: string | null
          plan_tier: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number | null
          billing_cycle?: string | null
          cancel_at_period_end?: boolean | null
          created_at?: string
          currency?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          external_customer_id?: string | null
          external_subscription_id?: string | null
          id?: string
          metadata?: Json | null
          payment_method?: string | null
          plan_tier: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number | null
          billing_cycle?: string | null
          cancel_at_period_end?: boolean | null
          created_at?: string
          currency?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          external_customer_id?: string | null
          external_subscription_id?: string | null
          id?: string
          metadata?: Json | null
          payment_method?: string | null
          plan_tier?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          created_at: string
          encrypted_value: string | null
          id: string
          key: string
          updated_at: string
          value: string | null
        }
        Insert: {
          created_at?: string
          encrypted_value?: string | null
          id?: string
          key: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          created_at?: string
          encrypted_value?: string | null
          id?: string
          key?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: []
      }
      tax_documents: {
        Row: {
          created_at: string
          document_type: string
          extracted_data: Json | null
          extraction_status: string
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          long_term_gain_loss: number | null
          mime_type: string | null
          notes: string | null
          short_term_gain_loss: number | null
          tax_year: number
          total_cost_basis: number | null
          total_gain_loss: number | null
          total_proceeds: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          document_type: string
          extracted_data?: Json | null
          extraction_status?: string
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          long_term_gain_loss?: number | null
          mime_type?: string | null
          notes?: string | null
          short_term_gain_loss?: number | null
          tax_year: number
          total_cost_basis?: number | null
          total_gain_loss?: number | null
          total_proceeds?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          document_type?: string
          extracted_data?: Json | null
          extraction_status?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          long_term_gain_loss?: number | null
          mime_type?: string | null
          notes?: string | null
          short_term_gain_loss?: number | null
          tax_year?: number
          total_cost_basis?: number | null
          total_gain_loss?: number | null
          total_proceeds?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tax_lots: {
        Row: {
          cost_basis: number
          created_at: string
          holding_id: string | null
          id: string
          is_closed: boolean
          lot_type: string
          portfolio_id: string
          purchase_date: string
          realized_gain_loss: number | null
          sale_date: string | null
          sale_price: number | null
          shares: number
          symbol: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cost_basis: number
          created_at?: string
          holding_id?: string | null
          id?: string
          is_closed?: boolean
          lot_type?: string
          portfolio_id: string
          purchase_date: string
          realized_gain_loss?: number | null
          sale_date?: string | null
          sale_price?: number | null
          shares: number
          symbol: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cost_basis?: number
          created_at?: string
          holding_id?: string | null
          id?: string
          is_closed?: boolean
          lot_type?: string
          portfolio_id?: string
          purchase_date?: string
          realized_gain_loss?: number | null
          sale_date?: string | null
          sale_price?: number | null
          shares?: number
          symbol?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          created_at: string
          fees: number | null
          holding_id: string | null
          id: string
          notes: string | null
          portfolio_id: string
          price: number
          shares: number | null
          symbol: string
          total_value: number
          transaction_date: string
          type: string
        }
        Insert: {
          created_at?: string
          fees?: number | null
          holding_id?: string | null
          id?: string
          notes?: string | null
          portfolio_id: string
          price: number
          shares?: number | null
          symbol: string
          total_value: number
          transaction_date?: string
          type: string
        }
        Update: {
          created_at?: string
          fees?: number | null
          holding_id?: string | null
          id?: string
          notes?: string | null
          portfolio_id?: string
          price?: number
          shares?: number | null
          symbol?: string
          total_value?: number
          transaction_date?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_holding_id_fkey"
            columns: ["holding_id"]
            isOneToOne: false
            referencedRelation: "holdings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
        ]
      }
      two_factor_auth: {
        Row: {
          backup_codes: string[] | null
          created_at: string
          id: string
          is_enabled: boolean | null
          last_verified_at: string | null
          secret_encrypted: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          backup_codes?: string[] | null
          created_at?: string
          id?: string
          is_enabled?: boolean | null
          last_verified_at?: string | null
          secret_encrypted?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          backup_codes?: string[] | null
          created_at?: string
          id?: string
          is_enabled?: boolean | null
          last_verified_at?: string | null
          secret_encrypted?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_followers: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
          id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
          id?: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
          id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          enforce_2fa_after: string | null
          id: string
          requires_2fa: boolean | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          enforce_2fa_after?: string | null
          id?: string
          requires_2fa?: boolean | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          enforce_2fa_after?: string | null
          id?: string
          requires_2fa?: boolean | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          created_at: string
          default_cost_basis_method: string | null
          default_portfolio_id: string | null
          dividend_tax_rate: number | null
          federal_tax_rate: number | null
          id: string
          investing_mode: string | null
          qualified_dividend_rate: number | null
          state_code: string | null
          state_tax_rate: number | null
          theme: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          default_cost_basis_method?: string | null
          default_portfolio_id?: string | null
          dividend_tax_rate?: number | null
          federal_tax_rate?: number | null
          id?: string
          investing_mode?: string | null
          qualified_dividend_rate?: number | null
          state_code?: string | null
          state_tax_rate?: number | null
          theme?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          default_cost_basis_method?: string | null
          default_portfolio_id?: string | null
          dividend_tax_rate?: number | null
          federal_tax_rate?: number | null
          id?: string
          investing_mode?: string | null
          qualified_dividend_rate?: number | null
          state_code?: string | null
          state_tax_rate?: number | null
          theme?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_settings_default_portfolio_id_fkey"
            columns: ["default_portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
        ]
      }
      watchlist: {
        Row: {
          added_at: string
          alert_enabled: boolean | null
          id: string
          name: string | null
          notes: string | null
          position: number | null
          symbol: string
          target_price: number | null
          user_id: string
        }
        Insert: {
          added_at?: string
          alert_enabled?: boolean | null
          id?: string
          name?: string | null
          notes?: string | null
          position?: number | null
          symbol: string
          target_price?: number | null
          user_id: string
        }
        Update: {
          added_at?: string
          alert_enabled?: boolean | null
          id?: string
          name?: string | null
          notes?: string | null
          position?: number | null
          symbol?: string
          target_price?: number | null
          user_id?: string
        }
        Relationships: []
      }
      webhook_settings: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          notify_dividend_alerts: boolean
          notify_portfolio_alerts: boolean
          notify_price_alerts: boolean
          updated_at: string
          user_id: string
          webhook_type: string
          webhook_url: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          notify_dividend_alerts?: boolean
          notify_portfolio_alerts?: boolean
          notify_price_alerts?: boolean
          updated_at?: string
          user_id: string
          webhook_type: string
          webhook_url: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          notify_dividend_alerts?: boolean
          notify_portfolio_alerts?: boolean
          notify_price_alerts?: boolean
          updated_at?: string
          user_id?: string
          webhook_type?: string
          webhook_url?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_rate_limit: {
        Args: {
          p_action_type: string
          p_cooldown_seconds?: number
          p_max_attempts?: number
          p_user_id: string
          p_window_seconds?: number
        }
        Returns: Json
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      public_portfolio_leaderboard: {
        Args: never
        Returns: {
          holdings_count: number
          portfolio_name: string
          return_pct: number
          share_code: string
          views_count: number
        }[]
      }
    }
    Enums: {
      app_role: "user" | "admin" | "super_admin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["user", "admin", "super_admin"],
    },
  },
} as const
