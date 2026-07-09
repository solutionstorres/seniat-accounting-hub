
CREATE OR REPLACE FUNCTION public.post_withholding_entry(_wh_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  wh public.withholdings%ROWTYPE;
  cfg public.company_accounting_config%ROWTYPE;
  eid UUID; enum BIGINT; uid UUID;
  debit_acc UUID; credit_acc UUID;
BEGIN
  SELECT * INTO wh FROM public.withholdings WHERE id = _wh_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT * INTO cfg FROM public.company_accounting_config WHERE company_id = wh.company_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  IF wh.type::text = 'iva' THEN
    debit_acc := cfg.accounts_payable;
    credit_acc := cfg.iva_wh_payable;
  ELSE
    debit_acc := cfg.accounts_payable;
    credit_acc := cfg.islr_wh_payable;
  END IF;
  IF debit_acc IS NULL OR credit_acc IS NULL THEN RETURN NULL; END IF;

  enum := public.next_entry_number(wh.company_id);
  uid := COALESCE(auth.uid(), wh.created_by);
  INSERT INTO public.journal_entries(company_id,entry_number,entry_date,description,source,source_id,status,created_by)
    VALUES(wh.company_id,enum,wh.withholding_date,'Retención '||wh.type::text||' N° '||wh.receipt_number,'withholding',wh.id,'contabilizado',uid)
    RETURNING id INTO eid;
  INSERT INTO public.journal_lines(entry_id,account_id,debit,credit,description,line_order)
    VALUES(eid,debit_acc,wh.amount,0,'Retención aplicada',1);
  INSERT INTO public.journal_lines(entry_id,account_id,debit,credit,description,line_order)
    VALUES(eid,credit_acc,0,wh.amount,'Retención por pagar',2);
  RETURN eid;
END; $$;
