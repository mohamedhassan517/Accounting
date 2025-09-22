import type { User, UsersListResponse, UserCreateRequest, UserUpdateRequest } from "@shared/api";
import { getToken } from "./auth";
import { enqueueRequest, getCachedUsers, isOnline, setCachedUsers } from "@/lib/offline";
import { apiFetch } from "@/lib/api";

function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function listUsers(): Promise<User[]> {
  if (!isOnline()) {
    const cached = await getCachedUsers<User[]>();
    return cached ?? [];
  }
  const res = await apiFetch("/api/admin/users", { headers: { ...authHeaders() } });
  if (!res.ok) throw new Error((await res.json()).error || "Failed to list users");
  const data = (await res.json()) as UsersListResponse;
  await setCachedUsers<User[]>(data.users);
  return data.users;
}

export async function createUser(input: UserCreateRequest): Promise<User> {
  if (!isOnline()) {
    await enqueueRequest({ url: "/api/admin/users", method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() }, body: input });
    const optimistic: User = { id: crypto.randomUUID(), username: input.username, role: input.role } as User;
    const existing = (await getCachedUsers<User[]>()) ?? [];
    const next = [...existing, optimistic];
    await setCachedUsers(next);
    return optimistic;
  }
  const res = await apiFetch("/api/admin/users", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error((await res.json()).error || "Failed to create user");
  const user = (await res.json()) as User;
  const existing = (await getCachedUsers<User[]>()) ?? [];
  await setCachedUsers([...existing, user]);
  return user;
}

export async function updateUser(id: string, patch: UserUpdateRequest): Promise<User> {
  if (!isOnline()) {
    await enqueueRequest({ url: `/api/admin/users/${id}`, method: "PUT", headers: { "Content-Type": "application/json", ...authHeaders() }, body: patch });
    const existing = (await getCachedUsers<User[]>()) ?? [];
    const next = existing.map(u => (u.id === id ? { ...u, ...patch } as User : u));
    await setCachedUsers(next);
    const updated = next.find(u => u.id === id)!;
    return updated;
  }
  const res = await apiFetch(`/api/admin/users/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error((await res.json()).error || "Failed to update user");
  const user = (await res.json()) as User;
  const existing = (await getCachedUsers<User[]>()) ?? [];
  const next = existing.map(u => (u.id === id ? user : u));
  await setCachedUsers(next);
  return user;
}

export async function deleteUserApi(id: string): Promise<void> {
  if (!isOnline()) {
    await enqueueRequest({ url: `/api/admin/users/${id}`, method: "DELETE", headers: { ...authHeaders() } });
    const existing = (await getCachedUsers<User[]>()) ?? [];
    const next = existing.filter(u => u.id !== id);
    await setCachedUsers(next);
    return;
  }
  const res = await apiFetch(`/api/admin/users/${id}`, {
    method: "DELETE",
    headers: { ...authHeaders() },
  });
  if (!res.ok) throw new Error((await res.json()).error || "Failed to delete user");
  const existing = (await getCachedUsers<User[]>()) ?? [];
  const next = existing.filter(u => u.id !== id);
  await setCachedUsers(next);
}
