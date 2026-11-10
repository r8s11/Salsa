import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Home } from "lucide-react";
import ButtonLink from "../components/ui/ButtonLink";
import { useDocumentMeta } from "../shared/seo/useDocumentMeta";
import { canonicalUrl } from "../utils/seo";
import { fetchPublicMemberProfile } from "../features/account/api/publicMemberProfile";
import {
  initialsFor,
  isDisplayablePhotoUrl,
  resolveIdentity,
} from "../features/account/model/account";
import { profileStyleLabels } from "../features/account/model/publicProfile";
import { DANCE_STYLES } from "../features/admin/model/eventsQuery";
import "./account/ProfilePage.css";
import "./PublicMemberProfilePage.css";

// Same rule the database enforces (profiles_username_format). A segment that
// cannot be a username is "not found" without a request.
const USERNAME_FORMAT = /^[A-Za-z0-9_]{3,24}$/;

function formatMemberSince(value: string | null): string | null {
  const match = value ? /^(\d{4})-(\d{2})$/.exec(value) : null;
  if (!match) return null;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1)).toLocaleDateString(
    "en-US",
    { month: "short", year: "numeric", timeZone: "UTC" }
  );
}

function NotFound() {
  return (
    <main className="profile-page public-member-profile">
      <section className="public-member-profile__notfound" aria-labelledby="member-notfound-title">
        <p className="public-member-profile__kicker">Member profile</p>
        <h1 id="member-notfound-title" className="profile-name">
          Member not found
        </h1>
        <p className="public-member-profile__notfound-copy">
          There is no public member profile at this address.
        </p>
        <ButtonLink to="/" variant="secondary">
          <Home size={16} aria-hidden="true" /> Back to Home
        </ButtonLink>
      </section>
    </main>
  );
}

export default function PublicMemberProfilePage() {
  const { username = "" } = useParams<{ username: string }>();
  const validUsername = USERNAME_FORMAT.test(username);
  const query = useQuery({
    queryKey: ["public-member-profile", username.toLowerCase()],
    queryFn: () => fetchPublicMemberProfile(username),
    enabled: validUsername,
  });
  // The exact URL whose <img> raised onError; a new URL retries.
  const [failedAvatarUrl, setFailedAvatarUrl] = useState<string | null>(null);
  const [failedCoverUrl, setFailedCoverUrl] = useState<string | null>(null);

  const member = query.data ?? null;
  const identity = member
    ? resolveIdentity({ display_name: member.displayName, username: member.username })
    : null;

  const notFound = !validUsername || (query.isSuccess && !member);
  useDocumentMeta({
    title: identity
      ? `${identity.name} · Member profile`
      : notFound
        ? "Member not found"
        : "Member profile",
    description: "A Salsa Segura member profile.",
    canonical: member ? canonicalUrl(`/u/${member.username}`) : undefined,
    robots: "noindex, follow",
  });

  if (notFound) return <NotFound />;

  if (query.isPending) {
    return (
      <main className="profile-page public-member-profile">
        <div className="profile-page-status" role="status">
          Loading profile…
        </div>
      </main>
    );
  }

  if (query.isError) {
    return (
      <main className="profile-page public-member-profile">
        <div className="profile-page-status profile-page-error" role="alert">
          <p>Couldn't load this profile. Check your connection and try again.</p>
          <button type="button" onClick={() => void query.refetch()}>
            Retry
          </button>
        </div>
      </main>
    );
  }

  if (!member || !identity) return <NotFound />;

  const avatarUrl = member.avatarUrl?.trim() ?? "";
  const coverUrl = member.coverUrl?.trim() ?? "";
  const showAvatar = isDisplayablePhotoUrl(avatarUrl) && failedAvatarUrl !== avatarUrl;
  const showCover = isDisplayablePhotoUrl(coverUrl) && failedCoverUrl !== coverUrl;
  const styleLabels = profileStyleLabels(member.danceStyles, DANCE_STYLES);
  const memberSince = formatMemberSince(member.memberSince);
  const tagline = [
    member.cityName ? `Dancing in ${member.cityName}` : null,
    memberSince ? `Member since ${memberSince}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  // Links render only for http(s) values, as on the member's own profile.
  const showInstagram = member.instagram !== null && /^https?:\/\//i.test(member.instagram);
  const showWebsite = member.website !== null && /^https?:\/\//i.test(member.website);

  return (
    <main className="profile-page public-member-profile">
      <div className="profile-cover">
        {showCover ? (
          <img
            className="profile-cover-photo"
            src={coverUrl}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setFailedCoverUrl(coverUrl)}
          />
        ) : null}
        <div className="profile-cover-gradient" aria-hidden="true" />
      </div>

      <div className="profile-header">
        <div className="profile-avatar-block">
          <div className="profile-avatar-wrapper">
            {showAvatar ? (
              <img
                className="profile-avatar-large profile-avatar-large--photo"
                src={avatarUrl}
                alt=""
                width={128}
                height={128}
                loading="lazy"
                referrerPolicy="no-referrer"
                onError={() => setFailedAvatarUrl(avatarUrl)}
              />
            ) : (
              <div className="profile-avatar-large" aria-hidden="true">
                {initialsFor(identity)}
              </div>
            )}
          </div>
        </div>

        <div className="profile-identity">
          <p className="public-member-profile__kicker">Member profile</p>
          <h1 className="profile-name">{identity.name}</h1>
          {identity.usernameLine && <p className="profile-username">{identity.usernameLine}</p>}
          {tagline && <p className="profile-member-since">{tagline}</p>}
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

      {member.bio && <p className="profile-bio">{member.bio}</p>}

      {(showInstagram || showWebsite) && (
        <div className="profile-links">
          {showInstagram && (
            <a href={member.instagram ?? undefined} target="_blank" rel="noopener noreferrer">
              Instagram
            </a>
          )}
          {showWebsite && (
            <a href={member.website ?? undefined} target="_blank" rel="noopener noreferrer">
              Website
            </a>
          )}
        </div>
      )}

      {member.activity && (
        <section className="profile-numbers" aria-labelledby="member-activity-heading">
          <h2 id="member-activity-heading" className="profile-subsection-title">
            Activity
          </h2>
          <div className="profile-stats-bar">
            <div className="profile-stat">
              <span className="profile-stat-num">{member.activity.eventsHosted}</span>
              <span className="profile-stat-label">Events Hosted</span>
            </div>
          </div>
        </section>
      )}

      <p className="public-member-profile__footer">
        <Link to="/calendar">Browse events on Salsa Segura</Link>
      </p>
    </main>
  );
}
