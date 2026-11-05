import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Button from "../../../components/ui/Button";
import { Check, ChevronDown, LocateFixed, MapPin } from "lucide-react";
import { useCity } from "../../../contexts/useCity";
import { useActiveLocations, useMetroName } from "../hooks/useMetros";
import {
  eventCountLabel,
  formatDistance,
  metroShortCode,
  type MetroSlug,
  type RankedMetro,
} from "../model/metro";
import {
  NYC_CITY,
  NYC_SUBLOCATIONS,
  subLocationLabel,
  type SubLocation,
} from "../model/sublocation";
import { neighborhoodLabel, neighborhoodsForLocation, type Neighborhood } from "../model/neighborhood";
import type { ActiveLocation } from "../model/activeLocation";
import "./MetroExplorer.css";

/** Home and metro-home routes navigate on pick; every other page stays put. */
function isDiscoveryPath(pathname: string): boolean {
  return pathname === "/" || /^\/events\/[a-z0-9-]+\/?$/.test(pathname);
}

interface MetroExplorerProps {
  /** Visible trigger text. Defaults to the current metro name. */
  label?: string;
  /** Visual size of the trigger. */
  variant?: "pill" | "button" | "compact";
  className?: string;
  /** Extra action after a pick (e.g. closing the mobile menu). */
  onPicked?: () => void;
}

/**
 * "Explore other cities": a non-modal popover listing every metro with
 * approved upcoming events, nearest first when the visitor's approximate
 * area is known, plus an "Events near me" reset. public_active_metros and
 * public_active_locations limit discovery choices to approved upcoming
 * inventory without changing valid stored or linked selections.
 */
export default function MetroExplorer({
  label,
  variant = "button",
  className,
  onPicked,
}: MetroExplorerProps) {
  const {
    city,
    subLocation,
    neighborhood,
    source,
    activeMetros,
    activeMetrosError,
    activeMetrosLoadFailed,
    activeMetrosLoading,
    activeMetrosFetching,
    refetchActiveMetros,
    locationStatus,
    setCity,
    chooseNearMe,
  } = useCity();
  const metroName = useMetroName();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const locations = useActiveLocations(open);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const headingId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const locationRetryRef = useRef<HTMLButtonElement>(null);
  const locationRetryPending = useRef(false);

  const close = useCallback((restoreFocus: boolean) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close(true);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close]);
  const retryButtonRef = useRef<HTMLButtonElement>(null);
  const emptyStateRef = useRef<HTMLParagraphElement>(null);
  const retryPending = useRef(false);
  useEffect(() => {
    if (activeMetrosFetching || !retryPending.current) return;
    retryPending.current = false;
    if (activeMetrosLoadFailed || activeMetrosError) {
      retryButtonRef.current?.focus();
      return;
    }
    const firstCity = rootRef.current?.querySelector<HTMLButtonElement>(".metro-explorer__option");
    (firstCity ?? emptyStateRef.current)?.focus();
  }, [activeMetrosFetching, activeMetrosLoadFailed, activeMetrosError]);

  const retryActiveMetros = () => {
    retryPending.current = true;
    void refetchActiveMetros();
  };

  useEffect(() => {
    if (locations.fetching || !locationRetryPending.current) return;
    locationRetryPending.current = false;
    if (!open) return;
    if (locations.loadFailed || locations.refreshFailed) {
      locationRetryRef.current?.focus();
    } else {
      headingRef.current?.focus();
    }
  }, [locations.fetching, locations.loadFailed, locations.refreshFailed, open]);

  const retryLocations = () => {
    locationRetryPending.current = true;
    void locations.refetch();
  };


  const pick = (slug: MetroSlug, nextSubLocation: SubLocation | null = null, nextNeighborhood: string | null = null) => {
    setCity(slug, nextSubLocation, nextNeighborhood);
    if (isDiscoveryPath(pathname)) {
      const params = new URLSearchParams();
      if (nextSubLocation) params.set("borough", nextSubLocation);
      if (nextNeighborhood) params.set("neighborhood", nextNeighborhood);
      navigate(`/events/${slug}${params.size ? `?${params}` : ""}`);
    }
    close(true);
    onPicked?.();
  };

  const nearMe = () => {
    chooseNearMe();
    if (isDiscoveryPath(pathname)) navigate("/");
    close(true);
    onPicked?.();
  };

  const nearMeActive = source === "location" || source === "none-nearby";
  const nearMeHint =
    locationStatus === "denied"
      ? "Location is off in this browser. Pick a city below."
      : locationStatus === "unavailable"
        ? "We couldn't find your area. Pick a city below."
        : locationStatus === "locating"
          ? "Finding your area…"
          : nearMeActive
            ? "Using your approximate area."
            : "Uses your approximate area once. Nothing is stored.";

  const current = city ? metroName(city) : null;
  const currentSubLocation = subLocationLabel(subLocation);
  const currentLocation = [current, currentSubLocation, neighborhoodLabel(neighborhood)].filter(Boolean).join(" › ") || null;
  const triggerText = label ?? currentLocation ?? "Choose a city";

  return (
    <div
      ref={rootRef}
      className={`metro-explorer metro-explorer--${variant}${className ? ` ${className}` : ""}`}
    >
      <button
        ref={triggerRef}
        type="button"
        className={`metro-explorer__trigger${label ? "" : " metro-explorer__trigger--code"}`}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={label ? undefined : `Location: ${currentLocation ?? "none chosen"}. Explore other cities`}
        title={label ? undefined : (currentLocation ?? undefined)}
        onClick={() => setOpen((value) => !value)}
      >
        <MapPin size={16} aria-hidden="true" />
        <span className="metro-explorer__trigger-text metro-explorer__trigger-text--full">
          {triggerText}
        </span>
        {!label && (
          <span className="metro-explorer__trigger-text metro-explorer__trigger-text--short" aria-hidden="true">
            {current ? metroShortCode(current) : "Cities"}
          </span>
        )}
        <ChevronDown size={16} aria-hidden="true" className="metro-explorer__chevron" />
      </button>

      {open && (
        <div id={panelId} className="metro-explorer__panel" role="region" aria-labelledby={headingId}>
          <h2 ref={headingRef} id={headingId} className="metro-explorer__heading" tabIndex={-1}>
            Explore cities
          </h2>

          <button
            type="button"
            className={`metro-explorer__near${nearMeActive ? " is-current" : ""}`}
            onClick={nearMe}
            aria-pressed={nearMeActive}
            aria-describedby={`${panelId}-near-hint`}
          >
            <LocateFixed size={18} aria-hidden="true" />
            <span className="metro-explorer__near-text">Events near me</span>
          </button>
          <p id={`${panelId}-near-hint`} className="metro-explorer__hint">
            {nearMeHint}
          </p>

          {activeMetrosLoadFailed ? (
            <div className="metro-explorer__error" role="alert">
              <p>Cities didn&apos;t load. Try again to check current event listings.</p>
              <Button
                ref={retryButtonRef}
                variant="secondary"
                loading={activeMetrosFetching}
                loadingLabel="Trying again…"
                onClick={retryActiveMetros}
              >
                Try again
              </Button>
            </div>
          ) : (
            <>
              {activeMetrosLoading ? (
                <p className="metro-explorer__hint" role="status">Loading cities…</p>
              ) : activeMetrosError ? (
                <div className="metro-explorer__error" role="status">
                  <p>Couldn&apos;t refresh cities. Showing the last available list.</p>
                  <Button
                    ref={retryButtonRef}
                    variant="secondary"
                    loading={activeMetrosFetching}
                    loadingLabel="Trying again…"
                    onClick={retryActiveMetros}
                  >
                    Try again
                  </Button>
                </div>
              ) : activeMetrosFetching ? (
                <p className="metro-explorer__hint" role="status">Refreshing cities…</p>
              ) : null}
              {activeMetros.length > 0 && (
                locations.loadFailed || locations.refreshFailed ? (
                  <div className="metro-explorer__error" role={locations.loadFailed ? "alert" : "status"}>
                    <p>
                      {locations.loadFailed
                        ? "Boroughs and neighborhoods didn't load. You can still choose a city."
                        : "Couldn't refresh boroughs and neighborhoods. Showing the last available choices."}
                    </p>
                    <Button
                      ref={locationRetryRef}
                      variant="secondary"
                      loading={locations.fetching}
                      loadingLabel="Trying locations again…"
                      onClick={retryLocations}
                    >
                      Retry locations
                    </Button>
                  </div>
                ) : locations.loading ? (
                  <p className="metro-explorer__hint" role="status">Loading boroughs and neighborhoods…</p>
                ) : locations.fetching ? (
                  <p className="metro-explorer__hint" role="status">Refreshing boroughs and neighborhoods…</p>
                ) : null
              )}
              {activeMetros.length > 0 ? (
                <ul className="metro-explorer__list" aria-label="Cities with upcoming events">
                  {activeMetros.map((metro) => (
                    <MetroOption
                      key={metro.slug}
                      metro={metro}
                      current={metro.slug === city}
                      subLocation={metro.slug === city ? subLocation : null}
                      neighborhood={metro.slug === city ? neighborhood : null}
                      locations={locations.activeLocations}
                      onPick={pick}
                    />
                  ))}
                </ul>
              ) : !activeMetrosLoading ? (
                <p ref={emptyStateRef} className="metro-explorer__hint" role="status" tabIndex={-1}>
                  No cities with upcoming events yet.
                </p>
              ) : null}
            </>
          )}

          <p className="metro-explorer__footer">
            Don&apos;t see your city?{" "}
            <Link to="/submit" onClick={() => close(false)}>
              Submit an event
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}

type PickLocation = (slug: MetroSlug, borough?: SubLocation | null, neighborhood?: string | null) => void;

function MetroOption({
  metro, current, subLocation, neighborhood, locations, onPick,
}: {
  metro: RankedMetro;
  current: boolean;
  subLocation: SubLocation | null;
  neighborhood: string | null;
  locations: readonly ActiveLocation[];
  onPick: PickLocation;
}) {
  const distance = formatDistance(metro.distanceKm);
  const allCurrent = current && !subLocation && !neighborhood;
  const [expanded, setExpanded] = useState(current && Boolean(subLocation || neighborhood));
  const sublistId = useId();
  const boroughs = metro.slug === NYC_CITY;
  const cityLocations = locations.filter((location) => location.city === metro.slug && location.upcomingEventCount > 0);
  const activeBoroughs = NYC_SUBLOCATIONS.filter((borough) =>
    cityLocations.some((location) => location.subLocation === borough.slug)
  );
  const areas = neighborhoodsForLocation(metro.slug, null).filter((area) =>
    cityLocations.some((location) => location.subLocation === null && location.neighborhood === area.slug)
  );
  const hasChildren = boroughs ? activeBoroughs.length > 0 : areas.length > 0;
  return (
    <li>
      <button
        type="button"
        className={`metro-explorer__option${allCurrent ? " is-current" : ""}`}
        aria-current={allCurrent ? "true" : undefined}
        onClick={() => onPick(metro.slug)}
      >
        <span className="metro-explorer__option-name">
          {metro.name}
          {metro.stateRegion && <span className="metro-explorer__option-region">, {metro.stateRegion}</span>}
        </span>
        <span className="metro-explorer__option-meta">
          {eventCountLabel(metro.upcomingEventCount)}
          {distance && ` · ${distance}`}
        </span>
        {allCurrent && <Check size={16} aria-hidden="true" className="metro-explorer__check" />}
      </button>
      {hasChildren && (
        <>
          <button
            type="button"
            className="metro-explorer__sublocation metro-explorer__disclosure"
            aria-expanded={expanded}
            aria-controls={sublistId}
            onClick={() => setExpanded((value) => !value)}
          >
            <span>{boroughs ? "NYC boroughs" : `${metro.name} neighborhoods`}</span>
            <ChevronDown size={16} aria-hidden="true" />
          </button>
          {expanded && (
            <ul id={sublistId} className="metro-explorer__sublist" aria-label={boroughs ? "New York City boroughs" : `${metro.name} neighborhoods`}>
              <li>
                <SubLocationOption name={`All ${metro.slug === NYC_CITY ? "NYC" : metro.name}`} current={allCurrent} onPick={() => onPick(metro.slug)} />
              </li>
              {boroughs ? activeBoroughs.map((location) => (
                <BoroughOption
                  key={location.slug}
                  city={metro.slug}
                  borough={location}
                  current={current && subLocation === location.slug}
                  neighborhood={neighborhood}
                  onPick={onPick}
                  areas={neighborhoodsForLocation(metro.slug, location.slug).filter((area) =>
                    cityLocations.some((entry) => entry.subLocation === location.slug && entry.neighborhood === area.slug)
                  )}
                />
              )) : (
                <NeighborhoodOptions city={metro.slug} borough={null} areas={areas} current={current ? neighborhood : null} onPick={onPick} />
              )}
            </ul>
          )}
        </>
      )}
    </li>
  );
}

function BoroughOption({ city, borough, current, neighborhood, areas, onPick }: {
  city: string;
  borough: { slug: SubLocation; name: string };
  current: boolean;
  neighborhood: string | null;
  areas: readonly Neighborhood[];
  onPick: PickLocation;
}) {
  const [expanded, setExpanded] = useState(current && Boolean(neighborhood));
  const listId = useId();
  return (
    <li>
      <SubLocationOption name={borough.name} current={current && !neighborhood} onPick={() => onPick(city, borough.slug)} />
      {areas.length > 0 && <button
        type="button"
        className="metro-explorer__sublocation metro-explorer__disclosure"
        aria-expanded={expanded}
        aria-controls={listId}
        onClick={() => setExpanded((value) => !value)}
      >
        <span>{borough.name} neighborhoods</span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>}
      {areas.length > 0 && expanded && (
        <ul id={listId} className="metro-explorer__sublist" aria-label={`${borough.name} neighborhoods`}>
          <li>
            <SubLocationOption name={`All ${borough.name}`} current={current && !neighborhood} onPick={() => onPick(city, borough.slug)} />
          </li>
          <NeighborhoodOptions city={city} borough={borough.slug} areas={areas} current={current ? neighborhood : null} onPick={onPick} />
        </ul>
      )}
    </li>
  );
}

function NeighborhoodOptions({ city, borough, areas, current, onPick }: {
  city: string;
  borough: SubLocation | null;
  current: string | null;
  areas: readonly Neighborhood[];
  onPick: PickLocation;
}) {
  return areas.map((area) => (
    <li key={area.slug}>
      <SubLocationOption name={area.name} current={current === area.slug} onPick={() => onPick(city, borough, area.slug)} />
    </li>
  ));
}

function SubLocationOption({
  name,
  current,
  onPick,
}: {
  name: string;
  current: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      className={`metro-explorer__sublocation${current ? " is-current" : ""}`}
      aria-current={current ? "true" : undefined}
      onClick={onPick}
    >
      <span>{name}</span>
      {current && <Check size={15} aria-hidden="true" />}
    </button>
  );
}
