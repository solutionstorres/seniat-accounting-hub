-- 1. company_accounting_configs: replace open policy
DROP POLICY IF EXISTS "Permitir todo a usuarios autenticados" ON public.company_accounting_configs;

CREATE POLICY "cfgs read members" ON public.company_accounting_configs
FOR SELECT TO authenticated
USING (public.is_company_member(auth.uid(), company_id));

CREATE POLICY "cfgs insert admin" ON public.company_accounting_configs
FOR INSERT TO authenticated
WITH CHECK (public.company_has_role(auth.uid(), company_id, ARRAY['admin'::app_role,'contador'::app_role]));

CREATE POLICY "cfgs update admin" ON public.company_accounting_configs
FOR UPDATE TO authenticated
USING (public.company_has_role(auth.uid(), company_id, ARRAY['admin'::app_role,'contador'::app_role]))
WITH CHECK (public.company_has_role(auth.uid(), company_id, ARRAY['admin'::app_role,'contador'::app_role]));

CREATE POLICY "cfgs delete admin" ON public.company_accounting_configs
FOR DELETE TO authenticated
USING (public.company_has_role(auth.uid(), company_id, ARRAY['admin'::app_role]));

-- 2. company_members: fix tautological bootstrap clause
DROP POLICY IF EXISTS "members_insert_admin" ON public.company_members;

CREATE POLICY "members_insert_admin" ON public.company_members
FOR INSERT TO authenticated
WITH CHECK (
  public.company_has_role(auth.uid(), company_id, ARRAY['admin'::app_role])
  OR (
    user_id = auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM public.company_members m
      WHERE m.company_id = company_members.company_id
    )
    AND EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = company_members.company_id AND c.created_by = auth.uid()
    )
  )
);

-- 3. journal_lines: remove NULL-auth bypass
DROP POLICY IF EXISTS "ins jl" ON public.journal_lines;

CREATE POLICY "ins jl" ON public.journal_lines
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.journal_entries e
    WHERE e.id = journal_lines.entry_id
      AND public.company_has_role(auth.uid(), e.company_id, ARRAY['admin'::app_role,'contador'::app_role])
  )
);