/* eslint-disable */
import { createFileRoute } from "@tanstack/react-router";
import { BookView } from "@/components/book-view";

export const Route = createFileRoute("/_authenticated/libro-compras")({
  component: () => (
    <div className="min-h-screen bg-black text-emerald-400 font-mono">
      <BookView kind="purchases" />
    </div>
  ),
});
