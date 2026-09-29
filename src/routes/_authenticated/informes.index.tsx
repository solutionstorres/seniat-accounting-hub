/* eslint-disable */
import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, BookText, Scale, Landmark, TrendingUp, Receipt, Layers, Users, Wallet } from "lucide-react";

export const Route = createFileRoute("/_authenticated/informes/")({
  component: InformesIndex,
});

const items = [
  { to: "/informes/diario", label: "Libro Diario", desc: "Todos los asientos en orden cronológico", icon: BookOpen },
  { to: "/informes/mayor", label: "Libro Mayor", desc: "Movimientos y saldos por cuenta", icon: BookText },
  { to: "/informes/mayor-centro-costo", label: "Mayor por Centro de Costo", desc: "Movimientos y saldo por centro de costo", icon: Layers },
  { to: "/informes/comprobacion", label: "Balance de Comprobación", desc: "Verificación de sumas y saldos", icon: Scale },
  { to: "/informes/balance-general", label: "Balance General", desc: "Activo, Pasivo y Patrimonio", icon: Landmark },
  { to: "/informes/estado-resultados", label: "Estado de Resultados", desc: "Ingresos, costos, gastos y utilidad", icon: TrendingUp },
  { to: "/informes/auxiliar-cxc", label: "Auxiliar CxC", desc: "Saldo por cliente al corte", icon: Users },
  { to: "/informes/auxiliar-cxp", label: "Auxiliar CxP", desc: "Saldo por proveedor al corte", icon: Wallet },
  { to: "/informes/declaracion-iva", label: "Declaración IVA", desc: "Débito, crédito y retenciones del período", icon: Receipt },
] as const;

function InformesIndex() {
  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-4 font-mono min-h-screen bg-black text-emerald-400">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-emerald-300 drop-shadow-[0_0_8px_rgba(0,255,102,0.4)]">Informes contables</h1>
        <p className="text-sm text-emerald-400/80">Reportes conforme a la normativa institucional y financiera.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {items.map((it) => (
          <Link key={it.to} to={it.to}>
            <Card className="bg-black/95 border-emerald-500/40 hover:border-emerald-400 transition-colors cursor-pointer h-full shadow-[0_0_15px_rgba(0,255,102,0.1)] hover:shadow-[0_0_20px_rgba(0,255,102,0.2)] text-emerald-400">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base text-emerald-300">
                  <it.icon className="h-4 w-4 text-emerald-400" />
                  {it.label}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-emerald-400/80">{it.desc}</CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
