/* eslint-disable */
// @ts-nocheck
import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany, canWrite } from "@/lib/company-context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Eye, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { formatBs, formatDate, currentMonthRange } from "@/lib/format";
import { MoneyInput, parseMasked } from "@/components/money-input";

export const Route = createFileRoute("/_authenticated/asientos")({
  component: AsientosPage,
});

type Line = { account_id: string; debit: string; credit: string; description: string; cost_center_id: string };

function AsientosPage() {
  const { activeCompany } = useCompany();
  const qc = useQueryClient();
  const allowed = canWrite(activeCompany?.role);
  const rng = currentMonthRange();
  const [from, setFrom] = useState(rng.from);
  const [to, setTo] = useState(rng.to);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<string | null>(null);
  const [header, setHeader] = useState({ entry_date: new Date().toISOString().slice(0, 10), description: "" });
  const [lines, setLines] = useState<Line[]>([
    { account_id: "", debit: "", credit: "", description: "", cost_center_id: "" },
    { account_id: "", debit: "", credit: "", description: "", cost_center_id: "" },
  ]);

  const { data: entries } = useQuery({
    queryKey: ["journal_entries", activeCompany?.id, from, to],
    enabled: !!activeCompany,
    queryFn: async () => {
      const { data, error } = await supabase.from("journal_entries")
        .select("*").eq("company_id", activeCompany!.id)
        .gte("entry_date", from).lte("entry_date", to)
        .order("entry_number", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: accounts } = useQuery({
    queryKey: ["postable_accounts", activeCompany?.id],
    enabled: !!activeCompany,
    queryFn: async () => {
      const { data, error } = await supabase.from("chart_accounts")
        .select("id,code,name,is_postable").eq("company_id", activeCompany!.id)
        .eq("is_postable", true).eq("active", true).order("code");
      if (error) throw error;
      return data;
    },
  });

  const { data: costCenters } = useQuery({
    queryKey: ["cc-asientos", activeCompany?.id],
    enabled: !!activeCompany,
    queryFn: async () => {
      const { data } = await supabase.from("cost_centers")
        .select("id,code,name").eq("company_id", activeCompany!.id).eq("is_active", true).order("code");
      return data ?? [];
    },
  });

  const totals = useMemo(() => {
    const d = lines.reduce((s, l) => s + (parseMasked(l.debit) || 0), 0);
    const c = lines.reduce((s, l) => s + (parseMasked(l.credit) || 0), 0);
    return { debit: d, credit: c, balanced: Math.abs(d - c) < 0.01 && d > 0 };
  }, [lines]);

  const { data: viewData } = useQuery({
    queryKey: ["je_view", view],
    enabled: !!view,
    queryFn: async () => {
      const [{ data: e }, { data: l }] = await Promise.all([
        supabase.from("journal_entries").select("*").eq("id", view!).single(),
        supabase.from("journal_lines").select("*, account:chart_accounts(code,name)").eq("entry_id", view!).order("line_order"),
      ]);
      return { entry: e, lines: l ?? [] };
    },
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!activeCompany) return;
    if (!totals.balanced) { toast.error("El asiento no está balanceado"); return; }
    const valid = lines.filter(l => l.account_id && ((parseMasked(l.debit) || 0) + (parseMasked(l.credit) || 0)) > 0);
    if (valid.length < 2) { toast.error("Se requieren al menos 2 líneas"); return; }

    const { data: userData } = await supabase.auth.getUser();
    const { data: numData } = await supabase.rpc("next_entry_number", { _company_id: activeCompany.id });

    const { data: entry, error } = await supabase.from("journal_entries").insert({
      company_id: activeCompany.id,
      entry_number: numData as number,
      entry_date: header.entry_date,
      description: header.description,
      source: "manual",
      status: "contabilizado",
      created_by: userData.user!.id,
    }).select().single();
    if (error) { toast.error(error.message); return; }

    const linesPayload = valid.map((l, i) => ({
      entry_id: entry.id,
      account_id: l.account_id,
      debit: parseMasked(l.debit) || 0,
      credit: parseMasked(l.credit) || 0,
      description: l.description || null,
      cost_center_id: l.cost_center_id || null,
      line_order: i + 1,
    }));
    const { error: le } = await supabase.from("journal_lines").insert(linesPayload);
    if (le) { toast.error(le.message); return; }
    toast.success("Asiento contabilizado");
    setOpen(false);
    setHeader({ entry_date: new Date().toISOString().slice(0, 10), description: "" });
    setLines([{ account_id: "", debit: "", credit: "", description: "", cost_center_id: "" }, { account_id: "", debit: "", credit: "", description: "", cost_center_id: "" }]);
    qc.invalidateQueries();
  }

  async function reverse(id: string, num: number) {
    if (!confirm(`¿Reversar el asiento N° ${num}? Se creará un asiento inverso.`)) return;
    const { error } = await supabase.rpc("reverse_journal_entry", { _entry_id: id });
    if (error) { toast.error(error.message); return; }
    toast.success("Asiento reversado");
    qc.invalidateQueries();
  }

  if (!activeCompany) return <div className="p-8 text-center text-emerald-600 font-mono bg-black min-h-screen">Selecciona una empresa.</div>;

  return (
    <div className="min-h-screen bg-black text-emerald-400 p-2 sm:p-4 font-mono">
      <div className="max-w-7xl mx-auto space-y-4">
        <div className="flex flex-wrap items-end gap-3 justify-between [&_h1]:text-emerald-300 [&_h1]:drop-shadow-[0_0_8px_rgba(0,255,102,0.4)] [&_p]:text-emerald-400/80">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Asientos Contables</h1>
            <p className="text-sm">Registro de diario. Asientos manuales y automáticos.</p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <Label className="text-xs text-emerald-300">Desde</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="bg-black border-emerald-500/60 text-emerald-200 focus-visible:ring-emerald-400 font-mono [color-scheme:dark]" />
            </div>
            <div>
              <Label className="text-xs text-emerald-300">Hasta</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="bg-black border-emerald-500/60 text-emerald-200 focus-visible:ring-emerald-400 font-mono [color-scheme:dark]" />
            </div>
            {allowed && (
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2 bg-emerald-600 text-black font-bold hover:bg-emerald-500 shadow-[0_0_10px_rgba(0,255,102,0.2)] font-mono">
                    <Plus className="h-4 w-4" /> Nuevo asiento
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl bg-black border border-emerald-500/50 text-emerald-400 font-mono shadow-[0_0_25px_rgba(0,255,102,0.2)]">
                  <DialogHeader>
                    <DialogTitle className="text-emerald-300 text-lg border-b border-emerald-500/30 pb-2">Nuevo asiento manual</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={submit} className="space-y-3">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div>
                        <Label className="text-emerald-300">Fecha</Label>
                        <Input type="date" value={header.entry_date} onChange={(e) => setHeader({ ...header, entry_date: e.target.value })} required className="bg-black border-emerald-500/60 text-emerald-200 focus-visible:ring-emerald-400 font-mono [color-scheme:dark]" />
                      </div>
                      <div className="col-span-2">
                        <Label className="text-emerald-300">Descripción</Label>
                        <Input value={header.description} onChange={(e) => setHeader({ ...header, description: e.target.value })} required className="bg-black border-emerald-500/60 text-emerald-200 focus-visible:ring-emerald-400 font-mono" />
                      </div>
                    </div>
                    <div className="border border-emerald-500/40 rounded-md overflow-hidden bg-black/95">
                      <Table>
                        <TableHeader className="bg-emerald-950/30">
                          <TableRow className="border-emerald-500/30 hover:bg-transparent">
                            <TableHead className="text-emerald-300 font-bold">Cuenta</TableHead>
                            <TableHead className="w-40 text-emerald-300 font-bold">Centro de costo</TableHead>
                            <TableHead className="w-32 text-right text-emerald-300 font-bold">Débito</TableHead>
                            <TableHead className="w-32 text-right text-emerald-300 font-bold">Crédito</TableHead>
                            <TableHead className="text-emerald-300 font-bold">Concepto</TableHead>
                            <TableHead className="w-10"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {lines.map((ln, i) => (
                            <TableRow key={i} className="border-emerald-500/20 hover:bg-emerald-900/20 transition-colors">
                              <TableCell>
                                <Select value={ln.account_id} onValueChange={(v) => {
                                  const nl = [...lines]; nl[i] = { ...nl[i], account_id: v }; setLines(nl);
                                }}>
                                  <SelectTrigger className="bg-black border-emerald-500/60 text-emerald-200 font-mono"><SelectValue placeholder="Seleccionar cuenta" /></SelectTrigger>
                                  <SelectContent className="bg-black border-emerald-500 text-emerald-200 font-mono">
                                    {(accounts ?? []).map(a => <SelectItem key={a.id} value={a.id} className="hover:bg-emerald-900/50 focus:bg-emerald-900/50"><span className="font-mono text-xs mr-2 text-emerald-400">{a.code}</span>{a.name}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell>
                                <Select value={ln.cost_center_id || "__none"} onValueChange={(v) => {
                                  const nl = [...lines]; nl[i] = { ...nl[i], cost_center_id: v === "__none" ? "" : v }; setLines(nl);
                                }}>
                                  <SelectTrigger className="bg-black border-emerald-500/60 text-emerald-200 font-mono"><SelectValue placeholder="—" /></SelectTrigger>
                                  <SelectContent className="bg-black border-emerald-500 text-emerald-200 font-mono">
                                    <SelectItem value="__none" className="hover:bg-emerald-900/50 focus:bg-emerald-900/50">— sin centro —</SelectItem>
                                    {(costCenters ?? []).map(c => <SelectItem key={c.id} value={c.id} className="hover:bg-emerald-900/50 focus:bg-emerald-900/50"><span className="font-mono text-xs mr-2 text-emerald-400">{c.code}</span>{c.name}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell><MoneyInput value={ln.debit} onValueChange={(raw) => { const nl=[...lines]; nl[i]={...nl[i],debit:raw,credit:raw?"":nl[i].credit}; setLines(nl); }} className="bg-black border-emerald-500/60 text-emerald-200 font-mono" /></TableCell>
                              <TableCell><MoneyInput value={ln.credit} onValueChange={(raw) => { const nl=[...lines]; nl[i]={...nl[i],credit:raw,debit:raw?"":nl[i].debit}; setLines(nl); }} className="bg-black border-emerald-500/60 text-emerald-200 font-mono" /></TableCell>
                              <TableCell><Input value={ln.description} onChange={(e) => { const nl=[...lines]; nl[i]={...nl[i],description:e.target.value}; setLines(nl); }} className="bg-black border-emerald-500/60 text-emerald-200 font-mono" /></TableCell>
                              <TableCell><Button type="button" variant="ghost" size="icon" onClick={() => setLines(lines.filter((_, j) => j !== i))} className="text-emerald-400 hover:text-red-400 hover:bg-emerald-950"><Trash2 className="h-3.5 w-3.5" /></Button></TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => setLines([...lines, { account_id: "", debit: "", credit: "", description: "", cost_center_id: "" }])} className="border-emerald-500/40 bg-black text-emerald-300 hover:bg-emerald-950 hover:text-emerald-200 font-mono text-xs">
                        <Plus className="h-3.5 w-3.5 mr-1" /> Agregar línea
                      </Button>
                      <div className="text-sm space-x-4 text-emerald-300">
                        <span>Débitos: <strong className="tabular font-mono text-emerald-200">{formatBs(totals.debit)}</strong></span>
                        <span>Créditos: <strong className="tabular font-mono text-emerald-200">{formatBs(totals.credit)}</strong></span>
                        <Badge variant={totals.balanced ? "default" : "destructive"} className={`font-mono ${totals.balanced ? "bg-emerald-950 text-emerald-300 border border-emerald-500/50 shadow-[0_0_8px_rgba(0,255,102,0.3)]" : "bg-red-950 text-red-400 border border-red-500/50"}`}>{totals.balanced ? "Balanceado" : "Descuadrado"}</Badge>
                      </div>
                    </div>
                    <DialogFooter className="pt-2 border-t border-emerald-500/30">
                      <Button type="submit" disabled={!totals.balanced} className="w-full bg-emerald-500 text-black font-bold hover:bg-emerald-400 transition-all shadow-[0_0_15px_rgba(0,255,102,0.4)] font-mono">Contabilizar</Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-emerald-500/40 bg-black/95 shadow-[0_0_20px_rgba(0,255,102,0.15)] overflow-hidden">
          <Card className="bg-transparent border-0">
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-emerald-950/30">
                  <TableRow className="border-emerald-500/30 hover:bg-transparent">
                    <TableHead className="w-20 text-emerald-300 font-bold">N°</TableHead>
                    <TableHead className="text-emerald-300 font-bold">Fecha</TableHead>
                    <TableHead className="text-emerald-300 font-bold">Descripción</TableHead>
                    <TableHead className="text-emerald-300 font-bold">Origen</TableHead>
                    <TableHead className="text-emerald-300 font-bold">Estado</TableHead>
                    <TableHead className="w-28 text-right text-emerald-300 font-bold">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(entries ?? []).length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-emerald-600 font-mono">Sin asientos en el período.</TableCell></TableRow>}
                  {(entries ?? []).map((e: any) => (
                    <TableRow key={e.id} className="border-emerald-500/20 hover:bg-emerald-900/20 transition-colors">
                      <TableCell className="font-mono text-sm text-emerald-200">{e.entry_number}</TableCell>
                      <TableCell className="text-sm text-emerald-300/80">{formatDate(e.entry_date)}</TableCell>
                      <TableCell className="text-sm text-emerald-100">{e.description}</TableCell>
                      <TableCell><Badge variant="outline" className="border-emerald-500/40 text-emerald-300 bg-emerald-950/30 font-mono text-xs">{e.source}</Badge></TableCell>
                      <TableCell><Badge variant="outline" className={`font-mono text-xs ${e.status === "contabilizado" ? "bg-emerald-950 text-emerald-300 border-emerald-500/50 shadow-[0_0_6px_rgba(0,255,102,0.2)]" : "bg-black text-emerald-600 border-emerald-800"}`}>{e.status}</Badge></TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => setView(e.id)} title="Ver" className="text-emerald-400 hover:text-emerald-200 hover:bg-emerald-950"><Eye className="h-4 w-4" /></Button>
                        {allowed && e.status === "contabilizado" && (
                          <Button variant="ghost" size="icon" onClick={() => reverse(e.id, e.entry_number)} title="Reversar" className="text-emerald-400 hover:text-red-400 hover:bg-emerald-950"><Undo2 className="h-4 w-4" /></Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <Dialog open={!!view} onOpenChange={(v) => !v && setView(null)}>
          <DialogContent className="max-w-3xl bg-black border border-emerald-500/50 text-emerald-400 font-mono shadow-[0_0_25px_rgba(0,255,102,0.2)]">
            <DialogHeader>
              <DialogTitle className="text-emerald-300 text-lg border-b border-emerald-500/30 pb-2">Asiento N° {viewData?.entry?.entry_number}</DialogTitle>
            </DialogHeader>
            {viewData?.entry && (
              <div className="space-y-3">
                <div className="text-sm text-emerald-300"><strong>Fecha:</strong> {formatDate(viewData.entry.entry_date)} · <strong>Origen:</strong> {viewData.entry.source}</div>
                <div className="text-sm text-emerald-400/80">{viewData.entry.description}</div>
                <div className="border border-emerald-500/40 rounded-md overflow-hidden bg-black/95">
                  <Table>
                    <TableHeader className="bg-emerald-950/30">
                      <TableRow className="border-emerald-500/30 hover:bg-transparent">
                        <TableHead className="text-emerald-300 font-bold">Cuenta</TableHead>
                        <TableHead className="text-right text-emerald-300 font-bold">Débito</TableHead>
                        <TableHead className="text-right text-emerald-300 font-bold">Crédito</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {viewData.lines.map((l: any) => (
                        <TableRow key={l.id} className="border-emerald-500/20 hover:bg-emerald-900/20 transition-colors">
                          <TableCell className="text-emerald-200"><span className="font-mono text-xs mr-2 text-emerald-400">{l.account?.code}</span>{l.account?.name}</TableCell>
                          <TableCell className="text-right tabular font-mono text-emerald-300">{Number(l.debit) > 0 ? formatBs(l.debit) : ""}</TableCell>
                          <TableCell className="text-right tabular font-mono text-emerald-300">{Number(l.credit) > 0 ? formatBs(l.credit) : ""}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
