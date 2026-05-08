import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { storage } from "@/lib/firebase";

type UploadUriFileParams = {
  uri: string;
  path: string;
  contentType?: string;
  maxBytes?: number;
  customMetadata?: Record<string, string>;
  onProgress?: (progress: number) => void;
};

const DEFAULT_MAX_BYTES = 20 * 1024 * 1024;
const SUPPORTED_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/quicktime",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

function normalizeContentType(contentType?: string): string {
  const safe = String(contentType || "")
    .toLowerCase()
    .trim();
  if (!safe) return "application/octet-stream";
  if (safe === "image/jpg") return "image/jpeg";
  return safe;
}

function normalizeStorageError(error: any): Error {
  const code = error?.code || "storage/unknown";
  const serverMessage = error?.serverResponse
    ? ` ${String(error.serverResponse).slice(0, 180)}`
    : "";
  const message = error?.message || "Upload failed.";
  if (code === "storage/unauthorized") {
    return new Error(
      "Upload permission denied. Please sign in again and retry.",
    );
  }
  if (code === "storage/quota-exceeded") {
    return new Error("Storage quota exceeded. Please contact support.");
  }
  if (code === "storage/retry-limit-exceeded" || code === "storage/canceled") {
    return new Error(
      "Upload was interrupted. Please check your connection and retry.",
    );
  }
  return new Error(`${message}${serverMessage}`.trim());
}

async function readUriAsBlob(uri: string): Promise<Blob> {
  try {
    const res = await fetch(uri);
    if (!res.ok) {
      throw new Error(`Failed to read file URI (${res.status}).`);
    }
    return await res.blob();
  } catch (fetchError) {
    if (!isLocalFileUri(uri)) throw fetchError;
    return await new Promise<Blob>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.onload = () => resolve(xhr.response as Blob);
      xhr.onerror = () =>
        reject(new Error("Unable to read the selected local file."));
      xhr.responseType = "blob";
      xhr.open("GET", uri, true);
      xhr.send(null);
    });
  }
}

export async function uploadUriFile(
  params: UploadUriFileParams,
): Promise<string> {
  if (!isValidUploadUri(params?.uri)) {
    throw new Error("Invalid file URI for upload.");
  }
  if (!params?.path || params.path.includes("//")) {
    throw new Error("Invalid storage path for upload.");
  }

  const contentType = normalizeContentType(params.contentType);
  const maxBytes = params.maxBytes || DEFAULT_MAX_BYTES;
  if (
    contentType !== "application/octet-stream" &&
    !SUPPORTED_CONTENT_TYPES.has(contentType)
  ) {
    throw new Error(
      "Unsupported file type. Please choose a PDF, DOC, DOCX, JPG, PNG, or WebP file.",
    );
  }

  const uploadOnce = async () => {
    params.onProgress?.(0.05);
    const blob = await readUriAsBlob(params.uri);
    if (!blob || blob.size === 0) {
      throw new Error("Selected file is empty or unreadable.");
    }
    if (blob.size > maxBytes) {
      throw new Error(
        `Selected file is too large. Maximum allowed size is ${Math.round(maxBytes / 1024 / 1024)}MB.`,
      );
    }
    const fileRef = ref(storage, params.path);
    const task = uploadBytesResumable(fileRef, blob, {
      contentType,
      customMetadata: {
        source: "expo",
        uploaded_at_ms: String(Date.now()),
        ...(params.customMetadata || {}),
      },
    });

    await new Promise<void>((resolve, reject) => {
      task.on(
        "state_changed",
        (snapshot) => {
          const ratio =
            snapshot.totalBytes > 0
              ? snapshot.bytesTransferred / snapshot.totalBytes
              : 0;
          params.onProgress?.(Math.min(0.95, Math.max(0.08, ratio * 0.95)));
        },
        (error) => reject(normalizeStorageError(error)),
        () => resolve(),
      );
    });
    const downloadUrl = await getDownloadURL(fileRef);
    params.onProgress?.(1);
    return downloadUrl;
  };

  try {
    return await uploadOnce();
  } catch (error) {
    console.log("[Storage] uploadUriFile ERROR", error);
    try {
      await new Promise((resolve) => setTimeout(resolve, 450));
      return await uploadOnce();
    } catch (retryError) {
      console.log("[Storage] uploadUriFile RETRY ERROR", retryError);
      throw normalizeStorageError(retryError);
    }
  }
}

export function isLocalFileUri(uri?: string | null): boolean {
  const value = String(uri || "").trim();
  return value.startsWith("file://") || value.startsWith("content://");
}

export function isHttpsUrl(uri?: string | null): boolean {
  const value = String(uri || "").trim();
  return value.startsWith("https://");
}

export function isValidUploadUri(uri?: string | null): boolean {
  const value = String(uri || "").trim();
  if (!value) return false;
  return (
    isLocalFileUri(value) ||
    value.startsWith("http://") ||
    value.startsWith("https://")
  );
}
