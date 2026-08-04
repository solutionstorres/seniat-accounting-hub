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

export const Route = createFileRoute("/_authenticated/cxp")({
  component: CxPPage,
  head: () => ({
    meta: [
      { title: "Cuentas por Pagar | ContaVE" },
      { name: "description", content: "Pagos a proveedores multimoneda con IGTF, retenciones IVA/ISLR y asientos automáticos." },
      { property: "og:title", content: "Cuentas por Pagar | ContaVE" },
      { property: "og:description", content: "Pagos multimoneda, IGTF y comprobantes de retención según el SENIAT." },
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
  montoUSD: number;
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

  const [tasaUSD, setTasaUSD] = useState<number>(36.5);
  const [tasaEUR, setTasaEUR] = useState<number>(39.8);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [abonos, setAbonos] = useState<AbonoLinea[]>([]);
  const [saving, setSaving] = useState(false);
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));

  const [tempMetodo, setTempMetodo] = useState<AbonoLinea["metodo"]>("efectivo");
  const [tempMoneda, setTempMoneda] = useState<Moneda>("USD");
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
    setTempMoneda("USD");
    setTempMonto("");
    setTempTasa("1");
    setTempRef("");
    setTempIgtf(true);
    setTempCuenta("");
    setAplicaIva(esAgenteIva);
    setAplicaIslr(false);
    setPctIva(String((activeCompany as any)?.default_iva_withholding_rate ?? 75));
    setPctIslr(String((activeCompany as any)?.default_islr_withholding_rate ?? 3));
  }

  function toUSD(monto: number, moneda: Moneda, tasa: number): number {
    if (moneda === "USD") return monto;
    if (!tasa || tasa <= 0) return 0;
    if (moneda === "VES") return monto / tasa;
    return (monto * tasa) / (tasaUSD || 1);
  }

  const esDivisa = (moneda: Moneda) => moneda === "USD" || moneda === "EUR";

  const totalAbonos = abonos.reduce((s, a) => s + a.montoUSD, 0);
  const totalIgtf = abonos.reduce((s, a) => s + a.igtf, 0);

  const ivaRetenido = selected && aplicaIva ? Number(((Number(selected.iva_amount ?? 0) * (parseFloat(pctIva) || 0)) / 100).toFixed(2)) : 0;
  const islrRetenido = selected && aplicaIslr ? Number(((Number(selected.base_amount ?? 0) * (parseFloat(pctIslr) || 0)) / 100).toFixed(2)) : 0;
  const totalAplicado = totalAbonos + ivaRetenido + islrRetenido;
  const restante = selected ? Math.max(0, Number(selected.pendiente) - totalAplicado) : 0;

  function handleMonedaChange(m: Moneda) {
    setTempMoneda(m);
    setTempMonto("");
    setTempTasa(m === "VES" ? String(tasaUSD) : m === "EUR" ? String(tasaEUR) : "1");
    setTempIgtf(esDivisa(m));
  }

  function addAbono() {
    if (!selected) return;
    const monto = parseFloat(tempMonto.replace(",", "."));
    const tasa = parseFloat(tempTasa.replace(",", "."));
    const cuenta = tempCuenta || cuentaPorDefecto;
    if (!monto || monto <= 0) return toast.error("Ingresa un monto válido.");
    if (tempMoneda !== "USD" && (!tasa || tasa <= 0)) return toast.error("Ingresa una tasa de cambio válida.");
    if (!cuenta) return toast.error("Selecciona la cuenta contable de egreso.");

    const usd = toUSD(monto, tempMoneda, tempMoneda === "USD" ? 1 : tasa);
    if (totalAbonos + usd > Number(selected.pendiente) - ivaRetenido - islrRetenido + 0.01) {
      return toast.error("La suma de los abonos supera el saldo pendiente.");
    }
    const igtf = tempIgtf && esDivisa(tempMoneda) ? Number(((usd * igtfRate) / 100).toFixed(2)) : 0;

    setAbonos([
      ...abonos,
      {
        id: crypto.randomUUID(),
        metodo: tempMetodo,
        moneda: tempMoneda,
        montoMoneda: monto,
        tasa: tempMoneda === "USD" ? 1 : tasa,
        montoUSD: usd,
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
          amount_in_usd: Number(totalAbonos.toFixed(2)),
          amount_in_bs: Number((totalAbonos * tasaUSD).toFixed(2)),
          exchange_rate: tasaUSD,
          apply_igtf: totalIgtf > 0,
          igtf_amount: Number(totalIgtf.toFixed(2)),
          reference_number: abonos[0]?.referencia ?? null,
          created_by: userData.user?.id ?? null,
          currency: abonos[0]?.moneda ?? "USD",
          payment_account_id: abonos[0]?.cuentaId ?? null,
          iva_retention_percentage: aplicaIva ? parseFloat(pctIva) || 0 : 0,
          iva_retained_amount: ivaRetenido,
          islr_retention_percentage: aplicaIslr ? parseFloat(pctIslr) || 0 : 0,
          islr_retained_amount: islrRetenido,
        } as any)
        .select("id")
        .single();
      if (error) throw error;

      if (abonos.length) {
        const { error: le } = await supabase.from("purchase_payment_lines" as any).insert(
          abonos.map((a, i) => ({
            company_id: companyId,
            payment_id: pay!.id,
            method: a.metodo,
            currency: a.moneda,
            amount_currency: a.montoMoneda,
            exchange_rate: a.tasa,
            amount_usd: Number(a.montoUSD.toFixed(2)),
            account_id: a.cuentaId,
            apply_igtf: a.igtf > 0,
            igtf_amount: a.igtf,
            reference_number: a.referencia || null,
            line_order: i + 1,
          })),
        );
        if (le) throw le;
      }

      const { error: re } = await supabase.rpc("post_purchase_payment" as any, { _payment_id: pay!.id });
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
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-start flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Cuentas por Pagar (CxP)</h1>
          <p className="text-muted-foreground text-sm">
            Pagos totales o parciales, multimoneda, con IGTF, retenciones de IVA/ISLR y asientos automáticos.
          </p>
        </div>

        <div className="flex items-center gap-4 bg-muted/45 border p-3 rounded-lg text-xs shadow-sm">
          <div className="flex flex-col gap-1">
            <span className="font-semibold text-muted-foreground">Tasa USD (BCV)</span>
            <input
              type="number"
              step="0.01"
              value={tasaUSD}
              onChange={(e) => setTasaUSD(parseFloat(e.target.value) || 0)}
              className="w-20 border rounded px-1.5 py-0.5 text-right font-mono bg-background"
            />
          </div>
          <div className="h-8 w-[1px] bg-border" />
          <div className="flex flex-col gap-1">
            <span className="font-semibold text-muted-foreground">Tasa EUR (BCV)</span>
            <input
              type="number"
              step="0.01"
              value={tasaEUR}
              onChange={(e) => setTasaEUR(parseFloat(e.target.value) || 0)}
              className="w-20 border rounded px-1.5 py-0.5 text-right font-mono bg-background"
            />
          </div>
          <div className="h-8 w-[1px] bg-border" />
          <div className="flex flex-col gap-1">
            <span className="font-semibold text-muted-foreground">Agente de retención</span>
            <span className="font-mono">
              IVA {esAgenteIva ? "Sí" : "No"} · ISLR {esAgenteIslr ? "Sí" : "No"}
            </span>
          </div>
        </div>
      </div>

      <div className="border rounded-xl bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b bg-muted/40 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <th className="py-3 px-4">Fecha</th>
                <th className="py-3 px-4">Documento</th>
                <th className="py-3 px-4">Proveedor</th>
                <th className="py-3 px-4">RIF</th>
                <th className="py-3 px-4 text-right">Total</th>
                <th className="py-3 px-4 text-right">Abonado</th>
                <th className="py-3 px-4 text-right">Pendiente</th>
                <th className="py-3 px-4 text-right">Equiv. Bs.</th>
                <th className="py-3 px-4 text-center">Estado</th>
                <th className="py-3 px-4 text-center">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y text-sm">
              {isLoading && (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Cargando facturas…
                  </td>
                </tr>
              )}
              {!isLoading && facturas.filter((f: any) => f.pendiente > 0.009).length === 0 && (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-muted-foreground">
                    No hay facturas de compra pendientes de pago.
                  </td>
                </tr>
              )}
              {facturas
                .filter((f: any) => f.pendiente > 0.009)
                .map((row: any) => (
                  <tr key={row.id} className="hover:bg-muted/20 transition-colors">
                    <td className="py-3.5 px-4 font-mono text-xs">{row.invoice_date}</td>
                    <td className="py-3.5 px-4 font-mono text-xs">{row.invoice_number}</td>
                    <td className="py-3.5 px-4 font-medium">{row.supplier?.name}</td>
                    <td className="py-3.5 px-4 font-mono text-xs">{row.supplier?.rif}</td>
                    <td className="py-3.5 px-4 text-right font-mono">{formatBs(row.total_amount)}</td>
                    <td className="py-3.5 px-4 text-right font-mono text-muted-foreground">{formatBs(row.abonado)}</td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-destructive">{formatBs(row.pendiente)}</td>
                    <td className="py-3.5 px-4 text-right font-mono text-xs text-muted-foreground">
                      Bs. {formatBs(row.pendiente * tasaUSD)}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                        {row.estado}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <Button size="sm" variant="outline" onClick={() => openInvoice(row)}>
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
        <DialogContent className="sm:max-w-[680px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Registrar pago a proveedor</DialogTitle>
            <DialogDescription>
              Abonos multimoneda con cuenta contable de egreso, IGTF automático en divisas y retenciones según normativa SENIAT.
            </DialogDescription>
          </DialogHeader>

          {selected && (
            <div className="space-y-4 py-1">
              <div className="bg-muted/50 rounded-lg p-3 text-xs space-y-1.5 border">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Proveedor:</span>
                  <span className="font-semibold">{selected.supplier?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Documento:</span>
                  <span className="font-mono">{selected.invoice_number}</span>
                </div>
                <div className="grid grid-cols-3 gap-3 border-t pt-1.5 mt-1.5 font-mono">
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase">Pendiente</span>
                    <span className="text-destructive text-base font-bold">{formatBs(selected.pendiente)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase">Aplicado ahora</span>
                    <span className="text-base font-bold">{formatBs(totalAplicado)}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-muted-foreground block text-[10px] uppercase">Resta</span>
                    <span className={restante > 0 ? "text-amber-600 text-base font-bold" : "text-emerald-600 text-base font-bold"}>
                      {formatBs(restante)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <label className="text-xs font-medium text-muted-foreground">Fecha del pago</label>
                <Input type="date" className="h-8 w-40 text-xs" value={fecha} onChange={(e) => setFecha(e.target.value)} />
              </div>

              {abonos.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">Abonos de esta transacción</span>
                  <div className="max-h-[150px] overflow-y-auto space-y-1 border rounded-md p-1.5 bg-background">
                    {abonos.map((a) => (
                      <div key={a.id} className="flex items-center justify-between bg-muted/40 p-2 rounded text-xs font-mono">
                        <div>
                          <span className="font-semibold">{METODOS.find((m) => m.value === a.metodo)?.label}</span> ({a.moneda})
                          <span className="block text-[9px] text-muted-foreground">
                            {formatBs(a.montoMoneda)} {a.moneda} @ {a.tasa.toFixed(2)} · {cuentaLabel(a.cuentaId)}
                            {a.igtf > 0 ? ` · IGTF ${formatBs(a.igtf)}` : ""}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-emerald-600">{formatBs(a.montoUSD)}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 text-destructive"
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

              <div className="border rounded-lg p-3 bg-muted/25 space-y-3">
                <span className="text-xs font-semibold text-muted-foreground block">Añadir abono</span>
                <div className="grid grid-cols-3 gap-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-medium text-muted-foreground">Forma de pago</label>
                    <select
                      className="h-8 border rounded px-1.5 text-xs bg-background"
                      value={tempMetodo}
                      onChange={(e) => {
                        const v = e.target.value as AbonoLinea["metodo"];
                        setTempMetodo(v);
                        if (v === "divisa") handleMonedaChange("USD");
                      }}
                    >
                      {METODOS.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-medium text-muted-foreground">Moneda</label>
                    <select
                      className="h-8 border rounded px-1.5 text-xs bg-background font-semibold"
                      value={tempMoneda}
                      onChange={(e) => handleMonedaChange(e.target.value as Moneda)}
                    >
                      <option value="USD">Dólar ($)</option>
                      <option value="VES">Bolívar (Bs)</option>
                      <option value="EUR">Euro (€)</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-medium text-muted-foreground">Monto ({tempMoneda})</label>
                    <Input
                      type="number"
                      step="0.01"
                      className="h-8 text-xs font-mono"
                      placeholder="0.00"
                      value={tempMonto}
                      onChange={(e) => setTempMonto(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
                      <TrendingUp className="h-3 w-3 text-primary" /> Tasa
                    </label>
                    <Input
                      type="number"
                      step="0.01"
                      className="h-8 text-xs font-mono"
                      disabled={tempMoneda === "USD"}
                      value={tempMoneda === "USD" ? "1.00" : tempTasa}
                      onChange={(e) => setTempTasa(e.target.value)}
                    />
                  </div>
                  <div className="col-span-2 flex flex-col gap-1">
                    <label className="text-[10px] font-medium text-muted-foreground">Cuenta contable de egreso</label>
                    <select
                      className="h-8 border rounded px-1.5 text-xs bg-background"
                      value={tempCuenta || cuentaPorDefecto}
                      onChange={(e) => setTempCuenta(e.target.value)}
                    >
                      <option value="">Selecciona una cuenta…</option>
                      {cuentas.map((c: any) => (
                        <option key={c.id} value={c.id}>
                          {c.code} — {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 items-end">
                  <div className="col-span-1 flex flex-col gap-1">
                    <label className="text-[10px] font-medium text-muted-foreground">Referencia</label>
                    <Input
                      className="h-8 text-xs"
                      placeholder="Nº o notas"
                      value={tempRef}
                      onChange={(e) => setTempRef(e.target.value)}
                    />
                  </div>
                  <label className="flex items-center gap-2 text-[11px] h-8">
                    <Checkbox
                      checked={tempIgtf && esDivisa(tempMoneda)}
                      disabled={!esDivisa(tempMoneda)}
                      onCheckedChange={(v) => setTempIgtf(!!v)}
                    />
                    IGTF {igtfRate}% (divisas)
                  </label>
                  <Button type="button" size="sm" className="h-8 text-xs" onClick={addAbono}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Agregar abono
                  </Button>
                </div>

                {parseFloat(tempMonto) > 0 && (
                  <div className="text-[10px] text-muted-foreground font-mono">
                    Equivalente: {formatBs(toUSD(parseFloat(tempMonto), tempMoneda, tempMoneda === "USD" ? 1 : parseFloat(tempTasa) || 0))}
                    {esDivisa(tempMoneda) && tempIgtf
                      ? ` · IGTF ${formatBs(
                          (toUSD(parseFloat(tempMonto), tempMoneda, tempMoneda === "USD" ? 1 : parseFloat(tempTasa) || 0) * igtfRate) / 100,
                        )}`
                      : ""}
                  </div>
                )}
              </div>

              {(esAgenteIva || esAgenteIslr) && (
                <div className="border rounded-lg p-3 space-y-2">
                  <span className="text-xs font-semibold text-muted-foreground block">Retenciones como agente</span>
                  {esAgenteIva && (
                    <div className="flex items-center gap-3 text-xs">
                      <label className="flex items-center gap-2">
                        <Checkbox checked={aplicaIva} onCheckedChange={(v) => setAplicaIva(!!v)} /> Retener IVA
                      </label>
                      <Input
                        type="number"
                        className="h-8 w-20 text-xs font-mono"
                        value={pctIva}
                        disabled={!aplicaIva}
                        onChange={(e) => setPctIva(e.target.value)}
                      />
                      <span className="text-muted-foreground">% sobre IVA {formatBs(selected.iva_amount)}</span>
                      <span className="ml-auto font-mono font-bold">{formatBs(ivaRetenido)}</span>
                    </div>
                  )}
                  {esAgenteIslr && (
                    <div className="flex items-center gap-3 text-xs">
                      <label className="flex items-center gap-2">
                        <Checkbox checked={aplicaIslr} onCheckedChange={(v) => setAplicaIslr(!!v)} /> Retener ISLR
                      </label>
                      <Input
                        type="number"
                        className="h-8 w-20 text-xs font-mono"
                        value={pctIslr}
                        disabled={!aplicaIslr}
                        onChange={(e) => setPctIslr(e.target.value)}
                      />
                      <span className="text-muted-foreground">% sobre base {formatBs(selected.base_amount)}</span>
                      <span className="ml-auto font-mono font-bold">{formatBs(islrRetenido)}</span>
                    </div>
                  )}
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Printer className="h-3 w-3" /> Al guardar se emite el comprobante de retención con su número correlativo.
                  </p>
                </div>
              )}

              <DialogFooter className="pt-3 border-t">
                <Button type="button" variant="ghost" onClick={() => setSelectedId(null)}>
                  Cancelar
                </Button>
                <Button type="button" onClick={guardar} disabled={saving || totalAplicado <= 0} className="gap-1.5">
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
