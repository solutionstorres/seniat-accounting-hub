import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { parseBCVRates } from "./bcv-parser";

export const getBCVRates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    try {
      const response = await fetch("https://www.bcv.org.ve/", {
        headers: { "User-Agent": "Mozilla/5.0 (ContaVE; consulta de tasas BCV)" },
        signal: AbortSignal.timeout(12000),
      });
      if (!response.ok) throw new Error("BCV no disponible");
      return { ok: true as const, rates: parseBCVRates(await response.text()) };
    } catch {
      return { ok: false as const, error: "No se pudo consultar el BCV. Ingresa las tasas verificadas manualmente." };
    }
  });