import { createFileRoute } from "@tanstack/react-router";
import { ContactsView } from "@/components/contacts-view";

export const Route = createFileRoute("/_authenticated/clientes")({
  component: () => <ContactsView table="customers" title="Clientes" canOperator />,
});
