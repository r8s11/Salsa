import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Check, Share2 } from "lucide-react";
import type { ProfileMedia } from "../model";
import { ProfileMediaStrip } from "./ProfileMediaStrip";
import "./ProfileShell.css";

export type ProfileLink = { label: string; href: string };

type Props = {
  variant: "school" | "instructor" | "dj";
  titleId: string;
  crumb: { label: string; to: string };
  name: string;
  where?: string;
  tagline?: string | null;
  imageUrl: string | null;
  /** Style chips and similar, under the tagline. */
  chips?: ReactNode;
  /** Rendered beside the name, e.g. the edit control. */
  adminSlot?: ReactNode;
  note?: ReactNode;
  /** The door card's contents: next night, address, links. Omit to give the hero one column. */
  door?: ReactNode;
  /** Photo tiles under the hero; the strip hides when there are none. */
  media?: ProfileMedia[];
  main: ReactNode;
  side?: ReactNode;
  footer?: ReactNode;
};

/**
 * Shared frame for school, instructor and DJ pages. The entity's photo fills the
 * hero behind a scrim; the name sits on the left and the door card on the right.
 */
export function ProfileShell({ variant, titleId, crumb, name, where, tagline, imageUrl, chips, adminSlot, note, door, media = [], main, side, footer }: Props) {
  const [photoFailed, setPhotoFailed] = useState(false);
  return (
    <article className={`profile profile--${variant}`} aria-labelledby={titleId}>
      <nav className="profile__crumb" aria-label="Breadcrumb">
        <Link to="/discover">Directory</Link>
        <span aria-hidden="true">/</span>
        <Link to={crumb.to}>{crumb.label}</Link>
      </nav>

      <header className="profile__hero">
        {imageUrl && !photoFailed && (
          <img className="profile__photo" src={imageUrl} alt="" fetchPriority="high" onError={() => setPhotoFailed(true)} />
        )}
        <div className="profile__intro">
          <h1 id={titleId}>{name}</h1>
          {adminSlot}
          {where && <p className="profile__where">{where}</p>}
          {tagline && <p className="profile__tagline">{tagline}</p>}
          {chips}
          {note && <p className="profile__note">{note}</p>}
        </div>
        {door && (
          <aside className="profile__door" aria-label={`Visiting ${name}`}>
            {door}
          </aside>
        )}
      </header>

      <ProfileMediaStrip items={media} label={`Photos from ${name}'s nights`} />

      <div className="profile__body">
        <div className="profile__main">{main}</div>
        {side && <div className="profile__side">{side}</div>}
      </div>

      {footer && <footer className="profile__footer">{footer}</footer>}
    </article>
  );
}

/** The solid rose "Next up" link that leads the door card. */
export function ProfileNext({ to, day, month, label, title, location }: { to: string; day?: string; month?: string; label: string; title: string; location?: string | null }) {
  return (
    <Link className="profile__next" to={to}>
      <span className="profile__date" aria-hidden="true">
        {day && <span className="profile__date-day">{day}</span>}
        {month && <span className="profile__date-month">{month}</span>}
      </span>
      <span className="profile__next-copy">
        <span className="profile__next-label">{label}</span>
        <strong>{title}</strong>
        {location && <span>{location}</span>}
      </span>
      <ArrowUpRight className="profile__next-arrow" size={20} aria-hidden="true" />
    </Link>
  );
}

function ShareButton() {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard can be blocked; the address bar still has the link.
    }
  };
  return (
    <button type="button" onClick={() => void share()}>
      {copied ? <Check size={14} aria-hidden="true" /> : <Share2 size={14} aria-hidden="true" />}
      <span aria-live="polite">{copied ? "Link copied" : "Share"}</span>
    </button>
  );
}

/** The door card's outbound links, plus Share. */
export function ProfileLinks({ name, links }: { name: string; links: ProfileLink[] }) {
  return (
    <nav className="profile__links" aria-label={`${name} links`}>
      {links.map((link) => (
        <a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer">
          {link.label} <ArrowUpRight size={14} aria-hidden="true" />
        </a>
      ))}
      <ShareButton />
    </nav>
  );
}

/** One dated row: a rose date tile, the title, and a line of detail. */
export function ProfileNight({ to, day, month, title, meta }: { to: string; day?: string; month?: string; title: string; meta: string }) {
  return (
    <Link className="profile__night" to={to}>
      <span className="profile__date" aria-hidden="true">
        {day && <span className="profile__date-day">{day}</span>}
        {month && <span className="profile__date-month">{month}</span>}
      </span>
      <span className="profile__night-copy">
        <strong>{title}</strong>
        <span>{meta}</span>
      </span>
    </Link>
  );
}
