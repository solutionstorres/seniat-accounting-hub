
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS fiscal_year_start DATE NOT NULL DEFAULT date_trunc('year', now())::date,
  ADD COLUMN IF NOT EXISTS fiscal_year_end DATE NOT NULL DEFAULT (date_trunc('year', now()) + INTERVAL '1 year - 1 day')::date,
  ADD COLUMN IF NOT EXISTS current_period_month DATE NOT NULL DEFAULT date_trunc('month', now())::date,
  ADD COLUMN IF NOT EXISTS accounts_level INTEGER NOT NULL DEFAULT 5 CHECK (accounts_level BETWEEN 1 AND 10);
