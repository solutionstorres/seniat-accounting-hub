
-- =========================================================
-- ENUMS
-- =========================================================
CREATE TYPE public.app_role AS ENUM ('admin', 'contador', 'auditor', 'operador');
CREATE TYPE public.contributor_type AS ENUM ('ordinario', 'formal', 'especial', 'no_contribuyente', 'gobierno');
CREATE TYPE public.withholding_type AS ENUM ('iva', 'islr');
CREATE TYPE public.invoice_status AS ENUM ('emitida', 'anulada');

-- =========================================================
-- PROFILES
-- =========================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

-- Global platform admin (rarely used, but needed to bootstrap first company)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_roles_select_own" ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- =========================================================
-- COMPANIES
-- =========================================================
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rif TEXT NOT NULL UNIQUE,
  legal_name TEXT NOT NULL,
  trade_name TEXT,
  fiscal_address TEXT NOT NULL,
  tax_regime TEXT NOT NULL DEFAULT 'ordinario',
  phone TEXT,
  email TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.companies TO authenticated;
GRANT ALL ON public.companies TO service_role;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- COMPANY MEMBERS (per-company roles)
-- =========================================================
CREATE TABLE public.company_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_members TO authenticated;
GRANT ALL ON public.company_members TO service_role;
ALTER TABLE public.company_members ENABLE ROW LEVEL SECURITY;
CREATE INDEX ON public.company_members (user_id);
CREATE INDEX ON public.company_members (company_id);

-- =========================================================
-- SECURITY DEFINER HELPERS
-- =========================================================
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_company_member(_user_id UUID, _company_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.company_members WHERE user_id = _user_id AND company_id = _company_id)
$$;

CREATE OR REPLACE FUNCTION public.company_role(_user_id UUID, _company_id UUID)
RETURNS public.app_role LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.company_members WHERE user_id = _user_id AND company_id = _company_id LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.company_has_role(_user_id UUID, _company_id UUID, _roles public.app_role[])
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_members
    WHERE user_id = _user_id AND company_id = _company_id AND role = ANY(_roles)
  )
$$;

-- =========================================================
-- COMPANIES POLICIES
-- =========================================================
CREATE POLICY "companies_select_members" ON public.companies FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), id));
CREATE POLICY "companies_insert_authenticated" ON public.companies FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);
CREATE POLICY "companies_update_admin" ON public.companies FOR UPDATE TO authenticated
  USING (public.company_has_role(auth.uid(), id, ARRAY['admin']::public.app_role[]))
  WITH CHECK (public.company_has_role(auth.uid(), id, ARRAY['admin']::public.app_role[]));
CREATE POLICY "companies_delete_admin" ON public.companies FOR DELETE TO authenticated
  USING (public.company_has_role(auth.uid(), id, ARRAY['admin']::public.app_role[]));

-- =========================================================
-- COMPANY MEMBERS POLICIES
-- =========================================================
CREATE POLICY "members_select_same_company" ON public.company_members FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "members_insert_admin" ON public.company_members FOR INSERT TO authenticated
  WITH CHECK (
    public.company_has_role(auth.uid(), company_id, ARRAY['admin']::public.app_role[])
    OR NOT EXISTS (SELECT 1 FROM public.company_members WHERE company_id = company_members.company_id)
  );
CREATE POLICY "members_update_admin" ON public.company_members FOR UPDATE TO authenticated
  USING (public.company_has_role(auth.uid(), company_id, ARRAY['admin']::public.app_role[]));
CREATE POLICY "members_delete_admin" ON public.company_members FOR DELETE TO authenticated
  USING (public.company_has_role(auth.uid(), company_id, ARRAY['admin']::public.app_role[]));

-- =========================================================
-- CUSTOMERS
-- =========================================================
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  rif TEXT NOT NULL,
  name TEXT NOT NULL,
  contributor_type public.contributor_type NOT NULL DEFAULT 'ordinario',
  address TEXT,
  phone TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, rif)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customers_select" ON public.customers FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "customers_write" ON public.customers FOR INSERT TO authenticated
  WITH CHECK (public.company_has_role(auth.uid(), company_id, ARRAY['admin','contador','operador']::public.app_role[]));
CREATE POLICY "customers_update" ON public.customers FOR UPDATE TO authenticated
  USING (public.company_has_role(auth.uid(), company_id, ARRAY['admin','contador']::public.app_role[]));
CREATE POLICY "customers_delete" ON public.customers FOR DELETE TO authenticated
  USING (public.company_has_role(auth.uid(), company_id, ARRAY['admin','contador']::public.app_role[]));

-- =========================================================
-- SUPPLIERS
-- =========================================================
CREATE TABLE public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  rif TEXT NOT NULL,
  name TEXT NOT NULL,
  contributor_type public.contributor_type NOT NULL DEFAULT 'ordinario',
  address TEXT,
  phone TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, rif)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;
GRANT ALL ON public.suppliers TO service_role;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "suppliers_select" ON public.suppliers FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "suppliers_write" ON public.suppliers FOR INSERT TO authenticated
  WITH CHECK (public.company_has_role(auth.uid(), company_id, ARRAY['admin','contador']::public.app_role[]));
CREATE POLICY "suppliers_update" ON public.suppliers FOR UPDATE TO authenticated
  USING (public.company_has_role(auth.uid(), company_id, ARRAY['admin','contador']::public.app_role[]));
CREATE POLICY "suppliers_delete" ON public.suppliers FOR DELETE TO authenticated
  USING (public.company_has_role(auth.uid(), company_id, ARRAY['admin','contador']::public.app_role[]));

-- =========================================================
-- SALES INVOICES
-- =========================================================
CREATE TABLE public.sales_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id),
  invoice_number TEXT NOT NULL,
  control_number TEXT NOT NULL,
  invoice_date DATE NOT NULL,
  base_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  exempt_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  iva_rate NUMERIC(5,2) NOT NULL DEFAULT 16.00,
  iva_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  status public.invoice_status NOT NULL DEFAULT 'emitida',
  notes TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, invoice_number)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_invoices TO authenticated;
GRANT ALL ON public.sales_invoices TO service_role;
ALTER TABLE public.sales_invoices ENABLE ROW LEVEL SECURITY;
CREATE INDEX ON public.sales_invoices (company_id, invoice_date);

CREATE POLICY "sales_select" ON public.sales_invoices FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "sales_insert" ON public.sales_invoices FOR INSERT TO authenticated
  WITH CHECK (
    public.company_has_role(auth.uid(), company_id, ARRAY['admin','contador','operador']::public.app_role[])
    AND auth.uid() = created_by
  );
CREATE POLICY "sales_update" ON public.sales_invoices FOR UPDATE TO authenticated
  USING (public.company_has_role(auth.uid(), company_id, ARRAY['admin','contador']::public.app_role[]));
CREATE POLICY "sales_delete" ON public.sales_invoices FOR DELETE TO authenticated
  USING (public.company_has_role(auth.uid(), company_id, ARRAY['admin']::public.app_role[]));

-- =========================================================
-- PURCHASE INVOICES
-- =========================================================
CREATE TABLE public.purchase_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id),
  invoice_number TEXT NOT NULL,
  control_number TEXT NOT NULL,
  invoice_date DATE NOT NULL,
  base_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  exempt_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  iva_rate NUMERIC(5,2) NOT NULL DEFAULT 16.00,
  iva_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  status public.invoice_status NOT NULL DEFAULT 'emitida',
  notes TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, supplier_id, invoice_number)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_invoices TO authenticated;
GRANT ALL ON public.purchase_invoices TO service_role;
ALTER TABLE public.purchase_invoices ENABLE ROW LEVEL SECURITY;
CREATE INDEX ON public.purchase_invoices (company_id, invoice_date);

CREATE POLICY "purchases_select" ON public.purchase_invoices FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "purchases_insert" ON public.purchase_invoices FOR INSERT TO authenticated
  WITH CHECK (
    public.company_has_role(auth.uid(), company_id, ARRAY['admin','contador']::public.app_role[])
    AND auth.uid() = created_by
  );
CREATE POLICY "purchases_update" ON public.purchase_invoices FOR UPDATE TO authenticated
  USING (public.company_has_role(auth.uid(), company_id, ARRAY['admin','contador']::public.app_role[]));
CREATE POLICY "purchases_delete" ON public.purchase_invoices FOR DELETE TO authenticated
  USING (public.company_has_role(auth.uid(), company_id, ARRAY['admin']::public.app_role[]));

-- =========================================================
-- WITHHOLDINGS
-- =========================================================
CREATE TABLE public.withholdings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  type public.withholding_type NOT NULL,
  receipt_number TEXT NOT NULL,
  withholding_date DATE NOT NULL,
  purchase_invoice_id UUID REFERENCES public.purchase_invoices(id) ON DELETE SET NULL,
  sales_invoice_id UUID REFERENCES public.sales_invoices(id) ON DELETE SET NULL,
  base_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, type, receipt_number)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.withholdings TO authenticated;
GRANT ALL ON public.withholdings TO service_role;
ALTER TABLE public.withholdings ENABLE ROW LEVEL SECURITY;
CREATE INDEX ON public.withholdings (company_id, withholding_date);

CREATE POLICY "wh_select" ON public.withholdings FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "wh_insert" ON public.withholdings FOR INSERT TO authenticated
  WITH CHECK (
    public.company_has_role(auth.uid(), company_id, ARRAY['admin','contador']::public.app_role[])
    AND auth.uid() = created_by
  );
CREATE POLICY "wh_update" ON public.withholdings FOR UPDATE TO authenticated
  USING (public.company_has_role(auth.uid(), company_id, ARRAY['admin','contador']::public.app_role[]));
CREATE POLICY "wh_delete" ON public.withholdings FOR DELETE TO authenticated
  USING (public.company_has_role(auth.uid(), company_id, ARRAY['admin']::public.app_role[]));

-- =========================================================
-- UPDATED_AT TRIGGER
-- =========================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_companies_updated BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_customers_updated BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_suppliers_updated BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_sales_updated BEFORE UPDATE ON public.sales_invoices FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_purchases_updated BEFORE UPDATE ON public.purchase_invoices FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- =========================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
