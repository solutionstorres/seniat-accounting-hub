import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany, canWrite } from "@/lib/company-context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronRight, ChevronDown, Plus, Sparkles, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatBs, formatDate, currentMonthRange } from "@/lib/format";

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
  const maxLevel: number = (activeCompany as any)?.accounts_level ?? 5;

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [parent, setParent] = useState<Account | null>(null);
  const [form, setForm] = useState({ code: "", name: "", account_type: "activo", nature: "deudora", is_postable: true });
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [movementsAcc, setMovementsAcc] = useState<Account | null>(null);

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
    const newLevel = (p?.level ?? 0) + 1;
    if (newLevel > maxLevel) {
      toast.error(`Nivel máximo permitido: ${maxLevel}. Ajústalo en la configuración de la empresa.`);
      return;
    }
    setEditingId(null);
    setParent(p);
    const siblings = tree.get(p?.id ?? null) ?? [];
    const nextNum = siblings.length + 1;
    const code = p ? `${p.code}.${String(nextNum).padStart(2, "0")}` : String(nextNum);
    setForm({
      code,
      name: "",
      account_type: p?.account_type ?? "activo",
      nature: p?.nature ?? "deudora",
      is_postable: newLevel === maxLevel,
    });
    setDialogOpen(true);
  }

  function openEdit(acc: Account) {
    setEditingId(acc.id);
    setParent(null);
    setForm({
      code: acc.code, name: acc.name,
      account_type: acc.account_type, nature: acc.nature,
      is_postable: acc.is_postable,
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
    if (editingId) {
      const { error } = await supabase.from("chart_accounts").update({
        code: form.code.trim(),
        name: form.name.trim(),
        account_type: form.account_type as any,
        nature: form.nature as any,
        is_postable: form.is_postable,
      }).eq("id", editingId);
      if (error) { toast.error(error.message); return; }
      toast.success("Cuenta actualizada");
    } else {
      if (parent?.is_postable) {
        await supabase.from("chart_accounts").update({ is_postable: false }).eq("id", parent.id);
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
    }
    setDialogOpen(false);
    qc.invalidateQueries();
  }

  async function handleDelete() {
    if (!deleteId) return;
    const { error } = await supabase.from("chart_accounts").delete().eq("id", deleteId);
    if (error) { toast.error(error.message); return; }
    toast.success("Cuenta eliminada");
    setDeleteId(null);
    qc.invalidateQueries();
  }

  function Node({ acc }: { acc: Account }) {
    const children = tree.get(acc.id) ?? [];
    const hasChildren = children.length > 0;
    const isOpen = expanded.has(acc.id);
    const canAddChild = allowed && acc.level < maxLevel;
    return (
      <div>
        <div
          className="flex items-center gap-2 py-1.5 px-2 hover:bg-muted/50 rounded-md group"
          style={{ paddingLeft: `${acc.level * 16}px` }}
          onDoubleClick={() => acc.is_postable && setMovementsAcc(acc)}
          title={acc.is_postable ? "Doble clic para ver movimientos" : ""}
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
          {acc.is_postable && <Badge variant="secondary" className="text-[10px]">Imputable N{acc.level}</Badge>}
          {allowed && (
            <div className="flex opacity-0 group-hover:opacity-100 transition-opacity">
              {canAddChild && (
                <Button size="sm" variant="ghost" onClick={() => openNew(acc)} title="Agregar sub-cuenta">
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => openEdit(acc)} title="Editar">
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setDeleteId(acc.id)} title="Eliminar">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
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
          <p className="text-sm text-muted-foreground">
            Estructura jerárquica · Máximo {maxLevel} niveles · Doble clic sobre una cuenta imputable para ver movimientos.
          </p>
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
            <DialogTitle>{editingId ? "Editar cuenta" : `Nueva cuenta${parent ? ` bajo ${parent.name}` : ""}`}</DialogTitle>
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
            <DialogFooter><Button type="submit">{editingId ? "Guardar cambios" : "Crear cuenta"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar cuenta?</AlertDialogTitle>
            <AlertDialogDescription>Si tiene movimientos o sub-cuentas, la operación fallará. No se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <MovementsDialog acc={movementsAcc} onClose={() => setMovementsAcc(null)} companyId={activeCompany.id} />
    </div>
  );
}

function MovementsDialog({ acc, onClose, companyId }: { acc: Account | null; onClose: () => void; companyId: string }) {
  const rng = currentMonthRange();
  const [from, setFrom] = useState(rng.from);
  const [to, setTo] = useState(rng.to);

  const { data } = useQuery({
    queryKey: ["account-mov", acc?.id, from, to],
    enabled: !!acc,
    queryFn: async () => {
      const { data: prior } = await supabase.from("journal_lines")
        .select("debit,credit,entry:journal_entries!inner(entry_date,company_id,status)")
        .eq("account_id", acc!.id).lt("entry.entry_date", from);
      let opening = 0;
      (prior ?? []).forEach((l: any) => {
        if (l.entry.status !== "anulado" && l.entry.company_id === companyId) {
          opening += Number(l.debit) - Number(l.credit);
        }
      });
      const { data: rows } = await supabase.from("journal_lines")
        .select("debit,credit,description,entry:journal_entries!inner(entry_date,entry_number,description,company_id,status)")
        .eq("account_id", acc!.id)
        .gte("entry.entry_date", from).lte("entry.entry_date", to);
      const valid = (rows ?? []).filter((l: any) => l.entry.status !== "anulado" && l.entry.company_id === companyId);
      valid.sort((a: any, b: any) => a.entry.entry_date.localeCompare(b.entry.entry_date));
      return { opening, rows: valid };
    },
  });

  let running = data?.opening ?? 0;
  const totalD = (data?.rows ?? []).reduce((s: number, l: any) => s + Number(l.debit), 0);
  const totalC = (data?.rows ?? []).reduce((s: number, l: any) => s + Number(l.credit), 0);

  return (
    <Dialog open={!!acc} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {acc && <><span className="font-mono text-sm mr-2">{acc.code}</span>{acc.name}</>}
          </DialogTitle>
        </DialogHeader>
        <div className="flex items-end gap-3 mb-3">
          <div><Label className="text-xs">Desde</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div><Label className="text-xs">Hasta</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          <div className="ml-auto text-sm text-muted-foreground">
            Saldo inicial: <strong className="tabular-nums">{formatBs(Math.abs(data?.opening ?? 0))}</strong>
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">Fecha</TableHead>
              <TableHead className="w-16">N°</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead className="text-right w-28">Débito</TableHead>
              <TableHead className="text-right w-28">Crédito</TableHead>
              <TableHead className="text-right w-28">Saldo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data?.rows ?? []).length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">Sin movimientos en el período.</TableCell></TableRow>}
            {(data?.rows ?? []).map((l: any, i: number) => {
              running += Number(l.debit) - Number(l.credit);
              return (
                <TableRow key={i}>
                  <TableCell className="text-xs">{formatDate(l.entry.entry_date)}</TableCell>
                  <TableCell className="font-mono text-xs">{l.entry.entry_number}</TableCell>
                  <TableCell className="text-sm">{l.description || l.entry.description}</TableCell>
                  <TableCell className="text-right tabular-nums text-sm">{Number(l.debit) > 0 ? formatBs(l.debit) : ""}</TableCell>
                  <TableCell className="text-right tabular-nums text-sm">{Number(l.credit) > 0 ? formatBs(l.credit) : ""}</TableCell>
                  <TableCell className="text-right tabular-nums text-sm">{formatBs(Math.abs(running))}</TableCell>
                </TableRow>
              );
            })}
            {(data?.rows ?? []).length > 0 && (
              <TableRow className="font-semibold bg-muted/50">
                <TableCell colSpan={3} className="text-right">Totales del período</TableCell>
                <TableCell className="text-right tabular-nums">{formatBs(totalD)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatBs(totalC)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatBs(Math.abs(running))}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </DialogContent>
    </Dialog>
  );
}
