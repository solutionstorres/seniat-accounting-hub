import { useCompany, ROLE_LABEL } from "@/lib/company-context";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Building2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export function CompanySwitcher() {
  const { companies, activeCompany, setActiveCompanyId } = useCompany();

  if (companies.length === 0) {
    return (
      <Link to="/empresas">
        <Button size="sm" variant="outline" className="gap-2">
          <Building2 className="h-4 w-4" /> Crear empresa
        </Button>
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Select value={activeCompany?.id ?? ""} onValueChange={setActiveCompanyId}>
        <SelectTrigger className="w-[260px]">
          <Building2 className="mr-2 h-4 w-4 text-muted-foreground" />
          <SelectValue placeholder="Selecciona una empresa" />
        </SelectTrigger>
        <SelectContent>
          {companies.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              <span className="font-medium">{c.legal_name}</span>
              <span className="ml-2 text-xs text-muted-foreground">{c.rif}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {activeCompany && (
        <Badge variant="secondary" className="hidden md:inline-flex">
          {ROLE_LABEL[activeCompany.role]}
        </Badge>
      )}
    </div>
  );
}
