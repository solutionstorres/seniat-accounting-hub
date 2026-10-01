ALTER TABLE public.sales_invoices
  ADD COLUMN IF NOT EXISTS document_type text NOT NULL DEFAULT 'FACTURA',
  ADD COLUMN IF NOT EXISTS affected_invoice_number text,
  ADD COLUMN IF NOT EXISTS affected_control_number text;

CREATE OR REPLACE FUNCTION public.post_sales_invoice_entry(_invoice_id uuid)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  inv public.sales_invoices%ROWTYPE;
  cfg public.company_accounting_config%ROWTYPE;
  eid UUID; enum BIGINT; uid UUID;
  is_nc boolean; lbl text; ref text;
BEGIN
  SELECT * INTO inv FROM public.sales_invoices WHERE id = _invoice_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  DELETE FROM public.journal_entries WHERE source = 'sales_invoice'::journal_source AND source_id = inv.id;
  SELECT * INTO cfg FROM public.company_accounting_config WHERE company_id = inv.company_id;
  IF NOT FOUND OR cfg.accounts_receivable IS NULL OR cfg.sales_taxed_account IS NULL OR cfg.iva_debit_account IS NULL THEN
    RAISE EXCEPTION 'Configuración contable de ventas incompleta: define Cuentas por Cobrar, Ventas Gravadas e IVA Débito Fiscal para esta empresa.';
  END IF;

  is_nc := upper(coalesce(inv.document_type,'FACTURA')) LIKE '%CREDITO%';
  lbl := CASE WHEN is_nc THEN 'Nota de crédito venta'
              WHEN upper(coalesce(inv.document_type,'')) LIKE '%DEBITO%' THEN 'Nota de débito venta'
              ELSE 'Factura de venta' END;
  ref := CASE WHEN inv.affected_invoice_number IS NOT NULL THEN ' (afecta '||inv.affected_invoice_number||')' ELSE '' END;

  enum := public.next_entry_number(inv.company_id);
  uid := COALESCE(auth.uid(), inv.created_by);
  INSERT INTO public.journal_entries(company_id,entry_number,entry_date,description,source,source_id,status,created_by)
    VALUES(inv.company_id,enum,inv.invoice_date,lbl||' N° '||inv.invoice_number||ref,'sales_invoice',inv.id,'contabilizado',uid)
    RETURNING id INTO eid;

  INSERT INTO public.journal_lines(entry_id,account_id,debit,credit,description,line_order)
    VALUES(eid,cfg.accounts_receivable,
      CASE WHEN is_nc THEN 0 ELSE inv.total_amount END,
      CASE WHEN is_nc THEN inv.total_amount ELSE 0 END,
      'CxC '||lbl||' '||inv.invoice_number,1);
  IF inv.base_amount > 0 THEN
    INSERT INTO public.journal_lines(entry_id,account_id,debit,credit,description,line_order,cost_center_id)
      VALUES(eid,cfg.sales_taxed_account,
        CASE WHEN is_nc THEN inv.base_amount ELSE 0 END,
        CASE WHEN is_nc THEN 0 ELSE inv.base_amount END,
        CASE WHEN is_nc THEN 'Devolución ventas gravadas' ELSE 'Ventas gravadas' END,2,inv.cost_center_id);
  END IF;
  IF inv.exempt_amount > 0 THEN
    INSERT INTO public.journal_lines(entry_id,account_id,debit,credit,description,line_order,cost_center_id)
      VALUES(eid,COALESCE(cfg.sales_exempt_account,cfg.sales_taxed_account),
        CASE WHEN is_nc THEN inv.exempt_amount ELSE 0 END,
        CASE WHEN is_nc THEN 0 ELSE inv.exempt_amount END,
        CASE WHEN is_nc THEN 'Devolución ventas exentas' ELSE 'Ventas exentas' END,3,inv.cost_center_id);
  END IF;
  IF inv.iva_amount > 0 THEN
    INSERT INTO public.journal_lines(entry_id,account_id,debit,credit,description,line_order)
      VALUES(eid,cfg.iva_debit_account,
        CASE WHEN is_nc THEN inv.iva_amount ELSE 0 END,
        CASE WHEN is_nc THEN 0 ELSE inv.iva_amount END,
        'IVA débito fiscal',4);
  END IF;
  RETURN eid;
END;
$function$;