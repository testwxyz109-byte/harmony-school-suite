import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppLayout";
import { Btn } from "@/components/PrimaryButton";
import { Field, Select, TextInput, TextArea } from "@/components/FormField";
import { Modal, FormGrid } from "@/components/Modal";
import { Plus, Pencil, Search, Trash2, Upload, ArrowUpRight } from "lucide-react";
import { fullName } from "@/lib/format";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { isSubOrAdmin } from "@/lib/permissions";

export const Route = createFileRoute("/_app/students")({
  component: StudentsPage,
});

interface Student {
  id: string; student_code: string;
  first_name: string; middle_name: string | null; last_name: string;
  date_of_birth: string | null; gender: string | null; photo_url: string | null;
  class_id: string | null; program_id: string | null; batch_id: string | null;
  academic_year_id: string | null; roll_number: number | null;
  parent_name: string | null; parent_phone: string | null;
  address: string | null; exam_code: string | null; enabled: boolean;
}
interface Lookup { id: string; name: string }

function StudentsPage() {
  const { roles } = useAuth();
  const canEdit = isSubOrAdmin(roles);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Lookup[]>([]);
  const [programs, setPrograms] = useState<Lookup[]>([]);
  const [batches, setBatches] = useState<Lookup[]>([]);
  const [years, setYears] = useState<Lookup[]>([]);
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);

  const load = async () => {
    const [s, c, p, b, y] = await Promise.all([
      supabase.from("students").select("*").order("created_at", { ascending: false }),
      supabase.from("classes").select("id,name").order("name"),
      supabase.from("programs").select("id,name").order("name"),
      supabase.from("batches").select("id,name").order("name"),
      supabase.from("academic_years").select("id,name").order("name"),
    ]);
    setStudents((s.data ?? []) as Student[]);
    setClasses((c.data ?? []) as Lookup[]);
    setPrograms((p.data ?? []) as Lookup[]);
    setBatches((b.data ?? []) as Lookup[]);
    setYears((y.data ?? []) as Lookup[]);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students.filter((s) => {
      if (classFilter && s.class_id !== classFilter) return false;
      if (!q) return true;
      const name = fullName(s).toLowerCase();
      return (
        name.includes(q) ||
        s.student_code.toLowerCase().includes(q) ||
        (s.parent_phone ?? "").includes(q) ||
        (s.exam_code ?? "").toLowerCase().includes(q)
      );
    });
  }, [students, search, classFilter]);

  const onDelete = async (s: Student) => {
    if (!canEdit) return;
    if (!confirm(`Disable ${fullName(s)}? (cannot be deleted if linked to data)`)) return;
    const { error } = await supabase.from("students").update({ enabled: !s.enabled }).eq("id", s.id);
    if (error) toast.error(error.message);
    else { toast.success(s.enabled ? "Student disabled" : "Student enabled"); load(); }
  };

  const classMap = new Map(classes.map((c) => [c.id, c.name]));

  return (
    <div>
      <PageHeader
        title="Students"
        description={`${students.length} student${students.length === 1 ? "" : "s"}`}
        action={
          canEdit && (
            <div className="flex gap-2">
              <Btn variant="outline" icon={<ArrowUpRight className="h-4 w-4" />} onClick={() => setBulkOpen(true)}>Bulk promote</Btn>
              <Btn icon={<Plus className="h-4 w-4" />} onClick={() => { setEditing(null); setOpen(true); }}>Add student</Btn>
            </div>
          )
        }
      />

      <div className="card-soft mb-4 flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <TextInput
            placeholder="Search by name, ID, parent phone, exam code"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={classFilter} onChange={(e) => setClassFilter(e.target.value)} className="sm:w-56">
          <option value="">All classes</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
      </div>

      <div className="card-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Photo</th>
                <th className="px-4 py-3 font-medium">Student ID</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Class</th>
                <th className="px-4 py-3 font-medium">Roll #</th>
                <th className="px-4 py-3 font-medium">Parent / Phone</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">No students found.</td></tr>
              )}
              {filtered.map((s) => (
                <tr key={s.id} className="border-t border-border hover:bg-muted/40">
                  <td className="px-4 py-2">
                    <div className="h-9 w-9 overflow-hidden rounded-full bg-muted">
                      {s.photo_url ? <img src={s.photo_url} alt="" className="h-full w-full object-cover" /> : null}
                    </div>
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">{s.student_code}</td>
                  <td className="px-4 py-2 font-medium">{fullName(s)}</td>
                  <td className="px-4 py-2">{classMap.get(s.class_id ?? "") ?? "—"}</td>
                  <td className="px-4 py-2">{s.roll_number ?? "—"}</td>
                  <td className="px-4 py-2">
                    <div>{s.parent_name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{s.parent_phone ?? ""}</div>
                  </td>
                  <td className="px-4 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${s.enabled ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
                      {s.enabled ? "Active" : "Disabled"}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    {canEdit && (
                      <div className="inline-flex gap-1">
                        <Btn size="sm" variant="ghost" icon={<Pencil className="h-3.5 w-3.5" />}
                          onClick={() => { setEditing(s); setOpen(true); }}>Edit</Btn>
                        <Btn size="sm" variant="ghost" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => onDelete(s)}>
                          {s.enabled ? "Disable" : "Enable"}
                        </Btn>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {open && (
        <StudentModal
          open={open}
          onClose={() => setOpen(false)}
          onSaved={() => { setOpen(false); load(); }}
          student={editing}
          classes={classes}
          programs={programs}
          batches={batches}
          years={years}
        />
      )}
      {bulkOpen && (
        <BulkPromoteModal open={bulkOpen} onClose={() => setBulkOpen(false)} classes={classes} years={years} onDone={load} />
      )}
    </div>
  );
}

function StudentModal({ open, onClose, onSaved, student, classes, programs, batches, years }: {
  open: boolean; onClose: () => void; onSaved: () => void;
  student: Student | null; classes: Lookup[]; programs: Lookup[]; batches: Lookup[]; years: Lookup[];
}) {
  const [form, setForm] = useState({
    first_name: student?.first_name ?? "",
    middle_name: student?.middle_name ?? "",
    last_name: student?.last_name ?? "",
    date_of_birth: student?.date_of_birth ?? "",
    gender: student?.gender ?? "",
    class_id: student?.class_id ?? "",
    program_id: student?.program_id ?? "",
    batch_id: student?.batch_id ?? "",
    academic_year_id: student?.academic_year_id ?? "",
    roll_number: student?.roll_number?.toString() ?? "",
    parent_name: student?.parent_name ?? "",
    parent_phone: student?.parent_phone ?? "",
    address: student?.address ?? "",
    exam_code: student?.exam_code ?? "",
    photo_url: student?.photo_url ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const upload = async (file: File) => {
    setUploading(true);
    const path = `${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("student-photos").upload(path, file, { upsert: false });
    if (error) { toast.error(error.message); setUploading(false); return; }
    const { data } = supabase.storage.from("student-photos").getPublicUrl(path);
    setForm((f) => ({ ...f, photo_url: data.publicUrl }));
    setUploading(false);
  };

  const submit = async () => {
    if (!form.first_name.trim() || !form.last_name.trim()) return toast.error("First and last name required");
    setSaving(true);
    const payload = {
      first_name: form.first_name.trim(),
      middle_name: form.middle_name.trim() || null,
      last_name: form.last_name.trim(),
      date_of_birth: form.date_of_birth || null,
      gender: form.gender || null,
      class_id: form.class_id || null,
      program_id: form.program_id || null,
      batch_id: form.batch_id || null,
      academic_year_id: form.academic_year_id || null,
      roll_number: form.roll_number ? parseInt(form.roll_number, 10) : null,
      parent_name: form.parent_name.trim() || null,
      parent_phone: form.parent_phone.trim() || null,
      address: form.address.trim() || null,
      exam_code: form.exam_code.trim() || null,
      photo_url: form.photo_url || null,
    };
    const { error } = student
      ? await supabase.from("students").update(payload).eq("id", student.id)
      : await supabase.from("students").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(student ? "Student updated" : "Student created");
    onSaved();
  };

  return (
    <Modal open={open} onClose={onClose} title={student ? "Edit student" : "Add student"} width="xl"
      footer={
        <div className="flex justify-end gap-2">
          <Btn variant="outline" onClick={onClose}>Cancel</Btn>
          <Btn onClick={submit} loading={saving}>{student ? "Update" : "Create"}</Btn>
        </div>
      }>
      <div className="mb-4 flex items-center gap-4">
        <div className="h-20 w-20 overflow-hidden rounded-full bg-muted">
          {form.photo_url && <img src={form.photo_url} alt="" className="h-full w-full object-cover" />}
        </div>
        <label className="cursor-pointer">
          <input type="file" accept="image/*" capture="environment" hidden
            onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }} />
          <span className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-background px-3 text-sm hover:bg-accent">
            <Upload className="h-4 w-4" /> {uploading ? "Uploading..." : "Upload / take photo"}
          </span>
        </label>
      </div>
      <FormGrid>
        <Field label="First name" required><TextInput value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} /></Field>
        <Field label="Middle name"><TextInput value={form.middle_name} onChange={(e) => setForm({ ...form, middle_name: e.target.value })} /></Field>
        <Field label="Last name" required><TextInput value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} /></Field>
        <Field label="Date of birth"><TextInput type="date" value={form.date_of_birth} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} /></Field>
        <Field label="Gender">
          <Select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
            <option value="">—</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option>
          </Select>
        </Field>
        <Field label="Roll number"><TextInput type="number" value={form.roll_number} onChange={(e) => setForm({ ...form, roll_number: e.target.value })} /></Field>
        <Field label="Class">
          <Select value={form.class_id} onChange={(e) => setForm({ ...form, class_id: e.target.value })}>
            <option value="">—</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        <Field label="Program">
          <Select value={form.program_id} onChange={(e) => setForm({ ...form, program_id: e.target.value })}>
            <option value="">—</option>{programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </Field>
        <Field label="Batch">
          <Select value={form.batch_id} onChange={(e) => setForm({ ...form, batch_id: e.target.value })}>
            <option value="">—</option>{batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Select>
        </Field>
        <Field label="Academic year">
          <Select value={form.academic_year_id} onChange={(e) => setForm({ ...form, academic_year_id: e.target.value })}>
            <option value="">—</option>{years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
          </Select>
        </Field>
        <Field label="Parent name"><TextInput value={form.parent_name} onChange={(e) => setForm({ ...form, parent_name: e.target.value })} /></Field>
        <Field label="Parent phone"><TextInput value={form.parent_phone} onChange={(e) => setForm({ ...form, parent_phone: e.target.value })} /></Field>
        <Field label="Exam code"><TextInput value={form.exam_code} onChange={(e) => setForm({ ...form, exam_code: e.target.value })} /></Field>
        <Field label="Address" className="md:col-span-2"><TextArea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
      </FormGrid>
    </Modal>
  );
}

function BulkPromoteModal({ open, onClose, classes, years, onDone }: {
  open: boolean; onClose: () => void; classes: Lookup[]; years: Lookup[]; onDone: () => void;
}) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [year, setYear] = useState("");
  const [busy, setBusy] = useState(false);

  const promote = async () => {
    if (!from || !to) return toast.error("Select both from and to classes");
    setBusy(true);
    const update: { class_id: string; academic_year_id?: string } = { class_id: to };
    if (year) update.academic_year_id = year;
    const { error, count } = await supabase.from("students").update(update, { count: "exact" }).eq("class_id", from);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`Promoted ${count ?? 0} students`);
    onDone(); onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Bulk promote students"
      footer={<div className="flex justify-end gap-2"><Btn variant="outline" onClick={onClose}>Cancel</Btn><Btn onClick={promote} loading={busy}>Promote</Btn></div>}>
      <FormGrid>
        <Field label="From class" required>
          <Select value={from} onChange={(e) => setFrom(e.target.value)}>
            <option value="">—</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        <Field label="To class" required>
          <Select value={to} onChange={(e) => setTo(e.target.value)}>
            <option value="">—</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        <Field label="New academic year (optional)" className="md:col-span-2">
          <Select value={year} onChange={(e) => setYear(e.target.value)}>
            <option value="">— keep current —</option>{years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
          </Select>
        </Field>
      </FormGrid>
    </Modal>
  );
}
