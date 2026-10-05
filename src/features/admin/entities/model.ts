export const ADMIN_ENTITY_KINDS = ["series", "organizer", "school", "instructor"] as const;
export type EntityKind = (typeof ADMIN_ENTITY_KINDS)[number];
export type EntityStatus = "active" | "needs_review" | "archived" | "suspended";

export interface AdminLinkedEvent {
  id: string;
  title: string;
  status: string;
  event_date: string;
}

export interface AdminEntityRow {
  id: string;
  kind: EntityKind;
  name: string;
  slug: string | null;
  status: EntityStatus;
  description: string | null;
  image_url: string | null;
  city: string | null;
  website: string | null;
  instagram: string | null;
  address?: string | null;
  address_line1?: string | null;
  state_region?: string | null;
  country?: string | null;
  phone?: string | null;
  organization?: string | null;
  category?: string | null;
  venue_id?: string | null;
  organizer_id?: string | null;
  quality_issues: string[];
  linked_events: AdminLinkedEvent[];
}

export type EntityForm = {
  name: string;
  slug: string;
  status: EntityStatus;
  description: string;
  image_url: string;
  city: string;
  website: string;
  instagram: string;
  state_region: string;
  country: string;
  address: string;
  phone: string;
  organization: string;
  category: string;
  venue_id: string;
  organizer_id: string;
};

export const ENTITY_LABELS: Record<EntityKind, { singular: string; plural: string }> = {
  series: { singular: "Series", plural: "Series" },
  organizer: { singular: "Organizer", plural: "Organizers" },
  school: { singular: "School", plural: "Schools" },
  instructor: { singular: "Instructor", plural: "Instructors" },
};

export const QUALITY_ISSUE_LABELS: Record<string, string> = {
  missing_city: "Missing city",
  missing_description: "Missing description",
  missing_image: "Missing image",
  missing_website: "Missing website",
  missing_slug: "Missing public URL slug",
  possible_duplicate: "Possible duplicate",
  missing_location: "Missing location",
  missing_contact: "Missing contact information",
  missing_organization: "Missing organization",
};

export function qualityIssueLabel(issue: string): string {
  return QUALITY_ISSUE_LABELS[issue] ?? issue.replace(/_/g, " ").replace(/^./, (letter) => letter.toUpperCase());
}

export function buildEntityForm(row?: AdminEntityRow | null): EntityForm {
  return {
    name: row?.name ?? "",
    slug: row?.slug ?? "",
    status: row?.status ?? "needs_review",
    description: row?.description ?? "",
    image_url: row?.image_url ?? "",
    city: row?.city ?? "",
    website: row?.website ?? "",
    instagram: row?.instagram ?? "",
    state_region: row?.state_region ?? "",
    country: row?.country ?? "",
    address: row?.address ?? row?.address_line1 ?? "",
    phone: row?.phone ?? "",
    organization: row?.organization ?? "",
    category: row?.category ?? "",
    venue_id: row?.venue_id ?? "",
    organizer_id: row?.organizer_id ?? "",
  };
}

export function entityPayload(kind: EntityKind, form: EntityForm): Record<string, string | null> {
  const common = {
    name: form.name.trim(),
    slug: form.slug.trim() || null,
    status: form.status,
    description: form.description.trim() || null,
    image_url: form.image_url.trim() || null,
    city: form.city.trim() || null,
    website: form.website.trim() || null,
    instagram: form.instagram.trim() || null,
  };
  if (kind === "series") {
    return {
      name: common.name,
      slug: common.slug,
      status: common.status,
      description: common.description,
      image_url: common.image_url,
      city: common.city,
      venue_id: form.venue_id || null,
      organizer_id: form.organizer_id || null,
    };
  }
  if (kind === "organizer") {
    return { ...common, state_region: form.state_region.trim() || null, country: form.country.trim() || null, category: form.category.trim() || null };
  }
  if (kind === "school") {
    return {
      name: common.name,
      slug: common.slug,
      status: common.status,
      description: common.description,
      image_url: common.image_url,
      city: common.city,
      state_region: form.state_region.trim() || null,
      country: form.country.trim() || null,
      address: form.address.trim() || null,
      website: common.website,
      instagram: common.instagram,
      phone: form.phone.trim() || null,
    };
  }
  return {
    name: common.name,
    slug: common.slug,
    status: common.status,
    description: common.description,
    image_url: common.image_url,
    city: common.city,
    state_region: form.state_region.trim() || null,
    country: form.country.trim() || null,
    organization: form.organization.trim() || null,
    website: common.website,
    instagram: common.instagram,
  };
}

export function validateEntityForm(form: EntityForm): string | null {
  if (!form.name.trim()) return "Name is required.";
  for (const [label, value] of [["Website", form.website], ["Image URL", form.image_url]] as const) {
    if (value.trim() && !/^https?:\/\/\S+$/.test(value.trim())) return `${label} must be a valid HTTP or HTTPS URL.`;
  }
  return null;
}
