/* eslint-disable */
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

export const Route = createFileRoute("/_authenticated/cxp")({
  component: CxPPage,
  head: () => ({
    meta: [
      { title: "Cuentas por Pagar | ContaVE" },
      { name: "description", content: "Pagos a proveedores y acreedores multimoneda, IGTF, retenciones y asientos automáticos." },
      { property: "og:title", content: "Cuentas por Pagar | ContaVE" },
      { property: "og:description", content: "Pagos multimoneda, IGTF y control financiero para la institución." },
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

function CxPPage() {
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
    queryKey: ["cxp-cuentas", companyId],
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
    queryKey: ["cxp-config", companyId],
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
    queryKey: ["cxp-facturas", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data: invs, error } = await supabase
        .from("purchase_invoices")
        .select("id, invoice_number, invoice_date, total_amount, base_amount, iva_amount, document_type, supplier:suppliers(id, name, rif)")
        .eq("company_id", companyId)
        .eq("status", "emitida")
        .order("invoice_date", { ascending: false });
      if (error) throw error;

      const { data: pays, error: pe } = await supabase
        .from("purchase_payments")
        .select("invoice_id, amount_paid, iva_retained_amount, islr_retained_amount")
        .eq("company_id", companyId);
      if (pe) throw pe;

      const pagado = new Map<string, number>();
      (pays ?? []).forEach((p: any) => {
        const prev = pagado.get(p.invoice_id) ?? 0;
        pagado.set(
          p.invoice_id,
          prev + Number(p.amount_paid ?? 0) + Number(p.iva_retained_amount ?? 0) + Number(p.islr_retained_amount ?? 0),
        );
      });

      return (invs ?? [])
        .filter((i: any) => !String(i.document_type ?? "").toUpperCase().includes("CREDIT"))
        .map((i: any) => {
          const abonado = pagado.get(i.id) ?? 0;
          const pendiente = Math.max(0, Number(i.total_amount ?? 0) - abonado);
          return {
            ...i,
            abonado,
            pendiente,
            estado: pendiente <= 0.009 ? "Pagado" : abonado > 0 ? "Parcial" : "Pendiente",
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
    if (!cuenta) return toast.error("Selecciona la cuenta contable de egreso.");

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

      const { data: pay, error } = await supabase
        .from("purchase_payments")
        .insert({
          company_id: companyId,
          invoice_id: selected.id,
          payment_date: fecha,
          payment_method: metodo as any,
          amount_paid: Number(totalAbonos.toFixed(2)),
          amount_in_usd: Number((totalAbonos / tasaUSD).toFixed(2)),
          amount_in_bs: Number(totalAbonos.toFixed(2)),
          accounting_currency: "VES",
          exchange_rate: tasaUSD,
          apply_igtf: totalIgtf > 0,
          igtf_amount: Number(totalIgtf.toFixed(2)),
          reference_number: abonos[0]?.referencia ?? null,
          created_by: userData.user?.id ?? null,
          currency: abonos[0]?.moneda ?? "VES",
          payment_account_id: abonos[0]?.cuentaId ?? null,
          iva_retention_percentage: aplicaIva ? parseFloat(pctIva) || 0 : 0,
          iva_retained_amount: ivaRetenido,
          islr_retention_percentage: aplicaIslr ? parseFloat(pctIslr) || 0 : 0,
          islr_retained_amount: islrRetenido,
        } as any)
        .select("id")
        .single();
      if (error) throw error;
      if (!pay) throw new Error("No se pudo guardar el pago.");

      if (abonos.length) {
        const { error: le } = await supabase.from("purchase_payment_lines" as any).insert(
          abonos.map((a, i) => ({
            company_id: companyId,
            payment_id: pay.id,
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

      const { error: re } = await supabase.rpc("post_purchase_payment" as any, { _payment_id: pay.id });
      if (re) throw re;

      toast.success("Pago registrado, asientos y comprobantes generados.");
      setSelectedId(null);
      qc.invalidateQueries({ queryKey: ["cxp-facturas", companyId] });
    } catch (e: any) {
      toast.error(e.message ?? "No se pudo registrar el pago.");
    } finally {
      setSaving(false);
    }
  }

  const cuentaLabel = (id: string) => {
    const c = cuentas.find((x: any) => x.id === id);
    return c ? `${c.code} ${c.name}` : "—";
  };

  return (
    <div className="min-h-screen bg-black text-emerald-400 p-4 sm:p-6 space-y-6 font-mono">
      <div className="flex justify-between items-start flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-emerald-300 drop-shadow-[0_0_8px_rgba(0,255,102,0.4)]">
            Cuentas por Pagar (CxP)
          </h1>
          <p className="text-emerald-400/80 text-sm mt-1">
            Pagos a proveedores y compromisos institucionales, multimoneda, con IGTF, retenciones y asientos automáticos.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 bg-emerald-950/30 border border-emerald-500/30 p-3 rounded-lg text-xs shadow-[0_0_15px_rgba(0,255,102,0.1)]">
          <div className="flex flex-col gap-1">
            <span className="font-semibold text-emerald-500">Tasa USD (BCV)</span>
            <input
              type="number"
              step="0.01"
              aria-label="Tasa USD (BCV)"
              disabled={!!selectedId}
              value={tasaUSD}
              onChange={(e) => setTasaUSD(parseFloat(e.target.value) || 0)}
              className="w-20 border border-emerald-500/60 rounded px-1.5 py-0.5 text-right font-mono bg-black text-emerald-200 focus:outline-none focus:ring-1 focus:ring-emerald-400"
            />
          </div>
          <div className="h-8 w-[1px] bg-emerald-500/30" />
          <div className="flex flex-col gap-1">
            <span className="font-semibold text-emerald-500">Tasa EUR (BCV)</span>
            <input
              type="number"
              step="0.01"
              aria-label="Tasa EUR (BCV)"
              disabled={!!selectedId}
              value={tasaEUR}
              onChange={(e) => setTasaEUR(parseFloat(e.target.value) || 0)}
              className="w-20 border border-emerald-500/60 rounded px-1.5 py-0.5 text-right font-mono bg-black text-emerald-200 focus:outline-none focus:ring-1 focus:ring-emerald-400"
            />
          </div>
          <div className="h-8 w-[1px] bg-emerald-500/30" />
          <div className="flex flex-col gap-1">
            <span className="font-semibold text-emerald-500">Agente retención</span>
            <span className="text-emerald-300">
              IVA {esAgenteIva ? "Sí" : "No"} · ISLR {esAgenteIslr ? "Sí" : "No"}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span role="status">{rateStatus}</span>
        <Button variant="ghost" size="icon" aria-label="Actualizar tasas BCV" title="Actualizar tasas BCV" onClick={refreshRates} disabled={fetchingRates || !!selectedId}><TrendingUp className="h-4 w-4" /></Button>
      </div>

      <div className="border border-emerald-500/40 rounded-xl bg-black/95 overflow-hidden shadow-[0_0_20px_rgba(0,255,102,0.15)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-emerald-500/30 bg-emerald-950/30 text-xs font-bold text-emerald-300 uppercase tracking-wider">
                <th className="py-3 px-4">Fecha</th>
                <th className="py-3 px-4">Documento</th>
                <th className="py-3 px-4">Proveedor</th>
                <th className="py-3 px-4">RIF</th>
                <th className="py-3 px-4 text-right">Total (Bs)</th>
                <th className="py-3 px-4 text-right">Abonado (Bs)</th>
                <th className="py-3 px-4 text-right">Pendiente (Bs)</th>
                <th className="py-3 px-4 text-right">Equiv. $</th>
                <th className="py-3 px-4 text-center">Estado</th>
                <th className="py-3 px-4 text-center">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-emerald-500/20 text-sm">
              {isLoading && (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-emerald-500">
                    <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Cargando facturas…
                  </td>
                </tr>
              )}
              {!isLoading && facturas.filter((f: any) => f.pendiente > 0.009).length === 0 && (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-emerald-600">
                    No hay facturas de compra pendientes de pago.
                  </td>
                </tr>
              )}
              {facturas
                .filter((f: any) => f.pendiente > 0.009)
                .map((row: any) => (
                  <tr key={row.id} className="hover:bg-emerald-900/20 transition-colors">
                    <td className="py-3.5 px-4 text-xs text-emerald-300">{row.invoice_date}</td>
                    <td className="py-3.5 px-4 text-xs text-emerald-300">{row.invoice_number}</td>
                    <td className="py-3.5 px-4 font-medium text-emerald-100">{row.supplier?.name}</td>
                    <td className="py-3.5 px-4 text-xs text-emerald-400/80">{row.supplier?.rif}</td>
                    <td className="py-3.5 px-4 text-right text-emerald-200">{formatBs(row.total_amount)}</td>
                    <td className="py-3.5 px-4 text-right text-emerald-400/70">{formatBs(row.abonado)}</td>
                    <td className="py-3.5 px-4 text-right font-bold text-red-400">{formatBs(row.pendiente)}</td>
                    <td className="py-3.5 px-4 text-right text-xs text-emerald-400/70">
                      {equivalentUSD(row.pendiente, tasaUSD) === null ? "—" : `$ ${formatBs(equivalentUSD(row.pendiente, tasaUSD))}`}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-950/40 text-amber-400 border border-amber-500/40">
                        {row.estado}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => openInvoice(row)}
                        className="border-emerald-500/40 bg-black text-emerald-300 hover:bg-emerald-950 hover:text-emerald-200 h-8 px-3 text-xs"
                      >
                        Pagar
                      </Button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelectedId(null)}>
        <DialogContent className="sm:max-w-[680px] max-h-[90vh] overflow-y-auto bg-black border border-emerald-500/50 text-emerald-400 shadow-[0_0_25px_rgba(0,255,102,0.2)]">
          <DialogHeader>
            <DialogTitle className="text-emerald-300 text-lg border-b border-emerald-500/30 pb-2">
              Registrar pago a proveedor
            </DialogTitle>
            <DialogDescription className="text-emerald-400/80 text-xs">
              Abonos multimoneda con cuenta contable de egreso, IGTF automático en divisas y retenciones institucionales.
            </DialogDescription>
          </DialogHeader>

          {selected && (
            <div className="space-y-4 py-1">
              <div className="bg-emerald-950/20 rounded-lg p-3 text-xs space-y-1.5 border border-emerald-500/30">
                <div className="flex justify-between">
                  <span className="text-emerald-400/80">Proveedor:</span>
                  <span className="font-semibold text-emerald-200">{selected.supplier?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-emerald-400/80">Documento:</span>
                  <span className="text-emerald-300">{selected.invoice_number}</span>
                </div>
                <div className="grid grid-cols-3 gap-3 border-t border-emerald-500/20 pt-1.5 mt-1.5">
                  <div>
                    <span className="text-emerald-500 block text-[10px] uppercase">Pendiente (Bs)</span>
                    <span className="text-red-400 text-base font-bold">Bs {formatBs(selected.pendiente)}</span>
                  </div>
                  <div>
                    <span className="text-emerald-500 block text-[10px] uppercase">Aplicado ahora (Bs)</span>
                    <span className="text-emerald-200 text-base font-bold">Bs {formatBs(totalAplicado)}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-emerald-500 block text-[10px] uppercase">Resta (Bs)</span>
                    <span className={restante > 0 ? "text-amber-400 text-base font-bold" : "text-emerald-300 text-base font-bold"}>
                      Bs {formatBs(restante)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <label className="text-xs font-medium text-emerald-400">Fecha del pago</label>
                <Input 
                  type="date" 
                  className="h-8 w-40 text-xs bg-black border-emerald-500/60 text-emerald-200 [color-scheme:dark]" 
                  value={fecha} 
                  onChange={(e) => setFecha(e.target.value)} 
                />
              </div>

              {abonos.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-emerald-500 uppercase">Abonos de esta transacción</span>
                  <div className="max-h-[150px] overflow-y-auto space-y-1 border border-emerald-500/30 rounded-md p-1.5 bg-black">
                    {abonos.map((a) => (
                      <div key={a.id} className="flex items-center justify-between bg-emerald-950/20 p-2 rounded text-xs border border-emerald-500/20">
                        <div>
                          <span className="font-semibold text-emerald-200">{METODOS.find((m) => m.value === a.metodo)?.label}</span> ({a.moneda})
                          <span className="block text-[9px] text-emerald-400/70">
                            {formatBs(a.montoMoneda)} {a.moneda} @ {a.tasa.toFixed(2)} · {cuentaLabel(a.cuentaId)}
                            {a.igtf > 0 ? ` · IGTF Bs ${formatBs(a.igtf)}` : ""}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-emerald-300">Bs {formatBs(a.montoBs)}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 text-red-400 hover:text-red-300 hover:bg-red-950/40"
                            onClick={() => setAbonos(abonos.filter((x) => x.id !== a.id))}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="border border-emerald-500/30 rounded-lg p-3 bg-emerald-950/10 space-y-3">
                <span className="text-xs font-semibold text-emerald-300 block">Añadir abono</span>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-medium text-emerald-400/80">Forma de pago</label>
                    <select
                      className="h-8 border border-emerald-500/60 rounded px-1.5 text-xs bg-black text-emerald-200 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                      value={tempMetodo}
                      onChange={(e) => {
                        const v = e.target.value as AbonoLinea["metodo"];
                        setTempMetodo(v);
                        if (v === "divisa") handleMonedaChange("USD");
                      }}
                    >
                      {METODOS.map((m) => (
                        <option key={m.value} value={m.value} className="bg-black text-emerald-200">
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-medium text-emerald-400/80">Moneda</label>
                    <select
                      className="h-8 border border-emerald-500/60 rounded px-1.5 text-xs bg-black text-emerald-200 font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-400"
                      value={tempMoneda}
                      onChange={(e) => handleMonedaChange(e.target.value as Moneda)}
                    >
                      <option value="USD" className="bg-black text-emerald-200">Dólar ($)</option>
                      <option value="VES" className="bg-black text-emerald-200">Bolívar (Bs)</option>
                      <option value="EUR" className="bg-black text-emerald-200">Euro (€)</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-medium text-emerald-400/80">Monto ({tempMoneda})</label>
                    <Input
                      type="number"
                      step="0.01"
                      className="h-8 text-xs bg-black border-emerald-500/60 text-emerald-200 placeholder:text-emerald-800"
                      placeholder="0.00"
                      value={tempMonto}
                      onChange={(e) => setTempMonto(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-medium text-emerald-400/80 flex items-center gap-1">
                      <TrendingUp className="h-3 w-3 text-emerald-400" /> Tasa (Bs por unidad)
                    </label>
                    <Input
                      type="number"
                      step="0.01"
                      className="h-8 text-xs bg-black border-emerald-500/60 text-emerald-200 disabled:opacity-40"
                      disabled={tempMoneda === "VES"}
                      value={tempMoneda === "VES" ? "1.00" : tempTasa}
                      onChange={(e) => setTempTasa(e.target.value)}
                    />
                  </div>
                  <div className="col-span-2 flex flex-col gap-1">
                    <label className="text-[10px] font-medium text-emerald-400/80">Cuenta contable de egreso</label>
                    <select
                      className="h-8 border border-emerald-500/60 rounded px-1.5 text-xs bg-black text-emerald-200 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                      value={tempCuenta || cuentaPorDefecto}
                      onChange={(e) => setTempCuenta(e.target.value)}
                    >
                      <option value="" className="bg-black text-emerald-600">Selecciona una cuenta…</option>
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
                    <label className="text-[10px] font-medium text-emerald-400/80">Referencia</label>
                    <Input
                      className="h-8 text-xs bg-black border-emerald-500/60 text-emerald-200 placeholder:text-emerald-800"
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
                      className="border-emerald-500 text-emerald-600 data-[state=checked]:bg-emerald-500 data-[state=checked]:text-black"
                    />
                    IGTF {igtfRate}% (divisas)
                  </label>
                  <Button 
                    type="button" 
                    size="sm" 
                    className="h-8 text-xs bg-emerald-600 text-black font-bold hover:bg-emerald-500 shadow-[0_0_10px_rgba(0,255,102,0.2)]" 
                    onClick={addAbono}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" /> Agregar abono
                  </Button>
                </div>

                {parseFloat(tempMonto) > 0 && (
                  <div className="text-[10px] text-emerald-400/80">
                    Equivalente Bs: {formatBs(toBs(parseFloat(tempMonto), tempMoneda, tempMoneda === "VES" ? 1 : parseFloat(tempTasa) || 0))}
                    {esDivisa(tempMoneda) && tempIgtf
                      ? ` · IGTF Bs ${formatBs(
                          (toBs(parseFloat(tempMonto), tempMoneda, tempMoneda === "VES" ? 1 : parseFloat(tempTasa) || 0) * igtfRate) / 100,
                        )}`
                      : ""}
                  </div>
                )}
              </div>

              {(esAgenteIva || esAgenteIslr) && (
                <div className="border border-emerald-500/30 rounded-lg p-3 space-y-2 bg-emerald-950/10">
                  <span className="text-xs font-semibold text-emerald-300 block">Retenciones institucionales</span>
                  {esAgenteIva && (
                    <div className="flex items-center gap-3 text-xs">
                      <label className="flex flex-wrap items-center gap-2 text-emerald-300 cursor-pointer">
                        <Checkbox 
                          checked={aplicaIva} 
                          onCheckedChange={(v) => setAplicaIva(!!v)} 
                          className="border-emerald-500 text-emerald-600 data-[state=checked]:bg-emerald-500 data-[state=checked]:text-black"
                        /> Retener IVA
                      </label>
                      <Input
                        type="number"
                        className="h-8 w-20 text-xs bg-black border-emerald-500/60 text-emerald-200"
                        value={pctIva}
                        disabled={!aplicaIva}
                        onChange={(e) => setPctIva(e.target.value)}
                      />
                      <span className="text-emerald-400/80">% sobre IVA {formatBs(selected.iva_amount)}</span>
                      <span className="ml-auto font-bold text-emerald-300">Bs {formatBs(ivaRetenido)}</span>
                    </div>
                  )}
                  {esAgenteIslr && (
                    <div className="flex items-center gap-3 text-xs">
                      <label className="flex flex-wrap items-center gap-2 text-emerald-300 cursor-pointer">
                        <Checkbox 
                          checked={aplicaIslr} 
                          onCheckedChange={(v) => setAplicaIslr(!!v)} 
                          className="border-emerald-500 text-emerald-600 data-[state=checked]:bg-emerald-500 data-[state=checked]:text-black"
                        /> Retener ISLR
                      </label>
                      <Input
                        type="number"
                        className="h-8 w-20 text-xs bg-black border-emerald-500/60 text-emerald-200"
                        value={pctIslr}
                        disabled={!aplicaIslr}
                        onChange={(e) => setPctIslr(e.target.value)}
                      />
                      <span className="text-emerald-400/80">% sobre base {formatBs(selected.base_amount)}</span>
                      <span className="ml-auto font-bold text-emerald-300">Bs {formatBs(islrRetenido)}</span>
                    </div>
                  )}
                  <p className="text-[10px] text-emerald-500 flex items-center gap-1 pt-1">
                    <Printer className="h-3 w-3" /> Al guardar se emite el comprobante de retención con su número correlativo.
                  </p>
                </div>
              )}

              <DialogFooter className="pt-3 border-t border-emerald-500/30">
                <Button 
                  type="button" 
                  variant="ghost" 
                  onClick={() => setSelectedId(null)}
                  className="text-emerald-400 hover:text-emerald-200 hover:bg-emerald-950/40"
                >
                  Cancelar
                </Button>
                <Button 
                  type="button" 
                  onClick={guardar} 
                  disabled={saving || totalAplicado <= 0} 
                  className="gap-1.5 bg-emerald-500 text-black font-bold hover:bg-emerald-400 shadow-[0_0_15px_rgba(0,255,102,0.4)]"
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
