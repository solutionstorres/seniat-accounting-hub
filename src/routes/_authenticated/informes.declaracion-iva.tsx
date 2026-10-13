/* eslint-disable */
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company-context";
import { ReportShell } from "@/components/reports/report-shell";
import { formatBs } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/informes/declaracion-iva")({
  component: DeclaracionIva,
});

function DeclaracionIva() {
  const { activeCompany } = useCompany();
  return (
    <div className="min-h-screen bg-black text-emerald-400 font-mono p-4">
      <ReportShell title="Declaración de IVA" subtitle="Resumen mensual: débito, crédito y retenciones.">
        {({ from, to }) => <Body companyId={activeCompany?.id} from={from} to={to} />}
      </ReportShell>
    </div>
  );
}

function Body({ companyId, from, to }: { companyId?: string; from: string; to: string }) {
  const { data } = useQuery({
    queryKey: ["decl-iva", companyId, from, to],
    enabled: !!companyId,
    queryFn: async () => {
      const [{ data: sales }, { data: purchases }, { data: whs }] = await Promise.all([
        supabase.from("sales_invoices").select("base_amount,exempt_amount,iva_amount,total_amount")
          .eq("company_id", companyId!).gte("invoice_date", from).lte("invoice_date", to),
        supabase.from("purchase_invoices").select("base_amount,exempt_amount,iva_amount,total_amount")
          .eq("company_id", companyId!).gte("invoice_date", from).lte("invoice_date", to),
        supabase.from("withholdings").select("type,amount")
          .eq("company_id", companyId!).gte("withholding_date", from).lte("withholding_date", to),
      ]);
      const sum = (arr: any[], k: string) => (arr ?? []).reduce((s, r) => s + Number(r[k] ?? 0), 0);
      return {
        ventas: { base: sum(sales!, "base_amount"), exento: sum(sales!, "exempt_amount"), iva: sum(sales!, "iva_amount"), total: sum(sales!, "total_amount") },
        compras: { base: sum(purchases!, "base_amount"), exento: sum(purchases!, "exempt_amount"), iva: sum(purchases!, "iva_amount"), total: sum(purchases!, "total_amount") },
        retIva: (whs ?? []).filter(w => w.type === "iva").reduce((s, w) => s + Number(w.amount), 0),
        retIslr: (whs ?? []).filter(w => w.type === "islr").reduce((s, w) => s + Number(w.amount), 0),
      };
    },
  });

  if (!data) return <div className="p-8 text-center text-emerald-600 font-mono">Cargando...</div>;
  const cuota = data.ventas.iva - data.compras.iva - data.retIva;

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-3xl mx-auto bg-black text-emerald-400 font-mono">
      <Block title="Débito Fiscal (Ventas)" rows={[
        ["Base gravada", data.ventas.base],
        ["Ventas exentas", data.ventas.exento],
        ["Total ventas", data.ventas.total],
        ["IVA débito fiscal", data.ventas.iva, true],
      ]} />
      <Block title="Crédito Fiscal (Compras)" rows={[
        ["Base gravada", data.compras.base],
        ["Compras exentas", data.compras.exento],
        ["Total compras", data.compras.total],
        ["IVA crédito fiscal", data.compras.iva, true],
      ]} />
      <Block title="Retenciones" rows={[
        ["Retenciones de IVA", data.retIva],
        ["Retenciones de ISLR", data.retIslr],
      ]} />
      <div className="rounded-lg border-2 border-emerald-500 bg-emerald-950/30 p-4 flex justify-between items-center shadow-lg">
        <span className="font-bold text-lg text-emerald-200">
          {cuota >= 0 ? "IVA A PAGAR" : "EXCEDENTE DE CRÉDITO FISCAL"}
        </span>
        <span className="tabular font-bold text-xl text-emerald-300">{formatBs(Math.abs(cuota))}</span>
      </div>
    </div>
  );
}

function Block({ title, rows }: { title: string; rows: [string, number, boolean?][] }) {
  return (
    <div className="border border-emerald-900/60 rounded-md bg-black overflow-hidden shadow-lg">
      <div className="bg-emerald-950/40 border-b border-emerald-500/40 px-3 py-2 font-bold text-sm text-emerald-200">
        {title}
      </div>
      <table className="w-full text-sm">
        <tbody className="divide-y divide-emerald-500/10">
          {rows.map(([label, val, hi], i) => (
            <tr key={i} className={`hover:bg-emerald-900/20 ${hi ? "bg-emerald-950/20 font-bold text-emerald-200" : "text-emerald-300"}`}>
              <td className="py-2 px-3">{label}</td>
              <td className="py-2 px-3 text-right tabular text-emerald-200">{formatBs(val)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
