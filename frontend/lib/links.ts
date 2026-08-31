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

export function normalizeUrlWithProtocol(raw: string): string {
  const value = String(raw || '').trim();
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value}`;
}

export function normalizeMeetUrl(raw: string): string {
  const value = normalizeUrlWithProtocol(raw);
  if (!value) return '';
  return value.replace(/^http:\/\/meet\.google\.com/i, 'https://meet.google.com');
}

export function prepareExternalUrl(raw: string): string | null {
  const normalized = normalizeUrlWithProtocol(raw);
  if (!normalized) return null;
  return isValidHttpsUrl(normalized) ? normalized : null;
}

export const WHATSAPP_HELP_URL = 'https://wa.link/mrtyi1';
export const MADRASA_WEBSITE_URL = 'https://madrasa-website-299.netlify.app/';

export function normalizeWhatsAppUrl(raw: string): string | null {
  const value = String(raw || '').trim();
  if (!value) return null;
  if (/^whatsapp:\/\//i.test(value)) return value;
  if (/^https?:\/\//i.test(value)) {
    return prepareExternalUrl(value);
  }
  const digits = value.replace(/[^0-9]/g, '');
  if (digits.length >= 8) return `https://wa.me/${digits}`;
  return prepareExternalUrl(value);
}
