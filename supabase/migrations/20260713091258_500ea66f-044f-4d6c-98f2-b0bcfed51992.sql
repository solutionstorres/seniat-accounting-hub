ALTER TABLE public.suppliers 
  ADD COLUMN IF NOT EXISTS code TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS iva_account_id UUID REFERENCES public.chart_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS iva_withholding_rate NUMERIC(5,2) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_suppliers_company_code ON public.suppliers(company_id, code);