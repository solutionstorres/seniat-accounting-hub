import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany, canWrite } from "@/lib/company-context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Search, Save, FilePlus2, Pencil, Trash2, FileDown, X } from "lucide-react";
import { toast } from "sonner";
import { formatBs, formatDate } from "@/lib/format";
import { downloadText } from "@/lib/seniat/exports";

export const Route = createFileRoute("/_authenticated/proveedores")({
  component: ProveedoresFicha,
});

const CONTRIB = [
  { value: "ordinario", label: "Contribuyente ordinario" },
  { value: "formal", label: "Contribuyente formal" },
  { value: "especial", label: "Contribuyente especial" },
  { value: "no_contribuyente", label: "No contribuyente" },
  { value: "gobierno", label: "Ente gobierno" },
];

const WH_RATES = [
  { value: "0", label: "0% - No retiene" },
  { value: "75", label: "75% - Contribuyente ordinario" },
  { value: "100", label: "100% - Contribuyente especial" },
];

type Supplier = {
  id: string;
  company_id: string;
  code: string | null;
  rif: string;
  name: string;
  contributor_type: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  iva_account_id: string | null;
  iva_withholding_rate: number;
};

type Account = { id: string; code: string; name: string; is_postable: boolean };

type FormState = {
  code: string; rif: string; name: string; contributor_type: string;
  address: string; phone: string; email: string;
  is_active: boolean; iva_account_id: string | null; iva_withholding_rate: string;
};

const emptyForm: FormState = {
  code: "", rif: "", name: "", contributor_type: "ordinario",
  address: "", phone: "", email: "",
  is_active: true, iva_account_id: null, iva_withholding_rate: "0",
};

function ProveedoresFicha() {
  const { activeCompany } = useCompany();
  const qc = useQueryClient();
  const allowed = canWrite(activeCompany?.role);
  const [mode, setMode] = useState<"consulta" | "edicion" | "nuevo">("consulta");
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [searchOpen, setSearchOpen] = useState(false);
  const [accountSearchOpen, setAccountSearchOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [accountTerm, setAccountTerm] = useState("");

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers-full", activeCompany?.id],
    enabled: !!activeCompany,
    queryFn: async () => {
      const { data, error } = await supabase.from("suppliers")
        .select("*").eq("company_id", activeCompany!.id).order("code", { nullsFirst: false }).order("name");
      if (error) throw error;
      return (data ?? []) as Supplier[];
    },
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ["chart-postable", activeCompany?.id],
    enabled: !!activeCompany,
    queryFn: async () => {
      const { data, error } = await supabase.from("chart_accounts")
        .select("id, code, name, is_postable").eq("company_id", activeCompany!.id)
        .eq("is_postable", true).order("code");
      if (error) throw error;
      return (data ?? []) as Account[];
    },
  });

  // Select first supplier on load
  useEffect(() => {
    if (!currentId && suppliers.length > 0) loadSupplier(suppliers[0]);
  }, [suppliers.length]); // eslint-disable-line

  const current = suppliers.find(s => s.id === currentId) ?? null;
  const currentIdx = current ? suppliers.findIndex(s => s.id === current.id) : -1;
  const account = accounts.find(a => a.id === form.iva_account_id) ?? null;

  const { data: movements = [] } = useQuery({
    queryKey: ["supplier-movements", current?.id],
    enabled: !!current,
    queryFn: async () => {
      const [{ data: purchases }, { data: whs }] = await Promise.all([
        supabase.from("purchase_invoices")
          .select("id, invoice_date, invoice_number, control_number, base_amount, exempt_amount, iva_amount, total_amount")
          .eq("supplier_id", current!.id).order("invoice_date", { ascending: false }),
        supabase.from("withholdings")
          .select("id, withholding_date, type, base_amount, amount, receipt_number, purchase_invoice_id")
          .eq("company_id", current!.company_id)
          .in("purchase_invoice_id", (await supabase.from("purchase_invoices").select("id").eq("supplier_id", current!.id)).data?.map(p => p.id) ?? []),
      ]);
      const whByInv = new Map<string, { iva: number; islr: number }>();
      (whs ?? []).forEach((w: any) => {
        const cur = whByInv.get(w.purchase_invoice_id) ?? { iva: 0, islr: 0 };
        if (w.type === "iva") cur.iva += Number(w.amount);
        else cur.islr += Number(w.amount);
        whByInv.set(w.purchase_invoice_id, cur);
      });
      return (purchases ?? []).map((p: any) => ({
        ...p,
        wh_iva: whByInv.get(p.id)?.iva ?? 0,
        wh_islr: whByInv.get(p.id)?.islr ?? 0,
      }));
    },
  });

  const indicators = useMemo(() => {
    const base = movements.reduce((a: number, m: any) => a + Number(m.base_amount || 0), 0);
    const ivaRet = movements.reduce((a: number, m: any) => a + Number(m.wh_iva || 0), 0);
    return { base, ivaRet };
  }, [movements]);

  function loadSupplier(s: Supplier) {
    setCurrentId(s.id);
    setForm({
      code: s.code ?? "", rif: s.rif, name: s.name, contributor_type: s.contributor_type,
      address: s.address ?? "", phone: s.phone ?? "", email: s.email ?? "",
      is_active: s.is_active, iva_account_id: s.iva_account_id,
      iva_withholding_rate: String(s.iva_withholding_rate ?? 0),
    });
    setMode("consulta");
  }

  function goPrev() { if (currentIdx > 0) loadSupplier(suppliers[currentIdx - 1]); }
  function goNext() { if (currentIdx >= 0 && currentIdx < suppliers.length - 1) loadSupplier(suppliers[currentIdx + 1]); }

  function startNew() {
    setCurrentId(null); setForm(emptyForm); setMode("nuevo");
  }
  function startEdit() { if (current) setMode("edicion"); }
  function cancelEdit() {
    if (current) loadSupplier(current);
    else if (suppliers.length > 0) loadSupplier(suppliers[0]);
    else { setForm(emptyForm); setMode("consulta"); }
  }

  async function save() {
    if (!activeCompany) return;
    if (!form.rif.trim() || !form.name.trim()) { toast.error("RIF y Razón Social son obligatorios"); return; }
    const payload = {
      code: form.code.trim() || null,
      rif: form.rif.toUpperCase().trim(),
      name: form.name.trim(),
      contributor_type: form.contributor_type as any,
      address: form.address || null,
      phone: form.phone || null,
      email: form.email || null,
      is_active: form.is_active,
      iva_account_id: form.iva_account_id,
      iva_withholding_rate: Number(form.iva_withholding_rate) || 0,
    };
    if (mode === "nuevo") {
      const { data, error } = await supabase.from("suppliers").insert({ ...payload, company_id: activeCompany.id }).select().single();
      if (error) { toast.error(error.message); return; }
      toast.success("Proveedor creado");
      await qc.invalidateQueries({ queryKey: ["suppliers-full", activeCompany.id] });
      setCurrentId(data.id); setMode("consulta");
    } else if (mode === "edicion" && current) {
      const { error } = await supabase.from("suppliers").update(payload).eq("id", current.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Cambios guardados");
      await qc.invalidateQueries({ queryKey: ["suppliers-full", activeCompany.id] });
      setMode("consulta");
    }
  }

  async function remove() {
    if (!current) return;
    const { error } = await supabase.from("suppliers").delete().eq("id", current.id);
    if (error) { toast.error(error.message); setDeleteOpen(false); return; }
    toast.success("Proveedor eliminado");
    setDeleteOpen(false);
    await qc.invalidateQueries({ queryKey: ["suppliers-full", activeCompany!.id] });
    setCurrentId(null);
  }

  function exportTxt() {
    if (!current) return;
    const lines = movements.filter((m: any) => m.wh_iva > 0).map((m: any, i: number) => [
      String(i + 1),
      m.invoice_date.replaceAll("-", ""),
      current.rif.replace(/[^A-Z0-9]/gi, "").toUpperCase(),
      current.name.toUpperCase().slice(0, 60),
      m.invoice_number ?? "",
      m.control_number ?? "",
      Number(m.base_amount).toFixed(2),
      Number(m.iva_amount).toFixed(2),
      Number(m.wh_iva).toFixed(2),
    ].join("\t"));
    const header = ["N", "FECHA", "RIF", "RAZON_SOCIAL", "N_FACTURA", "N_CONTROL", "BASE", "IVA", "RETENIDO"].join("\t");
    const rif = current.rif.replace(/[^A-Z0-9]/gi, "").toUpperCase();
    downloadText(`RET_IVA_${rif}.txt`, `# PROVEEDOR ${rif}\n${header}\n${lines.join("\n")}\n`);
  }

  const filtered = suppliers.filter(s => {
    const t = searchTerm.toLowerCase();
    return !t || s.rif.toLowerCase().includes(t) || s.name.toLowerCase().includes(t) || (s.code ?? "").toLowerCase().includes(t);
  });
  const filteredAccounts = accounts.filter(a => {
    const t = accountTerm.toLowerCase();
    return !t || a.code.toLowerCase().includes(t) || a.name.toLowerCase().includes(t);
  });

  const editable = (mode === "edicion" || mode === "nuevo") && allowed;

  if (!activeCompany) return <div className="p-8 text-center text-muted-foreground">Selecciona una empresa primero.</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Expediente de Proveedores</h1>
          <p className="text-sm text-muted-foreground">Ficha maestra, indicadores y movimientos por tercero.</p>
        </div>
        <Badge variant={mode === "consulta" ? "secondary" : "default"} className="uppercase tracking-wider">
          Modo: {mode}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        {/* FICHA */}
        <Card>
          <CardContent className="p-5 space-y-4">
            {/* Navegador */}
            <div className="flex items-center gap-2 pb-3 border-b">
              <Button variant="outline" size="icon" onClick={goPrev} disabled={currentIdx <= 0 || mode !== "consulta"}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={goNext} disabled={currentIdx < 0 || currentIdx >= suppliers.length - 1 || mode !== "consulta"}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button variant="outline" className="gap-2" onClick={() => { setSearchTerm(""); setSearchOpen(true); }} disabled={mode !== "consulta"}>
                <Search className="h-4 w-4" /> Buscar
              </Button>
              <div className="ml-auto text-xs text-muted-foreground">
                {currentIdx >= 0 ? `${currentIdx + 1} / ${suppliers.length}` : `— / ${suppliers.length}`}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Código</Label>
                <Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} disabled={!editable} placeholder="Auto" />
              </div>
              <div>
                <Label>RIF (ID Fiscal)</Label>
                <Input value={form.rif} onChange={e => setForm({ ...form, rif: e.target.value })} disabled={!editable} placeholder="J-12345678-9" />
              </div>
              <div>
                <Label>Razón Social</Label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} disabled={!editable} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <Label>Domicilio Fiscal (límite 100 carac.)</Label>
                <Input value={form.address} maxLength={100} onChange={e => setForm({ ...form, address: e.target.value })} disabled={!editable} />
              </div>
              <div>
                <Label>Estado</Label>
                <Select value={form.is_active ? "act" : "ina"} onValueChange={v => setForm({ ...form, is_active: v === "act" })} disabled={!editable}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="act">ACTIVO</SelectItem>
                    <SelectItem value="ina">INACTIVO</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Tipo de Contribuyente</Label>
                <Select value={form.contributor_type} onValueChange={v => setForm({ ...form, contributor_type: v })} disabled={!editable}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CONTRIB.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Teléfono</Label>
                <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} disabled={!editable} />
              </div>
              <div>
                <Label>Correo</Label>
                <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} disabled={!editable} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Cuenta IVA (Contabilidad)</Label>
                <div className="flex gap-1">
                  <Input readOnly value={account ? `${account.code} — ${account.name}` : ""} placeholder="Sin cuenta asignada" />
                  <Button type="button" variant="secondary" size="icon" onClick={() => { setAccountTerm(""); setAccountSearchOpen(true); }} disabled={!editable}>
                    <Search className="h-4 w-4" />
                  </Button>
                  {form.iva_account_id && editable && (
                    <Button type="button" variant="ghost" size="icon" onClick={() => setForm({ ...form, iva_account_id: null })}>
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
              <div>
                <Label>Tipo de Retención IVA</Label>
                <Select value={form.iva_withholding_rate} onValueChange={v => setForm({ ...form, iva_withholding_rate: v })} disabled={!editable}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{WH_RATES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            {/* Barra de acciones */}
            <div className="flex items-center gap-2 pt-3 border-t">
              {mode === "consulta" ? (
                <>
                  <Button className="flex-1 gap-2" variant="secondary" disabled>
                    <Save className="h-4 w-4" /> Sincronizar maestro
                  </Button>
                  {allowed && <>
                    <Button variant="outline" className="gap-2" onClick={startNew}><FilePlus2 className="h-4 w-4" /> Nuevo</Button>
                    <Button variant="outline" size="icon" onClick={startEdit} disabled={!current}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="outline" size="icon" onClick={() => setDeleteOpen(true)} disabled={!current}><Trash2 className="h-4 w-4" /></Button>
                  </>}
                </>
              ) : (
                <>
                  <Button className="flex-1 gap-2" onClick={save}><Save className="h-4 w-4" /> Guardar</Button>
                  <Button variant="outline" onClick={cancelEdit}>Cancelar</Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* INDICADORES */}
        <Card>
          <CardContent className="p-5 space-y-4">
            <div className="text-center text-sm font-semibold tracking-wider text-primary uppercase">Indicadores de Carga</div>
            <div className="rounded-lg border p-4 text-center">
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Base acumulada</div>
              <div className="text-3xl font-bold tabular-nums">{formatBs(indicators.base)}</div>
            </div>
            <div className="rounded-lg border p-4 text-center">
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">IVA Retenido Calculado</div>
              <div className="text-3xl font-bold tabular-nums text-primary">{formatBs(indicators.ivaRet)}</div>
            </div>
            <Button className="w-full gap-2" onClick={exportTxt} disabled={!current || movements.length === 0}>
              <FileDown className="h-4 w-4" /> Generar TXT SENIAT
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* MOVIMIENTOS */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Referencia</TableHead>
                <TableHead>Concepto</TableHead>
                <TableHead className="text-right">Base</TableHead>
                <TableHead className="text-right">IVA</TableHead>
                <TableHead className="text-right">Retención</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!current && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Selecciona un proveedor.</TableCell></TableRow>}
              {current && movements.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Sin movimientos registrados.</TableCell></TableRow>}
              {movements.map((m: any) => (
                <TableRow key={m.id}>
                  <TableCell className="text-sm">{formatDate(m.invoice_date)}</TableCell>
                  <TableCell className="font-mono text-xs">{m.invoice_number}{m.control_number ? ` / ${m.control_number}` : ""}</TableCell>
                  <TableCell className="text-sm">Factura de compra</TableCell>
                  <TableCell className="text-right tabular-nums">{formatBs(m.base_amount)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatBs(m.iva_amount)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatBs(m.wh_iva + m.wh_islr)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* BUSCADOR PROVEEDORES */}
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Buscar proveedor</DialogTitle></DialogHeader>
          <Input autoFocus placeholder="Código, RIF o nombre..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          <div className="max-h-96 overflow-y-auto border rounded">
            {filtered.map(s => (
              <button key={s.id} className="w-full text-left px-3 py-2 hover:bg-muted flex items-center gap-3 border-b last:border-b-0"
                onClick={() => { loadSupplier(s); setSearchOpen(false); }}>
                <span className="font-mono text-xs text-muted-foreground w-16">{s.code ?? "—"}</span>
                <span className="font-mono text-xs w-32">{s.rif}</span>
                <span className="text-sm flex-1 truncate">{s.name}</span>
                {!s.is_active && <Badge variant="outline" className="text-xs">Inactivo</Badge>}
              </button>
            ))}
            {filtered.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">Sin resultados.</div>}
          </div>
        </DialogContent>
      </Dialog>

      {/* BUSCADOR CUENTAS */}
      <Dialog open={accountSearchOpen} onOpenChange={setAccountSearchOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Buscar cuenta contable (imputable)</DialogTitle></DialogHeader>
          <Input autoFocus placeholder="Código o nombre..." value={accountTerm} onChange={e => setAccountTerm(e.target.value)} />
          <div className="max-h-96 overflow-y-auto border rounded">
            {filteredAccounts.map(a => (
              <button key={a.id} className="w-full text-left px-3 py-2 hover:bg-muted flex items-center gap-3 border-b last:border-b-0"
                onClick={() => { setForm({ ...form, iva_account_id: a.id }); setAccountSearchOpen(false); }}>
                <span className="font-mono text-xs w-24">{a.code}</span>
                <span className="text-sm flex-1">{a.name}</span>
              </button>
            ))}
            {filteredAccounts.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">Sin cuentas imputables.</div>}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar proveedor?</AlertDialogTitle>
            <AlertDialogDescription>
              No podrás recuperarlo. Si tiene facturas o retenciones asociadas, la operación fallará.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={remove}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
