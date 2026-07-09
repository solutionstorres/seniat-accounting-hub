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
    <ReportShell title="Libro Mayor" subtitle="Movimientos y saldos por cuenta contable.">
      {({ from, to }) => <Body companyId={activeCompany?.id} from={from} to={to} />}
    </ReportShell>
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
    <div className="p-4 space-y-6">
      {accounts.length === 0 && <div className="text-center py-8 text-muted-foreground">Sin movimientos.</div>}
      {accounts.map((a: any) => {
        const opening = data!.opening.get(a.id) ?? 0;
        const lines = (data!.byAccount.get(a.id) ?? []).sort((x: any, y: any) => x.entry.entry_date.localeCompare(y.entry.entry_date));
        const sign = a.nature === "deudora" ? 1 : -1;
        let running = opening;
        return (
          <div key={a.id} className="border rounded-md">
            <div className="bg-muted px-3 py-2 flex justify-between text-sm">
              <span className="font-medium"><span className="font-mono mr-2">{a.code}</span>{a.name}</span>
              <span className="text-muted-foreground">Naturaleza: {a.nature}</span>
            </div>
            <Table>
              <TableHeader><TableRow>
                <TableHead className="w-24">Fecha</TableHead><TableHead className="w-16">N°</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead className="text-right w-28">Débito</TableHead>
                <TableHead className="text-right w-28">Crédito</TableHead>
                <TableHead className="text-right w-28">Saldo</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                <TableRow><TableCell colSpan={5} className="text-xs italic">Saldo inicial</TableCell><TableCell className="text-right tabular text-sm">{formatBs(Math.abs(opening))} {opening * sign < 0 ? "(inv)" : ""}</TableCell></TableRow>
                {lines.map((l: any, i: number) => {
                  running += Number(l.debit) - Number(l.credit);
                  return (
                    <TableRow key={i}>
                      <TableCell className="text-xs">{formatDate(l.entry.entry_date)}</TableCell>
                      <TableCell className="font-mono text-xs">{l.entry.entry_number}</TableCell>
                      <TableCell className="text-sm">{l.description || l.entry.description}</TableCell>
                      <TableCell className="text-right tabular text-sm">{Number(l.debit) > 0 ? formatBs(l.debit) : ""}</TableCell>
                      <TableCell className="text-right tabular text-sm">{Number(l.credit) > 0 ? formatBs(l.credit) : ""}</TableCell>
                      <TableCell className="text-right tabular text-sm">{formatBs(Math.abs(running))}</TableCell>
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
