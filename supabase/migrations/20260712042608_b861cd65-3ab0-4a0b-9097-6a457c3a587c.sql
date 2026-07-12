
-- Accounting periods table
CREATE TABLE public.accounting_periods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  status TEXT NOT NULL DEFAULT 'abierto' CHECK (status IN ('abierto','cerrado')),
  closed_at TIMESTAMPTZ,
  closed_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, year, month)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounting_periods TO authenticated;
GRANT ALL ON public.accounting_periods TO service_role;

ALTER TABLE public.accounting_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read ap" ON public.accounting_periods FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "ins ap" ON public.accounting_periods FOR INSERT TO authenticated
  WITH CHECK (public.company_has_role(auth.uid(), company_id, ARRAY['admin','contador']::app_role[]));
CREATE POLICY "upd ap" ON public.accounting_periods FOR UPDATE TO authenticated
  USING (public.company_has_role(auth.uid(), company_id, ARRAY['admin','contador']::app_role[]));
CREATE POLICY "del ap" ON public.accounting_periods FOR DELETE TO authenticated
  USING (public.company_has_role(auth.uid(), company_id, ARRAY['admin']::app_role[]));

CREATE TRIGGER trg_ap_updated_at BEFORE UPDATE ON public.accounting_periods
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Helper: check if a date falls in a closed period
CREATE OR REPLACE FUNCTION public.is_period_closed(_company_id UUID, _date DATE)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.accounting_periods
    WHERE company_id = _company_id
      AND year = EXTRACT(YEAR FROM _date)::int
      AND month = EXTRACT(MONTH FROM _date)::int
      AND status = 'cerrado'
  )
$$;

-- Trigger to block edits on entries in closed periods
CREATE OR REPLACE FUNCTION public.trg_block_closed_period()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  cid UUID; d DATE;
BEGIN
  IF TG_OP = 'DELETE' THEN
    cid := OLD.company_id; d := OLD.entry_date;
  ELSE
    cid := NEW.company_id; d := NEW.entry_date;
    IF TG_OP = 'UPDATE' AND public.is_period_closed(OLD.company_id, OLD.entry_date) THEN
      RAISE EXCEPTION 'El asiento pertenece a un período cerrado (% %)', EXTRACT(MONTH FROM OLD.entry_date), EXTRACT(YEAR FROM OLD.entry_date);
    END IF;
  END IF;
  IF public.is_period_closed(cid, d) THEN
    RAISE EXCEPTION 'El período contable de la fecha % está cerrado', d;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

CREATE TRIGGER trg_je_closed_period
  BEFORE INSERT OR UPDATE OR DELETE ON public.journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.trg_block_closed_period();

-- Close month
CREATE OR REPLACE FUNCTION public.close_period(_company_id UUID, _year INT, _month INT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  pid UUID; drafts INT; period_start DATE; period_end DATE;
BEGIN
  IF NOT public.company_has_role(auth.uid(), _company_id, ARRAY['admin','contador']::app_role[]) THEN
    RAISE EXCEPTION 'Sin permisos';
  END IF;
  period_start := make_date(_year, _month, 1);
  period_end := (period_start + INTERVAL '1 month - 1 day')::date;

  SELECT COUNT(*) INTO drafts FROM public.journal_entries
    WHERE company_id = _company_id AND entry_date BETWEEN period_start AND period_end AND status = 'borrador';
  IF drafts > 0 THEN
    RAISE EXCEPTION 'Hay % asientos en borrador en el período', drafts;
  END IF;

  INSERT INTO public.accounting_periods(company_id, year, month, status, closed_at, closed_by)
    VALUES(_company_id, _year, _month, 'cerrado', now(), auth.uid())
    ON CONFLICT (company_id, year, month) DO UPDATE
      SET status = 'cerrado', closed_at = now(), closed_by = auth.uid()
    RETURNING id INTO pid;
  RETURN pid;
END;
$$;

-- Reopen month
CREATE OR REPLACE FUNCTION public.reopen_period(_company_id UUID, _year INT, _month INT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.company_has_role(auth.uid(), _company_id, ARRAY['admin']::app_role[]) THEN
    RAISE EXCEPTION 'Solo administradores pueden reabrir períodos';
  END IF;
  UPDATE public.accounting_periods
    SET status = 'abierto', closed_at = NULL, closed_by = NULL
    WHERE company_id = _company_id AND year = _year AND month = _month;
END;
$$;

-- Close fiscal year: generates closing entry for income/cost/expense against Resultados Acumulados
CREATE OR REPLACE FUNCTION public.close_fiscal_year(_company_id UUID, _year INT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  eid UUID; enum BIGINT; ye_date DATE;
  result_acc UUID;
  total_ingresos NUMERIC := 0; total_costos NUMERIC := 0; total_gastos NUMERIC := 0;
  utilidad NUMERIC;
  r RECORD;
  line_num INT := 1;
BEGIN
  IF NOT public.company_has_role(auth.uid(), _company_id, ARRAY['admin','contador']::app_role[]) THEN
    RAISE EXCEPTION 'Sin permisos';
  END IF;
  ye_date := make_date(_year, 12, 31);
  SELECT id INTO result_acc FROM public.chart_accounts
    WHERE company_id = _company_id AND code = '3.2.01' LIMIT 1;
  IF result_acc IS NULL THEN RAISE EXCEPTION 'Cuenta 3.2.01 Resultados Acumulados no existe'; END IF;

  enum := public.next_entry_number(_company_id);
  INSERT INTO public.journal_entries(company_id,entry_number,entry_date,description,source,status,created_by)
    VALUES(_company_id, enum, ye_date, 'Cierre del ejercicio '||_year, 'manual', 'contabilizado', auth.uid())
    RETURNING id INTO eid;

  -- Saldar ingresos (naturaleza acreedora) contra resultado: débito ingreso, crédito resultado
  FOR r IN
    SELECT a.id, a.code, a.account_type, a.nature,
      COALESCE(SUM(l.debit),0) - COALESCE(SUM(l.credit),0) AS saldo
    FROM public.chart_accounts a
    LEFT JOIN public.journal_lines l ON l.account_id = a.id
    LEFT JOIN public.journal_entries e ON e.id = l.entry_id AND e.status <> 'anulado'
      AND EXTRACT(YEAR FROM e.entry_date) = _year AND e.company_id = _company_id
    WHERE a.company_id = _company_id AND a.is_postable
      AND a.account_type IN ('ingreso','costo','gasto')
    GROUP BY a.id, a.code, a.account_type, a.nature
    HAVING (COALESCE(SUM(l.debit),0) - COALESCE(SUM(l.credit),0)) <> 0
    ORDER BY a.code
  LOOP
    IF r.account_type = 'ingreso' THEN
      -- saldo natural negativo (credit>debit) => saldo = -x; debitar |saldo|
      INSERT INTO public.journal_lines(entry_id,account_id,debit,credit,description,line_order)
        VALUES(eid, r.id, ABS(r.saldo), 0, 'Cierre '||r.code, line_num);
      total_ingresos := total_ingresos + ABS(r.saldo);
    ELSE
      -- costo/gasto: saldo natural positivo; acreditar |saldo|
      INSERT INTO public.journal_lines(entry_id,account_id,debit,credit,description,line_order)
        VALUES(eid, r.id, 0, ABS(r.saldo), 'Cierre '||r.code, line_num);
      IF r.account_type = 'costo' THEN total_costos := total_costos + ABS(r.saldo);
      ELSE total_gastos := total_gastos + ABS(r.saldo); END IF;
    END IF;
    line_num := line_num + 1;
  END LOOP;

  utilidad := total_ingresos - total_costos - total_gastos;
  IF utilidad > 0 THEN
    INSERT INTO public.journal_lines(entry_id,account_id,debit,credit,description,line_order)
      VALUES(eid, result_acc, 0, utilidad, 'Utilidad del ejercicio '||_year, line_num);
  ELSIF utilidad < 0 THEN
    INSERT INTO public.journal_lines(entry_id,account_id,debit,credit,description,line_order)
      VALUES(eid, result_acc, ABS(utilidad), 0, 'Pérdida del ejercicio '||_year, line_num);
  END IF;

  RETURN eid;
END;
$$;

-- Open fiscal year: apertura con saldos de balance del año anterior
CREATE OR REPLACE FUNCTION public.open_fiscal_year(_company_id UUID, _year INT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  eid UUID; enum BIGINT; op_date DATE;
  r RECORD; line_num INT := 1;
  total_debit NUMERIC := 0; total_credit NUMERIC := 0;
BEGIN
  IF NOT public.company_has_role(auth.uid(), _company_id, ARRAY['admin','contador']::app_role[]) THEN
    RAISE EXCEPTION 'Sin permisos';
  END IF;
  op_date := make_date(_year, 1, 1);

  enum := public.next_entry_number(_company_id);
  INSERT INTO public.journal_entries(company_id,entry_number,entry_date,description,source,status,created_by)
    VALUES(_company_id, enum, op_date, 'Apertura del ejercicio '||_year, 'manual', 'contabilizado', auth.uid())
    RETURNING id INTO eid;

  FOR r IN
    SELECT a.id, a.code, a.nature,
      COALESCE(SUM(l.debit),0) - COALESCE(SUM(l.credit),0) AS saldo
    FROM public.chart_accounts a
    LEFT JOIN public.journal_lines l ON l.account_id = a.id
    LEFT JOIN public.journal_entries e ON e.id = l.entry_id AND e.status <> 'anulado'
      AND e.entry_date < op_date AND e.company_id = _company_id
    WHERE a.company_id = _company_id AND a.is_postable
      AND a.account_type IN ('activo','pasivo','patrimonio')
    GROUP BY a.id, a.code, a.nature
    HAVING (COALESCE(SUM(l.debit),0) - COALESCE(SUM(l.credit),0)) <> 0
    ORDER BY a.code
  LOOP
    IF r.saldo > 0 THEN
      INSERT INTO public.journal_lines(entry_id,account_id,debit,credit,description,line_order)
        VALUES(eid, r.id, r.saldo, 0, 'Apertura', line_num);
      total_debit := total_debit + r.saldo;
    ELSE
      INSERT INTO public.journal_lines(entry_id,account_id,debit,credit,description,line_order)
        VALUES(eid, r.id, 0, ABS(r.saldo), 'Apertura', line_num);
      total_credit := total_credit + ABS(r.saldo);
    END IF;
    line_num := line_num + 1;
  END LOOP;

  IF total_debit <> total_credit THEN
    RAISE EXCEPTION 'Balance inicial descuadrado: débitos % vs créditos %', total_debit, total_credit;
  END IF;

  RETURN eid;
END;
$$;
