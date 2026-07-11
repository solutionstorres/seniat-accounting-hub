import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany, canInvoice, canWrite } from "@/lib/company-context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { formatBs, formatDate } from "@/lib/format";
import { MoneyInput, parseMasked } from "@/components/money-input";

type Kind = "sales" | "purchases";
interface Props {
  kind: Kind;
  title: string;
  subtitle: string;
}

const CFG = {
  sales: { table: "sales_invoices" as const, party: "customer" as const, partyTable: "customers" as const, partyLabel: "Cliente" },
  purchases: { table: "purchase_invoices" as const, party: "supplier" as const, partyTable: "suppliers" as const, partyLabel: "Proveedor" },
};

export function InvoicesView({ kind, title, subtitle }: Props) {
  const { activeCompany } = useCompany();
  const qc = useQueryClient();
  const cfg = CFG[kind];
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    party_id: "",
    invoice_number: "",
    control_number: "",
    invoice_date: new Date().toISOString().slice(0, 10),
    base_amount: "",
    exempt_amount: "0",
    iva_rate: "16",
  });

  const allowed = kind === "sales" ? canInvoice(activeCompany?.role) : canWrite(activeCompany?.role);

  const { data: parties } = useQuery({
    queryKey: [cfg.partyTable, activeCompany?.id],
    enabled: !!activeCompany,
    queryFn: async () => {
      const { data, error } = await supabase.from(cfg.partyTable).select("id,name,rif").eq("company_id", activeCompany!.id).order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: rows, isLoading } = useQuery({
    queryKey: [cfg.table, activeCompany?.id],
    enabled: !!activeCompany,
    queryFn: async () => {
      const partyRel = kind === "sales" ? "customer:customers(name,rif)" : "supplier:suppliers(name,rif)";
      const { data, error } = await supabase
        .from(cfg.table)
        .select(`*, ${partyRel}`)
        .eq("company_id", activeCompany!.id)
        .order("invoice_date", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as any[];
    },
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!activeCompany) return;
    const base = parseMasked(form.base_amount);
    const exempt = parseMasked(form.exempt_amount);
    const rate = parseFloat(form.iva_rate || "16");
    if (base < 0 || exempt < 0) { toast.error("Montos inválidos"); return; }
    if (!form.party_id) { toast.error(`Selecciona un ${cfg.partyLabel.toLowerCase()}`); return; }
    const iva = +(base * rate / 100).toFixed(2);
    const total = +(base + iva + exempt).toFixed(2);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const payload: any = {
      company_id: activeCompany.id,
      [cfg.party + "_id"]: form.party_id,
      invoice_number: form.invoice_number.trim(),
      control_number: form.control_number.trim(),
      invoice_date: form.invoice_date,
      base_amount: base,
      exempt_amount: exempt,
      iva_rate: rate,
      iva_amount: iva,
      total_amount: total,
      created_by: userData.user.id,
    };
    const { error } = await supabase.from(cfg.table).insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success("Factura registrada");
    setOpen(false);
    setForm({ party_id: "", invoice_number: "", control_number: "", invoice_date: new Date().toISOString().slice(0, 10), base_amount: "", exempt_amount: "0", iva_rate: "16" });
    qc.invalidateQueries();
  }

  if (!activeCompany) return <div className="p-8 text-center text-muted-foreground">Selecciona una empresa.</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        {allowed && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button className="gap-2"><Plus className="h-4 w-4" /> Nueva factura</Button></DialogTrigger>
            <DialogContent className="max-w-xl">
              <DialogHeader><DialogTitle>Registrar factura</DialogTitle></DialogHeader>
              <form onSubmit={submit} className="space-y-3">
                <div><Label>{cfg.partyLabel}</Label>
                  <Select value={form.party_id} onValueChange={(v) => setForm({ ...form, party_id: v })}>
                    <SelectTrigger><SelectValue placeholder={`Selecciona ${cfg.partyLabel.toLowerCase()}`} /></SelectTrigger>
                    <SelectContent>{(parties ?? []).map(p => <SelectItem key={p.id} value={p.id}>{p.name} ({p.rif})</SelectItem>)}</SelectContent>
                  </Select>
                  {(parties ?? []).length === 0 && <p className="text-xs text-muted-foreground mt-1">No hay {cfg.partyLabel.toLowerCase()}s. Crea uno primero.</p>}
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div><Label>N° Factura</Label><Input value={form.invoice_number} onChange={(e) => setForm({ ...form, invoice_number: e.target.value })} required /></div>
                  <div><Label>N° Control</Label><Input value={form.control_number} onChange={(e) => setForm({ ...form, control_number: e.target.value })} required /></div>
                  <div><Label>Fecha</Label><Input type="date" value={form.invoice_date} onChange={(e) => setForm({ ...form, invoice_date: e.target.value })} required /></div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div><Label>Base gravable (Bs)</Label><MoneyInput value={form.base_amount} onValueChange={(raw) => setForm({ ...form, base_amount: raw })} required /></div>
                  <div><Label>Exento (Bs)</Label><MoneyInput value={form.exempt_amount} onValueChange={(raw) => setForm({ ...form, exempt_amount: raw })} /></div>
                  <div><Label>IVA %</Label><Input type="number" step="0.01" value={form.iva_rate} onChange={(e) => setForm({ ...form, iva_rate: e.target.value })} /></div>
                </div>
                <div className="rounded-md bg-muted p-3 text-sm">
                  <div className="flex justify-between"><span>IVA calculado:</span><span className="tabular font-medium">Bs {formatBs((parseMasked(form.base_amount) * parseFloat(form.iva_rate || "0")) / 100)}</span></div>
                  <div className="flex justify-between mt-1 font-semibold"><span>Total:</span><span className="tabular">Bs {formatBs(parseMasked(form.base_amount) + parseMasked(form.exempt_amount) + (parseMasked(form.base_amount) * parseFloat(form.iva_rate || "0")) / 100)}</span></div>
                </div>
                <DialogFooter><Button type="submit">Registrar</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>N° Factura</TableHead>
                <TableHead>N° Control</TableHead>
                <TableHead>{cfg.partyLabel}</TableHead>
                <TableHead className="text-right">Base</TableHead>
                <TableHead className="text-right">Exento</TableHead>
                <TableHead className="text-right">IVA</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Cargando...</TableCell></TableRow>}
              {!isLoading && (rows ?? []).length === 0 && <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Sin facturas.</TableCell></TableRow>}
              {(rows ?? []).map((r) => {
                const p = r[cfg.party];
                return (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm">{formatDate(r.invoice_date)}</TableCell>
                    <TableCell className="font-mono text-sm">{r.invoice_number}</TableCell>
                    <TableCell className="font-mono text-sm">{r.control_number}</TableCell>
                    <TableCell><div className="text-sm font-medium">{p?.name}</div><div className="text-xs text-muted-foreground">{p?.rif}</div></TableCell>
                    <TableCell className="text-right tabular">{formatBs(r.base_amount)}</TableCell>
                    <TableCell className="text-right tabular">{formatBs(r.exempt_amount)}</TableCell>
                    <TableCell className="text-right tabular">{formatBs(r.iva_amount)}</TableCell>
                    <TableCell className="text-right tabular font-semibold">{formatBs(r.total_amount)}</TableCell>
                    <TableCell><Badge variant={r.status === "emitida" ? "default" : "destructive"}>{r.status}</Badge></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
