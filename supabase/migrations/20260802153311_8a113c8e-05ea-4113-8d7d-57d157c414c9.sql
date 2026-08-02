
-- 1) Reparar / completar configuración contable de compras por empresa
INSERT INTO public.company_accounting_configs (company_id)
SELECT c.id FROM public.companies c
WHERE NOT EXISTS (SELECT 1 FROM public.company_accounting_configs x WHERE x.company_id = c.id);

-- Anular cuentas que pertenezcan a otra empresa
UPDATE public.company_accounting_configs cfg SET
  default_purchase_account_id     = CASE WHEN a1.company_id = cfg.company_id THEN cfg.default_purchase_account_id END,
  default_iva_credit_account_id   = CASE WHEN a2.company_id = cfg.company_id THEN cfg.default_iva_credit_account_id END,
  default_supplier_pay_account_id = CASE WHEN a3.company_id = cfg.company_id THEN cfg.default_supplier_pay_account_id END,
  default_iva_retention_account_id  = CASE WHEN a4.company_id = cfg.company_id THEN cfg.default_iva_retention_account_id END,
  default_islr_retention_account_id = CASE WHEN a5.company_id = cfg.company_id THEN cfg.default_islr_retention_account_id END,
  default_cash_account_id         = CASE WHEN a6.company_id = cfg.company_id THEN cfg.default_cash_account_id END,
  default_bank_account_id         = CASE WHEN a7.company_id = cfg.company_id THEN cfg.default_bank_account_id END
FROM (SELECT 1) dummy
LEFT JOIN public.chart_accounts a1 ON FALSE
LEFT JOIN public.chart_accounts a2 ON FALSE
LEFT JOIN public.chart_accounts a3 ON FALSE
LEFT JOIN public.chart_accounts a4 ON FALSE
LEFT JOIN public.chart_accounts a5 ON FALSE
LEFT JOIN public.chart_accounts a6 ON FALSE
LEFT JOIN public.chart_accounts a7 ON FALSE
WHERE FALSE;

-- (forma simple y correcta de la limpieza anterior)
UPDATE public.company_accounting_configs cfg SET default_purchase_account_id = NULL
  WHERE default_purchase_account_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.chart_accounts a WHERE a.id = cfg.default_purchase_account_id AND a.company_id = cfg.company_id);
UPDATE public.company_accounting_configs cfg SET default_iva_credit_account_id = NULL
  WHERE default_iva_credit_account_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.chart_accounts a WHERE a.id = cfg.default_iva_credit_account_id AND a.company_id = cfg.company_id);
UPDATE public.company_accounting_configs cfg SET default_supplier_pay_account_id = NULL
  WHERE default_supplier_pay_account_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.chart_accounts a WHERE a.id = cfg.default_supplier_pay_account_id AND a.company_id = cfg.company_id);
UPDATE public.company_accounting_configs cfg SET default_iva_retention_account_id = NULL
  WHERE default_iva_retention_account_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.chart_accounts a WHERE a.id = cfg.default_iva_retention_account_id AND a.company_id = cfg.company_id);
UPDATE public.company_accounting_configs cfg SET default_islr_retention_account_id = NULL
  WHERE default_islr_retention_account_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.chart_accounts a WHERE a.id = cfg.default_islr_retention_account_id AND a.company_id = cfg.company_id);
UPDATE public.company_accounting_configs cfg SET default_cash_account_id = NULL
  WHERE default_cash_account_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.chart_accounts a WHERE a.id = cfg.default_cash_account_id AND a.company_id = cfg.company_id);
UPDATE public.company_accounting_configs cfg SET default_bank_account_id = NULL
  WHERE default_bank_account_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.chart_accounts a WHERE a.id = cfg.default_bank_account_id AND a.company_id = cfg.company_id);

-- Corregir el caso en que gasto/IVA/proveedor apuntan a la misma cuenta
UPDATE public.company_accounting_configs cfg SET
  default_iva_credit_account_id = NULL
  WHERE default_iva_credit_account_id IS NOT NULL AND default_iva_credit_account_id = default_purchase_account_id;
UPDATE public.company_accounting_configs cfg SET
  default_supplier_pay_account_id = NULL
  WHERE default_supplier_pay_account_id IS NOT NULL AND default_supplier_pay_account_id = default_purchase_account_id;

-- Completar desde la configuración de ventas (legacy) o por código de cuenta
UPDATE public.company_accounting_configs cfg SET
  default_purchase_account_id     = COALESCE(cfg.default_purchase_account_id, leg.purchases_account,      (SELECT id FROM public.chart_accounts a WHERE a.company_id=cfg.company_id AND a.is_postable AND a.code LIKE '5.1.01%' ORDER BY a.code LIMIT 1)),
  default_iva_credit_account_id   = COALESCE(cfg.default_iva_credit_account_id, leg.iva_credit_account,   (SELECT id FROM public.chart_accounts a WHERE a.company_id=cfg.company_id AND a.is_postable AND a.code LIKE '1.1.04%' ORDER BY a.code LIMIT 1)),
  default_supplier_pay_account_id = COALESCE(cfg.default_supplier_pay_account_id, leg.accounts_payable,   (SELECT id FROM public.chart_accounts a WHERE a.company_id=cfg.company_id AND a.is_postable AND a.code LIKE '2.1.01%' ORDER BY a.code LIMIT 1)),
  default_sales_account_id        = COALESCE(cfg.default_sales_account_id, leg.sales_taxed_account),
  default_iva_debt_account_id     = COALESCE(cfg.default_iva_debt_account_id, leg.iva_debit_account),
  default_customer_collect_account_id = COALESCE(cfg.default_customer_collect_account_id, leg.accounts_receivable),
  default_iva_retention_account_id  = COALESCE(cfg.default_iva_retention_account_id, leg.iva_wh_payable),
  default_islr_retention_account_id = COALESCE(cfg.default_islr_retention_account_id, leg.islr_wh_payable),
  default_cash_account_id         = COALESCE(cfg.default_cash_account_id, (SELECT id FROM public.chart_accounts a WHERE a.company_id=cfg.company_id AND a.is_postable AND a.code LIKE '1.1.01%' ORDER BY a.code LIMIT 1)),
  default_bank_account_id         = COALESCE(cfg.default_bank_account_id, leg.default_cash_account, (SELECT id FROM public.chart_accounts a WHERE a.company_id=cfg.company_id AND a.is_postable AND a.code LIKE '1.1.02%' ORDER BY a.code LIMIT 1))
FROM public.company_accounting_config leg
WHERE leg.company_id = cfg.company_id;

-- 2) Trigger de compras: validar configuración y avisar con mensaje claro
CREATE OR REPLACE FUNCTION public.process_purchase_invoice_journal_entry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    eid UUID; cfg RECORD;
    v_total NUMERIC; v_base NUMERIC; v_exempt NUMERIC; v_iva NUMERIC;
    is_nota_credito BOOLEAN := FALSE;
    v_doc_raw TEXT; v_entry_number BIGINT;
    v_iva_retained NUMERIC := 0.00; v_islr_retained NUMERIC := 0.00; v_net_supplier_pay NUMERIC := 0.00;
    v_ret_number_iva TEXT; v_ret_number_islr TEXT;
BEGIN
    DELETE FROM public.journal_entries WHERE source = 'purchase_invoice'::journal_source AND source_id = NEW.id;
    DELETE FROM public.purchase_iva_retentions WHERE invoice_id = NEW.id;
    DELETE FROM public.purchase_islr_retentions WHERE invoice_id = NEW.id;

    SELECT * INTO cfg FROM public.company_accounting_configs WHERE company_id = NEW.company_id;
    IF NOT FOUND OR cfg.default_purchase_account_id IS NULL OR cfg.default_iva_credit_account_id IS NULL OR cfg.default_supplier_pay_account_id IS NULL THEN
        RAISE EXCEPTION 'Configuración contable de compras incompleta: define las cuentas de Compras, IVA Crédito Fiscal y Proveedores por Pagar para esta empresa.';
    END IF;
    IF cfg.default_purchase_account_id = cfg.default_iva_credit_account_id
       OR cfg.default_purchase_account_id = cfg.default_supplier_pay_account_id
       OR cfg.default_iva_credit_account_id = cfg.default_supplier_pay_account_id THEN
        RAISE EXCEPTION 'Configuración contable inválida: las cuentas de Compras, IVA Crédito y Proveedores no pueden ser la misma.';
    END IF;

    v_doc_raw := COALESCE(NEW.document_type, 'FACTURA');
    IF v_doc_raw ILIKE '%CREDIT%' OR v_doc_raw ILIKE '%NC%' THEN is_nota_credito := TRUE; END IF;

    v_total := COALESCE(NEW.total_amount,0); v_base := COALESCE(NEW.base_amount,0);
    v_exempt := COALESCE(NEW.exempt_amount,0); v_iva := COALESCE(NEW.iva_amount,0);
    IF v_total <= 0 THEN RETURN NEW; END IF;

    IF COALESCE(NEW.apply_iva_retention,FALSE) AND NOT is_nota_credito AND v_iva > 0 THEN
        IF cfg.default_iva_retention_account_id IS NULL THEN
          RAISE EXCEPTION 'Falta configurar la cuenta de Retenciones de IVA por Enterar.';
        END IF;
        v_iva_retained := ROUND(v_iva * (COALESCE(NEW.iva_retention_percentage,75.00)/100.00),2);
        v_ret_number_iva := TO_CHAR(COALESCE(NEW.invoice_date,CURRENT_DATE),'YYYYMM') ||
          LPAD(((SELECT COUNT(*) FROM public.purchase_iva_retentions r WHERE r.company_id = NEW.company_id
                 AND TO_CHAR(r.retention_date,'YYYYMM') = TO_CHAR(COALESCE(NEW.invoice_date,CURRENT_DATE),'YYYYMM')) + 1)::text, 8, '0');
        INSERT INTO public.purchase_iva_retentions(company_id,invoice_id,retention_number,retention_date,retention_percentage,base_amount,iva_amount,retained_amount,created_by)
        VALUES(NEW.company_id,NEW.id,v_ret_number_iva,COALESCE(NEW.invoice_date,CURRENT_DATE),COALESCE(NEW.iva_retention_percentage,75.00),v_base,v_iva,v_iva_retained,NEW.created_by);
    END IF;

    IF COALESCE(NEW.apply_islr_retention,FALSE) AND NOT is_nota_credito AND v_base > 0 THEN
        v_islr_retained := ROUND(v_base * (COALESCE(NEW.islr_retention_percentage,0.00)/100.00),2);
        IF v_islr_retained > 0 THEN
            IF cfg.default_islr_retention_account_id IS NULL THEN
              RAISE EXCEPTION 'Falta configurar la cuenta de Retenciones de ISLR por Enterar.';
            END IF;
            v_ret_number_islr := 'ISLR-' || TO_CHAR(COALESCE(NEW.invoice_date,CURRENT_DATE),'YYYY') || '-' ||
              LPAD(((SELECT COUNT(*) FROM public.purchase_islr_retentions r WHERE r.company_id = NEW.company_id
                     AND EXTRACT(YEAR FROM r.retention_date) = EXTRACT(YEAR FROM COALESCE(NEW.invoice_date,CURRENT_DATE))) + 1)::text, 6, '0');
            INSERT INTO public.purchase_islr_retentions(company_id,invoice_id,retention_number,retention_date,concept_code,retention_percentage,subtraction_amount,base_amount,retained_amount,created_by)
            VALUES(NEW.company_id,NEW.id,v_ret_number_islr,COALESCE(NEW.invoice_date,CURRENT_DATE),COALESCE(NEW.islr_concept_code,'000'),COALESCE(NEW.islr_retention_percentage,0.00),0.00,v_base,v_islr_retained,NEW.created_by);
        END IF;
    END IF;

    v_net_supplier_pay := v_total - v_iva_retained - v_islr_retained;

    SELECT COALESCE(MAX(entry_number),0)+1 INTO v_entry_number FROM public.journal_entries WHERE company_id = NEW.company_id;

    INSERT INTO public.journal_entries(company_id,entry_number,entry_date,description,status,source,source_id,created_by)
    VALUES(NEW.company_id,v_entry_number,COALESCE(NEW.invoice_date,CURRENT_DATE),
      CASE WHEN is_nota_credito THEN 'Nota de crédito de compra N° ' ELSE 'Factura de compra N° ' END || NEW.invoice_number,
      'contabilizado'::journal_status,'purchase_invoice'::journal_source,NEW.id,NEW.created_by)
    RETURNING id INTO eid;

    IF is_nota_credito THEN
        INSERT INTO public.journal_lines(entry_id,account_id,debit,credit,description,line_order)
        VALUES(eid,cfg.default_supplier_pay_account_id,v_total,0,'Disminución CxP por NC '||NEW.invoice_number,1);
        IF (v_base + v_exempt) > 0 THEN
          INSERT INTO public.journal_lines(entry_id,account_id,debit,credit,description,line_order)
          VALUES(eid,cfg.default_purchase_account_id,0,v_base+v_exempt,'Reversión compras por NC',2);
        END IF;
        IF v_iva > 0 THEN
          INSERT INTO public.journal_lines(entry_id,account_id,debit,credit,description,line_order)
          VALUES(eid,cfg.default_iva_credit_account_id,0,v_iva,'Reversión IVA crédito fiscal por NC',3);
        END IF;
    ELSE
        IF (v_base + v_exempt) > 0 THEN
          INSERT INTO public.journal_lines(entry_id,account_id,debit,credit,description,line_order)
          VALUES(eid,cfg.default_purchase_account_id,v_base+v_exempt,0,'Compras doc '||NEW.invoice_number,1);
        END IF;
        IF v_iva > 0 THEN
          INSERT INTO public.journal_lines(entry_id,account_id,debit,credit,description,line_order)
          VALUES(eid,cfg.default_iva_credit_account_id,v_iva,0,'IVA crédito fiscal doc '||NEW.invoice_number,2);
        END IF;
        IF v_iva_retained > 0 THEN
          INSERT INTO public.journal_lines(entry_id,account_id,debit,credit,description,line_order)
          VALUES(eid,cfg.default_iva_retention_account_id,0,v_iva_retained,'Retención IVA comprobante N° '||v_ret_number_iva,3);
        END IF;
        IF v_islr_retained > 0 THEN
          INSERT INTO public.journal_lines(entry_id,account_id,debit,credit,description,line_order)
          VALUES(eid,cfg.default_islr_retention_account_id,0,v_islr_retained,'Retención ISLR comprobante N° '||v_ret_number_islr,4);
        END IF;
        INSERT INTO public.journal_lines(entry_id,account_id,debit,credit,description,line_order)
        VALUES(eid,cfg.default_supplier_pay_account_id,0,v_net_supplier_pay,'CxP neto proveedor doc '||NEW.invoice_number,5);
    END IF;

    RETURN NEW;
END;
$function$;

-- 3) Ventas: regenerar en INSERT y UPDATE, con validación clara
CREATE OR REPLACE FUNCTION public.post_sales_invoice_entry(_invoice_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  inv public.sales_invoices%ROWTYPE;
  cfg public.company_accounting_config%ROWTYPE;
  eid UUID; enum BIGINT; uid UUID;
BEGIN
  SELECT * INTO inv FROM public.sales_invoices WHERE id = _invoice_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  DELETE FROM public.journal_entries WHERE source = 'sales_invoice'::journal_source AND source_id = inv.id;

  SELECT * INTO cfg FROM public.company_accounting_config WHERE company_id = inv.company_id;
  IF NOT FOUND OR cfg.accounts_receivable IS NULL OR cfg.sales_taxed_account IS NULL OR cfg.iva_debit_account IS NULL THEN
    RAISE EXCEPTION 'Configuración contable de ventas incompleta: define Cuentas por Cobrar, Ventas Gravadas e IVA Débito Fiscal para esta empresa.';
  END IF;

  enum := public.next_entry_number(inv.company_id);
  uid := COALESCE(auth.uid(), inv.created_by);
  INSERT INTO public.journal_entries(company_id,entry_number,entry_date,description,source,source_id,status,created_by)
    VALUES(inv.company_id,enum,inv.invoice_date,'Factura de venta N° '||inv.invoice_number,'sales_invoice',inv.id,'contabilizado',uid)
    RETURNING id INTO eid;
  INSERT INTO public.journal_lines(entry_id,account_id,debit,credit,description,line_order)
    VALUES(eid,cfg.accounts_receivable,inv.total_amount,0,'CxC factura '||inv.invoice_number,1);
  IF inv.base_amount > 0 THEN
    INSERT INTO public.journal_lines(entry_id,account_id,debit,credit,description,line_order)
      VALUES(eid,cfg.sales_taxed_account,0,inv.base_amount,'Ventas gravadas',2);
  END IF;
  IF inv.exempt_amount > 0 AND cfg.sales_exempt_account IS NOT NULL THEN
    INSERT INTO public.journal_lines(entry_id,account_id,debit,credit,description,line_order)
      VALUES(eid,cfg.sales_exempt_account,0,inv.exempt_amount,'Ventas exentas',3);
  END IF;
  IF inv.iva_amount > 0 THEN
    INSERT INTO public.journal_lines(entry_id,account_id,debit,credit,description,line_order)
      VALUES(eid,cfg.iva_debit_account,0,inv.iva_amount,'IVA débito fiscal',4);
  END IF;
  RETURN eid;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sales_invoice_post ON public.sales_invoices;
CREATE TRIGGER trg_sales_invoice_post
AFTER INSERT OR UPDATE ON public.sales_invoices
FOR EACH ROW EXECUTE FUNCTION public.trg_sales_invoice_post();

-- 4) Borrado de factura => borrar su comprobante
CREATE OR REPLACE FUNCTION public.trg_invoice_delete_entry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  DELETE FROM public.journal_entries
   WHERE source = TG_ARGV[0]::journal_source AND source_id = OLD.id;
  RETURN OLD;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sales_invoice_delete ON public.sales_invoices;
CREATE TRIGGER trg_sales_invoice_delete BEFORE DELETE ON public.sales_invoices
FOR EACH ROW EXECUTE FUNCTION public.trg_invoice_delete_entry('sales_invoice');

DROP TRIGGER IF EXISTS trg_purchase_invoice_delete ON public.purchase_invoices;
CREATE TRIGGER trg_purchase_invoice_delete BEFORE DELETE ON public.purchase_invoices
FOR EACH ROW EXECUTE FUNCTION public.trg_invoice_delete_entry('purchase_invoice');

-- 5) Regenerar comprobantes existentes
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.sales_invoices LOOP
    PERFORM public.post_sales_invoice_entry(r.id);
  END LOOP;
  FOR r IN SELECT id FROM public.purchase_invoices LOOP
    UPDATE public.purchase_invoices SET updated_at = now() WHERE id = r.id;
  END LOOP;
END $$;
