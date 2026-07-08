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
    <div className="rounded-xl border bg-card p-6">
      <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="font-semibold text-foreground">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
    </div>
  );
}

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2 font-semibold">
            <Building2 className="h-5 w-5" style={{ color: "var(--warning)" }} />
            ContaVE
          </div>
          <Link to="/auth">
            <Button variant="secondary" size="sm">Iniciar sesión</Button>
          </Link>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-6 py-20 md:py-28">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" /> Conforme a normativas SENIAT
            </span>
            <h1 className="mt-6 text-4xl font-bold tracking-tight text-foreground md:text-6xl">
              Contabilidad venezolana <br />
              <span style={{ color: "var(--brand)" }}>simple, segura, multi-empresa.</span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground">
              Emite facturas con número de control SENIAT, lleva los libros de IVA
              al día, registra retenciones y controla el acceso de tu equipo por perfiles.
            </p>
            <div className="mt-8 flex gap-3">
              <Link to="/auth">
                <Button size="lg" className="gap-2">
                  Comenzar gratis <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>

          <div className="mt-16 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Feature icon={BookOpen} title="Libros de IVA" desc="Ventas y compras con totales mensuales listos para el SENIAT." />
            <Feature icon={Receipt} title="Retenciones IVA/ISLR" desc="Comprobantes numerados y reportes por período." />
            <Feature icon={FileText} title="Facturación electrónica" desc="Números de control, cálculo automático de IVA y exentos." />
            <Feature icon={Users} title="Perfiles seguros" desc="Administrador, Contador, Auditor y Operador con permisos claros." />
          </div>
        </section>
      </main>

      <footer className="border-t py-8 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} ContaVE · Diseñado para contribuyentes en Venezuela
      </footer>
    </div>
  );
}
