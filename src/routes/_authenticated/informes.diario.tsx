/* eslint-disable */
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company-context";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { ReportShell } from "@/components/reports/report-shell";
import { formatBs, formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/informes/diario")({
  component: LibroDiario,
});

function LibroDiario() {
  const { activeCompany } = useCompany();
  return (
    <div className="min-h-screen bg-black text-emerald-400 font-mono p-4">
      <ReportShell title="Libro Diario" subtitle="Registro cronológico de asientos.">
        {({ from, to }) => (
          <div className="bg-black text-emerald-400 border border-emerald-900/50 p-4 rounded-lg shadow-lg">
            <Body companyId={activeCompany?.id} from={from} to={to} />
          </div>
        )}
      </ReportShell>
    </div>
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
    <div className="text-emerald-400 font-mono bg-black">
      <Table>
        <TableHeader className="bg-emerald-950/40 border-b border-emerald-500/40">
          <TableRow className="border-emerald-500/30 hover:bg-transparent">
            <TableHead className="w-24 text-emerald-300 font-bold">Fecha</TableHead>
            <TableHead className="w-16 text-emerald-300 font-bold">N°</TableHead>
            <TableHead className="text-emerald-300 font-bold">Cuenta / Descripción</TableHead>
            <TableHead className="text-right w-32 text-emerald-300 font-bold">Débito</TableHead>
            <TableHead className="text-right w-32 text-emerald-300 font-bold">Crédito</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="divide-y divide-emerald-500/20">
          {entries.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center py-8 text-emerald-600">Sin movimientos.</TableCell>
            </TableRow>
          )}
          {entries.map((e: any) => {
            const lines = data!.linesByEntry.get(e.id) ?? [];
            return (
              <React.Fragment key={e.id}>
                <TableRow className="bg-emerald-950/20 border-emerald-500/30 hover:bg-emerald-950/40">
                  <TableCell className="text-xs text-emerald-300">{formatDate(e.entry_date)}</TableCell>
                  <TableCell className="font-mono text-xs text-emerald-300">{e.entry_number}</TableCell>
                  <TableCell className="text-sm font-bold text-emerald-200" colSpan={3}>{e.description}</TableCell>
                </TableRow>
                {lines.map((l: any, i: number) => (
                  <TableRow key={e.id + i} className="border-emerald-500/10 hover:bg-emerald-900/20">
                    <TableCell></TableCell>
                    <TableCell></TableCell>
                    <TableCell className="text-sm pl-8 text-emerald-300">
                      <span className="font-mono text-xs mr-2 text-emerald-500">{l.account?.code}</span>
                      {l.account?.name}
                    </TableCell>
                    <TableCell className="text-right tabular text-sm text-emerald-200">
                      {Number(l.debit) > 0 ? formatBs(l.debit) : ""}
                    </TableCell>
                    <TableCell className="text-right tabular text-sm text-emerald-200">
                      {Number(l.credit) > 0 ? formatBs(l.credit) : ""}
                    </TableCell>
                  </TableRow>
                ))}
              </React.Fragment>
            );
          })}
        </TableBody>
        {entries.length > 0 && (
          <TableFooter className="bg-emerald-950/40 border-t border-emerald-500/40 text-emerald-200">
            <TableRow className="border-emerald-500/30 hover:bg-transparent">
              <TableCell colSpan={3} className="font-bold text-emerald-300">Totales</TableCell>
              <TableCell className="text-right tabular font-bold text-emerald-300">{formatBs(totalD)}</TableCell>
              <TableCell className="text-right tabular font-bold text-emerald-300">{formatBs(totalC)}</TableCell>
            </TableRow>
          </TableFooter>
        )}
      </Table>
    </div>
  );
}
