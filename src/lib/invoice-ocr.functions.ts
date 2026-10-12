import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  image: z.string().startsWith("data:image/").max(12_000_000),
  kind: z.enum(["sales", "purchases"]),
});

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["document_type", "party_rif", "party_name", "party_address", "invoice_number", "control_number", "invoice_date", "exempt_amount", "base_amount", "iva_rate", "iva_amount", "total_amount", "affected_invoice_number"],
  properties: {
    document_type: { type: "string", enum: ["factura", "nota_credito", "nota_debito"] },
    party_rif: { type: ["string", "null"] },
    party_name: { type: ["string", "null"] },
    party_address: { type: ["string", "null"] },
    invoice_number: { type: ["string", "null"] },
    control_number: { type: ["string", "null"] },
    invoice_date: { type: ["string", "null"], description: "YYYY-MM-DD" },
    exempt_amount: { type: "number" },
    base_amount: { type: "number" },
    iva_rate: { type: "number" },
    iva_amount: { type: "number" },
    total_amount: { type: "number" },
    affected_invoice_number: { type: ["string", "null"] },
  },
};

export type OcrInvoice = {
  document_type: "factura" | "nota_credito" | "nota_debito";
  party_rif: string | null; party_name: string | null; party_address: string | null;
  invoice_number: string | null; control_number: string | null; invoice_date: string | null;
  exempt_amount: number; base_amount: number; iva_rate: number; iva_amount: number; total_amount: number;
  affected_invoice_number: string | null;
};

export const scanInvoiceImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }): Promise<{ ok: true; invoice: OcrInvoice } | { ok: false; error: string }> => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) return { ok: false, error: "Servicio de IA no configurado" };
    const who = data.kind === "purchases"
      ? "La factura es una COMPRA: el tercero (party) es el EMISOR/proveedor que aparece en el encabezado."
      : "La factura es una VENTA: el tercero (party) es el CLIENTE/receptor, no el emisor.";
    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        stream: true,
        store: false,
        reasoning: { effort: "low" },
        instructions: `Extrae datos de una factura fiscal venezolana (SENIAT). ${who} RIF con formato J-12345678-9. Montos en bolívares como números (convierte 1.234,56 a 1234.56). Usa 0 si un monto no aparece y null si un texto no aparece. Fecha en formato YYYY-MM-DD.`,
        input: [{ role: "user", content: [
          { type: "input_text", text: "Extrae los campos de esta factura." },
          { type: "input_image", image_url: data.image },
        ] }],
        text: { format: { type: "json_schema", name: "factura", strict: true, schema } },
      }),
    });
    if (!res.ok || !res.body) {
      const t = await res.text().catch(() => "");
      console.error("OCR gateway", res.status, t);
      if (res.status === 402) return { ok: false, error: "Sin créditos de IA disponibles" };
      if (res.status === 429) return { ok: false, error: "Demasiadas solicitudes, intenta en un momento" };
      return { ok: false, error: "No se pudo analizar la imagen" };
    }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "", out = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n"); buf = lines.pop() ?? "";
      for (const l of lines) {
        if (!l.startsWith("data:")) continue;
        const p = l.slice(5).trim();
        if (!p || p === "[DONE]") continue;
        try { const ev = JSON.parse(p); if (ev.type === "response.output_text.delta") out += ev.delta; } catch { /* ignore */ }
      }
    }
    try { return { ok: true, invoice: JSON.parse(out) as OcrInvoice }; }
    catch { return { ok: false, error: "La IA no devolvió datos legibles. Prueba con una foto más nítida." }; }
  });
