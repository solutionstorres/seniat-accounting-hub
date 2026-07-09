
-- ============ ENUMS ============
CREATE TYPE public.account_type AS ENUM ('activo','pasivo','patrimonio','ingreso','costo','gasto','orden');
CREATE TYPE public.account_nature AS ENUM ('deudora','acreedora');
CREATE TYPE public.journal_source AS ENUM ('manual','sales_invoice','purchase_invoice','withholding');
CREATE TYPE public.journal_status AS ENUM ('borrador','contabilizado','anulado');

-- ============ CHART OF ACCOUNTS ============
CREATE TABLE public.chart_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.chart_accounts(id) ON DELETE RESTRICT,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  account_type public.account_type NOT NULL,
  nature public.account_nature NOT NULL,
  level INT NOT NULL DEFAULT 1,
  is_postable BOOLEAN NOT NULL DEFAULT true,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, code)
);
CREATE INDEX idx_chart_accounts_company ON public.chart_accounts(company_id);
CREATE INDEX idx_chart_accounts_parent ON public.chart_accounts(parent_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chart_accounts TO authenticated;
GRANT ALL ON public.chart_accounts TO service_role;
ALTER TABLE public.chart_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read chart" ON public.chart_accounts FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "write chart" ON public.chart_accounts FOR INSERT TO authenticated
  WITH CHECK (public.company_has_role(auth.uid(), company_id, ARRAY['admin','contador']::app_role[]));
CREATE POLICY "update chart" ON public.chart_accounts FOR UPDATE TO authenticated
  USING (public.company_has_role(auth.uid(), company_id, ARRAY['admin','contador']::app_role[]));
CREATE POLICY "delete chart" ON public.chart_accounts FOR DELETE TO authenticated
  USING (public.company_has_role(auth.uid(), company_id, ARRAY['admin']::app_role[]));

CREATE TRIGGER trg_chart_accounts_updated BEFORE UPDATE ON public.chart_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ ACCOUNTING CONFIG ============
CREATE TABLE public.company_accounting_config (
  company_id UUID PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  sales_taxed_account UUID REFERENCES public.chart_accounts(id),
  sales_exempt_account UUID REFERENCES public.chart_accounts(id),
  iva_debit_account UUID REFERENCES public.chart_accounts(id),
  accounts_receivable UUID REFERENCES public.chart_accounts(id),
  purchases_account UUID REFERENCES public.chart_accounts(id),
  iva_credit_account UUID REFERENCES public.chart_accounts(id),
  accounts_payable UUID REFERENCES public.chart_accounts(id),
  iva_wh_payable UUID REFERENCES public.chart_accounts(id),
  iva_wh_receivable UUID REFERENCES public.chart_accounts(id),
  islr_wh_payable UUID REFERENCES public.chart_accounts(id),
  islr_wh_receivable UUID REFERENCES public.chart_accounts(id),
  default_cash_account UUID REFERENCES public.chart_accounts(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_accounting_config TO authenticated;
GRANT ALL ON public.company_accounting_config TO service_role;
ALTER TABLE public.company_accounting_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read cfg" ON public.company_accounting_config FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "write cfg" ON public.company_accounting_config FOR INSERT TO authenticated
  WITH CHECK (public.company_has_role(auth.uid(), company_id, ARRAY['admin','contador']::app_role[]));
CREATE POLICY "update cfg" ON public.company_accounting_config FOR UPDATE TO authenticated
  USING (public.company_has_role(auth.uid(), company_id, ARRAY['admin','contador']::app_role[]));
CREATE TRIGGER trg_cfg_updated BEFORE UPDATE ON public.company_accounting_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ JOURNAL ENTRIES ============
CREATE TABLE public.journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  entry_number BIGINT NOT NULL,
  entry_date DATE NOT NULL,
  description TEXT NOT NULL,
  source public.journal_source NOT NULL DEFAULT 'manual',
  source_id UUID,
  status public.journal_status NOT NULL DEFAULT 'borrador',
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, entry_number)
);
CREATE INDEX idx_je_company_date ON public.journal_entries(company_id, entry_date);
CREATE INDEX idx_je_source ON public.journal_entries(source, source_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.journal_entries TO authenticated;
GRANT ALL ON public.journal_entries TO service_role;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read je" ON public.journal_entries FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "ins je" ON public.journal_entries FOR INSERT TO authenticated
  WITH CHECK (public.company_has_role(auth.uid(), company_id, ARRAY['admin','contador']::app_role[]));
CREATE POLICY "upd je" ON public.journal_entries FOR UPDATE TO authenticated
  USING (public.company_has_role(auth.uid(), company_id, ARRAY['admin','contador']::app_role[]));
CREATE POLICY "del je" ON public.journal_entries FOR DELETE TO authenticated
  USING (public.company_has_role(auth.uid(), company_id, ARRAY['admin']::app_role[]));
CREATE TRIGGER trg_je_updated BEFORE UPDATE ON public.journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ JOURNAL LINES ============
CREATE TABLE public.journal_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.chart_accounts(id) ON DELETE RESTRICT,
  debit NUMERIC(18,2) NOT NULL DEFAULT 0,
  credit NUMERIC(18,2) NOT NULL DEFAULT 0,
  description TEXT,
  line_order INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_jl_entry ON public.journal_lines(entry_id);
CREATE INDEX idx_jl_account ON public.journal_lines(account_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.journal_lines TO authenticated;
GRANT ALL ON public.journal_lines TO service_role;
ALTER TABLE public.journal_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read jl" ON public.journal_lines FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.journal_entries e
    WHERE e.id = entry_id AND public.is_company_member(auth.uid(), e.company_id)));
CREATE POLICY "ins jl" ON public.journal_lines FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.journal_entries e
    WHERE e.id = entry_id AND public.company_has_role(auth.uid(), e.company_id, ARRAY['admin','contador']::app_role[])));
CREATE POLICY "upd jl" ON public.journal_lines FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.journal_entries e
    WHERE e.id = entry_id AND public.company_has_role(auth.uid(), e.company_id, ARRAY['admin','contador']::app_role[])));
CREATE POLICY "del jl" ON public.journal_lines FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.journal_entries e
    WHERE e.id = entry_id AND public.company_has_role(auth.uid(), e.company_id, ARRAY['admin','contador']::app_role[])));

-- ============ NEXT ENTRY NUMBER ============
CREATE OR REPLACE FUNCTION public.next_entry_number(_company_id UUID)
RETURNS BIGINT LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(MAX(entry_number), 0) + 1 FROM public.journal_entries WHERE company_id = _company_id;
$$;

-- ============ SEED CHART OF ACCOUNTS ============
CREATE OR REPLACE FUNCTION public.seed_chart_of_accounts(_company_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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

  -- ACTIVO
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

  -- PASIVO
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

  -- PATRIMONIO
  INSERT INTO chart_accounts(company_id,code,name,account_type,nature,level,is_postable)
    VALUES(_company_id,'3','PATRIMONIO','patrimonio','acreedora',1,false) RETURNING id INTO v_pat;
  INSERT INTO chart_accounts(company_id,parent_id,code,name,account_type,nature,level,is_postable)
    VALUES(_company_id,v_pat,'3.1.01','Capital Social','patrimonio','acreedora',3,true) RETURNING id INTO v_capital;
  INSERT INTO chart_accounts(company_id,parent_id,code,name,account_type,nature,level,is_postable)
    VALUES(_company_id,v_pat,'3.2.01','Resultados Acumulados','patrimonio','acreedora',3,true) RETURNING id INTO v_result;

  -- INGRESOS
  INSERT INTO chart_accounts(company_id,code,name,account_type,nature,level,is_postable)
    VALUES(_company_id,'4','INGRESOS','ingreso','acreedora',1,false) RETURNING id INTO v_ing;
  INSERT INTO chart_accounts(company_id,parent_id,code,name,account_type,nature,level,is_postable)
    VALUES(_company_id,v_ing,'4.1.01','Ventas Gravadas','ingreso','acreedora',3,true) RETURNING id INTO v_vg;
  INSERT INTO chart_accounts(company_id,parent_id,code,name,account_type,nature,level,is_postable)
    VALUES(_company_id,v_ing,'4.1.02','Ventas Exentas','ingreso','acreedora',3,true) RETURNING id INTO v_ve;

  -- COSTOS
  INSERT INTO chart_accounts(company_id,code,name,account_type,nature,level,is_postable)
    VALUES(_company_id,'5','COSTOS','costo','deudora',1,false) RETURNING id INTO v_cos;
  INSERT INTO chart_accounts(company_id,parent_id,code,name,account_type,nature,level,is_postable)
    VALUES(_company_id,v_cos,'5.1.01','Compras','costo','deudora',3,true) RETURNING id INTO v_comp;

  -- GASTOS
  INSERT INTO chart_accounts(company_id,code,name,account_type,nature,level,is_postable)
    VALUES(_company_id,'6','GASTOS','gasto','deudora',1,false) RETURNING id INTO v_gas;
  INSERT INTO chart_accounts(company_id,parent_id,code,name,account_type,nature,level,is_postable)
    VALUES(_company_id,v_gas,'6.1.01','Gastos Generales','gasto','deudora',3,true) RETURNING id INTO v_gserv;

  -- Configuración
  INSERT INTO company_accounting_config(company_id,sales_taxed_account,sales_exempt_account,iva_debit_account,accounts_receivable,purchases_account,iva_credit_account,accounts_payable,iva_wh_payable,iva_wh_receivable,islr_wh_payable,islr_wh_receivable,default_cash_account)
    VALUES(_company_id,v_vg,v_ve,v_ivad,v_cxc,v_comp,v_ivac,v_cxp,v_ivwp,v_ivwc,v_islrwp,v_islrwc,v_bcos)
    ON CONFLICT (company_id) DO UPDATE SET
      sales_taxed_account=EXCLUDED.sales_taxed_account,
      sales_exempt_account=EXCLUDED.sales_exempt_account,
      iva_debit_account=EXCLUDED.iva_debit_account,
      accounts_receivable=EXCLUDED.accounts_receivable,
      purchases_account=EXCLUDED.purchases_account,
      iva_credit_account=EXCLUDED.iva_credit_account,
      accounts_payable=EXCLUDED.accounts_payable,
      iva_wh_payable=EXCLUDED.iva_wh_payable,
      iva_wh_receivable=EXCLUDED.iva_wh_receivable,
      islr_wh_payable=EXCLUDED.islr_wh_payable,
      islr_wh_receivable=EXCLUDED.islr_wh_receivable,
      default_cash_account=EXCLUDED.default_cash_account;
END;
$$;

GRANT EXECUTE ON FUNCTION public.seed_chart_of_accounts(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.next_entry_number(UUID) TO authenticated;

-- ============ POST INVOICE ENTRY ============
CREATE OR REPLACE FUNCTION public.post_sales_invoice_entry(_invoice_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  inv public.sales_invoices%ROWTYPE;
  cfg public.company_accounting_config%ROWTYPE;
  eid UUID; enum BIGINT; uid UUID;
BEGIN
  SELECT * INTO inv FROM public.sales_invoices WHERE id = _invoice_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT * INTO cfg FROM public.company_accounting_config WHERE company_id = inv.company_id;
  IF NOT FOUND OR cfg.accounts_receivable IS NULL OR cfg.sales_taxed_account IS NULL OR cfg.iva_debit_account IS NULL THEN
    RETURN NULL;
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
END; $$;

CREATE OR REPLACE FUNCTION public.post_purchase_invoice_entry(_invoice_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  inv public.purchase_invoices%ROWTYPE;
  cfg public.company_accounting_config%ROWTYPE;
  eid UUID; enum BIGINT; uid UUID;
BEGIN
  SELECT * INTO inv FROM public.purchase_invoices WHERE id = _invoice_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT * INTO cfg FROM public.company_accounting_config WHERE company_id = inv.company_id;
  IF NOT FOUND OR cfg.accounts_payable IS NULL OR cfg.purchases_account IS NULL OR cfg.iva_credit_account IS NULL THEN
    RETURN NULL;
  END IF;
  enum := public.next_entry_number(inv.company_id);
  uid := COALESCE(auth.uid(), inv.created_by);
  INSERT INTO public.journal_entries(company_id,entry_number,entry_date,description,source,source_id,status,created_by)
    VALUES(inv.company_id,enum,inv.invoice_date,'Factura de compra N° '||inv.invoice_number,'purchase_invoice',inv.id,'contabilizado',uid)
    RETURNING id INTO eid;
  IF (inv.base_amount + inv.exempt_amount) > 0 THEN
    INSERT INTO public.journal_lines(entry_id,account_id,debit,credit,description,line_order)
      VALUES(eid,cfg.purchases_account,inv.base_amount + inv.exempt_amount,0,'Compras',1);
  END IF;
  IF inv.iva_amount > 0 THEN
    INSERT INTO public.journal_lines(entry_id,account_id,debit,credit,description,line_order)
      VALUES(eid,cfg.iva_credit_account,inv.iva_amount,0,'IVA crédito fiscal',2);
  END IF;
  INSERT INTO public.journal_lines(entry_id,account_id,debit,credit,description,line_order)
    VALUES(eid,cfg.accounts_payable,0,inv.total_amount,'CxP factura '||inv.invoice_number,3);
  RETURN eid;
END; $$;

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

  -- Emitida: nosotros retenemos a proveedor → Debit CxP / Credit Ret por Pagar
  IF wh.tax_type = 'iva' THEN
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
    VALUES(wh.company_id,enum,wh.withholding_date,'Retención '||wh.tax_type||' N° '||wh.voucher_number,'withholding',wh.id,'contabilizado',uid)
    RETURNING id INTO eid;
  INSERT INTO public.journal_lines(entry_id,account_id,debit,credit,description,line_order)
    VALUES(eid,debit_acc,wh.amount,0,'Retención',1);
  INSERT INTO public.journal_lines(entry_id,account_id,debit,credit,description,line_order)
    VALUES(eid,credit_acc,0,wh.amount,'Retención por pagar',2);
  RETURN eid;
END; $$;

-- ============ TRIGGERS ============
CREATE OR REPLACE FUNCTION public.trg_sales_invoice_post() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN PERFORM public.post_sales_invoice_entry(NEW.id); RETURN NEW; END; $$;
CREATE TRIGGER trg_sales_invoice_post AFTER INSERT ON public.sales_invoices
  FOR EACH ROW EXECUTE FUNCTION public.trg_sales_invoice_post();

CREATE OR REPLACE FUNCTION public.trg_purchase_invoice_post() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN PERFORM public.post_purchase_invoice_entry(NEW.id); RETURN NEW; END; $$;
CREATE TRIGGER trg_purchase_invoice_post AFTER INSERT ON public.purchase_invoices
  FOR EACH ROW EXECUTE FUNCTION public.trg_purchase_invoice_post();

CREATE OR REPLACE FUNCTION public.trg_withholding_post() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN PERFORM public.post_withholding_entry(NEW.id); RETURN NEW; END; $$;
CREATE TRIGGER trg_withholding_post AFTER INSERT ON public.withholdings
  FOR EACH ROW EXECUTE FUNCTION public.trg_withholding_post();
