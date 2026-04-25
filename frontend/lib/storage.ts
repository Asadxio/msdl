import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from '@/lib/firebase';

export async function uploadUriFile(params: {
  uri: string;
  path: string;
  contentType?: string;
}): Promise<string> {
  try {
    const res = await fetch(params.uri);
    const blob = await res.blob();
    const fileRef = ref(storage, params.path);
    await uploadBytes(fileRef, blob, params.contentType ? { contentType: params.contentType } : undefined);
    return getDownloadURL(fileRef);
  } catch (error) {
    console.log('[Storage] uploadUriFile ERROR', error);
    throw error;
  }
}
