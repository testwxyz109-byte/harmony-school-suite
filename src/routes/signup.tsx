import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { api } from "@/lib/api";
import { Btn } from "@/components/PrimaryButton";
import { Field, TextInput } from "@/components/FormField";
import { useAuth } from "@/hooks/useAuth";
import { Toaster, toast } from "sonner";
import { GraduationCap } from "lucide-react";

export const Route = createFileRoute("/signup")({ component: SignupPage });

const PWD_RE = /^(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;

function SignupPage() {
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) return toast.error("Please enter your full name");
    if (!email) return toast.error("Please enter email");
    if (!PWD_RE.test(password)) return toast.error("Password must be 8+ characters and include a special character");
    if (password !== confirm) return toast.error("Passwords do not match");
    setSubmitting(true);
    const r = await api.post<{ ok: true; autoApproved: boolean }>("/auth/signup", {
      email, password, full_name: fullName,
    });
    setSubmitting(false);
    if (r.error) return toast.error(r.error.message);
    if (r.data?.autoApproved) {
      await refreshProfile();
      toast.success("Welcome! You're the first user — signed in as admin.");
      navigate({ to: "/" });
    } else {
      toast.success("Account created. Awaiting admin approval.");
      navigate({ to: "/login" });
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted p-4">
      <Toaster richColors position="top-right" />
      <div className="card-soft w-full max-w-md p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-md bg-primary">
            <GraduationCap className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="text-xl font-semibold">Create account</h1>
          <p className="mt-1 text-sm text-muted-foreground">Signup requires admin approval (first signup is auto-approved as admin)</p>
        </div>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field label="Full name" required>
            <TextInput value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </Field>
          <Field label="Email" required>
            <TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
          <Field label="Password" required error={password && !PWD_RE.test(password) ? "8+ chars, 1 special character" : undefined}>
            <TextInput type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </Field>
          <Field label="Confirm password" required>
            <TextInput type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          </Field>
          <Btn type="submit" loading={submitting} className="w-full">Create account</Btn>
        </form>
        <div className="mt-4 text-center text-sm text-muted-foreground">
          Already have an account? <Link to="/login" className="text-primary hover:underline">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
