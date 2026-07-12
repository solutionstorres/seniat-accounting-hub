import { createFileRoute } from "@tanstack/react-router";
import { ReportShell } from "@/components/reports/report-shell";
import { Body } from "./informes.auxiliar-cxc";

export const Route = createFileRoute("/_authenticated/informes/auxiliar-cxp")({
  component: () => (
    <ReportShell title="Auxiliar de Cuentas por Pagar" subtitle="Saldo por proveedor al corte." singleDate>
      {({ to }) => <Body kind="cxp" toDate={to} />}
    </ReportShell>
  ),
});
