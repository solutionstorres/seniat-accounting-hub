import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company-context";
import { ReportShell } from "@/components/reports/report-shell";
import { formatBs } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/informes/balance-general")({
  component: BalanceGeneral,
});

function BalanceGeneral() {
  const { activeCompany } = useCompany();
  return (
    <ReportShell title="Balance General" subtitle="Situación financiera a fecha de corte." singleDate>
      {({ to }) => <Body companyId={activeCompany?.id} to={to} />}
    </ReportShell>
  );
}

function Body({ companyId, to }: { companyId?: string; to: string }) {
  const { data } = useQuery({
    queryKey: ["balance-general", companyId, to],
    enabled: !!companyId,
    queryFn: async () => {
      const { data: accounts } = await supabase.from("chart_accounts")
        .select("id,code,name,nature,account_type").eq("company_id", companyId!).eq("is_postable", true).order("code");
      const ids = (accounts ?? []).map(a => a.id);
      if (ids.length === 0) return { groups: { activo: [], pasivo: [], patrimonio: [] } as Record<string, any[]>, utilidad: 0, totals: { activo: 0, pasivo: 0, patrimonio: 0 } };

      const { data: lines } = await supabase.from("journal_lines")
        .select("account_id,debit,credit,entry:journal_entries!inner(entry_date,company_id,status)")
        .in("account_id", ids).lte("entry.entry_date", to);
      const bal = new Map<string, number>();
      (lines ?? []).forEach((l: any) => {
        if (l.entry.status === "anulado" || l.entry.company_id !== companyId) return;
        bal.set(l.account_id, (bal.get(l.account_id) ?? 0) + Number(l.debit) - Number(l.credit));
      });

      const groups: Record<string, any[]> = { activo: [], pasivo: [], patrimonio: [] };
      let totalIngresos = 0, totalCostoGasto = 0;
      (accounts ?? []).forEach((a: any) => {
        const b = bal.get(a.id) ?? 0;
        if (a.account_type === "activo") groups.activo.push({ ...a, saldo: b });
        else if (a.account_type === "pasivo") groups.pasivo.push({ ...a, saldo: -b });
        else if (a.account_type === "patrimonio") groups.patrimonio.push({ ...a, saldo: -b });
        else if (a.account_type === "ingreso") totalIngresos += -b;
        else if (a.account_type === "costo" || a.account_type === "gasto") totalCostoGasto += b;
      });

      const utilidad = totalIngresos - totalCostoGasto;
      return {
        groups,
        utilidad,
        totals: {
          activo: groups.activo.reduce((s, x) => s + x.saldo, 0),
          pasivo: groups.pasivo.reduce((s, x) => s + x.saldo, 0),
          patrimonio: groups.patrimonio.reduce((s, x) => s + x.saldo, 0),
        },
      };
    },
  });

  if (!data) return <div className="p-8 text-center text-muted-foreground">Cargando...</div>;
  const totalPasPat = data.totals.pasivo + data.totals.patrimonio + (data.utilidad ?? 0);

  return (
    <div className="p-6 space-y-6">
      <div className="grid md:grid-cols-2 gap-6">
        <Section title="ACTIVO" items={data.groups.activo} total={data.totals.activo} />
        <div>
          <Section title="PASIVO" items={data.groups.pasivo} total={data.totals.pasivo} />
          <div className="h-4" />
          <Section title="PATRIMONIO" items={[...data.groups.patrimonio, { id: "utilidad", code: "", name: "Utilidad / Pérdida del ejercicio", saldo: data.utilidad ?? 0 }]} total={data.totals.patrimonio + (data.utilidad ?? 0)} />
          <div className="mt-4 flex justify-between border-t-2 pt-2 font-bold">
            <span>TOTAL PASIVO + PATRIMONIO</span>
            <span className="tabular">{formatBs(totalPasPat)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, items, total }: { title: string; items: any[]; total: number }) {
  return (
    <div>
      <div className="bg-muted px-3 py-2 font-bold text-sm">{title}</div>
      <table className="w-full text-sm">
        <tbody>
          {items.filter(i => Math.abs(i.saldo) > 0.001).map((i: any) => (
            <tr key={i.id} className="border-b">
              <td className="py-1.5 px-3"><span className="font-mono text-xs mr-2 text-muted-foreground">{i.code}</span>{i.name}</td>
              <td className="py-1.5 px-3 text-right tabular">{formatBs(i.saldo)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex justify-between border-t-2 mt-1 pt-2 px-3 font-semibold">
        <span>Total {title}</span>
        <span className="tabular">{formatBs(total)}</span>
      </div>
    </div>
  );
}
