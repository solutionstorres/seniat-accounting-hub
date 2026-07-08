import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany, isAdmin, ROLE_LABEL } from "@/lib/company-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Building2, Plus } from "lucide-react";
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
});

function CompaniesPage() {
  const { companies, refetch, activeCompany } = useCompany();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ rif: "", legal_name: "", trade_name: "", fiscal_address: "", phone: "", email: "", tax_regime: "ordinario" });
  const [saving, setSaving] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      const parsed = schema.parse(form);
      setSaving(true);
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Sesión inválida");
      const { data: company, error } = await supabase.from("companies").insert({
        rif: parsed.rif.toUpperCase(),
        legal_name: parsed.legal_name,
        trade_name: parsed.trade_name || null,
        fiscal_address: parsed.fiscal_address,
        phone: parsed.phone || null,
        email: parsed.email || null,
        tax_regime: parsed.tax_regime,
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
      setOpen(false);
      setForm({ rif: "", legal_name: "", trade_name: "", fiscal_address: "", phone: "", email: "", tax_regime: "ordinario" });
      refetch();
      qc.invalidateQueries();
    } catch (err: any) {
      toast.error(err.errors?.[0]?.message ?? err.message ?? "No se pudo crear la empresa");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Empresas</h1>
          <p className="text-sm text-muted-foreground">Empresas donde perteneces como miembro.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="gap-2"><Plus className="h-4 w-4" /> Nueva empresa</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Registrar empresa</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-3">
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
              <DialogFooter><Button type="submit" disabled={saving}>{saving ? "Guardando..." : "Crear empresa"}</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {companies.map((c) => (
          <Card key={c.id} className={activeCompany?.id === c.id ? "border-primary" : ""}>
            <CardHeader className="flex flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2"><Building2 className="h-4 w-4" />{c.legal_name}</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">RIF {c.rif}</p>
              </div>
              <Badge variant="secondary">{ROLE_LABEL[c.role]}</Badge>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-1">
              <p>{c.fiscal_address}</p>
              {c.phone && <p>Tel: {c.phone}</p>}
              {c.email && <p>{c.email}</p>}
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
