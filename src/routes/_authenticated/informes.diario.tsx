import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company-context";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { ReportShell, exportRowsCsv } from "@/components/reports/report-shell";
import { formatBs, formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/informes/diario")({
  component: LibroDiario,
});

function LibroDiario() {
  const { activeCompany } = useCompany();
  return (
    <ReportShell title="Libro Diario" subtitle="Registro cronológico de asientos.">
      {({ from, to }) => <Body companyId={activeCompany?.id} from={from} to={to} />}
    </ReportShell>
  );
}

function Body({ companyId, from, to }: { companyId?: string; from: string; to: string }) {
  const { data } = useQuery({
    queryKey: ["libro-diario", companyId, from, to],
    enabled: !!companyId,
    queryFn: async () => {
      const { data: entries } = await supabase.from("journal_entries")
        .select("id,entry_number,entry_date,description,status")
        .eq("company_id", companyId!).gte("entry_date", from).lte("entry_date", to)
        .neq("status", "anulado")
        .order("entry_date").order("entry_number");
      const ids = (entries ?? []).map(e => e.id);
      if (ids.length === 0) return { entries: [], linesByEntry: new Map() };
      const { data: lines } = await supabase.from("journal_lines")
        .select("entry_id,debit,credit,description,line_order,account:chart_accounts(code,name)")
        .in("entry_id", ids).order("line_order");
      const map = new Map<string, any[]>();
      (lines ?? []).forEach(l => {
        const arr = map.get(l.entry_id) ?? []; arr.push(l); map.set(l.entry_id, arr);
      });
      return { entries: entries ?? [], linesByEntry: map };
    },
  });

  const entries = data?.entries ?? [];
  let totalD = 0, totalC = 0;
  entries.forEach(e => (data!.linesByEntry.get(e.id) ?? []).forEach((l: any) => { totalD += Number(l.debit); totalC += Number(l.credit); }));

  return (
    <Table>
      <TableHeader><TableRow>
        <TableHead className="w-24">Fecha</TableHead><TableHead className="w-16">N°</TableHead>
        <TableHead>Cuenta / Descripción</TableHead>
        <TableHead className="text-right w-32">Débito</TableHead>
        <TableHead className="text-right w-32">Crédito</TableHead>
      </TableRow></TableHeader>
      <TableBody>
        {entries.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Sin movimientos.</TableCell></TableRow>}
        {entries.map((e: any) => {
          const lines = data!.linesByEntry.get(e.id) ?? [];
          return (
            <>
              <TableRow key={e.id} className="bg-muted/30">
                <TableCell className="text-xs">{formatDate(e.entry_date)}</TableCell>
                <TableCell className="font-mono text-xs">{e.entry_number}</TableCell>
                <TableCell className="text-sm font-medium" colSpan={3}>{e.description}</TableCell>
              </TableRow>
              {lines.map((l: any, i: number) => (
                <TableRow key={e.id + i}>
                  <TableCell></TableCell><TableCell></TableCell>
                  <TableCell className="text-sm pl-8"><span className="font-mono text-xs mr-2 text-muted-foreground">{l.account?.code}</span>{l.account?.name}</TableCell>
                  <TableCell className="text-right tabular text-sm">{Number(l.debit) > 0 ? formatBs(l.debit) : ""}</TableCell>
                  <TableCell className="text-right tabular text-sm">{Number(l.credit) > 0 ? formatBs(l.credit) : ""}</TableCell>
                </TableRow>
              ))}
            </>
          );
        })}
      </TableBody>
      {entries.length > 0 && (
        <TableFooter><TableRow>
          <TableCell colSpan={3} className="font-semibold">Totales</TableCell>
          <TableCell className="text-right tabular font-bold">{formatBs(totalD)}</TableCell>
          <TableCell className="text-right tabular font-bold">{formatBs(totalC)}</TableCell>
        </TableRow></TableFooter>
      )}
    </Table>
  );
}
