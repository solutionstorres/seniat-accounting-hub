/* eslint-disable */
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
    <div className="min-h-screen bg-black text-emerald-400 font-mono p-4">
      <ReportShell title="Mayor por Centro de Costo" subtitle="Movimientos y saldo agrupado por centro de costo.">
        {({ from, to }) => (
          <div className="space-y-4 bg-black">
            {/* Contenedor del selector corregido a fondo negro puro */}
            <div className="flex items-end gap-3 bg-black border border-emerald-900/60 p-4 rounded-md">
              <div className="w-72">
                <Label className="text-xs text-emerald-400 mb-1.5 block">Centro de costo</Label>
                <Select value={cc} onValueChange={setCc}>
                  <SelectTrigger className="bg-black border-emerald-800 text-emerald-300 focus:ring-emerald-500">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent className="bg-black border-emerald-800 text-emerald-300">
                    <SelectItem value="__all" className="focus:bg-emerald-950 focus:text-emerald-200">Todos</SelectItem>
                    {(centers ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.id} className="focus:bg-emerald-950 focus:text-emerald-200">
                        <span className="font-mono mr-2 text-emerald-500">{c.code}</span>{c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Body companyId={activeCompany?.id} from={from} to={to} costCenterId={cc === "__all" || !cc ? null : cc} />
          </div>
        )}
      </ReportShell>
    </div>
  );
}

function Body({ companyId, from, to, costCenterId }: { companyId?: string; from: string; to: string; costCenterId: string | null }) {
  const { data, isLoading } = useQuery({
    queryKey: ["mayor-cc", companyId, from, to, costCenterId],
    enabled: !!companyId && !!from && !!to,
    queryFn: async () => {
      const cleanFrom = from.split("T")[0];
      const cleanTo = to.split("T")[0];

      let q = supabase
        .from("journal_lines")
        .select(`
          debit,
          credit,
          description,
          cost_center_id,
          account:chart_accounts(code, name),
          cc:cost_centers(code, name),
          entry:journal_entries!inner(entry_date, entry_number, company_id, status)
        `)
        .eq("entry.company_id", companyId!)
        .neq("entry.status", "anulado")
        .gte("entry.entry_date", cleanFrom)
        .lte("entry.entry_date", cleanTo);

      if (costCenterId) {
        q = q.eq("cost_center_id", costCenterId);
      } else {
        q = q.not("cost_center_id", "is", null);
      }

      const { data, error } = await q;

      if (error) {
        console.error("Error cargando mayor por CC:", error);
        throw error;
      }

      return data ?? [];
    },
  });

  if (isLoading) {
    return <div className="text-center py-8 text-emerald-600 font-mono">Cargando movimientos...</div>;
  }

  const grouped = new Map<string, { code: string; name: string; lines: any[] }>();
  (data ?? []).forEach((l: any) => {
    const key = l.cost_center_id ?? "";
    const g = grouped.get(key) ?? { code: l.cc?.code ?? "-", name: l.cc?.name ?? "Sin centro", lines: [] as any[] };
    g.lines.push(l); 
    grouped.set(key, g);
  });

  if (grouped.size === 0) {
    return <div className="text-center py-8 text-emerald-600 font-mono">Sin movimientos con centro de costo.</div>;
  }

  return (
    <div className="space-y-6 text-emerald-400 font-mono bg-black">
      {Array.from(grouped.values()).sort((a, b) => a.code.localeCompare(b.code)).map((g) => {
        let total = 0;
        return (
          <div key={g.code} className="border border-emerald-900/60 rounded-md bg-black overflow-hidden">
            <div className="bg-emerald-950/40 border-b border-emerald-500/40 px-3 py-2 font-medium text-sm text-emerald-200">
              <span className="font-mono mr-2 text-emerald-500">{g.code}</span>{g.name}
            </div>
            <Table>
              <TableHeader className="bg-emerald-950/20 border-b border-emerald-500/30">
                <TableRow className="border-emerald-500/20 hover:bg-transparent">
                  <TableHead className="w-24 text-emerald-300 font-bold">Fecha</TableHead>
                  <TableHead className="w-16 text-emerald-300 font-bold">N°</TableHead>
                  <TableHead className="text-emerald-300 font-bold">Cuenta</TableHead>
                  <TableHead className="text-emerald-300 font-bold">Concepto</TableHead>
                  <TableHead className="text-right w-28 text-emerald-300 font-bold">Débito</TableHead>
                  <TableHead className="text-right w-28 text-emerald-300 font-bold">Crédito</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-emerald-500/10">
                {g.lines.sort((a, b) => a.entry.entry_date.localeCompare(b.entry.entry_date)).map((l: any, i: number) => {
                  total += Number(l.debit) - Number(l.credit);
                  return (
                    <TableRow key={i} className="border-emerald-500/10 hover:bg-emerald-900/20">
                      <TableCell className="text-xs text-emerald-300">{formatDate(l.entry.entry_date)}</TableCell>
                      <TableCell className="font-mono text-xs text-emerald-300">{l.entry.entry_number}</TableCell>
                      <TableCell className="text-sm text-emerald-300">
                        <span className="font-mono text-xs mr-1 text-emerald-500">{l.account?.code}</span>{l.account?.name}
                      </TableCell>
                      <TableCell className="text-sm text-emerald-200">{l.description}</TableCell>
                      <TableCell className="text-right tabular text-sm text-emerald-200">{Number(l.debit) > 0 ? formatBs(l.debit) : ""}</TableCell>
                      <TableCell className="text-right tabular text-sm text-emerald-200">{Number(l.credit) > 0 ? formatBs(l.credit) : ""}</TableCell>
                    </TableRow>
                  );
                })}
                <TableRow className="font-semibold bg-emerald-950/40 border-t border-emerald-500/40 hover:bg-emerald-950/40">
                  <TableCell colSpan={4} className="text-emerald-300">Neto del centro</TableCell>
                  <TableCell colSpan={2} className="text-right tabular text-emerald-200">{formatBs(total)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        );
      })}
    </div>
  );
}
