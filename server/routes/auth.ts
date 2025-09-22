import { RequestHandler } from "express";
import { authenticate, getUserByToken, invalidateToken } from "../store/auth";
import type { AuthLoginRequest, AuthLoginResponse, AuthMeResponse, ApiError } from "@shared/api";

export const loginHandler: RequestHandler = (req, res) => {
  const { username, password } = req.body as AuthLoginRequest;
  if (!username || !password) {
    res.status(400).json({ error: "Missing credentials" } as ApiError);
    return;
  }
  const result = authenticate(username, password);
  if (!result) {
    res.status(401).json({ error: "Invalid credentials or inactive user" } as ApiError);
    return;
  }
  res.json(result as AuthLoginResponse);
};

export const meHandler: RequestHandler = (req, res) => {
  const token = getTokenFromHeader(req.headers.authorization);
  const user = getUserByToken(token);
  res.json({ user } as AuthMeResponse);
};

export const logoutHandler: RequestHandler = (req, res) => {
  const token = getTokenFromHeader(req.headers.authorization);
  if (token) invalidateToken(token);
  res.status(204).end();
};

function getTokenFromHeader(auth?: string) {
  if (!auth) return null;
  const [type, token] = auth.split(" ");
  if (type !== "Bearer") return null;
  return token ?? null;
}

export function extractToken(auth?: string) {
  return getTokenFromHeader(auth);
}
