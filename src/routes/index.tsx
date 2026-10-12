/* eslint-disable */
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { ShieldCheck, BookOpen, Receipt, Users, ArrowRight, FileText, Building2, ExternalLink, Camera, Sparkles, CheckCircle2 } from "lucide-react";
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

const appsExternas = [
  { label: "Nómina", url: "https://nomina-solutorres.lovable.app" },
  { label: "Facturación", url: "https://fact-adm-solutorres.lovable.app" },
  { label: "Colegio", url: "https://solutorres-colegio.lovable.app" },
  { label: "IGP - IGTF", url: "https://IGTF-solutorres.lovable.app" },
  { label: "Retenciones de IVA", url: "https://ret-iva-solutorres.lovable.app" },
  { label: "Mi Aula", url: "https://MI-AULA-VE.lovable.app" },
];

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

      {/* Barra de Módulos Externos Integrada */}
      <div className="border-b border-emerald-500/20 bg-emerald-950/20 py-2.5">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 sm:px-6">
          <span className="text-[11px] font-semibold text-emerald-500 tracking-widest mr-1 uppercase">// Módulos:</span>
          {appsExternas.map((app) => (
            <a
              key={app.label}
              href={app.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-black px-3 py-1 text-xs font-medium text-emerald-300 transition hover:border-emerald-400 hover:bg-emerald-950/60 shadow-[0_0_8px_rgba(0,255,102,0.1)]"
            >
              {app.label}
              <ExternalLink className="h-3 w-3 text-emerald-400" />
            </a>
          ))}
        </div>
      </div>

      <main>
        <section className="mx-auto max-w-6xl px-4 sm:px-6 py-12 sm:py-20 md:py-24">
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

          {/* BANNER ULTRA DESTACADO: MÓDULO OCR E IA PARA ESCANEO DE FACTURAS */}
          <div className="mt-10 sm:mt-14 rounded-2xl border-2 border-emerald-400/80 bg-gradient-to-b from-emerald-950/60 via-black to-black p-6 sm:p-8 shadow-[0_0_35px_rgba(0,255,102,0.25)] relative overflow-hidden">
            <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
            
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-emerald-500/40 pb-5">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-400/60 bg-emerald-950/80 px-2.5 py-1 text-[11px] font-bold text-emerald-300 tracking-wider uppercase shadow-[0_0_10px_rgba(0,255,102,0.3)] mb-2">
                  <Sparkles className="h-3.5 w-3.5 text-emerald-400 animate-pulse" /> ¡NUEVA FUNCIONALIDAD IA!
                </span>
                <h2 className="text-2xl sm:text-3xl font-bold text-emerald-200 drop-shadow-[0_0_10px_rgba(0,255,102,0.4)] flex items-center gap-2">
                  <Camera className="h-7 w-7 text-emerald-400 shrink-0" />
                  Escaneo e Inteligencia Artificial para Facturas (OCR)
                </h2>
              </div>
              <span className="text-xs text-emerald-400/90 font-mono bg-black/80 px-3 py-1.5 rounded-lg border border-emerald-500/30 w-fit">
                Módulos: <strong className="text-emerald-300">Compras y Facturación</strong>
              </span>
            </div>

            <p className="mt-4 text-sm sm:text-base text-emerald-300/90 leading-relaxed max-w-4xl">
              Integración total con visión e Inteligencia Artificial para la lectura automática de facturas en imágenes o fotos. Extrae RIF, correlativos, base imponible, exentos, IVA y totales al instante.
            </p>

            {/* SECCIÓN PRUEBAS RECOMENDADAS */}
            <div className="mt-6 rounded-xl border border-emerald-500/50 bg-black/90 p-4 sm:p-5 shadow-[0_0_15px_rgba(0,255,102,0.15)]">
              <h3 className="text-sm sm:text-base font-bold text-emerald-300 uppercase tracking-wide flex items-center gap-2 border-b border-emerald-500/30 pb-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                Pruebas Recomendadas al Probar con una Foto Real:
              </h3>
              
              <p className="mt-2 text-xs sm:text-sm text-emerald-400/90 font-semibold">
                Cuando realices la prueba con una factura física en <span className="text-emerald-200 underline">Compras</span>:
              </p>

              <ol className="mt-3 space-y-2.5 text-xs sm:text-sm text-emerald-300/90 pl-1">
                <li className="flex items-start gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/60 font-bold text-[11px]">1</span>
                  <span><strong>Sube la foto o tómala directamente</strong> desde el móvil usando el recuadro <em>"Subir factura / Tomar foto"</em>.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/60 font-bold text-[11px]">2</span>
                  <span>Verifica que el <strong>RIF del emisor lea correctamente</strong> y te sugiera crearlo en la tabla <code className="text-emerald-200 bg-emerald-950/80 px-1 py-0.5 rounded border border-emerald-500/40">suppliers</code> si es nuevo.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/60 font-bold text-[11px]">3</span>
                  <span>Comprueba que el <strong>IVA, Exento y Base imponible</strong> sumen exactamente el Total (para validar la regla automática de verificación).</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/60 font-bold text-[11px]">4</span>
                  <span>Haz clic en <strong>Registrar</strong> y confirma que aparezca de inmediato en el <strong>Libro de Compras</strong> y en la contabilidad general con su asiento en partida doble.</span>
                </li>
              </ol>
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
