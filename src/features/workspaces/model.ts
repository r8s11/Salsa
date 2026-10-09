/**
 * Entity workspaces: the listings (schools, venues, instructors) a signed-in
 * person manages, and the school offerings they keep current. Mirrors
 * supabase/migrations/20261008000000_entity_workspaces.sql — the RPCs there
 * are the source of truth for every permission named here.
 */

export type ManagedKind = "school" | "venue" | "instructor";
export const MANAGED_KINDS: readonly ManagedKind[] = ["school", "venue", "instructor"];

export type EntityMemberRole = "owner" | "manager" | "editor";
/** The caller's standing on one listing; platform admins act as owner everywhere. */
export type WorkspaceRole = EntityMemberRole | "admin";

/** People-facing name of each kind. Instructors are "Artists" in the product. */
export const MANAGED_KIND_LABELS: Record<ManagedKind, string> = {
  school: "School",
  venue: "Venue",
  instructor: "Artist",
};

export const MEMBER_ROLE_LABELS: Record<EntityMemberRole, string> = {
  owner: "Owner",
  manager: "Manager",
  editor: "Editor",
};

/** URL segment under /host for each kind's workspace. */
export const WORKSPACE_SEGMENTS: Record<ManagedKind, string> = {
  school: "schools",
  venue: "venues",
  instructor: "instructors",
};

export type WorkspaceSection = "timetable" | "privates" | "prices" | "profile" | "team";

/** `/host/schools/:id`, `/host/schools/:id/timetable`, … */
export function workspacePath(kind: ManagedKind, id: string, section?: WorkspaceSection): string {
  const base = `/host/${WORKSPACE_SEGMENTS[kind]}/${id}`;
  return section ? `${base}/${section}` : base;
}

/**
 * owner/manager (and admins) edit the public profile. Every role, editors
 * included, may edit school offerings — editors exist for front-desk upkeep.
 */
export function canEditProfile(role: WorkspaceRole): boolean {
  return role !== "editor";
}

/** Only owners (and admins) change who is on the team. */
export function canManageTeam(role: WorkspaceRole): boolean {
  return role === "admin" || role === "owner";
}

export type EntityMembership = {
  kind: ManagedKind;
  id: string;
  name: string;
  slug: string;
  status: "active" | "needs_review";
  city: string | null;
  image_url: string | null;
  member_role: EntityMemberRole;
};

export type WorkspaceMember = {
  user_id: string;
  email: string;
  display_name: string | null;
  member_role: EntityMemberRole;
  created_at: string;
};

export type WorkspaceEvent = {
  id: string;
  slug: string;
  title: string;
  event_date: string;
  city: string;
  location: string | null;
  image_url: string | null;
};

export type SchoolProfile = {
  id: string;
  name: string;
  slug: string;
  status: string;
  city: string | null;
  state_region: string | null;
  country: string | null;
  address_line1: string | null;
  postal_code: string | null;
  website: string | null;
  instagram: string | null;
  phone: string | null;
  description: string | null;
  image_url: string | null;
};

export type VenueProfile = {
  id: string;
  name: string;
  slug: string;
  status: string;
  city: string | null;
  state_region: string | null;
  country: string | null;
  address_line1: string | null;
  address_line2: string | null;
  postal_code: string | null;
  website: string | null;
  instagram: string | null;
  phone: string | null;
};

export type InstructorProfile = {
  id: string;
  name: string;
  slug: string;
  status: string;
  city: string | null;
  state_region: string | null;
  country: string | null;
  organization: string | null;
  website: string | null;
  instagram: string | null;
  description: string | null;
  image_url: string | null;
};

/** Fields entity_profile_save accepts per kind; name, slug, city and status stay admin-only. */
export type ProfilePatch = {
  school: Partial<Pick<SchoolProfile, "description" | "image_url" | "website" | "instagram" | "phone" | "address_line1" | "postal_code">>;
  venue: Partial<Pick<VenueProfile, "website" | "instagram" | "phone" | "address_line1" | "address_line2" | "postal_code">>;
  instructor: Partial<Pick<InstructorProfile, "description" | "image_url" | "website" | "instagram" | "organization">>;
};

export type ClassLevel = "all" | "beginner" | "improver" | "intermediate" | "advanced" | "open";
export const CLASS_LEVEL_LABELS: Record<ClassLevel, string> = {
  all: "All levels",
  beginner: "Beginner",
  improver: "Improver",
  intermediate: "Intermediate",
  advanced: "Advanced",
  open: "Open level",
};

/** ISO weekday: 1 = Monday … 7 = Sunday. */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export const WEEKDAY_LABELS: Record<Weekday, string> = {
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
  7: "Sunday",
};

export type OfferingStatus = "active" | "paused";

export type SchoolClass = {
  id: string;
  title: string;
  style_term_id: string | null;
  style_name: string | null;
  level: ClassLevel;
  weekday: Weekday;
  /** "HH:MM", 24-hour, in the school's local time. */
  start_time: string;
  duration_minutes: number;
  instructor_id: string | null;
  instructor_name: string | null;
  instructor_slug: string | null;
  room: string | null;
  drop_in_cents: number | null;
  notes: string | null;
  status: OfferingStatus;
};

export type PrivateOffer = {
  id: string;
  title: string;
  duration_minutes: number;
  price_cents: number;
  instructor_id: string | null;
  instructor_name: string | null;
  instructor_slug: string | null;
  notes: string | null;
  status: OfferingStatus;
  position: number;
};

export type PlanType = "drop_in" | "class_pack" | "membership" | "bootcamp" | "other";
export const PLAN_TYPE_LABELS: Record<PlanType, string> = {
  drop_in: "Drop-in",
  class_pack: "Class pack",
  membership: "Membership",
  bootcamp: "Bootcamp",
  other: "Other",
};

export type PricePlan = {
  id: string;
  name: string;
  plan_type: PlanType;
  price_cents: number;
  class_count: number | null;
  valid_days: number | null;
  notes: string | null;
  status: OfferingStatus;
  position: number;
};

export type SchoolOfferings = { classes: SchoolClass[]; privates: PrivateOffer[]; plans: PricePlan[] };

type WorkspaceBase = { role: WorkspaceRole; members: WorkspaceMember[]; upcoming: WorkspaceEvent[] };
export type EntityWorkspace =
  | (WorkspaceBase & { kind: "school"; entity: SchoolProfile; offerings: SchoolOfferings })
  | (WorkspaceBase & { kind: "venue"; entity: VenueProfile; offerings: null })
  | (WorkspaceBase & { kind: "instructor"; entity: InstructorProfile; offerings: null });

/** Payloads school_offering_save accepts. `id` absent = create. */
export type SchoolClassInput = Omit<SchoolClass, "id" | "style_name" | "instructor_slug">;
export type PrivateOfferInput = Omit<PrivateOffer, "id" | "instructor_slug" | "position"> & { position?: number };
export type PricePlanInput = Omit<PricePlan, "id" | "position"> & { position?: number };
export type OfferingType = "class" | "private" | "plan";

/** What a dancer sees on /s/:slug. Paused offerings never appear. */
export type PublicSchoolOfferings = {
  classes: Omit<SchoolClass, "style_term_id" | "instructor_id" | "status">[];
  privates: Omit<PrivateOffer, "instructor_id" | "status" | "position">[];
  plans: Omit<PricePlan, "status" | "position">[];
};

export type ClaimRelationship = "owner" | "manager" | "staff" | "self";
export const CLAIM_RELATIONSHIP_LABELS: Record<ClaimRelationship, string> = {
  owner: "I own it",
  manager: "I manage it",
  staff: "I work there",
  self: "This is me",
};

export type ClaimStatus = "pending" | "approved" | "rejected" | "withdrawn";

export type EntityClaim = {
  id: string;
  kind: ManagedKind;
  entity_id: string;
  name: string;
  slug: string;
  relationship: ClaimRelationship;
  status: ClaimStatus;
  review_note: string | null;
  created_at: string;
  reviewed_at: string | null;
};

export type AdminEntityClaim = {
  id: string;
  kind: ManagedKind;
  entity_id: string;
  entity_name: string;
  entity_slug: string;
  entity_city: string | null;
  entity_status: string;
  user_id: string;
  email: string;
  display_name: string | null;
  relationship: ClaimRelationship;
  message: string | null;
  status: ClaimStatus;
  review_note: string | null;
  reviewed_at: string | null;
  created_at: string;
  active_owner_count: number;
};

const USD_WHOLE = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const USD_CENTS = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });

/** 2000 → "$20", 1250 → "$12.50". Prices are stored as integer cents. */
export function formatCents(cents: number): string {
  return (cents % 100 === 0 ? USD_WHOLE : USD_CENTS).format(cents / 100);
}

/** "19:30" → "7:30 PM". */
export function formatClock(value: string): string {
  const [hours, minutes] = value.split(":").map(Number);
  const suffix = hours >= 12 ? "PM" : "AM";
  return `${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${suffix}`;
}
