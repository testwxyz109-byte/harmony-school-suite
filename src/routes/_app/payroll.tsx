import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppLayout";
import { Btn } from "@/components/PrimaryButton";
import { Field, Select, TextInput, TextArea } from "@/components/FormField";
import { Modal, FormGrid } from "@/components/Modal";
import { money, MONTHS } from "@/lib/format";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { canManageFinance } from "@/lib/permissions";
import { Plus, Pencil, Trash2, DollarSign, Download, UserPlus } from "lucide-react";

export const Route = createFileRoute("/_app/payroll")({ component: PayrollPage });

interface Staff {
  id: string; full_name: string; email: string | null; role: string | null;
  phone: string | null; monthly_salary: number; active: boolean; joined_at: string | null;
  user_id: string | null; notes: string | null;
}
interface SalaryPayment {
  id: string; staff_id: string; period_year: number; period_month: number;
  amount: number; paid_at: string; is_advance: boolean; notes: string | null;
}

function PayrollPage() {
  const { roles } = useAuth();
  const canEdit = canManageFinance(roles);
  const [tab, setTab] = useState<"monthly" | "staff">("monthly");

  if (!canEdit) {
    return (
      <div>
        <PageHeader title="Payroll" />
        <div className="card-soft p-8 text-center text-sm text-muted-foreground">No access.</div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Payroll" description="Manage staff and monthly salary payments." />
      <div className="mb-4 flex gap-2 border-b border-border">
        {([["monthly", "Monthly payroll"], ["staff", "Staff"]] as const).map(([v, l]) => (
          <button key={v} onClick={() => setTab(v)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${tab === v ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {l}
          </button>
        ))}
      </div>
      {tab === "monthly" ? <MonthlyPayroll /> : <StaffTab />}
    </div>
  );
}

function MonthlyPayroll() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [payments, setPayments] = useState<SalaryPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState<Staff | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: s }, { data: p }] = await Promise.all([
      supabase.from("staff").select("*").eq("active", true).order("full_name"),
      supabase.from("salary_payments").select("*").eq("period_year", year).eq("period_month", month),
    ]);
    setStaff((s as Staff[]) ?? []);
    setPayments((p as SalaryPayment[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [year, month]);

  const paidMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of payments) m.set(p.staff_id, (m.get(p.staff_id) ?? 0) + Number(p.amount));
    return m;
  }, [payments]);

  const totalSalary = staff.reduce((s, x) => s + Number(x.monthly_salary), 0);
  const totalPaid = payments.reduce((s, p) => s + Number(p.amount), 0);

  const exportCsv = () => {
    const header = ["Staff", "Role", "Salary", "Paid", "Remaining"];
    const lines = [header.join(",")];
    for (const s of staff) {
      const paid = paidMap.get(s.id) ?? 0;
      lines.push([`"${s.full_name}"`, `"${s.role ?? ""}"`, s.monthly_salary, paid, Number(s.monthly_salary) - paid].join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `payroll-${year}-${month}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="card-soft mb-4 flex flex-wrap items-end gap-3 p-4">
        <Field label="Year"><TextInput type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-28" /></Field>
        <Field label="Month">
          <Select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </Select>
        </Field>
        <div className="ml-auto flex gap-2">
          <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs">
            <div className="text-muted-foreground">Total salary</div>
            <div className="font-semibold">{money(totalSalary)}</div>
          </div>
          <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs">
            <div className="text-muted-foreground">Paid</div>
            <div className="font-semibold text-success">{money(totalPaid)}</div>
          </div>
          <Btn variant="outline" icon={<Download className="h-4 w-4" />} onClick={exportCsv}>Export</Btn>
        </div>
      </div>

      <div className="card-soft overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left">Staff</th>
              <th className="px-4 py-2 text-left">Role</th>
              <th className="px-4 py-2 text-right">Salary</th>
              <th className="px-4 py-2 text-right">Paid</th>
              <th className="px-4 py-2 text-right">Remaining</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Loading...</td></tr>
              : staff.length === 0 ? <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No staff</td></tr>
              : staff.map(s => {
                const paid = paidMap.get(s.id) ?? 0;
                const rem = Number(s.monthly_salary) - paid;
                return (
                  <tr key={s.id} className="border-t border-border">
                    <td className="px-4 py-2 font-medium">{s.full_name}</td>
                    <td className="px-4 py-2">{s.role ?? "—"}</td>
                    <td className="px-4 py-2 text-right">{money(s.monthly_salary)}</td>
                    <td className="px-4 py-2 text-right">{money(paid)}</td>
                    <td className={`px-4 py-2 text-right font-medium ${rem > 0 ? "text-warning" : "text-success"}`}>{money(rem)}</td>
                    <td className="px-4 py-2 text-right">
                      <Btn size="sm" icon={<DollarSign className="h-4 w-4" />} onClick={() => setPaying(s)}>Pay</Btn>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {paying && <PayModal staff={paying} year={year} month={month} payments={payments.filter(p => p.staff_id === paying.id)}
        onClose={() => setPaying(null)} onSaved={() => { setPaying(null); load(); }} />}
    </div>
  );
}

function PayModal({ staff, year, month, payments, onClose, onSaved }: {
  staff: Staff; year: number; month: number; payments: SalaryPayment[]; onClose: () => void; onSaved: () => void;
}) {
  const paid = payments.reduce((s, p) => s + Number(p.amount), 0);
  const remaining = Number(staff.monthly_salary) - paid;
  const [amount, setAmount] = useState(String(remaining > 0 ? remaining : 0));
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [isAdvance, setIsAdvance] = useState(false);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!amount || Number(amount) <= 0) return toast.error("Enter a valid amount");
    setSaving(true);
    const { error } = await supabase.from("salary_payments").insert({
      staff_id: staff.id, period_year: year, period_month: month,
      amount: Number(amount), paid_at: paidAt, is_advance: isAdvance,
      notes: notes.trim() || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Payment recorded");
    onSaved();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this payment?")) return;
    const { error } = await supabase.from("salary_payments").delete().eq("id", id);
    if (error) return toast.error(error.message);
    onSaved();
  };

  return (
    <Modal open onClose={onClose} title={`Pay salary — ${staff.full_name}`} width="lg"
      footer={<div className="flex justify-end gap-2"><Btn variant="outline" onClick={onClose}>Close</Btn><Btn loading={saving} onClick={submit}>Record payment</Btn></div>}>
      <div className="mb-4 grid grid-cols-3 gap-3">
        <Stat label="Salary" value={money(staff.monthly_salary)} />
        <Stat label="Paid" value={money(paid)} tone="success" />
        <Stat label="Remaining" value={money(remaining)} tone={remaining > 0 ? "warning" : "success"} />
      </div>
      <FormGrid>
        <Field label="Amount" required><TextInput type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
        <Field label="Paid on" required><TextInput type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} /></Field>
        <Field label="Type">
          <Select value={isAdvance ? "advance" : "regular"} onChange={(e) => setIsAdvance(e.target.value === "advance")}>
            <option value="regular">Regular</option>
            <option value="advance">Advance</option>
          </Select>
        </Field>
        <Field label="Notes" className="md:col-span-2"><TextArea value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
      </FormGrid>
      {payments.length > 0 && (
        <div className="mt-5">
          <div className="mb-2 text-sm font-medium">Payments this month</div>
          <ul className="divide-y divide-border rounded-md border border-border">
            {payments.map(p => (
              <li key={p.id} className="flex items-center justify-between px-3 py-2 text-sm">
                <div>{p.paid_at} — <span className="font-medium">{money(p.amount)}</span> {p.is_advance && <span className="ml-2 rounded bg-warning/10 px-2 py-0.5 text-xs text-warning">Advance</span>}</div>
                <Btn variant="ghost" size="sm" icon={<Trash2 className="h-4 w-4" />} onClick={() => remove(p.id)} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "success" | "warning" }) {
  return (
    <div className="rounded-md border border-border bg-muted/30 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 text-lg font-semibold ${tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : ""}`}>{value}</div>
    </div>
  );
}

function StaffTab() {
  const [rows, setRows] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Staff | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("staff").select("*").order("full_name");
    setRows((data as Staff[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const remove = async (id: string) => {
    if (!confirm("Delete staff member?")) return;
    const { error } = await supabase.from("staff").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Btn icon={<UserPlus className="h-4 w-4" />} onClick={() => { setEditing(null); setOpen(true); }}>Add staff</Btn>
      </div>
      <div className="card-soft overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left">Name</th>
              <th className="px-4 py-2 text-left">Role</th>
              <th className="px-4 py-2 text-left">Phone</th>
              <th className="px-4 py-2 text-right">Salary</th>
              <th className="px-4 py-2 text-center">Active</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Loading...</td></tr>
              : rows.length === 0 ? <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No staff yet</td></tr>
              : rows.map(s => (
                <tr key={s.id} className="border-t border-border">
                  <td className="px-4 py-2 font-medium">{s.full_name}</td>
                  <td className="px-4 py-2">{s.role ?? "—"}</td>
                  <td className="px-4 py-2">{s.phone ?? "—"}</td>
                  <td className="px-4 py-2 text-right">{money(s.monthly_salary)}</td>
                  <td className="px-4 py-2 text-center">{s.active ? <span className="rounded bg-success/10 px-2 py-0.5 text-xs text-success">Yes</span> : <span className="rounded bg-muted px-2 py-0.5 text-xs">No</span>}</td>
                  <td className="px-4 py-2">
                    <div className="flex justify-end gap-1">
                      <Btn variant="ghost" size="sm" icon={<Pencil className="h-4 w-4" />} onClick={() => { setEditing(s); setOpen(true); }} />
                      <Btn variant="ghost" size="sm" icon={<Trash2 className="h-4 w-4" />} onClick={() => remove(s.id)} />
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {open && <StaffModal editing={editing} onClose={() => setOpen(false)} onSaved={() => { setOpen(false); load(); }} />}
    </div>
  );
}

function StaffModal({ editing, onClose, onSaved }: { editing: Staff | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    full_name: editing?.full_name ?? "",
    email: editing?.email ?? "",
    role: editing?.role ?? "",
    phone: editing?.phone ?? "",
    monthly_salary: String(editing?.monthly_salary ?? "0"),
    active: editing?.active ?? true,
    joined_at: editing?.joined_at ?? "",
    notes: editing?.notes ?? "",
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.full_name.trim()) return toast.error("Name required");
    setSaving(true);
    const payload = {
      full_name: form.full_name.trim(),
      email: form.email.trim() || null,
      role: form.role.trim() || null,
      phone: form.phone.trim() || null,
      monthly_salary: Number(form.monthly_salary || 0),
      active: form.active,
      joined_at: form.joined_at || null,
      notes: form.notes.trim() || null,
    };
    const { error } = editing
      ? await supabase.from("staff").update(payload).eq("id", editing.id)
      : await supabase.from("staff").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    onSaved();
  };

  return (
    <Modal open onClose={onClose} title={editing ? "Edit staff" : "Add staff"} width="xl"
      footer={<div className="flex justify-end gap-2"><Btn variant="outline" onClick={onClose}>Cancel</Btn><Btn loading={saving} onClick={save}>Save</Btn></div>}>
      <FormGrid>
        <Field label="Full name" required><TextInput value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></Field>
        <Field label="Role"><TextInput value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="Teacher, Accountant..." /></Field>
        <Field label="Email"><TextInput type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
        <Field label="Phone"><TextInput value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
        <Field label="Monthly salary" required><TextInput type="number" step="0.01" value={form.monthly_salary} onChange={(e) => setForm({ ...form, monthly_salary: e.target.value })} /></Field>
        <Field label="Joined on"><TextInput type="date" value={form.joined_at} onChange={(e) => setForm({ ...form, joined_at: e.target.value })} /></Field>
        <Field label="Status">
          <Select value={form.active ? "1" : "0"} onChange={(e) => setForm({ ...form, active: e.target.value === "1" })}>
            <option value="1">Active</option>
            <option value="0">Inactive</option>
          </Select>
        </Field>
        <Field label="Notes" className="md:col-span-2"><TextArea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
      </FormGrid>
    </Modal>
  );
}
