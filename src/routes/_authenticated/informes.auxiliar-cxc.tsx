/* eslint-disable */
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company-context";
import { ReportShell } from "@/components/reports/report-shell";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatBs } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/informes/auxiliar-cxc")({
  component: () => (
    <div className="min-h-screen bg-black text-emerald-400 font-mono">
      <ReportShell title="Auxiliar de Cuentas por Cobrar" subtitle="Saldo por cliente al corte." singleDate>
        {({ to }) => <Body kind="cxc" toDate={to} />}
      </ReportShell>
    </div>
  ),
});

export function Body({ kind, toDate }: { kind: "cxc" | "cxp"; toDate: string }) {
  const { activeCompany } = useCompany();
  const table = kind === "cxc" ? "sales_invoices" : "purchase_invoices";
  const partyKey = kind === "cxc" ? "customer" : "supplier";
  const partyTable = kind === "cxc" ? "customers" : "suppliers";
  const label = kind === "cxc" ? "Cliente" : "Proveedor";

  const { data } = useQuery({
    queryKey: [`aux-${kind}`, activeCompany?.id, toDate],
    enabled: !!activeCompany,
    queryFn: async () => {
      const rel = `${partyKey}:${partyTable}(id,name,rif)`;
      const { data } = await supabase.from(table)
        .select(`total_amount, invoice_date, ${rel}`)
        .eq("company_id", activeCompany!.id).lte("invoice_date", toDate);
      const map = new Map<string, { name: string; rif: string; total: number; count: number }>();
      (data ?? []).forEach((r: any) => {
        const p = r[partyKey]; if (!p) return;
        const g = map.get(p.id) ?? { name: p.name, rif: p.rif, total: 0, count: 0 };
        g.total += Number(r.total_amount); g.count += 1; map.set(p.id, g);
      });
      return Array.from(map.values()).sort((a, b) => b.total - a.total);
    },
  });

  const grand = (data ?? []).reduce((s, r) => s + r.total, 0);

  return (
    <div className="text-emerald-400 font-mono">
      <Table>
        <TableHeader className="bg-emerald-950/30 border-b border-emerald-500/30">
          <TableRow className="border-emerald-500/30 hover:bg-transparent">
            <TableHead className="text-emerald-300 font-bold">RIF</TableHead>
            <TableHead className="text-emerald-300 font-bold">{label}</TableHead>
            <TableHead className="text-right w-24 text-emerald-300 font-bold">Facturas</TableHead>
            <TableHead className="text-right w-40 text-emerald-300 font-bold">Saldo (Bs)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="divide-y divide-emerald-500/20">
          {(data ?? []).length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-center py-6 text-emerald-600">Sin movimientos.</TableCell>
            </TableRow>
          )}
          {(data ?? []).map((r, i) => (
            <TableRow key={i} className="hover:bg-emerald-900/20">
              <TableCell className="font-mono text-sm text-emerald-300">{r.rif}</TableCell>
              <TableCell className="text-emerald-200">{r.name}</TableCell>
              <TableCell className="text-right tabular text-emerald-300">{r.count}</TableCell>
              <TableCell className="text-right tabular font-medium text-emerald-200">{formatBs(r.total)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
        {(data ?? []).length > 0 && (
          <TableFooter className="bg-emerald-950/30 border-t border-emerald-500/40 text-emerald-200">
            <TableRow className="border-emerald-500/30 hover:bg-transparent">
              <TableCell colSpan={3} className="font-bold text-emerald-300">TOTAL</TableCell>
              <TableCell className="text-right tabular font-bold text-emerald-300">{formatBs(grand)}</TableCell>
            </TableRow>
          </TableFooter>
        )}
      </Table>
    </div>
  );
}
