-- ContaVE: estructura completa y unificada de la aplicación.
-- Captura actual: 2026-10-17T13:00:35.400742+00:00 (UTC). PostgreSQL 17.
-- 25 tablas, 9 ENUM, 29 funciones, 2 vistas, 22 triggers y 97 políticas RLS.
-- Sin INSERT/COPY de datos, usuarios, contraseñas, hashes ni claves privadas.
-- DESTINO: base nueva/vacía de aplicación con servicio de autenticación ya instalado.
-- NO ejecutar sobre la base de producción existente ni como migración incremental.
-- Requiere auth.users, auth.uid(), auth.role() y los roles anon/authenticated/service_role.
-- Ejecutar con psql -v ON_ERROR_STOP=1 -f schema_completo.sql como administrador.
-- La tabla de perfiles REAL se llama public.profiles (no perfiles).
-- public.handle_new_user vincula NEW.id, NEW.email y raw_user_meta_data.full_name.
-- La contraseña es administrada y cifrada por el servicio de autenticación;
-- no se copia a public.profiles. El trigger actual NO asigna roles al registrarse.
-- user_roles almacena roles globales; company_members almacena roles por empresa.
-- Se preservan definiciones y políticas vigentes; esta exportación no es una auditoría.
-- Los GRANT a sandbox_exec del origen se conservan como comentarios: rol interno no portable.
-- Las vistas security_invoker respetan RLS de las tablas subyacentes.
-- Referencia documental de auth.users (NO ejecutar: tabla administrada por autenticación):
-- CREATE TABLE auth.users (
--   "instance_id" uuid,
--   "id" uuid NOT NULL,
--   "aud" character varying(255),
--   "role" character varying(255),
--   "email" character varying(255),
--   "encrypted_password" character varying(255),
--   "email_confirmed_at" timestamp with time zone,
--   "invited_at" timestamp with time zone,
--   "confirmation_token" character varying(255),
--   "confirmation_sent_at" timestamp with time zone,
--   "recovery_token" character varying(255),
--   "recovery_sent_at" timestamp with time zone,
--   "email_change_token_new" character varying(255),
--   "email_change" character varying(255),
--   "email_change_sent_at" timestamp with time zone,
--   "last_sign_in_at" timestamp with time zone,
--   "raw_app_meta_data" jsonb,
--   "raw_user_meta_data" jsonb,
--   "is_super_admin" boolean,
--   "created_at" timestamp with time zone,
--   "updated_at" timestamp with time zone,
--   "phone" text DEFAULT NULL::character varying,
--   "phone_confirmed_at" timestamp with time zone,
--   "phone_change" text DEFAULT ''::character varying,
--   "phone_change_token" character varying(255) DEFAULT ''::character varying,
--   "phone_change_sent_at" timestamp with time zone,
--   "confirmed_at" timestamp with time zone DEFAULT LEAST(email_confirmed_at, phone_confirmed_at),
--   "email_change_token_current" character varying(255) DEFAULT ''::character varying,
--   "email_change_confirm_status" smallint DEFAULT 0,
--   "banned_until" timestamp with time zone,
--   "reauthentication_token" character varying(255) DEFAULT ''::character varying,
--   "reauthentication_sent_at" timestamp with time zone,
--   "is_sso_user" boolean DEFAULT false NOT NULL,
--   "deleted_at" timestamp with time zone,
--   "is_anonymous" boolean DEFAULT false NOT NULL,
--   CONSTRAINT "users_email_change_confirm_status_check" CHECK (email_change_confirm_status >= 0 AND email_change_confirm_status <= 2),
--   CONSTRAINT "users_phone_key" UNIQUE (phone),
--   CONSTRAINT "users_pkey" PRIMARY KEY (id),
-- );

BEGIN;
DO $preflight$
BEGIN
  IF to_regclass('auth.users') IS NULL OR to_regprocedure('auth.uid()') IS NULL OR to_regprocedure('auth.role()') IS NULL THEN
    RAISE EXCEPTION 'Instale primero el servicio de autenticación; este archivo no reemplaza su esquema administrado.';
  END IF;
  IF EXISTS (SELECT 1 FROM (VALUES ('anon'), ('authenticated'), ('service_role')) AS required(name)
             WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = required.name)) THEN
    RAISE EXCEPTION 'Faltan los roles de autenticación anon, authenticated o service_role.';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
             WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m')) THEN
    RAISE EXCEPTION 'El esquema public ya contiene tablas o vistas: restaure en una base nueva, no en producción.';
  END IF;
END;
$preflight$;

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.9

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA IF NOT EXISTS public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: account_nature; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.account_nature AS ENUM (
    'deudora',
    'acreedora'
);


--
-- Name: account_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.account_type AS ENUM (
    'activo',
    'pasivo',
    'patrimonio',
    'ingreso',
    'costo',
    'gasto',
    'orden'
);


--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_role AS ENUM (
    'admin',
    'contador',
    'auditor',
    'operador'
);


--
-- Name: contributor_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.contributor_type AS ENUM (
    'ordinario',
    'formal',
    'especial',
    'no_contribuyente',
    'gobierno'
);


--
-- Name: invoice_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.invoice_status AS ENUM (
    'emitida',
    'anulada'
);


--
-- Name: journal_source; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.journal_source AS ENUM (
    'manual',
    'sales_invoice',
    'purchase_invoice',
    'withholding'
);


--
-- Name: journal_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.journal_status AS ENUM (
    'borrador',
    'contabilizado',
    'anulado'
);


--
-- Name: payment_method_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.payment_method_type AS ENUM (
    'efectivo',
    'punto',
    'pago_movil',
    'divisa',
    'mixto'
);


--
-- Name: withholding_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.withholding_type AS ENUM (
    'iva',
    'islr'
);


--
-- Name: close_fiscal_year(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.close_fiscal_year(_company_id uuid, _year integer) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: close_period(uuid, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.close_period(_company_id uuid, _year integer, _month integer) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: company_has_role(uuid, uuid, public.app_role[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.company_has_role(_user_id uuid, _company_id uuid, _roles public.app_role[]) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_members
    WHERE user_id = _user_id AND company_id = _company_id AND role = ANY(_roles)
  )
$$;


--
-- Name: company_role(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.company_role(_user_id uuid, _company_id uuid) RETURNS public.app_role
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT role FROM public.company_members WHERE user_id = _user_id AND company_id = _company_id LIMIT 1
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    email text NOT NULL,
    full_name text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: find_or_create_profile_by_email(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.find_or_create_profile_by_email(_email text) RETURNS SETOF public.profiles
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Buscar en auth.users (case-insensitive)
  SELECT id INTO v_user_id 
  FROM auth.users 
  WHERE lower(email) = lower(_email) 
  LIMIT 1;

  -- Si el correo no existe en auth.users, retorna vacío sin lanzar excepción
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  -- Crear/actualizar el perfil público
  INSERT INTO public.profiles (id, email)
  VALUES (v_user_id, lower(_email))
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

  -- Retornar el perfil encontrado/creado
  RETURN QUERY SELECT * FROM public.profiles WHERE id = v_user_id;
END;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;


--
-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;


--
-- Name: is_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_admin() RETURNS boolean
    LANGUAGE sql SECURITY DEFINER
    AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.user_roles 
    WHERE user_id = auth.uid() 
      AND role = 'admin'::app_role
  );
$$;


--
-- Name: is_company_member(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_company_member(_user_id uuid, _company_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (SELECT 1 FROM public.company_members WHERE user_id = _user_id AND company_id = _company_id)
$$;


--
-- Name: is_period_closed(uuid, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_period_closed(_company_id uuid, _date date) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.accounting_periods
    WHERE company_id = _company_id
      AND year = EXTRACT(YEAR FROM _date)::int
      AND month = EXTRACT(MONTH FROM _date)::int
      AND status = 'cerrado'
  )
$$;


--
-- Name: next_entry_number(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.next_entry_number(_company_id uuid) RETURNS bigint
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT COALESCE(MAX(entry_number), 0) + 1 FROM public.journal_entries WHERE company_id = _company_id;
$$;


--
-- Name: open_fiscal_year(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.open_fiscal_year(_company_id uuid, _year integer) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: post_purchase_invoice_entry(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.post_purchase_invoice_entry(_invoice_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  inv public.purchase_invoices%ROWTYPE;
  cfg public.company_accounting_config%ROWTYPE;
  eid UUID; enum BIGINT; uid UUID;
  is_nc BOOLEAN := FALSE;
BEGIN
  SELECT * INTO inv FROM public.purchase_invoices WHERE id = _invoice_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT * INTO cfg FROM public.company_accounting_config WHERE company_id = inv.company_id;
  IF NOT FOUND OR cfg.accounts_payable IS NULL OR cfg.purchases_account IS NULL OR cfg.iva_credit_account IS NULL THEN
    RETURN NULL;
  END IF;

  IF LOWER(COALESCE(inv.document_type,'')) IN ('nc','nota_credito','nota_de_credito','credit_note')
     OR inv.affected_invoice_number IS NOT NULL THEN
    is_nc := TRUE;
  END IF;

  enum := public.next_entry_number(inv.company_id);
  uid := COALESCE(auth.uid(), inv.created_by);

  INSERT INTO public.journal_entries(company_id,entry_number,entry_date,description,source,source_id,status,created_by)
  VALUES(inv.company_id,enum,inv.invoice_date,
    CASE WHEN is_nc THEN 'Nota de crédito de compra N° ' ELSE 'Factura de compra N° ' END || inv.invoice_number,
    'purchase_invoice',inv.id,'contabilizado',uid)
  RETURNING id INTO eid;

  IF is_nc THEN
    INSERT INTO public.journal_lines(entry_id,account_id,debit,credit,description,line_order)
      VALUES(eid,cfg.accounts_payable,inv.total_amount,0,'Disminución CxP por NC '||inv.invoice_number,1);
    IF (inv.base_amount + inv.exempt_amount) > 0 THEN
      INSERT INTO public.journal_lines(entry_id,account_id,debit,credit,description,line_order,cost_center_id)
        VALUES(eid,cfg.purchases_account,0,inv.base_amount+inv.exempt_amount,'Reversión compras por NC',2,inv.cost_center_id);
    END IF;
    IF inv.iva_amount > 0 THEN
      INSERT INTO public.journal_lines(entry_id,account_id,debit,credit,description,line_order)
        VALUES(eid,cfg.iva_credit_account,0,inv.iva_amount,'Reversión IVA crédito fiscal por NC',3);
    END IF;
  ELSE
    IF (inv.base_amount + inv.exempt_amount) > 0 THEN
      INSERT INTO public.journal_lines(entry_id,account_id,debit,credit,description,line_order,cost_center_id)
        VALUES(eid,cfg.purchases_account,inv.base_amount+inv.exempt_amount,0,'Compras',1,inv.cost_center_id);
    END IF;
    IF inv.iva_amount > 0 THEN
      INSERT INTO public.journal_lines(entry_id,account_id,debit,credit,description,line_order)
        VALUES(eid,cfg.iva_credit_account,inv.iva_amount,0,'IVA crédito fiscal',2);
    END IF;
    INSERT INTO public.journal_lines(entry_id,account_id,debit,credit,description,line_order)
      VALUES(eid,cfg.accounts_payable,0,inv.total_amount,'CxP factura '||inv.invoice_number,3);
  END IF;

  RETURN eid;
END;
$$;


--
-- Name: post_purchase_payment(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.post_purchase_payment(_payment_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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

  SELECT COALESCE(SUM(CASE WHEN pay.accounting_currency = 'VES' THEN CASE WHEN currency = 'VES' THEN amount_currency ELSE round(amount_currency * exchange_rate, 2) END ELSE amount_usd END),0), COALESCE(SUM(igtf_amount),0)
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
    VALUES (eid, l.account_id, 0, CASE WHEN pay.accounting_currency = 'VES' THEN CASE WHEN l.currency = 'VES' THEN l.amount_currency ELSE round(l.amount_currency * l.exchange_rate, 2) END ELSE l.amount_usd END,
      'Egreso ' || l.method::text || ' ' || l.currency || ' Ref: ' || COALESCE(l.reference_number,'S/R'), ln);
    ln := ln + 1;

    IF l.apply_igtf AND l.igtf_amount > 0 THEN
      IF cfg.default_igtf_expense_account_id IS NULL OR cfg.default_igtf_pay_account_id IS NULL THEN
        RAISE EXCEPTION 'Configura las cuentas de Gasto IGTF e IGTF por Enterar.';
      END IF;
      INSERT INTO public.purchase_igtf_ledger(company_id,payment_id,operation_date,invoice_number,supplier_rif,supplier_name,
        payment_amount_usd,exchange_rate,base_amount_bs,igtf_rate,igtf_retained_bs)
      VALUES (pay.company_id, pay.id, pay.payment_date, COALESCE(inv.invoice_number,'S/N'), COALESCE(sup.rif,''), COALESCE(sup.name,''),
        l.amount_usd, CASE WHEN pay.accounting_currency = 'VES' THEN pay.exchange_rate ELSE l.exchange_rate END, CASE WHEN pay.accounting_currency = 'VES' THEN round(l.amount_currency * l.exchange_rate,2) ELSE l.amount_usd * l.exchange_rate END, CASE WHEN pay.accounting_currency = 'VES' THEN (SELECT igtf_rate FROM public.companies WHERE id=pay.company_id) ELSE 3.00 END, l.igtf_amount);
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
$$;


--
-- Name: post_sales_collection(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.post_sales_collection(_collection_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  col public.sales_collections%ROWTYPE;
  inv public.sales_invoices%ROWTYPE;
  cus public.customers%ROWTYPE;
  cfg public.company_accounting_configs%ROWTYPE;
  lcfg public.company_accounting_config%ROWTYPE;
  eid uuid; enum bigint; uid uuid;
  l RECORD; ln int := 1;
  total_lines numeric := 0; total_igtf numeric := 0; total_applied numeric := 0;
  ar_account uuid; igtf_pay uuid; iva_recv uuid; islr_recv uuid;
  ret_num text;
BEGIN
  SELECT * INTO col FROM public.sales_collections WHERE id = _collection_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cobranza no encontrada'; END IF;
  SELECT * INTO inv FROM public.sales_invoices WHERE id = col.invoice_id;
  SELECT * INTO cus FROM public.customers WHERE id = inv.customer_id;
  SELECT * INTO cfg FROM public.company_accounting_configs WHERE company_id = col.company_id;
  SELECT * INTO lcfg FROM public.company_accounting_config WHERE company_id = col.company_id;

  ar_account := COALESCE(cfg.default_customer_collect_account_id, lcfg.accounts_receivable);
  IF ar_account IS NULL THEN
    RAISE EXCEPTION 'Configuración contable incompleta: falta la cuenta de Cuentas por Cobrar Clientes.';
  END IF;
  igtf_pay := COALESCE(cfg.default_igtf_pay_account_id, cfg.default_igtf_expense_account_id);
  iva_recv := lcfg.iva_wh_receivable;
  islr_recv := lcfg.islr_wh_receivable;

  DELETE FROM public.journal_entries WHERE source = 'sales_invoice'::journal_source AND source_id = col.id;
  DELETE FROM public.sales_igtf_ledger WHERE collection_id = col.id;
  DELETE FROM public.sales_iva_retentions WHERE collection_id = col.id;
  DELETE FROM public.sales_islr_retentions WHERE collection_id = col.id;

  SELECT COALESCE(SUM(CASE WHEN col.accounting_currency = 'VES' THEN CASE WHEN currency = 'VES' THEN amount_currency ELSE round(amount_currency * exchange_rate, 2) END ELSE amount_usd END),0), COALESCE(SUM(igtf_amount),0)
    INTO total_lines, total_igtf
    FROM public.sales_collection_lines WHERE collection_id = col.id;

  IF total_lines = 0 THEN
    total_lines := COALESCE(col.amount_collected,0);
    total_igtf := COALESCE(col.igtf_amount,0);
  END IF;

  total_applied := total_lines + COALESCE(col.iva_retained_amount,0) + COALESCE(col.islr_retained_amount,0);

  enum := public.next_entry_number(col.company_id);
  uid := COALESCE(auth.uid(), col.created_by);

  INSERT INTO public.journal_entries(company_id, entry_number, entry_date, description, status, source, source_id, created_by)
  VALUES (col.company_id, enum, col.collection_date,
    'Cobro factura de venta N° ' || COALESCE(inv.invoice_number,'S/N') || ' - ' || COALESCE(cus.name,''),
    'contabilizado'::journal_status, 'sales_invoice'::journal_source, col.id, uid)
  RETURNING id INTO eid;

  IF EXISTS (SELECT 1 FROM public.sales_collection_lines WHERE collection_id = col.id) THEN
    FOR l IN SELECT * FROM public.sales_collection_lines WHERE collection_id = col.id ORDER BY line_order LOOP
      INSERT INTO public.journal_lines(entry_id, account_id, debit, credit, description, line_order)
      VALUES (eid, l.account_id, CASE WHEN col.accounting_currency = 'VES' THEN CASE WHEN l.currency = 'VES' THEN l.amount_currency ELSE round(l.amount_currency * l.exchange_rate, 2) END ELSE l.amount_usd END, 0,
        'Ingreso ' || l.method::text || ' ' || l.currency || ' Ref: ' || COALESCE(l.reference_number,'S/R'), ln);
      ln := ln + 1;

      IF l.apply_igtf AND l.igtf_amount > 0 THEN
        INSERT INTO public.sales_igtf_ledger(company_id,collection_id,operation_date,invoice_number,customer_rif,customer_name,
          collection_amount_usd,exchange_rate,base_amount_bs,igtf_rate,igtf_charged_bs)
        VALUES (col.company_id, col.id, col.collection_date, COALESCE(inv.invoice_number,'S/N'),
          COALESCE(cus.rif,''), COALESCE(cus.name,''), l.amount_usd, CASE WHEN col.accounting_currency = 'VES' THEN col.exchange_rate ELSE l.exchange_rate END,
          CASE WHEN col.accounting_currency = 'VES' THEN round(l.amount_currency * l.exchange_rate,2) ELSE l.amount_usd * l.exchange_rate END, CASE WHEN col.accounting_currency = 'VES' THEN (SELECT igtf_rate FROM public.companies WHERE id=col.company_id) ELSE 3.00 END, l.igtf_amount);
      END IF;
    END LOOP;
  ELSE
    INSERT INTO public.journal_lines(entry_id, account_id, debit, credit, description, line_order)
    VALUES (eid, COALESCE(col.collection_account_id, cfg.default_cash_account_id), total_lines, 0, 'Ingreso por cobro', ln);
    ln := ln + 1;
  END IF;

  IF COALESCE(col.iva_retained_amount,0) > 0 THEN
    IF iva_recv IS NULL THEN
      RAISE EXCEPTION 'Configura la cuenta de Retenciones de IVA por Cobrar.';
    END IF;
    ret_num := COALESCE(col.iva_retention_number,
      to_char(col.collection_date,'YYYYMM') || lpad(((SELECT COUNT(*) FROM public.sales_iva_retentions r
        WHERE r.company_id = col.company_id AND to_char(r.retention_date,'YYYYMM') = to_char(col.collection_date,'YYYYMM')) + 1)::text, 8, '0'));
    INSERT INTO public.sales_iva_retentions(company_id,invoice_id,collection_id,retention_number,retention_date,retention_percentage,base_amount,iva_amount,retained_amount,created_by)
    VALUES (col.company_id, col.invoice_id, col.id, ret_num, col.collection_date, col.iva_retention_percentage,
            COALESCE(inv.base_amount,0), COALESCE(inv.iva_amount,0), col.iva_retained_amount, uid);
    UPDATE public.sales_collections SET iva_retention_number = ret_num WHERE id = col.id;
    INSERT INTO public.journal_lines(entry_id, account_id, debit, credit, description, line_order)
    VALUES (eid, iva_recv, col.iva_retained_amount, 0, 'Retención IVA sufrida comprobante N° ' || ret_num, ln);
    ln := ln + 1;
  END IF;

  IF COALESCE(col.islr_retained_amount,0) > 0 THEN
    IF islr_recv IS NULL THEN
      RAISE EXCEPTION 'Configura la cuenta de Retenciones de ISLR por Cobrar.';
    END IF;
    ret_num := COALESCE(col.islr_retention_number,
      'ISLR-' || to_char(col.collection_date,'YYYY') || '-' || lpad(((SELECT COUNT(*) FROM public.sales_islr_retentions r
        WHERE r.company_id = col.company_id AND EXTRACT(YEAR FROM r.retention_date) = EXTRACT(YEAR FROM col.collection_date)) + 1)::text, 6, '0'));
    INSERT INTO public.sales_islr_retentions(company_id,invoice_id,collection_id,retention_number,retention_date,concept_code,retention_percentage,subtraction_amount,base_amount,retained_amount,created_by)
    VALUES (col.company_id, col.invoice_id, col.id, ret_num, col.collection_date, '000',
            col.islr_retention_percentage, 0, COALESCE(inv.base_amount,0), col.islr_retained_amount, uid);
    UPDATE public.sales_collections SET islr_retention_number = ret_num WHERE id = col.id;
    INSERT INTO public.journal_lines(entry_id, account_id, debit, credit, description, line_order)
    VALUES (eid, islr_recv, col.islr_retained_amount, 0, 'Retención ISLR sufrida comprobante N° ' || ret_num, ln);
    ln := ln + 1;
  END IF;

  INSERT INTO public.journal_lines(entry_id, account_id, debit, credit, description, line_order)
  VALUES (eid, ar_account, 0, total_applied,
          'Amortización CxC factura ' || COALESCE(inv.invoice_number,'S/N'), ln);
  ln := ln + 1;

  IF total_igtf > 0 THEN
    IF igtf_pay IS NULL THEN
      RAISE EXCEPTION 'Configura la cuenta de IGTF por Enterar.';
    END IF;
    INSERT INTO public.journal_lines(entry_id, account_id, debit, credit, description, line_order)
    VALUES (eid, COALESCE(col.collection_account_id, cfg.default_usd_cash_account_id, cfg.default_cash_account_id),
            total_igtf, 0, 'IGTF 3% cobrado en divisas', ln);
    ln := ln + 1;
    INSERT INTO public.journal_lines(entry_id, account_id, debit, credit, description, line_order)
    VALUES (eid, igtf_pay, 0, total_igtf, 'IGTF por enterar 3% sobre cobro en divisas', ln);
  END IF;

  RETURN eid;
END;
$$;


--
-- Name: post_sales_invoice_entry(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.post_sales_invoice_entry(_invoice_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
$$;


--
-- Name: post_withholding_entry(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.post_withholding_entry(_wh_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: process_purchase_invoice_journal_entry(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.process_purchase_invoice_journal_entry() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    eid UUID; cfg RECORD;
    v_total NUMERIC; v_base NUMERIC; v_exempt NUMERIC; v_iva NUMERIC;
    is_nota_credito BOOLEAN := FALSE;
    is_nota_debito BOOLEAN := FALSE;
    v_doc_raw TEXT; v_entry_number BIGINT; v_doc_label TEXT;
    v_iva_retained NUMERIC := 0.00; v_islr_retained NUMERIC := 0.00; v_net_supplier_pay NUMERIC := 0.00;
    v_ret_number_iva TEXT; v_ret_number_islr TEXT;
    v_cc UUID;
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

    v_cc := NEW.cost_center_id;

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
          INSERT INTO public.journal_lines(entry_id,account_id,debit,credit,description,line_order,cost_center_id)
          VALUES(eid,cfg.default_purchase_account_id,0,v_base+v_exempt,'Reversión compras por NC',2,v_cc);
        END IF;
        IF v_iva > 0 THEN
          INSERT INTO public.journal_lines(entry_id,account_id,debit,credit,description,line_order)
          VALUES(eid,cfg.default_iva_credit_account_id,0,v_iva,'Reversión IVA crédito fiscal por NC',3);
        END IF;
    ELSE
        IF (v_base + v_exempt) > 0 THEN
          INSERT INTO public.journal_lines(entry_id,account_id,debit,credit,description,line_order,cost_center_id)
          VALUES(eid,cfg.default_purchase_account_id,v_base+v_exempt,0,'Compras doc '||NEW.invoice_number,1,v_cc);
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
$$;


--
-- Name: process_purchase_payment_journal_entry(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.process_purchase_payment_journal_entry() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    eid UUID;
    cfg RECORD;
    v_entry_number INT;
    v_invoice RECORD;
    v_supplier RECORD;
    
    -- Variables para cuentas contables seleccionadas
    v_payment_account_id UUID;
    v_igtf_expense_account_id UUID;
    v_igtf_pay_account_id UUID;
    v_supplier_pay_account_id UUID;
BEGIN
    -- 1. Obtener datos de la factura y del proveedor
    SELECT * INTO v_invoice FROM public.purchase_invoices WHERE id = NEW.invoice_id;
    SELECT * INTO v_supplier FROM public.suppliers WHERE id = v_invoice.supplier_id;

    -- 2. Cargar configuración contable de la empresa
    SELECT * INTO cfg 
    FROM public.company_accounting_configs 
    WHERE company_id = NEW.company_id;
    
    IF NOT FOUND THEN
        RETURN NEW;
    END IF;

    -- Asignamos las cuentas predeterminadas
    v_supplier_pay_account_id := cfg.default_supplier_pay_account_id;
    v_igtf_expense_account_id := cfg.default_igtf_expense_account_id;
    v_igtf_pay_account_id := cfg.default_igtf_pay_account_id;

    -- Seleccionar la cuenta de egreso de dinero según el método de pago
    CASE NEW.payment_method
        WHEN 'divisa' THEN
            v_payment_account_id := COALESCE(cfg.default_usd_cash_account_id, cfg.default_cash_account_id);
        WHEN 'efectivo' THEN
            v_payment_account_id := cfg.default_cash_account_id;
        ELSE -- punto, pago_movil, mixto (banco principal)
            v_payment_account_id := cfg.default_bank_account_id;
    END CASE;

    -- Si no hay cuenta de egreso definida, abortamos para no descuadrar contabilidad
    IF v_payment_account_id IS NULL THEN
        RAISE EXCEPTION 'No se ha configurado la cuenta contable para el método de pago seleccionado.';
    END IF;

    -- 3. Calcular correlativo del asiento
    SELECT COALESCE(MAX(entry_number), 0) + 1 INTO v_entry_number
    FROM public.journal_entries
    WHERE company_id = NEW.company_id;

    -- 4. Crear cabecera de asiento para el Pago
    INSERT INTO public.journal_entries (
        company_id, entry_number, entry_date, description, status, source, source_id, created_by
    )
    VALUES (
        NEW.company_id, v_entry_number, NEW.payment_date,
        'Pago Factura N° ' || v_invoice.invoice_number || ' - Prov: ' || v_supplier.name,
        'contabilizado'::journal_status, 'purchase_invoice'::journal_source, NEW.id, NEW.created_by
    )
    RETURNING id INTO eid;

    -- =========================================================================
    -- ASIENTOS DE PAGO (MOVIMIENTOS DE BALANCE)
    -- =========================================================================

    -- DEBE: Disminuye la Cuenta por Pagar al Proveedor por el monto pagado
    INSERT INTO public.journal_lines (entry_id, account_id, debit, credit, description)
    VALUES (eid, v_supplier_pay_account_id, NEW.amount_paid, 0.00, 'Amortización CxP Factura N° ' || v_invoice.invoice_number);

    -- HABER: Disminuye la Caja o Banco desde donde sale el dinero
    INSERT INTO public.journal_lines (entry_id, account_id, debit, credit, description)
    VALUES (eid, v_payment_account_id, 0.00, NEW.amount_paid, 'Egreso por pago - Ref: ' || COALESCE(NEW.reference_number, 'S/R'));

    -- =========================================================================
    -- TRATAMIENTO DE IGTF (SENIAT 3%)
    -- =========================================================================
    IF COALESCE(NEW.apply_igtf, FALSE) AND COALESCE(NEW.igtf_amount, 0) > 0 THEN
        
        -- Validamos que las cuentas de IGTF existan
        IF v_igtf_expense_account_id IS NULL OR v_igtf_pay_account_id IS NULL THEN
            RAISE EXCEPTION 'Debe configurar las cuentas de Gasto y Pasivo de IGTF en la configuración contable.';
        END IF;

        -- DEBE: Gasto del IGTF (3%)
        INSERT INTO public.journal_lines (entry_id, account_id, debit, credit, description)
        VALUES (eid, v_igtf_expense_account_id, NEW.igtf_amount, 0.00, 'Gasto IGTF 3% - Pago Factura N° ' || v_invoice.invoice_number);

        -- HABER: IGTF por Enterar (Pasivo temporal que pagamos al SENIAT)
        INSERT INTO public.journal_lines (entry_id, account_id, debit, credit, description)
        VALUES (eid, v_igtf_pay_account_id, 0.00, NEW.igtf_amount, 'IGTF por Enterar 3% - Factura N° ' || v_invoice.invoice_number);

        -- ALIMENTAR EL LIBRO DE IGTF (Requisito Fiscal Obligatorio)
        INSERT INTO public.purchase_igtf_ledger (
            company_id, payment_id, operation_date, invoice_number, 
            supplier_rif, supplier_name, payment_amount_usd, 
            exchange_rate, base_amount_bs, igtf_rate, igtf_retained_bs
        )
        VALUES (
            NEW.company_id, NEW.id, NEW.payment_date, v_invoice.invoice_number,
            v_supplier.rif, v_supplier.name, NEW.amount_in_usd,
            NEW.exchange_rate, (NEW.amount_in_usd * NEW.exchange_rate), 3.00, NEW.igtf_amount
        );
    END IF;

    RETURN NEW;
END;
$$;


--
-- Name: reopen_period(uuid, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reopen_period(_company_id uuid, _year integer, _month integer) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT public.company_has_role(auth.uid(), _company_id, ARRAY['admin']::app_role[]) THEN
    RAISE EXCEPTION 'Solo administradores pueden reabrir períodos';
  END IF;
  UPDATE public.accounting_periods
    SET status = 'abierto', closed_at = NULL, closed_by = NULL
    WHERE company_id = _company_id AND year = _year AND month = _month;
END;
$$;


--
-- Name: resolve_postable_account(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.resolve_postable_account(_account_id uuid) RETURNS uuid
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: reverse_journal_entry(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reverse_journal_entry(_entry_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  orig public.journal_entries%ROWTYPE;
  new_id UUID;
  new_num BIGINT;
  uid UUID;
BEGIN
  SELECT * INTO orig FROM public.journal_entries WHERE id = _entry_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Asiento no encontrado'; END IF;
  IF orig.status = 'anulado' OR orig.reversed_by_entry_id IS NOT NULL THEN
    RAISE EXCEPTION 'Asiento ya reversado o anulado';
  END IF;
  IF NOT public.company_has_role(auth.uid(), orig.company_id, ARRAY['admin','contador']::app_role[]) THEN
    RAISE EXCEPTION 'Sin permisos';
  END IF;

  new_num := public.next_entry_number(orig.company_id);
  uid := auth.uid();
  INSERT INTO public.journal_entries(company_id, entry_number, entry_date, description, source, source_id, status, created_by, reverses_entry_id)
    VALUES(orig.company_id, new_num, CURRENT_DATE, 'REVERSO de asiento N° ' || orig.entry_number || ' — ' || orig.description,
           'reverso', orig.id, 'contabilizado', uid, orig.id)
    RETURNING id INTO new_id;

  INSERT INTO public.journal_lines(entry_id, account_id, debit, credit, description, line_order, cost_center_id)
    SELECT new_id, account_id, credit, debit, 'Reverso: ' || COALESCE(description,''), line_order, cost_center_id
    FROM public.journal_lines WHERE entry_id = orig.id ORDER BY line_order;

  UPDATE public.journal_entries SET reversed_by_entry_id = new_id, status = 'reversado' WHERE id = orig.id;
  RETURN new_id;
END;
$$;


--
-- Name: seed_chart_of_accounts(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.seed_chart_of_accounts(_company_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
$$;


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;


--
-- Name: trg_block_closed_period(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_block_closed_period() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: trg_invoice_delete_entry(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_invoice_delete_entry() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  DELETE FROM public.journal_entries
   WHERE source = TG_ARGV[0]::journal_source AND source_id = OLD.id;
  RETURN OLD;
END;
$$;


--
-- Name: trg_purchase_invoice_post(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_purchase_invoice_post() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN PERFORM public.post_purchase_invoice_entry(NEW.id); RETURN NEW; END; $$;


--
-- Name: trg_sales_invoice_post(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_sales_invoice_post() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN PERFORM public.post_sales_invoice_entry(NEW.id); RETURN NEW; END; $$;


--
-- Name: trg_withholding_post(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_withholding_post() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN PERFORM public.post_withholding_entry(NEW.id); RETURN NEW; END; $$;


--
-- Name: accounting_periods; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.accounting_periods (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    year integer NOT NULL,
    month integer NOT NULL,
    status text DEFAULT 'abierto'::text NOT NULL,
    closed_at timestamp with time zone,
    closed_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT accounting_periods_month_check CHECK (((month >= 1) AND (month <= 12))),
    CONSTRAINT accounting_periods_status_check CHECK ((status = ANY (ARRAY['abierto'::text, 'cerrado'::text])))
);


--
-- Name: chart_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chart_accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    parent_id uuid,
    code text NOT NULL,
    name text NOT NULL,
    account_type public.account_type NOT NULL,
    nature public.account_nature NOT NULL,
    level integer DEFAULT 1 NOT NULL,
    is_postable boolean DEFAULT true NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: companies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.companies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    rif text NOT NULL,
    legal_name text NOT NULL,
    trade_name text,
    fiscal_address text NOT NULL,
    tax_regime text DEFAULT 'ordinario'::text NOT NULL,
    phone text,
    email text,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    fiscal_year_start date DEFAULT (date_trunc('year'::text, now()))::date NOT NULL,
    fiscal_year_end date DEFAULT ((date_trunc('year'::text, now()) + '1 year -1 days'::interval))::date NOT NULL,
    current_period_month date DEFAULT (date_trunc('month'::text, now()))::date NOT NULL,
    accounts_level integer DEFAULT 5 NOT NULL,
    is_iva_withholding_agent boolean DEFAULT false NOT NULL,
    is_islr_withholding_agent boolean DEFAULT false NOT NULL,
    default_iva_withholding_rate numeric DEFAULT 75.00 NOT NULL,
    default_islr_withholding_rate numeric DEFAULT 0.00 NOT NULL,
    igtf_rate numeric DEFAULT 3.00 NOT NULL,
    CONSTRAINT companies_accounts_level_check CHECK (((accounts_level >= 1) AND (accounts_level <= 10)))
);


--
-- Name: company_accounting_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.company_accounting_configs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    default_purchase_account_id uuid,
    default_sales_account_id uuid,
    default_iva_credit_account_id uuid,
    default_iva_debt_account_id uuid,
    default_supplier_pay_account_id uuid,
    default_customer_collect_account_id uuid,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    default_iva_retention_account_id uuid,
    default_islr_retention_account_id uuid,
    default_cash_account_id uuid,
    default_bank_account_id uuid,
    default_usd_cash_account_id uuid,
    default_igtf_expense_account_id uuid,
    default_igtf_pay_account_id uuid,
    default_sales_exempt_account_id uuid,
    default_accounts_receivable_id uuid,
    default_accounts_payable_id uuid,
    default_iva_wh_receivable_account_id uuid,
    default_islr_wh_receivable_account_id uuid
);


--
-- Name: company_accounting_config; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.company_accounting_config WITH (security_invoker='true') AS
 SELECT company_id,
    default_sales_account_id AS sales_taxed_account,
    default_sales_exempt_account_id AS sales_exempt_account,
    default_iva_debt_account_id AS iva_debit_account,
    default_accounts_receivable_id AS accounts_receivable,
    default_purchase_account_id AS purchases_account,
    default_iva_credit_account_id AS iva_credit_account,
    default_accounts_payable_id AS accounts_payable,
    default_iva_retention_account_id AS iva_wh_payable,
    default_iva_wh_receivable_account_id AS iva_wh_receivable,
    default_islr_retention_account_id AS islr_wh_payable,
    default_islr_wh_receivable_account_id AS islr_wh_receivable,
    default_cash_account_id AS default_cash_account,
    created_at,
    updated_at
   FROM public.company_accounting_configs c;


--
-- Name: company_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.company_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: cost_centers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cost_centers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    parent_id uuid,
    code text NOT NULL,
    name text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    level integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    rif text NOT NULL,
    name text NOT NULL,
    contributor_type public.contributor_type DEFAULT 'ordinario'::public.contributor_type NOT NULL,
    address text,
    phone text,
    email text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: journal_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.journal_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    entry_number bigint NOT NULL,
    entry_date date NOT NULL,
    description text NOT NULL,
    source public.journal_source DEFAULT 'manual'::public.journal_source NOT NULL,
    source_id uuid,
    status public.journal_status DEFAULT 'borrador'::public.journal_status NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    reversed_by_entry_id uuid,
    reverses_entry_id uuid
);


--
-- Name: journal_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.journal_lines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    entry_id uuid NOT NULL,
    account_id uuid NOT NULL,
    debit numeric(18,2) DEFAULT 0 NOT NULL,
    credit numeric(18,2) DEFAULT 0 NOT NULL,
    description text,
    line_order integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    cost_center_id uuid
);


--
-- Name: purchase_igtf_ledger; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_igtf_ledger (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    payment_id uuid NOT NULL,
    operation_date date NOT NULL,
    invoice_number character varying(50) NOT NULL,
    supplier_rif character varying(20) NOT NULL,
    supplier_name character varying(100) NOT NULL,
    payment_amount_usd numeric(15,2) NOT NULL,
    exchange_rate numeric(15,4) NOT NULL,
    base_amount_bs numeric(15,2) NOT NULL,
    igtf_rate numeric(5,2) DEFAULT 3.00 NOT NULL,
    igtf_retained_bs numeric(15,2) NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


--
-- Name: purchase_invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_invoices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    supplier_id uuid NOT NULL,
    invoice_number text NOT NULL,
    control_number text NOT NULL,
    invoice_date date NOT NULL,
    base_amount numeric(14,2) DEFAULT 0 NOT NULL,
    exempt_amount numeric(14,2) DEFAULT 0 NOT NULL,
    iva_rate numeric(5,2) DEFAULT 16.00 NOT NULL,
    iva_amount numeric(14,2) DEFAULT 0 NOT NULL,
    total_amount numeric(14,2) DEFAULT 0 NOT NULL,
    status public.invoice_status DEFAULT 'emitida'::public.invoice_status NOT NULL,
    notes text,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    cost_center_id uuid,
    document_type text DEFAULT 'factura'::text,
    affected_invoice_number text,
    affected_control_number text,
    apply_iva_retention boolean DEFAULT false,
    iva_retention_percentage numeric(5,2) DEFAULT 75.00,
    apply_islr_retention boolean DEFAULT false,
    islr_concept_code character varying(10),
    islr_retention_percentage numeric(5,2) DEFAULT 0.00
);


--
-- Name: purchase_islr_retentions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_islr_retentions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    invoice_id uuid NOT NULL,
    retention_number character varying(20) NOT NULL,
    retention_date date NOT NULL,
    concept_code character varying(10) NOT NULL,
    retention_percentage numeric(5,2) NOT NULL,
    subtraction_amount numeric(15,2) DEFAULT 0.00 NOT NULL,
    base_amount numeric(15,2) NOT NULL,
    retained_amount numeric(15,2) NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_by uuid
);


--
-- Name: purchase_iva_retentions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_iva_retentions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    invoice_id uuid NOT NULL,
    retention_number character varying(14) NOT NULL,
    retention_date date NOT NULL,
    retention_percentage numeric(5,2) DEFAULT 75.00 NOT NULL,
    base_amount numeric(15,2) NOT NULL,
    iva_amount numeric(15,2) NOT NULL,
    retained_amount numeric(15,2) NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_by uuid
);


--
-- Name: purchase_payment_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_payment_lines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    payment_id uuid NOT NULL,
    method public.payment_method_type DEFAULT 'efectivo'::public.payment_method_type NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    amount_currency numeric DEFAULT 0 NOT NULL,
    exchange_rate numeric DEFAULT 1 NOT NULL,
    amount_usd numeric DEFAULT 0 NOT NULL,
    account_id uuid NOT NULL,
    apply_igtf boolean DEFAULT false NOT NULL,
    igtf_amount numeric DEFAULT 0 NOT NULL,
    reference_number text,
    line_order integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: purchase_payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    invoice_id uuid NOT NULL,
    payment_date date DEFAULT CURRENT_DATE NOT NULL,
    payment_method public.payment_method_type NOT NULL,
    amount_paid numeric(15,2) NOT NULL,
    amount_in_bs numeric(15,2) DEFAULT 0.00,
    amount_in_usd numeric(15,2) DEFAULT 0.00,
    exchange_rate numeric(15,4) DEFAULT 1.00,
    apply_igtf boolean DEFAULT false,
    igtf_amount numeric(15,2) DEFAULT 0.00,
    reference_number character varying(50),
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_by uuid,
    currency text DEFAULT 'USD'::text NOT NULL,
    payment_account_id uuid,
    iva_retention_percentage numeric DEFAULT 0 NOT NULL,
    iva_retained_amount numeric DEFAULT 0 NOT NULL,
    islr_retention_percentage numeric DEFAULT 0 NOT NULL,
    islr_retained_amount numeric DEFAULT 0 NOT NULL,
    iva_retention_number text,
    islr_retention_number text,
    notes text,
    accounting_currency text DEFAULT 'USD'::text NOT NULL,
    CONSTRAINT purchase_payments_accounting_currency_check CHECK ((accounting_currency = ANY (ARRAY['USD'::text, 'VES'::text])))
);


--
-- Name: COLUMN purchase_payments.accounting_currency; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.purchase_payments.accounting_currency IS 'Accounting unit of amount_paid, retentions and IGTF. Legacy records retain USD behavior; new office payments use VES.';


--
-- Name: sales_collection_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_collection_lines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    collection_id uuid NOT NULL,
    method public.payment_method_type DEFAULT 'efectivo'::public.payment_method_type NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    amount_currency numeric DEFAULT 0 NOT NULL,
    exchange_rate numeric DEFAULT 1 NOT NULL,
    amount_usd numeric DEFAULT 0 NOT NULL,
    account_id uuid NOT NULL,
    apply_igtf boolean DEFAULT false NOT NULL,
    igtf_amount numeric DEFAULT 0 NOT NULL,
    reference_number text,
    line_order integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: sales_collections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_collections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    invoice_id uuid NOT NULL,
    collection_date date DEFAULT CURRENT_DATE NOT NULL,
    collection_method public.payment_method_type DEFAULT 'efectivo'::public.payment_method_type NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    amount_collected numeric DEFAULT 0 NOT NULL,
    amount_in_usd numeric DEFAULT 0 NOT NULL,
    amount_in_bs numeric DEFAULT 0 NOT NULL,
    exchange_rate numeric DEFAULT 1 NOT NULL,
    apply_igtf boolean DEFAULT false NOT NULL,
    igtf_amount numeric DEFAULT 0 NOT NULL,
    reference_number text,
    collection_account_id uuid,
    iva_retention_percentage numeric DEFAULT 0 NOT NULL,
    iva_retained_amount numeric DEFAULT 0 NOT NULL,
    islr_retention_percentage numeric DEFAULT 0 NOT NULL,
    islr_retained_amount numeric DEFAULT 0 NOT NULL,
    iva_retention_number text,
    islr_retention_number text,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    accounting_currency text DEFAULT 'USD'::text NOT NULL,
    CONSTRAINT sales_collections_accounting_currency_check CHECK ((accounting_currency = ANY (ARRAY['USD'::text, 'VES'::text])))
);


--
-- Name: COLUMN sales_collections.accounting_currency; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sales_collections.accounting_currency IS 'Accounting unit of amount_collected, retentions and IGTF. Legacy records retain USD behavior; new collections use VES.';


--
-- Name: sales_igtf_ledger; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_igtf_ledger (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    collection_id uuid NOT NULL,
    operation_date date NOT NULL,
    invoice_number text NOT NULL,
    customer_rif text DEFAULT ''::text NOT NULL,
    customer_name text DEFAULT ''::text NOT NULL,
    collection_amount_usd numeric DEFAULT 0 NOT NULL,
    exchange_rate numeric DEFAULT 1 NOT NULL,
    base_amount_bs numeric DEFAULT 0 NOT NULL,
    igtf_rate numeric DEFAULT 3 NOT NULL,
    igtf_charged_bs numeric DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: sales_invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_invoices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    invoice_number text NOT NULL,
    control_number text NOT NULL,
    invoice_date date NOT NULL,
    base_amount numeric(14,2) DEFAULT 0 NOT NULL,
    exempt_amount numeric(14,2) DEFAULT 0 NOT NULL,
    iva_rate numeric(5,2) DEFAULT 16.00 NOT NULL,
    iva_amount numeric(14,2) DEFAULT 0 NOT NULL,
    total_amount numeric(14,2) DEFAULT 0 NOT NULL,
    status public.invoice_status DEFAULT 'emitida'::public.invoice_status NOT NULL,
    notes text,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    cost_center_id uuid,
    document_type text DEFAULT 'FACTURA'::text NOT NULL,
    affected_invoice_number text,
    affected_control_number text
);


--
-- Name: sales_islr_retentions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_islr_retentions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    invoice_id uuid NOT NULL,
    collection_id uuid,
    retention_number text NOT NULL,
    retention_date date NOT NULL,
    concept_code text DEFAULT '000'::text NOT NULL,
    retention_percentage numeric DEFAULT 0 NOT NULL,
    subtraction_amount numeric DEFAULT 0 NOT NULL,
    base_amount numeric DEFAULT 0 NOT NULL,
    retained_amount numeric DEFAULT 0 NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: sales_iva_retentions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_iva_retentions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    invoice_id uuid NOT NULL,
    collection_id uuid,
    retention_number text NOT NULL,
    retention_date date NOT NULL,
    retention_percentage numeric DEFAULT 75 NOT NULL,
    base_amount numeric DEFAULT 0 NOT NULL,
    iva_amount numeric DEFAULT 0 NOT NULL,
    retained_amount numeric DEFAULT 0 NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: suppliers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.suppliers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    rif text NOT NULL,
    name text NOT NULL,
    contributor_type public.contributor_type DEFAULT 'ordinario'::public.contributor_type NOT NULL,
    address text,
    phone text,
    email text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    code text,
    is_active boolean DEFAULT true NOT NULL,
    iva_account_id uuid,
    iva_withholding_rate numeric(5,2) DEFAULT 0 NOT NULL
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: v_pending_purchase_payments; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_pending_purchase_payments WITH (security_invoker='true') AS
 SELECT pi.id AS invoice_id,
    pi.company_id,
    pi.invoice_number,
    pi.invoice_date,
    pi.document_type,
    pi.total_amount AS original_total,
    s.id AS supplier_id,
    s.name AS supplier_name,
    s.rif AS supplier_rif,
    COALESCE(r_iva.retained_amount, 0.00) AS iva_retained,
    COALESCE(r_islr.retained_amount, 0.00) AS islr_retained,
    (r_iva.id IS NOT NULL) AS was_iva_retained,
    (r_islr.id IS NOT NULL) AS was_islr_retained,
    ((pi.total_amount - COALESCE(r_iva.retained_amount, 0.00)) - COALESCE(r_islr.retained_amount, 0.00)) AS net_amount_to_pay,
    (((pi.total_amount - COALESCE(r_iva.retained_amount, 0.00)) - COALESCE(r_islr.retained_amount, 0.00)) - COALESCE(( SELECT sum(purchase_payments.amount_paid) AS sum
           FROM public.purchase_payments
          WHERE (purchase_payments.invoice_id = pi.id)), 0.00)) AS remaining_balance
   FROM (((public.purchase_invoices pi
     JOIN public.suppliers s ON ((pi.supplier_id = s.id)))
     LEFT JOIN public.purchase_iva_retentions r_iva ON ((pi.id = r_iva.invoice_id)))
     LEFT JOIN public.purchase_islr_retentions r_islr ON ((pi.id = r_islr.invoice_id)))
  WHERE ((((pi.total_amount - COALESCE(r_iva.retained_amount, 0.00)) - COALESCE(r_islr.retained_amount, 0.00)) - COALESCE(( SELECT sum(purchase_payments.amount_paid) AS sum
           FROM public.purchase_payments
          WHERE (purchase_payments.invoice_id = pi.id)), 0.00)) > 0.00);


--
-- Name: withholdings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.withholdings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    type public.withholding_type NOT NULL,
    receipt_number text NOT NULL,
    withholding_date date NOT NULL,
    purchase_invoice_id uuid,
    sales_invoice_id uuid,
    base_amount numeric(14,2) DEFAULT 0 NOT NULL,
    rate numeric(5,2) DEFAULT 0 NOT NULL,
    amount numeric(14,2) DEFAULT 0 NOT NULL,
    notes text,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: accounting_periods accounting_periods_company_id_year_month_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounting_periods
    ADD CONSTRAINT accounting_periods_company_id_year_month_key UNIQUE (company_id, year, month);


--
-- Name: accounting_periods accounting_periods_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounting_periods
    ADD CONSTRAINT accounting_periods_pkey PRIMARY KEY (id);


--
-- Name: chart_accounts chart_accounts_company_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chart_accounts
    ADD CONSTRAINT chart_accounts_company_id_code_key UNIQUE (company_id, code);


--
-- Name: chart_accounts chart_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chart_accounts
    ADD CONSTRAINT chart_accounts_pkey PRIMARY KEY (id);


--
-- Name: companies companies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_pkey PRIMARY KEY (id);


--
-- Name: companies companies_rif_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_rif_key UNIQUE (rif);


--
-- Name: company_accounting_configs company_accounting_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_accounting_configs
    ADD CONSTRAINT company_accounting_configs_pkey PRIMARY KEY (id);


--
-- Name: company_members company_members_company_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_members
    ADD CONSTRAINT company_members_company_id_user_id_key UNIQUE (company_id, user_id);


--
-- Name: company_members company_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_members
    ADD CONSTRAINT company_members_pkey PRIMARY KEY (id);


--
-- Name: cost_centers cost_centers_company_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_centers
    ADD CONSTRAINT cost_centers_company_id_code_key UNIQUE (company_id, code);


--
-- Name: cost_centers cost_centers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_centers
    ADD CONSTRAINT cost_centers_pkey PRIMARY KEY (id);


--
-- Name: customers customers_company_id_rif_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_company_id_rif_key UNIQUE (company_id, rif);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: journal_entries journal_entries_company_id_entry_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_entries
    ADD CONSTRAINT journal_entries_company_id_entry_number_key UNIQUE (company_id, entry_number);


--
-- Name: journal_entries journal_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_entries
    ADD CONSTRAINT journal_entries_pkey PRIMARY KEY (id);


--
-- Name: journal_lines journal_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_lines
    ADD CONSTRAINT journal_lines_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: purchase_igtf_ledger purchase_igtf_ledger_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_igtf_ledger
    ADD CONSTRAINT purchase_igtf_ledger_pkey PRIMARY KEY (id);


--
-- Name: purchase_invoices purchase_invoices_company_id_supplier_id_invoice_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_invoices
    ADD CONSTRAINT purchase_invoices_company_id_supplier_id_invoice_number_key UNIQUE (company_id, supplier_id, invoice_number);


--
-- Name: purchase_invoices purchase_invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_invoices
    ADD CONSTRAINT purchase_invoices_pkey PRIMARY KEY (id);


--
-- Name: purchase_islr_retentions purchase_islr_retentions_invoice_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_islr_retentions
    ADD CONSTRAINT purchase_islr_retentions_invoice_id_key UNIQUE (invoice_id);


--
-- Name: purchase_islr_retentions purchase_islr_retentions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_islr_retentions
    ADD CONSTRAINT purchase_islr_retentions_pkey PRIMARY KEY (id);


--
-- Name: purchase_iva_retentions purchase_iva_retentions_invoice_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_iva_retentions
    ADD CONSTRAINT purchase_iva_retentions_invoice_id_key UNIQUE (invoice_id);


--
-- Name: purchase_iva_retentions purchase_iva_retentions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_iva_retentions
    ADD CONSTRAINT purchase_iva_retentions_pkey PRIMARY KEY (id);


--
-- Name: purchase_iva_retentions purchase_iva_retentions_retention_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_iva_retentions
    ADD CONSTRAINT purchase_iva_retentions_retention_number_key UNIQUE (retention_number);


--
-- Name: purchase_payment_lines purchase_payment_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_payment_lines
    ADD CONSTRAINT purchase_payment_lines_pkey PRIMARY KEY (id);


--
-- Name: purchase_payments purchase_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_payments
    ADD CONSTRAINT purchase_payments_pkey PRIMARY KEY (id);


--
-- Name: sales_collection_lines sales_collection_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_collection_lines
    ADD CONSTRAINT sales_collection_lines_pkey PRIMARY KEY (id);


--
-- Name: sales_collections sales_collections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_collections
    ADD CONSTRAINT sales_collections_pkey PRIMARY KEY (id);


--
-- Name: sales_igtf_ledger sales_igtf_ledger_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_igtf_ledger
    ADD CONSTRAINT sales_igtf_ledger_pkey PRIMARY KEY (id);


--
-- Name: sales_invoices sales_invoices_company_id_invoice_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_invoices
    ADD CONSTRAINT sales_invoices_company_id_invoice_number_key UNIQUE (company_id, invoice_number);


--
-- Name: sales_invoices sales_invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_invoices
    ADD CONSTRAINT sales_invoices_pkey PRIMARY KEY (id);


--
-- Name: sales_islr_retentions sales_islr_retentions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_islr_retentions
    ADD CONSTRAINT sales_islr_retentions_pkey PRIMARY KEY (id);


--
-- Name: sales_iva_retentions sales_iva_retentions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_iva_retentions
    ADD CONSTRAINT sales_iva_retentions_pkey PRIMARY KEY (id);


--
-- Name: suppliers suppliers_company_id_rif_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_company_id_rif_key UNIQUE (company_id, rif);


--
-- Name: suppliers suppliers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_pkey PRIMARY KEY (id);


--
-- Name: company_accounting_configs unique_company_config; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_accounting_configs
    ADD CONSTRAINT unique_company_config UNIQUE (company_id);


--
-- Name: purchase_islr_retentions unique_company_islr_retention_num; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_islr_retentions
    ADD CONSTRAINT unique_company_islr_retention_num UNIQUE (company_id, retention_number);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);


--
-- Name: withholdings withholdings_company_id_type_receipt_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.withholdings
    ADD CONSTRAINT withholdings_company_id_type_receipt_number_key UNIQUE (company_id, type, receipt_number);


--
-- Name: withholdings withholdings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.withholdings
    ADD CONSTRAINT withholdings_pkey PRIMARY KEY (id);


--
-- Name: company_members_company_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX company_members_company_id_idx ON public.company_members USING btree (company_id);


--
-- Name: company_members_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX company_members_user_id_idx ON public.company_members USING btree (user_id);


--
-- Name: idx_chart_accounts_company; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chart_accounts_company ON public.chart_accounts USING btree (company_id);


--
-- Name: idx_chart_accounts_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chart_accounts_parent ON public.chart_accounts USING btree (parent_id);


--
-- Name: idx_je_company_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_je_company_date ON public.journal_entries USING btree (company_id, entry_date);


--
-- Name: idx_je_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_je_source ON public.journal_entries USING btree (source, source_id);


--
-- Name: idx_jl_account; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_jl_account ON public.journal_lines USING btree (account_id);


--
-- Name: idx_jl_entry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_jl_entry ON public.journal_lines USING btree (entry_id);


--
-- Name: idx_suppliers_company_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_suppliers_company_code ON public.suppliers USING btree (company_id, code);


--
-- Name: purchase_invoices_company_id_invoice_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX purchase_invoices_company_id_invoice_date_idx ON public.purchase_invoices USING btree (company_id, invoice_date);


--
-- Name: sales_invoices_company_id_invoice_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sales_invoices_company_id_invoice_date_idx ON public.sales_invoices USING btree (company_id, invoice_date);


--
-- Name: withholdings_company_id_withholding_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX withholdings_company_id_withholding_date_idx ON public.withholdings USING btree (company_id, withholding_date);


--
-- Name: accounting_periods trg_ap_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ap_updated_at BEFORE UPDATE ON public.accounting_periods FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: chart_accounts trg_chart_accounts_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_chart_accounts_updated BEFORE UPDATE ON public.chart_accounts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: companies trg_companies_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_companies_updated BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: cost_centers trg_cost_centers_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cost_centers_updated BEFORE UPDATE ON public.cost_centers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: customers trg_customers_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_customers_updated BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: journal_entries trg_je_closed_period; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_je_closed_period BEFORE INSERT OR DELETE OR UPDATE ON public.journal_entries FOR EACH ROW EXECUTE FUNCTION public.trg_block_closed_period();


--
-- Name: journal_entries trg_je_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_je_updated BEFORE UPDATE ON public.journal_entries FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: purchase_payment_lines trg_ppl_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ppl_updated BEFORE UPDATE ON public.purchase_payment_lines FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: profiles trg_profiles_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: purchase_invoices trg_purchase_invoice_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_purchase_invoice_delete BEFORE DELETE ON public.purchase_invoices FOR EACH ROW EXECUTE FUNCTION public.trg_invoice_delete_entry('purchase_invoice');


--
-- Name: purchase_invoices trg_purchases_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_purchases_updated BEFORE UPDATE ON public.purchase_invoices FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: sales_invoices trg_sales_invoice_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sales_invoice_delete BEFORE DELETE ON public.sales_invoices FOR EACH ROW EXECUTE FUNCTION public.trg_invoice_delete_entry('sales_invoice');


--
-- Name: sales_invoices trg_sales_invoice_post; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sales_invoice_post AFTER INSERT OR UPDATE ON public.sales_invoices FOR EACH ROW EXECUTE FUNCTION public.trg_sales_invoice_post();


--
-- Name: sales_invoices trg_sales_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sales_updated BEFORE UPDATE ON public.sales_invoices FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: sales_collections trg_sc_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sc_updated BEFORE UPDATE ON public.sales_collections FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: sales_collection_lines trg_scl_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_scl_updated BEFORE UPDATE ON public.sales_collection_lines FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: sales_islr_retentions trg_sisr_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sisr_updated BEFORE UPDATE ON public.sales_islr_retentions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: sales_iva_retentions trg_sivr_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sivr_updated BEFORE UPDATE ON public.sales_iva_retentions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: suppliers trg_suppliers_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_suppliers_updated BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: withholdings trg_withholding_post; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_withholding_post AFTER INSERT ON public.withholdings FOR EACH ROW EXECUTE FUNCTION public.trg_withholding_post();


--
-- Name: purchase_invoices trigger_purchase_invoice_journal_clean; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_purchase_invoice_journal_clean AFTER INSERT OR UPDATE ON public.purchase_invoices FOR EACH ROW EXECUTE FUNCTION public.process_purchase_invoice_journal_entry();


--
-- Name: accounting_periods accounting_periods_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounting_periods
    ADD CONSTRAINT accounting_periods_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: chart_accounts chart_accounts_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chart_accounts
    ADD CONSTRAINT chart_accounts_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: chart_accounts chart_accounts_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chart_accounts
    ADD CONSTRAINT chart_accounts_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.chart_accounts(id) ON DELETE RESTRICT;


--
-- Name: companies companies_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: company_accounting_configs company_accounting_configs_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_accounting_configs
    ADD CONSTRAINT company_accounting_configs_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: company_accounting_configs company_accounting_configs_default_accounts_payable_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_accounting_configs
    ADD CONSTRAINT company_accounting_configs_default_accounts_payable_id_fkey FOREIGN KEY (default_accounts_payable_id) REFERENCES public.chart_accounts(id);


--
-- Name: company_accounting_configs company_accounting_configs_default_accounts_receivable_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_accounting_configs
    ADD CONSTRAINT company_accounting_configs_default_accounts_receivable_id_fkey FOREIGN KEY (default_accounts_receivable_id) REFERENCES public.chart_accounts(id);


--
-- Name: company_accounting_configs company_accounting_configs_default_bank_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_accounting_configs
    ADD CONSTRAINT company_accounting_configs_default_bank_account_id_fkey FOREIGN KEY (default_bank_account_id) REFERENCES public.chart_accounts(id);


--
-- Name: company_accounting_configs company_accounting_configs_default_cash_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_accounting_configs
    ADD CONSTRAINT company_accounting_configs_default_cash_account_id_fkey FOREIGN KEY (default_cash_account_id) REFERENCES public.chart_accounts(id);


--
-- Name: company_accounting_configs company_accounting_configs_default_igtf_expense_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_accounting_configs
    ADD CONSTRAINT company_accounting_configs_default_igtf_expense_account_id_fkey FOREIGN KEY (default_igtf_expense_account_id) REFERENCES public.chart_accounts(id);


--
-- Name: company_accounting_configs company_accounting_configs_default_igtf_pay_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_accounting_configs
    ADD CONSTRAINT company_accounting_configs_default_igtf_pay_account_id_fkey FOREIGN KEY (default_igtf_pay_account_id) REFERENCES public.chart_accounts(id);


--
-- Name: company_accounting_configs company_accounting_configs_default_islr_retention_account__fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_accounting_configs
    ADD CONSTRAINT company_accounting_configs_default_islr_retention_account__fkey FOREIGN KEY (default_islr_retention_account_id) REFERENCES public.chart_accounts(id);


--
-- Name: company_accounting_configs company_accounting_configs_default_islr_wh_receivable_acco_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_accounting_configs
    ADD CONSTRAINT company_accounting_configs_default_islr_wh_receivable_acco_fkey FOREIGN KEY (default_islr_wh_receivable_account_id) REFERENCES public.chart_accounts(id);


--
-- Name: company_accounting_configs company_accounting_configs_default_iva_retention_account_i_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_accounting_configs
    ADD CONSTRAINT company_accounting_configs_default_iva_retention_account_i_fkey FOREIGN KEY (default_iva_retention_account_id) REFERENCES public.chart_accounts(id);


--
-- Name: company_accounting_configs company_accounting_configs_default_iva_wh_receivable_accou_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_accounting_configs
    ADD CONSTRAINT company_accounting_configs_default_iva_wh_receivable_accou_fkey FOREIGN KEY (default_iva_wh_receivable_account_id) REFERENCES public.chart_accounts(id);


--
-- Name: company_accounting_configs company_accounting_configs_default_sales_exempt_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_accounting_configs
    ADD CONSTRAINT company_accounting_configs_default_sales_exempt_account_id_fkey FOREIGN KEY (default_sales_exempt_account_id) REFERENCES public.chart_accounts(id);


--
-- Name: company_accounting_configs company_accounting_configs_default_usd_cash_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_accounting_configs
    ADD CONSTRAINT company_accounting_configs_default_usd_cash_account_id_fkey FOREIGN KEY (default_usd_cash_account_id) REFERENCES public.chart_accounts(id);


--
-- Name: company_members company_members_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_members
    ADD CONSTRAINT company_members_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: company_members company_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_members
    ADD CONSTRAINT company_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: cost_centers cost_centers_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_centers
    ADD CONSTRAINT cost_centers_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: cost_centers cost_centers_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_centers
    ADD CONSTRAINT cost_centers_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.cost_centers(id) ON DELETE CASCADE;


--
-- Name: customers customers_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: journal_entries journal_entries_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_entries
    ADD CONSTRAINT journal_entries_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: journal_entries journal_entries_reversed_by_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_entries
    ADD CONSTRAINT journal_entries_reversed_by_entry_id_fkey FOREIGN KEY (reversed_by_entry_id) REFERENCES public.journal_entries(id) ON DELETE SET NULL;


--
-- Name: journal_entries journal_entries_reverses_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_entries
    ADD CONSTRAINT journal_entries_reverses_entry_id_fkey FOREIGN KEY (reverses_entry_id) REFERENCES public.journal_entries(id) ON DELETE SET NULL;


--
-- Name: journal_lines journal_lines_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_lines
    ADD CONSTRAINT journal_lines_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.chart_accounts(id) ON DELETE RESTRICT;


--
-- Name: journal_lines journal_lines_cost_center_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_lines
    ADD CONSTRAINT journal_lines_cost_center_id_fkey FOREIGN KEY (cost_center_id) REFERENCES public.cost_centers(id) ON DELETE SET NULL;


--
-- Name: journal_lines journal_lines_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_lines
    ADD CONSTRAINT journal_lines_entry_id_fkey FOREIGN KEY (entry_id) REFERENCES public.journal_entries(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: purchase_igtf_ledger purchase_igtf_ledger_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_igtf_ledger
    ADD CONSTRAINT purchase_igtf_ledger_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);


--
-- Name: purchase_igtf_ledger purchase_igtf_ledger_payment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_igtf_ledger
    ADD CONSTRAINT purchase_igtf_ledger_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES public.purchase_payments(id) ON DELETE CASCADE;


--
-- Name: purchase_invoices purchase_invoices_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_invoices
    ADD CONSTRAINT purchase_invoices_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: purchase_invoices purchase_invoices_cost_center_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_invoices
    ADD CONSTRAINT purchase_invoices_cost_center_id_fkey FOREIGN KEY (cost_center_id) REFERENCES public.cost_centers(id) ON DELETE SET NULL;


--
-- Name: purchase_invoices purchase_invoices_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_invoices
    ADD CONSTRAINT purchase_invoices_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: purchase_invoices purchase_invoices_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_invoices
    ADD CONSTRAINT purchase_invoices_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id);


--
-- Name: purchase_islr_retentions purchase_islr_retentions_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_islr_retentions
    ADD CONSTRAINT purchase_islr_retentions_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);


--
-- Name: purchase_islr_retentions purchase_islr_retentions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_islr_retentions
    ADD CONSTRAINT purchase_islr_retentions_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: purchase_islr_retentions purchase_islr_retentions_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_islr_retentions
    ADD CONSTRAINT purchase_islr_retentions_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.purchase_invoices(id) ON DELETE CASCADE;


--
-- Name: purchase_iva_retentions purchase_iva_retentions_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_iva_retentions
    ADD CONSTRAINT purchase_iva_retentions_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);


--
-- Name: purchase_iva_retentions purchase_iva_retentions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_iva_retentions
    ADD CONSTRAINT purchase_iva_retentions_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: purchase_iva_retentions purchase_iva_retentions_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_iva_retentions
    ADD CONSTRAINT purchase_iva_retentions_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.purchase_invoices(id) ON DELETE CASCADE;


--
-- Name: purchase_payment_lines purchase_payment_lines_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_payment_lines
    ADD CONSTRAINT purchase_payment_lines_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.chart_accounts(id);


--
-- Name: purchase_payment_lines purchase_payment_lines_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_payment_lines
    ADD CONSTRAINT purchase_payment_lines_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: purchase_payment_lines purchase_payment_lines_payment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_payment_lines
    ADD CONSTRAINT purchase_payment_lines_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES public.purchase_payments(id) ON DELETE CASCADE;


--
-- Name: purchase_payments purchase_payments_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_payments
    ADD CONSTRAINT purchase_payments_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);


--
-- Name: purchase_payments purchase_payments_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_payments
    ADD CONSTRAINT purchase_payments_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: purchase_payments purchase_payments_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_payments
    ADD CONSTRAINT purchase_payments_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.purchase_invoices(id) ON DELETE CASCADE;


--
-- Name: purchase_payments purchase_payments_payment_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_payments
    ADD CONSTRAINT purchase_payments_payment_account_id_fkey FOREIGN KEY (payment_account_id) REFERENCES public.chart_accounts(id);


--
-- Name: sales_collection_lines sales_collection_lines_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_collection_lines
    ADD CONSTRAINT sales_collection_lines_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.chart_accounts(id);


--
-- Name: sales_collection_lines sales_collection_lines_collection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_collection_lines
    ADD CONSTRAINT sales_collection_lines_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES public.sales_collections(id) ON DELETE CASCADE;


--
-- Name: sales_collection_lines sales_collection_lines_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_collection_lines
    ADD CONSTRAINT sales_collection_lines_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: sales_collections sales_collections_collection_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_collections
    ADD CONSTRAINT sales_collections_collection_account_id_fkey FOREIGN KEY (collection_account_id) REFERENCES public.chart_accounts(id);


--
-- Name: sales_collections sales_collections_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_collections
    ADD CONSTRAINT sales_collections_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: sales_collections sales_collections_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_collections
    ADD CONSTRAINT sales_collections_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: sales_collections sales_collections_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_collections
    ADD CONSTRAINT sales_collections_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.sales_invoices(id) ON DELETE CASCADE;


--
-- Name: sales_igtf_ledger sales_igtf_ledger_collection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_igtf_ledger
    ADD CONSTRAINT sales_igtf_ledger_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES public.sales_collections(id) ON DELETE CASCADE;


--
-- Name: sales_igtf_ledger sales_igtf_ledger_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_igtf_ledger
    ADD CONSTRAINT sales_igtf_ledger_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: sales_invoices sales_invoices_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_invoices
    ADD CONSTRAINT sales_invoices_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: sales_invoices sales_invoices_cost_center_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_invoices
    ADD CONSTRAINT sales_invoices_cost_center_id_fkey FOREIGN KEY (cost_center_id) REFERENCES public.cost_centers(id) ON DELETE SET NULL;


--
-- Name: sales_invoices sales_invoices_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_invoices
    ADD CONSTRAINT sales_invoices_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: sales_invoices sales_invoices_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_invoices
    ADD CONSTRAINT sales_invoices_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: sales_islr_retentions sales_islr_retentions_collection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_islr_retentions
    ADD CONSTRAINT sales_islr_retentions_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES public.sales_collections(id) ON DELETE CASCADE;


--
-- Name: sales_islr_retentions sales_islr_retentions_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_islr_retentions
    ADD CONSTRAINT sales_islr_retentions_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: sales_islr_retentions sales_islr_retentions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_islr_retentions
    ADD CONSTRAINT sales_islr_retentions_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: sales_islr_retentions sales_islr_retentions_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_islr_retentions
    ADD CONSTRAINT sales_islr_retentions_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.sales_invoices(id) ON DELETE CASCADE;


--
-- Name: sales_iva_retentions sales_iva_retentions_collection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_iva_retentions
    ADD CONSTRAINT sales_iva_retentions_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES public.sales_collections(id) ON DELETE CASCADE;


--
-- Name: sales_iva_retentions sales_iva_retentions_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_iva_retentions
    ADD CONSTRAINT sales_iva_retentions_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: sales_iva_retentions sales_iva_retentions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_iva_retentions
    ADD CONSTRAINT sales_iva_retentions_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: sales_iva_retentions sales_iva_retentions_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_iva_retentions
    ADD CONSTRAINT sales_iva_retentions_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.sales_invoices(id) ON DELETE CASCADE;


--
-- Name: suppliers suppliers_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: suppliers suppliers_iva_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_iva_account_id_fkey FOREIGN KEY (iva_account_id) REFERENCES public.chart_accounts(id) ON DELETE SET NULL;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: withholdings withholdings_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.withholdings
    ADD CONSTRAINT withholdings_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: withholdings withholdings_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.withholdings
    ADD CONSTRAINT withholdings_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: withholdings withholdings_purchase_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.withholdings
    ADD CONSTRAINT withholdings_purchase_invoice_id_fkey FOREIGN KEY (purchase_invoice_id) REFERENCES public.purchase_invoices(id) ON DELETE SET NULL;


--
-- Name: withholdings withholdings_sales_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.withholdings
    ADD CONSTRAINT withholdings_sales_invoice_id_fkey FOREIGN KEY (sales_invoice_id) REFERENCES public.sales_invoices(id) ON DELETE SET NULL;


--
-- Name: user_roles Permitir lectura de propio rol o si es Admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Permitir lectura de propio rol o si es Admin" ON public.user_roles FOR SELECT TO authenticated USING (((auth.uid() = user_id) OR public.is_admin()));


--
-- Name: user_roles Solo Admin puede modificar roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Solo Admin puede modificar roles" ON public.user_roles TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: accounting_periods; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.accounting_periods ENABLE ROW LEVEL SECURITY;

--
-- Name: company_accounting_configs cfgs delete admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "cfgs delete admin" ON public.company_accounting_configs FOR DELETE TO authenticated USING (public.company_has_role(auth.uid(), company_id, ARRAY['admin'::public.app_role]));


--
-- Name: company_accounting_configs cfgs insert admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "cfgs insert admin" ON public.company_accounting_configs FOR INSERT TO authenticated WITH CHECK (public.company_has_role(auth.uid(), company_id, ARRAY['admin'::public.app_role, 'contador'::public.app_role]));


--
-- Name: company_accounting_configs cfgs read members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "cfgs read members" ON public.company_accounting_configs FOR SELECT TO authenticated USING (public.is_company_member(auth.uid(), company_id));


--
-- Name: company_accounting_configs cfgs update admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "cfgs update admin" ON public.company_accounting_configs FOR UPDATE TO authenticated USING (public.company_has_role(auth.uid(), company_id, ARRAY['admin'::public.app_role, 'contador'::public.app_role])) WITH CHECK (public.company_has_role(auth.uid(), company_id, ARRAY['admin'::public.app_role, 'contador'::public.app_role]));


--
-- Name: chart_accounts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chart_accounts ENABLE ROW LEVEL SECURITY;

--
-- Name: companies; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

--
-- Name: companies companies_delete_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY companies_delete_admin ON public.companies FOR DELETE TO authenticated USING (public.company_has_role(auth.uid(), id, ARRAY['admin'::public.app_role]));


--
-- Name: companies companies_insert_authenticated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY companies_insert_authenticated ON public.companies FOR INSERT TO authenticated WITH CHECK ((auth.uid() = created_by));


--
-- Name: companies companies_select_members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY companies_select_members ON public.companies FOR SELECT TO authenticated USING ((public.is_company_member(auth.uid(), id) OR (auth.uid() = created_by)));


--
-- Name: companies companies_update_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY companies_update_admin ON public.companies FOR UPDATE TO authenticated USING (public.company_has_role(auth.uid(), id, ARRAY['admin'::public.app_role])) WITH CHECK (public.company_has_role(auth.uid(), id, ARRAY['admin'::public.app_role]));


--
-- Name: company_accounting_configs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.company_accounting_configs ENABLE ROW LEVEL SECURITY;

--
-- Name: company_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.company_members ENABLE ROW LEVEL SECURITY;

--
-- Name: cost_centers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cost_centers ENABLE ROW LEVEL SECURITY;

--
-- Name: customers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

--
-- Name: customers customers_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY customers_delete ON public.customers FOR DELETE TO authenticated USING (public.company_has_role(auth.uid(), company_id, ARRAY['admin'::public.app_role, 'contador'::public.app_role]));


--
-- Name: customers customers_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY customers_select ON public.customers FOR SELECT TO authenticated USING (public.is_company_member(auth.uid(), company_id));


--
-- Name: customers customers_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY customers_update ON public.customers FOR UPDATE TO authenticated USING (public.company_has_role(auth.uid(), company_id, ARRAY['admin'::public.app_role, 'contador'::public.app_role]));


--
-- Name: customers customers_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY customers_write ON public.customers FOR INSERT TO authenticated WITH CHECK (public.company_has_role(auth.uid(), company_id, ARRAY['admin'::public.app_role, 'contador'::public.app_role, 'operador'::public.app_role]));


--
-- Name: accounting_periods del ap; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "del ap" ON public.accounting_periods FOR DELETE TO authenticated USING (public.company_has_role(auth.uid(), company_id, ARRAY['admin'::public.app_role]));


--
-- Name: journal_entries del je; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "del je" ON public.journal_entries FOR DELETE TO authenticated USING ((public.company_has_role(auth.uid(), company_id, ARRAY['admin'::public.app_role]) AND (status = 'borrador'::public.journal_status)));


--
-- Name: journal_lines del jl; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "del jl" ON public.journal_lines FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.journal_entries e
  WHERE ((e.id = journal_lines.entry_id) AND public.company_has_role(auth.uid(), e.company_id, ARRAY['admin'::public.app_role, 'contador'::public.app_role])))));


--
-- Name: chart_accounts delete chart; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "delete chart" ON public.chart_accounts FOR DELETE TO authenticated USING (public.company_has_role(auth.uid(), company_id, ARRAY['admin'::public.app_role]));


--
-- Name: accounting_periods ins ap; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "ins ap" ON public.accounting_periods FOR INSERT TO authenticated WITH CHECK (public.company_has_role(auth.uid(), company_id, ARRAY['admin'::public.app_role, 'contador'::public.app_role]));


--
-- Name: journal_entries ins je; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "ins je" ON public.journal_entries FOR INSERT TO authenticated WITH CHECK (public.company_has_role(auth.uid(), company_id, ARRAY['admin'::public.app_role, 'contador'::public.app_role]));


--
-- Name: journal_lines ins jl; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "ins jl" ON public.journal_lines FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.journal_entries e
  WHERE ((e.id = journal_lines.entry_id) AND public.company_has_role(auth.uid(), e.company_id, ARRAY['admin'::public.app_role, 'contador'::public.app_role])))));


--
-- Name: journal_entries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: journal_lines; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.journal_lines ENABLE ROW LEVEL SECURITY;

--
-- Name: cost_centers members read cost centers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "members read cost centers" ON public.cost_centers FOR SELECT TO authenticated USING (public.is_company_member(auth.uid(), company_id));


--
-- Name: company_members members_delete_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY members_delete_admin ON public.company_members FOR DELETE TO authenticated USING (public.company_has_role(auth.uid(), company_id, ARRAY['admin'::public.app_role]));


--
-- Name: company_members members_insert_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY members_insert_admin ON public.company_members FOR INSERT TO authenticated WITH CHECK ((public.company_has_role(auth.uid(), company_id, ARRAY['admin'::public.app_role]) OR ((user_id = auth.uid()) AND (NOT (EXISTS ( SELECT 1
   FROM public.company_members m
  WHERE (m.company_id = company_members.company_id)))) AND (EXISTS ( SELECT 1
   FROM public.companies c
  WHERE ((c.id = company_members.company_id) AND (c.created_by = auth.uid())))))));


--
-- Name: company_members members_select_same_company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY members_select_same_company ON public.company_members FOR SELECT TO authenticated USING (public.is_company_member(auth.uid(), company_id));


--
-- Name: company_members members_update_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY members_update_admin ON public.company_members FOR UPDATE TO authenticated USING (public.company_has_role(auth.uid(), company_id, ARRAY['admin'::public.app_role]));


--
-- Name: purchase_payment_lines ppl_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ppl_delete ON public.purchase_payment_lines FOR DELETE TO authenticated USING (public.company_has_role(auth.uid(), company_id, ARRAY['admin'::public.app_role, 'contador'::public.app_role]));


--
-- Name: purchase_payment_lines ppl_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ppl_insert ON public.purchase_payment_lines FOR INSERT TO authenticated WITH CHECK (public.company_has_role(auth.uid(), company_id, ARRAY['admin'::public.app_role, 'contador'::public.app_role, 'operador'::public.app_role]));


--
-- Name: purchase_payment_lines ppl_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ppl_select ON public.purchase_payment_lines FOR SELECT TO authenticated USING (public.is_company_member(auth.uid(), company_id));


--
-- Name: purchase_payment_lines ppl_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ppl_update ON public.purchase_payment_lines FOR UPDATE TO authenticated USING (public.company_has_role(auth.uid(), company_id, ARRAY['admin'::public.app_role, 'contador'::public.app_role])) WITH CHECK (public.company_has_role(auth.uid(), company_id, ARRAY['admin'::public.app_role, 'contador'::public.app_role]));


--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles profiles_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_insert_own ON public.profiles FOR INSERT TO authenticated WITH CHECK ((auth.uid() = id));


--
-- Name: profiles profiles_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_select_own ON public.profiles FOR SELECT TO authenticated USING ((auth.uid() = id));


--
-- Name: profiles profiles_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE TO authenticated USING ((auth.uid() = id)) WITH CHECK ((auth.uid() = id));


--
-- Name: purchase_igtf_ledger; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.purchase_igtf_ledger ENABLE ROW LEVEL SECURITY;

--
-- Name: purchase_igtf_ledger purchase_igtf_ledger_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY purchase_igtf_ledger_delete ON public.purchase_igtf_ledger FOR DELETE TO authenticated USING (public.company_has_role(auth.uid(), company_id, ARRAY['admin'::public.app_role, 'contador'::public.app_role]));


--
-- Name: purchase_igtf_ledger purchase_igtf_ledger_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY purchase_igtf_ledger_insert ON public.purchase_igtf_ledger FOR INSERT TO authenticated WITH CHECK (public.company_has_role(auth.uid(), company_id, ARRAY['admin'::public.app_role, 'contador'::public.app_role, 'operador'::public.app_role]));


--
-- Name: purchase_igtf_ledger purchase_igtf_ledger_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY purchase_igtf_ledger_select ON public.purchase_igtf_ledger FOR SELECT TO authenticated USING (public.is_company_member(auth.uid(), company_id));


--
-- Name: purchase_igtf_ledger purchase_igtf_ledger_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY purchase_igtf_ledger_update ON public.purchase_igtf_ledger FOR UPDATE TO authenticated USING (public.company_has_role(auth.uid(), company_id, ARRAY['admin'::public.app_role, 'contador'::public.app_role])) WITH CHECK (public.company_has_role(auth.uid(), company_id, ARRAY['admin'::public.app_role, 'contador'::public.app_role]));


--
-- Name: purchase_invoices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.purchase_invoices ENABLE ROW LEVEL SECURITY;

--
-- Name: purchase_islr_retentions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.purchase_islr_retentions ENABLE ROW LEVEL SECURITY;

--
-- Name: purchase_islr_retentions purchase_islr_retentions_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY purchase_islr_retentions_delete ON public.purchase_islr_retentions FOR DELETE TO authenticated USING (public.company_has_role(auth.uid(), company_id, ARRAY['admin'::public.app_role, 'contador'::public.app_role]));


--
-- Name: purchase_islr_retentions purchase_islr_retentions_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY purchase_islr_retentions_insert ON public.purchase_islr_retentions FOR INSERT TO authenticated WITH CHECK (public.company_has_role(auth.uid(), company_id, ARRAY['admin'::public.app_role, 'contador'::public.app_role, 'operador'::public.app_role]));


--
-- Name: purchase_islr_retentions purchase_islr_retentions_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY purchase_islr_retentions_select ON public.purchase_islr_retentions FOR SELECT TO authenticated USING (public.is_company_member(auth.uid(), company_id));


--
-- Name: purchase_islr_retentions purchase_islr_retentions_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY purchase_islr_retentions_update ON public.purchase_islr_retentions FOR UPDATE TO authenticated USING (public.company_has_role(auth.uid(), company_id, ARRAY['admin'::public.app_role, 'contador'::public.app_role])) WITH CHECK (public.company_has_role(auth.uid(), company_id, ARRAY['admin'::public.app_role, 'contador'::public.app_role]));


--
-- Name: purchase_iva_retentions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.purchase_iva_retentions ENABLE ROW LEVEL SECURITY;

--
-- Name: purchase_iva_retentions purchase_iva_retentions_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY purchase_iva_retentions_delete ON public.purchase_iva_retentions FOR DELETE TO authenticated USING (public.company_has_role(auth.uid(), company_id, ARRAY['admin'::public.app_role, 'contador'::public.app_role]));


--
-- Name: purchase_iva_retentions purchase_iva_retentions_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY purchase_iva_retentions_insert ON public.purchase_iva_retentions FOR INSERT TO authenticated WITH CHECK (public.company_has_role(auth.uid(), company_id, ARRAY['admin'::public.app_role, 'contador'::public.app_role, 'operador'::public.app_role]));


--
-- Name: purchase_iva_retentions purchase_iva_retentions_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY purchase_iva_retentions_select ON public.purchase_iva_retentions FOR SELECT TO authenticated USING (public.is_company_member(auth.uid(), company_id));


--
-- Name: purchase_iva_retentions purchase_iva_retentions_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY purchase_iva_retentions_update ON public.purchase_iva_retentions FOR UPDATE TO authenticated USING (public.company_has_role(auth.uid(), company_id, ARRAY['admin'::public.app_role, 'contador'::public.app_role])) WITH CHECK (public.company_has_role(auth.uid(), company_id, ARRAY['admin'::public.app_role, 'contador'::public.app_role]));


--
-- Name: purchase_payment_lines; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.purchase_payment_lines ENABLE ROW LEVEL SECURITY;

--
-- Name: purchase_payments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.purchase_payments ENABLE ROW LEVEL SECURITY;

--
-- Name: purchase_payments purchase_payments_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY purchase_payments_delete ON public.purchase_payments FOR DELETE TO authenticated USING (public.company_has_role(auth.uid(), company_id, ARRAY['admin'::public.app_role, 'contador'::public.app_role]));


--
-- Name: purchase_payments purchase_payments_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY purchase_payments_insert ON public.purchase_payments FOR INSERT TO authenticated WITH CHECK (public.company_has_role(auth.uid(), company_id, ARRAY['admin'::public.app_role, 'contador'::public.app_role, 'operador'::public.app_role]));


--
-- Name: purchase_payments purchase_payments_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY purchase_payments_select ON public.purchase_payments FOR SELECT TO authenticated USING (public.is_company_member(auth.uid(), company_id));


--
-- Name: purchase_payments purchase_payments_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY purchase_payments_update ON public.purchase_payments FOR UPDATE TO authenticated USING (public.company_has_role(auth.uid(), company_id, ARRAY['admin'::public.app_role, 'contador'::public.app_role])) WITH CHECK (public.company_has_role(auth.uid(), company_id, ARRAY['admin'::public.app_role, 'contador'::public.app_role]));


--
-- Name: purchase_invoices purchases_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY purchases_delete ON public.purchase_invoices FOR DELETE TO authenticated USING (public.company_has_role(auth.uid(), company_id, ARRAY['admin'::public.app_role]));


--
-- Name: purchase_invoices purchases_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY purchases_insert ON public.purchase_invoices FOR INSERT TO authenticated WITH CHECK ((public.company_has_role(auth.uid(), company_id, ARRAY['admin'::public.app_role, 'contador'::public.app_role]) AND (auth.uid() = created_by)));


--
-- Name: purchase_invoices purchases_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY purchases_select ON public.purchase_invoices FOR SELECT TO authenticated USING (public.is_company_member(auth.uid(), company_id));


--
-- Name: purchase_invoices purchases_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY purchases_update ON public.purchase_invoices FOR UPDATE TO authenticated USING (public.company_has_role(auth.uid(), company_id, ARRAY['admin'::public.app_role, 'contador'::public.app_role]));


--
-- Name: accounting_periods read ap; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "read ap" ON public.accounting_periods FOR SELECT TO authenticated USING (public.is_company_member(auth.uid(), company_id));


--
-- Name: chart_accounts read chart; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "read chart" ON public.chart_accounts FOR SELECT TO authenticated USING (public.is_company_member(auth.uid(), company_id));


--
-- Name: journal_entries read je; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "read je" ON public.journal_entries FOR SELECT TO authenticated USING (public.is_company_member(auth.uid(), company_id));


--
-- Name: journal_lines read jl; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "read jl" ON public.journal_lines FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.journal_entries e
  WHERE ((e.id = journal_lines.entry_id) AND public.is_company_member(auth.uid(), e.company_id)))));


--
-- Name: sales_collection_lines; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sales_collection_lines ENABLE ROW LEVEL SECURITY;

--
-- Name: sales_collections; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sales_collections ENABLE ROW LEVEL SECURITY;

--
-- Name: sales_invoices sales_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sales_delete ON public.sales_invoices FOR DELETE TO authenticated USING (public.company_has_role(auth.uid(), company_id, ARRAY['admin'::public.app_role]));


--
-- Name: sales_igtf_ledger; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sales_igtf_ledger ENABLE ROW LEVEL SECURITY;

--
-- Name: sales_invoices sales_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sales_insert ON public.sales_invoices FOR INSERT TO authenticated WITH CHECK ((public.company_has_role(auth.uid(), company_id, ARRAY['admin'::public.app_role, 'contador'::public.app_role, 'operador'::public.app_role]) AND (auth.uid() = created_by)));


--
-- Name: sales_invoices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sales_invoices ENABLE ROW LEVEL SECURITY;

--
-- Name: sales_islr_retentions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sales_islr_retentions ENABLE ROW LEVEL SECURITY;

--
-- Name: sales_iva_retentions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sales_iva_retentions ENABLE ROW LEVEL SECURITY;

--
-- Name: sales_invoices sales_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sales_select ON public.sales_invoices FOR SELECT TO authenticated USING (public.is_company_member(auth.uid(), company_id));


--
-- Name: sales_invoices sales_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sales_update ON public.sales_invoices FOR UPDATE TO authenticated USING (public.company_has_role(auth.uid(), company_id, ARRAY['admin'::public.app_role, 'contador'::public.app_role]));


--
-- Name: sales_collections sc_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sc_delete ON public.sales_collections FOR DELETE TO authenticated USING (public.company_has_role(auth.uid(), company_id, ARRAY['admin'::public.app_role, 'contador'::public.app_role]));


--
-- Name: sales_collections sc_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sc_insert ON public.sales_collections FOR INSERT TO authenticated WITH CHECK (public.company_has_role(auth.uid(), company_id, ARRAY['admin'::public.app_role, 'contador'::public.app_role, 'operador'::public.app_role]));


--
-- Name: sales_collections sc_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sc_select ON public.sales_collections FOR SELECT TO authenticated USING (public.is_company_member(auth.uid(), company_id));


--
-- Name: sales_collections sc_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sc_update ON public.sales_collections FOR UPDATE TO authenticated USING (public.company_has_role(auth.uid(), company_id, ARRAY['admin'::public.app_role, 'contador'::public.app_role]));


--
-- Name: sales_collection_lines scl_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY scl_delete ON public.sales_collection_lines FOR DELETE TO authenticated USING (public.company_has_role(auth.uid(), company_id, ARRAY['admin'::public.app_role, 'contador'::public.app_role]));


--
-- Name: sales_collection_lines scl_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY scl_insert ON public.sales_collection_lines FOR INSERT TO authenticated WITH CHECK (public.company_has_role(auth.uid(), company_id, ARRAY['admin'::public.app_role, 'contador'::public.app_role, 'operador'::public.app_role]));


--
-- Name: sales_collection_lines scl_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY scl_select ON public.sales_collection_lines FOR SELECT TO authenticated USING (public.is_company_member(auth.uid(), company_id));


--
-- Name: sales_collection_lines scl_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY scl_update ON public.sales_collection_lines FOR UPDATE TO authenticated USING (public.company_has_role(auth.uid(), company_id, ARRAY['admin'::public.app_role, 'contador'::public.app_role]));


--
-- Name: sales_igtf_ledger sigl_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sigl_delete ON public.sales_igtf_ledger FOR DELETE TO authenticated USING (public.company_has_role(auth.uid(), company_id, ARRAY['admin'::public.app_role, 'contador'::public.app_role]));


--
-- Name: sales_igtf_ledger sigl_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sigl_insert ON public.sales_igtf_ledger FOR INSERT TO authenticated WITH CHECK (public.company_has_role(auth.uid(), company_id, ARRAY['admin'::public.app_role, 'contador'::public.app_role, 'operador'::public.app_role]));


--
-- Name: sales_igtf_ledger sigl_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sigl_select ON public.sales_igtf_ledger FOR SELECT TO authenticated USING (public.is_company_member(auth.uid(), company_id));


--
-- Name: sales_igtf_ledger sigl_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sigl_update ON public.sales_igtf_ledger FOR UPDATE TO authenticated USING (public.company_has_role(auth.uid(), company_id, ARRAY['admin'::public.app_role, 'contador'::public.app_role]));


--
-- Name: sales_islr_retentions sisr_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sisr_delete ON public.sales_islr_retentions FOR DELETE TO authenticated USING (public.company_has_role(auth.uid(), company_id, ARRAY['admin'::public.app_role, 'contador'::public.app_role]));


--
-- Name: sales_islr_retentions sisr_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sisr_insert ON public.sales_islr_retentions FOR INSERT TO authenticated WITH CHECK (public.company_has_role(auth.uid(), company_id, ARRAY['admin'::public.app_role, 'contador'::public.app_role, 'operador'::public.app_role]));


--
-- Name: sales_islr_retentions sisr_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sisr_select ON public.sales_islr_retentions FOR SELECT TO authenticated USING (public.is_company_member(auth.uid(), company_id));


--
-- Name: sales_islr_retentions sisr_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sisr_update ON public.sales_islr_retentions FOR UPDATE TO authenticated USING (public.company_has_role(auth.uid(), company_id, ARRAY['admin'::public.app_role, 'contador'::public.app_role]));


--
-- Name: sales_iva_retentions sivr_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sivr_delete ON public.sales_iva_retentions FOR DELETE TO authenticated USING (public.company_has_role(auth.uid(), company_id, ARRAY['admin'::public.app_role, 'contador'::public.app_role]));


--
-- Name: sales_iva_retentions sivr_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sivr_insert ON public.sales_iva_retentions FOR INSERT TO authenticated WITH CHECK (public.company_has_role(auth.uid(), company_id, ARRAY['admin'::public.app_role, 'contador'::public.app_role, 'operador'::public.app_role]));


--
-- Name: sales_iva_retentions sivr_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sivr_select ON public.sales_iva_retentions FOR SELECT TO authenticated USING (public.is_company_member(auth.uid(), company_id));


--
-- Name: sales_iva_retentions sivr_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sivr_update ON public.sales_iva_retentions FOR UPDATE TO authenticated USING (public.company_has_role(auth.uid(), company_id, ARRAY['admin'::public.app_role, 'contador'::public.app_role]));


--
-- Name: suppliers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

--
-- Name: suppliers suppliers_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY suppliers_delete ON public.suppliers FOR DELETE TO authenticated USING (public.company_has_role(auth.uid(), company_id, ARRAY['admin'::public.app_role, 'contador'::public.app_role]));


--
-- Name: suppliers suppliers_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY suppliers_select ON public.suppliers FOR SELECT TO authenticated USING (public.is_company_member(auth.uid(), company_id));


--
-- Name: suppliers suppliers_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY suppliers_update ON public.suppliers FOR UPDATE TO authenticated USING (public.company_has_role(auth.uid(), company_id, ARRAY['admin'::public.app_role, 'contador'::public.app_role]));


--
-- Name: suppliers suppliers_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY suppliers_write ON public.suppliers FOR INSERT TO authenticated WITH CHECK (public.company_has_role(auth.uid(), company_id, ARRAY['admin'::public.app_role, 'contador'::public.app_role]));


--
-- Name: accounting_periods upd ap; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "upd ap" ON public.accounting_periods FOR UPDATE TO authenticated USING (public.company_has_role(auth.uid(), company_id, ARRAY['admin'::public.app_role, 'contador'::public.app_role]));


--
-- Name: journal_entries upd je; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "upd je" ON public.journal_entries FOR UPDATE TO authenticated USING ((public.company_has_role(auth.uid(), company_id, ARRAY['admin'::public.app_role, 'contador'::public.app_role]) AND (status = 'borrador'::public.journal_status))) WITH CHECK (public.company_has_role(auth.uid(), company_id, ARRAY['admin'::public.app_role, 'contador'::public.app_role]));


--
-- Name: journal_lines upd jl; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "upd jl" ON public.journal_lines FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.journal_entries e
  WHERE ((e.id = journal_lines.entry_id) AND public.company_has_role(auth.uid(), e.company_id, ARRAY['admin'::public.app_role, 'contador'::public.app_role])))));


--
-- Name: chart_accounts update chart; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "update chart" ON public.chart_accounts FOR UPDATE TO authenticated USING (public.company_has_role(auth.uid(), company_id, ARRAY['admin'::public.app_role, 'contador'::public.app_role]));


--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: withholdings wh_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY wh_delete ON public.withholdings FOR DELETE TO authenticated USING (public.company_has_role(auth.uid(), company_id, ARRAY['admin'::public.app_role]));


--
-- Name: withholdings wh_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY wh_insert ON public.withholdings FOR INSERT TO authenticated WITH CHECK ((public.company_has_role(auth.uid(), company_id, ARRAY['admin'::public.app_role, 'contador'::public.app_role]) AND (auth.uid() = created_by)));


--
-- Name: withholdings wh_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY wh_select ON public.withholdings FOR SELECT TO authenticated USING (public.is_company_member(auth.uid(), company_id));


--
-- Name: withholdings wh_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY wh_update ON public.withholdings FOR UPDATE TO authenticated USING (public.company_has_role(auth.uid(), company_id, ARRAY['admin'::public.app_role, 'contador'::public.app_role]));


--
-- Name: withholdings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.withholdings ENABLE ROW LEVEL SECURITY;

--
-- Name: chart_accounts write chart; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "write chart" ON public.chart_accounts FOR INSERT TO authenticated WITH CHECK (public.company_has_role(auth.uid(), company_id, ARRAY['admin'::public.app_role, 'contador'::public.app_role]));


--
-- Name: cost_centers writers delete cost centers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "writers delete cost centers" ON public.cost_centers FOR DELETE TO authenticated USING (public.company_has_role(auth.uid(), company_id, ARRAY['admin'::public.app_role, 'contador'::public.app_role]));


--
-- Name: cost_centers writers insert cost centers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "writers insert cost centers" ON public.cost_centers FOR INSERT TO authenticated WITH CHECK (public.company_has_role(auth.uid(), company_id, ARRAY['admin'::public.app_role, 'contador'::public.app_role]));


--
-- Name: cost_centers writers update cost centers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "writers update cost centers" ON public.cost_centers FOR UPDATE TO authenticated USING (public.company_has_role(auth.uid(), company_id, ARRAY['admin'::public.app_role, 'contador'::public.app_role]));


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;
-- Permiso interno del entorno de origen (no aplicar en destino): GRANT USAGE ON SCHEMA public TO sandbox_exec;


--
-- Name: FUNCTION close_fiscal_year(_company_id uuid, _year integer); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.close_fiscal_year(_company_id uuid, _year integer) TO anon;
GRANT ALL ON FUNCTION public.close_fiscal_year(_company_id uuid, _year integer) TO authenticated;
GRANT ALL ON FUNCTION public.close_fiscal_year(_company_id uuid, _year integer) TO service_role;


--
-- Name: FUNCTION close_period(_company_id uuid, _year integer, _month integer); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.close_period(_company_id uuid, _year integer, _month integer) TO anon;
GRANT ALL ON FUNCTION public.close_period(_company_id uuid, _year integer, _month integer) TO authenticated;
GRANT ALL ON FUNCTION public.close_period(_company_id uuid, _year integer, _month integer) TO service_role;


--
-- Name: FUNCTION company_has_role(_user_id uuid, _company_id uuid, _roles public.app_role[]); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.company_has_role(_user_id uuid, _company_id uuid, _roles public.app_role[]) TO anon;
GRANT ALL ON FUNCTION public.company_has_role(_user_id uuid, _company_id uuid, _roles public.app_role[]) TO authenticated;
GRANT ALL ON FUNCTION public.company_has_role(_user_id uuid, _company_id uuid, _roles public.app_role[]) TO service_role;


--
-- Name: FUNCTION company_role(_user_id uuid, _company_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.company_role(_user_id uuid, _company_id uuid) TO anon;
GRANT ALL ON FUNCTION public.company_role(_user_id uuid, _company_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.company_role(_user_id uuid, _company_id uuid) TO service_role;


--
-- Name: TABLE profiles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.profiles TO anon;
GRANT ALL ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;
-- Permiso interno del entorno de origen (no aplicar en destino): GRANT SELECT,INSERT ON TABLE public.profiles TO sandbox_exec;


--
-- Name: FUNCTION find_or_create_profile_by_email(_email text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.find_or_create_profile_by_email(_email text) TO anon;
GRANT ALL ON FUNCTION public.find_or_create_profile_by_email(_email text) TO authenticated;
GRANT ALL ON FUNCTION public.find_or_create_profile_by_email(_email text) TO service_role;


--
-- Name: FUNCTION handle_new_user(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.handle_new_user() TO anon;
GRANT ALL ON FUNCTION public.handle_new_user() TO authenticated;
GRANT ALL ON FUNCTION public.handle_new_user() TO service_role;


--
-- Name: FUNCTION has_role(_user_id uuid, _role public.app_role); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.has_role(_user_id uuid, _role public.app_role) TO anon;
GRANT ALL ON FUNCTION public.has_role(_user_id uuid, _role public.app_role) TO authenticated;
GRANT ALL ON FUNCTION public.has_role(_user_id uuid, _role public.app_role) TO service_role;


--
-- Name: FUNCTION is_admin(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.is_admin() TO anon;
GRANT ALL ON FUNCTION public.is_admin() TO authenticated;
GRANT ALL ON FUNCTION public.is_admin() TO service_role;


--
-- Name: FUNCTION is_company_member(_user_id uuid, _company_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.is_company_member(_user_id uuid, _company_id uuid) TO anon;
GRANT ALL ON FUNCTION public.is_company_member(_user_id uuid, _company_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.is_company_member(_user_id uuid, _company_id uuid) TO service_role;


--
-- Name: FUNCTION is_period_closed(_company_id uuid, _date date); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.is_period_closed(_company_id uuid, _date date) TO anon;
GRANT ALL ON FUNCTION public.is_period_closed(_company_id uuid, _date date) TO authenticated;
GRANT ALL ON FUNCTION public.is_period_closed(_company_id uuid, _date date) TO service_role;


--
-- Name: FUNCTION next_entry_number(_company_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.next_entry_number(_company_id uuid) TO anon;
GRANT ALL ON FUNCTION public.next_entry_number(_company_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.next_entry_number(_company_id uuid) TO service_role;


--
-- Name: FUNCTION open_fiscal_year(_company_id uuid, _year integer); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.open_fiscal_year(_company_id uuid, _year integer) TO anon;
GRANT ALL ON FUNCTION public.open_fiscal_year(_company_id uuid, _year integer) TO authenticated;
GRANT ALL ON FUNCTION public.open_fiscal_year(_company_id uuid, _year integer) TO service_role;


--
-- Name: FUNCTION post_purchase_invoice_entry(_invoice_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.post_purchase_invoice_entry(_invoice_id uuid) TO anon;
GRANT ALL ON FUNCTION public.post_purchase_invoice_entry(_invoice_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.post_purchase_invoice_entry(_invoice_id uuid) TO service_role;


--
-- Name: FUNCTION post_purchase_payment(_payment_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.post_purchase_payment(_payment_id uuid) TO anon;
GRANT ALL ON FUNCTION public.post_purchase_payment(_payment_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.post_purchase_payment(_payment_id uuid) TO service_role;


--
-- Name: FUNCTION post_sales_collection(_collection_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.post_sales_collection(_collection_id uuid) TO anon;
GRANT ALL ON FUNCTION public.post_sales_collection(_collection_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.post_sales_collection(_collection_id uuid) TO service_role;


--
-- Name: FUNCTION post_sales_invoice_entry(_invoice_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.post_sales_invoice_entry(_invoice_id uuid) TO anon;
GRANT ALL ON FUNCTION public.post_sales_invoice_entry(_invoice_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.post_sales_invoice_entry(_invoice_id uuid) TO service_role;


--
-- Name: FUNCTION post_withholding_entry(_wh_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.post_withholding_entry(_wh_id uuid) TO anon;
GRANT ALL ON FUNCTION public.post_withholding_entry(_wh_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.post_withholding_entry(_wh_id uuid) TO service_role;


--
-- Name: FUNCTION process_purchase_invoice_journal_entry(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.process_purchase_invoice_journal_entry() TO anon;
GRANT ALL ON FUNCTION public.process_purchase_invoice_journal_entry() TO authenticated;
GRANT ALL ON FUNCTION public.process_purchase_invoice_journal_entry() TO service_role;


--
-- Name: FUNCTION process_purchase_payment_journal_entry(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.process_purchase_payment_journal_entry() TO anon;
GRANT ALL ON FUNCTION public.process_purchase_payment_journal_entry() TO authenticated;
GRANT ALL ON FUNCTION public.process_purchase_payment_journal_entry() TO service_role;


--
-- Name: FUNCTION reopen_period(_company_id uuid, _year integer, _month integer); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.reopen_period(_company_id uuid, _year integer, _month integer) TO anon;
GRANT ALL ON FUNCTION public.reopen_period(_company_id uuid, _year integer, _month integer) TO authenticated;
GRANT ALL ON FUNCTION public.reopen_period(_company_id uuid, _year integer, _month integer) TO service_role;


--
-- Name: FUNCTION resolve_postable_account(_account_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.resolve_postable_account(_account_id uuid) TO anon;
GRANT ALL ON FUNCTION public.resolve_postable_account(_account_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.resolve_postable_account(_account_id uuid) TO service_role;


--
-- Name: FUNCTION reverse_journal_entry(_entry_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.reverse_journal_entry(_entry_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.reverse_journal_entry(_entry_id uuid) TO anon;
GRANT ALL ON FUNCTION public.reverse_journal_entry(_entry_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.reverse_journal_entry(_entry_id uuid) TO service_role;


--
-- Name: FUNCTION seed_chart_of_accounts(_company_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.seed_chart_of_accounts(_company_id uuid) TO anon;
GRANT ALL ON FUNCTION public.seed_chart_of_accounts(_company_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.seed_chart_of_accounts(_company_id uuid) TO service_role;


--
-- Name: FUNCTION set_updated_at(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.set_updated_at() TO anon;
GRANT ALL ON FUNCTION public.set_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.set_updated_at() TO service_role;


--
-- Name: FUNCTION trg_block_closed_period(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.trg_block_closed_period() TO anon;
GRANT ALL ON FUNCTION public.trg_block_closed_period() TO authenticated;
GRANT ALL ON FUNCTION public.trg_block_closed_period() TO service_role;


--
-- Name: FUNCTION trg_invoice_delete_entry(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.trg_invoice_delete_entry() TO anon;
GRANT ALL ON FUNCTION public.trg_invoice_delete_entry() TO authenticated;
GRANT ALL ON FUNCTION public.trg_invoice_delete_entry() TO service_role;


--
-- Name: FUNCTION trg_purchase_invoice_post(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.trg_purchase_invoice_post() TO anon;
GRANT ALL ON FUNCTION public.trg_purchase_invoice_post() TO authenticated;
GRANT ALL ON FUNCTION public.trg_purchase_invoice_post() TO service_role;


--
-- Name: FUNCTION trg_sales_invoice_post(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.trg_sales_invoice_post() TO anon;
GRANT ALL ON FUNCTION public.trg_sales_invoice_post() TO authenticated;
GRANT ALL ON FUNCTION public.trg_sales_invoice_post() TO service_role;


--
-- Name: FUNCTION trg_withholding_post(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.trg_withholding_post() TO anon;
GRANT ALL ON FUNCTION public.trg_withholding_post() TO authenticated;
GRANT ALL ON FUNCTION public.trg_withholding_post() TO service_role;


--
-- Name: TABLE accounting_periods; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.accounting_periods TO anon;
GRANT ALL ON TABLE public.accounting_periods TO authenticated;
GRANT ALL ON TABLE public.accounting_periods TO service_role;
-- Permiso interno del entorno de origen (no aplicar en destino): GRANT SELECT,INSERT ON TABLE public.accounting_periods TO sandbox_exec;


--
-- Name: TABLE chart_accounts; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.chart_accounts TO anon;
GRANT ALL ON TABLE public.chart_accounts TO authenticated;
GRANT ALL ON TABLE public.chart_accounts TO service_role;
-- Permiso interno del entorno de origen (no aplicar en destino): GRANT SELECT,INSERT ON TABLE public.chart_accounts TO sandbox_exec;


--
-- Name: TABLE companies; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.companies TO anon;
GRANT ALL ON TABLE public.companies TO authenticated;
GRANT ALL ON TABLE public.companies TO service_role;
-- Permiso interno del entorno de origen (no aplicar en destino): GRANT SELECT,INSERT ON TABLE public.companies TO sandbox_exec;


--
-- Name: TABLE company_accounting_configs; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.company_accounting_configs TO anon;
GRANT ALL ON TABLE public.company_accounting_configs TO authenticated;
GRANT ALL ON TABLE public.company_accounting_configs TO service_role;
-- Permiso interno del entorno de origen (no aplicar en destino): GRANT SELECT,INSERT ON TABLE public.company_accounting_configs TO sandbox_exec;


--
-- Name: TABLE company_accounting_config; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.company_accounting_config TO anon;
GRANT ALL ON TABLE public.company_accounting_config TO authenticated;
GRANT ALL ON TABLE public.company_accounting_config TO service_role;
-- Permiso interno del entorno de origen (no aplicar en destino): GRANT SELECT,INSERT ON TABLE public.company_accounting_config TO sandbox_exec;


--
-- Name: TABLE company_members; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.company_members TO anon;
GRANT ALL ON TABLE public.company_members TO authenticated;
GRANT ALL ON TABLE public.company_members TO service_role;
-- Permiso interno del entorno de origen (no aplicar en destino): GRANT SELECT,INSERT ON TABLE public.company_members TO sandbox_exec;


--
-- Name: TABLE cost_centers; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.cost_centers TO anon;
GRANT ALL ON TABLE public.cost_centers TO authenticated;
GRANT ALL ON TABLE public.cost_centers TO service_role;
-- Permiso interno del entorno de origen (no aplicar en destino): GRANT SELECT,INSERT ON TABLE public.cost_centers TO sandbox_exec;


--
-- Name: TABLE customers; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.customers TO anon;
GRANT ALL ON TABLE public.customers TO authenticated;
GRANT ALL ON TABLE public.customers TO service_role;
-- Permiso interno del entorno de origen (no aplicar en destino): GRANT SELECT,INSERT ON TABLE public.customers TO sandbox_exec;


--
-- Name: TABLE journal_entries; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.journal_entries TO anon;
GRANT ALL ON TABLE public.journal_entries TO authenticated;
GRANT ALL ON TABLE public.journal_entries TO service_role;
-- Permiso interno del entorno de origen (no aplicar en destino): GRANT SELECT,INSERT ON TABLE public.journal_entries TO sandbox_exec;


--
-- Name: TABLE journal_lines; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.journal_lines TO anon;
GRANT ALL ON TABLE public.journal_lines TO authenticated;
GRANT ALL ON TABLE public.journal_lines TO service_role;
-- Permiso interno del entorno de origen (no aplicar en destino): GRANT SELECT,INSERT ON TABLE public.journal_lines TO sandbox_exec;


--
-- Name: TABLE purchase_igtf_ledger; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.purchase_igtf_ledger TO anon;
GRANT ALL ON TABLE public.purchase_igtf_ledger TO authenticated;
GRANT ALL ON TABLE public.purchase_igtf_ledger TO service_role;
-- Permiso interno del entorno de origen (no aplicar en destino): GRANT SELECT,INSERT ON TABLE public.purchase_igtf_ledger TO sandbox_exec;


--
-- Name: TABLE purchase_invoices; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.purchase_invoices TO anon;
GRANT ALL ON TABLE public.purchase_invoices TO authenticated;
GRANT ALL ON TABLE public.purchase_invoices TO service_role;
-- Permiso interno del entorno de origen (no aplicar en destino): GRANT SELECT,INSERT ON TABLE public.purchase_invoices TO sandbox_exec;


--
-- Name: TABLE purchase_islr_retentions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.purchase_islr_retentions TO anon;
GRANT ALL ON TABLE public.purchase_islr_retentions TO authenticated;
GRANT ALL ON TABLE public.purchase_islr_retentions TO service_role;
-- Permiso interno del entorno de origen (no aplicar en destino): GRANT SELECT,INSERT ON TABLE public.purchase_islr_retentions TO sandbox_exec;


--
-- Name: TABLE purchase_iva_retentions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.purchase_iva_retentions TO anon;
GRANT ALL ON TABLE public.purchase_iva_retentions TO authenticated;
GRANT ALL ON TABLE public.purchase_iva_retentions TO service_role;
-- Permiso interno del entorno de origen (no aplicar en destino): GRANT SELECT,INSERT ON TABLE public.purchase_iva_retentions TO sandbox_exec;


--
-- Name: TABLE purchase_payment_lines; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.purchase_payment_lines TO anon;
GRANT ALL ON TABLE public.purchase_payment_lines TO authenticated;
GRANT ALL ON TABLE public.purchase_payment_lines TO service_role;
-- Permiso interno del entorno de origen (no aplicar en destino): GRANT SELECT,INSERT ON TABLE public.purchase_payment_lines TO sandbox_exec;


--
-- Name: TABLE purchase_payments; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.purchase_payments TO anon;
GRANT ALL ON TABLE public.purchase_payments TO authenticated;
GRANT ALL ON TABLE public.purchase_payments TO service_role;
-- Permiso interno del entorno de origen (no aplicar en destino): GRANT SELECT,INSERT ON TABLE public.purchase_payments TO sandbox_exec;


--
-- Name: TABLE sales_collection_lines; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.sales_collection_lines TO anon;
GRANT ALL ON TABLE public.sales_collection_lines TO authenticated;
GRANT ALL ON TABLE public.sales_collection_lines TO service_role;
-- Permiso interno del entorno de origen (no aplicar en destino): GRANT SELECT,INSERT ON TABLE public.sales_collection_lines TO sandbox_exec;


--
-- Name: TABLE sales_collections; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.sales_collections TO anon;
GRANT ALL ON TABLE public.sales_collections TO authenticated;
GRANT ALL ON TABLE public.sales_collections TO service_role;
-- Permiso interno del entorno de origen (no aplicar en destino): GRANT SELECT,INSERT ON TABLE public.sales_collections TO sandbox_exec;


--
-- Name: TABLE sales_igtf_ledger; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.sales_igtf_ledger TO anon;
GRANT ALL ON TABLE public.sales_igtf_ledger TO authenticated;
GRANT ALL ON TABLE public.sales_igtf_ledger TO service_role;
-- Permiso interno del entorno de origen (no aplicar en destino): GRANT SELECT,INSERT ON TABLE public.sales_igtf_ledger TO sandbox_exec;


--
-- Name: TABLE sales_invoices; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.sales_invoices TO anon;
GRANT ALL ON TABLE public.sales_invoices TO authenticated;
GRANT ALL ON TABLE public.sales_invoices TO service_role;
-- Permiso interno del entorno de origen (no aplicar en destino): GRANT SELECT,INSERT ON TABLE public.sales_invoices TO sandbox_exec;


--
-- Name: TABLE sales_islr_retentions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.sales_islr_retentions TO anon;
GRANT ALL ON TABLE public.sales_islr_retentions TO authenticated;
GRANT ALL ON TABLE public.sales_islr_retentions TO service_role;
-- Permiso interno del entorno de origen (no aplicar en destino): GRANT SELECT,INSERT ON TABLE public.sales_islr_retentions TO sandbox_exec;


--
-- Name: TABLE sales_iva_retentions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.sales_iva_retentions TO anon;
GRANT ALL ON TABLE public.sales_iva_retentions TO authenticated;
GRANT ALL ON TABLE public.sales_iva_retentions TO service_role;
-- Permiso interno del entorno de origen (no aplicar en destino): GRANT SELECT,INSERT ON TABLE public.sales_iva_retentions TO sandbox_exec;


--
-- Name: TABLE suppliers; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.suppliers TO anon;
GRANT ALL ON TABLE public.suppliers TO authenticated;
GRANT ALL ON TABLE public.suppliers TO service_role;
-- Permiso interno del entorno de origen (no aplicar en destino): GRANT SELECT,INSERT ON TABLE public.suppliers TO sandbox_exec;


--
-- Name: TABLE user_roles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.user_roles TO anon;
GRANT ALL ON TABLE public.user_roles TO authenticated;
GRANT ALL ON TABLE public.user_roles TO service_role;
-- Permiso interno del entorno de origen (no aplicar en destino): GRANT SELECT,INSERT ON TABLE public.user_roles TO sandbox_exec;


--
-- Name: TABLE v_pending_purchase_payments; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.v_pending_purchase_payments TO anon;
GRANT ALL ON TABLE public.v_pending_purchase_payments TO authenticated;
GRANT ALL ON TABLE public.v_pending_purchase_payments TO service_role;
-- Permiso interno del entorno de origen (no aplicar en destino): GRANT SELECT,INSERT ON TABLE public.v_pending_purchase_payments TO sandbox_exec;


--
-- Name: TABLE withholdings; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.withholdings TO anon;
GRANT ALL ON TABLE public.withholdings TO authenticated;
GRANT ALL ON TABLE public.withholdings TO service_role;
-- Permiso interno del entorno de origen (no aplicar en destino): GRANT SELECT,INSERT ON TABLE public.withholdings TO sandbox_exec;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
-- Permiso interno del entorno de origen (no aplicar en destino): ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT,USAGE ON SEQUENCES TO sandbox_exec;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;
-- Permiso interno del entorno de origen (no aplicar en destino): ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT,INSERT ON TABLES TO sandbox_exec;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- PostgreSQL database dump complete
--



-- Trigger de aplicación sobre el esquema administrado de autenticación.
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

COMMIT;
