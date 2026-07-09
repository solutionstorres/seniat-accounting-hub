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
          created_at: string
          created_by: string
          email: string | null
          fiscal_address: string
          id: string
          legal_name: string
          phone: string | null
          rif: string
          tax_regime: string
          trade_name: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          email?: string | null
          fiscal_address: string
          id?: string
          legal_name: string
          phone?: string | null
          rif: string
          tax_regime?: string
          trade_name?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          email?: string | null
          fiscal_address?: string
          id?: string
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
        ]
      }
      journal_lines: {
        Row: {
          account_id: string
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
      purchase_invoices: {
        Row: {
          base_amount: number
          company_id: string
          control_number: string
          created_at: string
          created_by: string
          exempt_amount: number
          id: string
          invoice_date: string
          invoice_number: string
          iva_amount: number
          iva_rate: number
          notes: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          supplier_id: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          base_amount?: number
          company_id: string
          control_number: string
          created_at?: string
          created_by: string
          exempt_amount?: number
          id?: string
          invoice_date: string
          invoice_number: string
          iva_amount?: number
          iva_rate?: number
          notes?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          supplier_id: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          base_amount?: number
          company_id?: string
          control_number?: string
          created_at?: string
          created_by?: string
          exempt_amount?: number
          id?: string
          invoice_date?: string
          invoice_number?: string
          iva_amount?: number
          iva_rate?: number
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
            foreignKeyName: "purchase_invoices_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_invoices: {
        Row: {
          base_amount: number
          company_id: string
          control_number: string
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
            foreignKeyName: "suppliers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
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
      [_ in never]: never
    }
    Functions: {
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
      next_entry_number: { Args: { _company_id: string }; Returns: number }
      post_purchase_invoice_entry: {
        Args: { _invoice_id: string }
        Returns: string
      }
      post_sales_invoice_entry: {
        Args: { _invoice_id: string }
        Returns: string
      }
      post_withholding_entry: { Args: { _wh_id: string }; Returns: string }
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
      withholding_type: ["iva", "islr"],
    },
  },
} as const
