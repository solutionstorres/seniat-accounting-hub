import { createFileRoute } from "@tanstack/react-router";
import { InvoicesView } from "@/components/invoices-view";

export const Route = createFileRoute("/_authenticated/facturacion")({
  component: () => <InvoicesView kind="sales" title="Facturación electrónica" subtitle="Emisión de facturas con número de control SENIAT." />,
});
