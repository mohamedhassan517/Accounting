import type { AuthLoginRequest, AuthLoginResponse, AuthMeResponse, User } from "@shared/api";
import { apiFetch } from "@/lib/api";

const AUTH_KEY = "auth_token";

export function getToken() {
  return localStorage.getItem(AUTH_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(AUTH_KEY, token);
  else localStorage.removeItem(AUTH_KEY);
}

export async function login(input: AuthLoginRequest): Promise<AuthLoginResponse> {
  const res = await apiFetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error((await res.json()).error || "Login failed");
  const data = (await res.json()) as AuthLoginResponse;
  setToken(data.token);
  return data;
}

export async function me(): Promise<User | null> {
  const token = getToken();
  if (!token) return null;
  const res = await apiFetch("/api/auth/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as AuthMeResponse;
  return data.user;
}

export async function logout() {
  const token = getToken();
  await apiFetch("/api/auth/logout", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  setToken(null);
}
