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
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className={`h-8 w-8 rounded-md flex items-center justify-center bg-${tone}/10`} style={{ backgroundColor: "color-mix(in oklch, var(--brand) 12%, transparent)" }}>
          <Icon className="h-4 w-4" style={{ color: "var(--brand)" }} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold tabular">{value}</div>
        {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
      </CardContent>
    </Card>
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
      <div className="p-8">
        <Card>
          <CardHeader>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Building2 className="h-6 w-6" />
            </div>
            <CardTitle className="text-center mt-4">Bienvenido a ContaVE</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">Para comenzar, crea la empresa con la que trabajarás. Podrás añadir más empresas y usuarios en cualquier momento.</p>
            <Link to="/empresas"><Button>Crear mi primera empresa</Button></Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{activeCompany?.legal_name}</h1>
        <p className="text-sm text-muted-foreground">
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
        <Card>
          <CardHeader><CardTitle>Retenciones del mes</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">IVA retenido</p>
              <p className="text-2xl font-bold tabular">Bs {formatBs(wh?.iva ?? 0)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">ISLR retenido</p>
              <p className="text-2xl font-bold tabular">Bs {formatBs(wh?.islr ?? 0)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Cálculo del IVA</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span>Débito fiscal (ventas)</span><span className="tabular font-medium">Bs {formatBs(sales?.iva ?? 0)}</span></div>
            <div className="flex justify-between"><span>Crédito fiscal (compras)</span><span className="tabular font-medium">Bs {formatBs(purchases?.iva ?? 0)}</span></div>
            <div className="flex justify-between border-t pt-2">
              <span className="font-semibold">IVA por pagar</span>
              <span className="tabular font-bold" style={{ color: (sales?.iva ?? 0) - (purchases?.iva ?? 0) >= 0 ? "var(--destructive)" : "var(--success)" }}>
                Bs {formatBs((sales?.iva ?? 0) - (purchases?.iva ?? 0))}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
