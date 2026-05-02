import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppLayout";
import { Btn } from "@/components/PrimaryButton";
import { Field, Select, TextInput } from "@/components/FormField";
import { Modal, FormGrid } from "@/components/Modal";
import { fullName, gradeFor, pct } from "@/lib/format";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { isSubOrAdmin } from "@/lib/permissions";
import { Plus, Trash2, ClipboardList, BadgeCheck, Save, Eye } from "lucide-react";

export const Route = createFileRoute("/_app/exams")({ component: ExamsPage });

type Term = "term1" | "term2";
type Kind = "mid" | "final";

interface Exam { id: string; name: string; term: Term; kind: Kind; academic_year_id: string | null; start_date: string; end_date: string; published: boolean }
interface Lookup { id: string; name: string }
interface ExamSubject { id: string; exam_id: string; class_id: string; subject_id: string; max_marks: number; exam_date: string | null; start_time: string | null; end_time: string | null }
interface Student { id: string; student_code: string; first_name: string; middle_name: string | null; last_name: string; class_id: string | null; roll_number: number | null }
interface Subject { id: string; name: string; code: string; teacher_id: string | null }

function ExamsPage() {
  const { roles, user } = useAuth();
  const canAdmin = isSubOrAdmin(roles);

  const [exams, setExams] = useState<Exam[]>([]);
  const [years, setYears] = useState<Lookup[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", term: "term1" as Term, kind: "mid" as Kind, academic_year_id: "", start_date: "", end_date: "" });
  const [selected, setSelected] = useState<Exam | null>(null);

  const load = async () => {
    const [{ data: e }, { data: y }] = await Promise.all([
      supabase.from("exams").select("*").order("start_date", { ascending: false }),
      supabase.from("academic_years").select("id,name").order("name"),
    ]);
    setExams((e ?? []) as Exam[]);
    setYears((y ?? []) as Lookup[]);
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.name || !form.start_date || !form.end_date) return toast.error("Fill all required fields");
    const { error } = await supabase.from("exams").insert({
      name: form.name, term: form.term, kind: form.kind,
      academic_year_id: form.academic_year_id || null,
      start_date: form.start_date, end_date: form.end_date,
    });
    if (error) toast.error(error.message);
    else { toast.success("Exam created"); setOpen(false); setForm({ name: "", term: "term1", kind: "mid", academic_year_id: "", start_date: "", end_date: "" }); load(); }
  };

  const togglePublish = async (ex: Exam) => {
    const { error } = await supabase.from("exams").update({ published: !ex.published }).eq("id", ex.id);
    if (error) toast.error(error.message); else { toast.success(ex.published ? "Unpublished" : "Published"); load(); }
  };

  const del = async (ex: Exam) => {
    if (!confirm(`Delete exam "${ex.name}"? This removes all schedules and marks.`)) return;
    const { error } = await supabase.from("exams").delete().eq("id", ex.id);
    if (error) toast.error(error.message); else { toast.success("Deleted"); load(); }
  };

  if (selected) {
    return <ExamDetail exam={selected} canAdmin={canAdmin} userId={user?.id ?? null} onBack={() => { setSelected(null); load(); }} />;
  }

  return (
    <div>
      <PageHeader title="Exams" description="Schedule exams, enter marks, and publish results."
        action={canAdmin && <Btn onClick={() => setOpen(true)} icon={<Plus className="h-4 w-4" />}>New exam</Btn>} />

      <div className="card-soft overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
            <th className="px-3 py-2">Name</th><th className="px-3 py-2">Term</th><th className="px-3 py-2">Type</th>
            <th className="px-3 py-2">Dates</th><th className="px-3 py-2">Status</th><th></th>
          </tr></thead>
          <tbody>
            {exams.length === 0 ? <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">No exams yet</td></tr>
            : exams.map((e) => (
              <tr key={e.id} className="border-b border-border/60">
                <td className="px-3 py-2 font-medium">{e.name}</td>
                <td className="px-3 py-2 capitalize">{e.term.replace("term", "Term ")}</td>
                <td className="px-3 py-2 capitalize">{e.kind}</td>
                <td className="px-3 py-2">{e.start_date} → {e.end_date}</td>
                <td className="px-3 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${e.published ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
                    {e.published ? "Published" : "Draft"}
                  </span>
                </td>
                <td className="px-3 py-2 text-right">
                  <Btn size="sm" variant="ghost" icon={<Eye className="h-4 w-4" />} onClick={() => setSelected(e)}>Open</Btn>
                  {canAdmin && <Btn size="sm" variant="ghost" icon={<BadgeCheck className="h-4 w-4 text-primary" />} onClick={() => togglePublish(e)}>{e.published ? "Unpublish" : "Publish"}</Btn>}
                  {canAdmin && <Btn size="sm" variant="ghost" icon={<Trash2 className="h-4 w-4 text-destructive" />} onClick={() => del(e)}>Delete</Btn>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="New exam"
        footer={<div className="flex justify-end gap-2"><Btn variant="outline" onClick={() => setOpen(false)}>Cancel</Btn><Btn onClick={create}>Create</Btn></div>}>
        <FormGrid>
          <Field label="Name" required className="md:col-span-2"><TextInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Mid-Term Exam 2026" /></Field>
          <Field label="Term" required>
            <Select value={form.term} onChange={(e) => setForm({ ...form, term: e.target.value as Term })}>
              <option value="term1">Term 1</option><option value="term2">Term 2</option>
            </Select>
          </Field>
          <Field label="Type" required>
            <Select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as Kind })}>
              <option value="mid">Mid</option><option value="final">Final</option>
            </Select>
          </Field>
          <Field label="Academic year">
            <Select value={form.academic_year_id} onChange={(e) => setForm({ ...form, academic_year_id: e.target.value })}>
              <option value="">— none —</option>
              {years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
            </Select>
          </Field>
          <div />
          <Field label="Start date" required><TextInput type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></Field>
          <Field label="End date" required><TextInput type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></Field>
        </FormGrid>
      </Modal>
    </div>
  );
}

/* ---------- Exam Detail (schedule + marks) ---------- */
function ExamDetail({ exam, canAdmin, userId, onBack }: { exam: Exam; canAdmin: boolean; userId: string | null; onBack: () => void }) {
  const [tab, setTab] = useState<"schedule" | "marks" | "results">("schedule");
  const [classes, setClasses] = useState<Lookup[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [scheds, setScheds] = useState<ExamSubject[]>([]);
  const [classId, setClassId] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ class_id: "", subject_id: "", max_marks: 100, exam_date: "", start_time: "", end_time: "" });

  const load = async () => {
    const [{ data: c }, { data: s }, { data: es }] = await Promise.all([
      supabase.from("classes").select("id,name").order("name"),
      supabase.from("subjects").select("*").order("name"),
      supabase.from("exam_subjects").select("*").eq("exam_id", exam.id),
    ]);
    setClasses((c ?? []) as Lookup[]);
    setSubjects((s ?? []) as Subject[]);
    setScheds((es ?? []) as ExamSubject[]);
    if (c?.[0] && !classId) setClassId(c[0].id);
  };
  useEffect(() => { load(); }, [exam.id]);

  const addSched = async () => {
    if (!form.class_id || !form.subject_id) return toast.error("Class and subject required");
    const { error } = await supabase.from("exam_subjects").insert({
      exam_id: exam.id, class_id: form.class_id, subject_id: form.subject_id,
      max_marks: form.max_marks,
      exam_date: form.exam_date || null, start_time: form.start_time || null, end_time: form.end_time || null,
    });
    if (error) toast.error(error.message);
    else { toast.success("Scheduled"); setOpen(false); setForm({ class_id: "", subject_id: "", max_marks: 100, exam_date: "", start_time: "", end_time: "" }); load(); }
  };

  const delSched = async (id: string) => {
    if (!confirm("Remove this scheduled subject and its marks?")) return;
    const { error } = await supabase.from("exam_subjects").delete().eq("id", id);
    if (error) toast.error(error.message); else load();
  };

  const subjectName = (id: string) => subjects.find((s) => s.id === id)?.name ?? "?";
  const className = (id: string) => classes.find((c) => c.id === id)?.name ?? "?";

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <Btn variant="outline" size="sm" onClick={onBack}>← Back</Btn>
        <div>
          <h1 className="text-xl font-semibold">{exam.name}</h1>
          <div className="text-xs text-muted-foreground">{exam.term.replace("term", "Term ")} · {exam.kind} · {exam.start_date} → {exam.end_date}</div>
        </div>
        <div className="ml-auto">
          <span className={`rounded-full px-2 py-0.5 text-xs ${exam.published ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
            {exam.published ? "Published" : "Draft"}
          </span>
        </div>
      </div>

      <div className="mb-4 flex gap-2 border-b border-border">
        {([
          ["schedule", "Schedule"],
          ["marks", "Enter marks"],
          ["results", "Results"],
        ] as const).map(([v, l]) => (
          <button key={v} onClick={() => setTab(v)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${tab === v ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>{l}</button>
        ))}
      </div>

      {tab === "schedule" && (
        <div className="card-soft p-4">
          <div className="mb-3 flex justify-end">
            {canAdmin && <Btn onClick={() => setOpen(true)} icon={<Plus className="h-4 w-4" />}>Add subject</Btn>}
          </div>
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
              <th className="px-3 py-2">Class</th><th className="px-3 py-2">Subject</th>
              <th className="px-3 py-2">Date</th><th className="px-3 py-2">Time</th>
              <th className="px-3 py-2">Max marks</th><th></th>
            </tr></thead>
            <tbody>
              {scheds.length === 0 ? <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">No subjects scheduled</td></tr>
              : scheds.map((es) => (
                <tr key={es.id} className="border-b border-border/60">
                  <td className="px-3 py-2">{className(es.class_id)}</td>
                  <td className="px-3 py-2 font-medium">{subjectName(es.subject_id)}</td>
                  <td className="px-3 py-2">{es.exam_date ?? "-"}</td>
                  <td className="px-3 py-2">{es.start_time ? `${es.start_time}${es.end_time ? " – " + es.end_time : ""}` : "-"}</td>
                  <td className="px-3 py-2">{es.max_marks}</td>
                  <td className="px-3 py-2 text-right">
                    {canAdmin && <Btn size="sm" variant="ghost" icon={<Trash2 className="h-4 w-4 text-destructive" />} onClick={() => delSched(es.id)}>Remove</Btn>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <Modal open={open} onClose={() => setOpen(false)} title="Schedule subject"
            footer={<div className="flex justify-end gap-2"><Btn variant="outline" onClick={() => setOpen(false)}>Cancel</Btn><Btn onClick={addSched}>Add</Btn></div>}>
            <FormGrid>
              <Field label="Class" required>
                <Select value={form.class_id} onChange={(e) => setForm({ ...form, class_id: e.target.value })}>
                  <option value="">Select...</option>
                  {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </Field>
              <Field label="Subject" required>
                <Select value={form.subject_id} onChange={(e) => setForm({ ...form, subject_id: e.target.value })}>
                  <option value="">Select...</option>
                  {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </Select>
              </Field>
              <Field label="Max marks" required><TextInput type="number" min={1} value={form.max_marks} onChange={(e) => setForm({ ...form, max_marks: Number(e.target.value) })} /></Field>
              <Field label="Exam date"><TextInput type="date" value={form.exam_date} onChange={(e) => setForm({ ...form, exam_date: e.target.value })} /></Field>
              <Field label="Start time"><TextInput type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} /></Field>
              <Field label="End time"><TextInput type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} /></Field>
            </FormGrid>
          </Modal>
        </div>
      )}

      {tab === "marks" && (
        <MarksEntry exam={exam} scheds={scheds} subjects={subjects} classes={classes}
          classId={classId} setClassId={setClassId} userId={userId} canAdmin={canAdmin} />
      )}

      {tab === "results" && (
        <Results exam={exam} scheds={scheds} subjects={subjects} classes={classes} classId={classId} setClassId={setClassId} />
      )}
    </div>
  );
}

function MarksEntry({ exam, scheds, subjects, classes, classId, setClassId, userId, canAdmin }: {
  exam: Exam; scheds: ExamSubject[]; subjects: Subject[]; classes: Lookup[];
  classId: string; setClassId: (s: string) => void; userId: string | null; canAdmin: boolean;
}) {
  const { user } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [examSubjectId, setExamSubjectId] = useState("");
  const [marksMap, setMarksMap] = useState<Record<string, { id?: string; marks: number | null }>>({});
  const [saving, setSaving] = useState(false);

  const classScheds = useMemo(() => scheds.filter((s) => s.class_id === classId), [scheds, classId]);
  const currentSched = classScheds.find((s) => s.id === examSubjectId);
  const currentSubject = currentSched ? subjects.find((s) => s.id === currentSched.subject_id) : null;
  const isMine = currentSubject?.teacher_id === user?.id;
  const canEdit = canAdmin || isMine;

  useEffect(() => { if (classScheds[0]) setExamSubjectId(classScheds[0].id); else setExamSubjectId(""); }, [classId, scheds]);

  const load = async () => {
    if (!classId || !examSubjectId) { setStudents([]); setMarksMap({}); return; }
    const { data: st } = await supabase.from("students").select("*").eq("class_id", classId).eq("enabled", true)
      .order("roll_number", { ascending: true, nullsFirst: false });
    const list = (st ?? []) as Student[];
    setStudents(list);
    const ids = list.map((s) => s.id);
    const { data: m } = await supabase.from("exam_marks").select("*").eq("exam_subject_id", examSubjectId).in("student_id", ids);
    const map: Record<string, { id?: string; marks: number | null }> = {};
    list.forEach((s) => { map[s.id] = { marks: null }; });
    (m ?? []).forEach((x: any) => { map[x.student_id] = { id: x.id, marks: x.marks }; });
    setMarksMap(map);
  };
  useEffect(() => { load(); }, [classId, examSubjectId]);

  const saveAll = async () => {
    if (!canEdit || !examSubjectId || !userId) return;
    setSaving(true);
    try {
      const upserts = students.map((s) => ({
        id: marksMap[s.id]?.id, student_id: s.id, exam_subject_id: examSubjectId,
        marks: marksMap[s.id]?.marks, recorded_by: userId,
      }));
      const { error } = await supabase.from("exam_marks").upsert(upserts as any, { onConflict: "id" });
      if (error) throw error;
      toast.success("Marks saved");
      load();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="card-soft p-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Field label="Class">
          <Select value={classId} onChange={(e) => setClassId(e.target.value)}>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        <Field label="Subject">
          <Select value={examSubjectId} onChange={(e) => setExamSubjectId(e.target.value)}>
            {classScheds.length === 0 && <option value="">No subjects scheduled</option>}
            {classScheds.map((s) => {
              const sub = subjects.find((x) => x.id === s.subject_id);
              return <option key={s.id} value={s.id}>{sub?.name} (max {s.max_marks})</option>;
            })}
          </Select>
        </Field>
        <div className="flex items-end">
          <Btn onClick={saveAll} loading={saving} disabled={!canEdit || !examSubjectId} icon={<Save className="h-4 w-4" />}>Save marks</Btn>
        </div>
      </div>
      {!canEdit && currentSched && (
        <div className="mt-3 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning-foreground">
          Only the assigned subject teacher or an admin can enter marks for this subject.
        </div>
      )}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
            <th className="px-3 py-2">Code</th><th className="px-3 py-2">Student</th><th className="px-3 py-2">Roll</th>
            <th className="px-3 py-2">Marks {currentSched && `(/ ${currentSched.max_marks})`}</th>
          </tr></thead>
          <tbody>
            {students.length === 0 ? <tr><td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">No students</td></tr>
            : students.map((s) => (
              <tr key={s.id} className="border-b border-border/60">
                <td className="px-3 py-2 font-mono text-xs">{s.student_code}</td>
                <td className="px-3 py-2">{fullName(s)}</td>
                <td className="px-3 py-2">{s.roll_number ?? "-"}</td>
                <td className="px-3 py-2">
                  <input type="number" disabled={!canEdit} min={0} max={currentSched?.max_marks ?? 100}
                    value={marksMap[s.id]?.marks ?? ""}
                    onChange={(e) => setMarksMap((p) => ({ ...p, [s.id]: { ...p[s.id], marks: e.target.value === "" ? null : Number(e.target.value) } }))}
                    className="h-8 w-24 rounded-md border border-input bg-background px-2 text-sm" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Results({ exam, scheds, subjects, classes, classId, setClassId }: {
  exam: Exam; scheds: ExamSubject[]; subjects: Subject[]; classes: Lookup[];
  classId: string; setClassId: (s: string) => void;
}) {
  const [students, setStudents] = useState<Student[]>([]);
  const [marks, setMarks] = useState<Record<string, Record<string, number>>>({}); // student_id -> exam_subject_id -> marks

  const classScheds = useMemo(() => scheds.filter((s) => s.class_id === classId), [scheds, classId]);

  const load = async () => {
    if (!classId) return;
    const { data: st } = await supabase.from("students").select("*").eq("class_id", classId).eq("enabled", true)
      .order("roll_number", { ascending: true, nullsFirst: false });
    const list = (st ?? []) as Student[];
    setStudents(list);
    const ids = list.map((s) => s.id);
    const esIds = classScheds.map((s) => s.id);
    if (ids.length === 0 || esIds.length === 0) { setMarks({}); return; }
    const { data: m } = await supabase.from("exam_marks").select("*").in("student_id", ids).in("exam_subject_id", esIds);
    const map: Record<string, Record<string, number>> = {};
    (m ?? []).forEach((x: any) => {
      if (!map[x.student_id]) map[x.student_id] = {};
      if (x.marks !== null) map[x.student_id][x.exam_subject_id] = Number(x.marks);
    });
    setMarks(map);
  };
  useEffect(() => { load(); }, [classId, scheds.length]);

  const totalMax = classScheds.reduce((s, x) => s + Number(x.max_marks), 0);

  const ranked = useMemo(() => {
    const rows = students.map((s) => {
      let obtained = 0; let any = false;
      classScheds.forEach((es) => {
        const m = marks[s.id]?.[es.id];
        if (m !== undefined) { obtained += m; any = true; }
      });
      const percentage = pct(obtained, totalMax);
      return { student: s, obtained, totalMax, percentage, grade: any ? gradeFor(percentage) : "—", any };
    });
    rows.sort((a, b) => b.obtained - a.obtained);
    return rows;
  }, [students, classScheds, marks, totalMax]);

  return (
    <div className="card-soft p-4">
      <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-3">
        <Field label="Class">
          <Select value={classId} onChange={(e) => setClassId(e.target.value)}>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
            <th className="px-3 py-2">Rank</th><th className="px-3 py-2">Code</th><th className="px-3 py-2">Student</th>
            {classScheds.map((es) => <th key={es.id} className="px-3 py-2">{subjects.find((s) => s.id === es.subject_id)?.name}<br /><span className="text-[10px]">/ {es.max_marks}</span></th>)}
            <th className="px-3 py-2">Total</th><th className="px-3 py-2">%</th><th className="px-3 py-2">Grade</th>
          </tr></thead>
          <tbody>
            {ranked.length === 0 ? <tr><td colSpan={6 + classScheds.length} className="px-3 py-8 text-center text-muted-foreground">No data</td></tr>
            : ranked.map((r, i) => (
              <tr key={r.student.id} className="border-b border-border/60">
                <td className="px-3 py-2 font-medium">{r.any ? i + 1 : "-"}</td>
                <td className="px-3 py-2 font-mono text-xs">{r.student.student_code}</td>
                <td className="px-3 py-2">{fullName(r.student)}</td>
                {classScheds.map((es) => <td key={es.id} className="px-3 py-2">{marks[r.student.id]?.[es.id] ?? "—"}</td>)}
                <td className="px-3 py-2 font-medium">{r.obtained} / {totalMax}</td>
                <td className="px-3 py-2">{r.any ? r.percentage + "%" : "—"}</td>
                <td className="px-3 py-2"><span className="rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-accent-foreground">{r.grade}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
