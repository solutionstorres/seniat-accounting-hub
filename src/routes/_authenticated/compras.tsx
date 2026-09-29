/* eslint-disable */
// @ts-nocheck
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany, canWrite } from "@/lib/company-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatBs, formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/compras")({
  component: PurchasesPage,
});

function PurchasesPage() {
  const { activeCompany } = useCompany();
  const qc = useQueryClient();
  const allowed = canWrite(activeCompany?.role);
  const [open, setOpen] = useState(false);

  // Paginación de 10 en 10
  const [page, setPage] = useState(0);
  const pageSize = 10;
  const from = page * pageSize;
  const to = from + pageSize - 1;

  const [form, setForm] = useState({
    invoice_number: "",
    control_number: "",
    supplier_id: "",
    invoice_date: new Date().toISOString().slice(0, 10),
    base_amount: "",
    iva_amount: "",
    total_amount: "",
  });

  const { data: suppliers } = useQuery({
    queryKey: ["suppliers-list", activeCompany?.id],
    enabled: !!activeCompany,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("id, name")
        .eq("company_id", activeCompany!.id)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: queryResult, isLoading } = useQuery({
    queryKey: ["purchases-paginated", activeCompany?.id, page],
    enabled: !!activeCompany,
    queryFn: async () => {
      const { data, count, error } = await supabase
        .from("purchase_invoices")
        .select("*, supplier:suppliers(name, rif)", { count: "exact" })
        .eq("company_id", activeCompany!.id)
        .order("invoice_date", { ascending: false })
        .range(from, to);

      if (error) throw error;
      return { data: data || [], count: count || 0 };
    },
  });

  const invoices = queryResult?.data || [];
  const totalCount = queryResult?.count || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!activeCompany) return;
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const base = parseFloat(form.base_amount || "0");
    const iva = parseFloat(form.iva_amount || "0");
    const total = parseFloat(form.total_amount || (base + iva).toString());

    const { error } = await supabase.from("purchase_invoices").insert({
      company_id: activeCompany.id,
      invoice_number: form.invoice_number.trim(),
      control_number: form.control_number.trim() || null,
      supplier_id: form.supplier_id,
      invoice_date: form.invoice_date,
      base_amount: base,
      iva_amount: iva,
      total_amount: total,
      status: "emitida",
      created_by: userData.user.id,
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Factura de compra registrada con éxito");
    setOpen(false);
    setForm({
      invoice_number: "",
      control_number: "",
      supplier_id: "",
      invoice_date: new Date().toISOString().slice(0, 10),
      base_amount: "",
      iva_amount: "",
      total_amount: "",
    });
    setPage(0); // Regresar a la primera página tras registrar
    qc.invalidateQueries({ queryKey: ["purchases-paginated"] });
  }

  async function remove(id: string) {
    if (!confirm("¿Seguro que deseas eliminar esta factura de compra?")) return;
    const { error } = await supabase.from("purchase_invoices").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Factura eliminada");
    qc.invalidateQueries({ queryKey: ["purchases-paginated"] });
  }

  if (!activeCompany) {
    return <div className="p-8 text-center text-emerald-600 font-mono bg-black min-h-screen">Selecciona una empresa.</div>;
  }

  return (
    <div className="min-h-screen bg-black text-emerald-400 font-mono p-4 sm:p-6">
      <div className="max-w-7xl mx-auto rounded-lg border border-emerald-500/40 bg-black/95 shadow-[0_0_20px_rgba(0,255,102,0.15)] p-4 sm:p-6 space-y-6">
        
        {/* Cabecera */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-emerald-500/30 pb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-emerald-300 drop-shadow-[0_0_8px_rgba(0,255,102,0.4)]">
              Compras
            </h1>
            <p className="text-sm text-emerald-400/80 mt-1">
              Registro de facturas recibidas para el libro de compras.
            </p>
          </div>
          {allowed && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2 bg-emerald-600 text-black font-bold hover:bg-emerald-500 shadow-[0_0_10px_rgba(0,255,102,0.2)] font-mono">
                  <Plus className="h-4 w-4" /> Registrar factura
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-xl bg-black border border-emerald-500/50 text-emerald-400 font-mono shadow-[0_0_25px_rgba(0,255,102,0.2)]">
                <DialogHeader>
                  <DialogTitle className="text-emerald-300 text-lg border-b border-emerald-500/30 pb-2">
                    Nueva Factura de Compra
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={submit} className="space-y-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <Label className="text-emerald-300">N° Factura</Label>
                      <Input
                        value={form.invoice_number}
                        onChange={(e) => setForm({ ...form, invoice_number: e.target.value })}
                        required
                        className="bg-black border-emerald-500/60 text-emerald-200 font-mono"
                      />
                    </div>
                    <div>
                      <Label className="text-emerald-300">N° Control</Label>
                      <Input
                        value={form.control_number}
                        onChange={(e) => setForm({ ...form, control_number: e.target.value })}
                        className="bg-black border-emerald-500/60 text-emerald-200 font-mono"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <Label className="text-emerald-300">Proveedor</Label>
                      <Select value={form.supplier_id} onValueChange={(v) => setForm({ ...form, supplier_id: v })}>
                        <SelectTrigger className="bg-black border-emerald-500/60 text-emerald-200 font-mono">
                          <SelectValue placeholder="Seleccione proveedor" />
                        </SelectTrigger>
                        <SelectContent className="bg-black border-emerald-500 text-emerald-200 font-mono">
                          {(suppliers ?? []).map((s) => (
                            <SelectItem key={s.id} value={s.id} className="hover:bg-emerald-900/50 focus:bg-emerald-900/50">
                              {s.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-emerald-300">Fecha</Label>
                      <Input
                        type="date"
                        value={form.invoice_date}
                        onChange={(e) => setForm({ ...form, invoice_date: e.target.value })}
                        required
                        className="bg-black border-emerald-500/60 text-emerald-200 font-mono [color-scheme:dark]"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                      <Label className="text-emerald-300">Base Imponible</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={form.base_amount}
                        onChange={(e) => {
                          const base = e.target.value;
                          const iva = (parseFloat(base || "0") * 0.16).toFixed(2);
                          const total = (parseFloat(base || "0") + parseFloat(iva)).toFixed(2);
                          setForm({ ...form, base_amount: base, iva_amount: iva, total_amount: total });
                        }}
                        required
                        className="bg-black border-emerald-500/60 text-emerald-200 font-mono"
                      />
                    </div>
                    <div>
                      <Label className="text-emerald-300">IVA (16% automático)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={form.iva_amount}
                        onChange={(e) => setForm({ ...form, iva_amount: e.target.value })}
                        required
                        className="bg-black border-emerald-500/60 text-emerald-200 font-mono"
                      />
                    </div>
                    <div>
                      <Label className="text-emerald-300">Total Total</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={form.total_amount}
                        onChange={(e) => setForm({ ...form, total_amount: e.target.value })}
                        required
                        className="bg-black border-emerald-500/60 text-emerald-200 font-mono"
                      />
                    </div>
                  </div>
                  <DialogFooter className="pt-2 border-t border-emerald-500/30">
                    <Button
                      type="submit"
                      className="w-full bg-emerald-500 text-black font-bold hover:bg-emerald-400 transition-all shadow-[0_0_15px_rgba(0,255,102,0.4)] font-mono"
                    >
                      Guardar Factura
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Tabla */}
        <div className="overflow-x-auto border border-emerald-500/30 rounded-md">
          <table className="w-full text-left text-sm text-emerald-300">
            <thead className="bg-emerald-950/60 border-b border-emerald-500/30 text-emerald-200">
              <tr>
                <th className="p-3">Fecha</th>
                <th className="p-3">Nro. Factura</th>
                <th className="p-3">Control</th>
                <th className="p-3">Proveedor</th>
                <th className="p-3 text-right">Base Imponible</th>
                <th className="p-3 text-right">IVA (16%)</th>
                <th className="p-3 text-right">Total</th>
                <th className="p-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-emerald-500/70 font-mono">Cargando registros...</td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-emerald-500/70 font-mono">No hay facturas de compra registradas.</td>
                </tr>
              ) : (
                invoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-emerald-500/15 hover:bg-emerald-900/20 transition-colors">
                    <td className="p-3 text-emerald-300/80">{formatDate(inv.invoice_date)}</td>
                    <td className="p-3 font-medium text-emerald-200">{inv.invoice_number}</td>
                    <td className="p-3 text-emerald-400/70">{inv.control_number || "—"}</td>
                    <td className="p-3 text-emerald-100">{inv.supplier?.name || "—"}</td>
                    <td className="p-3 text-right tabular font-mono text-emerald-300">Bs {formatBs(inv.base_amount)}</td>
                    <td className="p-3 text-right tabular font-mono text-emerald-300">Bs {formatBs(inv.iva_amount)}</td>
                    <td className="p-3 text-right tabular font-bold font-mono text-emerald-200">Bs {formatBs(inv.total_amount)}</td>
                    <td className="p-3 text-center">
                      {allowed && (
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Eliminar factura"
                          onClick={() => remove(inv.id)}
                          className="text-red-400 hover:text-red-300 hover:bg-red-950/40 h-8 w-8"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Controles de Paginación */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
          <p className="text-xs text-emerald-400/70 font-mono">
            Mostrando {invoices.length > 0 ? from + 1 : 0} a {Math.min(from + pageSize, totalCount)} de {totalCount} registros
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(p - 1, 0))}
              disabled={page === 0}
              className="border-emerald-500/50 bg-black text-emerald-300 hover:bg-emerald-950 hover:text-emerald-200 font-mono text-xs disabled:opacity-30"
            >
              Anterior
            </Button>
            <span className="flex items-center px-3 py-1 text-xs text-emerald-200 font-mono border border-emerald-500/30 rounded-md bg-emerald-950/40">
              Página {page + 1} de {totalPages || 1}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => (p + 1 < totalPages ? p + 1 : p))}
              disabled={page + 1 >= totalPages || totalPages === 0}
              className="border-emerald-500/50 bg-black text-emerald-300 hover:bg-emerald-950 hover:text-emerald-200 font-mono text-xs disabled:opacity-30"
            >
              Siguiente
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
}
