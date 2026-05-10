// Low-level fetch helper that talks to the Express API.
// Base URL: VITE_API_URL (default "/api"). Cookies are sent for auth.

const BASE = (import.meta.env.VITE_API_URL as string | undefined) || "/api";

export interface ApiResult<T> {
  data: T | null;
  error: { message: string } | null;
  count?: number | null;
}

async function request<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  try {
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers || {}),
      },
    });
    const text = await res.text();
    const json = text ? JSON.parse(text) : {};
    if (!res.ok) {
      return { data: null, error: { message: json?.error || `HTTP ${res.status}` } };
    }
    return { data: (json.data ?? json) as T, error: null, count: json.count ?? null };
  } catch (err) {
    return { data: null, error: { message: err instanceof Error ? err.message : "Network error" } };
  }
}

export const api = {
  get:  <T = unknown>(path: string) => request<T>(path, { method: "GET" }),
  post: <T = unknown>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body !== undefined ? JSON.stringify(body) : undefined }),
};

// Direct query helper (used by the supabase shim)
export async function query<T = unknown>(body: Record<string, unknown>, opts?: { publicRead?: boolean }) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts?.publicRead) headers["x-public-read"] = "1";
  const res = await fetch(`${BASE}/q`, {
    method: "POST",
    credentials: "include",
    headers,
    body: JSON.stringify(body),
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) return { data: null, error: { message: json?.error || `HTTP ${res.status}` }, count: null };
  return { data: (json.data ?? null) as T, error: null, count: json.count ?? null };
}

// File upload — returns { url, path }
export async function uploadFile(bucket: string, file: File): Promise<{ url: string; path: string } | { error: string }> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(`${BASE}/upload/${encodeURIComponent(bucket)}`, {
    method: "POST",
    credentials: "include",
    body: fd,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) return { error: json?.error || `HTTP ${res.status}` };
  return json;
}
