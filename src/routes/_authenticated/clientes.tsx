/* eslint-disable */
import { createFileRoute } from "@tanstack/react-router";
import { ContactsView } from "@/components/contacts-view";

export const Route = createFileRoute("/_authenticated/clientes")({
  component: () => (
    <div className="min-h-screen bg-black text-emerald-400 font-mono">
      <ContactsView table="customers" title="Clientes" canOperator />
    </div>
  ),
});
