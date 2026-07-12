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
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Informes contables</h1>
        <p className="text-sm text-muted-foreground">Reportes conforme a la normativa del SENIAT.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {items.map((it) => (
          <Link key={it.to} to={it.to}>
            <Card className="hover:border-primary transition-colors cursor-pointer h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <it.icon className="h-4 w-4 text-primary" />
                  {it.label}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">{it.desc}</CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
