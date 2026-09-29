/* eslint-disable */
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { ShieldCheck, BookOpen, Receipt, Users, ArrowRight, FileText, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  component: Landing,
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
  },
});

function Feature({ icon: Icon, title, desc }: { icon: any; title: string; desc: string }) {
  return (
    <div className="rounded-xl border border-emerald-500/30 bg-black/95 p-5 sm:p-6 shadow-[0_0_15px_rgba(0,255,102,0.1)] text-emerald-400">
      <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-md bg-emerald-950 text-emerald-300 border border-emerald-500/40 shadow-[0_0_10px_rgba(0,255,102,0.2)]">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="font-semibold text-emerald-300 text-base sm:text-lg">{title}</h3>
      <p className="mt-1 text-xs sm:text-sm text-emerald-400/80 leading-relaxed">{desc}</p>
    </div>
  );
}

function Landing() {
  return (
    <div className="min-h-screen bg-black font-mono text-emerald-400 overflow-x-hidden">
      <header className="border-b border-emerald-500/30 bg-black text-emerald-400 sticky top-0 z-50 backdrop-blur-md bg-black/90">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center gap-2 font-semibold text-emerald-300 text-sm sm:text-base drop-shadow-[0_0_8px_rgba(0,255,102,0.4)]">
            <Building2 className="h-5 w-5 text-emerald-400 shrink-0" />
            ContaVE
          </div>
          <Link to="/auth">
            <Button variant="secondary" size="sm" className="bg-emerald-950 text-emerald-300 border border-emerald-500/50 hover:bg-emerald-900 shadow-[0_0_10px_rgba(0,255,102,0.2)] text-xs sm:text-sm">
              Iniciar sesión
            </Button>
          </Link>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-4 sm:px-6 py-12 sm:py-20 md:py-28">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-black/80 px-3 py-1 text-xs font-medium text-emerald-400 shadow-[0_0_10px_rgba(0,255,102,0.1)]">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400 shrink-0" /> Conforme a normativas 
            </span>
            <h1 className="mt-4 sm:mt-6 text-3xl sm:text-4xl md:text-6xl font-bold tracking-tight text-emerald-300 drop-shadow-[0_0_12px_rgba(0,255,102,0.3)] leading-tight">
              Contabilidad venezolana <br className="hidden sm:inline" />
              <span className="text-emerald-500">simple, segura, multi-empresa.</span>
            </h1>
            <p className="mt-4 sm:mt-6 text-sm sm:text-lg text-emerald-400/80 leading-relaxed">
              Emite facturas con número de control, lleva los libros de IVA
              al día, registra retenciones y controla el acceso de tu equipo por perfiles.
            </p>
            <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row gap-3">
              <Link to="/auth" className="w-full sm:w-auto">
                <Button size="lg" className="w-full sm:w-auto gap-2 bg-emerald-950 text-emerald-300 border border-emerald-500/50 hover:bg-emerald-900 shadow-[0_0_15px_rgba(0,255,102,0.25)] text-sm sm:text-base py-3 sm:py-2">
                  Comenzar gratis <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>

          <div className="mt-12 sm:mt-16 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Feature icon={BookOpen} title="Libros de IVA" desc="Ventas y compras con totales mensuales listos para el SENIAT." />
            <Feature icon={Receipt} title="Retenciones IVA/ISLR" desc="Comprobantes numerados y reportes por período." />
            <Feature icon={FileText} title="Facturación electrónica" desc="Números de control, cálculo automático de IVA y exentos." />
            <Feature icon={Users} title="Perfiles seguros" desc="Administrador, Contador, Auditor y Operador con permisos claros." />
          </div>
        </section>
      </main>

      <footer className="border-t border-emerald-500/30 py-6 sm:py-8 text-center text-xs text-emerald-400/70 bg-black px-4">
        © {new Date().getFullYear()} ContaVE · Diseñado para contribuyentes en Venezuela
      </footer>
    </div>
  );
}
