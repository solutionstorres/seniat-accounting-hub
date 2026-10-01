/* eslint-disable */
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
    <div className="min-h-screen bg-black text-emerald-400 font-mono">
      <ReportShell title="Balance General" subtitle="Situación financiera a fecha de corte." singleDate>
        {({ to }) => <Body companyId={activeCompany?.id} to={to} />}
      </ReportShell>
    </div>
  );
}

function Body({ companyId, to }: { companyId?: string; to: string }) {
  const { data } = useQuery({
    queryKey: ["balance-general", companyId, to],
    enabled: !!companyId,
    queryFn: async () => {
      const { data: accounts } = await supabase
        .from("chart_accounts")
        .select("id,code,name,nature,account_type")
        .eq("company_id", companyId!)
        .eq("is_postable", true)
        .order("code");

      const ids = (accounts ?? []).map(a => a.id);
      if (ids.length === 0) {
        return {
          groups: { activo: [], pasivo: [], patrimonio: [] } as Record<string, any[]>,
          utilidadEjercicio: 0,
          utilidadesAcumuladas: 0,
          totals: { activo: 0, pasivo: 0, patrimonioTotal: 0 }
        };
      }

      const { data: lines } = await supabase
        .from("journal_lines")
        .select("account_id,debit,credit,entry:journal_entries!inner(entry_date,company_id,status)")
        .in("account_id", ids)
        .lte("entry.entry_date", to);

      const bal = new Map<string, number>();
      let utilidadAcumuladaHistorica = 0;
      let utilidadEjercicioActual = 0;
      const currentYearPrefix = to.substring(0, 4);

      (lines ?? []).forEach((l: any) => {
        if (l.entry.status === "anulado" || l.entry.company_id !== companyId) return;
        const accId = l.account_id;
        const netChange = Number(l.debit) - Number(l.credit);
        bal.set(accId, (bal.get(accId) ?? 0) + netChange);
      });

      const groups: Record<string, any[]> = { activo: [], pasivo: [], patrimonio: [] };
      let totalIngresosActual = 0, totalCostoGastoActual = 0;

      (lines ?? []).forEach((l: any) => {
        if (l.entry.status === "anulado" || l.entry.company_id !== companyId) return;
        const account = (accounts ?? []).find(a => a.id === l.account_id);
        if (!account) return;

        const net = Number(l.debit) - Number(l.credit);
        const entryYear = l.entry.entry_date.substring(0, 4);
        const isCurrentYear = entryYear === currentYearPrefix;

        if (account.account_type === "ingreso") {
          if (isCurrentYear) totalIngresosActual += -net;
          else utilidadAcumuladaHistorica += -net;
        } else if (account.account_type === "costo" || account.account_type === "gasto") {
          if (isCurrentYear) totalCostoGastoActual += net;
          else utilidadAcumuladaHistorica -= net;
        }
      });

      utilidadEjercicioActual = totalIngresosActual - totalCostoGastoActual;

      (accounts ?? []).forEach((a: any) => {
        const b = bal.get(a.id) ?? 0;
        if (a.account_type === "activo") {
          groups.activo.push({ ...a, saldo: b });
        } else if (a.account_type === "pasivo") {
          groups.pasivo.push({ ...a, saldo: -b });
        } else if (a.account_type === "patrimonio") {
          groups.patrimonio.push({ ...a, saldo: -b });
        }
      });

      const totalActivo = groups.activo.reduce((s, x) => s + x.saldo, 0);
      const totalPasivo = groups.pasivo.reduce((s, x) => s + x.saldo, 0);
      const totalPatrimonioBase = groups.patrimonio.reduce((s, x) => s + x.saldo, 0);
      const patrimonioTotal = totalPatrimonioBase + utilidadAcumuladaHistorica + utilidadEjercicioActual;

      return {
        groups,
        utilidadEjercicio: utilidadEjercicioActual,
        utilidadAcumulada: utilidadAcumuladaHistorica,
        totals: {
          activo: totalActivo,
          pasivo: totalPasivo,
          patrimonio: patrimonioTotal,
        },
      };
    },
  });

  if (!data) return <div className="p-8 text-center text-emerald-500">Cargando Balance General...</div>;
  
  const totalPasPat = data.totals.pasivo + data.totals.patrimonio;

  return (
    <div className="p-4 sm:p-6 space-y-6 text-emerald-400 font-mono">
      <div className="grid md:grid-cols-1 gap-6 lg:grid-cols-2">
        <Section title="ACTIVO" items={data.groups.activo} total={data.totals.activo} />
        <div>
          <Section title="PASIVO" items={data.groups.pasivo} total={data.totals.pasivo} />
          <div className="h-4" />
          <Section 
            title="PATRIMONIO" 
            items={[
              ...data.groups.patrimonio, 
              ...(Math.abs(data.utilidadAcumulada ?? 0) > 0.001 ? [{ id: "utilidad-acum", code: "", name: "Resultados Acumulado (Ej. Anteriores)", saldo: data.utilidadAcumulada ?? 0 }] : []),
              { id: "utilidad-ejercicio", code: "", name: "Utilidad / Pérdida del Ejercicio", saldo: data.utilidadEjercicio }
            ]} 
            total={data.totals.patrimonio} 
          />
          <div className="mt-4 flex justify-between border-t-2 border-emerald-500/50 pt-2 font-bold text-emerald-300">
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
    <div className="bg-black/95 border border-emerald-500/30 rounded-lg p-4 shadow-[0_0_15px_rgba(0,255,102,0.1)]">
      <div className="bg-emerald-950/40 text-emerald-300 px-3 py-2 font-bold text-sm border-b border-emerald-500/30 rounded-t">{title}</div>
      <table className="w-full text-sm">
        <tbody className="divide-y divide-emerald-500/20">
          {items.filter(i => Math.abs(i.saldo) > 0.001).map((i: any) => (
            <tr key={i.id} className="hover:bg-emerald-900/20">
              <td className="py-2 px-3">
                <span className="font-mono text-xs mr-2 text-emerald-500">{i.code}</span>
                <span className="text-emerald-200">{i.name}</span>
              </td>
              <td className="py-2 px-3 text-right tabular text-emerald-300 font-medium">{formatBs(i.saldo)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex justify-between border-t border-emerald-500/40 mt-2 pt-2 px-3 font-semibold text-emerald-300 bg-emerald-950/20 rounded-b">
        <span>Total {title}</span>
        <span className="tabular">{formatBs(total)}</span>
      </div>
    </div>
  );
}
