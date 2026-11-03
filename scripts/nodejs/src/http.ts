// JSON over fetch with error messages that never echo response bodies or tokens.

export type FetchLike = typeof fetch;

export interface RequestJsonOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  fetch?: FetchLike;
}

export async function requestJson(url: string, {
  method = 'POST', headers = {}, body, fetch: fetchImpl = fetch,
}: RequestJsonOptions = {}): Promise<unknown> {
  let response: Response;
  try {
    response = await fetchImpl(url, {
      method, redirect: 'error',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    });
  } catch (error) {
    const err = error as { cause?: { code?: unknown }; name?: unknown };
    const code = String(err.cause?.code || err.name);
    const safeCode = /^[A-Z_a-z0-9]+$/.test(code) ? code : 'NETWORK_ERROR';
    throw new Error(`${new URL(url).pathname}: ${safeCode} (TLS verification remains enabled).`);
  }
  let data: unknown;
  try { data = await response.json(); } catch {
    throw new Error(`HTTP ${response.status}: expected JSON response`);
  }
  // Some legacy responses contain JSON encoded as a string.
  if (typeof data === 'string') {
    try { data = JSON.parse(data); } catch { /* validated by caller */ }
  }
  if (!response.ok) {
    const code = (data as { error?: { message?: unknown } } | null)?.error?.message;
    const safeCode = typeof code === 'string' && /^[A-Z_0-9 :.-]{1,120}$/.test(code) ? ` (${code})` : '';
    throw new Error(`HTTP ${response.status}${safeCode}`);
  }
  return data;
}
