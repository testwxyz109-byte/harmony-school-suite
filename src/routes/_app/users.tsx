import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppLayout";
import { Btn } from "@/components/PrimaryButton";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { canManageUsers } from "@/lib/permissions";
import { Check, X } from "lucide-react";
import type { AppRole } from "@/lib/permissions";

export const Route = createFileRoute("/_app/users")({ component: UsersPage });

interface UserRow { id: string; email: string; full_name: string; enabled: boolean; attendance_permitted: boolean }

function UsersPage() {
  const { roles, user } = useAuth();
  if (!canManageUsers(roles)) return <div className="card-soft p-8 text-center text-muted-foreground">Admin only.</div>;
  const [users, setUsers] = useState<UserRow[]>([]);
  const [userRoles, setUserRoles] = useState<Record<string, AppRole[]>>({});

  const load = async () => {
    const [{ data: p }, { data: r }] = await Promise.all([
      supabase.from("profiles").select("id,email,full_name,enabled,attendance_permitted"),
      supabase.from("user_roles").select("user_id,role"),
    ]);
    setUsers((p ?? []) as UserRow[]);
    const rmap: Record<string, AppRole[]> = {};
    ((r ?? []) as { user_id: string; role: AppRole }[]).forEach((x) => {
      rmap[x.user_id] = [...(rmap[x.user_id] ?? []), x.role];
    });
    setUserRoles(rmap);
  };
  useEffect(() => { load(); }, []);

  const toggleEnabled = async (u: UserRow) => {
    const { error } = await supabase.from("profiles").update({ enabled: !u.enabled }).eq("id", u.id);
    if (error) return toast.error(error.message);
    toast.success(!u.enabled ? "User approved" : "User disabled"); load();
  };
  const toggleAttendance = async (u: UserRow) => {
    const { error } = await supabase.from("profiles").update({ attendance_permitted: !u.attendance_permitted }).eq("id", u.id);
    if (error) return toast.error(error.message);
    load();
  };
  const setRole = async (u: UserRow, role: AppRole) => {
    await supabase.from("user_roles").delete().eq("user_id", u.id);
    const { error } = await supabase.from("user_roles").insert([{ user_id: u.id, role }]);
    if (error) return toast.error(error.message);
    toast.success("Role updated"); load();
  };

  return (
    <div>
      <PageHeader title="Users" description="Approve, disable, and manage user roles" />
      <div className="card-soft overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Email</th>
              <th className="px-4 py-2 font-medium">Role</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Take attendance</th>
              <th className="px-4 py-2 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const rs = userRoles[u.id] ?? [];
              return (
                <tr key={u.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-4 py-2 font-medium">{u.full_name}</td>
                  <td className="px-4 py-2">{u.email}</td>
                  <td className="px-4 py-2">
                    <select className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                      value={rs[0] ?? "teacher"} onChange={(e) => setRole(u, e.target.value as AppRole)}>
                      <option value="admin">admin</option>
                      <option value="sub_admin">sub_admin</option>
                      <option value="teacher">teacher</option>
                    </select>
                  </td>
                  <td className="px-4 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${u.enabled ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
                      {u.enabled ? "Enabled" : "Pending / Disabled"}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <button onClick={() => toggleAttendance(u)} className="inline-flex items-center gap-1 text-sm">
                      {u.attendance_permitted ? <Check className="h-4 w-4 text-success" /> : <X className="h-4 w-4 text-muted-foreground" />}
                      {u.attendance_permitted ? "Yes" : "No"}
                    </button>
                  </td>
                  <td className="px-4 py-2 text-right">
                    {u.id !== user?.id && (
                      <Btn size="sm" variant={u.enabled ? "outline" : "primary"} onClick={() => toggleEnabled(u)}>
                        {u.enabled ? "Disable" : "Approve"}
                      </Btn>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
