import { createFileRoute } from "@tanstack/react-router";
import { ContactsView } from "@/components/contacts-view";

export const Route = createFileRoute("/_authenticated/proveedores")({
  component: () => <ContactsView table="suppliers" title="Proveedores" />,
});
