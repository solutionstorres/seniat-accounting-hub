/* eslint-disable */
// @ts-nocheck
import { createFileRoute } from "@tanstack/react-router";
import { InvoicesView } from "@/components/invoices-view";

export const Route = createFileRoute("/_authenticated/compras")({
  component: () => (
    <div className="min-h-screen bg-black text-emerald-400 font-mono p-4 sm:p-6">
      <div className="max-w-7xl mx-auto rounded-lg border border-emerald-500/40 bg-black/95 shadow-[0_0_20px_rgba(0,255,102,0.15)] p-4 sm:p-6">
        <InvoicesView 
          kind="purchases" 
          title="Compras" 
          subtitle="Registro de facturas recibidas para el libro de compras." 
        />
      </div>
    </div>
  ),
});
