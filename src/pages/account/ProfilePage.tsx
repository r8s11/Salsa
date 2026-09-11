import "temporal-polyfill/global";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../contexts/useAuth";
import { useMySubmissions } from "../../features/account/hooks/useMySubmissions";
import { useOwnProfile } from "../../features/account/hooks/useOwnProfile";
import {
  resolveIdentity,
  initialsFor,
  isDisplayablePhotoUrl,
} from "../../features/account/model/account";
import {
  profileHostingNext,
  profileRegularVenues,
  profileStyleLabels,
  profileTagline,
} from "../../features/account/model/publicProfile";
import { DANCE_STYLES } from "../../features/admin/model/eventsQuery";
import type { DatabaseEvent } from "../../features/events/model/types";
import Button from "../../components/ui/Button";
import ButtonLink from "../../components/ui/ButtonLink";
import "./ProfilePage.css";

function formatEventDate(isoDate: string): string {
  const zdt = Temporal.Instant.from(isoDate).toZonedDateTimeISO("America/New_York");
  return zdt.toLocaleString("en-US", { month: "short", day: "numeric" });
}

function formatEventMonth(isoDate: string): string {
  const zdt = Temporal.Instant.from(isoDate).toZonedDateTimeISO("America/New_York");
  return zdt.toLocaleString("en-US", { month: "short" }).toUpperCase();
}

function formatEventWeekday(isoDate: string): string {
  const zdt = Temporal.Instant.from(isoDate).toZonedDateTimeISO("America/New_York");
  return zdt.toLocaleString("en-US", { weekday: "short" }).toUpperCase();
}

function formatEventDay(isoDate: string): string {
  const zdt = Temporal.Instant.from(isoDate).toZonedDateTimeISO("America/New_York");
  return String(zdt.day);
}

function formatEventTime(event: DatabaseEvent): string {
  if (event.event_time) return event.event_time;
  const zdt = Temporal.Instant.from(event.event_date).toZonedDateTimeISO("America/New_York");
  return zdt.toLocaleString("en-US", { hour: "numeric", minute: "2-digit" });
}

function eventTypeLabel(type: DatabaseEvent["event_type"]): string {
  switch (type) {
    case "social":
      return "Social";
    case "class":
      return "Class";
    case "workshop":
      return "Workshop";
    default:
      return "Event";
  }
}

/** Which audience's view of the activity numbers is on screen. */
type StatsAudience = "you" | "everyone";

export default function ProfilePage() {
  const { user, role, signOut } = useAuth();
  const { submissions, approvedEvents, isLoading, error, refetch } = useMySubmissions(user?.id);
  const { profile } = useOwnProfile(user?.id);
  // The exact photo URL whose <img> raised onError; a new URL retries.
  const [failedPhotoUrl, setFailedPhotoUrl] = useState<string | null>(null);
  const [failedCoverUrl, setFailedCoverUrl] = useState<string | null>(null);
  const [statsAudience, setStatsAudience] = useState<StatsAudience>("you");

  const allEvents = useMemo(
    () => [...(submissions ?? []), ...(approvedEvents ?? [])],
    [submissions, approvedEvents]
  );

  const stats = useMemo(() => {
    const approved = allEvents.filter((e) => e.status === "approved");
    const pending = allEvents.filter((e) => e.status === "pending");
    return {
      eventsHosted: approved.length,
      pendingSubmissions: pending.length,
      total: allEvents.length,
    };
  }, [allEvents]);

  const hostingNext = useMemo(() => profileHostingNext(approvedEvents ?? []), [approvedEvents]);
  const regularVenues = useMemo(
    () => profileRegularVenues(approvedEvents ?? []),
    [approvedEvents]
  );
  const styleLabels = useMemo(
    () => profileStyleLabels(profile?.dance_styles ?? [], DANCE_STYLES),
    [profile?.dance_styles]
  );

  // The saved profile row is the source of truth for the identity shown
  // here — this is where the editor returns after a save. Only when no
  // profile row exists does the pre-existing auth-metadata fallback apply,
  // so missing-profile accounts keep rendering exactly as before.
  const identity = profile ? resolveIdentity(profile) : null;
  const userName =
    identity?.name ??
    (((user?.user_metadata as Record<string, unknown> | null | undefined)?.full_name as
      | string
      | undefined) ||
      user?.email?.split("@")[0] ||
      "Dancer");

  const userInitial = identity ? initialsFor(identity) : userName.charAt(0).toUpperCase();

  const savedPhotoUrl = profile?.avatar_url?.trim() ?? "";
  const showPhoto = isDisplayablePhotoUrl(savedPhotoUrl) && failedPhotoUrl !== savedPhotoUrl;
  const savedCoverUrl = profile?.cover_url?.trim() ?? "";
  const showCover = isDisplayablePhotoUrl(savedCoverUrl) && failedCoverUrl !== savedCoverUrl;
  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" })
    : null;
  const isOrganizer = role === "organizer" || role === "admin";
  const tagline = profileTagline(profile?.city ?? null, memberSince);

  // Links are rendered only for values the database's http(s) CHECK
  // constraints admit, so a stored non-http value can never become an href.
  const instagramUrl = profile?.instagram?.trim() ?? "";
  const websiteUrl = profile?.website?.trim() ?? "";
  const showInstagram = /^https?:\/\//i.test(instagramUrl);
  const showWebsite = /^https?:\/\//i.test(websiteUrl);

  // "Everyone" previews what other members see: with stats_public off, the
  // numbers are hidden from them, so the preview hides them too.
  const statsHiddenFromOthers = profile ? !profile.stats_public : false;
  const statsVisible = statsAudience === "you" || !statsHiddenFromOthers;
  const statsVisibilityNote = statsHiddenFromOthers
    ? "Only you can see these"
    : "Visible to members";

  if (isLoading) {
    return (
      <main className="profile-page">
        <div className="profile-page-status" role="status">
          Loading profile…
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="profile-page">
        <div className="profile-page-status profile-page-error" role="alert">
          <p>Couldn't load your profile: {error}</p>
          <button type="button" onClick={() => refetch()}>
            Retry
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="profile-page">
      {/* Cover photo */}
      <div className="profile-cover">
        {showCover ? (
          <img
            className="profile-cover-photo"
            src={savedCoverUrl}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setFailedCoverUrl(savedCoverUrl)}
          />
        ) : null}
        <div className="profile-cover-gradient" aria-hidden="true" />
      </div>

      {/* Profile header */}
      <div className="profile-header">
        <div className="profile-avatar-wrapper">
          {showPhoto ? (
            <img
              className="profile-avatar-large profile-avatar-large--photo"
              src={savedPhotoUrl}
              alt=""
              width={128}
              height={128}
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={() => setFailedPhotoUrl(savedPhotoUrl)}
            />
          ) : (
            <div className="profile-avatar-large" aria-hidden="true">
              {userInitial}
            </div>
          )}
        </div>

        <div className="profile-identity">
          <div className="profile-name-row">
            <h1 className="profile-name">{userName}</h1>
            {isOrganizer && <span className="profile-role-badge">Organizer</span>}
          </div>
          <p className="profile-member-since">{tagline}</p>
        </div>

        <div className="profile-actions">
          <Link className="profile-action-btn profile-action-btn--outline" to="/profile/edit">
            Profile settings
          </Link>
          <ButtonLink to="/submit" variant="primary">
            + Submit Event
          </ButtonLink>
          <ButtonLink to="/calendar" variant="secondary">
            View Calendar
          </ButtonLink>
          <Button variant="secondary" onClick={() => signOut("global")}>
            Sign Out
          </Button>
        </div>
      </div>

      {styleLabels.length > 0 && (
        <ul className="profile-style-chips" aria-label="Dance styles">
          {styleLabels.map((label) => (
            <li key={label} className="profile-style-chip">
              {label}
            </li>
          ))}
        </ul>
      )}

      {profile?.bio?.trim() && <p className="profile-bio">{profile.bio}</p>}

      {(showInstagram || showWebsite) && (
        <div className="profile-links">
          {showInstagram && (
            <a href={instagramUrl} target="_blank" rel="noopener noreferrer">
              Instagram
            </a>
          )}
          {showWebsite && (
            <a href={websiteUrl} target="_blank" rel="noopener noreferrer">
              Website
            </a>
          )}
        </div>
      )}

      {/* Activity numbers, with an owner-only preview of the member-facing view */}
      <section className="profile-numbers" aria-labelledby="profile-numbers-heading">
        <div className="profile-numbers-head">
          <h2 id="profile-numbers-heading" className="profile-numbers-title">
            Your numbers
          </h2>
          <div className="profile-numbers-controls">
            <span className="profile-numbers-note">{statsVisibilityNote}</span>
            <div className="profile-audience-toggle" role="group" aria-label="Preview numbers as">
              {(["you", "everyone"] as const).map((audience) => (
                <button
                  key={audience}
                  type="button"
                  className={
                    statsAudience === audience
                      ? "profile-audience-btn profile-audience-btn--active"
                      : "profile-audience-btn"
                  }
                  aria-pressed={statsAudience === audience}
                  onClick={() => setStatsAudience(audience)}
                >
                  {audience === "you" ? "You" : "Everyone"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {statsVisible ? (
          <div className="profile-stats-bar">
            <div className="profile-stat">
              <span className="profile-stat-num">{stats.eventsHosted}</span>
              <span className="profile-stat-label">Events Hosted</span>
            </div>
            <div className="profile-stat">
              <span className="profile-stat-num">{stats.pendingSubmissions}</span>
              <span className="profile-stat-label">Pending</span>
            </div>
            <div className="profile-stat">
              <span className="profile-stat-num">{stats.total}</span>
              <span className="profile-stat-label">Total Submissions</span>
            </div>
          </div>
        ) : (
          <p className="profile-numbers-hidden">
            Members don't see your numbers. Turn stats back on in{" "}
            <Link to="/profile/edit">profile settings</Link>.
          </p>
        )}
      </section>

      {hostingNext.length > 0 && (
        <section className="profile-hosting" aria-labelledby="profile-hosting-heading">
          <h2 id="profile-hosting-heading" className="profile-subsection-title">
            Hosting next
          </h2>
          <div className="profile-hosting-list">
            {hostingNext.map((event) => (
              <Link
                key={event.id}
                to={`/calendar?event=${event.id}&city=${event.city}`}
                className="profile-hosting-row"
              >
                <span className="profile-submission-date-block">
                  <span className="profile-submission-day">{formatEventDay(event.event_date)}</span>
                  <span className="profile-submission-month">
                    {formatEventMonth(event.event_date)}
                  </span>
                </span>
                <span className="profile-hosting-info">
                  <span className="profile-submission-title">{event.title}</span>
                  <span className="profile-submission-meta">
                    {formatEventTime(event)}
                    {event.location ? ` · ${event.location}` : ""}
                  </span>
                </span>
                <span className="profile-hosting-cta">Details →</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {regularVenues.length > 0 && (
        <section className="profile-venues" aria-labelledby="profile-venues-heading">
          <h2 id="profile-venues-heading" className="profile-subsection-title">
            Regular at
          </h2>
          <ul className="profile-venue-list">
            {regularVenues.map((venue) => (
              <li key={venue} className="profile-venue-pill">
                {venue}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Submission management section */}
      <section className="profile-submissions" aria-labelledby="submissions-heading">
        <div className="profile-submissions-header">
          <div>
            <span className="profile-section-rule" aria-hidden="true" />
            <span className="profile-section-eyebrow">Activity</span>
            <h2 id="submissions-heading">My submissions</h2>
          </div>
        </div>

        {allEvents.length === 0 && !isLoading && (
          <p className="profile-empty">
            You haven't submitted any events yet. <Link to="/submit">Submit one</Link>.
          </p>
        )}

        {allEvents.length > 0 && (
          <div className="profile-submissions-list">
            {allEvents.map((event) => (
              <div key={event.id} className="profile-submission-row">
                <div className="profile-submission-date-block">
                  <span className="profile-submission-day">{formatEventDay(event.event_date)}</span>
                  <span className="profile-submission-month">
                    {formatEventMonth(event.event_date)}
                  </span>
                </div>
                <div className="profile-submission-info">
                  <h3 className="profile-submission-title">{event.title}</h3>
                  <p className="profile-submission-meta">
                    {eventTypeLabel(event.event_type)} · {formatEventWeekday(event.event_date)},{" "}
                    {formatEventDate(event.event_date)} · {formatEventTime(event)}
                  </p>
                  <p className="profile-submission-location">
                    {event.city === "boston" ? "Boston" : "New York City"}
                    {event.location ? ` · ${event.location}` : ""}
                  </p>
                </div>
                <div className="profile-submission-right">
                  <span
                    className={`profile-submission-badge profile-submission-badge--${event.status}`}
                  >
                    {event.status}
                  </span>
                  <div className="profile-submission-links">
                    {event.status === "approved" && (
                      <Link
                        to={`/calendar?event=${event.id}&city=${event.city}`}
                        className="profile-submission-link"
                      >
                        View on calendar
                      </Link>
                    )}
                    {(event.status === "pending" || event.status === "rejected") && (
                      <Link to={`/profile/edit/${event.id}`} className="profile-submission-link">
                        Edit
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
