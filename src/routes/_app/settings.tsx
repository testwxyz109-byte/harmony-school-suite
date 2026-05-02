import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppLayout";
import { Btn } from "@/components/PrimaryButton";
import { Field, TextInput } from "@/components/FormField";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { canManageSystemConfig } from "@/lib/permissions";
import { Upload } from "lucide-react";

export const Route = createFileRoute("/_app/settings")({ component: SettingsPage });

interface Settings {
  id: number; name: string; logo_url: string | null; address: string | null; phone: string | null;
  email: string | null; account_number: string | null; student_id_prefix: string; student_id_padding: number;
}

function SettingsPage() {
  const { roles } = useAuth();
  if (!canManageSystemConfig(roles)) return <div className="card-soft p-8 text-center text-muted-foreground">Admin only.</div>;
  const [s, setS] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("school_settings").select("*").eq("id", 1).maybeSingle().then(({ data }) => setS(data as Settings | null));
  }, []);

  const upload = async (file: File) => {
    const path = `logo-${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("school-assets").upload(path, file, { upsert: true });
    if (error) return toast.error(error.message);
    const { data } = supabase.storage.from("school-assets").getPublicUrl(path);
    setS((prev) => prev ? { ...prev, logo_url: data.publicUrl } : prev);
  };

  const save = async () => {
    if (!s) return;
    setSaving(true);
    const { error } = await supabase.from("school_settings").update({
      name: s.name, logo_url: s.logo_url, address: s.address, phone: s.phone, email: s.email,
      account_number: s.account_number, student_id_prefix: s.student_id_prefix, student_id_padding: s.student_id_padding,
    }).eq("id", 1);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Settings saved");
  };

  if (!s) return <div className="text-muted-foreground">Loading...</div>;

  return (
    <div>
      <PageHeader title="System configuration" description="School information and ID generation" />
      <div className="card-soft p-5">
        <div className="mb-4 flex items-center gap-4">
          <div className="h-16 w-16 overflow-hidden rounded-md border border-border bg-muted">
            {s.logo_url && <img src={s.logo_url} alt="" className="h-full w-full object-cover" />}
          </div>
          <label className="cursor-pointer">
            <input type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }} />
            <span className="inline-flex h-9 items-center gap-2 rounded-md border border-border px-3 text-sm hover:bg-accent">
              <Upload className="h-4 w-4" /> Upload logo
            </span>
          </label>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="School name" required><TextInput value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} /></Field>
          <Field label="Phone"><TextInput value={s.phone ?? ""} onChange={(e) => setS({ ...s, phone: e.target.value })} /></Field>
          <Field label="Email"><TextInput value={s.email ?? ""} onChange={(e) => setS({ ...s, email: e.target.value })} /></Field>
          <Field label="Account number"><TextInput value={s.account_number ?? ""} onChange={(e) => setS({ ...s, account_number: e.target.value })} /></Field>
          <Field label="Address" className="md:col-span-2"><TextInput value={s.address ?? ""} onChange={(e) => setS({ ...s, address: e.target.value })} /></Field>
          <Field label="Student ID prefix"><TextInput value={s.student_id_prefix} onChange={(e) => setS({ ...s, student_id_prefix: e.target.value })} placeholder="DC-" /></Field>
          <Field label="Student ID number padding"><TextInput type="number" min={1} max={10} value={s.student_id_padding} onChange={(e) => setS({ ...s, student_id_padding: parseInt(e.target.value || "4", 10) })} /></Field>
        </div>
        <div className="mt-4 flex justify-end">
          <Btn onClick={save} loading={saving}>Save settings</Btn>
        </div>
      </div>
    </div>
  );
}
