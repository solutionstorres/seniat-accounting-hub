
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_payments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_iva_retentions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_islr_retentions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_igtf_ledger TO authenticated;
GRANT ALL ON public.purchase_payments TO service_role;
GRANT ALL ON public.purchase_iva_retentions TO service_role;
GRANT ALL ON public.purchase_islr_retentions TO service_role;
GRANT ALL ON public.purchase_igtf_ledger TO service_role;

ALTER TABLE public.purchase_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_iva_retentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_islr_retentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_igtf_ledger ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['purchase_payments','purchase_iva_retentions','purchase_islr_retentions','purchase_igtf_ledger'] LOOP
    EXECUTE format($f$
      CREATE POLICY %I ON public.%I FOR SELECT TO authenticated
      USING (public.is_company_member(auth.uid(), company_id));
    $f$, t||'_select', t);
    EXECUTE format($f$
      CREATE POLICY %I ON public.%I FOR INSERT TO authenticated
      WITH CHECK (public.company_has_role(auth.uid(), company_id, ARRAY['admin','contador','operador']::app_role[]));
    $f$, t||'_insert', t);
    EXECUTE format($f$
      CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated
      USING (public.company_has_role(auth.uid(), company_id, ARRAY['admin','contador']::app_role[]))
      WITH CHECK (public.company_has_role(auth.uid(), company_id, ARRAY['admin','contador']::app_role[]));
    $f$, t||'_update', t);
    EXECUTE format($f$
      CREATE POLICY %I ON public.%I FOR DELETE TO authenticated
      USING (public.company_has_role(auth.uid(), company_id, ARRAY['admin','contador']::app_role[]));
    $f$, t||'_delete', t);
  END LOOP;
END $$;
