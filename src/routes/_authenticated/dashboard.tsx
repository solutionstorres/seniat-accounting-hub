/* eslint-disable */
// @ts-nocheck
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany, ROLE_LABEL } from "@/lib/company-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatBs, currentMonthRange } from "@/lib/format";
import { TrendingUp, TrendingDown, Receipt, FileText, Building2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Kpi({ title, value, icon: Icon, hint, tone = "brand" }: any) {
  return (
    <div className="rounded-lg border border-emerald-500/40 bg-black/95 shadow-[0_0_20px_rgba(0,255,102,0.15)] overflow-hidden">
      <Card className="bg-transparent border-0">
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 border-b border-emerald-500/30">
          <CardTitle className="text-sm font-medium text-emerald-300">{title}</CardTitle>
          <div className="h-8 w-8 rounded-md flex items-center justify-center bg-emerald-950/60 border border-emerald-500/50 shadow-[0_0_6px_rgba(0,255,102,0.2)]">
            <Icon className="h-4 w-4 text-emerald-400" />
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="text-2xl font-bold tabular font-mono text-emerald-200 drop-shadow-[0_0_8px_rgba(0,255,102,0.3)]">{value}</div>
          {hint && <p className="text-xs text-emerald-400/70 mt-1 font-mono">{hint}</p>}
        </CardContent>
      </Card>
    </div>
  );
}

function Dashboard() {
  const { activeCompany, companies } = useCompany();
  const { from, to } = currentMonthRange();

  const { data: sales } = useQuery({
    queryKey: ["sales-kpi", activeCompany?.id, from, to],
    enabled: !!activeCompany,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_invoices")
        .select("base_amount, iva_amount, total_amount")
        .eq("company_id", activeCompany!.id)
        .eq("status", "emitida")
        .gte("invoice_date", from)
        .lte("invoice_date", to);
      if (error) throw error;
      return data.reduce(
        (acc, r) => ({
          base: acc.base + Number(r.base_amount),
          iva: acc.iva + Number(r.iva_amount),
          total: acc.total + Number(r.total_amount),
          count: acc.count + 1,
        }),
        { base: 0, iva: 0, total: 0, count: 0 }
      );
    },
  });

  const { data: purchases } = useQuery({
    queryKey: ["purchases-kpi", activeCompany?.id, from, to],
    enabled: !!activeCompany,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_invoices")
        .select("base_amount, iva_amount, total_amount")
        .eq("company_id", activeCompany!.id)
        .eq("status", "emitida")
        .gte("invoice_date", from)
        .lte("invoice_date", to);
      if (error) throw error;
      return data.reduce(
        (acc, r) => ({ base: acc.base + Number(r.base_amount), iva: acc.iva + Number(r.iva_amount), total: acc.total + Number(r.total_amount), count: acc.count + 1 }),
        { base: 0, iva: 0, total: 0, count: 0 }
      );
    },
  });

  const { data: wh } = useQuery({
    queryKey: ["wh-kpi", activeCompany?.id, from, to],
    enabled: !!activeCompany,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("withholdings")
        .select("amount, type")
        .eq("company_id", activeCompany!.id)
        .gte("withholding_date", from)
        .lte("withholding_date", to);
      if (error) throw error;
      return data.reduce(
        (acc, r) => ({
          iva: acc.iva + (r.type === "iva" ? Number(r.amount) : 0),
          islr: acc.islr + (r.type === "islr" ? Number(r.amount) : 0),
        }),
        { iva: 0, islr: 0 }
      );
    },
  });

  if (companies.length === 0) {
    return (
      <div className="p-8 bg-black min-h-screen font-mono flex items-center justify-center">
        <div className="rounded-lg border border-emerald-500/40 bg-black/95 shadow-[0_0_20px_rgba(0,255,102,0.15)] max-w-md w-full overflow-hidden">
          <Card className="bg-transparent border-0">
            <CardHeader className="border-b border-emerald-500/35 pb-4">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-950 border border-emerald-500/50 text-emerald-400 shadow-[0_0_10px_rgba(0,255,102,0.3)]">
                <Building2 className="h-6 w-6" />
              </div>
              <CardTitle className="text-center mt-4 text-emerald-300 text-lg">Bienvenido a ContaVE</CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-4 pt-4">
              <p className="text-sm text-emerald-400/80">Para comenzar, crea la empresa con la que trabajarás. Podrás añadir más empresas y usuarios en cualquier momento.</p>
              <Link to="/empresas">
                <Button className="w-full bg-emerald-500 text-black font-bold hover:bg-emerald-400 shadow-[0_0_15px_rgba(0,255,102,0.4)] font-mono">Crear mi primera empresa</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-emerald-400 p-4 sm:p-6 font-mono">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="[&_h1]:text-emerald-300 [&_h1]:drop-shadow-[0_0_8px_rgba(0,255,102,0.4)] [&_p]:text-emerald-400/80">
          <h1 className="text-2xl font-bold tracking-tight">{activeCompany?.legal_name}</h1>
          <p className="text-sm">
            RIF {activeCompany?.rif} · Rol: {activeCompany ? ROLE_LABEL[activeCompany.role] : "—"} · Período actual: {from} al {to}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Kpi title="Ventas del mes" value={`Bs ${formatBs(sales?.total ?? 0)}`} icon={TrendingUp} hint={`${sales?.count ?? 0} facturas emitidas`} />
          <Kpi title="IVA débito fiscal" value={`Bs ${formatBs(sales?.iva ?? 0)}`} icon={FileText} hint="16% sobre base gravable" />
          <Kpi title="Compras del mes" value={`Bs ${formatBs(purchases?.total ?? 0)}`} icon={TrendingDown} hint={`${purchases?.count ?? 0} facturas registradas`} />
          <Kpi title="IVA crédito fiscal" value={`Bs ${formatBs(purchases?.iva ?? 0)}`} icon={Receipt} hint="Recuperable" />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-emerald-500/40 bg-black/95 shadow-[0_0_20px_rgba(0,255,102,0.15)] overflow-hidden">
            <Card className="bg-transparent border-0">
              <CardHeader className="border-b border-emerald-500/30">
                <CardTitle className="text-emerald-300 text-base">Retenciones del mes</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4 pt-4">
                <div>
                  <p className="text-sm text-emerald-400/70">IVA retenido</p>
                  <p className="text-2xl font-bold tabular font-mono text-emerald-200">Bs {formatBs(wh?.iva ?? 0)}</p>
                </div>
                <div>
                  <p className="text-sm text-emerald-400/70">ISLR retenido</p>
                  <p className="text-2xl font-bold tabular font-mono text-emerald-200">Bs {formatBs(wh?.islr ?? 0)}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="rounded-lg border border-emerald-500/40 bg-black/95 shadow-[0_0_20px_rgba(0,255,102,0.15)] overflow-hidden">
            <Card className="bg-transparent border-0">
              <CardHeader className="border-b border-emerald-500/30">
                <CardTitle className="text-emerald-300 text-base">Cálculo del IVA</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm pt-4">
                <div className="flex justify-between text-emerald-300">
                  <span>Débito fiscal (ventas)</span>
                  <span className="tabular font-medium font-mono text-emerald-200">Bs {formatBs(sales?.iva ?? 0)}</span>
                </div>
                <div className="flex justify-between text-emerald-300">
                  <span>Crédito fiscal (compras)</span>
                  <span className="tabular font-medium font-mono text-emerald-200">Bs {formatBs(purchases?.iva ?? 0)}</span>
                </div>
                <div className="flex justify-between border-t border-emerald-500/30 pt-2 text-emerald-200">
                  <span className="font-semibold text-emerald-300">IVA por pagar</span>
                  <span className="tabular font-bold font-mono" style={{ color: (sales?.iva ?? 0) - (purchases?.iva ?? 0) >= 0 ? "#f87171" : "#34d399" }}>
                    Bs {formatBs((sales?.iva ?? 0) - (purchases?.iva ?? 0))}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
