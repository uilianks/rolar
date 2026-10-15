// Typed-enough fetch wrapper for the tatame API. The web sends cookies itself; Android attaches the
// session cookie that the Better Auth Expo plugin keeps in SecureStore.
import { Platform } from "react-native";

import { API_URL, authClient } from "./auth-client";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function api<T = unknown>(path: string, init: { method?: string; json?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (init.json !== undefined) headers["Content-Type"] = "application/json";
  if (Platform.OS !== "web") {
    const cookie = authClient.getCookie();
    if (cookie) headers.Cookie = await cookie;
  }
  const res = await fetch(`${API_URL}/api${path}`, {
    method: init.method ?? "GET",
    headers,
    body: init.json !== undefined ? JSON.stringify(init.json) : undefined,
    credentials: Platform.OS === "web" ? "include" : "omit",
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data?.error ?? `Erro ${res.status}`);
  return data as T;
}
