import { supabase } from "./supabase";

export type FieldError = {
  path: string;
  message: string;
};

export class ApiError extends Error {
  status: number;
  details?: FieldError[];

  constructor(status: number, message: string, details?: FieldError[]) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

let onUnauthorized = () => {};

export function setUnauthorizedHandler(handler: () => void): void {
  onUnauthorized = handler;
}

export function apiBase(): string {
  if (import.meta.env.DEV) return "/api";
  const url = import.meta.env.VITE_API_URL?.trim().replace(/\/$/, "");
  if (!url) throw new ApiError(0, "Missing VITE_API_URL");
  if (!url.startsWith("https://")) throw new ApiError(0, "VITE_API_URL must use https");
  return url;
}

export function wakeServer(): void {
  void fetch(`${apiBase()}/health`, { cache: "no-store", credentials: "omit" }).catch(() => {});
}

type ApiOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
};

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  if (!supabase) throw new ApiError(0, "Missing Supabase settings");

  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    onUnauthorized();
    throw new ApiError(401, "Missing bearer token");
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";

  let response: Response;
  try {
    response = await fetch(`${apiBase()}${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
      cache: "no-store",
      credentials: "omit",
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError(0, "The server is not responding yet. Wait a moment and try again.");
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text) as unknown;
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const body = payload as { error?: string; details?: { path?: string; message?: string }[] } | null;
    const details = body?.details?.flatMap((detail) => {
      if (!detail.message) return [];
      return [{ path: detail.path ?? "", message: detail.message }];
    });
    const message = body?.error || `Request failed (${response.status})`;
    if (response.status === 401) onUnauthorized();
    throw new ApiError(response.status, message, details);
  }

  return payload as T;
}

export function errorText(error: unknown): string {
  if (error instanceof ApiError) {
    const extra = error.details?.map((detail) => detail.message) ?? [];
    if (extra.length > 0) return `${error.message}: ${extra.join(" ")}`;
    return error.message;
  }
  if (error instanceof DOMException && error.name === "AbortError") return "Cancelled";
  return "Something went wrong";
}
