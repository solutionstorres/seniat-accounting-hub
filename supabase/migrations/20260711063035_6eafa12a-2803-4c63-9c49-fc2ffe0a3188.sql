
-- ============ COST CENTERS ============
CREATE TABLE public.cost_centers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.cost_centers(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  level INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, code)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cost_centers TO authenticated;
GRANT ALL ON public.cost_centers TO service_role;

ALTER TABLE public.cost_centers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read cost centers" ON public.cost_centers
  FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));

CREATE POLICY "writers insert cost centers" ON public.cost_centers
  FOR INSERT TO authenticated
  WITH CHECK (public.company_has_role(auth.uid(), company_id, ARRAY['admin','contador']::app_role[]));

CREATE POLICY "writers update cost centers" ON public.cost_centers
  FOR UPDATE TO authenticated
  USING (public.company_has_role(auth.uid(), company_id, ARRAY['admin','contador']::app_role[]));

CREATE POLICY "writers delete cost centers" ON public.cost_centers
  FOR DELETE TO authenticated
  USING (public.company_has_role(auth.uid(), company_id, ARRAY['admin','contador']::app_role[]));

CREATE TRIGGER trg_cost_centers_updated
  BEFORE UPDATE ON public.cost_centers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- link cost centers to movements
ALTER TABLE public.journal_lines ADD COLUMN IF NOT EXISTS cost_center_id UUID REFERENCES public.cost_centers(id) ON DELETE SET NULL;
ALTER TABLE public.sales_invoices ADD COLUMN IF NOT EXISTS cost_center_id UUID REFERENCES public.cost_centers(id) ON DELETE SET NULL;
ALTER TABLE public.purchase_invoices ADD COLUMN IF NOT EXISTS cost_center_id UUID REFERENCES public.cost_centers(id) ON DELETE SET NULL;

-- ============ FIND OR CREATE PROFILE BY EMAIL ============
CREATE OR REPLACE FUNCTION public.find_or_create_profile_by_email(_email TEXT)
RETURNS TABLE(id UUID, email TEXT, full_name TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user auth.users%ROWTYPE;
BEGIN
  SELECT * INTO v_user FROM auth.users WHERE lower(u.email) = lower(_email) LIMIT 1
    -- alias workaround
    ;
  -- retry with alias-friendly form
  IF NOT FOUND THEN
    SELECT * INTO v_user FROM auth.users AS u WHERE lower(u.email) = lower(_email) LIMIT 1;
  END IF;
  IF NOT FOUND THEN
    RETURN;
  END IF;
  INSERT INTO public.profiles(id, email, full_name)
    VALUES(v_user.id, v_user.email, COALESCE(v_user.raw_user_meta_data->>'full_name', v_user.email))
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
  RETURN QUERY SELECT p.id, p.email, p.full_name FROM public.profiles p WHERE p.id = v_user.id;
END;
$$;

REVOKE ALL ON FUNCTION public.find_or_create_profile_by_email(TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.find_or_create_profile_by_email(TEXT) TO authenticated;

-- ============ REVERSE JOURNAL ENTRY ============
ALTER TABLE public.journal_entries ADD COLUMN IF NOT EXISTS reversed_by_entry_id UUID REFERENCES public.journal_entries(id) ON DELETE SET NULL;
ALTER TABLE public.journal_entries ADD COLUMN IF NOT EXISTS reverses_entry_id UUID REFERENCES public.journal_entries(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.reverse_journal_entry(_entry_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  orig public.journal_entries%ROWTYPE;
  new_id UUID;
  new_num BIGINT;
  uid UUID;
BEGIN
  SELECT * INTO orig FROM public.journal_entries WHERE id = _entry_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Asiento no encontrado'; END IF;
  IF orig.status = 'anulado' OR orig.reversed_by_entry_id IS NOT NULL THEN
    RAISE EXCEPTION 'Asiento ya reversado o anulado';
  END IF;
  IF NOT public.company_has_role(auth.uid(), orig.company_id, ARRAY['admin','contador']::app_role[]) THEN
    RAISE EXCEPTION 'Sin permisos';
  END IF;

  new_num := public.next_entry_number(orig.company_id);
  uid := auth.uid();
  INSERT INTO public.journal_entries(company_id, entry_number, entry_date, description, source, source_id, status, created_by, reverses_entry_id)
    VALUES(orig.company_id, new_num, CURRENT_DATE, 'REVERSO de asiento N° ' || orig.entry_number || ' — ' || orig.description,
           'reverso', orig.id, 'contabilizado', uid, orig.id)
    RETURNING id INTO new_id;

  INSERT INTO public.journal_lines(entry_id, account_id, debit, credit, description, line_order, cost_center_id)
    SELECT new_id, account_id, credit, debit, 'Reverso: ' || COALESCE(description,''), line_order, cost_center_id
    FROM public.journal_lines WHERE entry_id = orig.id ORDER BY line_order;

  UPDATE public.journal_entries SET reversed_by_entry_id = new_id, status = 'reversado' WHERE id = orig.id;
  RETURN new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.reverse_journal_entry(UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.reverse_journal_entry(UUID) TO authenticated;
