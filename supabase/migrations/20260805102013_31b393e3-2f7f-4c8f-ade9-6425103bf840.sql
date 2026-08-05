
CREATE TABLE public.sales_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES public.sales_invoices(id) ON DELETE CASCADE,
  collection_date date NOT NULL DEFAULT CURRENT_DATE,
  collection_method payment_method_type NOT NULL DEFAULT 'efectivo',
  currency text NOT NULL DEFAULT 'USD',
  amount_collected numeric NOT NULL DEFAULT 0,
  amount_in_usd numeric NOT NULL DEFAULT 0,
  amount_in_bs numeric NOT NULL DEFAULT 0,
  exchange_rate numeric NOT NULL DEFAULT 1,
  apply_igtf boolean NOT NULL DEFAULT false,
  igtf_amount numeric NOT NULL DEFAULT 0,
  reference_number text,
  collection_account_id uuid REFERENCES public.chart_accounts(id),
  iva_retention_percentage numeric NOT NULL DEFAULT 0,
  iva_retained_amount numeric NOT NULL DEFAULT 0,
  islr_retention_percentage numeric NOT NULL DEFAULT 0,
  islr_retained_amount numeric NOT NULL DEFAULT 0,
  iva_retention_number text,
  islr_retention_number text,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_collections TO authenticated;
GRANT ALL ON public.sales_collections TO service_role;
ALTER TABLE public.sales_collections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sc_select" ON public.sales_collections FOR SELECT TO authenticated USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "sc_insert" ON public.sales_collections FOR INSERT TO authenticated WITH CHECK (public.company_has_role(auth.uid(), company_id, ARRAY['admin','contador','operador']::app_role[]));
CREATE POLICY "sc_update" ON public.sales_collections FOR UPDATE TO authenticated USING (public.company_has_role(auth.uid(), company_id, ARRAY['admin','contador']::app_role[]));
CREATE POLICY "sc_delete" ON public.sales_collections FOR DELETE TO authenticated USING (public.company_has_role(auth.uid(), company_id, ARRAY['admin','contador']::app_role[]));
CREATE TRIGGER trg_sc_updated BEFORE UPDATE ON public.sales_collections FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.sales_collection_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  collection_id uuid NOT NULL REFERENCES public.sales_collections(id) ON DELETE CASCADE,
  method payment_method_type NOT NULL DEFAULT 'efectivo',
  currency text NOT NULL DEFAULT 'USD',
  amount_currency numeric NOT NULL DEFAULT 0,
  exchange_rate numeric NOT NULL DEFAULT 1,
  amount_usd numeric NOT NULL DEFAULT 0,
  account_id uuid NOT NULL REFERENCES public.chart_accounts(id),
  apply_igtf boolean NOT NULL DEFAULT false,
  igtf_amount numeric NOT NULL DEFAULT 0,
  reference_number text,
  line_order integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_collection_lines TO authenticated;
GRANT ALL ON public.sales_collection_lines TO service_role;
ALTER TABLE public.sales_collection_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scl_select" ON public.sales_collection_lines FOR SELECT TO authenticated USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "scl_insert" ON public.sales_collection_lines FOR INSERT TO authenticated WITH CHECK (public.company_has_role(auth.uid(), company_id, ARRAY['admin','contador','operador']::app_role[]));
CREATE POLICY "scl_update" ON public.sales_collection_lines FOR UPDATE TO authenticated USING (public.company_has_role(auth.uid(), company_id, ARRAY['admin','contador']::app_role[]));
CREATE POLICY "scl_delete" ON public.sales_collection_lines FOR DELETE TO authenticated USING (public.company_has_role(auth.uid(), company_id, ARRAY['admin','contador']::app_role[]));
CREATE TRIGGER trg_scl_updated BEFORE UPDATE ON public.sales_collection_lines FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.sales_iva_retentions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES public.sales_invoices(id) ON DELETE CASCADE,
  collection_id uuid REFERENCES public.sales_collections(id) ON DELETE CASCADE,
  retention_number text NOT NULL,
  retention_date date NOT NULL,
  retention_percentage numeric NOT NULL DEFAULT 75,
  base_amount numeric NOT NULL DEFAULT 0,
  iva_amount numeric NOT NULL DEFAULT 0,
  retained_amount numeric NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_iva_retentions TO authenticated;
GRANT ALL ON public.sales_iva_retentions TO service_role;
ALTER TABLE public.sales_iva_retentions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sivr_select" ON public.sales_iva_retentions FOR SELECT TO authenticated USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "sivr_insert" ON public.sales_iva_retentions FOR INSERT TO authenticated WITH CHECK (public.company_has_role(auth.uid(), company_id, ARRAY['admin','contador','operador']::app_role[]));
CREATE POLICY "sivr_update" ON public.sales_iva_retentions FOR UPDATE TO authenticated USING (public.company_has_role(auth.uid(), company_id, ARRAY['admin','contador']::app_role[]));
CREATE POLICY "sivr_delete" ON public.sales_iva_retentions FOR DELETE TO authenticated USING (public.company_has_role(auth.uid(), company_id, ARRAY['admin','contador']::app_role[]));
CREATE TRIGGER trg_sivr_updated BEFORE UPDATE ON public.sales_iva_retentions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.sales_islr_retentions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES public.sales_invoices(id) ON DELETE CASCADE,
  collection_id uuid REFERENCES public.sales_collections(id) ON DELETE CASCADE,
  retention_number text NOT NULL,
  retention_date date NOT NULL,
  concept_code text NOT NULL DEFAULT '000',
  retention_percentage numeric NOT NULL DEFAULT 0,
  subtraction_amount numeric NOT NULL DEFAULT 0,
  base_amount numeric NOT NULL DEFAULT 0,
  retained_amount numeric NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_islr_retentions TO authenticated;
GRANT ALL ON public.sales_islr_retentions TO service_role;
ALTER TABLE public.sales_islr_retentions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sisr_select" ON public.sales_islr_retentions FOR SELECT TO authenticated USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "sisr_insert" ON public.sales_islr_retentions FOR INSERT TO authenticated WITH CHECK (public.company_has_role(auth.uid(), company_id, ARRAY['admin','contador','operador']::app_role[]));
CREATE POLICY "sisr_update" ON public.sales_islr_retentions FOR UPDATE TO authenticated USING (public.company_has_role(auth.uid(), company_id, ARRAY['admin','contador']::app_role[]));
CREATE POLICY "sisr_delete" ON public.sales_islr_retentions FOR DELETE TO authenticated USING (public.company_has_role(auth.uid(), company_id, ARRAY['admin','contador']::app_role[]));
CREATE TRIGGER trg_sisr_updated BEFORE UPDATE ON public.sales_islr_retentions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.sales_igtf_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  collection_id uuid NOT NULL REFERENCES public.sales_collections(id) ON DELETE CASCADE,
  operation_date date NOT NULL,
  invoice_number text NOT NULL,
  customer_rif text NOT NULL DEFAULT '',
  customer_name text NOT NULL DEFAULT '',
  collection_amount_usd numeric NOT NULL DEFAULT 0,
  exchange_rate numeric NOT NULL DEFAULT 1,
  base_amount_bs numeric NOT NULL DEFAULT 0,
  igtf_rate numeric NOT NULL DEFAULT 3,
  igtf_charged_bs numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_igtf_ledger TO authenticated;
GRANT ALL ON public.sales_igtf_ledger TO service_role;
ALTER TABLE public.sales_igtf_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sigl_select" ON public.sales_igtf_ledger FOR SELECT TO authenticated USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "sigl_insert" ON public.sales_igtf_ledger FOR INSERT TO authenticated WITH CHECK (public.company_has_role(auth.uid(), company_id, ARRAY['admin','contador','operador']::app_role[]));
CREATE POLICY "sigl_update" ON public.sales_igtf_ledger FOR UPDATE TO authenticated USING (public.company_has_role(auth.uid(), company_id, ARRAY['admin','contador']::app_role[]));
CREATE POLICY "sigl_delete" ON public.sales_igtf_ledger FOR DELETE TO authenticated USING (public.company_has_role(auth.uid(), company_id, ARRAY['admin','contador']::app_role[]));

CREATE OR REPLACE FUNCTION public.post_sales_collection(_collection_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  col public.sales_collections%ROWTYPE;
  inv public.sales_invoices%ROWTYPE;
  cus public.customers%ROWTYPE;
  cfg public.company_accounting_configs%ROWTYPE;
  lcfg public.company_accounting_config%ROWTYPE;
  eid uuid; enum bigint; uid uuid;
  l RECORD; ln int := 1;
  total_lines numeric := 0; total_igtf numeric := 0; total_applied numeric := 0;
  ar_account uuid; igtf_pay uuid; iva_recv uuid; islr_recv uuid;
  ret_num text;
BEGIN
  SELECT * INTO col FROM public.sales_collections WHERE id = _collection_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cobranza no encontrada'; END IF;
  SELECT * INTO inv FROM public.sales_invoices WHERE id = col.invoice_id;
  SELECT * INTO cus FROM public.customers WHERE id = inv.customer_id;
  SELECT * INTO cfg FROM public.company_accounting_configs WHERE company_id = col.company_id;
  SELECT * INTO lcfg FROM public.company_accounting_config WHERE company_id = col.company_id;

  ar_account := COALESCE(cfg.default_customer_collect_account_id, lcfg.accounts_receivable);
  IF ar_account IS NULL THEN
    RAISE EXCEPTION 'Configuración contable incompleta: falta la cuenta de Cuentas por Cobrar Clientes.';
  END IF;
  igtf_pay := COALESCE(cfg.default_igtf_pay_account_id, cfg.default_igtf_expense_account_id);
  iva_recv := lcfg.iva_wh_receivable;
  islr_recv := lcfg.islr_wh_receivable;

  DELETE FROM public.journal_entries WHERE source = 'sales_invoice'::journal_source AND source_id = col.id;
  DELETE FROM public.sales_igtf_ledger WHERE collection_id = col.id;
  DELETE FROM public.sales_iva_retentions WHERE collection_id = col.id;
  DELETE FROM public.sales_islr_retentions WHERE collection_id = col.id;

  SELECT COALESCE(SUM(amount_usd),0), COALESCE(SUM(igtf_amount),0)
    INTO total_lines, total_igtf
    FROM public.sales_collection_lines WHERE collection_id = col.id;

  IF total_lines = 0 THEN
    total_lines := COALESCE(col.amount_collected,0);
    total_igtf := COALESCE(col.igtf_amount,0);
  END IF;

  total_applied := total_lines + COALESCE(col.iva_retained_amount,0) + COALESCE(col.islr_retained_amount,0);

  enum := public.next_entry_number(col.company_id);
  uid := COALESCE(auth.uid(), col.created_by);

  INSERT INTO public.journal_entries(company_id, entry_number, entry_date, description, status, source, source_id, created_by)
  VALUES (col.company_id, enum, col.collection_date,
    'Cobro factura de venta N° ' || COALESCE(inv.invoice_number,'S/N') || ' - ' || COALESCE(cus.name,''),
    'contabilizado'::journal_status, 'sales_invoice'::journal_source, col.id, uid)
  RETURNING id INTO eid;

  IF EXISTS (SELECT 1 FROM public.sales_collection_lines WHERE collection_id = col.id) THEN
    FOR l IN SELECT * FROM public.sales_collection_lines WHERE collection_id = col.id ORDER BY line_order LOOP
      INSERT INTO public.journal_lines(entry_id, account_id, debit, credit, description, line_order)
      VALUES (eid, l.account_id, l.amount_usd, 0,
        'Ingreso ' || l.method::text || ' ' || l.currency || ' Ref: ' || COALESCE(l.reference_number,'S/R'), ln);
      ln := ln + 1;

      IF l.apply_igtf AND l.igtf_amount > 0 THEN
        INSERT INTO public.sales_igtf_ledger(company_id,collection_id,operation_date,invoice_number,customer_rif,customer_name,
          collection_amount_usd,exchange_rate,base_amount_bs,igtf_rate,igtf_charged_bs)
        VALUES (col.company_id, col.id, col.collection_date, COALESCE(inv.invoice_number,'S/N'),
          COALESCE(cus.rif,''), COALESCE(cus.name,''), l.amount_usd, l.exchange_rate,
          l.amount_usd * l.exchange_rate, 3.00, l.igtf_amount);
      END IF;
    END LOOP;
  ELSE
    INSERT INTO public.journal_lines(entry_id, account_id, debit, credit, description, line_order)
    VALUES (eid, COALESCE(col.collection_account_id, cfg.default_cash_account_id), total_lines, 0, 'Ingreso por cobro', ln);
    ln := ln + 1;
  END IF;

  IF COALESCE(col.iva_retained_amount,0) > 0 THEN
    IF iva_recv IS NULL THEN
      RAISE EXCEPTION 'Configura la cuenta de Retenciones de IVA por Cobrar.';
    END IF;
    ret_num := COALESCE(col.iva_retention_number,
      to_char(col.collection_date,'YYYYMM') || lpad(((SELECT COUNT(*) FROM public.sales_iva_retentions r
        WHERE r.company_id = col.company_id AND to_char(r.retention_date,'YYYYMM') = to_char(col.collection_date,'YYYYMM')) + 1)::text, 8, '0'));
    INSERT INTO public.sales_iva_retentions(company_id,invoice_id,collection_id,retention_number,retention_date,retention_percentage,base_amount,iva_amount,retained_amount,created_by)
    VALUES (col.company_id, col.invoice_id, col.id, ret_num, col.collection_date, col.iva_retention_percentage,
            COALESCE(inv.base_amount,0), COALESCE(inv.iva_amount,0), col.iva_retained_amount, uid);
    UPDATE public.sales_collections SET iva_retention_number = ret_num WHERE id = col.id;
    INSERT INTO public.journal_lines(entry_id, account_id, debit, credit, description, line_order)
    VALUES (eid, iva_recv, col.iva_retained_amount, 0, 'Retención IVA sufrida comprobante N° ' || ret_num, ln);
    ln := ln + 1;
  END IF;

  IF COALESCE(col.islr_retained_amount,0) > 0 THEN
    IF islr_recv IS NULL THEN
      RAISE EXCEPTION 'Configura la cuenta de Retenciones de ISLR por Cobrar.';
    END IF;
    ret_num := COALESCE(col.islr_retention_number,
      'ISLR-' || to_char(col.collection_date,'YYYY') || '-' || lpad(((SELECT COUNT(*) FROM public.sales_islr_retentions r
        WHERE r.company_id = col.company_id AND EXTRACT(YEAR FROM r.retention_date) = EXTRACT(YEAR FROM col.collection_date)) + 1)::text, 6, '0'));
    INSERT INTO public.sales_islr_retentions(company_id,invoice_id,collection_id,retention_number,retention_date,concept_code,retention_percentage,subtraction_amount,base_amount,retained_amount,created_by)
    VALUES (col.company_id, col.invoice_id, col.id, ret_num, col.collection_date, '000',
            col.islr_retention_percentage, 0, COALESCE(inv.base_amount,0), col.islr_retained_amount, uid);
    UPDATE public.sales_collections SET islr_retention_number = ret_num WHERE id = col.id;
    INSERT INTO public.journal_lines(entry_id, account_id, debit, credit, description, line_order)
    VALUES (eid, islr_recv, col.islr_retained_amount, 0, 'Retención ISLR sufrida comprobante N° ' || ret_num, ln);
    ln := ln + 1;
  END IF;

  INSERT INTO public.journal_lines(entry_id, account_id, debit, credit, description, line_order)
  VALUES (eid, ar_account, 0, total_applied,
          'Amortización CxC factura ' || COALESCE(inv.invoice_number,'S/N'), ln);
  ln := ln + 1;

  IF total_igtf > 0 THEN
    IF igtf_pay IS NULL THEN
      RAISE EXCEPTION 'Configura la cuenta de IGTF por Enterar.';
    END IF;
    INSERT INTO public.journal_lines(entry_id, account_id, debit, credit, description, line_order)
    VALUES (eid, COALESCE(col.collection_account_id, cfg.default_usd_cash_account_id, cfg.default_cash_account_id),
            total_igtf, 0, 'IGTF 3% cobrado en divisas', ln);
    ln := ln + 1;
    INSERT INTO public.journal_lines(entry_id, account_id, debit, credit, description, line_order)
    VALUES (eid, igtf_pay, 0, total_igtf, 'IGTF por enterar 3% sobre cobro en divisas', ln);
  END IF;

  RETURN eid;
END;
$function$;
