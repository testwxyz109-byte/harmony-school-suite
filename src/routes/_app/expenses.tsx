import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppLayout";
import { Btn } from "@/components/PrimaryButton";
import { Field, Select, TextInput, TextArea } from "@/components/FormField";
import { Modal, FormGrid } from "@/components/Modal";
import { money } from "@/lib/format";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { canManageFinance } from "@/lib/permissions";
import { Plus, Pencil, Trash2, Download, Tags } from "lucide-react";

export const Route = createFileRoute("/_app/expenses")({ component: ExpensesPage });

interface Category { id: string; name: string }
interface Expense {
  id: string; amount: number; description: string; spent_at: string;
  category_id: string | null; notes: string | null;
}

function ExpensesPage() {
  const { roles } = useAuth();
  const canEdit = canManageFinance(roles);
  const [tab, setTab] = useState<"list" | "categories">("list");

  if (!canEdit) {
    return (
      <div>
        <PageHeader title="Expenses" />
        <div className="card-soft p-8 text-center text-sm text-muted-foreground">
          You do not have access to expenses.
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Expenses" description="Track school operating expenses by category." />
      <div className="mb-4 flex gap-2 border-b border-border">
        {([["list", "Expenses"], ["categories", "Categories"]] as const).map(([v, l]) => (
          <button key={v} onClick={() => setTab(v)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${tab === v ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {l}
          </button>
        ))}
      </div>
      {tab === "list" ? <ExpensesList /> : <CategoriesTab />}
    </div>
  );
}

function ExpensesList() {
  const [rows, setRows] = useState<Expense[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [from, setFrom] = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [filterCat, setFilterCat] = useState<string>("");

  const load = async () => {
    setLoading(true);
    const [{ data: e }, { data: c }] = await Promise.all([
      supabase.from("expenses").select("*").gte("spent_at", from).lte("spent_at", to).order("spent_at", { ascending: false }),
      supabase.from("expense_categories").select("*").order("name"),
    ]);
    setRows((e as Expense[]) ?? []);
    setCats((c as Category[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [from, to]);

  const filtered = useMemo(() => filterCat ? rows.filter(r => r.category_id === filterCat) : rows, [rows, filterCat]);
  const total = filtered.reduce((s, r) => s + Number(r.amount), 0);

  const remove = async (id: string) => {
    if (!confirm("Delete this expense?")) return;
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    load();
  };

  const exportCsv = () => {
    const header = ["Date", "Category", "Description", "Amount", "Notes"];
    const lines = [header.join(",")];
    const catMap = new Map(cats.map(c => [c.id, c.name]));
    for (const r of filtered) {
      lines.push([r.spent_at, catMap.get(r.category_id ?? "") ?? "", `"${r.description.replace(/"/g, '""')}"`, r.amount, `"${(r.notes ?? "").replace(/"/g, '""')}"`].join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `expenses-${from}-to-${to}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="card-soft mb-4 flex flex-wrap items-end gap-3 p-4">
        <Field label="From"><TextInput type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label="To"><TextInput type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
        <Field label="Category">
          <Select value={filterCat} onChange={(e) => setFilterCat(e.target.value)}>
            <option value="">All</option>
            {cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        <div className="ml-auto flex gap-2">
          <Btn variant="outline" icon={<Download className="h-4 w-4" />} onClick={exportCsv}>Export</Btn>
          <Btn icon={<Plus className="h-4 w-4" />} onClick={() => { setEditing(null); setOpen(true); }}>Add expense</Btn>
        </div>
      </div>

      <div className="card-soft overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left">Date</th>
              <th className="px-4 py-2 text-left">Category</th>
              <th className="px-4 py-2 text-left">Description</th>
              <th className="px-4 py-2 text-right">Amount</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No expenses</td></tr>
            ) : filtered.map(r => (
              <tr key={r.id} className="border-t border-border">
                <td className="px-4 py-2">{r.spent_at}</td>
                <td className="px-4 py-2">{cats.find(c => c.id === r.category_id)?.name ?? "—"}</td>
                <td className="px-4 py-2">{r.description}</td>
                <td className="px-4 py-2 text-right font-medium">{money(r.amount)}</td>
                <td className="px-4 py-2">
                  <div className="flex justify-end gap-1">
                    <Btn variant="ghost" size="sm" icon={<Pencil className="h-4 w-4" />} onClick={() => { setEditing(r); setOpen(true); }} />
                    <Btn variant="ghost" size="sm" icon={<Trash2 className="h-4 w-4" />} onClick={() => remove(r.id)} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          {filtered.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-border bg-muted/30 font-semibold">
                <td colSpan={3} className="px-4 py-2 text-right">Total</td>
                <td className="px-4 py-2 text-right">{money(total)}</td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {open && <ExpenseModal cats={cats} editing={editing} onClose={() => setOpen(false)} onSaved={() => { setOpen(false); load(); }} />}
    </div>
  );
}

function ExpenseModal({ cats, editing, onClose, onSaved }: { cats: Category[]; editing: Expense | null; onClose: () => void; onSaved: () => void }) {
  const { user } = useAuth();
  const [form, setForm] = useState({
    spent_at: editing?.spent_at ?? new Date().toISOString().slice(0, 10),
    category_id: editing?.category_id ?? "",
    amount: String(editing?.amount ?? ""),
    description: editing?.description ?? "",
    notes: editing?.notes ?? "",
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.description.trim() || !form.amount) return toast.error("Description and amount required");
    setSaving(true);
    const payload = {
      spent_at: form.spent_at,
      category_id: form.category_id || null,
      amount: Number(form.amount),
      description: form.description.trim(),
      notes: form.notes.trim() || null,
      created_by: user?.id ?? null,
    };
    const { error } = editing
      ? await supabase.from("expenses").update(payload).eq("id", editing.id)
      : await supabase.from("expenses").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    onSaved();
  };

  return (
    <Modal open onClose={onClose} title={editing ? "Edit expense" : "Add expense"} width="lg"
      footer={<div className="flex justify-end gap-2"><Btn variant="outline" onClick={onClose}>Cancel</Btn><Btn loading={saving} onClick={save}>Save</Btn></div>}>
      <FormGrid>
        <Field label="Date" required><TextInput type="date" value={form.spent_at} onChange={(e) => setForm({ ...form, spent_at: e.target.value })} /></Field>
        <Field label="Category">
          <Select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
            <option value="">— None —</option>
            {cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        <Field label="Amount" required><TextInput type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></Field>
        <Field label="Description" required className="md:col-span-2"><TextInput value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
        <Field label="Notes" className="md:col-span-2"><TextArea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
      </FormGrid>
    </Modal>
  );
}

function CategoriesTab() {
  const [cats, setCats] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("expense_categories").select("*").order("name");
    setCats((data as Category[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!name.trim()) return;
    const { error } = await supabase.from("expense_categories").insert({ name: name.trim() });
    if (error) return toast.error(error.message);
    setName(""); load();
  };
  const remove = async (id: string) => {
    if (!confirm("Delete category?")) return;
    const { error } = await supabase.from("expense_categories").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  return (
    <div className="card-soft p-4">
      <div className="mb-4 flex gap-2">
        <TextInput placeholder="Category name" value={name} onChange={(e) => setName(e.target.value)} />
        <Btn icon={<Plus className="h-4 w-4" />} onClick={add}>Add</Btn>
      </div>
      {loading ? <div className="text-sm text-muted-foreground">Loading...</div> : (
        <ul className="divide-y divide-border">
          {cats.map(c => (
            <li key={c.id} className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2 text-sm"><Tags className="h-4 w-4 text-muted-foreground" />{c.name}</div>
              <Btn variant="ghost" size="sm" icon={<Trash2 className="h-4 w-4" />} onClick={() => remove(c.id)} />
            </li>
          ))}
          {cats.length === 0 && <li className="py-2 text-sm text-muted-foreground">No categories yet</li>}
        </ul>
      )}
    </div>
  );
}
