const API_BASE = import.meta.env.VITE_API_BASE || "";

export function apiUrl(path: string) {
  if (!API_BASE) return path; // relative in dev
  // ensure single slash join
  const left = API_BASE.endsWith("/") ? API_BASE.slice(0, -1) : API_BASE;
  const right = path.startsWith("/") ? path : `/${path}`;
  return `${left}${right}`;
}

export function apiFetch(input: string, init?: RequestInit) {
  return fetch(apiUrl(input), init);
}


