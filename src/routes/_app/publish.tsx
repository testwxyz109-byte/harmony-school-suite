import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppLayout";
import { Btn } from "@/components/PrimaryButton";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { isSubOrAdmin } from "@/lib/permissions";
import { CheckCircle2, XCircle, ExternalLink, BadgeCheck } from "lucide-react";

export const Route = createFileRoute("/_app/publish")({ component: PublishPage });

interface Exam { id: string; name: string; term: string; kind: string; start_date: string; end_date: string; published: boolean }

function PublishPage() {
  const { roles } = useAuth();
  const canEdit = isSubOrAdmin(roles);
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("exams").select("*").order("start_date", { ascending: false });
    setExams((data as Exam[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const togglePublish = async (e: Exam) => {
    if (!canEdit) return;
    const { error } = await supabase.from("exams").update({ published: !e.published }).eq("id", e.id);
    if (error) return toast.error(error.message);
    toast.success(e.published ? "Unpublished" : "Published");
    load();
  };

  const publicUrl = typeof window !== "undefined" ? `${window.location.origin}/results` : "/results";

  return (
    <div>
      <PageHeader title="Publish portal" description="Toggle public access to exam results. Students can check results by entering their exam code." />

      <div className="card-soft mb-4 flex items-center justify-between p-4">
        <div>
          <div className="text-sm font-medium">Public results page</div>
          <div className="text-xs text-muted-foreground">{publicUrl}</div>
        </div>
        <a href="/results" target="_blank" rel="noreferrer">
          <Btn variant="outline" icon={<ExternalLink className="h-4 w-4" />}>Open</Btn>
        </a>
      </div>

      <div className="card-soft overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left">Exam</th>
              <th className="px-4 py-2 text-left">Term</th>
              <th className="px-4 py-2 text-left">Type</th>
              <th className="px-4 py-2 text-left">Dates</th>
              <th className="px-4 py-2 text-center">Status</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Loading...</td></tr>
              : exams.length === 0 ? <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No exams</td></tr>
              : exams.map(e => (
                <tr key={e.id} className="border-t border-border">
                  <td className="px-4 py-2 font-medium">{e.name}</td>
                  <td className="px-4 py-2 capitalize">{e.term.replace("_", " ")}</td>
                  <td className="px-4 py-2 capitalize">{e.kind}</td>
                  <td className="px-4 py-2 text-muted-foreground">{e.start_date} → {e.end_date}</td>
                  <td className="px-4 py-2 text-center">
                    {e.published ? (
                      <span className="inline-flex items-center gap-1 rounded bg-success/10 px-2 py-1 text-xs text-success"><CheckCircle2 className="h-3 w-3" />Published</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded bg-muted px-2 py-1 text-xs text-muted-foreground"><XCircle className="h-3 w-3" />Draft</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {canEdit && (
                      <Btn size="sm" variant={e.published ? "outline" : "primary"} icon={<BadgeCheck className="h-4 w-4" />} onClick={() => togglePublish(e)}>
                        {e.published ? "Unpublish" : "Publish"}
                      </Btn>
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
