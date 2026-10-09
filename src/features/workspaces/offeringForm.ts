import {
  formatClock,
  type ClassLevel,
  type OfferingStatus,
  type PlanType,
  type PricePlan,
  type PricePlanInput,
  type PrivateOffer,
  type PrivateOfferInput,
  type SchoolClass,
  type SchoolClassInput,
  type Weekday,
} from "./model";

/** Field-keyed messages; a key is present only while that field is invalid. */
export type FieldErrors<K extends string> = Partial<Record<K, string>>;

const DOLLARS = /^\$?\s*(\d{1,7})(?:\.(\d{1,2}))?$/;

/**
 * "12.50" → 1250. Blank is `null` (no price); anything that is not plain
 * dollars-and-cents is `undefined` so the caller can say so.
 */
export function parseDollars(value: string): number | null | undefined {
  const text = value.trim();
  if (text === "") return null;
  const match = DOLLARS.exec(text);
  if (!match) return undefined;
  return Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
}

/** 2000 → "20", 1250 → "12.50", null → "". The inverse of parseDollars. */
export function dollarsFromCents(cents: number | null): string {
  if (cents === null) return "";
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
}

/** Whole numbers only; blank is `null`, junk is `undefined`. */
export function parseWholeNumber(value: string): number | null | undefined {
  const text = value.trim();
  if (text === "") return null;
  return /^\d{1,7}$/.test(text) ? Number(text) : undefined;
}

/** "19:30" + 90 → "7:30 PM – 9:00 PM". Wraps past midnight rather than lying about it. */
export function formatTimeRange(start: string, durationMinutes: number): string {
  const [hours, minutes] = start.split(":").map(Number);
  const end = (hours * 60 + minutes + durationMinutes) % (24 * 60);
  const endClock = `${String(Math.floor(end / 60)).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`;
  return `${formatClock(start)} – ${formatClock(endClock)}`;
}

export const PUBLIC_PATH_PREFIX = { school: "/s", venue: "/v", instructor: "/i" } as const;

const MIN_DURATION = 15;
const MAX_DURATION = 480;

function validateDuration(value: string): { minutes?: number; error?: string } {
  const minutes = parseWholeNumber(value);
  if (minutes === null || minutes === undefined || minutes < MIN_DURATION || minutes > MAX_DURATION) {
    return { error: `Enter whole minutes between ${MIN_DURATION} and ${MAX_DURATION}.` };
  }
  return { minutes };
}

function validateTitle(value: string, label: string): string | undefined {
  const length = value.trim().length;
  return length < 2 || length > 120 ? `${label} must be 2–120 characters.` : undefined;
}

function validateOptionalText(value: string, label: string, max: number): string | undefined {
  return value.trim().length > max ? `${label} must be ${max} characters or fewer.` : undefined;
}

function validatePrice(value: string, max: number, required: boolean): { cents?: number | null; error?: string } {
  const cents = parseDollars(value);
  if (cents === undefined) return { error: "Enter a price like 20 or 12.50." };
  if (cents === null) return required ? { error: "Enter a price." } : { cents: null };
  if (cents > max) return { error: `Prices run up to $${(max / 100).toLocaleString("en-US")}.` };
  return { cents };
}

/* ── Classes ─────────────────────────────────────────────── */

export type ClassForm = {
  title: string;
  weekday: string;
  start_time: string;
  duration: string;
  level: ClassLevel;
  style_term_id: string;
  instructor_name: string;
  room: string;
  drop_in: string;
  notes: string;
  status: OfferingStatus;
};

export type ClassField = keyof ClassForm;

export function blankClassForm(weekday: Weekday): ClassForm {
  return {
    title: "",
    weekday: String(weekday),
    start_time: "19:00",
    duration: "60",
    level: "all",
    style_term_id: "",
    instructor_name: "",
    room: "",
    drop_in: "",
    notes: "",
    status: "active",
  };
}

export function classFormFrom(entry: SchoolClass): ClassForm {
  return {
    title: entry.title,
    weekday: String(entry.weekday),
    start_time: entry.start_time,
    duration: String(entry.duration_minutes),
    level: entry.level,
    style_term_id: entry.style_term_id ?? "",
    instructor_name: entry.instructor_name ?? "",
    room: entry.room ?? "",
    drop_in: dollarsFromCents(entry.drop_in_cents),
    notes: entry.notes ?? "",
    status: entry.status,
  };
}

/** Either the payload school_offering_save takes, or the fields that need fixing. */
export function classInputFrom(
  form: ClassForm,
  existing: SchoolClass | null
): { input: SchoolClassInput } | { errors: FieldErrors<ClassField> } {
  const errors: FieldErrors<ClassField> = {};
  const title = validateTitle(form.title, "Title");
  if (title) errors.title = title;
  if (!/^[1-7]$/.test(form.weekday)) errors.weekday = "Choose a day.";
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(form.start_time)) errors.start_time = "Enter a start time.";
  const duration = validateDuration(form.duration);
  if (duration.error) errors.duration = duration.error;
  const price = validatePrice(form.drop_in, 1_000_000, false);
  if (price.error) errors.drop_in = price.error;
  const instructor = validateOptionalText(form.instructor_name, "Instructor", 200);
  if (instructor) errors.instructor_name = instructor;
  const room = validateOptionalText(form.room, "Room", 120);
  if (room) errors.room = room;
  const notes = validateOptionalText(form.notes, "Notes", 1000);
  if (notes) errors.notes = notes;
  if (Object.keys(errors).length > 0) return { errors };

  const instructorName = form.instructor_name.trim();
  return {
    input: {
      title: form.title.trim(),
      style_term_id: form.style_term_id || null,
      level: form.level,
      weekday: Number(form.weekday) as Weekday,
      start_time: form.start_time,
      duration_minutes: duration.minutes as number,
      // The link to an artist listing survives only while the name still is theirs.
      instructor_id:
        existing && existing.instructor_id && existing.instructor_name === instructorName
          ? existing.instructor_id
          : null,
      instructor_name: instructorName || null,
      room: form.room.trim() || null,
      drop_in_cents: price.cents as number | null,
      notes: form.notes.trim() || null,
      status: form.status,
    },
  };
}

/* ── Private lessons ─────────────────────────────────────── */

export type PrivateForm = {
  title: string;
  duration: string;
  price: string;
  instructor_name: string;
  notes: string;
  status: OfferingStatus;
};

export type PrivateField = keyof PrivateForm;

export const BLANK_PRIVATE_FORM: PrivateForm = {
  title: "",
  duration: "60",
  price: "",
  instructor_name: "",
  notes: "",
  status: "active",
};

export function privateFormFrom(offer: PrivateOffer): PrivateForm {
  return {
    title: offer.title,
    duration: String(offer.duration_minutes),
    price: dollarsFromCents(offer.price_cents),
    instructor_name: offer.instructor_name ?? "",
    notes: offer.notes ?? "",
    status: offer.status,
  };
}

export function privateInputFrom(
  form: PrivateForm,
  existing: PrivateOffer | null
): { input: PrivateOfferInput } | { errors: FieldErrors<PrivateField> } {
  const errors: FieldErrors<PrivateField> = {};
  const title = validateTitle(form.title, "Title");
  if (title) errors.title = title;
  const duration = validateDuration(form.duration);
  if (duration.error) errors.duration = duration.error;
  const price = validatePrice(form.price, 1_000_000, true);
  if (price.error) errors.price = price.error;
  const instructor = validateOptionalText(form.instructor_name, "Instructor", 200);
  if (instructor) errors.instructor_name = instructor;
  const notes = validateOptionalText(form.notes, "Notes", 1000);
  if (notes) errors.notes = notes;
  if (Object.keys(errors).length > 0) return { errors };

  const instructorName = form.instructor_name.trim();
  return {
    input: {
      title: form.title.trim(),
      duration_minutes: duration.minutes as number,
      price_cents: price.cents as number,
      instructor_id:
        existing && existing.instructor_id && existing.instructor_name === instructorName
          ? existing.instructor_id
          : null,
      instructor_name: instructorName || null,
      notes: form.notes.trim() || null,
      status: form.status,
    },
  };
}

/* ── Price plans ─────────────────────────────────────────── */

export type PlanForm = {
  name: string;
  plan_type: PlanType;
  price: string;
  class_count: string;
  valid_days: string;
  notes: string;
  status: OfferingStatus;
};

export type PlanField = keyof PlanForm;

export const BLANK_PLAN_FORM: PlanForm = {
  name: "",
  plan_type: "class_pack",
  price: "",
  class_count: "",
  valid_days: "",
  notes: "",
  status: "active",
};

export function planFormFrom(plan: PricePlan): PlanForm {
  return {
    name: plan.name,
    plan_type: plan.plan_type,
    price: dollarsFromCents(plan.price_cents),
    class_count: plan.class_count === null ? "" : String(plan.class_count),
    valid_days: plan.valid_days === null ? "" : String(plan.valid_days),
    notes: plan.notes ?? "",
    status: plan.status,
  };
}

export function planInputFrom(form: PlanForm): { input: PricePlanInput } | { errors: FieldErrors<PlanField> } {
  const errors: FieldErrors<PlanField> = {};
  const name = validateTitle(form.name, "Name");
  if (name) errors.name = name;
  const price = validatePrice(form.price, 10_000_000, true);
  if (price.error) errors.price = price.error;
  const classCount = parseWholeNumber(form.class_count);
  if (classCount === undefined || (classCount !== null && (classCount < 1 || classCount > 1000))) {
    errors.class_count = "Enter 1–1000 classes, or leave blank.";
  }
  const validDays = parseWholeNumber(form.valid_days);
  if (validDays === undefined || (validDays !== null && (validDays < 1 || validDays > 3660))) {
    errors.valid_days = "Enter 1–3660 days, or leave blank.";
  }
  const notes = validateOptionalText(form.notes, "Notes", 1000);
  if (notes) errors.notes = notes;
  if (Object.keys(errors).length > 0) return { errors };

  return {
    input: {
      name: form.name.trim(),
      plan_type: form.plan_type,
      price_cents: price.cents as number,
      class_count: classCount as number | null,
      valid_days: validDays as number | null,
      notes: form.notes.trim() || null,
      status: form.status,
    },
  };
}
