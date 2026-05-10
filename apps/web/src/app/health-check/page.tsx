import type { HealthResponse } from '@expense/shared';

export const dynamic = 'force-dynamic';

interface FetchResult {
  ok: boolean;
  status: number;
  body: HealthResponse | { error: string };
}

async function fetchHealth(): Promise<FetchResult> {
  const apiBase = process.env.API_BASE_URL;
  const devJwt = process.env.DEV_JWT;

  if (!apiBase) return { ok: false, status: 0, body: { error: 'API_BASE_URL not set' } };
  if (!devJwt) return { ok: false, status: 0, body: { error: 'DEV_JWT not set' } };

  try {
    const res = await fetch(`${apiBase}/health`, {
      headers: { Authorization: `Bearer ${devJwt}` },
      cache: 'no-store',
    });
    if (!res.ok) {
      return { ok: false, status: res.status, body: { error: `API returned ${res.status}` } };
    }
    const body = (await res.json()) as HealthResponse;
    return { ok: true, status: res.status, body };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      body: { error: err instanceof Error ? err.message : String(err) },
    };
  }
}

export default async function HealthCheckPage() {
  const result = await fetchHealth();

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem' }}>
      <h1>API Health Check</h1>
      <p>
        Status: <strong>{result.ok ? 'OK' : 'FAIL'}</strong>
      </p>
      <pre style={{ background: '#f4f4f4', padding: '1rem', borderRadius: 4 }}>
        {JSON.stringify(result, null, 2)}
      </pre>
    </main>
  );
}
