import { createFileRoute } from "@tanstack/react-router";
import { BookView } from "@/components/book-view";

export const Route = createFileRoute("/_authenticated/libro-compras")({
  component: () => <BookView kind="purchases" />,
});
