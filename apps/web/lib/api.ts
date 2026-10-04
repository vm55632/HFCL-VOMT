// Minimal API client. Sends the session cookie (credentials: include) and, when Supabase Auth is
// configured, a Bearer access token so the API can verify the Supabase-issued JWT.
import { getAccessToken, supabaseAuthEnabled } from './supabase';

export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function apiFetch<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const authHeader: Record<string, string> = {};
  if (supabaseAuthEnabled) {
    const token = await getAccessToken();
    if (token) authHeader.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...authHeader, ...(options.headers ?? {}) },
    ...options,
  });
  const text = await res.text();
  const body = text ? (JSON.parse(text) as unknown) : null;
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    if (body && typeof body === 'object' && 'error' in body) {
      message = String((body as { error: unknown }).error);
    }
    throw new ApiError(res.status, message);
  }
  return body as T;
}

export const oidcStartUrl = `${API_BASE}/auth/oidc/start`;
