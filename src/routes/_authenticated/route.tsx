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
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-2 text-sidebar-foreground">
          <Building2 className="h-5 w-5" style={{ color: "var(--warning)" }} />
          <span className="font-semibold group-data-[collapsible=icon]:hidden">ContaVE</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Operaciones</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {nav.map((item) => (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton asChild isActive={path === item.to}>
                    <Link to={item.to}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Contabilidad</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {contabilidadNav.map((item) => (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton asChild isActive={path.startsWith(item.to)}>
                    <Link to={item.to}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Administración</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {adminNav.map((item) => (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton asChild isActive={path === item.to}>
                    <Link to={item.to}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <Button variant="ghost" size="sm" className="justify-start text-sidebar-foreground hover:bg-sidebar-accent" onClick={signOut}>
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
        <div className="min-h-screen flex w-full">
          <AppSidebar />
          <div className="flex-1 flex flex-col min-w-0">
            <header className="h-14 flex items-center justify-between gap-3 border-b bg-card px-4">
              <div className="flex items-center gap-2">
                <SidebarTrigger />
                <span className="text-sm font-medium text-muted-foreground hidden md:inline">
                  Sistema Contable SENIAT
                </span>
              </div>
              <CompanySwitcher />
            </header>
            <main className="flex-1 overflow-auto bg-background">
              <Outlet />
            </main>
          </div>
        </div>
      </SidebarProvider>
    </CompanyProvider>
  );
}
