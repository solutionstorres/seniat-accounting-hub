import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getBCVRates } from "@/lib/bcv-rates.functions";

export function useBCVRates(enabled: boolean, frozen: boolean) {
  const [manualUSD, setTasaUSD] = useState<number | null>(null);
  const [manualEUR, setTasaEUR] = useState<number | null>(null);
  const query = useQuery({
    queryKey: ["bcv-daily-rates"],
    queryFn: () => getBCVRates(),
    enabled: enabled && !frozen,
    staleTime: 15 * 60 * 1000,
    refetchInterval: frozen ? false : 15 * 60 * 1000,
    retry: 1,
  });
  const rates = query.data?.ok ? query.data.rates : null;
  return {
    tasaUSD: manualUSD ?? rates?.usd ?? 0,
    tasaEUR: manualEUR ?? rates?.eur ?? 0,
    setTasaUSD, setTasaEUR,
    status: manualUSD !== null || manualEUR !== null ? "Tasas manuales" : rates ? `BCV · Vigencia: ${rates.date}` : query.isFetching ? "Consultando BCV…" : "BCV no disponible · Ingresa tasas verificadas",
    refresh: () => { setTasaUSD(null); setTasaEUR(null); void query.refetch(); },
    isFetching: query.isFetching,
  };
}