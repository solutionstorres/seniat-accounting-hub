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
    }
    Enums: {
      app_role: "admin" | "contador" | "auditor" | "operador"
      contributor_type:
        | "ordinario"
        | "formal"
        | "especial"
        | "no_contribuyente"
        | "gobierno"
      invoice_status: "emitida" | "anulada"
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
      app_role: ["admin", "contador", "auditor", "operador"],
      contributor_type: [
        "ordinario",
        "formal",
        "especial",
        "no_contribuyente",
        "gobierno",
      ],
      invoice_status: ["emitida", "anulada"],
      withholding_type: ["iva", "islr"],
    },
  },
} as const
