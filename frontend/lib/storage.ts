import { runMediaUpload } from "@/lib/mediaPipeline";

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

  const uploadId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const uploadOnce = async () => {
    const category = params.path.startsWith('chat_media/') ? 'chat'
      : params.path.startsWith('status_updates/') ? 'status'
      : params.path.startsWith('users/') ? 'profile'
      : params.path.startsWith('assignment_submissions/') ? 'assignment'
      : params.path.startsWith('course_materials/') ? 'course'
      : 'recording';
    return runMediaUpload({
      uploadId,
      uri: params.uri,
      path: params.path,
      contentType,
      category,
      maxBytes,
    }, (p) => params.onProgress?.(p.progress));
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
