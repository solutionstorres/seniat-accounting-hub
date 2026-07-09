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
import { Plus, Trash2, Eye } from "lucide-react";
import { toast } from "sonner";
import { formatBs, formatDate, currentMonthRange } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/asientos")({
  component: AsientosPage,
});

type Line = { account_id: string; debit: string; credit: string; description: string };

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
    { account_id: "", debit: "", credit: "", description: "" },
    { account_id: "", debit: "", credit: "", description: "" },
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

  const totals = useMemo(() => {
    const d = lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
    const c = lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
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
    const valid = lines.filter(l => l.account_id && ((parseFloat(l.debit) || 0) + (parseFloat(l.credit) || 0)) > 0);
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
      debit: parseFloat(l.debit) || 0,
      credit: parseFloat(l.credit) || 0,
      description: l.description || null,
      line_order: i + 1,
    }));
    const { error: le } = await supabase.from("journal_lines").insert(linesPayload);
    if (le) { toast.error(le.message); return; }
    toast.success("Asiento contabilizado");
    setOpen(false);
    setHeader({ entry_date: new Date().toISOString().slice(0, 10), description: "" });
    setLines([{ account_id: "", debit: "", credit: "", description: "" }, { account_id: "", debit: "", credit: "", description: "" }]);
    qc.invalidateQueries();
  }

  if (!activeCompany) return <div className="p-8 text-center text-muted-foreground">Selecciona una empresa.</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4">
      <div className="flex flex-wrap items-end gap-3 justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Asientos Contables</h1>
          <p className="text-sm text-muted-foreground">Registro de diario. Asientos manuales y automáticos.</p>
        </div>
        <div className="flex items-end gap-2">
          <div><Label className="text-xs">Desde</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div><Label className="text-xs">Hasta</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          {allowed && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button className="gap-2"><Plus className="h-4 w-4" /> Nuevo asiento</Button></DialogTrigger>
              <DialogContent className="max-w-4xl">
                <DialogHeader><DialogTitle>Nuevo asiento manual</DialogTitle></DialogHeader>
                <form onSubmit={submit} className="space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <div><Label>Fecha</Label><Input type="date" value={header.entry_date} onChange={(e) => setHeader({ ...header, entry_date: e.target.value })} required /></div>
                    <div className="col-span-2"><Label>Descripción</Label><Input value={header.description} onChange={(e) => setHeader({ ...header, description: e.target.value })} required /></div>
                  </div>
                  <div className="border rounded-md overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Cuenta</TableHead>
                          <TableHead className="w-32 text-right">Débito</TableHead>
                          <TableHead className="w-32 text-right">Crédito</TableHead>
                          <TableHead>Concepto</TableHead>
                          <TableHead className="w-10"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {lines.map((ln, i) => (
                          <TableRow key={i}>
                            <TableCell>
                              <Select value={ln.account_id} onValueChange={(v) => {
                                const nl = [...lines]; nl[i] = { ...nl[i], account_id: v }; setLines(nl);
                              }}>
                                <SelectTrigger><SelectValue placeholder="Seleccionar cuenta" /></SelectTrigger>
                                <SelectContent>
                                  {(accounts ?? []).map(a => <SelectItem key={a.id} value={a.id}><span className="font-mono text-xs mr-2">{a.code}</span>{a.name}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell><Input type="number" step="0.01" value={ln.debit} onChange={(e) => { const nl=[...lines]; nl[i]={...nl[i],debit:e.target.value,credit:e.target.value?"":nl[i].credit}; setLines(nl); }} className="text-right" /></TableCell>
                            <TableCell><Input type="number" step="0.01" value={ln.credit} onChange={(e) => { const nl=[...lines]; nl[i]={...nl[i],credit:e.target.value,debit:e.target.value?"":nl[i].debit}; setLines(nl); }} className="text-right" /></TableCell>
                            <TableCell><Input value={ln.description} onChange={(e) => { const nl=[...lines]; nl[i]={...nl[i],description:e.target.value}; setLines(nl); }} /></TableCell>
                            <TableCell><Button type="button" variant="ghost" size="icon" onClick={() => setLines(lines.filter((_, j) => j !== i))}><Trash2 className="h-3.5 w-3.5" /></Button></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="flex items-center justify-between">
                    <Button type="button" variant="outline" size="sm" onClick={() => setLines([...lines, { account_id: "", debit: "", credit: "", description: "" }])}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> Agregar línea
                    </Button>
                    <div className="text-sm space-x-4">
                      <span>Débitos: <strong className="tabular">{formatBs(totals.debit)}</strong></span>
                      <span>Créditos: <strong className="tabular">{formatBs(totals.credit)}</strong></span>
                      <Badge variant={totals.balanced ? "default" : "destructive"}>{totals.balanced ? "Balanceado" : "Descuadrado"}</Badge>
                    </div>
                  </div>
                  <DialogFooter><Button type="submit" disabled={!totals.balanced}>Contabilizar</Button></DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">N°</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Origen</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(entries ?? []).length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Sin asientos en el período.</TableCell></TableRow>}
              {(entries ?? []).map((e: any) => (
                <TableRow key={e.id}>
                  <TableCell className="font-mono text-sm">{e.entry_number}</TableCell>
                  <TableCell className="text-sm">{formatDate(e.entry_date)}</TableCell>
                  <TableCell className="text-sm">{e.description}</TableCell>
                  <TableCell><Badge variant="outline">{e.source}</Badge></TableCell>
                  <TableCell><Badge variant={e.status === "contabilizado" ? "default" : "secondary"}>{e.status}</Badge></TableCell>
                  <TableCell><Button variant="ghost" size="icon" onClick={() => setView(e.id)}><Eye className="h-4 w-4" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!view} onOpenChange={(v) => !v && setView(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Asiento N° {viewData?.entry?.entry_number}</DialogTitle></DialogHeader>
          {viewData?.entry && (
            <div className="space-y-3">
              <div className="text-sm"><strong>Fecha:</strong> {formatDate(viewData.entry.entry_date)} · <strong>Origen:</strong> {viewData.entry.source}</div>
              <div className="text-sm text-muted-foreground">{viewData.entry.description}</div>
              <Table>
                <TableHeader><TableRow><TableHead>Cuenta</TableHead><TableHead className="text-right">Débito</TableHead><TableHead className="text-right">Crédito</TableHead></TableRow></TableHeader>
                <TableBody>
                  {viewData.lines.map((l: any) => (
                    <TableRow key={l.id}>
                      <TableCell><span className="font-mono text-xs mr-2">{l.account?.code}</span>{l.account?.name}</TableCell>
                      <TableCell className="text-right tabular">{Number(l.debit) > 0 ? formatBs(l.debit) : ""}</TableCell>
                      <TableCell className="text-right tabular">{Number(l.credit) > 0 ? formatBs(l.credit) : ""}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
