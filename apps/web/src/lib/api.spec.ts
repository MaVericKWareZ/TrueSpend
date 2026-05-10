import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError, fetchApi } from './api';

describe('fetchApi', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_URL = 'http://api.test';
    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const sessionGetter = (accessToken?: string) =>
    async () => (accessToken ? { accessToken, user: { id: 'u', email: 'e', name: 'n' } } : null);

  it('calls fetch with the configured base URL + path', async () => {
    fetchSpy.mockResolvedValueOnce(new Response('{"ok":true}', { status: 200 }));
    await fetchApi('/health', { sessionGetter: sessionGetter('tok') });
    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url] = fetchSpy.mock.calls[0]!;
    expect(url).toBe('http://api.test/health');
  });

  it('attaches Authorization: Bearer <accessToken>', async () => {
    fetchSpy.mockResolvedValueOnce(new Response('{}', { status: 200 }));
    await fetchApi('/x', { sessionGetter: sessionGetter('the-token') });
    const init = fetchSpy.mock.calls[0]![1] as RequestInit;
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer the-token');
  });

  it('returns parsed JSON on 200', async () => {
    fetchSpy.mockResolvedValueOnce(new Response('{"hello":"world"}', { status: 200 }));
    const body = await fetchApi<{ hello: string }>('/x', { sessionGetter: sessionGetter('tok') });
    expect(body).toEqual({ hello: 'world' });
  });

  it('throws ApiError with status 401 on 401', async () => {
    fetchSpy.mockResolvedValueOnce(new Response('{"message":"nope"}', { status: 401 }));
    let caught: unknown;
    try {
      await fetchApi('/x', { sessionGetter: sessionGetter('tok') });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ApiError);
    expect((caught as ApiError).status).toBe(401);
  });

  it('throws ApiError with the response status on non-OK responses', async () => {
    fetchSpy.mockResolvedValueOnce(new Response('{"error":"x"}', { status: 409 }));
    await expect(
      fetchApi('/x', { sessionGetter: sessionGetter('tok') }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('throws upfront when the session getter returns null', async () => {
    await expect(
      fetchApi('/x', { sessionGetter: sessionGetter(undefined) }),
    ).rejects.toThrow(/no active session/i);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('merges custom headers without dropping Authorization', async () => {
    fetchSpy.mockResolvedValueOnce(new Response('{}', { status: 200 }));
    await fetchApi('/x', {
      sessionGetter: sessionGetter('tok'),
      headers: { 'x-custom': 'yes' },
    });
    const init = fetchSpy.mock.calls[0]![1] as RequestInit;
    const headers = new Headers(init.headers);
    expect(headers.get('authorization')).toBe('Bearer tok');
    expect(headers.get('x-custom')).toBe('yes');
  });
});
