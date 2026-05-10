import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Btn } from "@/components/PrimaryButton";
import { Field, TextInput } from "@/components/FormField";
import { useAuth } from "@/hooks/useAuth";
import { Toaster, toast } from "sonner";
import { GraduationCap } from "lucide-react";

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  const navigate = useNavigate();
  const { user, loading, refreshProfile } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/" });
  }, [user, loading, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { toast.error("Please enter email and password"); return; }
    setSubmitting(true);
    const r = await api.post("/auth/login", { email, password });
    setSubmitting(false);
    if (r.error) { toast.error(r.error.message); return; }
    await refreshProfile();
    toast.success("Signed in");
    navigate({ to: "/" });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted p-4">
      <Toaster richColors position="top-right" />
      <div className="card-soft w-full max-w-md p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-md bg-primary">
            <GraduationCap className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="text-xl font-semibold">School Management System</h1>
          <p className="mt-1 text-sm text-muted-foreground">Sign in to your account</p>
        </div>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field label="Email" required>
            <TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@school.com" required />
          </Field>
          <Field label="Password" required>
            <TextInput type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </Field>
          <Btn type="submit" loading={submitting} className="w-full">Sign in</Btn>
        </form>
        <div className="mt-4 text-center text-sm text-muted-foreground">
          New here? <Link to="/signup" className="text-primary hover:underline">Create account</Link>
        </div>
      </div>
    </div>
  );
}
