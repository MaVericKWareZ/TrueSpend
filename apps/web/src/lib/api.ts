import { getSession } from 'next-auth/react';
import type { Session } from 'next-auth';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
    message?: string,
  ) {
    super(message ?? `Request failed with status ${status}`);
    this.name = 'ApiError';
  }
}

export type SessionGetter = () => Promise<Session | null>;

export interface FetchApiInit extends Omit<RequestInit, 'headers'> {
  headers?: Record<string, string>;
  sessionGetter?: SessionGetter;
}

const apiBaseUrl = (): string => {
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (!url) throw new Error('NEXT_PUBLIC_API_URL is not set');
  return url.replace(/\/$/, '');
};

export async function fetchApi<T = unknown>(path: string, init: FetchApiInit = {}): Promise<T> {
  const getter = init.sessionGetter ?? (getSession as SessionGetter);
  const session = await getter();
  if (!session?.accessToken) {
    throw new Error('fetchApi: no active session');
  }

  const headers = new Headers(init.headers ?? {});
  headers.set('authorization', `Bearer ${session.accessToken}`);
  if (!headers.has('content-type') && init.body) {
    headers.set('content-type', 'application/json');
  }

  const res = await fetch(`${apiBaseUrl()}${path}`, { ...init, headers });
  let body: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  if (!res.ok) {
    throw new ApiError(res.status, body);
  }
  return body as T;
}
