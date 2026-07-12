import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, FileDown } from "lucide-react";
import { formatBs, formatDate, currentMonthRange, toCsv, downloadCsv } from "@/lib/format";
import { buildSalesBookTxt, buildPurchasesBookTxt, downloadText } from "@/lib/seniat/exports";

interface Props { kind: "sales" | "purchases" }

export function BookView({ kind }: Props) {
  const { activeCompany } = useCompany();
  const initial = currentMonthRange();
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const title = kind === "sales" ? "Libro de Ventas" : "Libro de Compras";
  const table = kind === "sales" ? "sales_invoices" : "purchase_invoices";
  const partyRel = kind === "sales" ? "customer:customers(name,rif,contributor_type)" : "supplier:suppliers(name,rif,contributor_type)";
  const partyKey = kind === "sales" ? "customer" : "supplier";

  const { data: rows } = useQuery({
    queryKey: [`book-${kind}`, activeCompany?.id, from, to],
    enabled: !!activeCompany,
    queryFn: async () => {
      const { data, error } = await supabase
        .from(table)
        .select(`*, ${partyRel}`)
        .eq("company_id", activeCompany!.id)
        .gte("invoice_date", from)
        .lte("invoice_date", to)
        .order("invoice_date");
      if (error) throw error;
      return data as any[];
    },
  });

  const totals = (rows ?? []).reduce(
    (acc, r) => ({
      base: acc.base + Number(r.base_amount),
      exempt: acc.exempt + Number(r.exempt_amount),
      iva: acc.iva + Number(r.iva_amount),
      total: acc.total + Number(r.total_amount),
    }),
    { base: 0, exempt: 0, iva: 0, total: 0 }
  );

  function exportCsv() {
    const partyLabel = kind === "sales" ? "Cliente" : "Proveedor";
    const data = (rows ?? []).map((r) => ({
      Fecha: r.invoice_date,
      "N° Factura": r.invoice_number,
      "N° Control": r.control_number,
      RIF: r[partyKey]?.rif ?? "",
      [partyLabel]: r[partyKey]?.name ?? "",
      "Base gravable": r.base_amount,
      "Exento": r.exempt_amount,
      "IVA": r.iva_amount,
      "Total": r.total_amount,
      "Estado": r.status,
    }));
    downloadCsv(`${title.replace(/ /g, "_")}_${from}_${to}.csv`, toCsv(data));
  }

  function exportSeniat() {
    const rif = activeCompany?.rif ?? "";
    const txt = kind === "sales" ? buildSalesBookTxt(rif, rows ?? []) : buildPurchasesBookTxt(rif, rows ?? []);
    downloadText(`SENIAT_${kind === "sales" ? "LibroVentas" : "LibroCompras"}_${from}_${to}.txt`, txt);
  }

  if (!activeCompany) return <div className="p-8 text-center text-muted-foreground">Selecciona una empresa.</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4">
      <div className="flex flex-wrap items-end gap-3 justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">Registro cronológico conforme al Reglamento del IVA (SENIAT).</p>
        </div>
        <div className="flex items-end gap-2">
          <div><Label className="text-xs">Desde</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div><Label className="text-xs">Hasta</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          <Button variant="outline" onClick={exportCsv} className="gap-2"><Download className="h-4 w-4" /> CSV</Button>
          <Button variant="default" onClick={exportSeniat} className="gap-2"><FileDown className="h-4 w-4" /> Exportar SENIAT</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>N° Factura</TableHead>
                <TableHead>N° Control</TableHead>
                <TableHead>RIF</TableHead>
                <TableHead>{kind === "sales" ? "Cliente" : "Proveedor"}</TableHead>
                <TableHead className="text-right">Base</TableHead>
                <TableHead className="text-right">Exento</TableHead>
                <TableHead className="text-right">IVA</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(rows ?? []).map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-sm">{formatDate(r.invoice_date)}</TableCell>
                  <TableCell className="font-mono text-sm">{r.invoice_number}</TableCell>
                  <TableCell className="font-mono text-sm">{r.control_number}</TableCell>
                  <TableCell className="font-mono text-sm">{r[partyKey]?.rif}</TableCell>
                  <TableCell className="text-sm">{r[partyKey]?.name}</TableCell>
                  <TableCell className="text-right tabular">{formatBs(r.base_amount)}</TableCell>
                  <TableCell className="text-right tabular">{formatBs(r.exempt_amount)}</TableCell>
                  <TableCell className="text-right tabular">{formatBs(r.iva_amount)}</TableCell>
                  <TableCell className="text-right tabular font-semibold">{formatBs(r.total_amount)}</TableCell>
                </TableRow>
              ))}
              {(rows ?? []).length === 0 && <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Sin movimientos en el período.</TableCell></TableRow>}
            </TableBody>
            {(rows ?? []).length > 0 && (
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={5} className="font-semibold">Totales del período</TableCell>
                  <TableCell className="text-right tabular font-semibold">{formatBs(totals.base)}</TableCell>
                  <TableCell className="text-right tabular font-semibold">{formatBs(totals.exempt)}</TableCell>
                  <TableCell className="text-right tabular font-semibold">{formatBs(totals.iva)}</TableCell>
                  <TableCell className="text-right tabular font-bold">{formatBs(totals.total)}</TableCell>
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
