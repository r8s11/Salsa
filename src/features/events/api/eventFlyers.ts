import { supabase, supabaseURL } from "../../../lib/supabase";

export const EVENT_FLYERS_BUCKET = "event-flyers";
export const MAX_EVENT_FLYER_BYTES = 5 * 1024 * 1024;

const ALLOWED_MIME_TYPES: Record<string, true> = {
  "image/jpeg": true,
  "image/png": true,
  "image/webp": true,
};
const PUBLIC_OBJECT_PATH = `/storage/v1/object/public/${EVENT_FLYERS_BUCKET}/`;

type UploadEventFlyerInput = {
  file: File;
  ownerId: string;
  eventId: string;
};

export function validateEventFlyer(file: File): string | null {
  if (!ALLOWED_MIME_TYPES[file.type]) {
    return "Choose a JPEG, PNG, or WebP image.";
  }

  if (file.size > MAX_EVENT_FLYER_BYTES) {
    return "Image must be 5 MB or smaller.";
  }

  return null;
}

export async function uploadEventFlyer({
  file,
  ownerId,
  eventId,
}: UploadEventFlyerInput): Promise<{ path: string; url: string }> {
  const validationError = validateEventFlyer(file);
  if (validationError) {
    throw new Error(validationError);
  }

  const extension = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
  const path = `${ownerId}/${eventId}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from(EVENT_FLYERS_BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });

  if (error) {
    throw new Error(error.message);
  }

  const { data } = supabase.storage.from(EVENT_FLYERS_BUCKET).getPublicUrl(path);
  return { path, url: data.publicUrl };
}

export async function removeEventFlyer(url: string): Promise<void> {
  const path = parseEventFlyerPath(url);
  if (!path) return;

  const { error } = await supabase.storage.from(EVENT_FLYERS_BUCKET).remove([path]);
  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Remove a stored flyer from a known storage path (e.g. `ownerId/eventId/uuid.ext`)
 * rather than a public URL. Use this for cleanup during replace/remove when the
 * path is already known, avoiding a round-trip parse from a URL.
 *
 * The path is validated to be a non-empty, non-absolute, traversal-free
 * `ownerId/eventId/file` segment before any delete is issued.
 */
export async function removeEventFlyerByPath(path: string | null | undefined): Promise<void> {
  if (!path || path.startsWith("/") || path.includes("../")) return;

  const { error } = await supabase.storage.from(EVENT_FLYERS_BUCKET).remove([path]);
  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Extract a storage path from a public `event-flyers` object URL, or return
 * null when the URL is not a same-origin object inside the bucket. Guards
 * against deleting objects in other buckets or other origins.
 */
export function parseEventFlyerPath(url: string): string | null {
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
