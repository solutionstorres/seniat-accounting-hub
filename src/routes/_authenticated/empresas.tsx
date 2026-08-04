import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany, isAdmin, ROLE_LABEL } from "@/lib/company-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Building2, Plus, Pencil, Trash2 } from "lucide-react";
import { z } from "zod";

export const Route = createFileRoute("/_authenticated/empresas")({
  component: CompaniesPage,
});

const rifRegex = /^[VEJPG]-?\d{7,10}-?\d?$/i;
const schema = z.object({
  rif: z.string().trim().regex(rifRegex, "RIF inválido (ej: J-12345678-9)"),
  legal_name: z.string().trim().min(3).max(200),
  trade_name: z.string().trim().max(200).optional(),
  fiscal_address: z.string().trim().min(5).max(500),
  phone: z.string().trim().max(30).optional(),
  email: z.string().trim().email().optional().or(z.literal("")),
  tax_regime: z.string().default("ordinario"),
  fiscal_year_start: z.string().min(10),
  fiscal_year_end: z.string().min(10),
  current_period_month: z.string().min(7),
  accounts_level: z.coerce.number().int().min(1).max(10),
  is_iva_withholding_agent: z.boolean().default(false),
  is_islr_withholding_agent: z.boolean().default(false),
  default_iva_withholding_rate: z.coerce.number().min(0).max(100),
  default_islr_withholding_rate: z.coerce.number().min(0).max(100),
  igtf_rate: z.coerce.number().min(0).max(100),
});

const emptyForm = () => {
  const y = new Date().getFullYear();
  return {
    rif: "", legal_name: "", trade_name: "", fiscal_address: "", phone: "", email: "",
    tax_regime: "ordinario",
    fiscal_year_start: `${y}-01-01`,
    fiscal_year_end: `${y}-12-31`,
    current_period_month: new Date().toISOString().slice(0, 7),
    accounts_level: 5,
    is_iva_withholding_agent: false,
    is_islr_withholding_agent: false,
    default_iva_withholding_rate: 75,
    default_islr_withholding_rate: 0,
    igtf_rate: 3,
  };
};


function CompaniesPage() {
  const { companies, refetch, activeCompany } = useCompany();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  function openNew() {
    setEditingId(null);
    setForm(emptyForm());
    setOpen(true);
  }

  function openEdit(c: any) {
    setEditingId(c.id);
    setForm({
      rif: c.rif ?? "",
      legal_name: c.legal_name ?? "",
      trade_name: c.trade_name ?? "",
      fiscal_address: c.fiscal_address ?? "",
      phone: c.phone ?? "",
      email: c.email ?? "",
      tax_regime: c.tax_regime ?? "ordinario",
      fiscal_year_start: (c.fiscal_year_start ?? `${new Date().getFullYear()}-01-01`).slice(0, 10),
      fiscal_year_end: (c.fiscal_year_end ?? `${new Date().getFullYear()}-12-31`).slice(0, 10),
      current_period_month: (c.current_period_month ?? new Date().toISOString().slice(0, 10)).slice(0, 7),
      accounts_level: c.accounts_level ?? 5,
      is_iva_withholding_agent: !!c.is_iva_withholding_agent,
      is_islr_withholding_agent: !!c.is_islr_withholding_agent,
      default_iva_withholding_rate: Number(c.default_iva_withholding_rate ?? 75),
      default_islr_withholding_rate: Number(c.default_islr_withholding_rate ?? 0),
      igtf_rate: Number(c.igtf_rate ?? 3),

    });
    setOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const parsed = schema.parse(form);
      setSaving(true);
      const payload = {
        rif: parsed.rif.toUpperCase(),
        legal_name: parsed.legal_name,
        trade_name: parsed.trade_name || null,
        fiscal_address: parsed.fiscal_address,
        phone: parsed.phone || null,
        email: parsed.email || null,
        tax_regime: parsed.tax_regime,
        fiscal_year_start: parsed.fiscal_year_start,
        fiscal_year_end: parsed.fiscal_year_end,
        current_period_month: `${parsed.current_period_month}-01`,
        accounts_level: parsed.accounts_level,
      };
      if (editingId) {
        const { error } = await supabase.from("companies").update(payload).eq("id", editingId);
        if (error) throw error;
        toast.success("Empresa actualizada");
      } else {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) throw new Error("Sesión inválida");
        const { data: company, error } = await supabase.from("companies").insert({
          ...payload,
          created_by: userData.user.id,
        }).select().single();
        if (error) throw error;
        const { error: memErr } = await supabase.from("company_members").insert({
          company_id: company.id,
          user_id: userData.user.id,
          role: "admin",
        });
        if (memErr) throw memErr;
        toast.success("Empresa creada");
      }
      setOpen(false);
      refetch();
      qc.invalidateQueries();
    } catch (err: any) {
      toast.error(err.errors?.[0]?.message ?? err.message ?? "No se pudo guardar la empresa");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    const { error } = await supabase.from("companies").delete().eq("id", deleteId);
    if (error) { toast.error(error.message); return; }
    toast.success("Empresa eliminada");
    setDeleteId(null);
    refetch();
    qc.invalidateQueries();
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Empresas</h1>
          <p className="text-sm text-muted-foreground">Empresas donde perteneces como miembro.</p>
        </div>
        <Button onClick={openNew} className="gap-2"><Plus className="h-4 w-4" /> Nueva empresa</Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingId ? "Editar empresa" : "Registrar empresa"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>RIF</Label><Input value={form.rif} onChange={(e) => setForm({ ...form, rif: e.target.value })} placeholder="J-12345678-9" required /></div>
              <div><Label>Régimen</Label><Input value={form.tax_regime} onChange={(e) => setForm({ ...form, tax_regime: e.target.value })} placeholder="ordinario" /></div>
            </div>
            <div><Label>Razón social</Label><Input value={form.legal_name} onChange={(e) => setForm({ ...form, legal_name: e.target.value })} required /></div>
            <div><Label>Nombre comercial</Label><Input value={form.trade_name} onChange={(e) => setForm({ ...form, trade_name: e.target.value })} /></div>
            <div><Label>Dirección fiscal</Label><Input value={form.fiscal_address} onChange={(e) => setForm({ ...form, fiscal_address: e.target.value })} required /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Teléfono</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div><Label>Correo</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            </div>
            <div className="border-t pt-3 mt-3">
              <p className="text-sm font-semibold mb-2">Ejercicio contable</p>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>Inicio del ejercicio</Label><Input type="date" value={form.fiscal_year_start} onChange={(e) => setForm({ ...form, fiscal_year_start: e.target.value })} required /></div>
                <div><Label>Fin del ejercicio</Label><Input type="date" value={form.fiscal_year_end} onChange={(e) => setForm({ ...form, fiscal_year_end: e.target.value })} required /></div>
                <div><Label>Mes actual</Label><Input type="month" value={form.current_period_month} onChange={(e) => setForm({ ...form, current_period_month: e.target.value })} required /></div>
              </div>
              <div className="mt-3">
                <Label>Niveles del Plan de Cuentas</Label>
                <Select value={String(form.accounts_level)} onValueChange={(v) => setForm({ ...form, accounts_level: Number(v) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[3,4,5,6,7,8].map(n => <SelectItem key={n} value={String(n)}>{n} niveles</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">Profundidad máxima permitida para el árbol de cuentas contables.</p>
              </div>
            </div>
            <DialogFooter><Button type="submit" disabled={saving}>{saving ? "Guardando..." : editingId ? "Guardar cambios" : "Crear empresa"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar empresa?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción eliminará la empresa y todos sus datos contables asociados. No se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="grid gap-4 md:grid-cols-2">
        {companies.map((c: any) => (
          <Card key={c.id} className={activeCompany?.id === c.id ? "border-primary" : ""}>
            <CardHeader className="flex flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2"><Building2 className="h-4 w-4" />{c.legal_name}</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">RIF {c.rif}</p>
              </div>
              <div className="flex items-center gap-1">
                <Badge variant="secondary">{ROLE_LABEL[c.role as keyof typeof ROLE_LABEL]}</Badge>
                {isAdmin(c.role) && (
                  <>
                    <Button size="icon" variant="ghost" onClick={() => openEdit(c)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => setDeleteId(c.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </>
                )}
              </div>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-1">
              <p>{c.fiscal_address}</p>
              {c.phone && <p>Tel: {c.phone}</p>}
              {c.email && <p>{c.email}</p>}
              {c.fiscal_year_start && (
                <p className="text-xs pt-2 border-t mt-2">
                  Ejercicio: {c.fiscal_year_start} → {c.fiscal_year_end} · {c.accounts_level ?? 5} niveles
                </p>
              )}
            </CardContent>
          </Card>
        ))}
        {companies.length === 0 && (
          <Card className="md:col-span-2">
            <CardContent className="p-10 text-center text-muted-foreground">
              Aún no tienes empresas. Crea la primera con el botón de arriba.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
