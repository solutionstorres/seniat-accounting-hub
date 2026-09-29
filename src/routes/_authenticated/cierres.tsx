/* eslint-disable */
// @ts-nocheck
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

  if (!activeCompany) return <div className="p-8 text-center text-emerald-600 font-mono bg-black min-h-screen">Selecciona una empresa.</div>;

  return (
    <div className="min-h-screen bg-black text-emerald-400 p-2 sm:p-4 font-mono">
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between [&_h1]:text-emerald-300 [&_h1]:drop-shadow-[0_0_8px_rgba(0,255,102,0.4)] [&_p]:text-emerald-400/80">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Cierres contables</h1>
            <p className="text-sm">Cierre mensual y de ejercicio.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setYear(year - 1)} className="border-emerald-500/50 bg-black text-emerald-300 hover:bg-emerald-950 hover:text-emerald-200">◀</Button>
            <span className="font-mono font-semibold text-lg w-16 text-center text-emerald-200">{year}</span>
            <Button size="sm" variant="outline" onClick={() => setYear(year + 1)} className="border-emerald-500/50 bg-black text-emerald-300 hover:bg-emerald-950 hover:text-emerald-200">▶</Button>
          </div>
        </div>

        <div className="rounded-lg border border-emerald-500/40 bg-black/95 shadow-[0_0_20px_rgba(0,255,102,0.15)] overflow-hidden">
          <Card className="bg-transparent border-0">
            <CardHeader className="border-b border-emerald-500/30">
              <CardTitle className="text-emerald-300 text-base">Períodos mensuales</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-emerald-950/30">
                  <TableRow className="border-emerald-500/30 hover:bg-transparent">
                    <TableHead className="text-emerald-300 font-bold">Mes</TableHead>
                    <TableHead className="text-emerald-300 font-bold">Estado</TableHead>
                    <TableHead className="text-emerald-300 font-bold">Cerrado</TableHead>
                    <TableHead className="text-right text-emerald-300 font-bold">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
                    const p = statusFor(m);
                    const closed = p?.status === "cerrado";
                    return (
                      <TableRow key={m} className="border-emerald-500/20 hover:bg-emerald-900/20 transition-colors">
                        <TableCell className="font-medium text-emerald-200">{MESES[m - 1]}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`gap-1 font-mono text-xs ${closed ? "bg-red-950 text-red-400 border-red-500/50" : "bg-emerald-950 text-emerald-300 border-emerald-500/50 shadow-[0_0_6px_rgba(0,255,102,0.2)]"}`}>
                            {closed ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                            {closed ? "Cerrado" : "Abierto"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-emerald-400/70">{p?.closed_at ? new Date(p.closed_at).toLocaleString("es-VE") : "—"}</TableCell>
                        <TableCell className="text-right space-x-2">
                          {!closed && write && (
                            <Button size="sm" variant="outline" onClick={() => closeMonth(m)} className="gap-1 border-emerald-500/40 bg-black text-emerald-300 hover:bg-emerald-950 hover:text-emerald-200 font-mono text-xs">
                              <Lock className="h-3 w-3" />Cerrar
                            </Button>
                          )}
                          {closed && admin && (
                            <Button size="sm" variant="ghost" onClick={() => reopenMonth(m)} className="gap-1 text-emerald-400 hover:text-emerald-200 hover:bg-emerald-950 font-mono text-xs">
                              <Unlock className="h-3 w-3" />Reabrir
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <div className="rounded-lg border border-emerald-500/40 bg-black/95 shadow-[0_0_20px_rgba(0,255,102,0.15)] overflow-hidden">
          <Card className="bg-transparent border-0">
            <CardHeader className="border-b border-emerald-500/30">
              <CardTitle className="text-emerald-300 text-base">Ejercicio {year}</CardTitle>
            </CardHeader>
            <CardContent className="p-4 flex flex-wrap gap-3">
              {write && (
                <>
                  <Button variant="outline" className="gap-2 border-emerald-500/50 bg-black text-emerald-300 hover:bg-emerald-950 hover:text-emerald-200 font-mono text-xs" onClick={openYear}>
                    <CalendarPlus className="h-4 w-4 text-emerald-400" /> Generar asiento de apertura
                  </Button>
                  <Button variant="outline" className="gap-2 border-red-500/50 bg-black text-red-400 hover:bg-red-950/40 hover:text-red-300 font-mono text-xs" onClick={closeYear}>
                    <CalendarCheck className="h-4 w-4" /> Generar asiento de cierre de ejercicio
                  </Button>
                </>
              )}
              <p className="text-xs text-emerald-400/70 w-full pt-2">
                La apertura crea un asiento al 1º de enero con los saldos de balance del año anterior. El cierre satura ingresos, costos y gastos al 31 de diciembre contra Resultados Acumulados (3.2.01).
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
