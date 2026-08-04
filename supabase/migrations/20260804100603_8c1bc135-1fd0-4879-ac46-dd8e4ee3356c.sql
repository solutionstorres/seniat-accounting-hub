ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS is_iva_withholding_agent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_islr_withholding_agent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS default_iva_withholding_rate numeric NOT NULL DEFAULT 75.00,
  ADD COLUMN IF NOT EXISTS default_islr_withholding_rate numeric NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS igtf_rate numeric NOT NULL DEFAULT 3.00;

ALTER TABLE public.purchase_payments
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS payment_account_id uuid REFERENCES public.chart_accounts(id),
  ADD COLUMN IF NOT EXISTS iva_retention_percentage numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS iva_retained_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS islr_retention_percentage numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS islr_retained_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS iva_retention_number text,
  ADD COLUMN IF NOT EXISTS islr_retention_number text,
  ADD COLUMN IF NOT EXISTS notes text;

CREATE TABLE IF NOT EXISTS public.purchase_payment_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  payment_id uuid NOT NULL REFERENCES public.purchase_payments(id) ON DELETE CASCADE,
  method public.payment_method_type NOT NULL DEFAULT 'efectivo',
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

GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_payment_lines TO authenticated;
GRANT ALL ON public.purchase_payment_lines TO service_role;

ALTER TABLE public.purchase_payment_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ppl_select" ON public.purchase_payment_lines FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "ppl_insert" ON public.purchase_payment_lines FOR INSERT TO authenticated
  WITH CHECK (public.company_has_role(auth.uid(), company_id, ARRAY['admin','contador','operador']::app_role[]));
CREATE POLICY "ppl_update" ON public.purchase_payment_lines FOR UPDATE TO authenticated
  USING (public.company_has_role(auth.uid(), company_id, ARRAY['admin','contador']::app_role[]))
  WITH CHECK (public.company_has_role(auth.uid(), company_id, ARRAY['admin','contador']::app_role[]));
CREATE POLICY "ppl_delete" ON public.purchase_payment_lines FOR DELETE TO authenticated
  USING (public.company_has_role(auth.uid(), company_id, ARRAY['admin','contador']::app_role[]));

CREATE TRIGGER trg_ppl_updated BEFORE UPDATE ON public.purchase_payment_lines
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_process_purchase_payment_journal_entry ON public.purchase_payments;

CREATE OR REPLACE FUNCTION public.post_purchase_payment(_payment_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  pay public.purchase_payments%ROWTYPE;
  inv public.purchase_invoices%ROWTYPE;
  sup public.suppliers%ROWTYPE;
  cfg public.company_accounting_configs%ROWTYPE;
  eid uuid; enum bigint; uid uuid;
  l RECORD;
  ln int := 1;
  total_lines numeric := 0;
  total_igtf numeric := 0;
  total_applied numeric := 0;
  ret_num text;
BEGIN
  SELECT * INTO pay FROM public.purchase_payments WHERE id = _payment_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pago no encontrado'; END IF;
  SELECT * INTO inv FROM public.purchase_invoices WHERE id = pay.invoice_id;
  SELECT * INTO sup FROM public.suppliers WHERE id = inv.supplier_id;
  SELECT * INTO cfg FROM public.company_accounting_configs WHERE company_id = pay.company_id;
  IF NOT FOUND OR cfg.default_supplier_pay_account_id IS NULL THEN
    RAISE EXCEPTION 'Configuración contable incompleta: falta la cuenta de Proveedores por Pagar.';
  END IF;

  DELETE FROM public.journal_entries WHERE source = 'purchase_invoice'::journal_source AND source_id = pay.id;
  DELETE FROM public.purchase_igtf_ledger WHERE payment_id = pay.id;

  SELECT COALESCE(SUM(amount_usd),0), COALESCE(SUM(igtf_amount),0)
    INTO total_lines, total_igtf
    FROM public.purchase_payment_lines WHERE payment_id = pay.id;

  IF total_lines = 0 THEN
    total_lines := COALESCE(pay.amount_paid,0);
    total_igtf := COALESCE(pay.igtf_amount,0);
  END IF;

  total_applied := total_lines + COALESCE(pay.iva_retained_amount,0) + COALESCE(pay.islr_retained_amount,0);

  enum := public.next_entry_number(pay.company_id);
  uid := COALESCE(auth.uid(), pay.created_by);

  INSERT INTO public.journal_entries(company_id, entry_number, entry_date, description, status, source, source_id, created_by)
  VALUES (pay.company_id, enum, pay.payment_date,
    'Pago factura de compra N° ' || COALESCE(inv.invoice_number,'S/N') || ' - ' || COALESCE(sup.name,''),
    'contabilizado'::journal_status, 'purchase_invoice'::journal_source, pay.id, uid)
  RETURNING id INTO eid;

  INSERT INTO public.journal_lines(entry_id, account_id, debit, credit, description, line_order)
  VALUES (eid, cfg.default_supplier_pay_account_id, total_applied, 0,
          'Amortización CxP factura ' || COALESCE(inv.invoice_number,'S/N'), ln);
  ln := ln + 1;

  FOR l IN SELECT * FROM public.purchase_payment_lines WHERE payment_id = pay.id ORDER BY line_order LOOP
    INSERT INTO public.journal_lines(entry_id, account_id, debit, credit, description, line_order)
    VALUES (eid, l.account_id, 0, l.amount_usd,
      'Egreso ' || l.method::text || ' ' || l.currency || ' Ref: ' || COALESCE(l.reference_number,'S/R'), ln);
    ln := ln + 1;

    IF l.apply_igtf AND l.igtf_amount > 0 THEN
      IF cfg.default_igtf_expense_account_id IS NULL OR cfg.default_igtf_pay_account_id IS NULL THEN
        RAISE EXCEPTION 'Configura las cuentas de Gasto IGTF e IGTF por Enterar.';
      END IF;
      INSERT INTO public.purchase_igtf_ledger(company_id,payment_id,operation_date,invoice_number,supplier_rif,supplier_name,
        payment_amount_usd,exchange_rate,base_amount_bs,igtf_rate,igtf_retained_bs)
      VALUES (pay.company_id, pay.id, pay.payment_date, COALESCE(inv.invoice_number,'S/N'), COALESCE(sup.rif,''), COALESCE(sup.name,''),
        l.amount_usd, l.exchange_rate, l.amount_usd * l.exchange_rate, 3.00, l.igtf_amount);
    END IF;
  END LOOP;

  IF total_lines > 0 AND NOT EXISTS (SELECT 1 FROM public.purchase_payment_lines WHERE payment_id = pay.id) THEN
    INSERT INTO public.journal_lines(entry_id, account_id, debit, credit, description, line_order)
    VALUES (eid, COALESCE(pay.payment_account_id, cfg.default_cash_account_id), 0, total_lines, 'Egreso por pago', ln);
    ln := ln + 1;
  END IF;

  IF total_igtf > 0 THEN
    INSERT INTO public.journal_lines(entry_id, account_id, debit, credit, description, line_order)
    VALUES (eid, cfg.default_igtf_expense_account_id, total_igtf, 0, 'Gasto IGTF 3% pago en divisas', ln);
    ln := ln + 1;
    INSERT INTO public.journal_lines(entry_id, account_id, debit, credit, description, line_order)
    VALUES (eid, cfg.default_igtf_pay_account_id, 0, total_igtf, 'IGTF por enterar 3%', ln);
    ln := ln + 1;
  END IF;

  IF COALESCE(pay.iva_retained_amount,0) > 0 THEN
    IF cfg.default_iva_retention_account_id IS NULL THEN
      RAISE EXCEPTION 'Configura la cuenta de Retenciones de IVA por Enterar.';
    END IF;
    ret_num := COALESCE(pay.iva_retention_number,
      to_char(pay.payment_date,'YYYYMM') || lpad(((SELECT COUNT(*) FROM public.purchase_iva_retentions r
        WHERE r.company_id = pay.company_id AND to_char(r.retention_date,'YYYYMM') = to_char(pay.payment_date,'YYYYMM')) + 1)::text, 8, '0'));
    INSERT INTO public.purchase_iva_retentions(company_id,invoice_id,retention_number,retention_date,retention_percentage,base_amount,iva_amount,retained_amount,created_by)
    VALUES (pay.company_id, pay.invoice_id, ret_num, pay.payment_date, pay.iva_retention_percentage,
            COALESCE(inv.base_amount,0), COALESCE(inv.iva_amount,0), pay.iva_retained_amount, uid);
    UPDATE public.purchase_payments SET iva_retention_number = ret_num WHERE id = pay.id;
    INSERT INTO public.journal_lines(entry_id, account_id, debit, credit, description, line_order)
    VALUES (eid, cfg.default_iva_retention_account_id, 0, pay.iva_retained_amount, 'Retención IVA comprobante N° ' || ret_num, ln);
    ln := ln + 1;
  END IF;

  IF COALESCE(pay.islr_retained_amount,0) > 0 THEN
    IF cfg.default_islr_retention_account_id IS NULL THEN
      RAISE EXCEPTION 'Configura la cuenta de Retenciones de ISLR por Enterar.';
    END IF;
    ret_num := COALESCE(pay.islr_retention_number,
      'ISLR-' || to_char(pay.payment_date,'YYYY') || '-' || lpad(((SELECT COUNT(*) FROM public.purchase_islr_retentions r
        WHERE r.company_id = pay.company_id AND EXTRACT(YEAR FROM r.retention_date) = EXTRACT(YEAR FROM pay.payment_date)) + 1)::text, 6, '0'));
    INSERT INTO public.purchase_islr_retentions(company_id,invoice_id,retention_number,retention_date,concept_code,retention_percentage,subtraction_amount,base_amount,retained_amount,created_by)
    VALUES (pay.company_id, pay.invoice_id, ret_num, pay.payment_date, COALESCE(inv.islr_concept_code,'000'),
            pay.islr_retention_percentage, 0, COALESCE(inv.base_amount,0), pay.islr_retained_amount, uid);
    UPDATE public.purchase_payments SET islr_retention_number = ret_num WHERE id = pay.id;
    INSERT INTO public.journal_lines(entry_id, account_id, debit, credit, description, line_order)
    VALUES (eid, cfg.default_islr_retention_account_id, 0, pay.islr_retained_amount, 'Retención ISLR comprobante N° ' || ret_num, ln);
  END IF;

  RETURN eid;
END;
$function$;