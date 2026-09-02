import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpenCheck, Download, Eye, MonitorPlay } from "lucide-react";
import manual from "@/assets/Manual_ContaVE.pdf.asset.json";
import tutorial from "@/assets/Tutorial_ContaVE.mp4.asset.json";

export const Route = createFileRoute("/_authenticated/ayuda")({
  component: AyudaPage,
});

const temas = [
  "Panel, empresas y ejercicio fiscal",
  "Facturación, compras, notas de crédito y débito",
  "Retenciones de IVA e ISLR",
  "Cuentas por Cobrar y por Pagar (multimoneda, IGTF)",
  "Libros de ventas y compras",
  "Plan de cuentas, centros de costo y asientos",
  "Informes contables y cierres",
];

function AyudaPage() {
  const sizeMb = (manual.size / (1024 * 1024)).toFixed(1);
  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Ayuda</h1>
        <p className="text-sm text-muted-foreground">
          Documentación del sistema ContaVE conforme a la normativa del SENIAT.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpenCheck className="h-4 w-4 text-primary" />
            Manual del sistema (PDF)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Manual ilustrado con capturas reales de cada módulo. PDF · {sizeMb} MB
          </p>
          <ul className="grid gap-1 text-sm text-muted-foreground sm:grid-cols-2 list-disc pl-5">
            {temas.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-3">
            <Button asChild className="gap-2">
              <a href={manual.url} download="Manual_ContaVE.pdf">
                <Download className="h-4 w-4" /> Descargar manual
              </a>
            </Button>
            <Button asChild variant="outline" className="gap-2">
              <a href={manual.url} target="_blank" rel="noopener noreferrer">
                <Eye className="h-4 w-4" /> Ver en línea
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
