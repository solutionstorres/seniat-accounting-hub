
-- 1. Nuevos campos en la tabla canónica
ALTER TABLE public.company_accounting_configs
  ADD COLUMN IF NOT EXISTS default_sales_exempt_account_id uuid REFERENCES public.chart_accounts(id),
  ADD COLUMN IF NOT EXISTS default_accounts_receivable_id uuid REFERENCES public.chart_accounts(id),
  ADD COLUMN IF NOT EXISTS default_accounts_payable_id uuid REFERENCES public.chart_accounts(id),
  ADD COLUMN IF NOT EXISTS default_iva_wh_receivable_account_id uuid REFERENCES public.chart_accounts(id),
  ADD COLUMN IF NOT EXISTS default_islr_wh_receivable_account_id uuid REFERENCES public.chart_accounts(id);

-- 2. Traslado de datos desde la tabla antigua (sin pisar valores ya definidos)
INSERT INTO public.company_accounting_configs (
  company_id, default_sales_account_id, default_sales_exempt_account_id,
  default_iva_debt_account_id, default_accounts_receivable_id,
  default_purchase_account_id, default_iva_credit_account_id,
  default_accounts_payable_id, default_iva_retention_account_id,
  default_iva_wh_receivable_account_id, default_islr_retention_account_id,
  default_islr_wh_receivable_account_id, default_cash_account_id)
SELECT s.company_id, s.sales_taxed_account, s.sales_exempt_account,
       s.iva_debit_account, s.accounts_receivable,
       s.purchases_account, s.iva_credit_account,
       s.accounts_payable, s.iva_wh_payable,
       s.iva_wh_receivable, s.islr_wh_payable,
       s.islr_wh_receivable, s.default_cash_account
FROM public.company_accounting_config s
ON CONFLICT (company_id) DO UPDATE SET
  default_sales_account_id = COALESCE(public.company_accounting_configs.default_sales_account_id, EXCLUDED.default_sales_account_id),
  default_sales_exempt_account_id = COALESCE(public.company_accounting_configs.default_sales_exempt_account_id, EXCLUDED.default_sales_exempt_account_id),
  default_iva_debt_account_id = COALESCE(public.company_accounting_configs.default_iva_debt_account_id, EXCLUDED.default_iva_debt_account_id),
  default_accounts_receivable_id = COALESCE(public.company_accounting_configs.default_accounts_receivable_id, EXCLUDED.default_accounts_receivable_id),
  default_purchase_account_id = COALESCE(public.company_accounting_configs.default_purchase_account_id, EXCLUDED.default_purchase_account_id),
  default_iva_credit_account_id = COALESCE(public.company_accounting_configs.default_iva_credit_account_id, EXCLUDED.default_iva_credit_account_id),
  default_accounts_payable_id = COALESCE(public.company_accounting_configs.default_accounts_payable_id, EXCLUDED.default_accounts_payable_id),
  default_iva_retention_account_id = COALESCE(public.company_accounting_configs.default_iva_retention_account_id, EXCLUDED.default_iva_retention_account_id),
  default_iva_wh_receivable_account_id = COALESCE(public.company_accounting_configs.default_iva_wh_receivable_account_id, EXCLUDED.default_iva_wh_receivable_account_id),
  default_islr_retention_account_id = COALESCE(public.company_accounting_configs.default_islr_retention_account_id, EXCLUDED.default_islr_retention_account_id),
  default_islr_wh_receivable_account_id = COALESCE(public.company_accounting_configs.default_islr_wh_receivable_account_id, EXCLUDED.default_islr_wh_receivable_account_id),
  default_cash_account_id = COALESCE(public.company_accounting_configs.default_cash_account_id, EXCLUDED.default_cash_account_id),
  updated_at = now();

-- 3. La tabla antigua pasa a ser un reflejo de solo lectura
DROP TABLE public.company_accounting_config;

CREATE VIEW public.company_accounting_config
WITH (security_invoker = true) AS
SELECT
  c.company_id,
  c.default_sales_account_id            AS sales_taxed_account,
  c.default_sales_exempt_account_id     AS sales_exempt_account,
  c.default_iva_debt_account_id         AS iva_debit_account,
  c.default_accounts_receivable_id      AS accounts_receivable,
  c.default_purchase_account_id         AS purchases_account,
  c.default_iva_credit_account_id       AS iva_credit_account,
  c.default_accounts_payable_id         AS accounts_payable,
  c.default_iva_retention_account_id    AS iva_wh_payable,
  c.default_iva_wh_receivable_account_id  AS iva_wh_receivable,
  c.default_islr_retention_account_id   AS islr_wh_payable,
  c.default_islr_wh_receivable_account_id AS islr_wh_receivable,
  c.default_cash_account_id             AS default_cash_account,
  c.created_at,
  c.updated_at
FROM public.company_accounting_configs c;

GRANT SELECT ON public.company_accounting_config TO authenticated;
GRANT SELECT ON public.company_accounting_config TO service_role;

-- 4. La carga del plan estándar escribe en la tabla canónica
CREATE OR REPLACE FUNCTION public.seed_chart_of_accounts(_company_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_a1 UUID; v_a11 UUID; v_a12 UUID;
  v_p1 UUID; v_p11 UUID;
  v_pat UUID;
  v_ing UUID; v_cos UUID; v_gas UUID;
  v_caja UUID; v_bcos UUID; v_cxc UUID; v_ivac UUID; v_ivwc UUID; v_islrwc UUID;
  v_cxp UUID; v_ivad UUID; v_ivwp UUID; v_islrwp UUID;
  v_capital UUID; v_result UUID;
  v_vg UUID; v_ve UUID;
  v_comp UUID; v_gserv UUID;
BEGIN
  IF EXISTS (SELECT 1 FROM public.chart_accounts WHERE company_id = _company_id) THEN
    RETURN;
  END IF;

  INSERT INTO chart_accounts(company_id,code,name,account_type,nature,level,is_postable)
    VALUES(_company_id,'1','ACTIVO','activo','deudora',1,false) RETURNING id INTO v_a1;
  INSERT INTO chart_accounts(company_id,parent_id,code,name,account_type,nature,level,is_postable)
    VALUES(_company_id,v_a1,'1.1','Activo Circulante','activo','deudora',2,false) RETURNING id INTO v_a11;
  INSERT INTO chart_accounts(company_id,parent_id,code,name,account_type,nature,level,is_postable)
    VALUES(_company_id,v_a11,'1.1.01','Caja','activo','deudora',3,true) RETURNING id INTO v_caja;
  INSERT INTO chart_accounts(company_id,parent_id,code,name,account_type,nature,level,is_postable)
    VALUES(_company_id,v_a11,'1.1.02','Bancos','activo','deudora',3,true) RETURNING id INTO v_bcos;
  INSERT INTO chart_accounts(company_id,parent_id,code,name,account_type,nature,level,is_postable)
    VALUES(_company_id,v_a11,'1.1.03','Cuentas por Cobrar Clientes','activo','deudora',3,true) RETURNING id INTO v_cxc;
  INSERT INTO chart_accounts(company_id,parent_id,code,name,account_type,nature,level,is_postable)
    VALUES(_company_id,v_a11,'1.1.04','IVA Crédito Fiscal','activo','deudora',3,true) RETURNING id INTO v_ivac;
  INSERT INTO chart_accounts(company_id,parent_id,code,name,account_type,nature,level,is_postable)
    VALUES(_company_id,v_a11,'1.1.05','Retenciones IVA por Cobrar','activo','deudora',3,true) RETURNING id INTO v_ivwc;
  INSERT INTO chart_accounts(company_id,parent_id,code,name,account_type,nature,level,is_postable)
    VALUES(_company_id,v_a11,'1.1.06','Retenciones ISLR por Cobrar','activo','deudora',3,true) RETURNING id INTO v_islrwc;
  INSERT INTO chart_accounts(company_id,parent_id,code,name,account_type,nature,level,is_postable)
    VALUES(_company_id,v_a1,'1.2','Activo Fijo','activo','deudora',2,false) RETURNING id INTO v_a12;

  INSERT INTO chart_accounts(company_id,code,name,account_type,nature,level,is_postable)
    VALUES(_company_id,'2','PASIVO','pasivo','acreedora',1,false) RETURNING id INTO v_p1;
  INSERT INTO chart_accounts(company_id,parent_id,code,name,account_type,nature,level,is_postable)
    VALUES(_company_id,v_p1,'2.1','Pasivo Circulante','pasivo','acreedora',2,false) RETURNING id INTO v_p11;
  INSERT INTO chart_accounts(company_id,parent_id,code,name,account_type,nature,level,is_postable)
    VALUES(_company_id,v_p11,'2.1.01','Cuentas por Pagar Proveedores','pasivo','acreedora',3,true) RETURNING id INTO v_cxp;
  INSERT INTO chart_accounts(company_id,parent_id,code,name,account_type,nature,level,is_postable)
    VALUES(_company_id,v_p11,'2.1.02','IVA Débito Fiscal','pasivo','acreedora',3,true) RETURNING id INTO v_ivad;
  INSERT INTO chart_accounts(company_id,parent_id,code,name,account_type,nature,level,is_postable)
    VALUES(_company_id,v_p11,'2.1.03','Retenciones IVA por Pagar','pasivo','acreedora',3,true) RETURNING id INTO v_ivwp;
  INSERT INTO chart_accounts(company_id,parent_id,code,name,account_type,nature,level,is_postable)
    VALUES(_company_id,v_p11,'2.1.04','Retenciones ISLR por Pagar','pasivo','acreedora',3,true) RETURNING id INTO v_islrwp;

  INSERT INTO chart_accounts(company_id,code,name,account_type,nature,level,is_postable)
    VALUES(_company_id,'3','PATRIMONIO','patrimonio','acreedora',1,false) RETURNING id INTO v_pat;
  INSERT INTO chart_accounts(company_id,parent_id,code,name,account_type,nature,level,is_postable)
    VALUES(_company_id,v_pat,'3.1.01','Capital Social','patrimonio','acreedora',3,true) RETURNING id INTO v_capital;
  INSERT INTO chart_accounts(company_id,parent_id,code,name,account_type,nature,level,is_postable)
    VALUES(_company_id,v_pat,'3.2.01','Resultados Acumulados','patrimonio','acreedora',3,true) RETURNING id INTO v_result;

  INSERT INTO chart_accounts(company_id,code,name,account_type,nature,level,is_postable)
    VALUES(_company_id,'4','INGRESOS','ingreso','acreedora',1,false) RETURNING id INTO v_ing;
  INSERT INTO chart_accounts(company_id,parent_id,code,name,account_type,nature,level,is_postable)
    VALUES(_company_id,v_ing,'4.1.01','Ventas Gravadas','ingreso','acreedora',3,true) RETURNING id INTO v_vg;
  INSERT INTO chart_accounts(company_id,parent_id,code,name,account_type,nature,level,is_postable)
    VALUES(_company_id,v_ing,'4.1.02','Ventas Exentas','ingreso','acreedora',3,true) RETURNING id INTO v_ve;

  INSERT INTO chart_accounts(company_id,code,name,account_type,nature,level,is_postable)
    VALUES(_company_id,'5','COSTOS','costo','deudora',1,false) RETURNING id INTO v_cos;
  INSERT INTO chart_accounts(company_id,parent_id,code,name,account_type,nature,level,is_postable)
    VALUES(_company_id,v_cos,'5.1.01','Compras','costo','deudora',3,true) RETURNING id INTO v_comp;

  INSERT INTO chart_accounts(company_id,code,name,account_type,nature,level,is_postable)
    VALUES(_company_id,'6','GASTOS','gasto','deudora',1,false) RETURNING id INTO v_gas;
  INSERT INTO chart_accounts(company_id,parent_id,code,name,account_type,nature,level,is_postable)
    VALUES(_company_id,v_gas,'6.1.01','Gastos Generales','gasto','deudora',3,true) RETURNING id INTO v_gserv;

  INSERT INTO company_accounting_configs(company_id,
    default_sales_account_id, default_sales_exempt_account_id, default_iva_debt_account_id,
    default_accounts_receivable_id, default_purchase_account_id, default_iva_credit_account_id,
    default_accounts_payable_id, default_iva_retention_account_id, default_iva_wh_receivable_account_id,
    default_islr_retention_account_id, default_islr_wh_receivable_account_id,
    default_cash_account_id, default_bank_account_id, default_customer_collect_account_id,
    default_supplier_pay_account_id)
  VALUES(_company_id, v_vg, v_ve, v_ivad, v_cxc, v_comp, v_ivac, v_cxp, v_ivwp, v_ivwc,
         v_islrwp, v_islrwc, v_caja, v_bcos, v_bcos, v_bcos)
  ON CONFLICT (company_id) DO UPDATE SET
    default_sales_account_id = EXCLUDED.default_sales_account_id,
    default_sales_exempt_account_id = EXCLUDED.default_sales_exempt_account_id,
    default_iva_debt_account_id = EXCLUDED.default_iva_debt_account_id,
    default_accounts_receivable_id = EXCLUDED.default_accounts_receivable_id,
    default_purchase_account_id = EXCLUDED.default_purchase_account_id,
    default_iva_credit_account_id = EXCLUDED.default_iva_credit_account_id,
    default_accounts_payable_id = EXCLUDED.default_accounts_payable_id,
    default_iva_retention_account_id = EXCLUDED.default_iva_retention_account_id,
    default_iva_wh_receivable_account_id = EXCLUDED.default_iva_wh_receivable_account_id,
    default_islr_retention_account_id = EXCLUDED.default_islr_retention_account_id,
    default_islr_wh_receivable_account_id = EXCLUDED.default_islr_wh_receivable_account_id,
    default_cash_account_id = COALESCE(public.company_accounting_configs.default_cash_account_id, EXCLUDED.default_cash_account_id),
    default_bank_account_id = COALESCE(public.company_accounting_configs.default_bank_account_id, EXCLUDED.default_bank_account_id),
    default_customer_collect_account_id = COALESCE(public.company_accounting_configs.default_customer_collect_account_id, EXCLUDED.default_customer_collect_account_id),
    default_supplier_pay_account_id = COALESCE(public.company_accounting_configs.default_supplier_pay_account_id, EXCLUDED.default_supplier_pay_account_id),
    updated_at = now();
END;
$function$;
