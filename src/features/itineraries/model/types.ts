export type IsoWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type ItineraryStatus = "draft" | "published" | "archived";
export type ItineraryItemRole = "featured" | "alternative";

export interface ItineraryItem {
  eventId: string;
  role: ItineraryItemRole;
  position: number;
  note: string | null;
}

export interface ItineraryDraft {
  id: string | null;
  city: string;
  weekStart: string;
  timeZone: string;
  title: string;
  description: string | null;
  recommendations: string | null;
  unfeaturedDays: IsoWeekday[];
  items: ItineraryItem[];
}

export interface Itinerary extends Omit<ItineraryDraft, "id" | "items"> {
  id: string;
  status: ItineraryStatus;
  coverImageUrl: string | null;
  coverGeneratedAt: string | null;
  publishedAt: string | null;
  updatedAt: string;
}
