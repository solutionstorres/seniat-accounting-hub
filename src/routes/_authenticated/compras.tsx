import { createFileRoute } from "@tanstack/react-router";
import { InvoicesView } from "@/components/invoices-view";

export const Route = createFileRoute("/_authenticated/compras")({
  component: () => <InvoicesView kind="purchases" title="Compras" subtitle="Registro de facturas recibidas para el libro de compras." />,
});
