import { useState, type ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, Printer } from "lucide-react";
import { currentMonthRange, downloadCsv } from "@/lib/format";

export interface ReportShellProps {
  title: string;
  subtitle?: string;
  children: (range: { from: string; to: string }) => ReactNode;
  onExport?: () => void;
  singleDate?: boolean;
}

export function ReportShell({ title, subtitle, children, onExport, singleDate }: ReportShellProps) {
  const rng = currentMonthRange();
  const [from, setFrom] = useState(rng.from);
  const [to, setTo] = useState(rng.to);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4 print:p-0 print:max-w-full">
      <div className="flex flex-wrap items-end gap-3 justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="flex items-end gap-2">
          {!singleDate && <div><Label className="text-xs">Desde</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>}
          <div><Label className="text-xs">{singleDate ? "Al" : "Hasta"}</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          <Button variant="outline" onClick={() => window.print()} className="gap-2"><Printer className="h-4 w-4" /> Imprimir</Button>
          {onExport && <Button variant="outline" onClick={onExport} className="gap-2"><Download className="h-4 w-4" /> CSV</Button>}
        </div>
      </div>
      <div className="hidden print:block mb-4">
        <h1 className="text-xl font-bold">{title}</h1>
        <p className="text-sm">{singleDate ? `Al ${to}` : `Del ${from} al ${to}`}</p>
      </div>
      <Card className="print:border-0 print:shadow-none">
        <CardContent className="p-0">
          {children({ from, to })}
        </CardContent>
      </Card>
    </div>
  );
}

export function exportRowsCsv(name: string, rows: Record<string, any>[]) {
  if (rows.length === 0) { return; }
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(","), ...rows.map(r => headers.map(h => JSON.stringify(r[h] ?? "")).join(","))].join("\n");
  downloadCsv(name, csv);
}
