import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppLayout";
import { Btn } from "@/components/PrimaryButton";
import { Field, Select, TextInput } from "@/components/FormField";
import { Modal, FormGrid } from "@/components/Modal";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { isSubOrAdmin } from "@/lib/permissions";

export const Route = createFileRoute("/_app/academic")({
  component: AcademicPage,
});

interface Year { id: string; name: string; start_date: string; end_date: string; is_current: boolean }
interface Program { id: string; name: string; description: string | null }
interface Batch { id: string; name: string; academic_year_id: string }
interface Class { id: string; name: string; program_id: string | null }

type Tab = "years" | "programs" | "batches" | "classes";

function AcademicPage() {
  const { roles } = useAuth();
  const canEdit = isSubOrAdmin(roles);
  const [tab, setTab] = useState<Tab>("years");
  const [years, setYears] = useState<Year[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);

  const load = async () => {
    const [y, p, b, c] = await Promise.all([
      supabase.from("academic_years").select("*").order("name"),
      supabase.from("programs").select("*").order("name"),
      supabase.from("batches").select("*").order("name"),
      supabase.from("classes").select("*").order("name"),
    ]);
    setYears((y.data ?? []) as Year[]);
    setPrograms((p.data ?? []) as Program[]);
    setBatches((b.data ?? []) as Batch[]);
    setClasses((c.data ?? []) as Class[]);
  };
  useEffect(() => { load(); }, []);

  return (
    <div>
      <PageHeader title="Academic structure" description="Years, programs, batches, classes" />
      <div className="mb-4 flex gap-1 border-b border-border">
        {(["years", "programs", "batches", "classes"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {t}
          </button>
        ))}
      </div>
      {tab === "years" && <YearsTab items={years} canEdit={canEdit} reload={load} />}
      {tab === "programs" && <ProgramsTab items={programs} canEdit={canEdit} reload={load} />}
      {tab === "batches" && <BatchesTab items={batches} years={years} canEdit={canEdit} reload={load} />}
      {tab === "classes" && <ClassesTab items={classes} programs={programs} canEdit={canEdit} reload={load} />}
    </div>
  );
}

function Section<T extends { id: string }>({ title, items, canEdit, columns, onAdd, onEdit, onDelete, addLabel = "Add" }: {
  title: string; items: T[]; canEdit: boolean;
  columns: { label: string; render: (i: T) => React.ReactNode }[];
  onAdd?: () => void; onEdit?: (i: T) => void; onDelete?: (i: T) => void; addLabel?: string;
}) {
  return (
    <div className="card-soft">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="text-base font-semibold">{title}</h3>
        {canEdit && onAdd && <Btn icon={<Plus className="h-4 w-4" />} onClick={onAdd}>{addLabel}</Btn>}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>{columns.map((c) => <th key={c.label} className="px-4 py-2 font-medium">{c.label}</th>)}<th className="px-4 py-2"></th></tr>
          </thead>
          <tbody>
            {items.length === 0 && <tr><td colSpan={columns.length + 1} className="px-4 py-8 text-center text-muted-foreground">No records.</td></tr>}
            {items.map((i) => (
              <tr key={i.id} className="border-t border-border hover:bg-muted/30">
                {columns.map((c) => <td key={c.label} className="px-4 py-2">{c.render(i)}</td>)}
                <td className="px-4 py-2 text-right">
                  {canEdit && (
                    <div className="inline-flex gap-1">
                      {onEdit && <Btn size="sm" variant="ghost" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => onEdit(i)}>Edit</Btn>}
                      {onDelete && <Btn size="sm" variant="ghost" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => onDelete(i)}>Delete</Btn>}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function YearsTab({ items, canEdit, reload }: { items: Year[]; canEdit: boolean; reload: () => void }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Year | null>(null);
  const [f, setF] = useState({ name: "", start_date: "", end_date: "", is_current: false });
  const onOpen = (y: Year | null) => {
    setEditing(y);
    setF(y ? { name: y.name, start_date: y.start_date, end_date: y.end_date, is_current: y.is_current } : { name: "", start_date: "", end_date: "", is_current: false });
    setOpen(true);
  };
  const submit = async () => {
    if (!f.name || !f.start_date || !f.end_date) return toast.error("All fields required");
    const { error } = editing
      ? await supabase.from("academic_years").update(f).eq("id", editing.id)
      : await supabase.from("academic_years").insert([f]);
    if (error) return toast.error(error.message);
    toast.success("Saved"); setOpen(false); reload();
  };
  const del = async (y: Year) => {
    if (!confirm(`Delete ${y.name}?`)) return;
    const { error } = await supabase.from("academic_years").delete().eq("id", y.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted"); reload();
  };
  return (
    <>
      <Section title="Academic years" items={items} canEdit={canEdit} onAdd={() => onOpen(null)} onEdit={onOpen} onDelete={del}
        columns={[
          { label: "Name", render: (i) => i.name },
          { label: "Start", render: (i) => i.start_date },
          { label: "End", render: (i) => i.end_date },
          { label: "Current", render: (i) => i.is_current ? "Yes" : "" },
        ]} />
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Edit year" : "Add year"}
        footer={<div className="flex justify-end gap-2"><Btn variant="outline" onClick={() => setOpen(false)}>Cancel</Btn><Btn onClick={submit}>Save</Btn></div>}>
        <FormGrid>
          <Field label="Name" required><TextInput value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="2024-2025" /></Field>
          <Field label="Current">
            <Select value={f.is_current ? "1" : "0"} onChange={(e) => setF({ ...f, is_current: e.target.value === "1" })}>
              <option value="0">No</option><option value="1">Yes</option>
            </Select>
          </Field>
          <Field label="Start date" required><TextInput type="date" value={f.start_date} onChange={(e) => setF({ ...f, start_date: e.target.value })} /></Field>
          <Field label="End date" required><TextInput type="date" value={f.end_date} onChange={(e) => setF({ ...f, end_date: e.target.value })} /></Field>
        </FormGrid>
      </Modal>
    </>
  );
}

function ProgramsTab({ items, canEdit, reload }: { items: Program[]; canEdit: boolean; reload: () => void }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Program | null>(null);
  const [f, setF] = useState({ name: "", description: "" });
  const onOpen = (p: Program | null) => { setEditing(p); setF({ name: p?.name ?? "", description: p?.description ?? "" }); setOpen(true); };
  const submit = async () => {
    if (!f.name) return toast.error("Name required");
    const payload = { name: f.name, description: f.description || null };
    const { error } = editing
      ? await supabase.from("programs").update(payload).eq("id", editing.id)
      : await supabase.from("programs").insert([payload]);
    if (error) return toast.error(error.message);
    toast.success("Saved"); setOpen(false); reload();
  };
  const del = async (p: Program) => {
    if (!confirm(`Delete ${p.name}?`)) return;
    const { error } = await supabase.from("programs").delete().eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted"); reload();
  };
  return (
    <>
      <Section title="Programs" items={items} canEdit={canEdit} onAdd={() => onOpen(null)} onEdit={onOpen} onDelete={del}
        columns={[{ label: "Name", render: (i) => i.name }, { label: "Description", render: (i) => i.description ?? "" }]} />
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Edit program" : "Add program"}
        footer={<div className="flex justify-end gap-2"><Btn variant="outline" onClick={() => setOpen(false)}>Cancel</Btn><Btn onClick={submit}>Save</Btn></div>}>
        <FormGrid>
          <Field label="Name" required><TextInput value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Primary" /></Field>
          <Field label="Description"><TextInput value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        </FormGrid>
      </Modal>
    </>
  );
}

function BatchesTab({ items, years, canEdit, reload }: { items: Batch[]; years: Year[]; canEdit: boolean; reload: () => void }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Batch | null>(null);
  const [f, setF] = useState({ name: "", academic_year_id: "" });
  const onOpen = (b: Batch | null) => { setEditing(b); setF({ name: b?.name ?? "", academic_year_id: b?.academic_year_id ?? "" }); setOpen(true); };
  const submit = async () => {
    if (!f.name || !f.academic_year_id) return toast.error("All fields required");
    const { error } = editing
      ? await supabase.from("batches").update(f).eq("id", editing.id)
      : await supabase.from("batches").insert([f]);
    if (error) return toast.error(error.message);
    toast.success("Saved"); setOpen(false); reload();
  };
  const del = async (b: Batch) => {
    if (!confirm("Delete?")) return;
    const { error } = await supabase.from("batches").delete().eq("id", b.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted"); reload();
  };
  const yearMap = new Map(years.map((y) => [y.id, y.name]));
  return (
    <>
      <Section title="Batches" items={items} canEdit={canEdit} onAdd={() => onOpen(null)} onEdit={onOpen} onDelete={del}
        columns={[{ label: "Name", render: (i) => i.name }, { label: "Academic year", render: (i) => yearMap.get(i.academic_year_id) ?? "" }]} />
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Edit batch" : "Add batch"}
        footer={<div className="flex justify-end gap-2"><Btn variant="outline" onClick={() => setOpen(false)}>Cancel</Btn><Btn onClick={submit}>Save</Btn></div>}>
        <FormGrid>
          <Field label="Name" required><TextInput value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="Academic year" required>
            <Select value={f.academic_year_id} onChange={(e) => setF({ ...f, academic_year_id: e.target.value })}>
              <option value="">—</option>{years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
            </Select>
          </Field>
        </FormGrid>
      </Modal>
    </>
  );
}

function ClassesTab({ items, programs, canEdit, reload }: { items: Class[]; programs: Program[]; canEdit: boolean; reload: () => void }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Class | null>(null);
  const [f, setF] = useState({ name: "", program_id: "" });
  const onOpen = (c: Class | null) => { setEditing(c); setF({ name: c?.name ?? "", program_id: c?.program_id ?? "" }); setOpen(true); };
  const submit = async () => {
    if (!f.name) return toast.error("Name required");
    const payload = { name: f.name, program_id: f.program_id || null };
    const { error } = editing
      ? await supabase.from("classes").update(payload).eq("id", editing.id)
      : await supabase.from("classes").insert([payload]);
    if (error) {
      if (error.code === "23505") return toast.error("Class name must be unique");
      return toast.error(error.message);
    }
    toast.success("Saved"); setOpen(false); reload();
  };
  const del = async (c: Class) => {
    if (!confirm("Delete?")) return;
    const { error } = await supabase.from("classes").delete().eq("id", c.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted"); reload();
  };
  const pmap = new Map(programs.map((p) => [p.id, p.name]));
  return (
    <>
      <Section title="Classes" items={items} canEdit={canEdit} onAdd={() => onOpen(null)} onEdit={onOpen} onDelete={del}
        columns={[{ label: "Name", render: (i) => i.name }, { label: "Program", render: (i) => pmap.get(i.program_id ?? "") ?? "" }]} />
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Edit class" : "Add class"}
        footer={<div className="flex justify-end gap-2"><Btn variant="outline" onClick={() => setOpen(false)}>Cancel</Btn><Btn onClick={submit}>Save</Btn></div>}>
        <FormGrid>
          <Field label="Name" required><TextInput value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Grade 1" /></Field>
          <Field label="Program">
            <Select value={f.program_id} onChange={(e) => setF({ ...f, program_id: e.target.value })}>
              <option value="">—</option>{programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </Field>
        </FormGrid>
      </Modal>
    </>
  );
}
