import localforage from "localforage";

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

interface QueuedRequest {
  id: string;
  url: string;
  method: HttpMethod;
  headers?: Record<string, string>;
  body?: unknown;
  timestamp: number;
}

const OFFLINE_QUEUE_KEY = "offline_queue";
const USERS_CACHE_KEY = "users_cache";

export function isOnline() {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine;
}

export function onNetworkChange(cb: (online: boolean) => void) {
  const onlineHandler = () => cb(true);
  const offlineHandler = () => cb(false);
  window.addEventListener("online", onlineHandler);
  window.addEventListener("offline", offlineHandler);
  return () => {
    window.removeEventListener("online", onlineHandler);
    window.removeEventListener("offline", offlineHandler);
  };
}

async function loadQueue(): Promise<QueuedRequest[]> {
  const list = (await localforage.getItem<QueuedRequest[]>(OFFLINE_QUEUE_KEY)) ?? [];
  return Array.isArray(list) ? list : [];
}

async function saveQueue(list: QueuedRequest[]) {
  await localforage.setItem(OFFLINE_QUEUE_KEY, list);
}

export async function enqueueRequest(req: Omit<QueuedRequest, "id" | "timestamp">) {
  const queue = await loadQueue();
  const item: QueuedRequest = {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    ...req,
  };
  queue.push(item);
  await saveQueue(queue);
  return item;
}

export async function processQueue() {
  if (!isOnline()) return;
  let queue = await loadQueue();
  if (!queue.length) return;
  const remaining: QueuedRequest[] = [];
  for (const item of queue) {
    try {
      await fetch(item.url, {
        method: item.method,
        headers: item.headers,
        body: item.body ? JSON.stringify(item.body) : undefined,
      });
      // Ignore response body; we rely on realtime/next refresh
    } catch (_err) {
      // Keep it in the queue if still failing
      remaining.push(item);
    }
  }
  if (remaining.length !== queue.length) {
    await saveQueue(remaining);
  }
}

export async function getCachedUsers<T = unknown>(): Promise<T | null> {
  const data = await localforage.getItem<T>(USERS_CACHE_KEY);
  return (data as T) ?? null;
}

export async function setCachedUsers<T = unknown>(data: T) {
  await localforage.setItem(USERS_CACHE_KEY, data);
}


