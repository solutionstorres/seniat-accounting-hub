import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, CalendarCheck, Plus, RefreshCw, TrendingUp } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/cxp")({
  component: CxPPage,
});

interface FacturaCxP {
  id: string;
  fecha: string;
  proveedor: string;
  rif: string;
  montoOriginal: number; // Siempre en USD (Moneda Base del Sistema)
  montoPendiente: number; // Siempre en USD
  estado: "Pendiente" | "Parcial" | "Pagado";
}

interface MetodoPagoMixto {
  id: string;
  metodo: string;       
  moneda: "USD" | "VES" | "EUR";
  montoOriginalMoneda: number; 
  montoEquivalenteUSD: number; 
  referencia: string;
  tasaUtilizada: number;
}

function CxPPage() {
  const [fromDate, setFromDate] = useState("2026-07-01");
  const [toDate, setToDate] = useState("2026-07-31");

  // Tasas de cambio de la cabecera (Sugeridas iniciales para el día)
  const [tasaUSD, setTasaUSD] = useState<number>(36.50); 
  const [tasaEUR, setTasaEUR] = useState<number>(39.80); 

  const [selectedInvoice, setSelectedInvoice] = useState<FacturaCxP | null>(null);
  const [abonos, setAbonos] = useState<MetodoPagoMixto[]>([]);

  // Campos del abono individual
  const [tempMetodo, setTempMetodo] = useState("Efectivo");
  const [tempMoneda, setTempMoneda] = useState<"USD" | "VES" | "EUR">("USD");
  const [tempMontoMoneda, setTempMontoMoneda] = useState("");
  const [tempReferencia, setTempReferencia] = useState("");
  
  // Input de tasa para el abono (por defecto iniciará con la tasa sugerida de la cabecera)
  const [tempTasaAbono, setTempTasaAbono] = useState<string>("36.50");

  const [cxpData, setCxpData] = useState<FacturaCxP[]>([
    {
      id: "1",
      fecha: "2026-07-05",
      proveedor: "Distribuidora Ficticia, C.A.",
      rif: "J-98765432-1",
      montoOriginal: 450.00,
      montoPendiente: 150.00,
      estado: "Parcial",
    },
    {
      id: "2",
      fecha: "2026-07-12",
      proveedor: "Servicios Integrales Express",
      rif: "J-12345678-9",
      montoOriginal: 1200.00,
      montoPendiente: 1200.00,
      estado: "Pendiente",
    }
  ]);

  const handleSelectInvoice = (invoice: FacturaCxP) => {
    setSelectedInvoice(invoice);
    setAbonos([]); // Empezamos sin abonos asignados para que el usuario los agregue
    setTempMetodo("Efectivo");
    setTempMoneda("USD");
    setTempMontoMoneda("");
    setTempReferencia("");
    setTempTasaAbono("1");
  };

  // Al cambiar la moneda en el abono, actualizamos la tasa predeterminada
  const handleMonedaChange = (moneda: "USD" | "VES" | "EUR") => {
    setTempMoneda(moneda);
    setTempMontoMoneda("");
    if (moneda === "VES") {
      setTempTasaAbono(tasaUSD.toString());
    } else if (moneda === "EUR") {
      setTempTasaAbono(tasaEUR.toString());
    } else {
      setTempTasaAbono("1");
    }
  };

  // Función matemática clave: Convierte cualquier abono a la moneda base (USD) usando la tasa del input
  const obtenerEquivalenteUSD = (monto: number, moneda: "USD" | "VES" | "EUR", tasa: number): number => {
    if (moneda === "USD") return monto;
    if (tasa <= 0) return 0;
    
    if (moneda === "VES") {
      return monto / tasa; // Ej: 12,000.00 Bs / 735 = $16.33 USD
    }
    if (moneda === "EUR") {
      // De Euro a Bs y luego a Dólar usando las tasas especificadas
      const montoEnBs = monto * tasa;
      return montoEnBs / tasaUSD;
    }
    return 0;
  };

  const totalAbonadoUSD = abonos.reduce((sum, item) => sum + item.montoEquivalenteUSD, 0);
  const restanteSugeridoUSD = selectedInvoice ? Math.max(0, selectedInvoice.montoPendiente - totalAbonadoUSD) : 0;

  // TASA DINÁMICA ACTIVA: Usa la tasa ingresada en el input del abono. Si es USD, usa la tasa general de la cabecera.
  const tasaActivaParaCalculo = tempMoneda === "USD" ? tasaUSD : (parseFloat(tempTasaAbono) || tasaUSD);

  const handleAddAbono = () => {
    if (!selectedInvoice) return;

    const montoMonedaVal = parseFloat(tempMontoMoneda);
    const tasaVal = parseFloat(tempTasaAbono);

    if (isNaN(montoMonedaVal) || montoMonedaVal <= 0) {
      toast.error("Ingresa un monto de pago válido.");
      return;
    }

    if (tempMoneda !== "USD" && (isNaN(tasaVal) || tasaVal <= 0)) {
      toast.error("Ingresa una tasa de cambio válida.");
      return;
    }

    const equivalenteUSD = obtenerEquivalenteUSD(montoMonedaVal, tempMoneda, tasaVal);

    if (totalAbonadoUSD + equivalenteUSD > selectedInvoice.montoPendiente + 0.01) {
      toast.error("La suma de los abonos supera el saldo pendiente.");
      return;
    }

    setAbonos([
      ...abonos,
      {
        id: crypto.randomUUID(),
        metodo: tempMetodo,
        moneda: tempMoneda,
        montoOriginalMoneda: montoMonedaVal,
        montoEquivalenteUSD: equivalenteUSD,
        referencia: tempReferencia,
        tasaUtilizada: tempMoneda === "USD" ? 1 : tasaVal
      }
    ]);

    setTempMontoMoneda("");
    setTempReferencia("");
  };

  const handleRemoveAbono = (id: string) => {
    setAbonos(abonos.filter(item => item.id !== id));
  };

  const handleRegisterPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;

    if (totalAbonadoUSD <= 0) {
      toast.error("Debes añadir al menos un abono.");
      return;
    }

    setCxpData(prev => prev.map(inv => {
      if (inv.id === selectedInvoice.id) {
        const nuevoPendiente = Math.max(0, inv.montoPendiente - totalAbonadoUSD);
        const nuevoEstado = nuevoPendiente === 0 ? "Pagado" : "Parcial";
        return { ...inv, montoPendiente: nuevoPendiente, estado: nuevoEstado };
      }
      return inv;
    }));

    toast.success(`Pago total de $${totalAbonadoUSD.toFixed(2)} registrado con éxito.`);
    setSelectedInvoice(null);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Encabezado Principal */}
      <div className="flex justify-between items-start flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Cuentas por Pagar (CxP)</h1>
          <p className="text-muted-foreground text-sm">
            Gestión de pagos mixtos multimoneda con conversión matemática exacta en tiempo real.
          </p>
        </div>

        {/* Tasas Referenciales Diarias */}
        <div className="flex items-center gap-4 bg-muted/45 border p-3 rounded-lg text-xs shadow-sm">
          <div className="flex flex-col gap-1">
            <span className="font-semibold text-muted-foreground">Sugerida USD (BCV)</span>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-muted-foreground">Bs.</span>
              <input 
                type="number" 
                step="0.01" 
                value={tasaUSD} 
                onChange={(e) => setTasaUSD(parseFloat(e.target.value) || 0)} 
                className="w-16 border rounded px-1.5 py-0.5 text-right font-mono bg-background"
              />
            </div>
          </div>
          <div className="h-8 w-[1px] bg-border" />
          <div className="flex flex-col gap-1">
            <span className="font-semibold text-muted-foreground">Sugerida EUR (BCV)</span>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-muted-foreground">Bs.</span>
              <input 
                type="number" 
                step="0.01" 
                value={tasaEUR} 
                onChange={(e) => setTasaEUR(parseFloat(e.target.value) || 0)} 
                className="w-16 border rounded px-1.5 py-0.5 text-right font-mono bg-background"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Tabla de Facturas */}
      <div className="border rounded-xl bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b bg-muted/40 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <th className="py-3 px-4">Fecha</th>
                <th className="py-3 px-4">Proveedor</th>
                <th className="py-3 px-4">RIF</th>
                <th className="py-3 px-4 text-right">Monto Original ($)</th>
                <th className="py-3 px-4 text-right">Monto Pendiente ($)</th>
                <th className="py-3 px-4 text-right font-semibold text-primary">Equiv. Estimado (Bs.)</th>
                <th className="py-3 px-4 text-center">Estado</th>
                <th className="py-3 px-4 text-center">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y text-sm">
              {cxpData.filter(inv => inv.montoPendiente > 0).map((row) => (
                <tr 
                  key={row.id} 
                  className="hover:bg-muted/20 cursor-pointer transition-colors"
                  onClick={() => handleSelectInvoice(row)}
                >
                  <td className="py-3.5 px-4 font-mono text-xs">{row.fecha}</td>
                  <td className="py-3.5 px-4 font-medium">{row.proveedor}</td>
                  <td className="py-3.5 px-4 font-mono text-xs">{row.rif}</td>
                  <td className="py-3.5 px-4 text-right font-mono">${row.montoOriginal.toFixed(2)}</td>
                  <td className="py-3.5 px-4 text-right font-mono font-bold text-destructive">
                    ${row.montoPendiente.toFixed(2)}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono text-xs text-muted-foreground">
                    Bs. {(row.montoPendiente * tasaUSD).toLocaleString("es-VE", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                      {row.estado}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                    <Button size="sm" variant="outline" onClick={() => handleSelectInvoice(row)}>
                      Pagar
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Pago Mixto Multimoneda Profesional */}
      <Dialog open={!!selectedInvoice} onOpenChange={(open) => !open && setSelectedInvoice(null)}>
        <DialogContent className="sm:max-w-[530px]">
          <DialogHeader>
            <DialogTitle>Registrar Pago</DialogTitle>
            <DialogDescription>
              Aplica abonos combinando monedas. El equivalente en bolívares se calcula con la tasa indicada abajo.
            </DialogDescription>
          </DialogHeader>

          {selectedInvoice && (
            <div className="space-y-4 py-2">
              {/* Información Dinámica de Saldos y Equivalencias */}
              <div className="bg-muted/50 rounded-lg p-3 text-xs space-y-1.5 border">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Proveedor:</span>
                  <span className="font-semibold">{selectedInvoice.proveedor}</span>
                </div>
                <div className="grid grid-cols-2 gap-4 border-t pt-1.5 mt-1.5 font-mono">
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase">Saldo Pendiente ($)</span>
                    <span className="text-destructive text-base font-bold">${selectedInvoice.montoPendiente.toFixed(2)}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-muted-foreground block text-[10px] uppercase">
                      Equivalente Estimado (Bs) @ Tasa {tasaActivaParaCalculo.toFixed(2)}
                    </span>
                    <span className="text-foreground text-base font-bold">
                      Bs. {(selectedInvoice.montoPendiente * tasaActivaParaCalculo).toLocaleString("es-VE", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
                <div className="border-t pt-1.5 flex justify-between text-xs font-semibold">
                  <span>Abonado: ${totalAbonadoUSD.toFixed(2)} USD</span>
                  <span className={restanteSugeridoUSD > 0 ? "text-amber-600" : "text-emerald-600"}>
                    Resta por pagar: ${restanteSugeridoUSD.toFixed(2)} USD
                  </span>
                </div>
              </div>

              {/* Lista de Abonos agregados */}
              {abonos.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">Abonos en esta Transacción:</span>
                  <div className="max-h-[110px] overflow-y-auto space-y-1 border rounded-md p-1.5 bg-background">
                    {abonos.map((abono) => (
                      <div key={abono.id} className="flex items-center justify-between bg-muted/40 p-2 rounded text-xs font-mono">
                        <div>
                          <span className="font-semibold text-foreground">{abono.metodo}</span> ({abono.moneda})
                          <span className="block text-[9px] text-muted-foreground">
                            {abono.montoOriginalMoneda.toLocaleString("es-VE", { minimumFractionDigits: 2 })} {abono.moneda} @ Tasa {abono.tasaUtilizada.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-emerald-600">${abono.montoEquivalenteUSD.toFixed(2)} USD</span>
                          <Button 
                            type="button" 
                            variant="ghost" 
                            size="icon" 
                            className="h-5 w-5 text-destructive"
                            onClick={() => handleRemoveAbono(abono.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Formulario para añadir abono */}
              {restanteSugeridoUSD > 0 && (
                <div className="border rounded-lg p-3 bg-muted/25 space-y-3">
                  <span className="text-xs font-semibold text-muted-foreground block">Añadir Abono:</span>
                  
                  <div className="grid grid-cols-3 gap-2">
                    {/* Forma de pago */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-medium text-muted-foreground">Forma</label>
                      <select
                        className="h-8 border rounded px-1.5 text-xs bg-background"
                        value={tempMetodo}
                        onChange={(e) => setTempMetodo(e.target.value)}
                      >
                        <option value="Efectivo">Efectivo</option>
                        <option value="Transferencia">Transferencia</option>
                        <option value="Pago Móvil">Pago Móvil</option>
                        <option value="Zelle">Zelle</option>
                      </select>
                    </div>

                    {/* Moneda */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-medium text-muted-foreground">Moneda</label>
                      <select
                        className="h-8 border rounded px-1.5 text-xs bg-background font-semibold"
                        value={tempMoneda}
                        onChange={(e) => handleMonedaChange(e.target.value as any)}
                      >
                        <option value="USD">Dólar ($)</option>
                        <option value="VES">Bolívar (Bs)</option>
                        <option value="EUR">Euro (€)</option>
                      </select>
                    </div>

                    {/* Monto en la moneda seleccionada */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-medium text-muted-foreground">Monto ({tempMoneda})</label>
                      <Input
                        type="number"
                        step="0.01"
                        className="h-8 text-xs font-mono"
                        placeholder="0.00"
                        value={tempMontoMoneda}
                        onChange={(e) => setTempMontoMoneda(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 items-end">
                    {/* Tasa de cambio editable */}
                    <div className="col-span-1 flex flex-col gap-1">
                      <label className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
                        <TrendingUp className="h-3 w-3 text-primary" />
                        Tasa ({tempMoneda}/$)
                      </label>
                      <Input
                        type="number"
                        step="0.01"
                        className="h-8 text-xs font-mono"
                        disabled={tempMoneda === "USD"}
                        value={tempMoneda === "USD" ? "1.00" : tempTasaAbono}
                        onChange={(e) => setTempTasaAbono(e.target.value)}
                      />
                    </div>

                    {/* Referencia */}
                    <div className="col-span-1 flex flex-col gap-1">
                      <label className="text-[10px] font-medium text-muted-foreground">Referencia</label>
                      <Input
                        type="text"
                        className="h-8 text-xs"
                        placeholder="Nº o Notas"
                        value={tempReferencia}
                        onChange={(e) => setTempReferencia(e.target.value)}
                      />
                    </div>

                    {/* Botón registrar abono */}
                    <Button 
                      type="button" 
                      size="sm"
                      className="h-8 text-xs"
                      onClick={handleAddAbono}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" /> Registrar
                    </Button>
                  </div>

                  {/* VISTA PREVIA MATEMÁTICA CONVERSION EN VIVO */}
                  {parseFloat(tempMontoMoneda) > 0 && parseFloat(tempTasaAbono) > 0 && (
                    <div className="text-[10px] text-muted-foreground flex items-center gap-1 font-mono pt-1">
                      <RefreshCw className="h-2.5 w-2.5 animate-spin text-primary" />
                      Cálculo: {parseFloat(tempMontoMoneda).toLocaleString("es-VE", { minimumFractionDigits: 2 })} {tempMoneda} ÷ Tasa {tempMoneda === "USD" ? "1.00" : parseFloat(tempTasaAbono).toFixed(2)} = 
                      <span className="font-bold text-emerald-600 ml-1">
                        ${obtenerEquivalenteUSD(parseFloat(tempMontoMoneda), tempMoneda, parseFloat(tempTasaAbono)).toFixed(2)} USD
                      </span>
                    </div>
                  )}
                </div>
              )}

              <DialogFooter className="pt-3 border-t">
                <Button type="button" variant="ghost" onClick={() => setSelectedInvoice(null)}>
                  Cancelar
                </Button>
                <Button 
                  type="button" 
                  onClick={handleRegisterPayment} 
                  disabled={totalAbonadoUSD === 0}
                  className="gap-1.5"
                >
                  <CalendarCheck className="h-4 w-4" /> Guardar Transacción
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}