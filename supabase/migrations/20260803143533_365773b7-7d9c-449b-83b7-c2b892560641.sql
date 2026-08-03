
-- Helper: given an account, return the deepest single postable descendant (or itself if postable)
CREATE OR REPLACE FUNCTION public.resolve_postable_account(_account_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cur uuid := _account_id;
  is_p boolean;
  child uuid;
  n int;
BEGIN
  IF cur IS NULL THEN RETURN NULL; END IF;
  LOOP
    SELECT is_postable INTO is_p FROM public.chart_accounts WHERE id = cur;
    IF is_p IS NULL OR is_p THEN RETURN cur; END IF;
    SELECT count(*) INTO n FROM public.chart_accounts WHERE parent_id = cur AND active;
    IF n <> 1 THEN
      -- ambiguous or leafless: prefer the first postable child by code if any
      SELECT id INTO child FROM public.chart_accounts WHERE parent_id = cur AND active AND is_postable ORDER BY code LIMIT 1;
      IF child IS NULL THEN RETURN cur; END IF;
      RETURN child;
    END IF;
    SELECT id INTO child FROM public.chart_accounts WHERE parent_id = cur AND active LIMIT 1;
    cur := child;
  END LOOP;
END;
$$;

UPDATE public.company_accounting_configs SET
  default_purchase_account_id = public.resolve_postable_account(default_purchase_account_id),
  default_sales_account_id = public.resolve_postable_account(default_sales_account_id),
  default_iva_credit_account_id = public.resolve_postable_account(default_iva_credit_account_id),
  default_iva_debt_account_id = public.resolve_postable_account(default_iva_debt_account_id),
  default_supplier_pay_account_id = public.resolve_postable_account(default_supplier_pay_account_id),
  default_customer_collect_account_id = public.resolve_postable_account(default_customer_collect_account_id),
  default_iva_retention_account_id = public.resolve_postable_account(default_iva_retention_account_id),
  default_islr_retention_account_id = public.resolve_postable_account(default_islr_retention_account_id),
  default_cash_account_id = public.resolve_postable_account(default_cash_account_id),
  default_bank_account_id = public.resolve_postable_account(default_bank_account_id),
  default_usd_cash_account_id = public.resolve_postable_account(default_usd_cash_account_id),
  default_igtf_expense_account_id = public.resolve_postable_account(default_igtf_expense_account_id),
  default_igtf_pay_account_id = public.resolve_postable_account(default_igtf_pay_account_id);

UPDATE public.company_accounting_config SET
  sales_taxed_account = public.resolve_postable_account(sales_taxed_account),
  sales_exempt_account = public.resolve_postable_account(sales_exempt_account),
  iva_debit_account = public.resolve_postable_account(iva_debit_account),
  accounts_receivable = public.resolve_postable_account(accounts_receivable),
  purchases_account = public.resolve_postable_account(purchases_account),
  iva_credit_account = public.resolve_postable_account(iva_credit_account),
  accounts_payable = public.resolve_postable_account(accounts_payable),
  iva_wh_payable = public.resolve_postable_account(iva_wh_payable),
  iva_wh_receivable = public.resolve_postable_account(iva_wh_receivable),
  islr_wh_payable = public.resolve_postable_account(islr_wh_payable),
  islr_wh_receivable = public.resolve_postable_account(islr_wh_receivable),
  default_cash_account = public.resolve_postable_account(default_cash_account);

-- Regenerate existing automatic entries with corrected accounts
UPDATE public.purchase_invoices SET updated_at = now();
UPDATE public.sales_invoices SET updated_at = now();
