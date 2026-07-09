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
    <ReportShell title="Declaración de IVA" subtitle="Resumen mensual: débito, crédito y retenciones.">
      {({ from, to }) => <Body companyId={activeCompany?.id} from={from} to={to} />}
    </ReportShell>
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

  if (!data) return <div className="p-8 text-center text-muted-foreground">Cargando...</div>;
  const cuota = data.ventas.iva - data.compras.iva - data.retIva;

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
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
      <div className="rounded-lg border-2 border-primary p-4 flex justify-between items-center">
        <span className="font-bold text-lg">{cuota >= 0 ? "IVA A PAGAR" : "EXCEDENTE DE CRÉDITO FISCAL"}</span>
        <span className="tabular font-bold text-xl">{formatBs(Math.abs(cuota))}</span>
      </div>
    </div>
  );
}

function Block({ title, rows }: { title: string; rows: [string, number, boolean?][] }) {
  return (
    <div>
      <div className="bg-muted px-3 py-2 font-bold text-sm">{title}</div>
      <table className="w-full text-sm">
        <tbody>
          {rows.map(([label, val, hi], i) => (
            <tr key={i} className={"border-b " + (hi ? "font-semibold" : "")}>
              <td className="py-1.5 px-3">{label}</td>
              <td className="py-1.5 px-3 text-right tabular">{formatBs(val)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
