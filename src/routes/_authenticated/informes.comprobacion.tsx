import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company-context";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ReportShell } from "@/components/reports/report-shell";
import { formatBs } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/informes/comprobacion")({
  component: Comprobacion,
});

function Comprobacion() {
  const { activeCompany } = useCompany();
  return (
    <ReportShell title="Balance de Comprobación" subtitle="Sumas y saldos por cuenta.">
      {({ from, to }) => <Body companyId={activeCompany?.id} from={from} to={to} />}
    </ReportShell>
  );
}

function Body({ companyId, from, to }: { companyId?: string; from: string; to: string }) {
  const { data } = useQuery({
    queryKey: ["comprobacion", companyId, from, to],
    enabled: !!companyId,
    queryFn: async () => {
      const { data: accounts } = await supabase.from("chart_accounts")
        .select("id,code,name,nature,is_postable").eq("company_id", companyId!).eq("is_postable", true).order("code");
      const ids = (accounts ?? []).map(a => a.id);
      if (ids.length === 0) return { rows: [] };

      const { data: prior } = await supabase.from("journal_lines")
        .select("account_id,debit,credit,entry:journal_entries!inner(entry_date,company_id,status)")
        .in("account_id", ids).lt("entry.entry_date", from);
      const opening = new Map<string, number>();
      (prior ?? []).forEach((l: any) => {
        if (l.entry.status === "anulado" || l.entry.company_id !== companyId) return;
        opening.set(l.account_id, (opening.get(l.account_id) ?? 0) + Number(l.debit) - Number(l.credit));
      });

      const { data: period } = await supabase.from("journal_lines")
        .select("account_id,debit,credit,entry:journal_entries!inner(entry_date,company_id,status)")
        .in("account_id", ids).gte("entry.entry_date", from).lte("entry.entry_date", to);
      const mov = new Map<string, { d: number; c: number }>();
      (period ?? []).forEach((l: any) => {
        if (l.entry.status === "anulado" || l.entry.company_id !== companyId) return;
        const m = mov.get(l.account_id) ?? { d: 0, c: 0 };
        m.d += Number(l.debit); m.c += Number(l.credit);
        mov.set(l.account_id, m);
      });

      const rows = (accounts ?? []).map(a => {
        const op = opening.get(a.id) ?? 0;
        const m = mov.get(a.id) ?? { d: 0, c: 0 };
        const closing = op + m.d - m.c;
        return { ...a, opening: op, debit: m.d, credit: m.c, closing };
      }).filter(r => r.opening !== 0 || r.debit !== 0 || r.credit !== 0);

      return { rows };
    },
  });

  const rows = data?.rows ?? [];
  const totals = rows.reduce((s, r) => ({ d: s.d + r.debit, c: s.c + r.credit, cd: s.cd + Math.max(r.closing, 0), cc: s.cc + Math.max(-r.closing, 0) }), { d: 0, c: 0, cd: 0, cc: 0 });

  return (
    <Table>
      <TableHeader><TableRow>
        <TableHead>Cuenta</TableHead>
        <TableHead className="text-right">Saldo Inicial</TableHead>
        <TableHead className="text-right">Débitos</TableHead>
        <TableHead className="text-right">Créditos</TableHead>
        <TableHead className="text-right">Saldo Deudor</TableHead>
        <TableHead className="text-right">Saldo Acreedor</TableHead>
      </TableRow></TableHeader>
      <TableBody>
        {rows.map((r: any) => (
          <TableRow key={r.id}>
            <TableCell className="text-sm"><span className="font-mono text-xs mr-2 text-muted-foreground">{r.code}</span>{r.name}</TableCell>
            <TableCell className="text-right tabular text-sm">{formatBs(Math.abs(r.opening))}</TableCell>
            <TableCell className="text-right tabular text-sm">{formatBs(r.debit)}</TableCell>
            <TableCell className="text-right tabular text-sm">{formatBs(r.credit)}</TableCell>
            <TableCell className="text-right tabular text-sm">{r.closing > 0 ? formatBs(r.closing) : ""}</TableCell>
            <TableCell className="text-right tabular text-sm">{r.closing < 0 ? formatBs(-r.closing) : ""}</TableCell>
          </TableRow>
        ))}
        {rows.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Sin datos.</TableCell></TableRow>}
      </TableBody>
      {rows.length > 0 && (
        <TableFooter><TableRow>
          <TableCell className="font-semibold">Totales</TableCell>
          <TableCell></TableCell>
          <TableCell className="text-right tabular font-bold">{formatBs(totals.d)}</TableCell>
          <TableCell className="text-right tabular font-bold">{formatBs(totals.c)}</TableCell>
          <TableCell className="text-right tabular font-bold">{formatBs(totals.cd)}</TableCell>
          <TableCell className="text-right tabular font-bold">{formatBs(totals.cc)}</TableCell>
        </TableRow></TableFooter>
      )}
    </Table>
  );
}
