import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
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
import { Plus, FileDown } from "lucide-react";
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
        .select("id, invoice_number, iva_amount, supplier:suppliers(name)")
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
      const { data, error } = await supabase
        .from("withholdings")
        .select("*, purchase:purchase_invoices(invoice_number, control_number, iva_amount, supplier:suppliers(name,rif))")
        .eq("company_id", activeCompany!.id)
        .order("withholding_date", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as any[];
    },
  });

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
    const list = (rows ?? []).filter((r) => r.type === kind);
    if (list.length === 0) { toast.error("No hay retenciones del tipo seleccionado"); return; }
    const rif = activeCompany?.rif ?? "";
    if (kind === "iva") {
      const period = new Date().toISOString().slice(0, 7).replace("-", "");
      downloadText(`SENIAT_RetIVA_${period}.xml`, buildIvaWithholdingsXml(rif, period, list), "application/xml");
    } else {
      downloadText(`SENIAT_RetISLR_${new Date().getFullYear()}.xml`, buildIslrWithholdingsXml(rif, new Date().getFullYear(), list), "application/xml");
    }
  }

  if (!activeCompany) return <div className="p-8 text-center text-muted-foreground">Selecciona una empresa.</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Retenciones IVA / ISLR</h1>
          <p className="text-sm text-muted-foreground">Comprobantes de retención emitidos y su cálculo.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => exportSeniat("iva")} className="gap-2"><FileDown className="h-4 w-4" /> XML Ret. IVA</Button>
          <Button variant="outline" size="sm" onClick={() => exportSeniat("islr")} className="gap-2"><FileDown className="h-4 w-4" /> XML Ret. ISLR</Button>
          {allowed && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button className="gap-2"><Plus className="h-4 w-4" /> Nueva retención</Button></DialogTrigger>
            <DialogContent className="max-w-xl">
              <DialogHeader><DialogTitle>Registrar comprobante</DialogTitle></DialogHeader>
              <form onSubmit={submit} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
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
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Fecha</Label><Input type="date" value={form.withholding_date} onChange={(e) => setForm({ ...form, withholding_date: e.target.value })} required /></div>
                  <div><Label>Factura de compra</Label>
                    <Select value={form.purchase_invoice_id} onValueChange={(v) => setForm({ ...form, purchase_invoice_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                      <SelectContent>{(purchases ?? []).map(p => <SelectItem key={p.id} value={p.id}>{p.invoice_number} · {p.supplier?.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
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

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Comprobante</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Factura</TableHead>
                <TableHead className="text-right">Base</TableHead>
                <TableHead className="text-right">%</TableHead>
                <TableHead className="text-right">Retenido</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Cargando...</TableCell></TableRow>}
              {!isLoading && (rows ?? []).length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Sin retenciones registradas.</TableCell></TableRow>}
              {(rows ?? []).map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-sm">{formatDate(r.withholding_date)}</TableCell>
                  <TableCell className="font-mono text-sm">{r.receipt_number}</TableCell>
                  <TableCell><Badge variant={r.type === "iva" ? "default" : "secondary"} className="uppercase">{r.type}</Badge></TableCell>
                  <TableCell className="text-sm">{r.purchase?.invoice_number ?? "—"}{r.purchase?.supplier?.name && <div className="text-xs text-muted-foreground">{r.purchase.supplier.name}</div>}</TableCell>
                  <TableCell className="text-right tabular">{formatBs(r.base_amount)}</TableCell>
                  <TableCell className="text-right tabular">{r.rate}%</TableCell>
                  <TableCell className="text-right tabular font-semibold">{formatBs(r.amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
