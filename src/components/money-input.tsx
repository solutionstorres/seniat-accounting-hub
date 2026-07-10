import { forwardRef, useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// Máscara es-VE: 1.234.567,89 (punto miles, coma decimal)
function formatMask(raw: string): string {
  if (!raw) return "";
  // Solo dígitos, coma y punto
  let s = raw.replace(/[^\d.,]/g, "");
  // Convertir: quitar puntos, cambiar coma final por punto
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  const decIdx = Math.max(lastComma, lastDot);
  let intPart = "";
  let decPart = "";
  if (decIdx >= 0 && (s.length - decIdx - 1) <= 2) {
    intPart = s.slice(0, decIdx).replace(/[.,]/g, "");
    decPart = s.slice(decIdx + 1).replace(/[.,]/g, "");
  } else {
    intPart = s.replace(/[.,]/g, "");
  }
  intPart = intPart.replace(/^0+(?=\d)/, "");
  const withThousands = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return decPart !== "" ? `${withThousands || "0"},${decPart.slice(0, 2)}` : withThousands;
}

export function parseMasked(v: string): number {
  if (!v) return 0;
  const clean = v.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(clean);
  return isNaN(n) ? 0 : n;
}

export function toMasked(n: number | string | null | undefined): string {
  if (n === null || n === undefined || n === "") return "";
  const num = typeof n === "string" ? parseFloat(n) : n;
  if (isNaN(num as number)) return "";
  return new Intl.NumberFormat("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num as number);
}

export interface MoneyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value" | "type"> {
  value: string | number;
  onValueChange: (raw: string, num: number) => void;
}

export const MoneyInput = forwardRef<HTMLInputElement, MoneyInputProps>(function MoneyInput(
  { value, onValueChange, className, ...rest }, ref
) {
  const [display, setDisplay] = useState(() => (typeof value === "number" ? toMasked(value) : formatMask(String(value ?? ""))));

  useEffect(() => {
    const incoming = typeof value === "number" ? toMasked(value) : formatMask(String(value ?? ""));
    if (parseMasked(incoming) !== parseMasked(display)) setDisplay(incoming);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <Input
      ref={ref}
      inputMode="decimal"
      className={cn("text-right tabular-nums", className)}
      value={display}
      onChange={(e) => {
        const masked = formatMask(e.target.value);
        setDisplay(masked);
        onValueChange(masked, parseMasked(masked));
      }}
      onBlur={(e) => {
        if (display) {
          const norm = toMasked(parseMasked(display));
          setDisplay(norm);
          onValueChange(norm, parseMasked(norm));
        }
        rest.onBlur?.(e);
      }}
      {...rest}
    />
  );
});
