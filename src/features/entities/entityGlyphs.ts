import { CalendarDays, Disc3, GraduationCap, Landmark, MapPin, Megaphone, Music, Repeat, UserRound, type LucideIcon } from "lucide-react";
import type { PublicEntityKind } from "./model";

/** One drawn glyph per entity kind, shared wherever a kind is shown without its label. */
export const ENTITY_GLYPHS: Record<PublicEntityKind, LucideIcon> = {
  event: CalendarDays, series: Repeat, organizer: Megaphone, venue: MapPin, school: GraduationCap,
  instructor: UserRound, dj: Disc3, city: Landmark, style: Music,
};
