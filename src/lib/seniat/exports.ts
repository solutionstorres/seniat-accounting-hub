// Helpers para exportaciones oficiales SENIAT
// Providencia SNAT/2003/1677 (libros IVA), Providencia 0049 (Ret. IVA XML),
// AR-CV (Retenciones ISLR).

export function downloadText(filename: string, text: string, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function pad(v: string | number, len: number, char = " ", right = false): string {
  const s = String(v ?? "").slice(0, len);
  return right ? s.padEnd(len, char) : s.padStart(len, char);
}

const money = (n: number) => (Math.round(Number(n || 0) * 100) / 100).toFixed(2);
const rif = (r?: string | null) => (r ?? "").replace(/[^A-Z0-9]/gi, "").toUpperCase();
const d8 = (iso: string) => iso.replaceAll("-", "");

/** TXT Libro de Ventas — formato SENIAT (delimitado por TAB, una línea por operación). */
export function buildSalesBookTxt(companyRif: string, rows: any[]): string {
  const header = [
    "OPERACION", "FECHA", "RIF_CLIENTE", "NOMBRE_CLIENTE",
    "N_FACTURA", "N_CONTROL", "N_NOTA_DEBITO", "N_NOTA_CREDITO",
    "TIPO_TRANSACCION", "TOTAL_CON_IVA", "EXENTO",
    "BASE_IMPONIBLE", "ALICUOTA", "IVA_DEBITO",
    "N_COMPROB_RET", "IVA_RETENIDO",
  ].join("\t");
  const lines = rows.map((r, i) => [
    String(i + 1),
    d8(r.invoice_date),
    rif(r.customer?.rif),
    (r.customer?.name ?? "").toUpperCase().slice(0, 60),
    r.invoice_number ?? "",
    r.control_number ?? "",
    "", "",
    "01-REG", // 01 factura, 02 nota débito, 03 nota crédito
    money(r.total_amount),
    money(r.exempt_amount),
    money(r.base_amount),
    Number(r.iva_rate ?? 16).toFixed(2),
    money(r.iva_amount),
    "", "0.00",
  ].join("\t"));
  return `# CONTRIBUYENTE ${rif(companyRif)}\n${header}\n${lines.join("\n")}\n`;
}

/** TXT Libro de Compras — formato SENIAT. */
export function buildPurchasesBookTxt(companyRif: string, rows: any[]): string {
  const header = [
    "OPERACION", "FECHA", "RIF_PROVEEDOR", "NOMBRE_PROVEEDOR",
    "N_FACTURA", "N_CONTROL", "N_NOTA_DEBITO", "N_NOTA_CREDITO",
    "TIPO_TRANSACCION", "TOTAL_CON_IVA", "EXENTO",
    "BASE_IMPONIBLE", "ALICUOTA", "IVA_CREDITO",
    "N_COMPROB_RET", "IVA_RETENIDO",
  ].join("\t");
  const lines = rows.map((r, i) => [
    String(i + 1),
    d8(r.invoice_date),
    rif(r.supplier?.rif),
    (r.supplier?.name ?? "").toUpperCase().slice(0, 60),
    r.invoice_number ?? "",
    r.control_number ?? "",
    "", "",
    "01-REG",
    money(r.total_amount),
    money(r.exempt_amount),
    money(r.base_amount),
    Number(r.iva_rate ?? 16).toFixed(2),
    money(r.iva_amount),
    "", "0.00",
  ].join("\t"));
  return `# CONTRIBUYENTE ${rif(companyRif)}\n${header}\n${lines.join("\n")}\n`;
}

/** XML de Retenciones de IVA — Providencia SNAT/2015/0049 (simplificado). */
export function buildIvaWithholdingsXml(companyRif: string, period: string, rows: any[]): string {
  const items = rows.map((r, i) => `
    <LineaRetencionIVA>
      <NumeroLinea>${i + 1}</NumeroLinea>
      <FechaOperacion>${d8(r.withholding_date)}</FechaOperacion>
      <NumeroComprobante>${r.receipt_number ?? ""}</NumeroComprobante>
      <RifProveedor>${rif(r.purchase?.supplier?.rif)}</RifProveedor>
      <NumeroFactura>${r.purchase?.invoice_number ?? ""}</NumeroFactura>
      <NumeroControl>${r.purchase?.control_number ?? ""}</NumeroControl>
      <BaseImponible>${money(r.base_amount)}</BaseImponible>
      <MontoIVA>${money(r.purchase?.iva_amount ?? r.base_amount)}</MontoIVA>
      <PorcentajeRetencion>${Number(r.rate).toFixed(2)}</PorcentajeRetencion>
      <MontoRetenido>${money(r.amount)}</MontoRetenido>
    </LineaRetencionIVA>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<RelacionRetencionesIVA>
  <RifAgenteRetencion>${rif(companyRif)}</RifAgenteRetencion>
  <Periodo>${period}</Periodo>
  ${items}
</RelacionRetencionesIVA>
`;
}

/** XML AR-CV Retenciones de ISLR (simplificado). */
export function buildIslrWithholdingsXml(companyRif: string, year: number, rows: any[]): string {
  const items = rows.map((r, i) => `
    <ARCV>
      <NumeroLinea>${i + 1}</NumeroLinea>
      <FechaOperacion>${d8(r.withholding_date)}</FechaOperacion>
      <NumeroComprobante>${r.receipt_number ?? ""}</NumeroComprobante>
      <RifSujetoRetenido>${rif(r.purchase?.supplier?.rif)}</RifSujetoRetenido>
      <CodigoConcepto>${r.notes ?? ""}</CodigoConcepto>
      <BaseImponible>${money(r.base_amount)}</BaseImponible>
      <PorcentajeRetencion>${Number(r.rate).toFixed(2)}</PorcentajeRetencion>
      <MontoRetenido>${money(r.amount)}</MontoRetenido>
      <Sustraendo>0.00</Sustraendo>
    </ARCV>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<RelacionRetencionesISLR>
  <RifAgenteRetencion>${rif(companyRif)}</RifAgenteRetencion>
  <Ejercicio>${year}</Ejercicio>
  ${items}
</RelacionRetencionesISLR>
`;
}
