/**
 * Shared API client — base URL from env for demos and production.
 *
 * Local:   leave unset → http://127.0.0.1:8000/api/v1
 * Deploy:  set VITE_API_BASE at Vercel build time to your Render URL, e.g.
 *          https://vasudha-backend.onrender.com/api/v1
 */
const ENV_API_BASE =
  typeof import.meta !== "undefined" ? (import.meta as any).env?.VITE_API_BASE : undefined;

// Use an explicit Vercel/Render environment variable when provided.
// In local Vite development, fall back to the local Flask server.
// In production, fall back to the deployed Render backend so a missing Vercel
// environment variable cannot silently send requests to the visitor's localhost.
const BASE_URL =
  ENV_API_BASE ||
  ((typeof import.meta !== "undefined" && (import.meta as any).env?.DEV)
    ? "http://127.0.0.1:8000/api/v1"
    : "https://vasudha-pmjtngec.onrender.com/api/v1");

function getToken(): string | null {
  try {
    const raw = localStorage.getItem("vasudha_auth");
    if (!raw) return null;
    return JSON.parse(raw).access_token ?? null;
  } catch {
    return null;
  }
}

export async function apiFetch<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (res.status === 401) {
    localStorage.removeItem("vasudha_auth");
    window.location.href = "/login";
    throw new Error("Session expired");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Request failed (${res.status})`);
  }
  return res.json();
}

export function getApiBase() {
  return BASE_URL;
}

/** Root of the API host (without /api/v1) — used by keepalive. */
export function getApiOrigin(): string {
  try {
    const u = new URL(BASE_URL);
    return u.origin;
  } catch {
    return "https://vasudha-pmjtngec.onrender.com";
  }
}
