import { RequestHandler } from 'express';
import { supabaseAdmin } from '../lib/supabase';
import type { ApiError, Role, User, UserCreateRequest, UserUpdateRequest, UsersListResponse } from '@shared/api';
import { extractToken } from './auth';
import { requireManager } from '../store/auth';

function ensureSupabase(res: any) {
  if (!supabaseAdmin) {
    res.status(500).json({ error: 'Supabase not configured' } as ApiError);
    return false;
  }
  return true;
}

export const adminListUsers: RequestHandler = async (req, res) => {
  const token = extractToken(req.headers.authorization);
  const manager = requireManager(token);
  if (!manager) return res.status(403).json({ error: 'Forbidden' } as ApiError);
  if (!ensureSupabase(res)) return;

  const { data, error } = await supabaseAdmin!.from('user_profiles').select('*').order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message } as ApiError);
  const users: User[] = (data || []).map((r: any) => ({ id: r.user_id, username: r.name, name: r.name, email: r.email, role: r.role as Role, active: r.active }));
  res.json({ users } as UsersListResponse);
};

export const adminCreateUser: RequestHandler = async (req, res) => {
  const token = extractToken(req.headers.authorization);
  const manager = requireManager(token);
  if (!manager) return res.status(403).json({ error: 'Forbidden' } as ApiError);
  if (!ensureSupabase(res)) return;

  const body = req.body as UserCreateRequest;
  if (!body.email || !body.password || !body.role || !body.name) return res.status(400).json({ error: 'Missing fields' } as ApiError);

  const { data: created, error: cErr } = await supabaseAdmin!.auth.admin.createUser({ email: body.email, password: body.password, email_confirm: true });
  if (cErr || !created.user) return res.status(500).json({ error: cErr?.message || 'createUser failed' } as ApiError);

  const { error: iErr } = await supabaseAdmin!.from('user_profiles').insert({ user_id: created.user.id, name: body.name || body.username, email: body.email, role: body.role, active: body.active ?? true });
  if (iErr) return res.status(500).json({ error: iErr.message } as ApiError);

  const user: User = { id: created.user.id, username: body.name || body.username, name: body.name || body.username, email: body.email, role: body.role, active: body.active ?? true };
  res.status(201).json(user);
};

export const adminUpdateUser: RequestHandler = async (req, res) => {
  const token = extractToken(req.headers.authorization);
  const manager = requireManager(token);
  if (!manager) return res.status(403).json({ error: 'Forbidden' } as ApiError);
  if (!ensureSupabase(res)) return;

  const id = req.params.id;
  const patch = req.body as UserUpdateRequest & { password?: string; email?: string; name?: string };

  if (patch.password || patch.email) {
    const { error: uErr } = await supabaseAdmin!.auth.admin.updateUserById(id, { password: patch.password, email: patch.email });
    if (uErr) return res.status(500).json({ error: uErr.message } as ApiError);
  }

  const update: any = {};
  if (patch.role) update.role = patch.role;
  if (typeof patch.active === 'boolean') update.active = patch.active;
  if (patch.name) update.name = patch.name;
  if (patch.email) update.email = patch.email;

  if (Object.keys(update).length) {
    const { error: pErr } = await supabaseAdmin!.from('user_profiles').update(update).eq('user_id', id);
    if (pErr) return res.status(500).json({ error: pErr.message } as ApiError);
  }

  const { data } = await supabaseAdmin!.from('user_profiles').select('*').eq('user_id', id).single();
  const user: User = { id, username: data?.name ?? '', name: data?.name ?? '', email: data?.email ?? '', role: data?.role, active: data?.active };
  res.json(user);
};

export const adminDeleteUser: RequestHandler = async (req, res) => {
  const token = extractToken(req.headers.authorization);
  const manager = requireManager(token);
  if (!manager) return res.status(403).json({ error: 'Forbidden' } as ApiError);
  if (!ensureSupabase(res)) return;

  const id = req.params.id;
  const { error } = await supabaseAdmin!.auth.admin.deleteUser(id);
  if (error) return res.status(500).json({ error: error.message } as ApiError);
  await supabaseAdmin!.from('user_profiles').delete().eq('user_id', id);
  res.status(204).end();
};
