export function isValidHttpsUrl(raw: string): boolean {
  const value = String(raw || '').trim();
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export function normalizeGoogleDriveFileUrl(raw: string): string {
  const value = String(raw || '').trim();
  if (!value) return value;

  const fileIdMatch = value.match(/drive\.google\.com\/file\/d\/([^/]+)/i);
  if (fileIdMatch?.[1]) {
    return `https://drive.google.com/uc?export=download&id=${fileIdMatch[1]}`;
  }

  const openIdMatch = value.match(/[?&]id=([^&]+)/i);
  if (openIdMatch?.[1] && value.includes('drive.google.com')) {
    return `https://drive.google.com/uc?export=download&id=${openIdMatch[1]}`;
  }

  return value;
}
