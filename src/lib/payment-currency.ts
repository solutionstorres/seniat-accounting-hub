export type PaymentCurrency = "VES" | "USD" | "EUR";

export function amountInBs(amount: number, currency: PaymentCurrency, rate: number): number {
  if (!Number.isFinite(amount) || amount < 0) throw new Error("Monto inválido");
  if (currency === "VES") return Math.round(amount * 100) / 100;
  if (!Number.isFinite(rate) || rate <= 0) throw new Error("Tasa inválida");
  return Math.round(amount * rate * 100) / 100;
}

export function equivalentUSD(bs: number, usdRate: number): number | null {
  return Number.isFinite(usdRate) && usdRate > 0 ? bs / usdRate : null;
}

export function appliedBalance(pendingBs: number, paymentsBs: number, ivaBs: number, islrBs: number) {
  const applied = Math.round((paymentsBs + ivaBs + islrBs) * 100) / 100;
  return { applied, remaining: Math.max(0, Math.round((pendingBs - applied) * 100) / 100) };
}