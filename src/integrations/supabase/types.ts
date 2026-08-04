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
      accounting_periods: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          company_id: string
          created_at: string
          id: string
          month: number
          status: string
          updated_at: string
          year: number
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          company_id: string
          created_at?: string
          id?: string
          month: number
          status?: string
          updated_at?: string
          year: number
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          company_id?: string
          created_at?: string
          id?: string
          month?: number
          status?: string
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "accounting_periods_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      chart_accounts: {
        Row: {
          account_type: Database["public"]["Enums"]["account_type"]
          active: boolean
          code: string
          company_id: string
          created_at: string
          id: string
          is_postable: boolean
          level: number
          name: string
          nature: Database["public"]["Enums"]["account_nature"]
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          account_type: Database["public"]["Enums"]["account_type"]
          active?: boolean
          code: string
          company_id: string
          created_at?: string
          id?: string
          is_postable?: boolean
          level?: number
          name: string
          nature: Database["public"]["Enums"]["account_nature"]
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          account_type?: Database["public"]["Enums"]["account_type"]
          active?: boolean
          code?: string
          company_id?: string
          created_at?: string
          id?: string
          is_postable?: boolean
          level?: number
          name?: string
          nature?: Database["public"]["Enums"]["account_nature"]
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chart_accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chart_accounts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "chart_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          accounts_level: number
          created_at: string
          created_by: string
          current_period_month: string
          default_islr_withholding_rate: number
          default_iva_withholding_rate: number
          email: string | null
          fiscal_address: string
          fiscal_year_end: string
          fiscal_year_start: string
          id: string
          igtf_rate: number
          is_islr_withholding_agent: boolean
          is_iva_withholding_agent: boolean
          legal_name: string
          phone: string | null
          rif: string
          tax_regime: string
          trade_name: string | null
          updated_at: string
        }
        Insert: {
          accounts_level?: number
          created_at?: string
          created_by: string
          current_period_month?: string
          default_islr_withholding_rate?: number
          default_iva_withholding_rate?: number
          email?: string | null
          fiscal_address: string
          fiscal_year_end?: string
          fiscal_year_start?: string
          id?: string
          igtf_rate?: number
          is_islr_withholding_agent?: boolean
          is_iva_withholding_agent?: boolean
          legal_name: string
          phone?: string | null
          rif: string
          tax_regime?: string
          trade_name?: string | null
          updated_at?: string
        }
        Update: {
          accounts_level?: number
          created_at?: string
          created_by?: string
          current_period_month?: string
          default_islr_withholding_rate?: number
          default_iva_withholding_rate?: number
          email?: string | null
          fiscal_address?: string
          fiscal_year_end?: string
          fiscal_year_start?: string
          id?: string
          igtf_rate?: number
          is_islr_withholding_agent?: boolean
          is_iva_withholding_agent?: boolean
          legal_name?: string
          phone?: string | null
          rif?: string
          tax_regime?: string
          trade_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      company_accounting_config: {
        Row: {
          accounts_payable: string | null
          accounts_receivable: string | null
          company_id: string
          created_at: string
          default_cash_account: string | null
          islr_wh_payable: string | null
          islr_wh_receivable: string | null
          iva_credit_account: string | null
          iva_debit_account: string | null
          iva_wh_payable: string | null
          iva_wh_receivable: string | null
          purchases_account: string | null
          sales_exempt_account: string | null
          sales_taxed_account: string | null
          updated_at: string
        }
        Insert: {
          accounts_payable?: string | null
          accounts_receivable?: string | null
          company_id: string
          created_at?: string
          default_cash_account?: string | null
          islr_wh_payable?: string | null
          islr_wh_receivable?: string | null
          iva_credit_account?: string | null
          iva_debit_account?: string | null
          iva_wh_payable?: string | null
          iva_wh_receivable?: string | null
          purchases_account?: string | null
          sales_exempt_account?: string | null
          sales_taxed_account?: string | null
          updated_at?: string
        }
        Update: {
          accounts_payable?: string | null
          accounts_receivable?: string | null
          company_id?: string
          created_at?: string
          default_cash_account?: string | null
          islr_wh_payable?: string | null
          islr_wh_receivable?: string | null
          iva_credit_account?: string | null
          iva_debit_account?: string | null
          iva_wh_payable?: string | null
          iva_wh_receivable?: string | null
          purchases_account?: string | null
          sales_exempt_account?: string | null
          sales_taxed_account?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_accounting_config_accounts_payable_fkey"
            columns: ["accounts_payable"]
            isOneToOne: false
            referencedRelation: "chart_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_accounting_config_accounts_receivable_fkey"
            columns: ["accounts_receivable"]
            isOneToOne: false
            referencedRelation: "chart_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_accounting_config_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_accounting_config_default_cash_account_fkey"
            columns: ["default_cash_account"]
            isOneToOne: false
            referencedRelation: "chart_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_accounting_config_islr_wh_payable_fkey"
            columns: ["islr_wh_payable"]
            isOneToOne: false
            referencedRelation: "chart_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_accounting_config_islr_wh_receivable_fkey"
            columns: ["islr_wh_receivable"]
            isOneToOne: false
            referencedRelation: "chart_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_accounting_config_iva_credit_account_fkey"
            columns: ["iva_credit_account"]
            isOneToOne: false
            referencedRelation: "chart_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_accounting_config_iva_debit_account_fkey"
            columns: ["iva_debit_account"]
            isOneToOne: false
            referencedRelation: "chart_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_accounting_config_iva_wh_payable_fkey"
            columns: ["iva_wh_payable"]
            isOneToOne: false
            referencedRelation: "chart_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_accounting_config_iva_wh_receivable_fkey"
            columns: ["iva_wh_receivable"]
            isOneToOne: false
            referencedRelation: "chart_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_accounting_config_purchases_account_fkey"
            columns: ["purchases_account"]
            isOneToOne: false
            referencedRelation: "chart_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_accounting_config_sales_exempt_account_fkey"
            columns: ["sales_exempt_account"]
            isOneToOne: false
            referencedRelation: "chart_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_accounting_config_sales_taxed_account_fkey"
            columns: ["sales_taxed_account"]
            isOneToOne: false
            referencedRelation: "chart_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      company_accounting_configs: {
        Row: {
          company_id: string
          created_at: string
          default_bank_account_id: string | null
          default_cash_account_id: string | null
          default_customer_collect_account_id: string | null
          default_igtf_expense_account_id: string | null
          default_igtf_pay_account_id: string | null
          default_islr_retention_account_id: string | null
          default_iva_credit_account_id: string | null
          default_iva_debt_account_id: string | null
          default_iva_retention_account_id: string | null
          default_purchase_account_id: string | null
          default_sales_account_id: string | null
          default_supplier_pay_account_id: string | null
          default_usd_cash_account_id: string | null
          id: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          default_bank_account_id?: string | null
          default_cash_account_id?: string | null
          default_customer_collect_account_id?: string | null
          default_igtf_expense_account_id?: string | null
          default_igtf_pay_account_id?: string | null
          default_islr_retention_account_id?: string | null
          default_iva_credit_account_id?: string | null
          default_iva_debt_account_id?: string | null
          default_iva_retention_account_id?: string | null
          default_purchase_account_id?: string | null
          default_sales_account_id?: string | null
          default_supplier_pay_account_id?: string | null
          default_usd_cash_account_id?: string | null
          id?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          default_bank_account_id?: string | null
          default_cash_account_id?: string | null
          default_customer_collect_account_id?: string | null
          default_igtf_expense_account_id?: string | null
          default_igtf_pay_account_id?: string | null
          default_islr_retention_account_id?: string | null
          default_iva_credit_account_id?: string | null
          default_iva_debt_account_id?: string | null
          default_iva_retention_account_id?: string | null
          default_purchase_account_id?: string | null
          default_sales_account_id?: string | null
          default_supplier_pay_account_id?: string | null
          default_usd_cash_account_id?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_accounting_configs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_accounting_configs_default_bank_account_id_fkey"
            columns: ["default_bank_account_id"]
            isOneToOne: false
            referencedRelation: "chart_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_accounting_configs_default_cash_account_id_fkey"
            columns: ["default_cash_account_id"]
            isOneToOne: false
            referencedRelation: "chart_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_accounting_configs_default_igtf_expense_account_id_fkey"
            columns: ["default_igtf_expense_account_id"]
            isOneToOne: false
            referencedRelation: "chart_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_accounting_configs_default_igtf_pay_account_id_fkey"
            columns: ["default_igtf_pay_account_id"]
            isOneToOne: false
            referencedRelation: "chart_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_accounting_configs_default_islr_retention_account__fkey"
            columns: ["default_islr_retention_account_id"]
            isOneToOne: false
            referencedRelation: "chart_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_accounting_configs_default_iva_retention_account_i_fkey"
            columns: ["default_iva_retention_account_id"]
            isOneToOne: false
            referencedRelation: "chart_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_accounting_configs_default_usd_cash_account_id_fkey"
            columns: ["default_usd_cash_account_id"]
            isOneToOne: false
            referencedRelation: "chart_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      company_members: {
        Row: {
          company_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_members_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_centers: {
        Row: {
          code: string
          company_id: string
          created_at: string
          id: string
          is_active: boolean
          level: number
          name: string
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          code: string
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          level?: number
          name: string
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          level?: number
          name?: string
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cost_centers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_centers_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          company_id: string
          contributor_type: Database["public"]["Enums"]["contributor_type"]
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string | null
          rif: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          company_id: string
          contributor_type?: Database["public"]["Enums"]["contributor_type"]
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          rif: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          company_id?: string
          contributor_type?: Database["public"]["Enums"]["contributor_type"]
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          rif?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entries: {
        Row: {
          company_id: string
          created_at: string
          created_by: string
          description: string
          entry_date: string
          entry_number: number
          id: string
          reversed_by_entry_id: string | null
          reverses_entry_id: string | null
          source: Database["public"]["Enums"]["journal_source"]
          source_id: string | null
          status: Database["public"]["Enums"]["journal_status"]
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by: string
          description: string
          entry_date: string
          entry_number: number
          id?: string
          reversed_by_entry_id?: string | null
          reverses_entry_id?: string | null
          source?: Database["public"]["Enums"]["journal_source"]
          source_id?: string | null
          status?: Database["public"]["Enums"]["journal_status"]
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string
          description?: string
          entry_date?: string
          entry_number?: number
          id?: string
          reversed_by_entry_id?: string | null
          reverses_entry_id?: string | null
          source?: Database["public"]["Enums"]["journal_source"]
          source_id?: string | null
          status?: Database["public"]["Enums"]["journal_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_reversed_by_entry_id_fkey"
            columns: ["reversed_by_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_reverses_entry_id_fkey"
            columns: ["reverses_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_lines: {
        Row: {
          account_id: string
          cost_center_id: string | null
          created_at: string
          credit: number
          debit: number
          description: string | null
          entry_id: string
          id: string
          line_order: number
        }
        Insert: {
          account_id: string
          cost_center_id?: string | null
          created_at?: string
          credit?: number
          debit?: number
          description?: string | null
          entry_id: string
          id?: string
          line_order?: number
        }
        Update: {
          account_id?: string
          cost_center_id?: string | null
          created_at?: string
          credit?: number
          debit?: number
          description?: string | null
          entry_id?: string
          id?: string
          line_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "journal_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "chart_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_lines_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_lines_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      purchase_igtf_ledger: {
        Row: {
          base_amount_bs: number
          company_id: string
          created_at: string
          exchange_rate: number
          id: string
          igtf_rate: number
          igtf_retained_bs: number
          invoice_number: string
          operation_date: string
          payment_amount_usd: number
          payment_id: string
          supplier_name: string
          supplier_rif: string
        }
        Insert: {
          base_amount_bs: number
          company_id: string
          created_at?: string
          exchange_rate: number
          id?: string
          igtf_rate?: number
          igtf_retained_bs: number
          invoice_number: string
          operation_date: string
          payment_amount_usd: number
          payment_id: string
          supplier_name: string
          supplier_rif: string
        }
        Update: {
          base_amount_bs?: number
          company_id?: string
          created_at?: string
          exchange_rate?: number
          id?: string
          igtf_rate?: number
          igtf_retained_bs?: number
          invoice_number?: string
          operation_date?: string
          payment_amount_usd?: number
          payment_id?: string
          supplier_name?: string
          supplier_rif?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_igtf_ledger_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_igtf_ledger_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "purchase_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_invoices: {
        Row: {
          affected_control_number: string | null
          affected_invoice_number: string | null
          apply_islr_retention: boolean | null
          apply_iva_retention: boolean | null
          base_amount: number
          company_id: string
          control_number: string
          cost_center_id: string | null
          created_at: string
          created_by: string
          document_type: string | null
          exempt_amount: number
          id: string
          invoice_date: string
          invoice_number: string
          islr_concept_code: string | null
          islr_retention_percentage: number | null
          iva_amount: number
          iva_rate: number
          iva_retention_percentage: number | null
          notes: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          supplier_id: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          affected_control_number?: string | null
          affected_invoice_number?: string | null
          apply_islr_retention?: boolean | null
          apply_iva_retention?: boolean | null
          base_amount?: number
          company_id: string
          control_number: string
          cost_center_id?: string | null
          created_at?: string
          created_by: string
          document_type?: string | null
          exempt_amount?: number
          id?: string
          invoice_date: string
          invoice_number: string
          islr_concept_code?: string | null
          islr_retention_percentage?: number | null
          iva_amount?: number
          iva_rate?: number
          iva_retention_percentage?: number | null
          notes?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          supplier_id: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          affected_control_number?: string | null
          affected_invoice_number?: string | null
          apply_islr_retention?: boolean | null
          apply_iva_retention?: boolean | null
          base_amount?: number
          company_id?: string
          control_number?: string
          cost_center_id?: string | null
          created_at?: string
          created_by?: string
          document_type?: string | null
          exempt_amount?: number
          id?: string
          invoice_date?: string
          invoice_number?: string
          islr_concept_code?: string | null
          islr_retention_percentage?: number | null
          iva_amount?: number
          iva_rate?: number
          iva_retention_percentage?: number | null
          notes?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          supplier_id?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_invoices_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_invoices_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_invoices_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "v_pending_purchase_payments"
            referencedColumns: ["supplier_id"]
          },
        ]
      }
      purchase_islr_retentions: {
        Row: {
          base_amount: number
          company_id: string
          concept_code: string
          created_at: string
          created_by: string | null
          id: string
          invoice_id: string
          retained_amount: number
          retention_date: string
          retention_number: string
          retention_percentage: number
          subtraction_amount: number
          updated_at: string
        }
        Insert: {
          base_amount: number
          company_id: string
          concept_code: string
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_id: string
          retained_amount: number
          retention_date: string
          retention_number: string
          retention_percentage: number
          subtraction_amount?: number
          updated_at?: string
        }
        Update: {
          base_amount?: number
          company_id?: string
          concept_code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_id?: string
          retained_amount?: number
          retention_date?: string
          retention_number?: string
          retention_percentage?: number
          subtraction_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_islr_retentions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_islr_retentions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: true
            referencedRelation: "purchase_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_islr_retentions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: true
            referencedRelation: "v_pending_purchase_payments"
            referencedColumns: ["invoice_id"]
          },
        ]
      }
      purchase_iva_retentions: {
        Row: {
          base_amount: number
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          invoice_id: string
          iva_amount: number
          retained_amount: number
          retention_date: string
          retention_number: string
          retention_percentage: number
          updated_at: string
        }
        Insert: {
          base_amount: number
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_id: string
          iva_amount: number
          retained_amount: number
          retention_date: string
          retention_number: string
          retention_percentage?: number
          updated_at?: string
        }
        Update: {
          base_amount?: number
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_id?: string
          iva_amount?: number
          retained_amount?: number
          retention_date?: string
          retention_number?: string
          retention_percentage?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_iva_retentions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_iva_retentions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: true
            referencedRelation: "purchase_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_iva_retentions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: true
            referencedRelation: "v_pending_purchase_payments"
            referencedColumns: ["invoice_id"]
          },
        ]
      }
      purchase_payment_lines: {
        Row: {
          account_id: string
          amount_currency: number
          amount_usd: number
          apply_igtf: boolean
          company_id: string
          created_at: string
          currency: string
          exchange_rate: number
          id: string
          igtf_amount: number
          line_order: number
          method: Database["public"]["Enums"]["payment_method_type"]
          payment_id: string
          reference_number: string | null
          updated_at: string
        }
        Insert: {
          account_id: string
          amount_currency?: number
          amount_usd?: number
          apply_igtf?: boolean
          company_id: string
          created_at?: string
          currency?: string
          exchange_rate?: number
          id?: string
          igtf_amount?: number
          line_order?: number
          method?: Database["public"]["Enums"]["payment_method_type"]
          payment_id: string
          reference_number?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          amount_currency?: number
          amount_usd?: number
          apply_igtf?: boolean
          company_id?: string
          created_at?: string
          currency?: string
          exchange_rate?: number
          id?: string
          igtf_amount?: number
          line_order?: number
          method?: Database["public"]["Enums"]["payment_method_type"]
          payment_id?: string
          reference_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_payment_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "chart_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_payment_lines_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_payment_lines_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "purchase_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_payments: {
        Row: {
          amount_in_bs: number | null
          amount_in_usd: number | null
          amount_paid: number
          apply_igtf: boolean | null
          company_id: string
          created_at: string
          created_by: string | null
          currency: string
          exchange_rate: number | null
          id: string
          igtf_amount: number | null
          invoice_id: string
          islr_retained_amount: number
          islr_retention_number: string | null
          islr_retention_percentage: number
          iva_retained_amount: number
          iva_retention_number: string | null
          iva_retention_percentage: number
          notes: string | null
          payment_account_id: string | null
          payment_date: string
          payment_method: Database["public"]["Enums"]["payment_method_type"]
          reference_number: string | null
        }
        Insert: {
          amount_in_bs?: number | null
          amount_in_usd?: number | null
          amount_paid: number
          apply_igtf?: boolean | null
          company_id: string
          created_at?: string
          created_by?: string | null
          currency?: string
          exchange_rate?: number | null
          id?: string
          igtf_amount?: number | null
          invoice_id: string
          islr_retained_amount?: number
          islr_retention_number?: string | null
          islr_retention_percentage?: number
          iva_retained_amount?: number
          iva_retention_number?: string | null
          iva_retention_percentage?: number
          notes?: string | null
          payment_account_id?: string | null
          payment_date?: string
          payment_method: Database["public"]["Enums"]["payment_method_type"]
          reference_number?: string | null
        }
        Update: {
          amount_in_bs?: number | null
          amount_in_usd?: number | null
          amount_paid?: number
          apply_igtf?: boolean | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          exchange_rate?: number | null
          id?: string
          igtf_amount?: number | null
          invoice_id?: string
          islr_retained_amount?: number
          islr_retention_number?: string | null
          islr_retention_percentage?: number
          iva_retained_amount?: number
          iva_retention_number?: string | null
          iva_retention_percentage?: number
          notes?: string | null
          payment_account_id?: string | null
          payment_date?: string
          payment_method?: Database["public"]["Enums"]["payment_method_type"]
          reference_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "purchase_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "v_pending_purchase_payments"
            referencedColumns: ["invoice_id"]
          },
          {
            foreignKeyName: "purchase_payments_payment_account_id_fkey"
            columns: ["payment_account_id"]
            isOneToOne: false
            referencedRelation: "chart_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_invoices: {
        Row: {
          base_amount: number
          company_id: string
          control_number: string
          cost_center_id: string | null
          created_at: string
          created_by: string
          customer_id: string
          exempt_amount: number
          id: string
          invoice_date: string
          invoice_number: string
          iva_amount: number
          iva_rate: number
          notes: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          total_amount: number
          updated_at: string
        }
        Insert: {
          base_amount?: number
          company_id: string
          control_number: string
          cost_center_id?: string | null
          created_at?: string
          created_by: string
          customer_id: string
          exempt_amount?: number
          id?: string
          invoice_date: string
          invoice_number: string
          iva_amount?: number
          iva_rate?: number
          notes?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          total_amount?: number
          updated_at?: string
        }
        Update: {
          base_amount?: number
          company_id?: string
          control_number?: string
          cost_center_id?: string | null
          created_at?: string
          created_by?: string
          customer_id?: string
          exempt_amount?: number
          id?: string
          invoice_date?: string
          invoice_number?: string
          iva_amount?: number
          iva_rate?: number
          notes?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoices_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          code: string | null
          company_id: string
          contributor_type: Database["public"]["Enums"]["contributor_type"]
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          iva_account_id: string | null
          iva_withholding_rate: number
          name: string
          phone: string | null
          rif: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          code?: string | null
          company_id: string
          contributor_type?: Database["public"]["Enums"]["contributor_type"]
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          iva_account_id?: string | null
          iva_withholding_rate?: number
          name: string
          phone?: string | null
          rif: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          code?: string | null
          company_id?: string
          contributor_type?: Database["public"]["Enums"]["contributor_type"]
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          iva_account_id?: string | null
          iva_withholding_rate?: number
          name?: string
          phone?: string | null
          rif?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suppliers_iva_account_id_fkey"
            columns: ["iva_account_id"]
            isOneToOne: false
            referencedRelation: "chart_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      withholdings: {
        Row: {
          amount: number
          base_amount: number
          company_id: string
          created_at: string
          created_by: string
          id: string
          notes: string | null
          purchase_invoice_id: string | null
          rate: number
          receipt_number: string
          sales_invoice_id: string | null
          type: Database["public"]["Enums"]["withholding_type"]
          withholding_date: string
        }
        Insert: {
          amount?: number
          base_amount?: number
          company_id: string
          created_at?: string
          created_by: string
          id?: string
          notes?: string | null
          purchase_invoice_id?: string | null
          rate?: number
          receipt_number: string
          sales_invoice_id?: string | null
          type: Database["public"]["Enums"]["withholding_type"]
          withholding_date: string
        }
        Update: {
          amount?: number
          base_amount?: number
          company_id?: string
          created_at?: string
          created_by?: string
          id?: string
          notes?: string | null
          purchase_invoice_id?: string | null
          rate?: number
          receipt_number?: string
          sales_invoice_id?: string | null
          type?: Database["public"]["Enums"]["withholding_type"]
          withholding_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "withholdings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "withholdings_purchase_invoice_id_fkey"
            columns: ["purchase_invoice_id"]
            isOneToOne: false
            referencedRelation: "purchase_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "withholdings_purchase_invoice_id_fkey"
            columns: ["purchase_invoice_id"]
            isOneToOne: false
            referencedRelation: "v_pending_purchase_payments"
            referencedColumns: ["invoice_id"]
          },
          {
            foreignKeyName: "withholdings_sales_invoice_id_fkey"
            columns: ["sales_invoice_id"]
            isOneToOne: false
            referencedRelation: "sales_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_pending_purchase_payments: {
        Row: {
          company_id: string | null
          document_type: string | null
          invoice_date: string | null
          invoice_id: string | null
          invoice_number: string | null
          islr_retained: number | null
          iva_retained: number | null
          net_amount_to_pay: number | null
          original_total: number | null
          remaining_balance: number | null
          supplier_id: string | null
          supplier_name: string | null
          supplier_rif: string | null
          was_islr_retained: boolean | null
          was_iva_retained: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      close_fiscal_year: {
        Args: { _company_id: string; _year: number }
        Returns: string
      }
      close_period: {
        Args: { _company_id: string; _month: number; _year: number }
        Returns: string
      }
      company_has_role: {
        Args: {
          _company_id: string
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      company_role: {
        Args: { _company_id: string; _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      find_or_create_profile_by_email: {
        Args: { _email: string }
        Returns: {
          email: string
          full_name: string
          id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_company_member: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      is_period_closed: {
        Args: { _company_id: string; _date: string }
        Returns: boolean
      }
      next_entry_number: { Args: { _company_id: string }; Returns: number }
      open_fiscal_year: {
        Args: { _company_id: string; _year: number }
        Returns: string
      }
      post_purchase_invoice_entry: {
        Args: { _invoice_id: string }
        Returns: string
      }
      post_purchase_payment: { Args: { _payment_id: string }; Returns: string }
      post_sales_invoice_entry: {
        Args: { _invoice_id: string }
        Returns: string
      }
      post_withholding_entry: { Args: { _wh_id: string }; Returns: string }
      reopen_period: {
        Args: { _company_id: string; _month: number; _year: number }
        Returns: undefined
      }
      resolve_postable_account: {
        Args: { _account_id: string }
        Returns: string
      }
      reverse_journal_entry: { Args: { _entry_id: string }; Returns: string }
      seed_chart_of_accounts: {
        Args: { _company_id: string }
        Returns: undefined
      }
    }
    Enums: {
      account_nature: "deudora" | "acreedora"
      account_type:
        | "activo"
        | "pasivo"
        | "patrimonio"
        | "ingreso"
        | "costo"
        | "gasto"
        | "orden"
      app_role: "admin" | "contador" | "auditor" | "operador"
      contributor_type:
        | "ordinario"
        | "formal"
        | "especial"
        | "no_contribuyente"
        | "gobierno"
      invoice_status: "emitida" | "anulada"
      journal_source:
        | "manual"
        | "sales_invoice"
        | "purchase_invoice"
        | "withholding"
      journal_status: "borrador" | "contabilizado" | "anulado"
      payment_method_type:
        | "efectivo"
        | "punto"
        | "pago_movil"
        | "divisa"
        | "mixto"
      withholding_type: "iva" | "islr"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      account_nature: ["deudora", "acreedora"],
      account_type: [
        "activo",
        "pasivo",
        "patrimonio",
        "ingreso",
        "costo",
        "gasto",
        "orden",
      ],
      app_role: ["admin", "contador", "auditor", "operador"],
      contributor_type: [
        "ordinario",
        "formal",
        "especial",
        "no_contribuyente",
        "gobierno",
      ],
      invoice_status: ["emitida", "anulada"],
      journal_source: [
        "manual",
        "sales_invoice",
        "purchase_invoice",
        "withholding",
      ],
      journal_status: ["borrador", "contabilizado", "anulado"],
      payment_method_type: [
        "efectivo",
        "punto",
        "pago_movil",
        "divisa",
        "mixto",
      ],
      withholding_type: ["iva", "islr"],
    },
  },
} as const
