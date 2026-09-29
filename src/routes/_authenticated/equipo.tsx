/* eslint-disable */
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
    const cleaned = email.trim();
    const { data: found, error: rErr } = await supabase.rpc("find_or_create_profile_by_email", { _email: cleaned });
    if (rErr) { toast.error(rErr.message); return; }
    const prof = (found ?? [])[0];
    if (!prof) { toast.error("No existe un usuario registrado con ese correo."); return; }
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

  if (!activeCompany) return <div className="p-8 text-center text-emerald-500 font-mono bg-black min-h-screen">Selecciona una empresa.</div>;
  if (!admin) return (
    <div className="p-8 max-w-2xl mx-auto min-h-screen bg-black font-mono">
      <Card className="bg-black border border-emerald-500/30 text-emerald-400 shadow-[0_0_15px_rgba(0,255,102,0.1)]">
        <CardContent className="p-8 text-center space-y-3">
          <ShieldAlert className="h-10 w-10 mx-auto text-emerald-500" />
          <h2 className="font-semibold text-emerald-300">Acceso restringido</h2>
          <p className="text-sm text-emerald-400/80">Solo los administradores pueden gestionar los usuarios de la empresa.</p>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-4 min-h-screen bg-black text-emerald-400 font-mono">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-emerald-300 drop-shadow-[0_0_8px_rgba(0,255,102,0.4)]">Usuarios de la empresa</h1>
          <p className="text-sm text-emerald-400/80">Miembros con acceso a {activeCompany.legal_name}.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-emerald-950 text-emerald-300 border border-emerald-500/50 hover:bg-emerald-900 shadow-[0_0_10px_rgba(0,255,102,0.2)]">
              <UserPlus className="h-4 w-4" /> Añadir miembro
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-black border border-emerald-500/50 text-emerald-400 font-mono shadow-[0_0_20px_rgba(0,255,102,0.2)]">
            <DialogHeader><DialogTitle className="text-emerald-300">Añadir miembro</DialogTitle></DialogHeader>
            <form onSubmit={invite} className="space-y-3">
              <div>
                <Label className="text-emerald-300">Correo del usuario</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="bg-emerald-950/20 border-emerald-500/30 text-emerald-300" />
                <p className="text-xs text-emerald-500 mt-1">El usuario debe haber creado su cuenta antes.</p>
              </div>
              <div>
                <Label className="text-emerald-300">Rol</Label>
                <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                  <SelectTrigger className="bg-emerald-950/20 border-emerald-500/30 text-emerald-300"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-black border-emerald-500/40 text-emerald-300 font-mono">
                    <SelectItem value="admin">Administrador</SelectItem>
                    <SelectItem value="contador">Contador</SelectItem>
                    <SelectItem value="auditor">Auditor</SelectItem>
                    <SelectItem value="operador">Operador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button type="submit" className="bg-emerald-950 text-emerald-300 border border-emerald-500/50 hover:bg-emerald-900">Añadir</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="bg-black/95 border border-emerald-500/30 shadow-[0_0_15px_rgba(0,255,102,0.1)]">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-emerald-500/30 hover:bg-transparent">
                <TableHead className="text-emerald-300">Usuario</TableHead>
                <TableHead className="text-emerald-300">Correo</TableHead>
                <TableHead className="text-emerald-300">Rol</TableHead>
                <TableHead className="text-right text-emerald-300">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-emerald-500/20">
              {isLoading && (
                <TableRow><TableCell colSpan={4} className="text-center py-8 text-emerald-500">Cargando...</TableCell></TableRow>
              )}
              {(members ?? []).map((m: any) => (
                <TableRow key={m.id} className="hover:bg-emerald-900/20 border-emerald-500/20">
                  <TableCell className="font-medium text-emerald-200">{m.profile?.full_name ?? "—"}</TableCell>
                  <TableCell className="text-sm text-emerald-400/80">{m.profile?.email ?? "—"}</TableCell>
                  <TableCell>
                    <Select value={m.role} onValueChange={(v) => changeRole(m.id, v as Role)}>
                      <SelectTrigger className="w-[160px] bg-emerald-950/20 border-emerald-500/30 text-emerald-300"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-black border-emerald-500/40 text-emerald-300 font-mono">
                        <SelectItem value="admin">Administrador</SelectItem>
                        <SelectItem value="contador">Contador</SelectItem>
                        <SelectItem value="auditor">Auditor</SelectItem>
                        <SelectItem value="operador">Operador</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => remove(m.id)} className="text-red-400 hover:text-red-200 hover:bg-red-950/40">Remover</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="bg-black/95 border border-emerald-500/30 shadow-[0_0_15px_rgba(0,255,102,0.1)]">
        <CardContent className="p-4 text-sm text-emerald-400/80 space-y-2">
          <p className="font-medium text-emerald-300">Permisos por rol</p>
          <ul className="space-y-1 ml-4 list-disc text-emerald-400/80">
            <li><b className="text-emerald-300">Administrador:</b> gestión total, usuarios, configuración, eliminación.</li>
            <li><b className="text-emerald-300">Contador:</b> registro y edición de operaciones contables.</li>
            <li><b className="text-emerald-300">Auditor:</b> solo lectura de libros y reportes.</li>
            <li><b className="text-emerald-300">Operador:</b> emisión de facturas de venta y gestión de clientes.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
