import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type CompanyRow = Database["public"]["Tables"]["companies"]["Row"];
type Role = Database["public"]["Enums"]["app_role"];

interface CompanyContextValue {
  companies: (CompanyRow & { role: Role })[];
  activeCompany: (CompanyRow & { role: Role }) | null;
  setActiveCompanyId: (id: string) => void;
  loading: boolean;
  refetch: () => void;
}

const CompanyContext = createContext<CompanyContextValue | null>(null);
const STORAGE_KEY = "contave.active_company";

export function CompanyProvider({ children }: { children: ReactNode }) {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    setActiveId(localStorage.getItem(STORAGE_KEY));
  }, []);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["my-companies"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return [];
      const { data: members, error } = await supabase
        .from("company_members")
        .select("role, company:companies(*)")
        .eq("user_id", userData.user.id);
      if (error) throw error;
      return (members ?? [])
        .filter((m) => m.company)
        .map((m) => ({ ...(m.company as CompanyRow), role: m.role as Role }));
    },
  });

  const companies = data ?? [];
  const activeCompany =
    companies.find((c) => c.id === activeId) ??
    companies[0] ??
    null;

  useEffect(() => {
    if (activeCompany && activeCompany.id !== activeId) {
      setActiveId(activeCompany.id);
      localStorage.setItem(STORAGE_KEY, activeCompany.id);
    }
  }, [activeCompany, activeId]);

  function setActiveCompanyId(id: string) {
    setActiveId(id);
    localStorage.setItem(STORAGE_KEY, id);
  }

  return (
    <CompanyContext.Provider value={{ companies, activeCompany, setActiveCompanyId, loading: isLoading, refetch }}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const ctx = useContext(CompanyContext);
  if (!ctx) throw new Error("useCompany must be used within CompanyProvider");
  return ctx;
}

export function canWrite(role: Role | undefined): boolean {
  return role === "admin" || role === "contador";
}
export function canInvoice(role: Role | undefined): boolean {
  return role === "admin" || role === "contador" || role === "operador";
}
export function isAdmin(role: Role | undefined): boolean {
  return role === "admin";
}
export const ROLE_LABEL: Record<Role, string> = {
  admin: "Administrador",
  contador: "Contador",
  auditor: "Auditor",
  operador: "Operador",
};
