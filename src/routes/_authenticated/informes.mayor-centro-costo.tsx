import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company-context";
import { ReportShell } from "@/components/reports/report-shell";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatBs, formatDate } from "@/lib/format";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/informes/mayor-centro-costo")({
  component: MayorCC,
});

function MayorCC() {
  const { activeCompany } = useCompany();
  const [cc, setCc] = useState<string>("");

  const { data: centers } = useQuery({
    queryKey: ["cc-list", activeCompany?.id],
    enabled: !!activeCompany,
    queryFn: async () => {
      const { data } = await supabase.from("cost_centers")
        .select("id,code,name").eq("company_id", activeCompany!.id).order("code");
      return data ?? [];
    },
  });

  return (
    <ReportShell title="Mayor por Centro de Costo" subtitle="Movimientos y saldo agrupado por centro de costo.">
      {({ from, to }) => (
        <div className="p-4 space-y-3">
          <div className="flex items-end gap-3">
            <div className="w-72">
              <Label className="text-xs">Centro de costo</Label>
              <Select value={cc} onValueChange={setCc}>
                <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">Todos</SelectItem>
                  {(centers ?? []).map((c) => <SelectItem key={c.id} value={c.id}><span className="font-mono mr-2">{c.code}</span>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Body companyId={activeCompany?.id} from={from} to={to} costCenterId={cc === "__all" || !cc ? null : cc} />
        </div>
      )}
    </ReportShell>
  );
}

function Body({ companyId, from, to, costCenterId }: { companyId?: string; from: string; to: string; costCenterId: string | null }) {
  const { data } = useQuery({
    queryKey: ["mayor-cc", companyId, from, to, costCenterId],
    enabled: !!companyId,
    queryFn: async () => {
      let q = supabase.from("journal_lines")
        .select("debit,credit,description,cost_center_id,account:chart_accounts(code,name),cc:cost_centers(code,name),entry:journal_entries!inner(entry_date,entry_number,company_id,status)")
        .gte("entry.entry_date", from).lte("entry.entry_date", to);
      if (costCenterId) q = q.eq("cost_center_id", costCenterId);
      else q = q.not("cost_center_id", "is", null);
      const { data } = await q;
      return (data ?? []).filter((l: any) => l.entry.company_id === companyId && l.entry.status !== "anulado");
    },
  });

  const grouped = new Map<string, { code: string; name: string; lines: any[] }>();
  (data ?? []).forEach((l: any) => {
    const key = l.cost_center_id ?? "";
    const g = grouped.get(key) ?? { code: l.cc?.code ?? "-", name: l.cc?.name ?? "Sin centro", lines: [] as any[] };
    g.lines.push(l); grouped.set(key, g);
  });

  if (grouped.size === 0) return <div className="text-center py-8 text-muted-foreground">Sin movimientos con centro de costo.</div>;

  return (
    <div className="space-y-6">
      {Array.from(grouped.values()).sort((a, b) => a.code.localeCompare(b.code)).map((g) => {
        let total = 0;
        return (
          <div key={g.code} className="border rounded-md">
            <div className="bg-muted px-3 py-2 font-medium text-sm"><span className="font-mono mr-2">{g.code}</span>{g.name}</div>
            <Table>
              <TableHeader><TableRow>
                <TableHead className="w-24">Fecha</TableHead><TableHead className="w-16">N°</TableHead>
                <TableHead>Cuenta</TableHead><TableHead>Concepto</TableHead>
                <TableHead className="text-right w-28">Débito</TableHead>
                <TableHead className="text-right w-28">Crédito</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {g.lines.sort((a, b) => a.entry.entry_date.localeCompare(b.entry.entry_date)).map((l: any, i: number) => {
                  total += Number(l.debit) - Number(l.credit);
                  return (
                    <TableRow key={i}>
                      <TableCell className="text-xs">{formatDate(l.entry.entry_date)}</TableCell>
                      <TableCell className="font-mono text-xs">{l.entry.entry_number}</TableCell>
                      <TableCell className="text-sm"><span className="font-mono text-xs mr-1">{l.account?.code}</span>{l.account?.name}</TableCell>
                      <TableCell className="text-sm">{l.description}</TableCell>
                      <TableCell className="text-right tabular text-sm">{Number(l.debit) > 0 ? formatBs(l.debit) : ""}</TableCell>
                      <TableCell className="text-right tabular text-sm">{Number(l.credit) > 0 ? formatBs(l.credit) : ""}</TableCell>
                    </TableRow>
                  );
                })}
                <TableRow className="font-semibold bg-muted/50">
                  <TableCell colSpan={4}>Neto del centro</TableCell>
                  <TableCell colSpan={2} className="text-right tabular">{formatBs(total)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        );
      })}
    </div>
  );
}
