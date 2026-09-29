/* eslint-disable */
import { createFileRoute, Outlet, redirect, Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { SidebarProvider, SidebarTrigger, Sidebar, SidebarContent, SidebarGroup, SidebarGroupLabel, SidebarGroupContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarHeader, SidebarFooter } from "@/components/ui/sidebar";
import { Building2, LayoutDashboard, BookOpen, ShoppingCart, Receipt, FileText, Users, LogOut, Wallet, ShieldCheck, BookMarked, ClipboardList, FileBarChart, Layers, CalendarCheck, LifeBuoy } from "lucide-react";
import { CompanyProvider, useCompany } from "@/lib/company-context";
import { CompanySwitcher } from "@/components/company-switcher";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthLayout,
});

const nav = [
  { to: "/dashboard", label: "Panel", icon: LayoutDashboard },
  { to: "/facturacion", label: "Facturación", icon: FileText },
  { to: "/compras", label: "Compras", icon: ShoppingCart },
  { to: "/retenciones", label: "Retenciones", icon: Receipt },
  { to: "/cxp", label: "Cuentas por Pagar", icon: Receipt },
  { to: "/cxc", label: "Cuentas por Cobrar", icon: Wallet },
  { to: "/libro-ventas", label: "Libro de Ventas", icon: BookOpen },
  { to: "/libro-compras", label: "Libro de Compras", icon: BookOpen },
  { to: "/clientes", label: "Clientes", icon: Users },
  { to: "/proveedores", label: "Proveedores", icon: Wallet },
] as const;

const contabilidadNav = [
  { to: "/plan-cuentas", label: "Plan de Cuentas", icon: BookMarked },
  { to: "/centros-costo", label: "Centros de Costo", icon: Layers },
  { to: "/asientos", label: "Asientos", icon: ClipboardList },
  { to: "/informes", label: "Informes", icon: FileBarChart },
  { to: "/cierres", label: "Cierres", icon: CalendarCheck },
] as const;

const adminNav = [
  { to: "/empresas", label: "Empresas", icon: Building2 },
  { to: "/equipo", label: "Usuarios", icon: ShieldCheck },
  { to: "/ayuda", label: "Ayuda", icon: LifeBuoy },
] as const;

function AppSidebar() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { activeCompany } = useCompany();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    toast.success("Sesión cerrada");
    navigate({ to: "/auth", replace: true });
  }

  return (
    <Sidebar collapsible="icon" className="bg-black border-r border-emerald-500/30 text-emerald-400 font-mono">
      <SidebarHeader className="border-b border-emerald-500/20 bg-black">
        <div className="flex items-center gap-2 px-2 py-2 text-emerald-300">
          <Building2 className="h-5 w-5 text-emerald-400 drop-shadow-[0_0_8px_rgba(0,255,102,0.4)]" />
          <span className="font-semibold group-data-[collapsible=icon]:hidden tracking-wider text-emerald-300">ContaVE</span>
        </div>
      </SidebarHeader>
      <SidebarContent className="bg-black">
        <SidebarGroup>
          <SidebarGroupLabel className="text-emerald-500/70 font-mono uppercase tracking-wider text-xs">Operaciones</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {nav.map((item) => (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton asChild isActive={path === item.to} className={`hover:bg-emerald-950/40 hover:text-emerald-300 transition-colors ${path === item.to ? "bg-emerald-950/60 text-emerald-300 border-l-2 border-emerald-500 shadow-[0_0_10px_rgba(0,255,102,0.15)]" : "text-emerald-400/80"}`}>
                    <Link to={item.to}>
                      <item.icon className="h-4 w-4 text-emerald-400" />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel className="text-emerald-500/70 font-mono uppercase tracking-wider text-xs">Contabilidad</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {contabilidadNav.map((item) => (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton asChild isActive={path.startsWith(item.to)} className={`hover:bg-emerald-950/40 hover:text-emerald-300 transition-colors ${path.startsWith(item.to) ? "bg-emerald-950/60 text-emerald-300 border-l-2 border-emerald-500 shadow-[0_0_10px_rgba(0,255,102,0.15)]" : "text-emerald-400/80"}`}>
                    <Link to={item.to}>
                      <item.icon className="h-4 w-4 text-emerald-400" />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel className="text-emerald-500/70 font-mono uppercase tracking-wider text-xs">Administración</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {adminNav.map((item) => (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton asChild isActive={path === item.to} className={`hover:bg-emerald-950/40 hover:text-emerald-300 transition-colors ${path === item.to ? "bg-emerald-950/60 text-emerald-300 border-l-2 border-emerald-500 shadow-[0_0_10px_rgba(0,255,102,0.15)]" : "text-emerald-400/80"}`}>
                    <Link to={item.to}>
                      <item.icon className="h-4 w-4 text-emerald-400" />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-emerald-500/20 bg-black p-2">
        <Button variant="ghost" size="sm" className="w-full justify-start text-emerald-400 hover:bg-red-950/40 hover:text-red-300 transition-colors" onClick={signOut}>
          <LogOut className="h-4 w-4" />
          <span className="group-data-[collapsible=icon]:hidden">Cerrar sesión</span>
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}

function AuthLayout() {
  return (
    <CompanyProvider>
      <SidebarProvider>
        <div className="min-h-screen flex w-full bg-black font-mono text-emerald-400">
          <AppSidebar />
          <div className="flex-1 flex flex-col min-w-0 bg-black">
            <header className="h-14 flex items-center justify-between gap-3 border-b border-emerald-500/30 bg-black/95 px-4 shadow-[0_4px_20px_rgba(0,255,102,0.05)]">
              <div className="flex flex-wrap items-center gap-2">
                <SidebarTrigger className="text-emerald-400 hover:bg-emerald-950/40 hover:text-emerald-300" />
                <span className="text-sm font-medium text-emerald-400/80 hidden md:inline">
                  Sistema Contable
                </span>
              </div>
              <CompanySwitcher />
            </header>
            <main className="flex-1 overflow-auto bg-black text-emerald-400">
              <Outlet />
            </main>
          </div>
        </div>
      </SidebarProvider>
    </CompanyProvider>
  );
}
