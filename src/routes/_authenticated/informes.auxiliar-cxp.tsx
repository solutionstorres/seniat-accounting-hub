/* eslint-disable */
import { createFileRoute } from "@tanstack/react-router";
import { ReportShell } from "@/components/reports/report-shell";
import { Body } from "./informes.auxiliar-cxc";

export const Route = createFileRoute("/_authenticated/informes/auxiliar-cxp")({
  component: () => (
    <div className="min-h-screen bg-black text-emerald-400 font-mono p-4">
      <ReportShell 
        title="Auxiliar de Cuentas por Pagar" 
        subtitle="Saldo por proveedor al corte." 
        singleDate
      >
        {({ to }) => (
          <div className="bg-black text-emerald-400 border border-emerald-900/50 p-4 rounded-lg shadow-lg">
            <Body kind="cxp" toDate={to} />
          </div>
        )}
      </ReportShell>
    </div>
  ),
});
