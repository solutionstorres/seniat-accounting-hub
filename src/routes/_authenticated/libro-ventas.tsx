/* eslint-disable */
import { createFileRoute } from "@tanstack/react-router";
import { BookView } from "@/components/book-view";

export const Route = createFileRoute("/_authenticated/libro-ventas")({
  component: () => (
    <div className="min-h-screen bg-black text-emerald-400 font-mono p-4 sm:p-6">
      <div className="max-w-7xl mx-auto rounded-lg border border-emerald-900/60 bg-black shadow-[0_0_20px_rgba(0,255,102,0.12)] p-4 sm:p-6">
        <BookView kind="sales" />
      </div>
    </div>
  ),
});
