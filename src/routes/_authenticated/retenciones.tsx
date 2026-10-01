/* eslint-disable */
// @ts-nocheck
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

  const { data: rows, isLoading } = useQuery({
    queryKey: ["withholdings", activeCompany?.id],
    enabled: !!activeCompany,
    queryFn: async () => {
      const inv = "invoice_number, control_number, iva_amount, supplier:suppliers(id, name, rif, address)";
      const [w, iva, islr] = await Promise.all([
        supabase.from("withholdings").select(`*, purchase:purchase_invoices(${inv})`).eq("company_id", activeCompany!.id).order("withholding_date", { ascending: false }).limit(500),
        supabase.from("purchase_iva_retentions").select(`*, purchase:purchase_invoices(${inv})`).eq("company_id", activeCompany!.id).limit(500),
        supabase.from("purchase_islr_retentions").select(`*, purchase:purchase_invoices(${inv})`).eq("company_id", activeCompany!.id).limit(500),
      ]);
      if (w.error) throw w.error;
      if (iva.error) throw iva.error;
      if (islr.error) throw islr.error;
      const manual = (w.data ?? []).map((r: any) => ({ ...r, origin: "manual" }));
      const fromIva = (iva.data ?? []).map((r: any) => ({
        id: `iva-${r.id}`, origin: "cxp", type: "iva", receipt_number: r.retention_number, withholding_date: r.retention_date,
        purchase: r.purchase, base_amount: r.base_amount, iva_amount: r.iva_amount, rate: r.retention_percentage, amount: r.retained_amount, notes: null,
      }));
      const fromIslr = (islr.data ?? []).map((r: any) => ({
        id: `islr-${r.id}`, origin: "cxp", type: "islr", receipt_number: r.retention_number, withholding_date: r.retention_date,
        purchase: r.purchase, base_amount: r.base_amount, rate: r.retention_percentage, amount: r.retained_amount,
        subtraction_amount: r.subtraction_amount, notes: r.concept_code,
      }));
      return [...manual, ...fromIva, ...fromIslr].sort((a, b) => (a.withholding_date < b.withholding_date ? 1 : -1));
    },
  });

  // Lista única de proveedores para el filtro basada en las compras o retenciones
  const suppliersList = useMemo(() => {
    const map = new Map();
    (purchases ?? []).forEach(p => {
      if (p.supplier?.id) map.set(p.supplier.id, p.supplier.name);
    });
    (rows ?? []).forEach((r: any) => {
      if (r.purchase?.supplier?.id) map.set(r.purchase.supplier.id, r.purchase.supplier.name);
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => String(a.name).localeCompare(String(b.name)));
  }, [purchases, rows]);

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
    if (!(base > 0)) { toast.error("La base debe ser mayor que cero"); return; }
    if (!(rate > 0 && rate <= 100)) { toast.error("El porcentaje debe estar entre 0 y 100"); return; }
    const receipt = form.receipt_number.trim();
    if ((rows ?? []).some((r: any) => r.type === form.type && r.receipt_number === receipt)) {
      toast.error("Ya existe un comprobante de ese tipo con ese número"); return;
    }
    const amount = +(base * rate / 100).toFixed(2);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const { error } = await supabase.from("withholdings").insert({
      company_id: activeCompany.id,
      type: form.type as any,
      receipt_number: receipt,
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
    const ref = dateFrom || list[0].withholding_date;
    if (kind === "iva") {
      const months = new Set(list.map((r) => String(r.withholding_date).slice(0, 7)));
      if (months.size > 1) { toast.error("El XML de IVA es por mes: filtra un solo período con Desde/Hasta"); return; }
      const period = String(ref).slice(0, 7).replace("-", "");
      downloadText(`SENIAT_RetIVA_${period}.xml`, buildIvaWithholdingsXml(rif, period, list), "application/xml");
    } else {
      const year = Number(String(ref).slice(0, 4));
      const inYear = list.filter((r) => String(r.withholding_date).startsWith(String(year)));
      downloadText(`SENIAT_RetISLR_${year}.xml`, buildIslrWithholdingsXml(rif, year, inYear), "application/xml");
    }
  }

  // Función para imprimir un comprobante específico
  function printReceipt(r: any) {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Habilite las ventanas emergentes para imprimir el comprobante");
      return;
    }

    const esc = (v: unknown) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Comprobante de Retención - ${esc(r.receipt_number)}</title>
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
            <p><b>${esc(activeCompany?.legal_name)}</b> | RIF: ${esc(activeCompany?.rif)}</p>
            <p>${esc(activeCompany?.fiscal_address)}</p>
          </div>

          <table class="info-table">
            <tr>
              <td><b>N° Comprobante:</b> ${esc(r.receipt_number)}</td>
              <td><b>Fecha de Emisión:</b> ${formatDate(r.withholding_date)}</td>
            </tr>
            <tr>
              <td><b>Proveedor:</b> ${esc(r.purchase?.supplier?.name ?? "—")}</td>
              <td><b>RIF Proveedor:</b> ${esc(r.purchase?.supplier?.rif ?? "—")}</td>
            </tr>
          </table>

          <table class="data-table">
            <thead>
              <tr>
                <th>N° Factura</th>
                <th>N° Control</th>
                <th class="text-right">${r.type === "iva" ? "IVA Facturado (Bs)" : "Base Imponible (Bs)"}</th>
                <th class="text-right">% Alícuota / Ret.</th>
                <th class="text-right">Monto Retenido (Bs)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>${esc(r.purchase?.invoice_number ?? "—")}</td>
                <td>${esc(r.purchase?.control_number ?? "—")}</td>
                <td class="text-right">${formatBs(r.base_amount)}</td>
                <td class="text-right">${r.rate}%</td>
                <td class="text-right"><b>${formatBs(r.amount)}</b></td>
              </tr>
            </tbody>
          </table>

          ${r.notes ? `<p><b>Observaciones:</b> ${esc(r.notes)}</p>` : ""}

          <div class="signatures">
            <div class="signature-box">Emitido por</div>
            <div class="signature-box">Recibido / Proveedor</div>
          </div>

          <script>
            window.onload = function() { window.print(); }; window.onafterprint = function() { window.close(); };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  }

  if (!activeCompany) return <div className="p-8 text-center text-emerald-600 font-mono bg-black min-h-screen">Selecciona una empresa.</div>;

  return (
    <div className="min-h-screen bg-black text-emerald-400 p-2 sm:p-4 font-mono">
      <div className="max-w-7xl mx-auto space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between [&_h1]:text-emerald-300 [&_h1]:drop-shadow-[0_0_8px_rgba(0,255,102,0.4)] [&_p]:text-emerald-400/80">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Retenciones IVA / ISLR</h1>
            <p className="text-sm">Comprobantes de retención emitidos y su cálculo.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => exportSeniat("iva")} className="gap-2 border-emerald-500/50 bg-black text-emerald-300 hover:bg-emerald-950 hover:text-emerald-200 font-mono text-xs">
              <FileDown className="h-4 w-4 text-emerald-400" /> XML Ret. IVA
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportSeniat("islr")} className="gap-2 border-emerald-500/50 bg-black text-emerald-300 hover:bg-emerald-950 hover:text-emerald-200 font-mono text-xs">
              <FileDown className="h-4 w-4 text-emerald-400" /> XML Ret. ISLR
            </Button>
            {allowed && (
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2 bg-emerald-600 text-black font-bold hover:bg-emerald-500 shadow-[0_0_10px_rgba(0,255,102,0.2)] font-mono">
                    <Plus className="h-4 w-4" /> Nueva retención
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-xl bg-black border border-emerald-500/50 text-emerald-400 font-mono shadow-[0_0_25px_rgba(0,255,102,0.2)]">
                  <DialogHeader>
                    <DialogTitle className="text-emerald-300 text-lg border-b border-emerald-500/30 pb-2">Registrar comprobante</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={submit} className="space-y-3">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <Label className="text-emerald-300">Tipo</Label>
                        <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v, rate: v === "iva" ? "75" : "3" })}>
                          <SelectTrigger className="bg-black border-emerald-500/60 text-emerald-200 font-mono"><SelectValue /></SelectTrigger>
                          <SelectContent className="bg-black border-emerald-500 text-emerald-200 font-mono">
                            <SelectItem value="iva" className="hover:bg-emerald-900/50 focus:bg-emerald-900/50">IVA</SelectItem>
                            <SelectItem value="islr" className="hover:bg-emerald-900/50 focus:bg-emerald-900/50">ISLR</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-emerald-300">N° Comprobante</Label>
                        <Input value={form.receipt_number} onChange={(e) => setForm({ ...form, receipt_number: e.target.value })} required className="bg-black border-emerald-500/60 text-emerald-200 font-mono" />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <Label className="text-emerald-300">Fecha</Label>
                        <Input type="date" value={form.withholding_date} onChange={(e) => setForm({ ...form, withholding_date: e.target.value })} required className="bg-black border-emerald-500/60 text-emerald-200 font-mono [color-scheme:dark]" />
                      </div>
                      <div>
                        <Label className="text-emerald-300">Factura de compra</Label>
                        <Select value={form.purchase_invoice_id} onValueChange={(v) => {
                          const p = (purchases ?? []).find((x) => x.id === v);
                          setForm({ ...form, purchase_invoice_id: v, base_amount: form.type === "iva" && p ? String(p.iva_amount ?? "") : form.base_amount });
                        }}>
                          <SelectTrigger className="bg-black border-emerald-500/60 text-emerald-200 font-mono"><SelectValue placeholder="Opcional" /></SelectTrigger>
                          <SelectContent className="bg-black border-emerald-500 text-emerald-200 font-mono">
                            {(purchases ?? []).map(p => <SelectItem key={p.id} value={p.id} className="hover:bg-emerald-900/50 focus:bg-emerald-900/50">{p.invoice_number} · {p.supplier?.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <Label className="text-emerald-300">{form.type === "iva" ? "IVA de la factura (Bs)" : "Base imponible (Bs)"}</Label>
                        <Input type="number" step="0.01" value={form.base_amount} onChange={(e) => setForm({ ...form, base_amount: e.target.value })} required className="bg-black border-emerald-500/60 text-emerald-200 font-mono" />
                      </div>
                      <div>
                        <Label className="text-emerald-300">% Retención</Label>
                        <Input type="number" step="0.01" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} required className="bg-black border-emerald-500/60 text-emerald-200 font-mono" />
                      </div>
                    </div>
                    <div className="rounded-md border border-emerald-500/30 bg-emerald-950/20 p-3 text-sm flex justify-between font-medium text-emerald-300">
                      <span>Monto a retener:</span>
                      <span className="tabular font-mono text-emerald-200">Bs {formatBs((parseFloat(form.base_amount || "0") * parseFloat(form.rate || "0")) / 100)}</span>
                    </div>
                    <div>
                      <Label className="text-emerald-300">{form.type === "islr" ? "Código de concepto ISLR" : "Notas"}</Label>
                      <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="bg-black border-emerald-500/60 text-emerald-200 font-mono" />
                    </div>
                    <DialogFooter className="pt-2 border-t border-emerald-500/30">
                      <Button type="submit" className="w-full bg-emerald-500 text-black font-bold hover:bg-emerald-400 transition-all shadow-[0_0_15px_rgba(0,255,102,0.4)] font-mono">Registrar</Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        {/* Panel de Filtros */}
        <div className="rounded-lg border border-emerald-500/40 bg-black/95 shadow-[0_0_20px_rgba(0,255,102,0.15)] p-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
            <div>
              <Label className="text-xs mb-1 block text-emerald-300">Filtrar por Proveedor</Label>
              <Select value={filterSupplier} onValueChange={setFilterSupplier}>
                <SelectTrigger className="bg-black border-emerald-500/60 text-emerald-200 font-mono"><SelectValue placeholder="Todos los proveedores" /></SelectTrigger>
                <SelectContent className="bg-black border-emerald-500 text-emerald-200 font-mono">
                  <SelectItem value="all" className="hover:bg-emerald-900/50 focus:bg-emerald-900/50">Todos los proveedores</SelectItem>
                  {suppliersList.map(s => <SelectItem key={s.id} value={s.id} className="hover:bg-emerald-900/50 focus:bg-emerald-900/50">{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs mb-1 block text-emerald-300">Desde</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="bg-black border-emerald-500/60 text-emerald-200 font-mono [color-scheme:dark]" />
            </div>
            <div>
              <Label className="text-xs mb-1 block text-emerald-300">Hasta</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="bg-black border-emerald-500/60 text-emerald-200 font-mono [color-scheme:dark]" />
            </div>
            <div>
              <Button variant="outline" className="w-full gap-2 border-emerald-500/50 bg-black text-emerald-300 hover:bg-emerald-950 hover:text-emerald-200 font-mono text-xs" onClick={() => { setFilterSupplier("all"); setDateFrom(""); setDateTo(""); }}>
                <Filter className="h-4 w-4 text-emerald-400" /> Limpiar Filtros
              </Button>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-emerald-500/40 bg-black/95 shadow-[0_0_20px_rgba(0,255,102,0.15)] overflow-hidden">
          <Card className="bg-transparent border-0">
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-emerald-950/30">
                  <TableRow className="border-emerald-500/30 hover:bg-transparent">
                    <TableHead className="text-emerald-300 font-bold">Fecha</TableHead>
                    <TableHead className="text-emerald-300 font-bold">Comprobante</TableHead>
                    <TableHead className="text-emerald-300 font-bold">Tipo</TableHead>
                    <TableHead className="text-emerald-300 font-bold">Factura / Proveedor</TableHead>
                    <TableHead className="text-right text-emerald-300 font-bold">Base</TableHead>
                    <TableHead className="text-right text-emerald-300 font-bold">%</TableHead>
                    <TableHead className="text-right text-emerald-300 font-bold">Retenido</TableHead>
                    <TableHead className="text-center text-emerald-300 font-bold">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading && <TableRow><TableCell colSpan={8} className="text-center py-8 text-emerald-600 font-mono">Cargando...</TableCell></TableRow>}
                  {!isLoading && filteredRows.length === 0 && <TableRow><TableCell colSpan={8} className="text-center py-8 text-emerald-600 font-mono">Sin retenciones encontradas con los filtros seleccionados.</TableCell></TableRow>}
                  {!isLoading && filteredRows.map((r) => (
                    <TableRow key={r.id} className="border-emerald-500/20 hover:bg-emerald-900/20 transition-colors">
                      <TableCell className="text-sm text-emerald-300/80">{formatDate(r.withholding_date)}</TableCell>
                      <TableCell className="font-mono text-sm text-emerald-200">{r.receipt_number}</TableCell>
                      <TableCell><Badge variant="outline" className={`font-mono uppercase text-xs ${r.type === "iva" ? "bg-emerald-950 text-emerald-300 border-emerald-500/50 shadow-[0_0_6px_rgba(0,255,102,0.2)]" : "bg-black text-emerald-400 border-emerald-800"}`}>{r.type}</Badge>{r.origin === "cxp" && <div className="text-[10px] text-emerald-500/70 mt-1">desde CxP</div>}</TableCell>
                      <TableCell className="text-sm text-emerald-100">
                        {r.purchase?.invoice_number ?? "—"}
                        {r.purchase?.supplier?.name && <div className="text-xs text-emerald-500/80">{r.purchase.supplier.name}</div>}
                      </TableCell>
                      <TableCell className="text-right tabular font-mono text-emerald-300">{formatBs(r.base_amount)}</TableCell>
                      <TableCell className="text-right tabular font-mono text-emerald-300">{r.rate}%</TableCell>
                      <TableCell className="text-right tabular font-semibold font-mono text-emerald-200">{formatBs(r.amount)}</TableCell>
                      <TableCell className="text-center">
                        <Button variant="ghost" size="icon" title="Imprimir Comprobante" onClick={() => printReceipt(r)} className="text-emerald-400 hover:text-emerald-200 hover:bg-emerald-950">
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
      </div>
    </div>
  );
}
