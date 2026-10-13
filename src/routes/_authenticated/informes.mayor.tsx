/* eslint-disable */
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company-context";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ReportShell } from "@/components/reports/report-shell";
import { formatBs, formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/informes/mayor")({
  component: LibroMayor,
});

function LibroMayor() {
  const { activeCompany } = useCompany();
  return (
    <div className="min-h-screen bg-black text-emerald-400 font-mono p-4">
      <ReportShell title="Libro Mayor" subtitle="Movimientos y saldos por cuenta contable.">
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
    queryKey: ["libro-mayor", companyId, from, to],
    enabled: !!companyId,
    queryFn: async () => {
      const { data: accounts } = await supabase.from("chart_accounts")
        .select("id,code,name,nature,is_postable").eq("company_id", companyId!).eq("is_postable", true).order("code");
      const ids = (accounts ?? []).map(a => a.id);
      if (ids.length === 0) return { accounts: [], byAccount: new Map(), opening: new Map() };

      const { data: prior } = await supabase.from("journal_lines")
        .select("account_id,debit,credit,entry:journal_entries!inner(entry_date,company_id,status)")
        .in("account_id", ids)
        .lt("entry.entry_date", from);
      const opening = new Map<string, number>();
      (prior ?? []).forEach((l: any) => {
        if (l.entry.status === "anulado" || l.entry.company_id !== companyId) return;
        opening.set(l.account_id, (opening.get(l.account_id) ?? 0) + Number(l.debit) - Number(l.credit));
      });

      const { data: period } = await supabase.from("journal_lines")
        .select("account_id,debit,credit,description,entry:journal_entries!inner(entry_date,entry_number,description,company_id,status)")
        .in("account_id", ids)
        .gte("entry.entry_date", from).lte("entry.entry_date", to);
      const byAccount = new Map<string, any[]>();
      (period ?? []).forEach((l: any) => {
        if (l.entry.status === "anulado" || l.entry.company_id !== companyId) return;
        const arr = byAccount.get(l.account_id) ?? []; arr.push(l); byAccount.set(l.account_id, arr);
      });
      return { accounts: accounts ?? [], byAccount, opening };
    },
  });

  const accounts = (data?.accounts ?? []).filter(a => (data!.byAccount.get(a.id) ?? []).length > 0 || (data!.opening.get(a.id) ?? 0) !== 0);

  return (
    <div className="p-4 space-y-6 bg-black text-emerald-400 font-mono">
      {accounts.length === 0 && <div className="text-center py-8 text-emerald-600">Sin movimientos.</div>}
      {accounts.map((a: any) => {
        const opening = data!.opening.get(a.id) ?? 0;
        const lines = (data!.byAccount.get(a.id) ?? []).sort((x: any, y: any) => x.entry.entry_date.localeCompare(y.entry.entry_date));
        const sign = a.nature === "deudora" ? 1 : -1;
        let running = opening;
        return (
          <div key={a.id} className="border border-emerald-900/60 rounded-md bg-black overflow-hidden">
            <div className="bg-emerald-950/40 border-b border-emerald-500/40 px-3 py-2 flex justify-between text-sm">
              <span className="font-medium text-emerald-200">
                <span className="font-mono mr-2 text-emerald-500">{a.code}</span>{a.name}
              </span>
              <span className="text-emerald-500 text-xs uppercase tracking-wider">Naturaleza: {a.nature}</span>
            </div>
            <Table>
              <TableHeader className="bg-emerald-950/20 border-b border-emerald-500/30">
                <TableRow className="border-emerald-500/20 hover:bg-transparent">
                  <TableHead className="w-24 text-emerald-300 font-bold">Fecha</TableHead>
                  <TableHead className="w-16 text-emerald-300 font-bold">N°</TableHead>
                  <TableHead className="text-emerald-300 font-bold">Descripción</TableHead>
                  <TableHead className="text-right w-28 text-emerald-300 font-bold">Débito</TableHead>
                  <TableHead className="text-right w-28 text-emerald-300 font-bold">Crédito</TableHead>
                  <TableHead className="text-right w-28 text-emerald-300 font-bold">Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-emerald-500/10">
                <TableRow className="border-emerald-500/10 hover:bg-emerald-950/20">
                  <TableCell colSpan={5} className="text-xs italic text-emerald-500">Saldo inicial</TableCell>
                  <TableCell className="text-right tabular text-sm text-emerald-200 font-medium">
                    {formatBs(Math.abs(opening))} {opening * sign < 0 ? "(inv)" : ""}
                  </TableCell>
                </TableRow>
                {lines.map((l: any, i: number) => {
                  running += Number(l.debit) - Number(l.credit);
                  return (
                    <TableRow key={i} className="border-emerald-500/10 hover:bg-emerald-900/20">
                      <TableCell className="text-xs text-emerald-300">{formatDate(l.entry.entry_date)}</TableCell>
                      <TableCell className="font-mono text-xs text-emerald-300">{l.entry.entry_number}</TableCell>
                      <TableCell className="text-sm text-emerald-200">{l.description || l.entry.description}</TableCell>
                      <TableCell className="text-right tabular text-sm text-emerald-200">{Number(l.debit) > 0 ? formatBs(l.debit) : ""}</TableCell>
                      <TableCell className="text-right tabular text-sm text-emerald-200">{Number(l.credit) > 0 ? formatBs(l.credit) : ""}</TableCell>
                      <TableCell className="text-right tabular text-sm text-emerald-100 font-semibold">{formatBs(Math.abs(running))}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        );
      })}
    </div>
  );
}
