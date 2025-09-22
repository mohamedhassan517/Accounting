import path from "path";
import "dotenv/config";
import * as express from "express";
import express__default from "express";
import cors from "cors";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
const handleDemo = (req, res) => {
  const response = {
    message: "Hello from Express server"
  };
  res.status(200).json(response);
};
const users = /* @__PURE__ */ new Map();
const sessions = /* @__PURE__ */ new Map();
function seed() {
  if (users.size === 0) {
    const id = crypto.randomUUID();
    const manager = {
      id,
      username: "root",
      name: "Manager",
      email: "admin@example.com",
      role: "manager",
      active: true,
      password: "password123"
    };
    users.set(id, manager);
  }
}
seed();
function authenticate(username, password) {
  for (const user of users.values()) {
    if (user.username === username && user.password === password && user.active) {
      const token = crypto.randomUUID();
      sessions.set(token, user.id);
      const { password: _pw, ...safe } = user;
      return { token, user: safe };
    }
  }
  return null;
}
function getUserByToken(token) {
  if (!token) return null;
  const userId = sessions.get(token);
  if (!userId) return null;
  const u = users.get(userId);
  if (!u) return null;
  const { password: _pw, ...safe } = u;
  return safe;
}
function invalidateToken(token) {
  sessions.delete(token);
}
function requireManager(token) {
  const user = getUserByToken(token ?? null);
  if (!user) return null;
  if (user.role !== "manager") return null;
  return user;
}
function listUsers() {
  return Array.from(users.values()).map(({ password: _pw, ...u }) => u);
}
function createUser(input) {
  const id = crypto.randomUUID();
  const user = {
    id,
    username: input.username,
    name: input.name,
    email: input.email,
    role: input.role,
    active: input.active ?? true,
    password: input.password
  };
  users.set(id, user);
  const { password: _pw, ...safe } = user;
  return safe;
}
function updateUser(id, patch) {
  const existing = users.get(id);
  if (!existing) return null;
  const updated = {
    ...existing,
    ...patch
  };
  users.set(id, updated);
  const { password: _pw, ...safe } = updated;
  return safe;
}
function deleteUser(id) {
  return users.delete(id);
}
const loginHandler = (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ error: "Missing credentials" });
    return;
  }
  const result = authenticate(username, password);
  if (!result) {
    res.status(401).json({ error: "Invalid credentials or inactive user" });
    return;
  }
  res.json(result);
};
const meHandler = (req, res) => {
  const token = getTokenFromHeader(req.headers.authorization);
  const user = getUserByToken(token);
  res.json({ user });
};
const logoutHandler = (req, res) => {
  const token = getTokenFromHeader(req.headers.authorization);
  if (token) invalidateToken(token);
  res.status(204).end();
};
function getTokenFromHeader(auth) {
  if (!auth) return null;
  const [type, token] = auth.split(" ");
  if (type !== "Bearer") return null;
  return token ?? null;
}
function extractToken(auth) {
  return getTokenFromHeader(auth);
}
const listUsersHandler = (req, res) => {
  const token = extractToken(req.headers.authorization);
  const manager = requireManager(token);
  if (!manager) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  res.json({ users: listUsers() });
};
const createUserHandler = (req, res) => {
  const token = extractToken(req.headers.authorization);
  const manager = requireManager(token);
  if (!manager) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const body = req.body;
  if (!body.username || !body.password || !body.name || !body.email || !body.role) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }
  const user = createUser(body);
  res.status(201).json(user);
};
const updateUserHandler = (req, res) => {
  const token = extractToken(req.headers.authorization);
  const manager = requireManager(token);
  if (!manager) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const id = req.params.id;
  const patch = req.body;
  const updated = updateUser(id, patch);
  if (!updated) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(updated);
};
const deleteUserHandler = (req, res) => {
  const token = extractToken(req.headers.authorization);
  const manager = requireManager(token);
  if (!manager) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const id = req.params.id;
  const ok = deleteUser(id);
  if (!ok) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.status(204).end();
};
const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE;
if (!url || !serviceKey) {
  console.warn("[supabase] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE");
}
const supabaseAdmin = url && serviceKey ? createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } }) : null;
function ensureSupabase(res) {
  if (!supabaseAdmin) {
    res.status(500).json({ error: "Supabase not configured" });
    return false;
  }
  return true;
}
const adminListUsers = async (req, res) => {
  const token = extractToken(req.headers.authorization);
  const manager = requireManager(token);
  if (!manager) return res.status(403).json({ error: "Forbidden" });
  if (!ensureSupabase(res)) return;
  const { data, error } = await supabaseAdmin.from("user_profiles").select("*").order("created_at", { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  const users2 = (data || []).map((r) => ({ id: r.user_id, username: r.name, name: r.name, email: r.email, role: r.role, active: r.active }));
  res.json({ users: users2 });
};
const adminCreateUser = async (req, res) => {
  const token = extractToken(req.headers.authorization);
  const manager = requireManager(token);
  if (!manager) return res.status(403).json({ error: "Forbidden" });
  if (!ensureSupabase(res)) return;
  const body = req.body;
  if (!body.email || !body.password || !body.role || !body.name) return res.status(400).json({ error: "Missing fields" });
  const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({ email: body.email, password: body.password, email_confirm: true });
  if (cErr || !created.user) return res.status(500).json({ error: cErr?.message || "createUser failed" });
  const { error: iErr } = await supabaseAdmin.from("user_profiles").insert({ user_id: created.user.id, name: body.name || body.username, email: body.email, role: body.role, active: body.active ?? true });
  if (iErr) return res.status(500).json({ error: iErr.message });
  const user = { id: created.user.id, username: body.name || body.username, name: body.name || body.username, email: body.email, role: body.role, active: body.active ?? true };
  res.status(201).json(user);
};
const adminUpdateUser = async (req, res) => {
  const token = extractToken(req.headers.authorization);
  const manager = requireManager(token);
  if (!manager) return res.status(403).json({ error: "Forbidden" });
  if (!ensureSupabase(res)) return;
  const id = req.params.id;
  const patch = req.body;
  if (patch.password || patch.email) {
    const { error: uErr } = await supabaseAdmin.auth.admin.updateUserById(id, { password: patch.password, email: patch.email });
    if (uErr) return res.status(500).json({ error: uErr.message });
  }
  const update = {};
  if (patch.role) update.role = patch.role;
  if (typeof patch.active === "boolean") update.active = patch.active;
  if (patch.name) update.name = patch.name;
  if (patch.email) update.email = patch.email;
  if (Object.keys(update).length) {
    const { error: pErr } = await supabaseAdmin.from("user_profiles").update(update).eq("user_id", id);
    if (pErr) return res.status(500).json({ error: pErr.message });
  }
  const { data } = await supabaseAdmin.from("user_profiles").select("*").eq("user_id", id).single();
  const user = { id, username: data?.name ?? "", name: data?.name ?? "", email: data?.email ?? "", role: data?.role, active: data?.active };
  res.json(user);
};
const adminDeleteUser = async (req, res) => {
  const token = extractToken(req.headers.authorization);
  const manager = requireManager(token);
  if (!manager) return res.status(403).json({ error: "Forbidden" });
  if (!ensureSupabase(res)) return;
  const id = req.params.id;
  const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
  if (error) return res.status(500).json({ error: error.message });
  await supabaseAdmin.from("user_profiles").delete().eq("user_id", id);
  res.status(204).end();
};
function createServer() {
  const app2 = express__default();
  app2.use(cors());
  app2.use(express__default.json());
  app2.use(express__default.urlencoded({ extended: true }));
  app2.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });
  app2.get("/api/demo", handleDemo);
  app2.post("/api/auth/login", loginHandler);
  app2.get("/api/auth/me", meHandler);
  app2.post("/api/auth/logout", logoutHandler);
  app2.get("/api/users", listUsersHandler);
  app2.post("/api/users", createUserHandler);
  app2.put("/api/users/:id", updateUserHandler);
  app2.delete("/api/users/:id", deleteUserHandler);
  app2.get("/api/admin/users", adminListUsers);
  app2.post("/api/admin/users", adminCreateUser);
  app2.put("/api/admin/users/:id", adminUpdateUser);
  app2.delete("/api/admin/users/:id", adminDeleteUser);
  return app2;
}
const app = createServer();
const port = process.env.PORT || 3e3;
const __dirname = import.meta.dirname;
const distPath = path.join(__dirname, "../spa");
app.use(express.static(distPath));
app.get("*", (req, res) => {
  if (req.path.startsWith("/api/") || req.path.startsWith("/health")) {
    return res.status(404).json({ error: "API endpoint not found" });
  }
  res.sendFile(path.join(distPath, "index.html"));
});
app.listen(port, () => {
  console.log(`🚀 Fusion Starter server running on port ${port}`);
  console.log(`📱 Frontend: http://localhost:${port}`);
  console.log(`🔧 API: http://localhost:${port}/api`);
});
process.on("SIGTERM", () => {
  console.log("🛑 Received SIGTERM, shutting down gracefully");
  process.exit(0);
});
process.on("SIGINT", () => {
  console.log("🛑 Received SIGINT, shutting down gracefully");
  process.exit(0);
});
//# sourceMappingURL=node-build.mjs.map
