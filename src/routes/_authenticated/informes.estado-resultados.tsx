import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company-context";
import { ReportShell } from "@/components/reports/report-shell";
import { formatBs } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/informes/estado-resultados")({
  component: EstadoResultados,
});

function EstadoResultados() {
  const { activeCompany } = useCompany();
  return (
    <ReportShell title="Estado de Resultados" subtitle="Ingresos, costos y gastos del período.">
      {({ from, to }) => <Body companyId={activeCompany?.id} from={from} to={to} />}
    </ReportShell>
  );
}

function Body({ companyId, from, to }: { companyId?: string; from: string; to: string }) {
  const { data } = useQuery({
    queryKey: ["estado-res", companyId, from, to],
    enabled: !!companyId,
    queryFn: async () => {
      const { data: accounts } = await supabase.from("chart_accounts")
        .select("id,code,name,account_type").eq("company_id", companyId!).eq("is_postable", true)
        .in("account_type", ["ingreso", "costo", "gasto"]).order("code");
      const ids = (accounts ?? []).map(a => a.id);
      if (ids.length === 0) return { ingresos: [], costos: [], gastos: [], totals: { i: 0, c: 0, g: 0 } };

      const { data: lines } = await supabase.from("journal_lines")
        .select("account_id,debit,credit,entry:journal_entries!inner(entry_date,company_id,status)")
        .in("account_id", ids).gte("entry.entry_date", from).lte("entry.entry_date", to);
      const bal = new Map<string, number>();
      (lines ?? []).forEach((l: any) => {
        if (l.entry.status === "anulado" || l.entry.company_id !== companyId) return;
        bal.set(l.account_id, (bal.get(l.account_id) ?? 0) + Number(l.debit) - Number(l.credit));
      });

      const ingresos: any[] = [], costos: any[] = [], gastos: any[] = [];
      (accounts ?? []).forEach((a: any) => {
        const b = bal.get(a.id) ?? 0;
        if (a.account_type === "ingreso") ingresos.push({ ...a, monto: -b });
        else if (a.account_type === "costo") costos.push({ ...a, monto: b });
        else if (a.account_type === "gasto") gastos.push({ ...a, monto: b });
      });
      return {
        ingresos, costos, gastos,
        totals: {
          i: ingresos.reduce((s, x) => s + x.monto, 0),
          c: costos.reduce((s, x) => s + x.monto, 0),
          g: gastos.reduce((s, x) => s + x.monto, 0),
        },
      };
    },
  });

  if (!data) return <div className="p-8 text-center text-muted-foreground">Cargando...</div>;
  const bruta = data.totals.i - data.totals.c;
  const neta = bruta - data.totals.g;

  return (
    <div className="p-6 space-y-4 max-w-3xl mx-auto">
      <Section title="INGRESOS" items={data.ingresos} total={data.totals.i} />
      <Section title="COSTOS" items={data.costos} total={data.totals.c} negative />
      <div className="flex justify-between border-t-2 pt-2 font-semibold">
        <span>UTILIDAD BRUTA</span><span className="tabular">{formatBs(bruta)}</span>
      </div>
      <Section title="GASTOS OPERATIVOS" items={data.gastos} total={data.totals.g} negative />
      <div className="flex justify-between border-t-4 border-double pt-2 font-bold text-lg">
        <span>UTILIDAD (PÉRDIDA) NETA</span><span className="tabular">{formatBs(neta)}</span>
      </div>
    </div>
  );
}

function Section({ title, items, total, negative }: { title: string; items: any[]; total: number; negative?: boolean }) {
  return (
    <div>
      <div className="bg-muted px-3 py-2 font-bold text-sm">{title}</div>
      <table className="w-full text-sm">
        <tbody>
          {items.filter(i => Math.abs(i.monto) > 0.001).map((i: any) => (
            <tr key={i.id} className="border-b">
              <td className="py-1.5 px-3"><span className="font-mono text-xs mr-2 text-muted-foreground">{i.code}</span>{i.name}</td>
              <td className="py-1.5 px-3 text-right tabular">{negative ? "(" : ""}{formatBs(i.monto)}{negative ? ")" : ""}</td>
            </tr>
          ))}
          {items.length === 0 && <tr><td colSpan={2} className="py-3 px-3 text-center text-muted-foreground text-xs">Sin movimientos</td></tr>}
        </tbody>
      </table>
      <div className="flex justify-between border-t mt-1 pt-2 px-3 font-semibold">
        <span>Total {title}</span>
        <span className="tabular">{negative ? "(" : ""}{formatBs(total)}{negative ? ")" : ""}</span>
      </div>
    </div>
  );
}
