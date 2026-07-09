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
import { Badge } from "@/components/ui/badge";
import { ChevronRight, ChevronDown, Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/plan-cuentas")({
  component: PlanCuentasPage,
});

type Account = {
  id: string;
  parent_id: string | null;
  code: string;
  name: string;
  account_type: string;
  nature: string;
  level: number;
  is_postable: boolean;
  active: boolean;
};

const TYPES = [
  { v: "activo", l: "Activo", n: "deudora" },
  { v: "pasivo", l: "Pasivo", n: "acreedora" },
  { v: "patrimonio", l: "Patrimonio", n: "acreedora" },
  { v: "ingreso", l: "Ingreso", n: "acreedora" },
  { v: "costo", l: "Costo", n: "deudora" },
  { v: "gasto", l: "Gasto", n: "deudora" },
  { v: "orden", l: "Orden", n: "deudora" },
];

function PlanCuentasPage() {
  const { activeCompany } = useCompany();
  const qc = useQueryClient();
  const allowed = canWrite(activeCompany?.role);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [parent, setParent] = useState<Account | null>(null);
  const [form, setForm] = useState({ code: "", name: "", account_type: "activo", nature: "deudora", is_postable: true });

  const { data: accounts, isLoading } = useQuery({
    queryKey: ["chart_accounts", activeCompany?.id],
    enabled: !!activeCompany,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chart_accounts")
        .select("*")
        .eq("company_id", activeCompany!.id)
        .order("code");
      if (error) throw error;
      return data as Account[];
    },
  });

  const tree = useMemo(() => {
    const map = new Map<string | null, Account[]>();
    (accounts ?? []).forEach((a) => {
      const list = map.get(a.parent_id) ?? [];
      list.push(a);
      map.set(a.parent_id, list);
    });
    return map;
  }, [accounts]);

  function toggle(id: string) {
    setExpanded((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  function openNew(p: Account | null) {
    setParent(p);
    const siblings = tree.get(p?.id ?? null) ?? [];
    const nextNum = siblings.length + 1;
    const code = p ? `${p.code}.${String(nextNum).padStart(2, "0")}` : String(nextNum);
    setForm({
      code,
      name: "",
      account_type: p?.account_type ?? "activo",
      nature: p?.nature ?? "deudora",
      is_postable: true,
    });
    setDialogOpen(true);
  }

  async function seed() {
    if (!activeCompany) return;
    const { error } = await supabase.rpc("seed_chart_of_accounts", { _company_id: activeCompany.id });
    if (error) { toast.error(error.message); return; }
    toast.success("Plan de cuentas estándar cargado");
    qc.invalidateQueries();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!activeCompany) return;
    if (parent) {
      // parent no longer postable
      if (parent.is_postable) {
        await supabase.from("chart_accounts").update({ is_postable: false }).eq("id", parent.id);
      }
    }
    const { error } = await supabase.from("chart_accounts").insert({
      company_id: activeCompany.id,
      parent_id: parent?.id ?? null,
      code: form.code.trim(),
      name: form.name.trim(),
      account_type: form.account_type as any,
      nature: form.nature as any,
      level: (parent?.level ?? 0) + 1,
      is_postable: form.is_postable,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Cuenta creada");
    setDialogOpen(false);
    qc.invalidateQueries();
  }

  function Node({ acc }: { acc: Account }) {
    const children = tree.get(acc.id) ?? [];
    const hasChildren = children.length > 0;
    const isOpen = expanded.has(acc.id);
    return (
      <div>
        <div
          className="flex items-center gap-2 py-1.5 px-2 hover:bg-muted/50 rounded-md"
          style={{ paddingLeft: `${acc.level * 16}px` }}
        >
          <button
            className="w-5 flex items-center justify-center text-muted-foreground"
            onClick={() => hasChildren && toggle(acc.id)}
          >
            {hasChildren ? (isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />) : <span className="w-3" />}
          </button>
          <span className="font-mono text-xs text-muted-foreground w-24">{acc.code}</span>
          <span className={`text-sm flex-1 ${acc.is_postable ? "" : "font-semibold"}`}>{acc.name}</span>
          <Badge variant="outline" className="text-[10px]">{acc.account_type}</Badge>
          {acc.is_postable && <Badge variant="secondary" className="text-[10px]">Imputable</Badge>}
          {allowed && (
            <Button size="sm" variant="ghost" onClick={() => openNew(acc)}>
              <Plus className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
        {isOpen && children.map((c) => <Node key={c.id} acc={c} />)}
      </div>
    );
  }

  if (!activeCompany) return <div className="p-8 text-center text-muted-foreground">Selecciona una empresa.</div>;

  const roots = tree.get(null) ?? [];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Plan de Cuentas</h1>
          <p className="text-sm text-muted-foreground">Estructura jerárquica de cuentas contables por empresa.</p>
        </div>
        <div className="flex gap-2">
          {allowed && roots.length === 0 && (
            <Button variant="outline" onClick={seed} className="gap-2">
              <Sparkles className="h-4 w-4" /> Cargar plan estándar SENIAT
            </Button>
          )}
          {allowed && (
            <Button onClick={() => openNew(null)} className="gap-2">
              <Plus className="h-4 w-4" /> Cuenta raíz
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-3">
          {isLoading && <div className="p-8 text-center text-muted-foreground">Cargando...</div>}
          {!isLoading && roots.length === 0 && (
            <div className="p-10 text-center text-muted-foreground">
              No hay cuentas. Carga el plan estándar SENIAT o crea la primera cuenta raíz.
            </div>
          )}
          {roots.map((r) => <Node key={r.id} acc={r} />)}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva cuenta{parent ? ` bajo ${parent.name}` : ""}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Código</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required /></div>
              <div>
                <Label>Tipo</Label>
                <Select value={form.account_type} onValueChange={(v) => {
                  const t = TYPES.find(x => x.v === v);
                  setForm({ ...form, account_type: v, nature: t?.n ?? form.nature });
                }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TYPES.map(t => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Nombre</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Naturaleza</Label>
                <Select value={form.nature} onValueChange={(v) => setForm({ ...form, nature: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="deudora">Deudora</SelectItem>
                    <SelectItem value="acreedora">Acreedora</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-2">
                <input id="post" type="checkbox" checked={form.is_postable} onChange={(e) => setForm({ ...form, is_postable: e.target.checked })} />
                <Label htmlFor="post">Acepta movimientos (hoja)</Label>
              </div>
            </div>
            <DialogFooter><Button type="submit">Crear cuenta</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
