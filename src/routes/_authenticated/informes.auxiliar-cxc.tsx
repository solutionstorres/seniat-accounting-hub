import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company-context";
import { ReportShell } from "@/components/reports/report-shell";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatBs } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/informes/auxiliar-cxc")({
  component: () => (
    <ReportShell title="Auxiliar de Cuentas por Cobrar" subtitle="Saldo por cliente al corte." singleDate>
      {({ to }) => <Body kind="cxc" toDate={to} />}
    </ReportShell>
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
    <Table>
      <TableHeader><TableRow>
        <TableHead>RIF</TableHead><TableHead>{label}</TableHead>
        <TableHead className="text-right w-24">Facturas</TableHead>
        <TableHead className="text-right w-40">Saldo (Bs)</TableHead>
      </TableRow></TableHeader>
      <TableBody>
        {(data ?? []).length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">Sin movimientos.</TableCell></TableRow>}
        {(data ?? []).map((r, i) => (
          <TableRow key={i}>
            <TableCell className="font-mono text-sm">{r.rif}</TableCell>
            <TableCell>{r.name}</TableCell>
            <TableCell className="text-right tabular">{r.count}</TableCell>
            <TableCell className="text-right tabular font-medium">{formatBs(r.total)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
      {(data ?? []).length > 0 && (
        <TableFooter><TableRow>
          <TableCell colSpan={3} className="font-bold">TOTAL</TableCell>
          <TableCell className="text-right tabular font-bold">{formatBs(grand)}</TableCell>
        </TableRow></TableFooter>
      )}
    </Table>
  );
}
