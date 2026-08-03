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
    is_nota_debito BOOLEAN := FALSE;
    v_doc_raw TEXT; v_entry_number BIGINT; v_doc_label TEXT;
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

    v_doc_raw := UPPER(COALESCE(NEW.document_type, 'FACTURA'));
    IF v_doc_raw LIKE '%CREDIT%' OR v_doc_raw = 'NC' THEN
      is_nota_credito := TRUE;
    ELSIF v_doc_raw LIKE '%DEBIT%' OR v_doc_raw = 'ND' THEN
      is_nota_debito := TRUE;
    END IF;

    v_doc_label := CASE WHEN is_nota_credito THEN 'Nota de crédito de compra N° '
                        WHEN is_nota_debito THEN 'Nota de débito de compra N° '
                        ELSE 'Factura de compra N° ' END;

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
      v_doc_label || NEW.invoice_number,
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