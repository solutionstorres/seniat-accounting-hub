/* eslint-disable */
// @ts-nocheck
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company-context";
import { Button } from "@/components/ui/button";
import { formatBs, formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/compras")({
  component: PurchasesPage,
});

function PurchasesPage() {
  const { activeCompany } = useCompany();
  const [page, setPage] = useState(0);
  const pageSize = 10;

  const from = page * pageSize;
  const to = from + pageSize - 1;

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

  if (!activeCompany) {
    return <div className="p-8 text-center text-emerald-600 font-mono bg-black min-h-screen">Selecciona una empresa.</div>;
  }

  return (
    <div className="min-h-screen bg-black text-emerald-400 font-mono p-4 sm:p-6">
      <div className="max-w-7xl mx-auto rounded-lg border border-emerald-500/40 bg-black/95 shadow-[0_0_20px_rgba(0,255,102,0.15)] p-4 sm:p-6 space-y-6">
        
        {/* Cabecera */}
        <div className="border-b border-emerald-500/30 pb-4">
          <h1 className="text-2xl font-bold tracking-tight text-emerald-300 drop-shadow-[0_0_8px_rgba(0,255,102,0.4)]">
            Compras
          </h1>
          <p className="text-sm text-emerald-400/80 mt-1">
            Registro de facturas recibidas para el libro de compras.
          </p>
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
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-emerald-500/70 font-mono">Cargando registros...</td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-emerald-500/70 font-mono">No hay facturas de compra registradas.</td>
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
