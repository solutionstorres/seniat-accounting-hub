/* eslint-disable */
// @ts-nocheck
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
        <div className="flex items-center gap-2 py-1.5 px-2 hover:bg-emerald-900/20 rounded border-b border-emerald-500/10 transition-colors" style={{ paddingLeft: depth * 20 + 8 }}>
          {kids.length > 0 ? (
            <button type="button" onClick={() => toggle(node.id)} className="text-emerald-400 hover:text-emerald-200">
              {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          ) : <span className="w-4" />}
          <span className="font-mono text-xs text-emerald-400/80 w-24">{node.code}</span>
          <span className={"text-sm flex-1 text-emerald-200 " + (node.is_active ? "" : "text-emerald-600 line-through")}>{node.name}</span>
          {allowed && (
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" title="Agregar sub-centro" onClick={() => openNew(node)} className="text-emerald-400 hover:text-emerald-200 hover:bg-emerald-950"><Plus className="h-3.5 w-3.5" /></Button>
              <Button variant="ghost" size="icon" title="Editar" onClick={() => openEdit(node)} className="text-emerald-400 hover:text-emerald-200 hover:bg-emerald-950"><Pencil className="h-3.5 w-3.5" /></Button>
              <Button variant="ghost" size="icon" title="Eliminar" onClick={() => remove(node)} className="text-emerald-400 hover:text-red-400 hover:bg-emerald-950"><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          )}
        </div>
        {isOpen && kids.map(k => renderNode(k, depth + 1))}
      </div>
    );
  }

  if (!activeCompany) return <div className="p-8 text-center text-emerald-600 font-mono bg-black min-h-screen">Selecciona una empresa.</div>;

  const roots = childrenOf(null);

  return (
    <div className="min-h-screen bg-black text-emerald-400 p-2 sm:p-4 font-mono">
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between [&_h1]:text-emerald-300 [&_h1]:drop-shadow-[0_0_8px_rgba(0,255,102,0.4)] [&_p]:text-emerald-400/80">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Centros de Costo</h1>
            <p className="text-sm">Estructura jerárquica para clasificar movimientos e informes.</p>
          </div>
          {allowed && (
            <Button className="gap-2 bg-emerald-600 text-black font-bold hover:bg-emerald-500 shadow-[0_0_10px_rgba(0,255,102,0.2)] font-mono" onClick={() => openNew(null)}>
              <Plus className="h-4 w-4" /> Nuevo centro raíz
            </Button>
          )}
        </div>
        
        <div className="rounded-lg border border-emerald-500/40 bg-black/95 shadow-[0_0_20px_rgba(0,255,102,0.15)] overflow-hidden">
          <Card className="bg-transparent border-0">
            <CardContent className="p-3">
              {roots.length === 0 ? (
                <div className="p-8 text-center text-sm text-emerald-600 font-mono">Sin centros de costo. Crea el primero.</div>
              ) : roots.map(r => renderNode(r, 0))}
            </CardContent>
          </Card>
        </div>

        <Dialog open={!!dialog} onOpenChange={(v) => !v && setDialog(null)}>
          <DialogContent className="max-w-md bg-black border border-emerald-500/50 text-emerald-400 font-mono shadow-[0_0_25px_rgba(0,255,102,0.2)]">
            <DialogHeader>
              <DialogTitle className="text-emerald-300 text-lg border-b border-emerald-500/30 pb-2">
                {dialog?.mode === "new" ? (dialog.parent ? `Nuevo sub-centro de ${dialog.parent.name}` : "Nuevo centro raíz") : "Editar centro"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={save} className="space-y-3 mt-2">
              <div>
                <Label className="text-emerald-300">Código</Label>
                <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required className="bg-black border-emerald-500/60 text-emerald-200 focus-visible:ring-emerald-400 font-mono" />
              </div>
              <div>
                <Label className="text-emerald-300">Nombre</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="bg-black border-emerald-500/60 text-emerald-200 focus-visible:ring-emerald-400 font-mono" />
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <input type="checkbox" id="active" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="accent-emerald-500 bg-black border-emerald-500" />
                <Label htmlFor="active" className="text-emerald-300 cursor-pointer">Activo</Label>
              </div>
              <DialogFooter className="pt-2 border-t border-emerald-500/30">
                <Button type="submit" className="w-full bg-emerald-500 text-black font-bold hover:bg-emerald-400 transition-all shadow-[0_0_15px_rgba(0,255,102,0.4)] font-mono">Guardar</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
