import crypto from "node:crypto";
import type { Role, User, UserWithPassword } from "@shared/api";

// In-memory stores (non-persistent)
const users = new Map<string, UserWithPassword>();
const sessions = new Map<string, string>(); // token -> userId

function seed() {
  if (users.size === 0) {
    const id = crypto.randomUUID();
    const manager: UserWithPassword = {
      id,
      username: "root",
      name: "Manager",
      email: "admin@example.com",
      role: "manager",
      active: true,
      password: "password123",
    };
    users.set(id, manager);
  }
}
seed();

export function authenticate(username: string, password: string) {
  for (const user of users.values()) {
    if (user.username === username && user.password === password && user.active) {
      const token = crypto.randomUUID();
      sessions.set(token, user.id);
      const { password: _pw, ...safe } = user;
      return { token, user: safe } as { token: string; user: User };
    }
  }
  return null;
}

export function getUserByToken(token?: string | null): User | null {
  if (!token) return null;
  const userId = sessions.get(token);
  if (!userId) return null;
  const u = users.get(userId);
  if (!u) return null;
  const { password: _pw, ...safe } = u;
  return safe;
}

export function invalidateToken(token: string) {
  sessions.delete(token);
}

export function requireManager(token?: string | null): User | null {
  const user = getUserByToken(token ?? null);
  if (!user) return null;
  if (user.role !== "manager") return null;
  return user;
}

export function listUsers(): User[] {
  return Array.from(users.values()).map(({ password: _pw, ...u }) => u);
}

export function createUser(input: {
  username: string;
  name: string;
  email: string;
  role: Role;
  password: string;
  active?: boolean;
}): User {
  const id = crypto.randomUUID();
  const user: UserWithPassword = {
    id,
    username: input.username,
    name: input.name,
    email: input.email,
    role: input.role,
    active: input.active ?? true,
    password: input.password,
  };
  users.set(id, user);
  const { password: _pw, ...safe } = user;
  return safe;
}

export function updateUser(id: string, patch: Partial<Omit<UserWithPassword, "id" | "username">> & { password?: string }) {
  const existing = users.get(id);
  if (!existing) return null;
  const updated: UserWithPassword = {
    ...existing,
    ...patch,
  };
  users.set(id, updated);
  const { password: _pw, ...safe } = updated;
  return safe as User;
}

export function deleteUser(id: string) {
  return users.delete(id);
}
