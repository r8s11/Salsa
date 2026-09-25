import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Check, ChevronDown, LocateFixed, MapPin } from "lucide-react";
import { useCity } from "../../../contexts/useCity";
import { useMetroName } from "../hooks/useMetros";
import {
  eventCountLabel,
  formatDistance,
  type MetroSlug,
  type RankedMetro,
} from "../model/metro";
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
 * area is known, plus an "Events near me" reset. Driven entirely by
 * public_active_metros — a new metro appears here as soon as it has an
 * approved upcoming event.
 */
export default function MetroExplorer({
  label,
  variant = "button",
  className,
  onPicked,
}: MetroExplorerProps) {
  const { city, source, activeMetros, activeMetrosError, locationStatus, setCity, chooseNearMe } =
    useCity();
  const metroName = useMetroName();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const headingId = useId();

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

  const pick = (slug: MetroSlug) => {
    setCity(slug);
    if (isDiscoveryPath(pathname)) navigate(`/events/${slug}`);
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
  const triggerText = label ?? current ?? "Choose a city";

  return (
    <div
      ref={rootRef}
      className={`metro-explorer metro-explorer--${variant}${className ? ` ${className}` : ""}`}
    >
      <button
        ref={triggerRef}
        type="button"
        className="metro-explorer__trigger"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={label ? undefined : `City: ${current ?? "none chosen"}. Explore other cities`}
        onClick={() => setOpen((value) => !value)}
      >
        <MapPin size={16} aria-hidden="true" />
        <span className="metro-explorer__trigger-text">{triggerText}</span>
        <ChevronDown size={16} aria-hidden="true" className="metro-explorer__chevron" />
      </button>

      {open && (
        <div id={panelId} className="metro-explorer__panel" role="region" aria-labelledby={headingId}>
          <h2 id={headingId} className="metro-explorer__heading">
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

          {activeMetrosError ? (
            <p className="metro-explorer__hint" role="alert">
              Cities didn&apos;t load. Try again in a moment.
            </p>
          ) : (
            <ul className="metro-explorer__list" aria-label="Cities with upcoming events">
              {activeMetros.map((metro) => (
                <MetroOption
                  key={metro.slug}
                  metro={metro}
                  current={metro.slug === city}
                  onPick={pick}
                />
              ))}
            </ul>
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

function MetroOption({
  metro,
  current,
  onPick,
}: {
  metro: RankedMetro;
  current: boolean;
  onPick: (slug: MetroSlug) => void;
}) {
  const distance = formatDistance(metro.distanceKm);
  return (
    <li>
      <button
        type="button"
        className={`metro-explorer__option${current ? " is-current" : ""}`}
        aria-current={current ? "true" : undefined}
        onClick={() => onPick(metro.slug)}
      >
        <span className="metro-explorer__option-name">
          {metro.name}
          {metro.stateRegion && (
            <span className="metro-explorer__option-region">, {metro.stateRegion}</span>
          )}
        </span>
        <span className="metro-explorer__option-meta">
          {eventCountLabel(metro.upcomingEventCount)}
          {distance && ` · ${distance}`}
        </span>
        {current && <Check size={16} aria-hidden="true" className="metro-explorer__check" />}
      </button>
    </li>
  );
}
