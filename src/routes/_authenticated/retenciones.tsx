import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany, canWrite } from "@/lib/company-context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, FileDown, Printer, Filter } from "lucide-react";
import { toast } from "sonner";
import { formatBs, formatDate } from "@/lib/format";
import { buildIvaWithholdingsXml, buildIslrWithholdingsXml, downloadText } from "@/lib/seniat/exports";

export const Route = createFileRoute("/_authenticated/retenciones")({
  component: WithholdingsPage,
});

function WithholdingsPage() {
  const { activeCompany } = useCompany();
  const qc = useQueryClient();
  const allowed = canWrite(activeCompany?.role);
  const [open, setOpen] = useState(false);

  // Filtros de búsqueda
  const [filterSupplier, setFilterSupplier] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [form, setForm] = useState({
    type: "iva",
    receipt_number: "",
    withholding_date: new Date().toISOString().slice(0, 10),
    purchase_invoice_id: "",
    base_amount: "",
    rate: "75",
    notes: "",
  });

  const { data: purchases } = useQuery({
    queryKey: ["purchases-list-wh", activeCompany?.id],
    enabled: !!activeCompany,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_invoices")
        .select("id, invoice_number, iva_amount, supplier:suppliers(id, name)")
        .eq("company_id", activeCompany!.id)
        .order("invoice_date", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as any[];
    },
  });

  // Lista única de proveedores para el filtro basada en las compras o retenciones
  const suppliersList = useMemo(() => {
    const map = new Map();
    (purchases ?? []).forEach(p => {
      if (p.supplier?.id) map.set(p.supplier.id, p.supplier.name);
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [purchases]);

  const { data: rows, isLoading } = useQuery({
    queryKey: ["withholdings", activeCompany?.id],
    enabled: !!activeCompany,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("withholdings")
        .select("*, purchase:purchase_invoices(invoice_number, control_number, iva_amount, supplier:suppliers(id, name, rif, address))")
        .eq("company_id", activeCompany!.id)
        .order("withholding_date", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as any[];
    },
  });

  // Filtrado de retenciones en memoria por Proveedor y Rango de Fechas
  const filteredRows = useMemo(() => {
    return (rows ?? []).filter((r) => {
      const supplierId = r.purchase?.supplier?.id;
      if (filterSupplier !== "all" && supplierId !== filterSupplier) return false;
      if (dateFrom && r.withholding_date < dateFrom) return false;
      if (dateTo && r.withholding_date > dateTo) return false;
      return true;
    });
  }, [rows, filterSupplier, dateFrom, dateTo]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!activeCompany) return;
    const base = parseFloat(form.base_amount || "0");
    const rate = parseFloat(form.rate || "0");
    const amount = +(base * rate / 100).toFixed(2);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const { error } = await supabase.from("withholdings").insert({
      company_id: activeCompany.id,
      type: form.type as any,
      receipt_number: form.receipt_number.trim(),
      withholding_date: form.withholding_date,
      purchase_invoice_id: form.purchase_invoice_id || null,
      base_amount: base,
      rate,
      amount,
      notes: form.notes || null,
      created_by: userData.user.id,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Retención registrada");
    setOpen(false);
    setForm({ type: "iva", receipt_number: "", withholding_date: new Date().toISOString().slice(0, 10), purchase_invoice_id: "", base_amount: "", rate: "75", notes: "" });
    qc.invalidateQueries();
  }

  function exportSeniat(kind: "iva" | "islr") {
    const list = filteredRows.filter((r) => r.type === kind);
    if (list.length === 0) { toast.error("No hay retenciones del tipo seleccionado para exportar"); return; }
    const rif = activeCompany?.rif ?? "";
    if (kind === "iva") {
      const period = new Date().toISOString().slice(0, 7).replace("-", "");
      downloadText(`SENIAT_RetIVA_${period}.xml`, buildIvaWithholdingsXml(rif, period, list), "application/xml");
    } else {
      downloadText(`SENIAT_RetISLR_${new Date().getFullYear()}.xml`, buildIslrWithholdingsXml(rif, new Date().getFullYear(), list), "application/xml");
    }
  }

  // Función para imprimir un comprobante específico
  function printReceipt(r: any) {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Habilite las ventanas emergentes para imprimir el comprobante");
      return;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Comprobante de Retención - ${r.receipt_number}</title>
          <style>
            body { font-family: Arial, sans-serif; font-size: 12px; color: #000; margin: 20px; }
            .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 10px; }
            .header h2 { margin: 0; font-size: 16px; text-transform: uppercase; }
            .header p { margin: 2px 0; font-size: 11px; color: #555; }
            .info-table, .data-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
            .info-table td { padding: 4px; vertical-align: top; }
            .data-table th, .data-table td { border: 1px solid #333; padding: 6px; text-align: left; }
            .data-table th { background-color: #f2f2f2; }
            .text-right { text-align: right; }
            .signatures { margin-top: 50px; display: flex; justify-content: space-between; }
            .signature-box { width: 40%; text-align: center; border-top: 1px solid #333; padding-top: 5px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>COMPROBANTE DE RETENCIÓN DE ${r.type.toUpperCase()}</h2>
            <p><b>${activeCompany?.name ?? ""}</b> | RIF: ${activeCompany?.rif ?? ""}</p>
            <p>${activeCompany?.address ?? ""}</p>
          </div>

          <table class="info-table">
            <tr>
              <td><b>N° Comprobante:</b> ${r.receipt_number}</td>
              <td><b>Fecha de Emisión:</b> ${formatDate(r.withholding_date)}</td>
            </tr>
            <tr>
              <td><b>Proveedor:</b> ${r.purchase?.supplier?.name ?? "—"}</td>
              <td><b>RIF Proveedor:</b> ${r.purchase?.supplier?.rif ?? "—"}</td>
            </tr>
          </table>

          <table class="data-table">
            <thead>
              <tr>
                <th>N° Factura</th>
                <th>N° Control</th>
                <th class="text-right">Base Imponible (Bs)</th>
                <th class="text-right">% Alícuota / Ret.</th>
                <th class="text-right">Monto Retenido (Bs)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>${r.purchase?.invoice_number ?? "—"}</td>
                <td>${r.purchase?.control_number ?? "—"}</td>
                <td class="text-right">${formatBs(r.base_amount)}</td>
                <td class="text-right">${r.rate}%</td>
                <td class="text-right"><b>${formatBs(r.amount)}</b></td>
              </tr>
            </tbody>
          </table>

          ${r.notes ? `<p><b>Observaciones:</b> ${r.notes}</p>` : ""}

          <div class="signatures">
            <div class="signature-box">Emitido por</div>
            <div class="signature-box">Recibido / Proveedor</div>
          </div>

          <script>
            window.onload = function() { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  }

  if (!activeCompany) return <div className="p-8 text-center text-muted-foreground">Selecciona una empresa.</div>;

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Retenciones IVA / ISLR</h1>
          <p className="text-sm text-muted-foreground">Comprobantes de retención emitidos y su cálculo.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => exportSeniat("iva")} className="gap-2"><FileDown className="h-4 w-4" /> XML Ret. IVA</Button>
          <Button variant="outline" size="sm" onClick={() => exportSeniat("islr")} className="gap-2"><FileDown className="h-4 w-4" /> XML Ret. ISLR</Button>
          {allowed && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button className="gap-2"><Plus className="h-4 w-4" /> Nueva retención</Button></DialogTrigger>
            <DialogContent className="max-w-xl">
              <DialogHeader><DialogTitle>Registrar comprobante</DialogTitle></DialogHeader>
              <form onSubmit={submit} className="space-y-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div><Label>Tipo</Label>
                    <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v, rate: v === "iva" ? "75" : "3" })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="iva">IVA</SelectItem>
                        <SelectItem value="islr">ISLR</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>N° Comprobante</Label><Input value={form.receipt_number} onChange={(e) => setForm({ ...form, receipt_number: e.target.value })} required /></div>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div><Label>Fecha</Label><Input type="date" value={form.withholding_date} onChange={(e) => setForm({ ...form, withholding_date: e.target.value })} required /></div>
                  <div><Label>Factura de compra</Label>
                    <Select value={form.purchase_invoice_id} onValueChange={(v) => setForm({ ...form, purchase_invoice_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                      <SelectContent>{(purchases ?? []).map(p => <SelectItem key={p.id} value={p.id}>{p.invoice_number} · {p.supplier?.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div><Label>Base (Bs)</Label><Input type="number" step="0.01" value={form.base_amount} onChange={(e) => setForm({ ...form, base_amount: e.target.value })} required /></div>
                  <div><Label>% Retención</Label><Input type="number" step="0.01" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} required /></div>
                </div>
                <div className="rounded-md bg-muted p-3 text-sm flex justify-between font-medium">
                  <span>Monto a retener:</span>
                  <span className="tabular">Bs {formatBs((parseFloat(form.base_amount || "0") * parseFloat(form.rate || "0")) / 100)}</span>
                </div>
                <div><Label>Notas</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
                <DialogFooter><Button type="submit">Registrar</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          )}
        </div>
      </div>

      {/* Panel de Filtros */}
      <Card>
        <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
          <div>
            <Label className="text-xs mb-1 block">Filtrar por Proveedor</Label>
            <Select value={filterSupplier} onValueChange={setFilterSupplier}>
              <SelectTrigger><SelectValue placeholder="Todos los proveedores" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los proveedores</SelectItem>
                {suppliersList.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs mb-1 block">Desde</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs mb-1 block">Hasta</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          <div>
            <Button variant="outline" className="w-full gap-2" onClick={() => { setFilterSupplier("all"); setDateFrom(""); setDateTo(""); }}>
              <Filter className="h-4 w-4" /> Limpiar Filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Comprobante</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Factura / Proveedor</TableHead>
                <TableHead className="text-right">Base</TableHead>
                <TableHead className="text-right">%</TableHead>
                <TableHead className="text-right">Retenido</TableHead>
                <TableHead className="text-center">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Cargando...</TableCell></TableRow>}
              {!isLoading && filteredRows.length === 0 && <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Sin retenciones encontradas con los filtros seleccionados.</TableCell></TableRow>}
              {!isLoading && filteredRows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-sm">{formatDate(r.withholding_date)}</TableCell>
                  <TableCell className="font-mono text-sm">{r.receipt_number}</TableCell>
                  <TableCell><Badge variant={r.type === "iva" ? "default" : "secondary"} className="uppercase">{r.type}</Badge></TableCell>
                  <TableCell className="text-sm">
                    {r.purchase?.invoice_number ?? "—"}
                    {r.purchase?.supplier?.name && <div className="text-xs text-muted-foreground">{r.purchase.supplier.name}</div>}
                  </TableCell>
                  <TableCell className="text-right tabular">{formatBs(r.base_amount)}</TableCell>
                  <TableCell className="text-right tabular">{r.rate}%</TableCell>
                  <TableCell className="text-right tabular font-semibold">{formatBs(r.amount)}</TableCell>
                  <TableCell className="text-center">
                    <Button variant="ghost" size="icon" title="Imprimir Comprobante" onClick={() => printReceipt(r)}>
                      <Printer className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
