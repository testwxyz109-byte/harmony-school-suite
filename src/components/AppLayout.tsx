import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState, type ReactNode } from "react";
import {
  LayoutDashboard, Users, GraduationCap, BookOpen, CalendarCheck, DollarSign,
  Receipt, Wallet, FileText, Megaphone, Bus, Settings, LogOut, Menu, ShieldAlert,
  ClipboardList, BadgeCheck,
} from "lucide-react";
import { canManageFinance, canManageSystemConfig, canManageUsers, isSubOrAdmin } from "@/lib/permissions";
import { Toaster } from "sonner";
import { cn } from "@/lib/utils";

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  visible: boolean;
}

export default function AppLayout() {
  const { user, profile, roles, loading, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (profile && !profile.enabled) {
      // user awaiting approval; sign out is handled by pending screen
    }
  }, [profile]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) return null;

  if (profile && !profile.enabled) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="card-soft max-w-md p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-warning/10">
            <ShieldAlert className="h-7 w-7 text-warning" />
          </div>
          <h1 className="text-xl font-semibold">Account pending approval</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your account has been created but needs to be approved by an administrator before you can access the system.
          </p>
          <button
            onClick={signOut}
            className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  const isAdminOrSub = isSubOrAdmin(roles);
  const nav: NavItem[] = [
    { to: "/", label: "Dashboard", icon: LayoutDashboard, visible: true },
    { to: "/students", label: "Students", icon: Users, visible: true },
    { to: "/academic", label: "Academic", icon: GraduationCap, visible: isAdminOrSub },
    { to: "/subjects", label: "Subjects", icon: BookOpen, visible: true },
    { to: "/attendance", label: "Attendance", icon: CalendarCheck, visible: true },
    { to: "/exams", label: "Exams", icon: ClipboardList, visible: true },
    { to: "/finance", label: "Finance", icon: DollarSign, visible: canManageFinance(roles) },
    { to: "/expenses", label: "Expenses", icon: Receipt, visible: canManageFinance(roles) },
    { to: "/payroll", label: "Payroll", icon: Wallet, visible: canManageFinance(roles) },
    { to: "/transport", label: "Transport", icon: Bus, visible: isAdminOrSub },
    { to: "/announcements", label: "Announcements", icon: Megaphone, visible: true },
    { to: "/publish", label: "Publish portal", icon: BadgeCheck, visible: isAdminOrSub },
    { to: "/users", label: "Users", icon: Users, visible: canManageUsers(roles) },
    { to: "/settings", label: "System config", icon: Settings, visible: canManageSystemConfig(roles) },
  ];

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-border bg-sidebar transition-transform md:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary">
            <GraduationCap className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="text-base font-semibold">School System</div>
        </div>
        <nav className="flex-1 overflow-y-auto p-3">
          {nav.filter((n) => n.visible).map((n) => {
            const active = location.pathname === n.to || (n.to !== "/" && location.pathname.startsWith(n.to));
            return (
              <Link
                key={n.to}
                to={n.to}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "mb-1 flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-sidebar-foreground hover:bg-accent hover:text-accent-foreground",
                )}
              >
                <n.icon className="h-4 w-4" />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <div className="mb-2 px-2 text-xs text-muted-foreground">
            {profile?.full_name || profile?.email}
            <div className="text-[11px] capitalize-none">{roles.join(", ")}</div>
          </div>
          <button
            onClick={signOut}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-sidebar-foreground hover:bg-accent"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main */}
      <div className="flex flex-1 flex-col md:ml-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-background px-4">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-md p-2 hover:bg-accent md:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="text-sm text-muted-foreground">
            {nav.find((n) => location.pathname === n.to)?.label || ""}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="hidden items-center gap-2 sm:flex">
              <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-accent text-sm font-medium text-accent-foreground">
                {profile?.photo_url ? (
                  <img src={profile.photo_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  (profile?.full_name || profile?.email || "?").slice(0, 1)
                )}
              </div>
            </div>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
      <Toaster richColors position="top-right" />
    </div>
  );
}

export function PageHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}
