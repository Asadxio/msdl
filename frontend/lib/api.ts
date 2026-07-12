const API_BASE_URL = String(
  process.env.EXPO_PUBLIC_API_BASE_URL
  || process.env.EXPO_PUBLIC_LIVE_API_URL
  || process.env.EXPO_PUBLIC_PUSH_API_URL
  || '',
).trim().replace(/\/$/, '');

function normalizedApiBase(): string {
  if (!API_BASE_URL) {
    throw new Error('Production API base URL is not configured.');
  }
  return API_BASE_URL.endsWith('/api') ? API_BASE_URL : `${API_BASE_URL}/api`;
}

export function apiUrl(path: string): string {
  const safePath = String(path || '').startsWith('/') ? String(path || '') : `/${path}`;
  return `${normalizedApiBase()}${safePath}`;
}

export function actionNonce(prefix = 'action'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export interface ApiRequestOptions extends RequestInit {
  timeoutMs?: number;
  retries?: number;
}

/**
 * Unified API request layer with consistent timeout, retry backoff, and error normalization.
 */
export async function apiRequest<T = any>(
  endpoint: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  const { timeoutMs = 15000, retries = 2, ...fetchOptions } = options;
  const url = endpoint.startsWith('http') ? endpoint : apiUrl(endpoint);

  let attempt = 0;
  while (true) {
    attempt++;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...(fetchOptions.headers || {}),
        },
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        if (attempt <= retries && response.status >= 500) {
          await new Promise((res) => setTimeout(res, 300 * attempt));
          continue;
        }
        const errorText = await response.text().catch(() => '');
        throw new Error(`API Error ${response.status}: ${errorText || response.statusText}`);
      }

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        return await response.json();
      }
      return (await response.text()) as unknown as T;
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (attempt <= retries && (err.name === 'AbortError' || err.message?.includes('Network request failed'))) {
        await new Promise((res) => setTimeout(res, 300 * attempt));
        continue;
      }
      throw err;
    }
  }
}
