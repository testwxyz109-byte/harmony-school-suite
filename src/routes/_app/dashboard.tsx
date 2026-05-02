import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppLayout";
import {
  Users, GraduationCap, BookOpen, ClipboardList, DollarSign, Receipt, Megaphone,
} from "lucide-react";
import { money } from "@/lib/format";

export const Route = createFileRoute("/_app/dashboard")({
  component: Dashboard,
});

interface Stats {
  students: number;
  classes: number;
  subjects: number;
  teachers: number;
  exams: number;
  monthRevenue: number;
  monthExpense: number;
}

interface Announcement { id: string; title: string; body: string; created_at: string }

function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  const load = async () => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const [s, c, sub, t, e, pay, exp, ann] = await Promise.all([
      supabase.from("students").select("id", { count: "exact", head: true }),
      supabase.from("classes").select("id", { count: "exact", head: true }),
      supabase.from("subjects").select("id", { count: "exact", head: true }),
      supabase.from("user_roles").select("user_id", { count: "exact", head: true }).eq("role", "teacher"),
      supabase.from("exams").select("id", { count: "exact", head: true }),
      supabase.from("payments").select("amount, paid_at").gte("paid_at", monthStart),
      supabase.from("expenses").select("amount, spent_at").gte("spent_at", monthStart),
      supabase.from("announcements").select("*").order("created_at", { ascending: false }).limit(5),
    ]);
    const sumPay = (pay.data ?? []).reduce((a: number, p: { amount: number }) => a + Number(p.amount), 0);
    const sumExp = (exp.data ?? []).reduce((a: number, p: { amount: number }) => a + Number(p.amount), 0);
    setStats({
      students: s.count ?? 0,
      classes: c.count ?? 0,
      subjects: sub.count ?? 0,
      teachers: t.count ?? 0,
      exams: e.count ?? 0,
      monthRevenue: sumPay,
      monthExpense: sumExp,
    });
    setAnnouncements((ann.data ?? []) as Announcement[]);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("dashboard")
      .on("postgres_changes", { event: "*", schema: "public", table: "students" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "payments" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "expenses" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const cards = [
    { label: "Students", value: stats?.students ?? 0, icon: Users, to: "/students" },
    { label: "Classes", value: stats?.classes ?? 0, icon: GraduationCap, to: "/academic" },
    { label: "Subjects", value: stats?.subjects ?? 0, icon: BookOpen, to: "/subjects" },
    { label: "Teachers", value: stats?.teachers ?? 0, icon: Users, to: "/users" },
    { label: "Exams", value: stats?.exams ?? 0, icon: ClipboardList, to: "/exams" },
    { label: "Monthly revenue", value: money(stats?.monthRevenue ?? 0), icon: DollarSign, to: "/finance" },
    { label: "Monthly expenses", value: money(stats?.monthExpense ?? 0), icon: Receipt, to: "/expenses" },
  ];

  return (
    <div>
      <PageHeader title="Dashboard" description="Overview of school activity" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Link key={c.label} to={c.to} className="card-soft block p-5 transition-colors hover:border-primary">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm text-muted-foreground">{c.label}</div>
                <div className="mt-2 text-2xl font-semibold">{c.value}</div>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary">
                <c.icon className="h-5 w-5 text-primary-foreground" />
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card-soft p-5">
          <div className="mb-4 flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold">Recent announcements</h2>
          </div>
          {announcements.length === 0 ? (
            <p className="text-sm text-muted-foreground">No announcements yet.</p>
          ) : (
            <div className="space-y-3">
              {announcements.map((a) => (
                <div key={a.id} className="border-b border-border pb-3 last:border-0">
                  <div className="text-sm font-medium">{a.title}</div>
                  <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{a.body}</div>
                  <div className="mt-1 text-[11px] text-muted-foreground">{new Date(a.created_at).toLocaleString()}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
