import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppLayout";
import { Btn } from "@/components/PrimaryButton";
import { Field, TextInput, TextArea } from "@/components/FormField";
import { Modal } from "@/components/Modal";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { isSubOrAdmin } from "@/lib/permissions";

export const Route = createFileRoute("/_app/announcements")({ component: AnnouncementsPage });

interface A { id: string; title: string; body: string; created_at: string }

function AnnouncementsPage() {
  const { roles } = useAuth();
  const canEdit = isSubOrAdmin(roles);
  const [items, setItems] = useState<A[]>([]);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const load = async () => {
    const { data } = await supabase.from("announcements").select("*").order("created_at", { ascending: false });
    setItems((data ?? []) as A[]);
  };
  useEffect(() => { load(); }, []);

  const submit = async () => {
    if (!title.trim() || !body.trim()) return toast.error("Title and body required");
    const { error } = await supabase.from("announcements").insert([{ title: title.trim(), body: body.trim() }]);
    if (error) return toast.error(error.message);
    toast.success("Posted"); setOpen(false); setTitle(""); setBody(""); load();
  };
  const del = async (a: A) => {
    if (!confirm("Delete announcement?")) return;
    const { error } = await supabase.from("announcements").delete().eq("id", a.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted"); load();
  };

  return (
    <div>
      <PageHeader title="Announcements"
        action={canEdit && <Btn icon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>New announcement</Btn>} />
      <div className="space-y-3">
        {items.length === 0 && <div className="card-soft p-8 text-center text-muted-foreground">No announcements yet.</div>}
        {items.map((a) => (
          <div key={a.id} className="card-soft p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-semibold">{a.title}</div>
                <div className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{a.body}</div>
                <div className="mt-2 text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()}</div>
              </div>
              {canEdit && <Btn size="sm" variant="ghost" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => del(a)}>Delete</Btn>}
            </div>
          </div>
        ))}
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="New announcement"
        footer={<div className="flex justify-end gap-2"><Btn variant="outline" onClick={() => setOpen(false)}>Cancel</Btn><Btn onClick={submit}>Post</Btn></div>}>
        <div className="space-y-4">
          <Field label="Title" required><TextInput value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
          <Field label="Body" required><TextArea value={body} onChange={(e) => setBody(e.target.value)} /></Field>
        </div>
      </Modal>
    </div>
  );
}
