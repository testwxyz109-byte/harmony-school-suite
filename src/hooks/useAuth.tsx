import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "@/lib/api";
import type { AppRole } from "@/lib/permissions";

interface User { id: string; email: string }
interface Profile {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  photo_url: string | null;
  enabled: boolean;
  attendance_permitted: boolean;
}

interface AuthContextValue {
  user: User | null;
  session: { user: User } | null;
  profile: Profile | null;
  roles: AppRole[];
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

interface MeResponse {
  user: User | null;
  profile: Profile | null;
  roles: AppRole[];
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    const r = await api.get<MeResponse>("/auth/me");
    if (r.error || !r.data) {
      setUser(null); setProfile(null); setRoles([]); return;
    }
    setUser(r.data.user);
    setProfile(r.data.profile);
    setRoles(r.data.roles ?? []);
  }, []);

  useEffect(() => {
    refreshProfile().finally(() => setLoading(false));
  }, [refreshProfile]);

  const signOut = async () => {
    await api.post("/auth/logout");
    setUser(null); setProfile(null); setRoles([]);
  };

  return (
    <AuthContext.Provider value={{ user, session: user ? { user } : null, profile, roles, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
