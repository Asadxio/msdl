export function isLikelyOffline(err: unknown): boolean {
  const message = String((err as any)?.message || '').toLowerCase();
  const code = String((err as any)?.code || '').toLowerCase();
  return (
    code.includes('network-request-failed')
    || message.includes('network request failed')
    || message.includes('failed to fetch')
    || message.includes('networkerror')
    || message.includes('timed out')
  );
}

export function normalizeFirebaseError(err: unknown, fallback: string): string {
  if (isLikelyOffline(err)) {
    return 'Network is unavailable or slow. Please check your internet connection and try again.';
  }
  return String((err as any)?.message || fallback);
}

export async function withTimeout<T>(promise: Promise<T>, timeoutMs = 15000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Request timed out')), timeoutMs);
    });
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
