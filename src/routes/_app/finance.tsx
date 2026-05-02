import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppLayout";
import { Btn } from "@/components/PrimaryButton";
import { Field, Select, TextInput, TextArea } from "@/components/FormField";
import { Modal, FormGrid } from "@/components/Modal";
import { fullName, money, MONTHS } from "@/lib/format";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { canManageFinance } from "@/lib/permissions";
import { Plus, Pencil, Trash2, DollarSign, Receipt, Download, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/_app/finance")({ component: FinancePage });

interface FeeType { id: string; name: string; default_amount: number; is_recurring: boolean }
interface Lookup { id: string; name: string }
interface Student {
  id: string; student_code: string; first_name: string; middle_name: string | null;
  last_name: string; class_id: string | null; program_id: string | null; enabled: boolean;
}
interface StudentFee {
  id: string; student_id: string; period_year: number; period_month: number;
  total_fee: number; discount: number; paid: number; notes: string | null;
}
interface Payment {
  id: string; student_fee_id: string; amount: number; paid_at: string; method: string | null; notes: string | null;
}
interface FeeStructure { id: string; class_id: string | null; program_id: string | null; fee_type_id: string; amount: number }

function FinancePage() {
  const { roles, user } = useAuth();
  const canEdit = canManageFinance(roles);
  const [tab, setTab] = useState<"monthly" | "types" | "structures">("monthly");

  if (!canEdit) {
    return (
      <div>
        <PageHeader title="Finance" />
        <div className="card-soft p-8 text-center text-sm text-muted-foreground">
          You do not have access to the finance module.
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Finance" description="Monthly fees, discounts, payments, and structures." />
      <div className="mb-4 flex gap-2 border-b border-border">
        {([
          ["monthly", "Monthly fees"],
          ["types", "Fee types"],
          ["structures", "Fee structures"],
        ] as const).map(([v, l]) => (
          <button key={v} onClick={() => setTab(v)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${tab === v ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {l}
          </button>
        ))}
      </div>

      {tab === "types" && <FeeTypesTab />}
      {tab === "structures" && <FeeStructuresTab />}
      {tab === "monthly" && <MonthlyTab userId={user?.id ?? null} />}
    </div>
  );
}

/* ---------------- Fee Types ---------------- */
function FeeTypesTab() {
  const [items, setItems] = useState<FeeType[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FeeType | null>(null);
  const [form, setForm] = useState({ name: "", default_amount: 0, is_recurring: true });

  const load = async () => {
    const { data } = await supabase.from("fee_types").select("*").order("name");
    setItems((data ?? []) as FeeType[]);
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm({ name: "", default_amount: 0, is_recurring: true }); setOpen(true); };
  const openEdit = (f: FeeType) => { setEditing(f); setForm({ name: f.name, default_amount: Number(f.default_amount), is_recurring: f.is_recurring }); setOpen(true); };

  const save = async () => {
    if (!form.name.trim()) return toast.error("Name required");
    const payload = { name: form.name.trim(), default_amount: form.default_amount, is_recurring: form.is_recurring };
    const { error } = editing
      ? await supabase.from("fee_types").update(payload).eq("id", editing.id)
      : await supabase.from("fee_types").insert(payload);
    if (error) toast.error(error.message);
    else { toast.success("Saved"); setOpen(false); load(); }
  };

  const del = async (f: FeeType) => {
    if (!confirm(`Delete fee type "${f.name}"?`)) return;
    const { error } = await supabase.from("fee_types").delete().eq("id", f.id);
    if (error) toast.error(error.message); else { toast.success("Deleted"); load(); }
  };

  return (
    <div className="card-soft p-4">
      <div className="mb-3 flex justify-end">
        <Btn onClick={openNew} icon={<Plus className="h-4 w-4" />}>New fee type</Btn>
      </div>
      <table className="w-full text-sm">
        <thead><tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
          <th className="px-3 py-2">Name</th><th className="px-3 py-2">Default amount</th><th className="px-3 py-2">Recurring</th><th className="px-3 py-2"></th>
        </tr></thead>
        <tbody>
          {items.length === 0 ? <tr><td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">No fee types yet</td></tr>
          : items.map((f) => (
            <tr key={f.id} className="border-b border-border/60">
              <td className="px-3 py-2 font-medium">{f.name}</td>
              <td className="px-3 py-2">{money(f.default_amount)}</td>
              <td className="px-3 py-2">{f.is_recurring ? "Yes" : "No"}</td>
              <td className="px-3 py-2 text-right">
                <Btn size="sm" variant="ghost" icon={<Pencil className="h-4 w-4" />} onClick={() => openEdit(f)}>Edit</Btn>
                <Btn size="sm" variant="ghost" icon={<Trash2 className="h-4 w-4 text-destructive" />} onClick={() => del(f)}>Delete</Btn>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Edit fee type" : "New fee type"}
        footer={<div className="flex justify-end gap-2"><Btn variant="outline" onClick={() => setOpen(false)}>Cancel</Btn><Btn onClick={save}>Save</Btn></div>}>
        <FormGrid>
          <Field label="Name" required><TextInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Default amount"><TextInput type="number" min={0} value={form.default_amount} onChange={(e) => setForm({ ...form, default_amount: Number(e.target.value) })} /></Field>
          <Field label="Recurring monthly?">
            <Select value={form.is_recurring ? "yes" : "no"} onChange={(e) => setForm({ ...form, is_recurring: e.target.value === "yes" })}>
              <option value="yes">Yes (monthly tuition, etc.)</option>
              <option value="no">No (one-time)</option>
            </Select>
          </Field>
        </FormGrid>
      </Modal>
    </div>
  );
}

/* ---------------- Fee Structures ---------------- */
function FeeStructuresTab() {
  const [items, setItems] = useState<Array<FeeStructure & { fee_name: string; class_name: string | null; program_name: string | null }>>([]);
  const [types, setTypes] = useState<FeeType[]>([]);
  const [classes, setClasses] = useState<Lookup[]>([]);
  const [programs, setPrograms] = useState<Lookup[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ class_id: "", program_id: "", fee_type_id: "", amount: 0 });

  const load = async () => {
    const [{ data: fs }, { data: ft }, { data: cl }, { data: pr }] = await Promise.all([
      supabase.from("fee_structures").select("*"),
      supabase.from("fee_types").select("*").order("name"),
      supabase.from("classes").select("id,name").order("name"),
      supabase.from("programs").select("id,name").order("name"),
    ]);
    const ftMap = new Map((ft ?? []).map((x: any) => [x.id, x.name]));
    const clMap = new Map((cl ?? []).map((x: any) => [x.id, x.name]));
    const prMap = new Map((pr ?? []).map((x: any) => [x.id, x.name]));
    setItems(((fs ?? []) as FeeStructure[]).map((f) => ({
      ...f, fee_name: ftMap.get(f.fee_type_id) ?? "?",
      class_name: f.class_id ? clMap.get(f.class_id) ?? null : null,
      program_name: f.program_id ? prMap.get(f.program_id) ?? null : null,
    })));
    setTypes((ft ?? []) as FeeType[]);
    setClasses((cl ?? []) as Lookup[]);
    setPrograms((pr ?? []) as Lookup[]);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.fee_type_id) return toast.error("Select a fee type");
    if (!form.class_id && !form.program_id) return toast.error("Select a class or program");
    const payload = {
      class_id: form.class_id || null, program_id: form.program_id || null,
      fee_type_id: form.fee_type_id, amount: form.amount,
    };
    const { error } = await supabase.from("fee_structures").insert(payload);
    if (error) toast.error(error.message);
    else { toast.success("Added"); setOpen(false); setForm({ class_id: "", program_id: "", fee_type_id: "", amount: 0 }); load(); }
  };

  const del = async (id: string) => {
    if (!confirm("Delete this fee structure entry?")) return;
    const { error } = await supabase.from("fee_structures").delete().eq("id", id);
    if (error) toast.error(error.message); else load();
  };

  return (
    <div className="card-soft p-4">
      <div className="mb-3 flex justify-end">
        <Btn onClick={() => setOpen(true)} icon={<Plus className="h-4 w-4" />}>Add structure</Btn>
      </div>
      <table className="w-full text-sm">
        <thead><tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
          <th className="px-3 py-2">Fee type</th><th className="px-3 py-2">Class</th><th className="px-3 py-2">Program</th><th className="px-3 py-2">Amount</th><th></th>
        </tr></thead>
        <tbody>
          {items.length === 0 ? <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">No structures yet</td></tr>
          : items.map((f) => (
            <tr key={f.id} className="border-b border-border/60">
              <td className="px-3 py-2 font-medium">{f.fee_name}</td>
              <td className="px-3 py-2">{f.class_name ?? "-"}</td>
              <td className="px-3 py-2">{f.program_name ?? "-"}</td>
              <td className="px-3 py-2">{money(f.amount)}</td>
              <td className="px-3 py-2 text-right"><Btn size="sm" variant="ghost" icon={<Trash2 className="h-4 w-4 text-destructive" />} onClick={() => del(f.id)}>Delete</Btn></td>
            </tr>
          ))}
        </tbody>
      </table>

      <Modal open={open} onClose={() => setOpen(false)} title="Add fee structure"
        footer={<div className="flex justify-end gap-2"><Btn variant="outline" onClick={() => setOpen(false)}>Cancel</Btn><Btn onClick={save}>Save</Btn></div>}>
        <FormGrid>
          <Field label="Fee type" required>
            <Select value={form.fee_type_id} onChange={(e) => {
              const t = types.find((x) => x.id === e.target.value);
              setForm({ ...form, fee_type_id: e.target.value, amount: t ? Number(t.default_amount) : form.amount });
            }}>
              <option value="">Select...</option>
              {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </Select>
          </Field>
          <Field label="Amount" required><TextInput type="number" min={0} value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} /></Field>
          <Field label="Class">
            <Select value={form.class_id} onChange={(e) => setForm({ ...form, class_id: e.target.value })}>
              <option value="">— any —</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          <Field label="Program">
            <Select value={form.program_id} onChange={(e) => setForm({ ...form, program_id: e.target.value })}>
              <option value="">— any —</option>
              {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </Field>
        </FormGrid>
      </Modal>
    </div>
  );
}

/* ---------------- Monthly Fees ---------------- */
function MonthlyTab({ userId }: { userId: string | null }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [classId, setClassId] = useState("");
  const [classes, setClasses] = useState<Lookup[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [feesByStudent, setFeesByStudent] = useState<Record<string, StudentFee>>({});
  const [carryByStudent, setCarryByStudent] = useState<Record<string, number>>({});
  const [structures, setStructures] = useState<FeeStructure[]>([]);
  const [feeTypes, setFeeTypes] = useState<FeeType[]>([]);
  const [generating, setGenerating] = useState(false);
  const [payOpen, setPayOpen] = useState<{ fee: StudentFee; student: Student } | null>(null);
  const [payForm, setPayForm] = useState({ amount: 0, paid_at: new Date().toISOString().slice(0, 10), method: "cash", notes: "" });
  const [editOpen, setEditOpen] = useState<{ fee: StudentFee; student: Student } | null>(null);
  const [editForm, setEditForm] = useState({ total_fee: 0, discount: 0, notes: "" });

  useEffect(() => {
    Promise.all([
      supabase.from("classes").select("id,name").order("name"),
      supabase.from("fee_structures").select("*"),
      supabase.from("fee_types").select("*"),
    ]).then(([c, fs, ft]) => {
      setClasses((c.data ?? []) as Lookup[]);
      setStructures((fs.data ?? []) as FeeStructure[]);
      setFeeTypes((ft.data ?? []) as FeeType[]);
      if (c.data?.[0] && !classId) setClassId(c.data[0].id);
    });
  }, []);

  const loadMonth = async () => {
    if (!classId) return;
    const { data: st } = await supabase.from("students").select("*")
      .eq("class_id", classId).eq("enabled", true).order("roll_number", { ascending: true, nullsFirst: false });
    const list = (st ?? []) as Student[];
    setStudents(list);
    const ids = list.map((s) => s.id);
    if (ids.length === 0) { setFeesByStudent({}); setCarryByStudent({}); return; }

    const { data: fees } = await supabase.from("student_fees").select("*")
      .in("student_id", ids).eq("period_year", year).eq("period_month", month);
    const map: Record<string, StudentFee> = {};
    (fees ?? []).forEach((f: any) => { map[f.student_id] = f; });
    setFeesByStudent(map);

    // Carry-forward = sum of (total - discount - paid) from prior periods
    const { data: prior } = await supabase.from("student_fees")
      .select("student_id,total_fee,discount,paid,period_year,period_month")
      .in("student_id", ids)
      .or(`period_year.lt.${year},and(period_year.eq.${year},period_month.lt.${month})`);
    const carry: Record<string, number> = {};
    (prior ?? []).forEach((f: any) => {
      const due = Number(f.total_fee) - Number(f.discount) - Number(f.paid);
      carry[f.student_id] = (carry[f.student_id] ?? 0) + Math.max(0, due);
    });
    setCarryByStudent(carry);
  };
  useEffect(() => { loadMonth(); }, [classId, year, month]);

  const computeDefaultFee = (s: Student) => {
    const recurring = new Set(feeTypes.filter((t) => t.is_recurring).map((t) => t.id));
    const matches = structures.filter((f) => recurring.has(f.fee_type_id) && (
      (f.class_id && f.class_id === s.class_id) || (f.program_id && f.program_id === s.program_id)
    ));
    return matches.reduce((sum, m) => sum + Number(m.amount), 0);
  };

  const generateForAll = async () => {
    if (!userId) return;
    setGenerating(true);
    try {
      const toInsert = students
        .filter((s) => !feesByStudent[s.id])
        .map((s) => ({ student_id: s.id, period_year: year, period_month: month, total_fee: computeDefaultFee(s), discount: 0, paid: 0 }));
      if (toInsert.length === 0) { toast.info("All students already have an invoice for this month"); return; }
      const { error } = await supabase.from("student_fees").insert(toInsert);
      if (error) throw error;
      toast.success(`Generated ${toInsert.length} invoices`);
      loadMonth();
    } catch (e: any) { toast.error(e.message); }
    finally { setGenerating(false); }
  };

  const openPay = (fee: StudentFee, s: Student) => {
    const due = Math.max(0, Number(fee.total_fee) - Number(fee.discount) - Number(fee.paid));
    setPayForm({ amount: due, paid_at: new Date().toISOString().slice(0, 10), method: "cash", notes: "" });
    setPayOpen({ fee, student: s });
  };

  const submitPayment = async () => {
    if (!payOpen || !userId) return;
    if (payForm.amount <= 0) return toast.error("Amount must be > 0");
    const { error: e1 } = await supabase.from("payments").insert({
      student_fee_id: payOpen.fee.id, amount: payForm.amount, paid_at: payForm.paid_at,
      method: payForm.method, notes: payForm.notes || null, recorded_by: userId,
    });
    if (e1) { toast.error(e1.message); return; }
    const newPaid = Number(payOpen.fee.paid) + Number(payForm.amount);
    const { error: e2 } = await supabase.from("student_fees").update({ paid: newPaid }).eq("id", payOpen.fee.id);
    if (e2) { toast.error(e2.message); return; }
    toast.success("Payment recorded");
    setPayOpen(null);
    loadMonth();
  };

  const openEdit = (fee: StudentFee, s: Student) => {
    setEditForm({ total_fee: Number(fee.total_fee), discount: Number(fee.discount), notes: fee.notes ?? "" });
    setEditOpen({ fee, student: s });
  };

  const submitEdit = async () => {
    if (!editOpen) return;
    const { error } = await supabase.from("student_fees").update({
      total_fee: editForm.total_fee, discount: editForm.discount, notes: editForm.notes || null,
    }).eq("id", editOpen.fee.id);
    if (error) toast.error(error.message);
    else { toast.success("Updated"); setEditOpen(null); loadMonth(); }
  };

  const totals = useMemo(() => {
    let billed = 0, discount = 0, paid = 0, due = 0, carry = 0;
    students.forEach((s) => {
      const f = feesByStudent[s.id];
      if (f) {
        billed += Number(f.total_fee); discount += Number(f.discount); paid += Number(f.paid);
        due += Math.max(0, Number(f.total_fee) - Number(f.discount) - Number(f.paid));
      }
      carry += carryByStudent[s.id] ?? 0;
    });
    return { billed, discount, paid, due, carry };
  }, [students, feesByStudent, carryByStudent]);

  const exportCsv = () => {
    const headers = ["Code", "Name", "Carry forward", "Total", "Discount", "Paid", "Due"];
    const lines = [headers.join(",")];
    students.forEach((s) => {
      const f = feesByStudent[s.id];
      const total = f ? Number(f.total_fee) : 0;
      const disc = f ? Number(f.discount) : 0;
      const paid = f ? Number(f.paid) : 0;
      const due = Math.max(0, total - disc - paid);
      lines.push([s.student_code, `"${fullName(s)}"`, carryByStudent[s.id] ?? 0, total, disc, paid, due].join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `fees-${year}-${MONTHS[month - 1]}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="card-soft p-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Field label="Class">
          <Select value={classId} onChange={(e) => setClassId(e.target.value)}>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        <Field label="Year"><TextInput type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} /></Field>
        <Field label="Month">
          <Select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </Select>
        </Field>
        <div className="flex items-end"><Btn onClick={generateForAll} loading={generating} icon={<RefreshCw className="h-4 w-4" />}>Generate invoices</Btn></div>
        <div className="flex items-end"><Btn variant="outline" onClick={exportCsv} icon={<Download className="h-4 w-4" />}>Export</Btn></div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Billed" value={money(totals.billed)} />
        <Stat label="Discount" value={money(totals.discount)} />
        <Stat label="Paid" value={money(totals.paid)} tone="success" />
        <Stat label="Due (this month)" value={money(totals.due)} tone="destructive" />
        <Stat label="Carry forward" value={money(totals.carry)} tone="warning" />
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
            <th className="px-3 py-2">Code</th><th className="px-3 py-2">Student</th>
            <th className="px-3 py-2">Carry</th><th className="px-3 py-2">Total</th>
            <th className="px-3 py-2">Discount</th><th className="px-3 py-2">Paid</th>
            <th className="px-3 py-2">Due</th><th className="px-3 py-2 text-right">Actions</th>
          </tr></thead>
          <tbody>
            {students.length === 0 ? <tr><td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">No students</td></tr>
            : students.map((s) => {
              const f = feesByStudent[s.id];
              const total = f ? Number(f.total_fee) : 0;
              const disc = f ? Number(f.discount) : 0;
              const paid = f ? Number(f.paid) : 0;
              const due = Math.max(0, total - disc - paid);
              return (
                <tr key={s.id} className="border-b border-border/60">
                  <td className="px-3 py-2 font-mono text-xs">{s.student_code}</td>
                  <td className="px-3 py-2">{fullName(s)}</td>
                  <td className="px-3 py-2 text-warning">{money(carryByStudent[s.id] ?? 0)}</td>
                  <td className="px-3 py-2">{f ? money(total) : <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-3 py-2">{f ? money(disc) : "—"}</td>
                  <td className="px-3 py-2 text-success">{f ? money(paid) : "—"}</td>
                  <td className="px-3 py-2 font-medium text-destructive">{f ? money(due) : "—"}</td>
                  <td className="px-3 py-2 text-right">
                    {f ? (
                      <>
                        <Btn size="sm" variant="ghost" icon={<Pencil className="h-4 w-4" />} onClick={() => openEdit(f, s)}>Edit</Btn>
                        <Btn size="sm" variant="primary" icon={<DollarSign className="h-4 w-4" />} onClick={() => openPay(f, s)} disabled={due === 0}>Pay</Btn>
                      </>
                    ) : (
                      <Btn size="sm" variant="outline" onClick={async () => {
                        const { error } = await supabase.from("student_fees").insert({ student_id: s.id, period_year: year, period_month: month, total_fee: computeDefaultFee(s), discount: 0, paid: 0 });
                        if (error) toast.error(error.message); else { toast.success("Invoice created"); loadMonth(); }
                      }}>Create invoice</Btn>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Payment Modal */}
      <Modal open={!!payOpen} onClose={() => setPayOpen(null)} title={payOpen ? `Record payment — ${fullName(payOpen.student)}` : ""}
        footer={<div className="flex justify-end gap-2"><Btn variant="outline" onClick={() => setPayOpen(null)}>Cancel</Btn><Btn onClick={submitPayment} icon={<Receipt className="h-4 w-4" />}>Record</Btn></div>}>
        <FormGrid>
          <Field label="Amount" required><TextInput type="number" min={1} value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: Number(e.target.value) })} /></Field>
          <Field label="Date" required><TextInput type="date" value={payForm.paid_at} onChange={(e) => setPayForm({ ...payForm, paid_at: e.target.value })} /></Field>
          <Field label="Method">
            <Select value={payForm.method} onChange={(e) => setPayForm({ ...payForm, method: e.target.value })}>
              <option value="cash">Cash</option><option value="bank">Bank transfer</option><option value="cheque">Cheque</option><option value="online">Online</option>
            </Select>
          </Field>
          <Field label="Notes"><TextArea value={payForm.notes} onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })} /></Field>
        </FormGrid>
      </Modal>

      {/* Edit invoice */}
      <Modal open={!!editOpen} onClose={() => setEditOpen(null)} title={editOpen ? `Edit invoice — ${fullName(editOpen.student)}` : ""}
        footer={<div className="flex justify-end gap-2"><Btn variant="outline" onClick={() => setEditOpen(null)}>Cancel</Btn><Btn onClick={submitEdit}>Save</Btn></div>}>
        <FormGrid>
          <Field label="Total fee"><TextInput type="number" min={0} value={editForm.total_fee} onChange={(e) => setEditForm({ ...editForm, total_fee: Number(e.target.value) })} /></Field>
          <Field label="Discount"><TextInput type="number" min={0} value={editForm.discount} onChange={(e) => setEditForm({ ...editForm, discount: Number(e.target.value) })} /></Field>
          <Field label="Notes" className="md:col-span-2"><TextArea value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} /></Field>
        </FormGrid>
      </Modal>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "success" | "destructive" | "warning" }) {
  const cls = tone === "success" ? "text-success" : tone === "destructive" ? "text-destructive" : tone === "warning" ? "text-warning" : "text-foreground";
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 text-lg font-semibold ${cls}`}>{value}</div>
    </div>
  );
}
