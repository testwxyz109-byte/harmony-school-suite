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

export const Route = createFileRoute("/_app/subjects")({
  component: SubjectsPage,
});

interface Subject { id: string; code: string; name: string; teacher_id: string | null }
interface Profile { id: string; full_name: string; email: string }
interface ClassRow { id: string; name: string }
interface ClassSubject { id: string; class_id: string; subject_id: string }

function SubjectsPage() {
  const { roles } = useAuth();
  const canEdit = isSubOrAdmin(roles);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<Profile[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [classSubjects, setClassSubjects] = useState<ClassSubject[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Subject | null>(null);

  const load = async () => {
    const [s, p, c, cs, tr] = await Promise.all([
      supabase.from("subjects").select("*").order("code"),
      supabase.from("profiles").select("id,full_name,email").eq("enabled", true),
      supabase.from("classes").select("id,name").order("name"),
      supabase.from("class_subjects").select("*"),
      supabase.from("user_roles").select("user_id").eq("role", "teacher"),
    ]);
    setSubjects((s.data ?? []) as Subject[]);
    const teacherIds = new Set(((tr.data ?? []) as { user_id: string }[]).map((x) => x.user_id));
    setTeachers(((p.data ?? []) as Profile[]).filter((x) => teacherIds.has(x.id)));
    setClasses((c.data ?? []) as ClassRow[]);
    setClassSubjects((cs.data ?? []) as ClassSubject[]);
  };
  useEffect(() => { load(); }, []);

  const tmap = new Map(teachers.map((t) => [t.id, t.full_name || t.email]));
  const csBySubject = (subjectId: string) =>
    classSubjects.filter((x) => x.subject_id === subjectId).map((x) => classes.find((c) => c.id === x.class_id)?.name).filter(Boolean);

  const del = async (s: Subject) => {
    if (!confirm(`Delete ${s.name}?`)) return;
    const { error } = await supabase.from("subjects").delete().eq("id", s.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted"); load();
  };

  return (
    <div>
      <PageHeader title="Subjects" description="Subject catalog and class assignments"
        action={canEdit && <Btn icon={<Plus className="h-4 w-4" />} onClick={() => { setEditing(null); setOpen(true); }}>Add subject</Btn>} />
      <div className="card-soft overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="px-4 py-2 font-medium">Code</th>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Teacher</th>
              <th className="px-4 py-2 font-medium">Assigned classes</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {subjects.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No subjects.</td></tr>}
            {subjects.map((s) => (
              <tr key={s.id} className="border-t border-border hover:bg-muted/30">
                <td className="px-4 py-2 font-mono text-xs">{s.code}</td>
                <td className="px-4 py-2 font-medium">{s.name}</td>
                <td className="px-4 py-2">{tmap.get(s.teacher_id ?? "") ?? "—"}</td>
                <td className="px-4 py-2 text-xs text-muted-foreground">{csBySubject(s.id).join(", ") || "—"}</td>
                <td className="px-4 py-2 text-right">
                  {canEdit && (
                    <div className="inline-flex gap-1">
                      <Btn size="sm" variant="ghost" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => { setEditing(s); setOpen(true); }}>Edit</Btn>
                      <Btn size="sm" variant="ghost" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => del(s)}>Delete</Btn>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {open && (
        <SubjectModal open={open} onClose={() => setOpen(false)} onSaved={() => { setOpen(false); load(); }}
          subject={editing} teachers={teachers} classes={classes} classSubjects={classSubjects} />
      )}
    </div>
  );
}

function SubjectModal({ open, onClose, onSaved, subject, teachers, classes, classSubjects }: {
  open: boolean; onClose: () => void; onSaved: () => void;
  subject: Subject | null; teachers: Profile[]; classes: ClassRow[]; classSubjects: ClassSubject[];
}) {
  const [code, setCode] = useState(subject?.code ?? "");
  const [name, setName] = useState(subject?.name ?? "");
  const [teacherId, setTeacherId] = useState(subject?.teacher_id ?? "");
  const [selected, setSelected] = useState<Set<string>>(
    new Set(classSubjects.filter((x) => x.subject_id === subject?.id).map((x) => x.class_id)),
  );
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!code.trim() || !name.trim()) return toast.error("Code and name required");
    setSaving(true);
    const payload = { code: code.trim(), name: name.trim(), teacher_id: teacherId || null };
    let subjectId = subject?.id;
    if (subject) {
      const { error } = await supabase.from("subjects").update(payload).eq("id", subject.id);
      if (error) { setSaving(false); return toast.error(error.message); }
    } else {
      const { data, error } = await supabase.from("subjects").insert([payload]).select("id").single();
      if (error || !data) { setSaving(false); return toast.error(error?.message ?? "Failed"); }
      subjectId = data.id;
    }
    // sync class_subjects
    const existing = new Set(classSubjects.filter((x) => x.subject_id === subjectId).map((x) => x.class_id));
    const toAdd = [...selected].filter((c) => !existing.has(c));
    const toRemove = [...existing].filter((c) => !selected.has(c));
    if (toAdd.length) await supabase.from("class_subjects").insert(toAdd.map((c) => ({ class_id: c, subject_id: subjectId! })));
    if (toRemove.length) await supabase.from("class_subjects").delete().eq("subject_id", subjectId!).in("class_id", toRemove);
    setSaving(false);
    toast.success("Saved"); onSaved();
  };

  return (
    <Modal open={open} onClose={onClose} title={subject ? "Edit subject" : "Add subject"} width="lg"
      footer={<div className="flex justify-end gap-2"><Btn variant="outline" onClick={onClose}>Cancel</Btn><Btn onClick={submit} loading={saving}>Save</Btn></div>}>
      <FormGrid>
        <Field label="Code" required><TextInput value={code} onChange={(e) => setCode(e.target.value)} placeholder="MATH101" /></Field>
        <Field label="Name" required><TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Mathematics" /></Field>
        <Field label="Teacher" className="md:col-span-2">
          <Select value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
            <option value="">—</option>
            {teachers.map((t) => <option key={t.id} value={t.id}>{t.full_name || t.email}</option>)}
          </Select>
        </Field>
      </FormGrid>
      <div className="mt-4">
        <div className="mb-2 text-sm font-medium">Assign to classes</div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {classes.map((c) => (
            <label key={c.id} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
              <input type="checkbox" checked={selected.has(c.id)} onChange={(e) => {
                const n = new Set(selected); if (e.target.checked) n.add(c.id); else n.delete(c.id); setSelected(n);
              }} />
              {c.name}
            </label>
          ))}
        </div>
      </div>
    </Modal>
  );
}
