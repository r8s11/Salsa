import { supabase, supabaseURL } from "../../../lib/supabase";

export const PROFILE_MEDIA_BUCKET = "profile-media";
export const MAX_PROFILE_MEDIA_BYTES = 5 * 1024 * 1024;

export const AVATAR_SIZE = 512;
export const COVER_WIDTH = 1600;
export const COVER_HEIGHT = 600;

const ALLOWED_MIME_TYPES: Record<string, true> = {
  "image/jpeg": true,
  "image/png": true,
  "image/webp": true,
};

const PUBLIC_OBJECT_PATH = `/storage/v1/object/public/${PROFILE_MEDIA_BUCKET}/`;

export type ProfileMediaKind = "avatar" | "cover";

/** Stable object paths — replacement overwrites, never accumulates history. */
export function avatarPath(ownerId: string): string {
  return `${ownerId}/avatar.webp`;
}

export function coverPath(ownerId: string): string {
  return `${ownerId}/cover.webp`;
}

export function mediaPathFor(ownerId: string, kind: ProfileMediaKind): string {
  return kind === "avatar" ? avatarPath(ownerId) : coverPath(ownerId);
}

/**
 * Pre-upload gate: MIME type (from the file's detected type, never the
 * extension) and byte size. The bucket's own MIME/size limits remain the
 * second enforcement layer. Decodability is checked during normalization.
 */
export function validateProfileImage(file: File): string | null {
  if (!ALLOWED_MIME_TYPES[file.type]) {
    return "Choose a JPEG, PNG, or WebP image.";
  }

  if (file.size > MAX_PROFILE_MEDIA_BYTES) {
    return "Image must be 5 MB or smaller.";
  }

  return null;
}

export interface CropGeometry {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

/**
 * Pure cover-crop geometry: scale the source to fill the target, then
 * center-crop. Never stretches. Kept pure (no canvas) so it is unit
 * testable without a DOM.
 */
export function computeCoverCrop(
  srcWidth: number,
  srcHeight: number,
  dstWidth: number,
  dstHeight: number
): CropGeometry {
  const scale = Math.max(dstWidth / srcWidth, dstHeight / srcHeight);
  const sw = dstWidth / scale;
  const sh = dstHeight / scale;
  return {
    sx: (srcWidth - sw) / 2,
    sy: (srcHeight - sh) / 2,
    sw,
    sh,
  };
}

/**
 * Normalize any supported image to a WebP blob at the target size using
 * cover-crop geometry. Orientation is honored via createImageBitmap so
 * phone photos do not arrive rotated.
 */
export async function normalizeToWebp(
  file: File | Blob,
  dstWidth: number,
  dstHeight: number
): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("We couldn't read this image. Try a different file.");
  }

  try {
    const crop = computeCoverCrop(bitmap.width, bitmap.height, dstWidth, dstHeight);
    const canvas = document.createElement("canvas");
    canvas.width = dstWidth;
    canvas.height = dstHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("We couldn't process this image. Try a different file.");
    ctx.drawImage(
      bitmap,
      crop.sx,
      crop.sy,
      crop.sw,
      crop.sh,
      0,
      0,
      dstWidth,
      dstHeight
    );
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", 0.85)
    );
    if (!blob) throw new Error("We couldn't process this image. Try a different file.");
    return blob;
  } finally {
    bitmap.close();
  }
}

export function normalizeAvatar(file: File): Promise<Blob> {
  return normalizeToWebp(file, AVATAR_SIZE, AVATAR_SIZE);
}

export function normalizeCover(file: File): Promise<Blob> {
  return normalizeToWebp(file, COVER_WIDTH, COVER_HEIGHT);
}

export function profileMediaPublicUrl(path: string): string {
  const { data } = supabase.storage.from(PROFILE_MEDIA_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Stable object names are cached by browsers/CDNs after replacement, so
 * every fresh upload URL carries a version query param. The stored value
 * stays a plain public URL plus `?v=<millis>`.
 */
export function withCacheBust(url: string, version: number = Date.now()): string {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}v=${version}`;
}

type UploadProfileMediaInput = {
  blob: Blob;
  ownerId: string;
  kind: ProfileMediaKind;
};

export async function uploadProfileMedia({
  blob,
  ownerId,
  kind,
}: UploadProfileMediaInput): Promise<{ path: string; url: string }> {
  const path = mediaPathFor(ownerId, kind);
  const { error } = await supabase.storage.from(PROFILE_MEDIA_BUCKET).upload(path, blob, {
    contentType: "image/webp",
    upsert: true,
  });

  if (error) {
    throw new Error(error.message);
  }

  return { path, url: withCacheBust(profileMediaPublicUrl(path)) };
}

/**
 * Validate → normalize → upload → versioned public URL. One call per kind
 * so avatar and cover keep their own target geometry.
 */
export async function uploadAvatarFile(file: File, ownerId: string): Promise<string> {
  const validationError = validateProfileImage(file);
  if (validationError) throw new Error(validationError);
  const blob = await normalizeAvatar(file);
  const { url } = await uploadProfileMedia({ blob, ownerId, kind: "avatar" });
  return url;
}

export async function uploadCoverFile(file: File, ownerId: string): Promise<string> {
  const validationError = validateProfileImage(file);
  if (validationError) throw new Error(validationError);
  const blob = await normalizeCover(file);
  const { url } = await uploadProfileMedia({ blob, ownerId, kind: "cover" });
  return url;
}

/**
 * Remove a stored object from a known stable path. The path must be exactly
 * `<ownerId>/avatar.webp` or `<ownerId>/cover.webp` — traversal-free by
 * construction, validated again before any delete is issued.
 */
export async function removeProfileMediaByPath(
  path: string | null | undefined
): Promise<void> {
  if (!path) return;
  if (path.startsWith("/") || path.includes("../")) return;
  const segments = path.split("/");
  if (segments.length !== 2) return;
  const [ownerId, filename] = segments;
  if (!ownerId || (filename !== "avatar.webp" && filename !== "cover.webp")) return;

  const { error } = await supabase.storage.from(PROFILE_MEDIA_BUCKET).remove([path]);
  if (error) {
    throw new Error(error.message);
  }
}

export async function removeAvatarFile(ownerId: string): Promise<void> {
  await removeProfileMediaByPath(avatarPath(ownerId));
}

export async function removeCoverFile(ownerId: string): Promise<void> {
  await removeProfileMediaByPath(coverPath(ownerId));
}

/**
 * Extract a storage path from a public `profile-media` object URL, or null
 * when the URL is not a same-origin object inside the bucket. Query params
 * (cache-busting `?v=`) are stripped. Guards against deleting objects in
 * other buckets or other origins.
 */
export function parseProfileMediaPath(url: string): string | null {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return null;
  }

  if (parsedUrl.origin !== supabaseURL || !parsedUrl.pathname.startsWith(PUBLIC_OBJECT_PATH)) {
    return null;
  }

  const path = decodeURIComponent(parsedUrl.pathname.slice(PUBLIC_OBJECT_PATH.length));
  if (!path || path.startsWith("/") || path.includes("../")) {
    return null;
  }

  return path;
}

/** Map raw Storage/processing failures to readable user-facing messages. */
export function profileMediaErrorMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  if (/row-level security|permission|policy|unauthorized|not authorized/i.test(message)) {
    return "You don't have permission to change this photo. Sign in again and try once more.";
  }
  if (/Bucket not found|bucket/i.test(message)) {
    return "Photo storage isn't ready yet. Try again in a moment.";
  }
  if (/too large|maximum|file size|5 MB/i.test(message)) {
    return "Image must be 5 MB or smaller.";
  }
  if (/JPEG, PNG, or WebP|mime|format/i.test(message)) {
    return "Choose a JPEG, PNG, or WebP image.";
  }
  if (/couldn't read|couldn't process/i.test(message)) {
    return message;
  }
  return "We couldn't save this photo. Try again.";
}
