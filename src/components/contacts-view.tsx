import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany, canWrite } from "@/lib/company-context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Row = Database["public"]["Tables"]["customers"]["Row"];

const CONTRIB = [
  { value: "ordinario", label: "Contribuyente ordinario" },
  { value: "formal", label: "Contribuyente formal" },
  { value: "especial", label: "Contribuyente especial" },
  { value: "no_contribuyente", label: "No contribuyente" },
  { value: "gobierno", label: "Ente gobierno" },
];

const emptyForm = () => ({ rif: "", name: "", contributor_type: "ordinario", address: "", phone: "", email: "" });

export function ContactsView({ table, title, canOperator = false }: { table: "customers" | "suppliers"; title: string; canOperator?: boolean }) {
  const { activeCompany } = useCompany();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());
  const allowed = canWrite(activeCompany?.role) || (canOperator && activeCompany?.role === "operador");

  const { data, isLoading } = useQuery({
    queryKey: [table, activeCompany?.id],
    enabled: !!activeCompany,
    queryFn: async () => {
      const { data, error } = await supabase.from(table).select("*").eq("company_id", activeCompany!.id).order("name");
      if (error) throw error;
      return data as Row[];
    },
  });

  function openNew() {
    setEditingId(null); setForm(emptyForm()); setOpen(true);
  }
  function openEdit(r: Row) {
    setEditingId(r.id);
    setForm({
      rif: r.rif, name: r.name, contributor_type: r.contributor_type,
      address: r.address ?? "", phone: r.phone ?? "", email: r.email ?? "",
    });
    setOpen(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!activeCompany) return;
    const payload = {
      rif: form.rif.toUpperCase().trim(),
      name: form.name.trim(),
      contributor_type: form.contributor_type as any,
      address: form.address || null,
      phone: form.phone || null,
      email: form.email || null,
    };
    if (editingId) {
      const { error } = await supabase.from(table).update(payload).eq("id", editingId);
      if (error) { toast.error(error.message); return; }
      toast.success("Registro actualizado");
    } else {
      const { error } = await supabase.from(table).insert({ ...payload, company_id: activeCompany.id });
      if (error) { toast.error(error.message); return; }
      toast.success("Registro creado");
    }
    setOpen(false);
    setForm(emptyForm());
    qc.invalidateQueries({ queryKey: [table, activeCompany.id] });
  }

  async function handleDelete() {
    if (!deleteId) return;
    const { error } = await supabase.from(table).delete().eq("id", deleteId);
    if (error) { toast.error(error.message); return; }
    toast.success("Registro eliminado");
    setDeleteId(null);
    qc.invalidateQueries({ queryKey: [table, activeCompany!.id] });
  }

  if (!activeCompany) return <div className="p-8 text-center text-muted-foreground">Selecciona una empresa primero.</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {allowed && <Button onClick={openNew} className="gap-2"><Plus className="h-4 w-4" /> Nuevo</Button>}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingId ? "Editar" : "Registrar"} {title.toLowerCase().slice(0, -1)}</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>RIF / Cédula</Label><Input value={form.rif} onChange={(e) => setForm({ ...form, rif: e.target.value })} required placeholder="V-12345678" /></div>
              <div><Label>Tipo</Label>
                <Select value={form.contributor_type} onValueChange={(v) => setForm({ ...form, contributor_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CONTRIB.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Nombre / Razón social</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
            <div><Label>Dirección</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Teléfono</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div><Label>Correo</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            </div>
            <DialogFooter><Button type="submit">{editingId ? "Guardar cambios" : "Guardar"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar registro?</AlertDialogTitle>
            <AlertDialogDescription>No podrás recuperarlo. Si tiene movimientos asociados, la operación fallará.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>RIF / Cédula</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead className="w-24 text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Cargando...</TableCell></TableRow>}
              {!isLoading && (data ?? []).length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Sin registros.</TableCell></TableRow>}
              {(data ?? []).map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-sm">{r.rif}</TableCell>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{CONTRIB.find(c => c.value === r.contributor_type)?.label}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.phone || r.email || "—"}</TableCell>
                  <TableCell className="text-right">
                    {allowed && (
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(r)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => setDeleteId(r.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    )}
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
