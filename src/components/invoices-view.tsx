import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany, canInvoice, canWrite } from "@/lib/company-context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { formatBs, formatDate } from "@/lib/format";
import { MoneyInput, parseMasked, toMasked } from "@/components/money-input";

type Kind = "sales" | "purchases";
interface Props {
  kind: Kind;
  title: string;
  subtitle: string;
}

const CFG = {
  sales: { table: "sales_invoices" as const, party: "customer" as const, partyTable: "customers" as const, partyLabel: "Cliente" },
  purchases: { table: "purchase_invoices" as const, party: "supplier" as const, partyTable: "suppliers" as const, partyLabel: "Proveedor" },
};

export function InvoicesView({ kind, title, subtitle }: Props) {
  const { activeCompany } = useCompany();
  const qc = useQueryClient();
  const cfg = CFG[kind];
  const [open, setOpen] = useState(false);

  // Estado extendido para el SENIAT (Providencia 0071)
  const [documentType, setDocumentType] = useState<"factura" | "nota_credito" | "nota_debito">("factura");
  const [affectedInvoiceNum, setAffectedInvoiceNum] = useState("");
  const [affectedControlNum, setAffectedControlNum] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    party_id: "",
    invoice_number: "",
    control_number: "",
    invoice_date: new Date().toISOString().slice(0, 10),
    base_amount: "",
    exempt_amount: "0",
    iva_rate: "16",
    cost_center_id: "",
  });

  const allowed = kind === "sales" ? canInvoice(activeCompany?.role) : canWrite(activeCompany?.role);

  const { data: parties } = useQuery({
    queryKey: [cfg.partyTable, activeCompany?.id],
    enabled: !!activeCompany,
    queryFn: async () => {
      const { data, error } = await supabase.from(cfg.partyTable).select("id,name,rif").eq("company_id", activeCompany!.id).order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: costCenters } = useQuery({
    queryKey: ["cc-inv", activeCompany?.id],
    enabled: !!activeCompany,
    queryFn: async () => {
      const { data } = await supabase.from("cost_centers")
        .select("id,code,name").eq("company_id", activeCompany!.id).eq("is_active", true).order("code");
      return data ?? [];
    },
  });

  const { data: rows, isLoading } = useQuery({
    queryKey: [cfg.table, activeCompany?.id],
    enabled: !!activeCompany,
    queryFn: async () => {
      const partyRel = kind === "sales" ? "customer:customers(name,rif)" : "supplier:suppliers(name,rif)";
      const { data, error } = await supabase
        .from(cfg.table)
        .select(`*, ${partyRel}`)
        .eq("company_id", activeCompany!.id)
        .order("invoice_date", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as any[];
    },
  });

  // Busca y autorellena los datos del documento original afectado
  async function handleBlurInvoiceAfectada() {
    const num = affectedInvoiceNum.trim();
    if (!num || !activeCompany || kind !== "purchases") return;
    setIsSearching(true);
    try {
      const { data, error } = await supabase
        .from("purchase_invoices")
        .select("*")
        .eq("company_id", activeCompany.id)
        .eq("invoice_number", num)
        .order("invoice_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        setAffectedControlNum(data.control_number || "");
        setForm((prev) => ({
          ...prev,
          party_id: data.supplier_id || "",
          base_amount: toMasked(data.base_amount),
          exempt_amount: toMasked(data.exempt_amount),
          iva_rate: String(data.iva_rate ?? "16"),
          cost_center_id: data.cost_center_id || "",
        }));
        toast.success("Documento original encontrado. Datos cargados.");
      } else {
        toast.info("No se encontró un documento previo con ese número. Puede ingresar los montos manualmente.");
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Error al buscar el documento original");
    } finally {
      setIsSearching(false);
    }
  }

  const base = parseMasked(form.base_amount);
  const exempt = parseMasked(form.exempt_amount);
  const rate = parseFloat(form.iva_rate || "0");
  const computedIva = +(base * (isNaN(rate) ? 0 : rate) / 100).toFixed(2);
  const computedTotal = +(base + computedIva + exempt).toFixed(2);

  function resetForm() {
    setForm({
      party_id: "",
      invoice_number: "",
      control_number: "",
      invoice_date: new Date().toISOString().slice(0, 10),
      base_amount: "",
      exempt_amount: "0",
      iva_rate: "16",
      cost_center_id: "",
    });
    setDocumentType("factura");
    setAffectedInvoiceNum("");
    setAffectedControlNum("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!activeCompany || saving) return;
    if (base < 0 || exempt < 0) { toast.error("Montos inválidos"); return; }
    if (!form.party_id) { toast.error(`Selecciona un ${cfg.partyLabel.toLowerCase()}`); return; }
    if (computedTotal <= 0) { toast.error("El total del documento debe ser mayor a cero"); return; }
    if (!/^[a-zA-Z0-9-]+$/.test(form.control_number.trim())) {
      toast.error("El número de control contiene caracteres inválidos. Use letras, números o guiones.");
      return;
    }

    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) { toast.error("Sesión expirada"); return; }

      const payload: any = {
        company_id: activeCompany.id,
        [cfg.party + "_id"]: form.party_id,
        invoice_number: form.invoice_number.trim(),
        control_number: form.control_number.trim(),
        invoice_date: form.invoice_date,
        base_amount: base,
        exempt_amount: exempt,
        iva_rate: isNaN(rate) ? 0 : rate,
        iva_amount: computedIva,
        total_amount: computedTotal,
        cost_center_id: form.cost_center_id || null,
        created_by: userData.user.id,
      };

      if (kind === "purchases") {
        payload.document_type = documentType.toUpperCase();
        if (documentType !== "factura") {
          if (!affectedInvoiceNum.trim() || !affectedControlNum.trim()) {
            toast.error("Debe indicar el N° de documento y control afectado.");
            return;
          }
          payload.affected_invoice_number = affectedInvoiceNum.trim();
          payload.affected_control_number = affectedControlNum.trim();
        } else {
          payload.affected_invoice_number = null;
          payload.affected_control_number = null;
        }
      }

      const { error } = await supabase.from(cfg.table).insert(payload);
      if (error) {
        console.error("Error al registrar documento:", error);
        toast.error(error.message);
        return;
      }

      toast.success(
        kind === "sales"
          ? "Factura de venta registrada"
          : documentType === "factura"
            ? "Factura de compra registrada"
            : `${documentType === "nota_credito" ? "Nota de Crédito" : "Nota de Débito"} registrada`
      );
      setOpen(false);
      resetForm();
      qc.invalidateQueries();
    } finally {
      setSaving(false);
    }
  }

  if (!activeCompany) return <div className="p-8 text-center text-muted-foreground">Selecciona una empresa.</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        {allowed && (
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
            <DialogTrigger asChild><Button className="gap-2"><Plus className="h-4 w-4" /> Nueva transacción</Button></DialogTrigger>
            <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Registrar documento fiscal</DialogTitle></DialogHeader>
              <form onSubmit={submit} className="space-y-3">
                {kind === "purchases" && (
                  <div className="rounded-md border p-3">
                    <Label className="mb-2 block">Tipo de documento</Label>
                    <RadioGroup value={documentType} onValueChange={(v) => setDocumentType(v as typeof documentType)} className="flex flex-wrap gap-4">
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="factura" id="dt-factura" />
                        <Label htmlFor="dt-factura" className="font-normal">Factura</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="nota_credito" id="dt-nc" />
                        <Label htmlFor="dt-nc" className="font-normal">Nota de crédito</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="nota_debito" id="dt-nd" />
                        <Label htmlFor="dt-nd" className="font-normal">Nota de débito</Label>
                      </div>
                    </RadioGroup>
                  </div>
                )}

                {kind === "purchases" && documentType !== "factura" && (
                  <div className="grid grid-cols-2 gap-3 rounded-md bg-muted p-3">
                    <div>
                      <Label>Doc. original afectado N° {isSearching && <span className="text-xs text-muted-foreground">Buscando…</span>}</Label>
                      <Input
                        value={affectedInvoiceNum}
                        onChange={(e) => setAffectedInvoiceNum(e.target.value)}
                        onBlur={handleBlurInvoiceAfectada}
                        placeholder="ej: 00004521"
                        required
                      />
                    </div>
                    <div>
                      <Label>N° control afectado</Label>
                      <Input value={affectedControlNum} onChange={(e) => setAffectedControlNum(e.target.value)} placeholder="ej: 00-4521" required />
                    </div>
                  </div>
                )}

                <div>
                  <Label>{cfg.partyLabel}</Label>
                  <Select value={form.party_id} onValueChange={(v) => setForm({ ...form, party_id: v })}>
                    <SelectTrigger><SelectValue placeholder={`Selecciona ${cfg.partyLabel.toLowerCase()}`} /></SelectTrigger>
                    <SelectContent>{(parties ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.name} ({p.rif})</SelectItem>)}</SelectContent>
                  </Select>
                  {(parties ?? []).length === 0 && <p className="text-xs text-muted-foreground mt-1">No hay {cfg.partyLabel.toLowerCase()}s. Crea uno primero.</p>}
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div><Label>N° documento</Label><Input value={form.invoice_number} onChange={(e) => setForm({ ...form, invoice_number: e.target.value })} required /></div>
                  <div><Label>N° control</Label><Input value={form.control_number} onChange={(e) => setForm({ ...form, control_number: e.target.value })} placeholder="00-123" required /></div>
                  <div><Label>Fecha emisión</Label><Input type="date" value={form.invoice_date} onChange={(e) => setForm({ ...form, invoice_date: e.target.value })} required /></div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div><Label>Base gravable (Bs)</Label><MoneyInput value={form.base_amount} onValueChange={(raw) => setForm({ ...form, base_amount: raw })} required /></div>
                  <div><Label>Exento / exonerado (Bs)</Label><MoneyInput value={form.exempt_amount} onValueChange={(raw) => setForm({ ...form, exempt_amount: raw })} /></div>
                  <div>
                    <Label>Alícuota IVA %</Label>
                    {kind === "purchases" ? (
                      <Select value={form.iva_rate} onValueChange={(v) => setForm({ ...form, iva_rate: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="16">16% — General</SelectItem>
                          <SelectItem value="8">8% — Reducida</SelectItem>
                          <SelectItem value="31">31% — Adicional / lujo</SelectItem>
                          <SelectItem value="0">0% — Sin IVA</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input type="number" step="0.01" value={form.iva_rate} onChange={(e) => setForm({ ...form, iva_rate: e.target.value })} />
                    )}
                  </div>
                </div>

                <div className="rounded-md bg-muted p-3 text-sm">
                  <div className="flex justify-between"><span>IVA calculado:</span><span className="tabular font-medium">Bs {formatBs(computedIva)}</span></div>
                  <div className="flex justify-between mt-1 font-semibold"><span>Total documento:</span><span className="tabular">Bs {formatBs(computedTotal)}</span></div>
                </div>

                <div>
                  <Label>Centro de costo (opcional)</Label>
                  <Select value={form.cost_center_id || "__none"} onValueChange={(v) => setForm({ ...form, cost_center_id: v === "__none" ? "" : v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">— sin centro —</SelectItem>
                      {(costCenters ?? []).map((c) => <SelectItem key={c.id} value={c.id}><span className="font-mono text-xs mr-2">{c.code}</span>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <DialogFooter><Button type="submit" disabled={saving}>{saving ? "Registrando…" : "Registrar transacción"}</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>N° Documento</TableHead>
                <TableHead>N° Control</TableHead>
                <TableHead>{cfg.partyLabel}</TableHead>
                <TableHead className="text-right">Base</TableHead>
                <TableHead className="text-right">Exento</TableHead>
                <TableHead className="text-right">IVA</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Cargando...</TableCell></TableRow>}
              {!isLoading && (rows ?? []).length === 0 && <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Sin documentos.</TableCell></TableRow>}
              {(rows ?? []).map((r) => {
                const p = r[cfg.party];
                const docTypeLower = String(r.document_type ?? "").toLowerCase();
                const isNC = docTypeLower.includes("credit") || docTypeLower === "nc";
                const isND = docTypeLower.includes("debito") || docTypeLower === "nd";
                return (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm">{formatDate(r.invoice_date)}</TableCell>
                    <TableCell>
                      <div className="font-mono text-sm">{r.invoice_number}</div>
                      {isNC && <Badge variant="destructive" className="mt-1">Nota de crédito</Badge>}
                      {isND && <Badge variant="secondary" className="mt-1">Nota de débito</Badge>}
                      {r.affected_invoice_number && <div className="text-xs text-muted-foreground mt-1">Afecta: {r.affected_invoice_number}</div>}
                    </TableCell>
                    <TableCell className="font-mono text-sm">{r.control_number}</TableCell>
                    <TableCell><div className="text-sm font-medium">{p?.name}</div><div className="text-xs text-muted-foreground">{p?.rif}</div></TableCell>
                    <TableCell className="text-right tabular">{formatBs(r.base_amount)}</TableCell>
                    <TableCell className="text-right tabular">{formatBs(r.exempt_amount)}</TableCell>
                    <TableCell className="text-right tabular">{formatBs(r.iva_amount)} <span className="text-xs text-muted-foreground">({r.iva_rate}%)</span></TableCell>
                    <TableCell className="text-right tabular font-semibold">{formatBs(r.total_amount)}</TableCell>
                    <TableCell><Badge variant={r.status === "emitida" ? "default" : "destructive"}>{r.status}</Badge></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
