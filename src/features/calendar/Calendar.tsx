import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCalendarApp, ScheduleXCalendar } from "@schedule-x/react";
import {
  createViewDay,
  createViewWeek,
  createViewMonthGrid,
  createViewMonthAgenda,
  createViewList,
} from "@schedule-x/calendar";
import { createEventsServicePlugin } from "@schedule-x/events-service";
import { createCalendarControlsPlugin } from "@schedule-x/calendar-controls";
import { useSearchParams } from "react-router-dom";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import "temporal-polyfill/global";
import "./Calendar.css";
import "@schedule-x/theme-default/dist/index.css";
import { ScheduleXEvent, CALENDARS_CONFIG, EventType } from "../../types/events";
import { filterEventsByType, TypeFilter } from "../../utils/filterEvents";
import { getUpcomingSeriesDates } from "../../utils/series";
import { useCity } from "../../contexts/useCity";
import { useActiveMetros, useMetroName, useMetros } from "../metros/hooks/useMetros";
import EventModal from "../events/components/event-modal/EventModal";
import EventCard from "../events/components/EventCard";
import CalendarListView from "./components/CalendarListView";
import { EventManager, type CalendarView } from "../../components/ui/event-manager";
import RubberSegment from "../../components/ui/RubberSegment";
import CalendarSubmissionDialog from "./components/CalendarSubmissionDialog";
import { useEvents } from "../events/hooks/useEvent";
import {
  canonicalUrl,
  generateEventsListStructuredData,
  injectStructuredData,
} from "../../utils/seo";
import { useDocumentMeta } from "../../shared/seo/useDocumentMeta";
import { useEventDeepLink } from "./hooks/useEventDeepLink";
import { usePeriodTravel } from "./hooks/usePeriodTravel";
import CalendarStatus from "./components/CalendarStatus";
import CalendarSidebar from "./components/CalendarSidebar";
import {
  calendarPeriodRange,
  formatPeriodLabel,
  countEventsByType,
  availableDanceStyles,
  filterEventsByDanceStyle,
  countEventsInRange,
  eventCountLabel as formatEventCountLabel,
} from "./model/calendarSidebar";
import { clampEndToStartDay } from "./model/eventSpan";
import { sortCalendarEvents } from "./model/calendarEvents";

const TYPE_OPTIONS: { value: TypeFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "social", label: "Social" },
  { value: "class", label: "Class" },
  { value: "workshop", label: "Workshop" },
  { value: "live_music", label: "Live Music" },
];

// The compact list/cards switch (Schedule-X list view + toolbar) and the
// desktop filter sidebar are separate breakpoints: between them (tablet
// widths) the calendar grid still needs its full width, so filtering stays
// in the compact toolbar instead of a stacked full-width sidebar.
const COMPACT_QUERY =
  "(max-width: 768px), (max-width: 1023px) and (max-height: 500px) and (pointer: coarse)";
const SIDEBAR_QUERY = "(min-width: 1024px)";

type CalendarOccurrence = ScheduleXEvent & { sourceEventId?: ScheduleXEvent["id"] };

// Case- and accent-insensitive: "salon" finds "Salón", "música" finds "Musica".
function foldForSearch(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase();
}

export default function Calendar() {
  const { activeMetros } = useActiveMetros();
  const { metros, loading: metrosLoading } = useMetros();
  const [initialCompact] = useState(() => window.matchMedia(COMPACT_QUERY).matches);
  const [hasSidebar, setHasSidebar] = useState(() => window.matchMedia(SIDEBAR_QUERY).matches);
  const pageRef = useRef<HTMLDivElement>(null);
  const [selectedEvent, setSelectedEvent] = useState<ScheduleXEvent | null>(null);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [styleFilter, setStyleFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [submissionOpen, setSubmissionOpen] = useState(false);
  const [isCompact, setIsCompact] = useState(initialCompact);
  const [activeView, setActiveView] = useState<CalendarView>(
    initialCompact ? "list" : "month-grid"
  );
  const [visibleDate, setVisibleDate] = useState<Temporal.PlainDate>(() =>
    Temporal.Now.plainDateISO()
  );
  const [searchParams, setSearchParams] = useSearchParams();
  const { city, setCity } = useCity();
  const {
    events: eventList,
    loading,
    fetching,
    error,
    loadFailed,
    refetch,
  } = useEvents();
  const metroName = useMetroName();

  // The raw driver message is for us, not for dancers: log it, never render it.
  useEffect(() => {
    if (error) console.warn(`Calendar feed failed to load (${city}):`, error);
  }, [error, city]);

  useEffect(() => {
    document.body.classList.add("calendar-page-open");
    return () => document.body.classList.remove("calendar-page-open");
  }, []);
  const eventListRef = useRef<CalendarOccurrence[]>(eventList);
  const cityParameterHandled = useRef(false);
  const [eventsService] = useState(() => createEventsServicePlugin());
  const [calendarControls] = useState(() => createCalendarControlsPlugin());
  const filteredEvents = useMemo(() => {
    const query = foldForSearch(searchQuery.trim());
    return filterEventsByDanceStyle(filterEventsByType(eventList, typeFilter), styleFilter).filter(
      (event) =>
        !query ||
        [event.title, event.location, event.description, ...(event.danceStyles ?? [])].some(
          (value) => value && foldForSearch(value).includes(query)
        )
    );
  }, [eventList, typeFilter, styleFilter, searchQuery]);

  const expandedEvents = useMemo(() => {
    const now = Temporal.Now.zonedDateTimeISO();
    const cutoff = now.add({ weeks: 12 });
    const expanded: CalendarOccurrence[] = [];

    for (const event of filteredEvents) {
      expanded.push(event);

      if (event.recurrence !== "weekly") continue;

      const originalStart = Temporal.PlainDateTime.from(event.start.replace(" ", "T"));
      const originalEnd = Temporal.PlainDateTime.from(event.end.replace(" ", "T"));
      const durationMinutes = originalEnd.since(originalStart).total({ unit: "minutes" });
      const upcomingDates = getUpcomingSeriesDates(event.start, 12);

      for (const futureDate of upcomingDates) {
        const futureZdt = futureDate.toZonedDateTime("America/New_York");
        if (Temporal.PlainDateTime.compare(futureZdt, cutoff.toPlainDateTime()) > 0) break;

        const endDate = futureDate.add({ minutes: Math.round(durationMinutes) });

        expanded.push({
          ...event,
          id: `${event.id}-w${upcomingDates.indexOf(futureDate) + 1}`,
          sourceEventId: event.id,
          start: futureDate.toString().replace("T", " "),
          end: endDate.toString().replace("T", " "),
        });
      }
    }

    return expanded;
  }, [filteredEvents]);
  const sortedEvents = useMemo(() => sortCalendarEvents(expandedEvents), [expandedEvents]);

  useEffect(() => {
    eventListRef.current = expandedEvents;
  }, [expandedEvents]);

  const openOccurrence = useCallback((event: CalendarOccurrence) => {
    setSelectedEvent({ ...event, id: event.sourceEventId ?? event.id });
  }, []);

  const calendar = useCalendarApp({
    views: [
      createViewDay(),
      createViewWeek(),
      createViewMonthGrid(),
      createViewMonthAgenda(),
      createViewList(),
    ],
    defaultView: initialCompact ? "list" : "month-grid",
    events: [],
    calendars: CALENDARS_CONFIG,
    plugins: [eventsService, calendarControls],
    selectedDate: Temporal.Now.plainDateISO(),
    isDark: true,
    locale: "en-US",
    timezone: "America/New_York",
    theme: "shadcn",
    firstDayOfWeek: 1,
    // Period travel is owned by usePeriodTravel: Schedule-X's own slide also
    // fires on view switches (same date) and ignores reduced motion.
    skipAnimations: true,
    callbacks: {
      onEventClick(calendarEvent) {
        const fullEvent = eventListRef.current.find(
          (item) => String(item.id) === String(calendarEvent.id)
        );
        if (fullEvent) openOccurrence(fullEvent);
      },
    },
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia(COMPACT_QUERY);
    const handleChange = (event: MediaQueryListEvent) => {
      const nextView: CalendarView = event.matches ? "list" : "month-grid";
      setIsCompact(event.matches);
      setActiveView(nextView);
      calendarControls.setView(nextView);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [calendarControls]);

  useEffect(() => {
    const mediaQuery = window.matchMedia(SIDEBAR_QUERY);
    const handleChange = (event: MediaQueryListEvent) => setHasSidebar(event.matches);
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    if (cityParameterHandled.current || metrosLoading) return;
    cityParameterHandled.current = true;
    const requestedCity = searchParams.get("city");
    if (
      requestedCity &&
      metros.some((metro) => metro.slug === requestedCity) &&
      requestedCity !== city
    ) {
      setCity(requestedCity);
    }
  }, [city, searchParams, setCity, metrosLoading, metros]);

  useEffect(() => {
    eventsService.set(
      expandedEvents.map((event) => {
        const start = Temporal.PlainDateTime.from(event.start.replace(" ", "T"));
        const end = Temporal.PlainDateTime.from(event.end.replace(" ", "T"));
        return {
          ...event,
          start: start.toZonedDateTime("America/New_York"),
          end: clampEndToStartDay(start, end).toZonedDateTime("America/New_York"),
        };
      })
    );
  }, [eventsService, expandedEvents]);

  useEffect(() => {
    injectStructuredData(generateEventsListStructuredData(eventList), "events-list-data");
  }, [eventList]);

  const handleClosedModal = useCallback(() => {
    setSelectedEvent(null);
    if (searchParams.has("event")) {
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        next.delete("event");
        return next;
      }, { replace: true });
    }
  }, [setSearchParams, searchParams]);

  const navigatePeriod = (direction: -1 | 0 | 1) => {
    const next =
      direction === 0
        ? Temporal.Now.plainDateISO()
        : activeView === "week"
          ? visibleDate.add({ weeks: direction })
          : visibleDate.add({ months: direction });
    setVisibleDate(next);
    calendarControls.setDate(next);
  };

  const handleViewChange = (view: CalendarView) => {
    setActiveView(view);
    if (view !== "cards") {
      calendarControls.setView(view);
    }
  };

  useDocumentMeta({
    title: "Dance Calendar — Salsa, Bachata & Latin Dance Events",
    description:
      "Browse upcoming salsa, bachata, and Latin dance socials, classes, and workshops across Greater Boston and New York City.",
    canonical: canonicalUrl("/calendar"),
  });
  useEventDeepLink(eventList, setSelectedEvent);

  const cityLabel = city ? metroName(city) : null;
  const monthTitle = visibleDate.toLocaleString("en-US", { month: "long", year: "numeric" });
  // A failed background refresh keeps the last good feed on screen; only a
  // load with nothing to show blocks the calendar.
  const ready = !loading && !loadFailed;
  const isEmpty = ready && eventList.length === 0;
  const hasNoMatches = ready && eventList.length > 0 && filteredEvents.length === 0;
  const showCalendar =
    ready &&
    expandedEvents.length > 0 &&
    activeView !== "cards" &&
    activeView !== "list";
  const showList = ready && expandedEvents.length > 0 && activeView === "list";
  const showCards = ready && expandedEvents.length > 0 && activeView === "cards";
  const today = Temporal.Now.plainDateISO();
  const periodRange = calendarPeriodRange(
    visibleDate,
    activeView === "cards" ? "month-grid" : activeView,
    today
  );
  const periodLabel = formatPeriodLabel(periodRange);
  const isFeedView = activeView === "list" || activeView === "cards";
  const periodTitle = isFeedView
    ? "Upcoming events"
    : activeView === "week" ? periodLabel : monthTitle;
  usePeriodTravel(pageRef, visibleDate, periodTitle);
  const typeCountsInStyleContext = countEventsByType(
    filterEventsByDanceStyle(eventList, styleFilter)
  );
  const sidebarTypeOptions = TYPE_OPTIONS.filter((option) => option.value !== "all").map(
    (option) => ({
      value: option.value as EventType,
      label: option.label,
      count: typeCountsInStyleContext[option.value as EventType] ?? 0,
    })
  );
  const sidebarStyleOptions = availableDanceStyles(eventList);
  const weekEventCount = countEventsInRange(expandedEvents, today, today.add({ days: 6 }));
  const sidebarEventCountLabel = formatEventCountLabel(weekEventCount);
  const FilterPanel = isCompact ? "details" : "div";
  const activeFilterCount = Number(typeFilter !== "all") + Number(styleFilter !== "all");

  return (
    <div className="calendar-page" ref={pageRef}>
      <header className="stage-header">
        <div className="stage-inner">
          <div className="stage-left">
            <h1 className="stage-title">
              Dance calendar<span className="calendar-title-dot">.</span>
            </h1>
            <p className="stage-accent">salsa &amp; bachata, hasta la madrugada</p>
          </div>
          <div className="stage-controls">
            <RubberSegment
              className="pill-group calendar-city-switch"
              role="group"
              aria-label="City"
              items={activeMetros.map((metro) => metro.slug)}
              value={city ?? undefined}
              itemSelector=".pill"
              fitHeight
            >
              {activeMetros.map((option) => (
                <button
                  type="button"
                  key={option.slug}
                  className={`pill ${city === option.slug ? "pill-active-city" : ""}`}
                  aria-pressed={city === option.slug}
                  onClick={() => setCity(option.slug)}
                >
                  {option.name}
                </button>
              ))}
            </RubberSegment>
          </div>
        </div>
      </header>

      <div className="calendar-body">
        {hasSidebar && (
          <CalendarSidebar
            periodLabel={isFeedView ? "Upcoming events" : periodLabel}
            typeOptions={sidebarTypeOptions}
            typeFilter={typeFilter}
            onTypeFilterChange={setTypeFilter}
            styleOptions={sidebarStyleOptions}
            styleFilter={styleFilter}
            onStyleFilterChange={setStyleFilter}
            eventCountLabel={sidebarEventCountLabel}
          />
        )}
        <div className="calendar-content">
          <EventManager
            title={periodTitle}
            view={activeView}
            compact={isCompact}
            onViewChange={handleViewChange}
            onNavigate={navigatePeriod}
            onEventCreate={() => setSubmissionOpen(true)}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            filters={
              !hasSidebar && (
                <FilterPanel className="calendar-filter-panel">
                  {isCompact && (
                    <summary className="calendar-filter-toggle">
                      <SlidersHorizontal size={18} aria-hidden />
                      <span>Filters</span>
                      <span className="calendar-filter-context">
                        {activeFilterCount ? `${activeFilterCount} active` : "All events"}
                      </span>
                      <ChevronDown className="calendar-filter-chevron" size={16} aria-hidden />
                    </summary>
                  )}
                  <div
                    className="pill-group calendar-type-pills"
                    role="group"
                    aria-label="Filter by event type"
                  >
                    {TYPE_OPTIONS.map((option) => (
                      <button
                        type="button"
                        key={option.value}
                        className={`pill ${typeFilter === option.value ? "pill-active-type" : ""}`}
                        aria-pressed={typeFilter === option.value}
                        onClick={() => setTypeFilter(option.value)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  <label className="calendar-style-select">
                    Dance style
                    <select
                      value={styleFilter}
                      onChange={(event) => setStyleFilter(event.target.value)}
                    >
                      <option value="all">Every style</option>
                      {sidebarStyleOptions.map((style) => (
                        <option key={style} value={style}>
                          {style}
                        </option>
                      ))}
                    </select>
                  </label>
                </FilterPanel>
              )
            }
          >
            <CalendarStatus
              loading={loading}
              loadFailed={loadFailed}
              retrying={fetching}
              isEmpty={isEmpty}
              hasNoMatches={hasNoMatches}
              cityLabel={cityLabel}
              onRetry={() => void refetch()}
              onClearFilter={() => {
                setTypeFilter("all");
                setStyleFilter("all");
                setSearchQuery("");
              }}
            />

            {showCalendar && (
              <div className="calendar-main">
                <ScheduleXCalendar calendarApp={calendar} />
              </div>
            )}
            {showList && <CalendarListView events={sortedEvents} onSelect={openOccurrence} />}

            {showCards && (
              <div className="calendar-card-view" aria-label="Events as cards">
                <div className="calendar-card-grid">
                  {sortedEvents.map((event) => (
                    <EventCard key={event.id} event={event} onSelect={openOccurrence} />
                  ))}
                </div>
              </div>
            )}
          </EventManager>
        </div>
      </div>

      <EventModal event={selectedEvent} onClose={handleClosedModal} />
      <CalendarSubmissionDialog open={submissionOpen} onOpenChange={setSubmissionOpen} />
    </div>
  );
}
