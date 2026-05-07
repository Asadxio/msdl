import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from '@/lib/firebase';

export async function uploadUriFile(params: {
  uri: string;
  path: string;
  contentType?: string;
}): Promise<string> {
  if (!isValidUploadUri(params?.uri)) {
    throw new Error('Invalid file URI for upload.');
  }
  const uploadOnce = async () => {
    const res = await fetch(params.uri);
    if (!res.ok) {
      throw new Error(`Failed to read file URI (${res.status}).`);
    }
    const blob = await res.blob();
    const fileRef = ref(storage, params.path);
    await uploadBytes(fileRef, blob, params.contentType ? { contentType: params.contentType } : undefined);
    return getDownloadURL(fileRef);
  };
  try {
    return await uploadOnce();
  } catch (error) {
    console.log('[Storage] uploadUriFile ERROR', error);
    try {
      return await uploadOnce();
    } catch (retryError) {
      console.log('[Storage] uploadUriFile RETRY ERROR', retryError);
      throw retryError;
    }
  }
}

export function isLocalFileUri(uri?: string | null): boolean {
  const value = String(uri || '').trim();
  return value.startsWith('file://') || value.startsWith('content://');
}

export function isHttpsUrl(uri?: string | null): boolean {
  const value = String(uri || '').trim();
  return value.startsWith('https://');
}

export function isValidUploadUri(uri?: string | null): boolean {
  const value = String(uri || '').trim();
  if (!value) return false;
  return isLocalFileUri(value) || value.startsWith('http://') || value.startsWith('https://');
}
