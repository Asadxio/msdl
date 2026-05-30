const API_BASE_URL = String(
  process.env.EXPO_PUBLIC_API_BASE_URL
  || process.env.EXPO_PUBLIC_LIVE_API_URL
  || process.env.EXPO_PUBLIC_PUSH_API_URL
  || process.env.EXPO_PUBLIC_LIVE_APL_URL
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
