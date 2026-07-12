import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany, isAdmin, canWrite } from "@/lib/company-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Lock, Unlock, CalendarCheck, CalendarPlus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/cierres")({
  component: CierresPage,
});

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

function CierresPage() {
  const { activeCompany } = useCompany();
  const qc = useQueryClient();
  const [year, setYear] = useState(new Date().getFullYear());
  const write = canWrite(activeCompany?.role);
  const admin = isAdmin(activeCompany?.role);

  const { data: periods } = useQuery({
    queryKey: ["periods", activeCompany?.id, year],
    enabled: !!activeCompany,
    queryFn: async () => {
      const { data, error } = await supabase.from("accounting_periods")
        .select("*").eq("company_id", activeCompany!.id).eq("year", year);
      if (error) throw error;
      return data;
    },
  });

  const statusFor = (month: number) => periods?.find((p) => p.month === month);

  async function closeMonth(month: number) {
    if (!activeCompany) return;
    if (!confirm(`¿Cerrar ${MESES[month - 1]} ${year}? No podrás modificar asientos de ese período.`)) return;
    const { error } = await supabase.rpc("close_period", { _company_id: activeCompany.id, _year: year, _month: month });
    if (error) { toast.error(error.message); return; }
    toast.success("Período cerrado");
    qc.invalidateQueries();
  }
  async function reopenMonth(month: number) {
    if (!activeCompany) return;
    if (!confirm(`¿Reabrir ${MESES[month - 1]} ${year}?`)) return;
    const { error } = await supabase.rpc("reopen_period", { _company_id: activeCompany.id, _year: year, _month: month });
    if (error) { toast.error(error.message); return; }
    toast.success("Período reabierto");
    qc.invalidateQueries();
  }
  async function closeYear() {
    if (!activeCompany) return;
    if (!confirm(`¿Generar asiento de CIERRE del ejercicio ${year}?`)) return;
    const { data, error } = await supabase.rpc("close_fiscal_year", { _company_id: activeCompany.id, _year: year });
    if (error) { toast.error(error.message); return; }
    toast.success(`Asiento de cierre generado (${data})`);
    qc.invalidateQueries();
  }
  async function openYear() {
    if (!activeCompany) return;
    if (!confirm(`¿Generar asiento de APERTURA del ejercicio ${year} con saldos de balance del año anterior?`)) return;
    const { data, error } = await supabase.rpc("open_fiscal_year", { _company_id: activeCompany.id, _year: year });
    if (error) { toast.error(error.message); return; }
    toast.success(`Asiento de apertura generado (${data})`);
    qc.invalidateQueries();
  }

  if (!activeCompany) return <div className="p-8 text-center text-muted-foreground">Selecciona una empresa.</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cierres contables</h1>
          <p className="text-sm text-muted-foreground">Cierre mensual y de ejercicio.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setYear(year - 1)}>◀</Button>
          <span className="font-mono font-semibold text-lg w-16 text-center">{year}</span>
          <Button size="sm" variant="outline" onClick={() => setYear(year + 1)}>▶</Button>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Períodos mensuales</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mes</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Cerrado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
                const p = statusFor(m);
                const closed = p?.status === "cerrado";
                return (
                  <TableRow key={m}>
                    <TableCell className="font-medium">{MESES[m - 1]}</TableCell>
                    <TableCell>
                      <Badge variant={closed ? "destructive" : "default"} className="gap-1">
                        {closed ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                        {closed ? "Cerrado" : "Abierto"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{p?.closed_at ? new Date(p.closed_at).toLocaleString("es-VE") : "—"}</TableCell>
                    <TableCell className="text-right space-x-2">
                      {!closed && write && <Button size="sm" variant="outline" onClick={() => closeMonth(m)} className="gap-1"><Lock className="h-3 w-3" />Cerrar</Button>}
                      {closed && admin && <Button size="sm" variant="ghost" onClick={() => reopenMonth(m)} className="gap-1"><Unlock className="h-3 w-3" />Reabrir</Button>}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Ejercicio {year}</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {write && (
            <>
              <Button variant="outline" className="gap-2" onClick={openYear}><CalendarPlus className="h-4 w-4" /> Generar asiento de apertura</Button>
              <Button variant="destructive" className="gap-2" onClick={closeYear}><CalendarCheck className="h-4 w-4" /> Generar asiento de cierre de ejercicio</Button>
            </>
          )}
          <p className="text-xs text-muted-foreground w-full">
            La apertura crea un asiento al 1º de enero con los saldos de balance del año anterior. El cierre satura ingresos, costos y gastos al 31 de diciembre contra Resultados Acumulados (3.2.01).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
