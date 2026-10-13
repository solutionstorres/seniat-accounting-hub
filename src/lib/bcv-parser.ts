export function parseBCVRates(html: string) {
  const read = (id: string) => {
    const value = html.match(new RegExp(`id=["']${id}["'][\\s\\S]*?<strong[^>]*>\\s*([\\d.,]+)`, "i"))?.[1];
    const number = Number(value?.replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(number) || number <= 0) throw new Error("Tasa BCV no disponible");
    return number;
  };
  const date = html.match(/Fecha Valor:[\s\S]*?content=["'](\d{4}-\d{2}-\d{2})/i)?.[1];
  if (!date) throw new Error("Fecha BCV no disponible");
  return { usd: read("dolar"), eur: read("euro"), date, source: "https://www.bcv.org.ve/" };
}