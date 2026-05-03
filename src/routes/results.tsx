import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Btn } from "@/components/PrimaryButton";
import { Field, Select, TextInput } from "@/components/FormField";
import { gradeFor, pct } from "@/lib/format";
import { GraduationCap, Search } from "lucide-react";

export const Route = createFileRoute("/results")({ component: ResultsPage });

interface Exam { id: string; name: string; term: string; kind: string; published: boolean }
interface School { name: string; logo_url: string | null }

function ResultsPage() {
  const [school, setSchool] = useState<School | null>(null);
  const [exams, setExams] = useState<Exam[]>([]);
  const [examId, setExamId] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<null | {
    student: { name: string; class: string | null; code: string };
    rows: { subject: string; max: number; marks: number | null }[];
    total: number; max: number; percent: number; grade: string;
  }>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const [{ data: s }, { data: e }] = await Promise.all([
        supabase.from("school_settings").select("name,logo_url").eq("id", 1).maybeSingle(),
        supabase.from("exams").select("*").eq("published", true).order("start_date", { ascending: false }),
      ]);
      setSchool(s as School | null);
      setExams((e as Exam[]) ?? []);
    })();
  }, []);

  const search = async () => {
    setError(""); setResult(null);
    if (!examId || !code.trim()) { setError("Select exam and enter your code"); return; }
    setLoading(true);
    try {
      const { data: stu } = await supabase.from("students").select("id,first_name,middle_name,last_name,student_code,exam_code,class_id").or(`exam_code.eq.${code.trim()},student_code.eq.${code.trim()}`).maybeSingle();
      if (!stu) { setError("Student not found"); return; }
      const { data: cls } = stu.class_id ? await supabase.from("classes").select("name").eq("id", stu.class_id).maybeSingle() : { data: null };
      const { data: subjects } = await supabase.from("exam_subjects").select("id,max_marks,subject_id,class_id").eq("exam_id", examId).eq("class_id", stu.class_id ?? "");
      const subjIds = (subjects ?? []).map(s => s.subject_id);
      const { data: subjMeta } = subjIds.length ? await supabase.from("subjects").select("id,name").in("id", subjIds) : { data: [] };
      const { data: marks } = (subjects ?? []).length ? await supabase.from("exam_marks").select("exam_subject_id,marks").eq("student_id", stu.id).in("exam_subject_id", (subjects ?? []).map(s => s.id)) : { data: [] };
      const markMap = new Map((marks ?? []).map((m: any) => [m.exam_subject_id, Number(m.marks)]));
      const subjMap = new Map((subjMeta ?? []).map((s: any) => [s.id, s.name]));
      const rows = (subjects ?? []).map((es: any) => ({
        subject: subjMap.get(es.subject_id) ?? "Subject",
        max: Number(es.max_marks),
        marks: markMap.has(es.id) ? markMap.get(es.id)! : null,
      }));
      const total = rows.reduce((s, r) => s + (r.marks ?? 0), 0);
      const max = rows.reduce((s, r) => s + r.max, 0);
      const percent = pct(total, max);
      setResult({
        student: {
          name: [stu.first_name, stu.middle_name, stu.last_name].filter(Boolean).join(" "),
          class: (cls as any)?.name ?? null,
          code: stu.exam_code ?? stu.student_code,
        },
        rows, total, max, percent, grade: gradeFor(percent),
      });
    } catch (e: any) {
      setError(e.message ?? "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-4">
          {school?.logo_url ? <img src={school.logo_url} alt="" className="h-10 w-10 rounded object-cover" />
            : <div className="flex h-10 w-10 items-center justify-center rounded bg-primary"><GraduationCap className="h-5 w-5 text-primary-foreground" /></div>}
          <div>
            <div className="text-base font-semibold">{school?.name ?? "School"}</div>
            <div className="text-xs text-muted-foreground">Exam results portal</div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl p-4 md:p-6">
        <div className="card-soft p-5">
          <h1 className="text-xl font-semibold">Check your result</h1>
          <p className="mt-1 text-sm text-muted-foreground">Select the exam and enter your exam code or student ID.</p>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            <Field label="Exam">
              <Select value={examId} onChange={(e) => setExamId(e.target.value)}>
                <option value="">— Select —</option>
                {exams.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </Select>
            </Field>
            <Field label="Exam code / Student ID">
              <TextInput value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. STU-0001" />
            </Field>
            <div className="flex items-end">
              <Btn loading={loading} onClick={search} icon={<Search className="h-4 w-4" />} className="w-full">Check result</Btn>
            </div>
          </div>
          {error && <div className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
        </div>

        {result && (
          <div className="card-soft mt-4 p-5">
            <div className="flex items-start justify-between border-b border-border pb-4">
              <div>
                <div className="text-lg font-semibold">{result.student.name}</div>
                <div className="text-sm text-muted-foreground">Code: {result.student.code} {result.student.class && `· Class: ${result.student.class}`}</div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-primary">{result.grade}</div>
                <div className="text-xs text-muted-foreground">{result.percent}% · {result.total}/{result.max}</div>
              </div>
            </div>
            <table className="mt-4 w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-2 text-left">Subject</th>
                  <th className="py-2 text-right">Marks</th>
                  <th className="py-2 text-right">Max</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((r, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="py-2">{r.subject}</td>
                    <td className="py-2 text-right font-medium">{r.marks ?? "—"}</td>
                    <td className="py-2 text-right text-muted-foreground">{r.max}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
