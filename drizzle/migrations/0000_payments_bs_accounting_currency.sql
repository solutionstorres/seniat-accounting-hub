ALTER TABLE public.purchase_payments ADD COLUMN IF NOT EXISTS accounting_currency text NOT NULL DEFAULT 'USD' CHECK (accounting_currency IN ('USD','VES'));
ALTER TABLE public.sales_collections ADD COLUMN IF NOT EXISTS accounting_currency text NOT NULL DEFAULT 'USD' CHECK (accounting_currency IN ('USD','VES'));
COMMENT ON COLUMN public.purchase_payments.accounting_currency IS 'Accounting unit of amount_paid, retentions and IGTF. Legacy records retain USD behavior; new office payments use VES.';
COMMENT ON COLUMN public.sales_collections.accounting_currency IS 'Accounting unit of amount_collected, retentions and IGTF. Legacy records retain USD behavior; new collections use VES.';
DO $migration$
DECLARE d text; n text; h text; t text; fk text;
BEGIN
  FOREACH n IN ARRAY ARRAY['post_purchase_payment','post_sales_collection'] LOOP
    h := CASE WHEN n='post_purchase_payment' THEN 'pay' ELSE 'col' END;
    t := CASE WHEN n='post_purchase_payment' THEN 'purchase_payment_lines' ELSE 'sales_collection_lines' END;
    fk := CASE WHEN n='post_purchase_payment' THEN 'payment_id' ELSE 'collection_id' END;
    SELECT pg_get_functiondef(oid) INTO d FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname=n;
    d := replace(d, 'SUM(amount_usd)', 'SUM(CASE WHEN ' || h || '.accounting_currency = ''VES'' THEN CASE WHEN currency = ''VES'' THEN amount_currency ELSE round(amount_currency * exchange_rate, 2) END ELSE amount_usd END)');
    IF h='pay' THEN
      d := replace(d, 'l.account_id, 0, l.amount_usd,', 'l.account_id, 0, CASE WHEN pay.accounting_currency = ''VES'' THEN CASE WHEN l.currency = ''VES'' THEN l.amount_currency ELSE round(l.amount_currency * l.exchange_rate, 2) END ELSE l.amount_usd END,');
      d := replace(d, 'l.amount_usd, l.exchange_rate, l.amount_usd * l.exchange_rate, 3.00, l.igtf_amount', 'l.amount_usd, CASE WHEN pay.accounting_currency = ''VES'' THEN pay.exchange_rate ELSE l.exchange_rate END, CASE WHEN pay.accounting_currency = ''VES'' THEN round(l.amount_currency * l.exchange_rate,2) ELSE l.amount_usd * l.exchange_rate END, CASE WHEN pay.accounting_currency = ''VES'' THEN (SELECT igtf_rate FROM public.companies WHERE id=pay.company_id) ELSE 3.00 END, l.igtf_amount');
    ELSE
      d := replace(d, 'l.account_id, l.amount_usd, 0,', 'l.account_id, CASE WHEN col.accounting_currency = ''VES'' THEN CASE WHEN l.currency = ''VES'' THEN l.amount_currency ELSE round(l.amount_currency * l.exchange_rate, 2) END ELSE l.amount_usd END, 0,');
      d := replace(d, 'l.amount_usd, l.exchange_rate,', 'l.amount_usd, CASE WHEN col.accounting_currency = ''VES'' THEN col.exchange_rate ELSE l.exchange_rate END,');
      d := replace(d, 'l.amount_usd * l.exchange_rate, 3.00, l.igtf_amount', 'CASE WHEN col.accounting_currency = ''VES'' THEN round(l.amount_currency * l.exchange_rate,2) ELSE l.amount_usd * l.exchange_rate END, CASE WHEN col.accounting_currency = ''VES'' THEN (SELECT igtf_rate FROM public.companies WHERE id=col.company_id) ELSE 3.00 END, l.igtf_amount');
    END IF;
    EXECUTE d;
  END LOOP;
END
$migration$;