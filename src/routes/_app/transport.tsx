import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppLayout";
import { Btn } from "@/components/PrimaryButton";
import { Field, Select, TextInput, TextArea } from "@/components/FormField";
import { Modal, FormGrid } from "@/components/Modal";
import { fullName } from "@/lib/format";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { isSubOrAdmin } from "@/lib/permissions";
import { Plus, Pencil, Trash2, Bus, UserPlus } from "lucide-react";

export const Route = createFileRoute("/_app/transport")({ component: TransportPage });

interface Route { id: string; name: string; driver_name: string | null; driver_phone: string | null; vehicle_number: string | null; notes: string | null }
interface Student { id: string; first_name: string; middle_name: string | null; last_name: string; student_code: string }
interface Assignment { id: string; student_id: string; route_id: string; pickup_point: string | null }

function TransportPage() {
  const { roles } = useAuth();
  const canEdit = isSubOrAdmin(roles);
  const [tab, setTab] = useState<"routes" | "assignments">("routes");

  if (!canEdit) {
    return (
      <div>
        <PageHeader title="Transport" />
        <div className="card-soft p-8 text-center text-sm text-muted-foreground">No access.</div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Transport" description="Manage routes and student assignments." />
      <div className="mb-4 flex gap-2 border-b border-border">
        {([["routes", "Routes"], ["assignments", "Student assignments"]] as const).map(([v, l]) => (
          <button key={v} onClick={() => setTab(v)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${tab === v ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {l}
          </button>
        ))}
      </div>
      {tab === "routes" ? <RoutesTab /> : <AssignmentsTab />}
    </div>
  );
}

function RoutesTab() {
  const [rows, setRows] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Route | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("transport_routes").select("*").order("name");
    setRows((data as Route[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const remove = async (id: string) => {
    if (!confirm("Delete this route? Assigned students will be unassigned.")) return;
    await supabase.from("student_transport").delete().eq("route_id", id);
    const { error } = await supabase.from("transport_routes").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Btn icon={<Plus className="h-4 w-4" />} onClick={() => { setEditing(null); setOpen(true); }}>Add route</Btn>
      </div>
      <div className="card-soft overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left">Route</th>
              <th className="px-4 py-2 text-left">Vehicle</th>
              <th className="px-4 py-2 text-left">Driver</th>
              <th className="px-4 py-2 text-left">Phone</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Loading...</td></tr>
              : rows.length === 0 ? <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No routes</td></tr>
              : rows.map(r => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-4 py-2 font-medium"><div className="flex items-center gap-2"><Bus className="h-4 w-4 text-primary" />{r.name}</div></td>
                  <td className="px-4 py-2">{r.vehicle_number ?? "—"}</td>
                  <td className="px-4 py-2">{r.driver_name ?? "—"}</td>
                  <td className="px-4 py-2">{r.driver_phone ?? "—"}</td>
                  <td className="px-4 py-2">
                    <div className="flex justify-end gap-1">
                      <Btn variant="ghost" size="sm" icon={<Pencil className="h-4 w-4" />} onClick={() => { setEditing(r); setOpen(true); }} />
                      <Btn variant="ghost" size="sm" icon={<Trash2 className="h-4 w-4" />} onClick={() => remove(r.id)} />
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {open && <RouteModal editing={editing} onClose={() => setOpen(false)} onSaved={() => { setOpen(false); load(); }} />}
    </div>
  );
}

function RouteModal({ editing, onClose, onSaved }: { editing: Route | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: editing?.name ?? "",
    vehicle_number: editing?.vehicle_number ?? "",
    driver_name: editing?.driver_name ?? "",
    driver_phone: editing?.driver_phone ?? "",
    notes: editing?.notes ?? "",
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.name.trim()) return toast.error("Route name required");
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      vehicle_number: form.vehicle_number.trim() || null,
      driver_name: form.driver_name.trim() || null,
      driver_phone: form.driver_phone.trim() || null,
      notes: form.notes.trim() || null,
    };
    const { error } = editing
      ? await supabase.from("transport_routes").update(payload).eq("id", editing.id)
      : await supabase.from("transport_routes").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    onSaved();
  };

  return (
    <Modal open onClose={onClose} title={editing ? "Edit route" : "Add route"} width="lg"
      footer={<div className="flex justify-end gap-2"><Btn variant="outline" onClick={onClose}>Cancel</Btn><Btn loading={saving} onClick={save}>Save</Btn></div>}>
      <FormGrid>
        <Field label="Route name" required><TextInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="Vehicle number"><TextInput value={form.vehicle_number} onChange={(e) => setForm({ ...form, vehicle_number: e.target.value })} /></Field>
        <Field label="Driver name"><TextInput value={form.driver_name} onChange={(e) => setForm({ ...form, driver_name: e.target.value })} /></Field>
        <Field label="Driver phone"><TextInput value={form.driver_phone} onChange={(e) => setForm({ ...form, driver_phone: e.target.value })} /></Field>
        <Field label="Notes" className="md:col-span-2"><TextArea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
      </FormGrid>
    </Modal>
  );
}

function AssignmentsTab() {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [routeFilter, setRouteFilter] = useState<string>("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [{ data: r }, { data: s }, { data: a }] = await Promise.all([
      supabase.from("transport_routes").select("*").order("name"),
      supabase.from("students").select("id,first_name,middle_name,last_name,student_code").eq("enabled", true).order("first_name"),
      supabase.from("student_transport").select("*"),
    ]);
    setRoutes((r as Route[]) ?? []);
    setStudents((s as Student[]) ?? []);
    setAssignments((a as Assignment[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const studentMap = useMemo(() => new Map(students.map(s => [s.id, s])), [students]);
  const filtered = useMemo(() => routeFilter ? assignments.filter(a => a.route_id === routeFilter) : assignments, [assignments, routeFilter]);

  const remove = async (id: string) => {
    if (!confirm("Remove this assignment?")) return;
    const { error } = await supabase.from("student_transport").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  return (
    <div>
      <div className="card-soft mb-4 flex items-end gap-3 p-4">
        <Field label="Route">
          <Select value={routeFilter} onChange={(e) => setRouteFilter(e.target.value)}>
            <option value="">All routes</option>
            {routes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </Select>
        </Field>
        <div className="ml-auto">
          <Btn icon={<UserPlus className="h-4 w-4" />} onClick={() => setOpen(true)}>Assign student</Btn>
        </div>
      </div>

      <div className="card-soft overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left">Student</th>
              <th className="px-4 py-2 text-left">Code</th>
              <th className="px-4 py-2 text-left">Route</th>
              <th className="px-4 py-2 text-left">Pickup point</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Loading...</td></tr>
              : filtered.length === 0 ? <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No assignments</td></tr>
              : filtered.map(a => {
                const s = studentMap.get(a.student_id);
                const r = routes.find(x => x.id === a.route_id);
                return (
                  <tr key={a.id} className="border-t border-border">
                    <td className="px-4 py-2 font-medium">{s ? fullName(s) : "—"}</td>
                    <td className="px-4 py-2 text-muted-foreground">{s?.student_code ?? "—"}</td>
                    <td className="px-4 py-2">{r?.name ?? "—"}</td>
                    <td className="px-4 py-2">{a.pickup_point ?? "—"}</td>
                    <td className="px-4 py-2 text-right">
                      <Btn variant="ghost" size="sm" icon={<Trash2 className="h-4 w-4" />} onClick={() => remove(a.id)} />
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {open && <AssignModal routes={routes} students={students} existing={assignments}
        onClose={() => setOpen(false)} onSaved={() => { setOpen(false); load(); }} />}
    </div>
  );
}

function AssignModal({ routes, students, existing, onClose, onSaved }: {
  routes: Route[]; students: Student[]; existing: Assignment[]; onClose: () => void; onSaved: () => void;
}) {
  const assignedIds = useMemo(() => new Set(existing.map(a => a.student_id)), [existing]);
  const available = useMemo(() => students.filter(s => !assignedIds.has(s.id)), [students, assignedIds]);
  const [studentId, setStudentId] = useState("");
  const [routeId, setRouteId] = useState("");
  const [pickup, setPickup] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!studentId || !routeId) return toast.error("Select student and route");
    setSaving(true);
    const { error } = await supabase.from("student_transport").insert({
      student_id: studentId, route_id: routeId, pickup_point: pickup.trim() || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Assigned");
    onSaved();
  };

  return (
    <Modal open onClose={onClose} title="Assign student to route" width="lg"
      footer={<div className="flex justify-end gap-2"><Btn variant="outline" onClick={onClose}>Cancel</Btn><Btn loading={saving} onClick={save}>Assign</Btn></div>}>
      <FormGrid>
        <Field label="Student" required>
          <Select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
            <option value="">— Select —</option>
            {available.map(s => <option key={s.id} value={s.id}>{fullName(s)} ({s.student_code})</option>)}
          </Select>
        </Field>
        <Field label="Route" required>
          <Select value={routeId} onChange={(e) => setRouteId(e.target.value)}>
            <option value="">— Select —</option>
            {routes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </Select>
        </Field>
        <Field label="Pickup point" className="md:col-span-2"><TextInput value={pickup} onChange={(e) => setPickup(e.target.value)} /></Field>
      </FormGrid>
    </Modal>
  );
}
