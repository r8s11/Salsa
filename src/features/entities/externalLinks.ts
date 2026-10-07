import type { PublicEntityRef } from "./model";

/**
 * Safe outbound links for an entity: the website only when it is an http(s)
 * URL, Instagram normalised from a handle, @handle, or profile URL to the
 * canonical profile URL. Anything else is dropped rather than linked.
 */
export function entityExternalLinks(entity: Pick<PublicEntityRef, "website" | "instagram">): {
  website: string | null;
  instagram: string | null;
} {
  const website = entity.website && /^https?:\/\//i.test(entity.website) ? entity.website : null;
  const handle = entity.instagram
    ?.replace(/^https?:\/\/(?:www\.)?instagram\.com\//i, "")
    .replace(/^@/, "")
    .replace(/\/$/, "");
  const instagram = handle && /^[a-z0-9._]+$/i.test(handle) ? `https://www.instagram.com/${handle}/` : null;
  return { website, instagram };
}
