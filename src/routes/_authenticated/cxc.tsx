/* eslint-disable */
// @ts-nocheck
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, CalendarCheck, Plus, TrendingUp, Loader2, Printer } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company-context";
import { formatBs } from "@/lib/format";
import { useBCVRates } from "@/hooks/use-bcv-rates";
import { amountInBs, equivalentUSD, appliedBalance } from "@/lib/payment-currency";

export const Route = createFileRoute("/_authenticated/cxc")({
  component: CxCPage,
  head: () => ({
    meta: [
      { title: "Cuentas por Cobrar | ContaVE" },
      { name: "description", content: "Cobranzas de clientes multimoneda con IGTF, retenciones IVA/ISLR y asientos automáticos." },
      { property: "og:title", content: "Cuentas por Cobrar | ContaVE" },
      { property: "og:description", content: "Cobros multimoneda, IGTF y comprobantes de retención según el SENIAT." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Moneda = "USD" | "VES" | "EUR";

interface AbonoLinea {
  id: string;
  metodo: "efectivo" | "punto" | "pago_movil" | "divisa" | "mixto";
  moneda: Moneda;
  montoMoneda: number;
  tasa: number;
  montoBs: number;
  cuentaId: string;
  referencia: string;
  igtf: number;
}

const METODOS: { value: AbonoLinea["metodo"]; label: string }[] = [
  { value: "efectivo", label: "Efectivo" },
  { value: "punto", label: "Punto de venta" },
  { value: "pago_movil", label: "Pago móvil / Transferencia" },
  { value: "divisa", label: "Divisa (efectivo/Zelle)" },
  { value: "mixto", label: "Otro" },
];

function CxCPage() {
  const { activeCompany } = useCompany();
  const companyId = activeCompany?.id ?? "";
  const qc = useQueryClient();


  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { tasaUSD, tasaEUR, setTasaUSD, setTasaEUR, status: rateStatus, refresh: refreshRates, isFetching: fetchingRates } = useBCVRates(!!companyId, !!selectedId);
  const [abonos, setAbonos] = useState<AbonoLinea[]>([]);
  const [saving, setSaving] = useState(false);
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));

  const [tempMetodo, setTempMetodo] = useState<AbonoLinea["metodo"]>("efectivo");
  const [tempMoneda, setTempMoneda] = useState<Moneda>("VES");
  const [tempMonto, setTempMonto] = useState("");
  const [tempTasa, setTempTasa] = useState("1");
  const [tempCuenta, setTempCuenta] = useState("");
  const [tempRef, setTempRef] = useState("");
  const [tempIgtf, setTempIgtf] = useState(true);

  const [aplicaIva, setAplicaIva] = useState(false);
  const [pctIva, setPctIva] = useState("75");
  const [aplicaIslr, setAplicaIslr] = useState(false);
  const [pctIslr, setPctIslr] = useState("3");

  const igtfRate = Number((activeCompany as any)?.igtf_rate ?? 3);
  const esAgenteIva = Boolean((activeCompany as any)?.is_iva_withholding_agent);
  const esAgenteIslr = Boolean((activeCompany as any)?.is_islr_withholding_agent);

  const { data: cuentas = [] } = useQuery({
    queryKey: ["cxc-cuentas", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chart_accounts")
        .select("id, code, name")
        .eq("company_id", companyId)
        .eq("is_postable", true)
        .eq("active", true)
        .order("code");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: config } = useQuery({
    queryKey: ["cxc-config", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_accounting_configs")
        .select("*")
        .eq("company_id", companyId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: facturas = [], isLoading } = useQuery({
    queryKey: ["cxc-facturas", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data: invs, error } = await supabase
        .from("sales_invoices")
        .select("id, invoice_number, invoice_date, total_amount, base_amount, iva_amount, customer:customers(id, name, rif)")
        .eq("company_id", companyId)
        .eq("status", "emitida")
        .order("invoice_date", { ascending: false });
      if (error) throw error;

      const { data: cobros, error: ce } = await supabase
        .from("sales_collections" as any)
        .select("invoice_id, amount_collected, iva_retained_amount, islr_retained_amount")
        .eq("company_id", companyId);
      if (ce) throw ce;

      const cobrado = new Map<string, number>();
      (cobros ?? []).forEach((p: any) => {
        const prev = cobrado.get(p.invoice_id) ?? 0;
        cobrado.set(
          p.invoice_id,
          prev + Number(p.amount_collected ?? 0) + Number(p.iva_retained_amount ?? 0) + Number(p.islr_retained_amount ?? 0),
        );
      });

      return (invs ?? []).map((i: any) => {
        const abonado = cobrado.get(i.id) ?? 0;
        const pendiente = Math.max(0, Number(i.total_amount ?? 0) - abonado);
        return {
          ...i,
          abonado,
          pendiente,
          estado: pendiente <= 0.009 ? "Cobrado" : abonado > 0 ? "Parcial" : "Pendiente",
        };
      });
    },
  });

  const selected = facturas.find((f: any) => f.id === selectedId) ?? null;

  const cuentaPorDefecto = useMemo(() => {
    if (!config) return "";
    if (tempMoneda === "USD" || tempMetodo === "divisa") {
      return (config as any).default_usd_cash_account_id || (config as any).default_cash_account_id || "";
    }
    if (tempMetodo === "efectivo") return (config as any).default_cash_account_id || "";
    return (config as any).default_bank_account_id || (config as any).default_cash_account_id || "";
  }, [config, tempMoneda, tempMetodo]);

  function openInvoice(inv: any) {
    setSelectedId(inv.id);
    setAbonos([]);
    setTempMetodo("efectivo");
    setTempMoneda("VES");
    setTempMonto("");
    setTempTasa("1");
    setTempRef("");
    setTempIgtf(false);
    setTempCuenta("");
    setAplicaIva(esAgenteIva);
    setAplicaIslr(false);
    setPctIva(String((activeCompany as any)?.default_iva_withholding_rate ?? 75));
    setPctIslr(String((activeCompany as any)?.default_islr_withholding_rate ?? 3));
  }

  function toBs(monto: number, moneda: Moneda, tasa: number): number {
    if (!Number.isFinite(monto) || monto <= 0 || (moneda !== "VES" && (!tasa || tasa <= 0))) return 0;
    return amountInBs(monto, moneda, tasa);
  }

  const esDivisa = (moneda: Moneda) => moneda === "USD" || moneda === "EUR";

  const totalAbonos = abonos.reduce((s, a) => s + a.montoBs, 0);
  const totalIgtf = abonos.reduce((s, a) => s + a.igtf, 0);

  const ivaRetenido = selected && aplicaIva ? Number(((Number(selected.iva_amount ?? 0) * (parseFloat(pctIva) || 0)) / 100).toFixed(2)) : 0;
  const islrRetenido = selected && aplicaIslr ? Number(((Number(selected.base_amount ?? 0) * (parseFloat(pctIslr) || 0)) / 100).toFixed(2)) : 0;
  const { applied: totalAplicado, remaining: restante } = appliedBalance(Number(selected?.pendiente ?? 0), totalAbonos, ivaRetenido, islrRetenido);

  function handleMonedaChange(m: Moneda) {
    setTempMoneda(m);
    setTempMonto("");
    setTempTasa(m === "VES" ? "1" : m === "EUR" ? String(tasaEUR) : String(tasaUSD));
    setTempIgtf(esDivisa(m));
  }

  function addAbono() {
    if (!selected) return;
    const monto = parseFloat(tempMonto.replace(",", "."));
    const tasa = parseFloat(tempTasa.replace(",", "."));
    const cuenta = tempCuenta || cuentaPorDefecto;
    if (!monto || monto <= 0) return toast.error("Ingresa un monto válido.");
    if (tempMoneda !== "VES" && (!tasa || tasa <= 0)) return toast.error("Ingresa una tasa de cambio válida.");
    if (!cuenta) return toast.error("Selecciona la cuenta contable de ingreso.");

    const bs = toBs(monto, tempMoneda, tempMoneda === "VES" ? 1 : tasa);
    if (totalAbonos + bs > Number(selected.pendiente) - ivaRetenido - islrRetenido + 0.01) {
      return toast.error("La suma de los abonos supera el saldo pendiente.");
    }
    const igtf = tempIgtf && esDivisa(tempMoneda) ? Number(((bs * igtfRate) / 100).toFixed(2)) : 0;

    setAbonos([
      ...abonos,
      {
        id: crypto.randomUUID(),
        metodo: tempMetodo,
        moneda: tempMoneda,
        montoMoneda: monto,
        tasa: tempMoneda === "VES" ? 1 : tasa,
        montoBs: bs,
        cuentaId: cuenta,
        referencia: tempRef,
        igtf,
      },
    ]);
    setTempMonto("");
    setTempRef("");
  }

  async function guardar() {
    if (!selected || !companyId) return;
    if (totalAplicado <= 0) return toast.error("Añade al menos un abono o retención.");
    if (totalAplicado > Number(selected.pendiente) + 0.01) return toast.error("El aplicado supera el saldo pendiente en Bs.");
    if (tasaUSD <= 0) return toast.error("Ingresa la tasa USD verificada para guardar la equivalencia.");
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const metodo = abonos.length > 1 ? "mixto" : (abonos[0]?.metodo ?? "efectivo");

      const { data: col, error } = await supabase
        .from("sales_collections" as any)
        .insert({
          company_id: companyId,
          invoice_id: selected.id,
          collection_date: fecha,
          collection_method: metodo as any,
          amount_collected: Number(totalAbonos.toFixed(2)),
          amount_in_usd: Number((totalAbonos / tasaUSD).toFixed(2)),
          amount_in_bs: Number(totalAbonos.toFixed(2)),
          accounting_currency: "VES",
          exchange_rate: tasaUSD,
          apply_igtf: totalIgtf > 0,
          igtf_amount: Number(totalIgtf.toFixed(2)),
          reference_number: abonos[0]?.referencia ?? null,
          created_by: userData.user?.id ?? null,
          currency: abonos[0]?.moneda ?? "VES",
          collection_account_id: abonos[0]?.cuentaId ?? null,
          iva_retention_percentage: aplicaIva ? parseFloat(pctIva) || 0 : 0,
          iva_retained_amount: ivaRetenido,
          islr_retention_percentage: aplicaIslr ? parseFloat(pctIslr) || 0 : 0,
          islr_retained_amount: islrRetenido,
        } as any)
        .select("id")
        .single();
      if (error) throw error;
      if (!col) throw new Error("No se pudo guardar el cobro.");

      if (abonos.length) {
        const { error: le } = await supabase.from("sales_collection_lines" as any).insert(
          abonos.map((a, i) => ({
            company_id: companyId,
            collection_id: col.id,
            method: a.metodo,
            currency: a.moneda,
            amount_currency: a.montoMoneda,
            exchange_rate: a.tasa,
            amount_usd: Number((a.montoBs / tasaUSD).toFixed(2)),
            account_id: a.cuentaId,
            apply_igtf: a.igtf > 0,
            igtf_amount: a.igtf,
            reference_number: a.referencia || null,
            line_order: i + 1,
          })),
        );
        if (le) throw le;
      }

      const { error: re } = await supabase.rpc("post_sales_collection" as any, { _collection_id: col.id });
      if (re) throw re;

      toast.success("Cobro registrado, asientos y comprobantes generados.");
      setSelectedId(null);
      qc.invalidateQueries({ queryKey: ["cxc-facturas", companyId] });
    } catch (e: any) {
      toast.error(e.message ?? "No se pudo registrar el cobro.");
    } finally {
      setSaving(false);
    }
  }

  const cuentaLabel = (id: string) => {
    const c = cuentas.find((x: any) => x.id === id);
    return c ? `${c.code} ${c.name}` : "—";
  };

  return (
    <div className="min-h-screen bg-black text-emerald-400 font-mono p-4 sm:p-6 space-y-6">
      
      {/* Cabecera y Tasas */}
      <div className="flex justify-between items-start flex-wrap gap-4 border-b border-emerald-500/30 pb-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-emerald-300 drop-shadow-[0_0_8px_rgba(0,255,102,0.4)]">
            Cuentas por Cobrar (CxC)
          </h1>
          <p className="text-sm text-emerald-400/80 mt-1">
            Cobros totales o parciales, multimoneda, con IGTF, retenciones de IVA/ISLR y asientos automáticos.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 bg-emerald-950/40 border border-emerald-500/40 p-3 rounded-lg text-xs shadow-[0_0_10px_rgba(0,255,102,0.1)]">
          <div className="flex flex-col gap-1">
            <span className="font-semibold text-emerald-400/70">Tasa USD (BCV)</span>
            <input
              type="number"
              step="0.01"
              aria-label="Tasa USD (BCV)"
              disabled={!!selectedId}
              value={tasaUSD}
              onChange={(e) => setTasaUSD(parseFloat(e.target.value) || 0)}
              className="w-20 border border-emerald-500/60 rounded px-1.5 py-0.5 text-right font-mono bg-black text-emerald-200 focus:outline-none focus:border-emerald-400"
            />
          </div>
          <div className="h-8 w-[1px] bg-emerald-500/30" />
          <div className="flex flex-col gap-1">
            <span className="font-semibold text-emerald-400/70">Tasa EUR (BCV)</span>
            <input
              type="number"
              step="0.01"
              aria-label="Tasa EUR (BCV)"
              disabled={!!selectedId}
              value={tasaEUR}
              onChange={(e) => setTasaEUR(parseFloat(e.target.value) || 0)}
              className="w-20 border border-emerald-500/60 rounded px-1.5 py-0.5 text-right font-mono bg-black text-emerald-200 focus:outline-none focus:border-emerald-400"
            />
          </div>
          <div className="h-8 w-[1px] bg-emerald-500/30" />
          <div className="flex flex-col gap-1">
            <span className="font-semibold text-emerald-400/70">Agente de retención</span>
            <span className="font-mono text-emerald-300">
              IVA {esAgenteIva ? "Sí" : "No"} · ISLR {esAgenteIslr ? "Sí" : "No"}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span role="status">{rateStatus}</span>
        <Button variant="ghost" size="icon" aria-label="Actualizar tasas BCV" title="Actualizar tasas BCV" onClick={refreshRates} disabled={fetchingRates || !!selectedId}><TrendingUp className="h-4 w-4" /></Button>
      </div>

      {/* Tabla Principal */}
      <div className="border border-emerald-500/40 rounded-xl bg-black/95 overflow-hidden shadow-[0_0_20px_rgba(0,255,102,0.15)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-emerald-500/30 bg-emerald-950/60 text-xs font-medium text-emerald-200 uppercase tracking-wider">
                <th className="py-3 px-4">Fecha</th>
                <th className="py-3 px-4">Documento</th>
                <th className="py-3 px-4">Cliente</th>
                <th className="py-3 px-4">RIF</th>
                <th className="py-3 px-4 text-right">Total (Bs)</th>
                <th className="py-3 px-4 text-right">Cobrado (Bs)</th>
                <th className="py-3 px-4 text-right">Pendiente (Bs)</th>
                <th className="py-3 px-4 text-right">Equiv. $</th>
                <th className="py-3 px-4 text-center">Estado</th>
                <th className="py-3 px-4 text-center">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-emerald-500/15 text-sm text-emerald-300">
              {isLoading && (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-emerald-500/70">
                    <Loader2 className="h-4 w-4 animate-spin inline mr-2 text-emerald-400" /> Cargando facturas…
                  </td>
                </tr>
              )}
              {!isLoading && facturas.filter((f: any) => f.pendiente > 0.009).length === 0 && (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-emerald-500/70">
                    No hay facturas de venta pendientes de cobro.
                  </td>
                </tr>
              )}
              {facturas
                .filter((f: any) => f.pendiente > 0.009)
                .map((row: any) => (
                  <tr key={row.id} className="hover:bg-emerald-900/20 transition-colors">
                    <td className="py-3.5 px-4 font-mono text-xs text-emerald-300/80">{row.invoice_date}</td>
                    <td className="py-3.5 px-4 font-mono text-xs text-emerald-200">{row.invoice_number}</td>
                    <td className="py-3.5 px-4 font-medium text-emerald-100">{row.customer?.name}</td>
                    <td className="py-3.5 px-4 font-mono text-xs text-emerald-400/70">{row.customer?.rif}</td>
                    <td className="py-3.5 px-4 text-right font-mono text-emerald-300">{formatBs(row.total_amount)}</td>
                    <td className="py-3.5 px-4 text-right font-mono text-emerald-500/70">{formatBs(row.abonado)}</td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-200">{formatBs(row.pendiente)}</td>
                    <td className="py-3.5 px-4 text-right font-mono text-xs text-emerald-500/70">
                      {equivalentUSD(row.pendiente, tasaUSD) === null ? "—" : `$ ${formatBs(equivalentUSD(row.pendiente, tasaUSD))}`}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-950 text-emerald-300 border border-emerald-500/40">
                        {row.estado}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openInvoice(row)}
                        className="border-emerald-500/50 bg-black text-emerald-300 hover:bg-emerald-950 hover:text-emerald-200 text-xs font-mono"
                      >
                        Cobrar
                      </Button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Cobro */}
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelectedId(null)}>
        <DialogContent className="sm:max-w-[680px] max-h-[90vh] overflow-y-auto bg-black border border-emerald-500/50 text-emerald-400 font-mono shadow-[0_0_25px_rgba(0,255,102,0.2)]">
          <DialogHeader className="border-b border-emerald-500/30 pb-3">
            <DialogTitle className="text-emerald-300 text-lg">Registrar cobro de cliente</DialogTitle>
            <DialogDescription className="text-emerald-400/70 text-xs">
              Abonos multimoneda con cuenta contable de ingreso, IGTF automático en divisas y retenciones según normativa SENIAT.
            </DialogDescription>
          </DialogHeader>

          {selected && (
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-3 gap-3 text-xs bg-emerald-950/40 border border-emerald-500/30 rounded-lg p-3">
                <div>
                  <span className="block text-emerald-400/70">Factura</span>
                  <span className="font-mono font-semibold text-emerald-200">{selected.invoice_number}</span>
                </div>
                <div>
                  <span className="block text-emerald-400/70">Cliente</span>
                  <span className="font-semibold text-emerald-100">{selected.customer?.name}</span>
                </div>
                <div className="text-right">
                  <span className="block text-emerald-400/70">Saldo pendiente (Bs)</span>
                  <span className="font-mono font-bold text-emerald-200">Bs {formatBs(selected.pendiente)}</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <label className="text-[10px] font-medium text-emerald-400/80">Fecha del cobro</label>
                <Input
                  type="date"
                  className="h-8 w-40 text-xs bg-black border-emerald-500/60 text-emerald-200 font-mono [color-scheme:dark]"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                />
              </div>

              <div className="border border-emerald-500/30 rounded-lg p-3 space-y-2 bg-emerald-950/20">
                <span className="text-xs font-semibold text-emerald-300 block border-b border-emerald-500/20 pb-1">Abonos</span>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-medium text-emerald-400/70">Método</label>
                    <select
                      className="h-8 border border-emerald-500/60 rounded px-1.5 text-xs bg-black text-emerald-200 font-mono focus:outline-none focus:border-emerald-400"
                      value={tempMetodo}
                      onChange={(e) => setTempMetodo(e.target.value as AbonoLinea["metodo"])}
                    >
                      {METODOS.map((m) => (
                        <option key={m.value} value={m.value} className="bg-black text-emerald-200">
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-medium text-emerald-400/70">Moneda</label>
                    <select
                      className="h-8 border border-emerald-500/60 rounded px-1.5 text-xs bg-black text-emerald-200 font-mono focus:outline-none focus:border-emerald-400"
                      value={tempMoneda}
                      onChange={(e) => handleMonedaChange(e.target.value as Moneda)}
                    >
                      <option value="USD" className="bg-black text-emerald-200">USD ($)</option>
                      <option value="VES" className="bg-black text-emerald-200">Bolívares (Bs.)</option>
                      <option value="EUR" className="bg-black text-emerald-200">Euros (€)</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-medium text-emerald-400/70">Monto ({tempMoneda})</label>
                    <Input
                      type="number"
                      step="0.01"
                      className="h-8 text-xs font-mono bg-black border-emerald-500/60 text-emerald-200"
                      placeholder="0.00"
                      value={tempMonto}
                      onChange={(e) => setTempMonto(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-medium text-emerald-400/70 flex items-center gap-1">
                      <TrendingUp className="h-3 w-3 text-emerald-400" /> Tasa (Bs por unidad)
                    </label>
                    <Input
                      type="number"
                      step="0.01"
                      className="h-8 text-xs font-mono bg-black border-emerald-500/60 text-emerald-200 disabled:opacity-50"
                      disabled={tempMoneda === "VES"}
                      value={tempMoneda === "VES" ? "1.00" : tempTasa}
                      onChange={(e) => setTempTasa(e.target.value)}
                    />
                  </div>
                  <div className="col-span-2 flex flex-col gap-1">
                    <label className="text-[10px] font-medium text-emerald-400/70">Cuenta contable de ingreso</label>
                    <select
                      className="h-8 border border-emerald-500/60 rounded px-1.5 text-xs bg-black text-emerald-200 font-mono focus:outline-none focus:border-emerald-400"
                      value={tempCuenta || cuentaPorDefecto}
                      onChange={(e) => setTempCuenta(e.target.value)}
                    >
                      <option value="" className="bg-black text-emerald-200">Selecciona una cuenta…</option>
                      {cuentas.map((c: any) => (
                        <option key={c.id} value={c.id} className="bg-black text-emerald-200">
                          {c.code} — {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2 items-end sm:grid-cols-3">
                  <div className="col-span-1 flex flex-col gap-1">
                    <label className="text-[10px] font-medium text-emerald-400/70">Referencia</label>
                    <Input
                      className="h-8 text-xs bg-black border-emerald-500/60 text-emerald-200 font-mono"
                      placeholder="Nº o notas"
                      value={tempRef}
                      onChange={(e) => setTempRef(e.target.value)}
                    />
                  </div>
                  <label className="flex items-center gap-2 text-[11px] h-8 text-emerald-300 cursor-pointer">
                    <Checkbox
                      checked={tempIgtf && esDivisa(tempMoneda)}
                      disabled={!esDivisa(tempMoneda)}
                      onCheckedChange={(v) => setTempIgtf(!!v)}
                      className="border-emerald-500 text-emerald-500 bg-black"
                    />
                    IGTF {igtfRate}% (divisas)
                  </label>
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 text-xs bg-emerald-600 text-black font-bold hover:bg-emerald-500 font-mono"
                    onClick={addAbono}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" /> Agregar abono
                  </Button>
                </div>

                {parseFloat(tempMonto) > 0 && (
                  <div className="text-[10px] text-emerald-400/70 font-mono">
                    Equivalente Bs: {formatBs(toBs(parseFloat(tempMonto), tempMoneda, tempMoneda === "VES" ? 1 : parseFloat(tempTasa) || 0))}
                    {esDivisa(tempMoneda) && tempIgtf
                      ? ` · IGTF Bs ${formatBs(
                          (toBs(parseFloat(tempMonto), tempMoneda, tempMoneda === "VES" ? 1 : parseFloat(tempTasa) || 0) * igtfRate) / 100,
                        )}`
                      : ""}
                  </div>
                )}

                {abonos.length > 0 && (
                  <div className="divide-y divide-emerald-500/20 border-t border-emerald-500/30 pt-2">
                    {abonos.map((a) => (
                      <div key={a.id} className="flex items-center gap-2 py-1.5 text-xs">
                        <span className="font-mono w-24 text-emerald-200">
                          {a.moneda} {a.montoMoneda.toFixed(2)}
                        </span>
                        <span className="text-emerald-400/70 truncate flex-1">{cuentaLabel(a.cuentaId)}</span>
                        <span className="font-mono text-emerald-200">Bs {formatBs(a.montoBs)}</span>
                        {a.igtf > 0 && <span className="font-mono text-emerald-300">+IGTF {formatBs(a.igtf)}</span>}
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 text-red-400 hover:text-red-300 hover:bg-red-950/40"
                          onClick={() => setAbonos(abonos.filter((x) => x.id !== a.id))}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {(esAgenteIva || esAgenteIslr) && (
                <div className="border border-emerald-500/30 rounded-lg p-3 space-y-2 bg-emerald-950/20">
                  <span className="text-xs font-semibold text-emerald-300 block border-b border-emerald-500/20 pb-1">Retenciones sufridas del cliente</span>
                  {esAgenteIva && (
                    <div className="flex items-center gap-3 text-xs">
                      <label className="flex flex-wrap items-center gap-2 text-emerald-300 cursor-pointer">
                        <Checkbox
                          checked={aplicaIva}
                          onCheckedChange={(v) => setAplicaIva(!!v)}
                          className="border-emerald-500 text-emerald-500 bg-black"
                        />{" "}
                        Retención de IVA
                      </label>
                      <Input
                        type="number"
                        className="h-8 w-20 text-xs font-mono bg-black border-emerald-500/60 text-emerald-200"
                        value={pctIva}
                        disabled={!aplicaIva}
                        onChange={(e) => setPctIva(e.target.value)}
                      />
                      <span className="text-emerald-400/70">% sobre IVA {formatBs(selected.iva_amount)}</span>
                      <span className="ml-auto font-mono font-bold text-emerald-200">Bs {formatBs(ivaRetenido)}</span>
                    </div>
                  )}
                  {esAgenteIslr && (
                    <div className="flex items-center gap-3 text-xs">
                      <label className="flex flex-wrap items-center gap-2 text-emerald-300 cursor-pointer">
                        <Checkbox
                          checked={aplicaIslr}
                          onCheckedChange={(v) => setAplicaIslr(!!v)}
                          className="border-emerald-500 text-emerald-500 bg-black"
                        />{" "}
                        Retención de ISLR
                      </label>
                      <Input
                        type="number"
                        className="h-8 w-20 text-xs font-mono bg-black border-emerald-500/60 text-emerald-200"
                        value={pctIslr}
                        disabled={!aplicaIslr}
                        onChange={(e) => setPctIslr(e.target.value)}
                      />
                      <span className="text-emerald-400/70">% sobre base {formatBs(selected.base_amount)}</span>
                      <span className="ml-auto font-mono font-bold text-emerald-200">Bs {formatBs(islrRetenido)}</span>
                    </div>
                  )}
                  <p className="text-[10px] text-emerald-400/70 flex items-center gap-1 pt-1">
                    <Printer className="h-3 w-3" /> Al guardar se registra el comprobante de retención con su número correlativo.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-3 gap-3 text-xs bg-emerald-950/40 border border-emerald-500/30 rounded-lg p-3">
                <div>
                  <span className="block text-emerald-400/70">Aplicado ahora (Bs)</span>
                  <span className="font-mono font-semibold text-emerald-200">Bs {formatBs(totalAplicado)}</span>
                </div>
                <div>
                  <span className="block text-emerald-400/70">IGTF</span>
                  <span className="font-mono font-semibold text-emerald-200">Bs {formatBs(totalIgtf)}</span>
                </div>
                <div className="text-right">
                  <span className="block text-emerald-400/70">Saldo restante (Bs)</span>
                  <span className="font-mono font-bold text-emerald-200">Bs {formatBs(restante)}</span>
                </div>
              </div>

              <DialogFooter className="pt-3 border-t border-emerald-500/30 flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setSelectedId(null)}
                  className="text-emerald-400 hover:bg-emerald-950 hover:text-emerald-300 font-mono text-xs"
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={guardar}
                  disabled={saving || totalAplicado <= 0}
                  className="gap-1.5 bg-emerald-500 text-black font-bold hover:bg-emerald-400 font-mono text-xs shadow-[0_0_15px_rgba(0,255,102,0.4)]"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarCheck className="h-4 w-4" />} Guardar y contabilizar
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
