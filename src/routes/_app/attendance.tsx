import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppLayout";
import { Btn } from "@/components/PrimaryButton";
import { Field, Select, TextInput } from "@/components/FormField";
import { fullName, pct } from "@/lib/format";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { isSubOrAdmin } from "@/lib/permissions";
import { Save, Calendar as CalendarIcon, Download } from "lucide-react";

export const Route = createFileRoute("/_app/attendance")({ component: AttendancePage });

type Status = "present" | "absent" | "exception";
interface Student {
  id: string; student_code: string; first_name: string; middle_name: string | null;
  last_name: string; class_id: string | null; roll_number: number | null; enabled: boolean;
}
interface Lookup { id: string; name: string }
interface Row { student_id: string; shift1: Status | null; shift2: Status | null; notes: string | null; id?: string }

function AttendancePage() {
  const { user, profile, roles } = useAuth();
  const canEdit = isSubOrAdmin(roles) || (profile?.attendance_permitted ?? false);

  const [classes, setClasses] = useState<Lookup[]>([]);
  const [classId, setClassId] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [students, setStudents] = useState<Student[]>([]);
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"daily" | "report">("daily");

  // Report state
  const [reportFrom, setReportFrom] = useState(() => {
    const d = new Date(); d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [reportTo, setReportTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [report, setReport] = useState<Array<{ student: Student; present: number; absent: number; exception: number; total: number }>>([]);

  useEffect(() => {
    supabase.from("classes").select("id,name").order("name").then(({ data }) => {
      setClasses((data ?? []) as Lookup[]);
      if (data?.[0] && !classId) setClassId(data[0].id);
    });
  }, []);

  const loadDay = async () => {
    if (!classId) return;
    const { data: st } = await supabase
      .from("students").select("*").eq("class_id", classId).eq("enabled", true)
      .order("roll_number", { ascending: true, nullsFirst: false }).order("first_name");
    const list = (st ?? []) as Student[];
    setStudents(list);

    const ids = list.map((s) => s.id);
    if (ids.length === 0) { setRows({}); return; }
    const { data: att } = await supabase
      .from("attendance").select("*").eq("date", date).in("student_id", ids);

    const map: Record<string, Row> = {};
    list.forEach((s) => { map[s.id] = { student_id: s.id, shift1: null, shift2: null, notes: null }; });
    (att ?? []).forEach((a: any) => { map[a.student_id] = { student_id: a.student_id, shift1: a.shift1, shift2: a.shift2, notes: a.notes, id: a.id }; });
    setRows(map);
  };

  useEffect(() => { if (tab === "daily") loadDay(); }, [classId, date, tab]);

  const setStatus = (sid: string, shift: "shift1" | "shift2", value: Status | null) => {
    setRows((prev) => ({ ...prev, [sid]: { ...prev[sid], [shift]: value } }));
  };

  const setAll = (shift: "shift1" | "shift2", value: Status) => {
    setRows((prev) => {
      const next = { ...prev };
      students.forEach((s) => { next[s.id] = { ...next[s.id], [shift]: value }; });
      return next;
    });
  };

  const saveAll = async () => {
    if (!canEdit) { toast.error("You do not have permission to record attendance."); return; }
    if (!user) return;
    if (date > new Date().toISOString().slice(0, 10)) {
      toast.error("Cannot record attendance for a future date."); return;
    }
    setSaving(true);
    try {
      const payload = students.map((s) => {
        const r = rows[s.id];
        return {
          id: r?.id, student_id: s.id, date,
          shift1: r?.shift1, shift2: r?.shift2, notes: r?.notes,
          recorded_by: user.id,
        };
      });
      const { error } = await supabase.from("attendance").upsert(payload as any, { onConflict: "id" });
      // Fall back to per-row when no id
      if (error) throw error;

      // For rows without id, do an upsert by (student_id, date) via delete+insert pattern
      // But we used id-based upsert; rows without id will be inserted (id auto). Reload.
      toast.success("Attendance saved");
      loadDay();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to save");
    } finally { setSaving(false); }
  };

  // Reports
  const loadReport = async () => {
    if (!classId) return;
    const { data: st } = await supabase
      .from("students").select("*").eq("class_id", classId).eq("enabled", true)
      .order("roll_number", { ascending: true, nullsFirst: false });
    const list = (st ?? []) as Student[];
    const ids = list.map((s) => s.id);
    if (ids.length === 0) { setReport([]); return; }
    const { data: att } = await supabase
      .from("attendance").select("student_id,shift1,shift2")
      .in("student_id", ids).gte("date", reportFrom).lte("date", reportTo);

    const agg: Record<string, { present: number; absent: number; exception: number; total: number }> = {};
    list.forEach((s) => { agg[s.id] = { present: 0, absent: 0, exception: 0, total: 0 }; });
    (att ?? []).forEach((a: any) => {
      [a.shift1, a.shift2].forEach((v) => {
        if (!v) return;
        agg[a.student_id].total += 1;
        if (v === "present") agg[a.student_id].present += 1;
        else if (v === "absent") agg[a.student_id].absent += 1;
        else if (v === "exception") agg[a.student_id].exception += 1;
      });
    });
    setReport(list.map((s) => ({ student: s, ...agg[s.id] })));
  };

  useEffect(() => { if (tab === "report") loadReport(); }, [tab, classId, reportFrom, reportTo]);

  const exportCsv = () => {
    const headers = ["Code", "Name", "Roll", "Present", "Absent", "Exception", "Total", "Attendance %"];
    const lines = [headers.join(",")];
    report.forEach((r) => {
      lines.push([
        r.student.student_code, `"${fullName(r.student)}"`, r.student.roll_number ?? "",
        r.present, r.absent, r.exception, r.total, pct(r.present, r.total) + "%",
      ].join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `attendance-${reportFrom}-to-${reportTo}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <PageHeader title="Attendance" description="Mark daily attendance with two shifts and view reports." />

      <div className="mb-4 flex gap-2 border-b border-border">
        {(["daily", "report"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium capitalize ${tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {t === "daily" ? "Daily marking" : "Reports"}
          </button>
        ))}
      </div>

      {tab === "daily" && (
        <div className="card-soft p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Field label="Class">
              <Select value={classId} onChange={(e) => setClassId(e.target.value)}>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </Field>
            <Field label="Date">
              <TextInput type="date" value={date} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <div className="flex items-end">
              <Btn onClick={saveAll} loading={saving} disabled={!canEdit || students.length === 0} icon={<Save className="h-4 w-4" />}>Save attendance</Btn>
            </div>
          </div>

          {!canEdit && (
            <div className="mt-3 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning-foreground">
              You can view attendance but cannot record it. Ask an admin to enable the attendance permission.
            </div>
          )}

          {students.length === 0 ? (
            <div className="mt-6 rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              No students in this class.
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                    <th className="px-3 py-2">Code</th>
                    <th className="px-3 py-2">Student</th>
                    <th className="px-3 py-2">Roll</th>
                    <th className="px-3 py-2">
                      Shift 1
                      <span className="ml-2 text-[10px] normal-case text-muted-foreground">
                        <button className="underline" onClick={() => setAll("shift1", "present")}>all P</button>
                      </span>
                    </th>
                    <th className="px-3 py-2">
                      Shift 2
                      <span className="ml-2 text-[10px] normal-case text-muted-foreground">
                        <button className="underline" onClick={() => setAll("shift2", "present")}>all P</button>
                      </span>
                    </th>
                    <th className="px-3 py-2">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s) => {
                    const r = rows[s.id];
                    return (
                      <tr key={s.id} className="border-b border-border/60">
                        <td className="px-3 py-2 font-mono text-xs">{s.student_code}</td>
                        <td className="px-3 py-2">{fullName(s)}</td>
                        <td className="px-3 py-2">{s.roll_number ?? "-"}</td>
                        <td className="px-3 py-2"><StatusPicker disabled={!canEdit} value={r?.shift1 ?? null} onChange={(v) => setStatus(s.id, "shift1", v)} /></td>
                        <td className="px-3 py-2"><StatusPicker disabled={!canEdit} value={r?.shift2 ?? null} onChange={(v) => setStatus(s.id, "shift2", v)} /></td>
                        <td className="px-3 py-2">
                          <input
                            disabled={!canEdit}
                            value={r?.notes ?? ""}
                            onChange={(e) => setRows((p) => ({ ...p, [s.id]: { ...p[s.id], notes: e.target.value } }))}
                            placeholder="optional"
                            className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "report" && (
        <div className="card-soft p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <Field label="Class">
              <Select value={classId} onChange={(e) => setClassId(e.target.value)}>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </Field>
            <Field label="From"><TextInput type="date" value={reportFrom} onChange={(e) => setReportFrom(e.target.value)} /></Field>
            <Field label="To"><TextInput type="date" value={reportTo} onChange={(e) => setReportTo(e.target.value)} /></Field>
            <div className="flex items-end">
              <Btn variant="outline" onClick={exportCsv} icon={<Download className="h-4 w-4" />} disabled={report.length === 0}>Export CSV</Btn>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                  <th className="px-3 py-2">Code</th>
                  <th className="px-3 py-2">Student</th>
                  <th className="px-3 py-2">Present</th>
                  <th className="px-3 py-2">Absent</th>
                  <th className="px-3 py-2">Exception</th>
                  <th className="px-3 py-2">Total marks</th>
                  <th className="px-3 py-2">Attendance %</th>
                </tr>
              </thead>
              <tbody>
                {report.length === 0 ? (
                  <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">No data</td></tr>
                ) : report.map((r) => (
                  <tr key={r.student.id} className="border-b border-border/60">
                    <td className="px-3 py-2 font-mono text-xs">{r.student.student_code}</td>
                    <td className="px-3 py-2">{fullName(r.student)}</td>
                    <td className="px-3 py-2 text-success">{r.present}</td>
                    <td className="px-3 py-2 text-destructive">{r.absent}</td>
                    <td className="px-3 py-2 text-warning">{r.exception}</td>
                    <td className="px-3 py-2">{r.total}</td>
                    <td className="px-3 py-2 font-medium">{pct(r.present, r.total)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusPicker({ value, onChange, disabled }: { value: Status | null; onChange: (v: Status | null) => void; disabled?: boolean }) {
  const opts: Array<{ v: Status; label: string; cls: string }> = [
    { v: "present", label: "P", cls: "bg-success text-success-foreground" },
    { v: "absent", label: "A", cls: "bg-destructive text-destructive-foreground" },
    { v: "exception", label: "E", cls: "bg-warning text-warning-foreground" },
  ];
  return (
    <div className="flex gap-1">
      {opts.map((o) => (
        <button key={o.v} type="button" disabled={disabled}
          onClick={() => onChange(value === o.v ? null : o.v)}
          className={`h-7 w-7 rounded text-xs font-bold transition-opacity ${value === o.v ? o.cls : "border border-border bg-background text-muted-foreground hover:bg-accent"} disabled:cursor-not-allowed disabled:opacity-50`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
