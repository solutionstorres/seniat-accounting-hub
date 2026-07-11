import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany, canWrite } from "@/lib/company-context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Pencil, ChevronRight, ChevronDown } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/centros-costo")({
  component: CentrosCosto,
});

type CC = { id: string; parent_id: string | null; code: string; name: string; is_active: boolean; level: number };

function CentrosCosto() {
  const { activeCompany } = useCompany();
  const qc = useQueryClient();
  const allowed = canWrite(activeCompany?.role);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<{ mode: "new" | "edit"; parent?: CC | null; item?: CC } | null>(null);
  const [form, setForm] = useState({ code: "", name: "", is_active: true });

  const { data: items } = useQuery({
    queryKey: ["cost_centers", activeCompany?.id],
    enabled: !!activeCompany,
    queryFn: async () => {
      const { data, error } = await supabase.from("cost_centers").select("*").eq("company_id", activeCompany!.id).order("code");
      if (error) throw error;
      return data as CC[];
    },
  });

  const list = items ?? [];
  const childrenOf = (pid: string | null) => list.filter(x => x.parent_id === pid);

  function openNew(parent: CC | null) {
    const suggested = parent ? `${parent.code}.${(childrenOf(parent.id).length + 1).toString().padStart(2, "0")}` : String(childrenOf(null).length + 1);
    setForm({ code: suggested, name: "", is_active: true });
    setDialog({ mode: "new", parent });
  }
  function openEdit(item: CC) {
    setForm({ code: item.code, name: item.name, is_active: item.is_active });
    setDialog({ mode: "edit", item });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!activeCompany || !dialog) return;
    if (dialog.mode === "new") {
      const parent = dialog.parent ?? null;
      const level = parent ? parent.level + 1 : 1;
      const { error } = await supabase.from("cost_centers").insert({
        company_id: activeCompany.id, parent_id: parent?.id ?? null,
        code: form.code.trim(), name: form.name.trim(), is_active: form.is_active, level,
      });
      if (error) { toast.error(error.message); return; }
      toast.success("Centro creado");
    } else {
      const { error } = await supabase.from("cost_centers").update({
        code: form.code.trim(), name: form.name.trim(), is_active: form.is_active,
      }).eq("id", dialog.item!.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Centro actualizado");
    }
    setDialog(null);
    qc.invalidateQueries({ queryKey: ["cost_centers", activeCompany.id] });
  }

  async function remove(item: CC) {
    if (!confirm(`¿Eliminar centro "${item.name}"? También se eliminan sus hijos.`)) return;
    const { error } = await supabase.from("cost_centers").delete().eq("id", item.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Eliminado");
    qc.invalidateQueries({ queryKey: ["cost_centers", activeCompany!.id] });
  }

  function toggle(id: string) {
    const s = new Set(expanded);
    if (s.has(id)) s.delete(id); else s.add(id);
    setExpanded(s);
  }

  function renderNode(node: CC, depth: number) {
    const kids = childrenOf(node.id);
    const isOpen = expanded.has(node.id);
    return (
      <div key={node.id}>
        <div className="flex items-center gap-2 py-1.5 px-2 hover:bg-muted rounded" style={{ paddingLeft: depth * 20 + 8 }}>
          {kids.length > 0 ? (
            <button onClick={() => toggle(node.id)}>{isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</button>
          ) : <span className="w-4" />}
          <span className="font-mono text-xs text-muted-foreground w-24">{node.code}</span>
          <span className={"text-sm flex-1 " + (node.is_active ? "" : "text-muted-foreground line-through")}>{node.name}</span>
          {allowed && (
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" title="Agregar sub-centro" onClick={() => openNew(node)}><Plus className="h-3.5 w-3.5" /></Button>
              <Button variant="ghost" size="icon" title="Editar" onClick={() => openEdit(node)}><Pencil className="h-3.5 w-3.5" /></Button>
              <Button variant="ghost" size="icon" title="Eliminar" onClick={() => remove(node)}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          )}
        </div>
        {isOpen && kids.map(k => renderNode(k, depth + 1))}
      </div>
    );
  }

  if (!activeCompany) return <div className="p-8 text-center text-muted-foreground">Selecciona una empresa.</div>;

  const roots = childrenOf(null);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Centros de Costo</h1>
          <p className="text-sm text-muted-foreground">Estructura jerárquica para clasificar movimientos e informes.</p>
        </div>
        {allowed && <Button className="gap-2" onClick={() => openNew(null)}><Plus className="h-4 w-4" /> Nuevo centro raíz</Button>}
      </div>
      <Card>
        <CardContent className="p-3">
          {roots.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Sin centros de costo. Crea el primero.</div>
          ) : roots.map(r => renderNode(r, 0))}
        </CardContent>
      </Card>

      <Dialog open={!!dialog} onOpenChange={(v) => !v && setDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{dialog?.mode === "new" ? (dialog.parent ? `Nuevo sub-centro de ${dialog.parent.name}` : "Nuevo centro raíz") : "Editar centro"}</DialogTitle></DialogHeader>
          <form onSubmit={save} className="space-y-3">
            <div><Label>Código</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required /></div>
            <div><Label>Nombre</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="active" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
              <Label htmlFor="active">Activo</Label>
            </div>
            <DialogFooter><Button type="submit">Guardar</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
