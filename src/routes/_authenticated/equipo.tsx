import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany, isAdmin, ROLE_LABEL } from "@/lib/company-context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { UserPlus, ShieldAlert } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type Role = Database["public"]["Enums"]["app_role"];

export const Route = createFileRoute("/_authenticated/equipo")({
  component: TeamPage,
});

function TeamPage() {
  const { activeCompany } = useCompany();
  const qc = useQueryClient();
  const admin = isAdmin(activeCompany?.role);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("contador");

  const { data: members, isLoading } = useQuery({
    queryKey: ["members", activeCompany?.id],
    enabled: !!activeCompany,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_members")
        .select("id, role, user_id, created_at")
        .eq("company_id", activeCompany!.id);
      if (error) throw error;
      const ids = (data ?? []).map((m) => m.user_id);
      if (ids.length === 0) return [];
      const { data: profs } = await supabase.from("profiles").select("id, email, full_name").in("id", ids);
      const map = new Map((profs ?? []).map((p) => [p.id, p]));
      return (data ?? []).map((m) => ({ ...m, profile: map.get(m.user_id) }));
    },
  });

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    if (!activeCompany) return;
    // Find user by email in profiles
    const { data: prof, error: pErr } = await supabase.from("profiles").select("id").eq("email", email.trim().toLowerCase()).maybeSingle();
    if (pErr) { toast.error(pErr.message); return; }
    if (!prof) { toast.error("El usuario debe registrarse primero en el sistema."); return; }
    const { error } = await supabase.from("company_members").insert({
      company_id: activeCompany.id,
      user_id: prof.id,
      role,
    });
    if (error) { toast.error(error.message.includes("duplicate") ? "Ya es miembro" : error.message); return; }
    toast.success("Miembro añadido");
    setOpen(false);
    setEmail("");
    qc.invalidateQueries({ queryKey: ["members", activeCompany.id] });
  }

  async function changeRole(memberId: string, newRole: Role) {
    const { error } = await supabase.from("company_members").update({ role: newRole }).eq("id", memberId);
    if (error) { toast.error(error.message); return; }
    toast.success("Rol actualizado");
    qc.invalidateQueries({ queryKey: ["members", activeCompany!.id] });
  }

  async function remove(memberId: string) {
    if (!confirm("¿Remover este miembro?")) return;
    const { error } = await supabase.from("company_members").delete().eq("id", memberId);
    if (error) { toast.error(error.message); return; }
    toast.success("Miembro removido");
    qc.invalidateQueries({ queryKey: ["members", activeCompany!.id] });
  }

  if (!activeCompany) return <div className="p-8 text-center text-muted-foreground">Selecciona una empresa.</div>;
  if (!admin) return (
    <div className="p-8 max-w-2xl mx-auto">
      <Card><CardContent className="p-8 text-center space-y-3">
        <ShieldAlert className="h-10 w-10 mx-auto text-muted-foreground" />
        <h2 className="font-semibold">Acceso restringido</h2>
        <p className="text-sm text-muted-foreground">Solo los administradores pueden gestionar los usuarios de la empresa.</p>
      </CardContent></Card>
    </div>
  );

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Usuarios de la empresa</h1>
          <p className="text-sm text-muted-foreground">Miembros con acceso a {activeCompany.legal_name}.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="gap-2"><UserPlus className="h-4 w-4" /> Añadir miembro</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Añadir miembro</DialogTitle></DialogHeader>
            <form onSubmit={invite} className="space-y-3">
              <div><Label>Correo del usuario</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /><p className="text-xs text-muted-foreground mt-1">El usuario debe haber creado su cuenta antes.</p></div>
              <div><Label>Rol</Label>
                <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Administrador</SelectItem>
                    <SelectItem value="contador">Contador</SelectItem>
                    <SelectItem value="auditor">Auditor</SelectItem>
                    <SelectItem value="operador">Operador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter><Button type="submit">Añadir</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuario</TableHead>
                <TableHead>Correo</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Cargando...</TableCell></TableRow>}
              {(members ?? []).map((m: any) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.profile?.full_name ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{m.profile?.email ?? "—"}</TableCell>
                  <TableCell>
                    <Select value={m.role} onValueChange={(v) => changeRole(m.id, v as Role)}>
                      <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Administrador</SelectItem>
                        <SelectItem value="contador">Contador</SelectItem>
                        <SelectItem value="auditor">Auditor</SelectItem>
                        <SelectItem value="operador">Operador</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => remove(m.id)}>Remover</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 text-sm text-muted-foreground space-y-2">
          <p className="font-medium text-foreground">Permisos por rol</p>
          <ul className="space-y-1 ml-4 list-disc">
            <li><b>Administrador:</b> gestión total, usuarios, configuración, eliminación.</li>
            <li><b>Contador:</b> registro y edición de operaciones contables.</li>
            <li><b>Auditor:</b> solo lectura de libros y reportes.</li>
            <li><b>Operador:</b> emisión de facturas de venta y gestión de clientes.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
