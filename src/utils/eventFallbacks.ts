export type FallbackTemplate = "dance" | "percussion" | "band" | "tropical" | "minimal";

type FallbackEvent = {
  id: string | number | null | undefined;
  title?: string | null;
  calendarId?: string | null;
  danceStyles?: readonly string[] | null;
};

const ALL_TEMPLATES: FallbackTemplate[] = [
  "dance",
  "percussion",
  "band",
  "tropical",
  "minimal",
];

/**
 * Keyword → preferred template mapping. Checked in order; more specific
 * categories precede broad ones so "Tropical Salsa Night" stays tropical.
 */
const KEYWORD_RULES: Array<{ keywords: readonly string[]; template: FallbackTemplate }> = [
  { keywords: ["live", "band", "orchestra", "concert", "music"], template: "band" },
  { keywords: ["class", "lesson", "workshop", "beginner", "learn"], template: "minimal" },
  { keywords: ["rumba", "percussion", "drum", "conga", "bongo", "timbales", "cowbell"], template: "percussion" },
  { keywords: ["tropical", "caribbean"], template: "tropical" },
  { keywords: ["bachata", "sensual", "romantic"], template: "dance" },
  { keywords: ["social", "mambo", "cumbia", "salsa", "night", "party"], template: "dance" },
];

/**
 * Returns a stable fallback template. Event wording can select a contextual
 * category; otherwise the event ID is hashed so the result never changes
 * between renders or browser sessions.
 */
export function getFallbackTemplate(event: FallbackEvent): FallbackTemplate {
  const searchableText = [event.title, event.calendarId, ...(event.danceStyles ?? [])]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  for (const rule of KEYWORD_RULES) {
    if (rule.keywords.some((keyword) => searchableText.includes(keyword))) {
      return rule.template;
    }
  }

  const id = String(event.id ?? "");
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = id.charCodeAt(index) + ((hash << 5) - hash);
  }

  return ALL_TEMPLATES[Math.abs(hash) % ALL_TEMPLATES.length];
}

export function getEventFallbackAltText(title: string): string {
  return `Salsa Segura artwork for ${title}`;
}
