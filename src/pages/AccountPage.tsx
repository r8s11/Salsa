import { Link } from "react-router-dom";
import { Flag, PauseCircle, Ban } from "lucide-react";
import { useAuth } from "../contexts/useAuth";
import { useOwnProfile } from "../hooks/useOwnProfile";
import {
  capabilityCardsFor,
  ROLE_LABEL,
  resolveIdentity,
  initialsFor,
  memberSinceLabel,
  statusMessageFor,
  type AccountStatus,
} from "../features/account/model/account";
import "./AccountPage.css";

const STATUS_ICON: Partial<Record<AccountStatus, typeof Flag>> = {
  flagged: Flag,
  suspended: PauseCircle,
  banned: Ban,
};

function AccountSkeleton() {
  return (
    <div className="account-page__card account-page__skeleton" aria-busy="true">
      <p role="status" className="account-page__visually-hidden">
        Loading your account…
      </p>
      <span className="account-page__skel account-page__skel--avatar" aria-hidden="true" />
      <div className="account-page__skel-lines" aria-hidden="true">
        <span className="account-page__skel account-page__skel--line" />
        <span className="account-page__skel account-page__skel--line account-page__skel--short" />
        <span className="account-page__skel account-page__skel--line account-page__skel--short" />
      </div>
    </div>
  );
}

export default function AccountPage() {
  const { user, role } = useAuth();
  const { profile, isLoading, error, refetch } = useOwnProfile(user?.id);

  const roleLabel = ROLE_LABEL[role ?? "user"];
  const statusMessage = profile ? statusMessageFor(profile.status) : null;
  const identity = profile ? resolveIdentity(profile) : null;
  const StatusIcon = profile ? STATUS_ICON[profile.status] : undefined;
  const capabilityCards = profile ? capabilityCardsFor(role) : [];

  return (
    <main className="account-page">
      <div className="account-page__intro">
        <span className="account-page__eyebrow">My account</span>
        <h1 className="account-page__h1">Account</h1>
        <p className="account-page__lede">
          Your identity, account status, and profile access.
        </p>
      </div>

      {statusMessage && (
        <div
          className={`account-page__status-banner account-page__status-banner--${profile?.status}`}
          role="alert"
        >
          {StatusIcon && <StatusIcon size={18} aria-hidden="true" />}
          <div>
            <p className="account-page__status-title">{statusMessage.title}</p>
            <p className="account-page__status-body">{statusMessage.body}</p>
          </div>
        </div>
      )}

      {isLoading && <AccountSkeleton />}

      {!isLoading && error && (
        <div className="account-page__card account-page__error" role="alert">
          <p>We couldn't load your account details.</p>
          <button type="button" className="account-page__btn account-page__btn--outline" onClick={() => refetch()}>
            Try Again
          </button>
        </div>
      )}

      {!isLoading && !error && !profile && (
        <div className="account-page__card account-page__missing">
          <p className="account-page__missing-title">We couldn't find an account profile for this login.</p>
          <p className="account-page__missing-body">
            This can happen for older or partially set-up accounts. Try refreshing, or contact us if this
            keeps happening.
          </p>
          {user?.email && (
            <p className="account-page__missing-email">
              Signed in as <strong>{user.email}</strong>
            </p>
          )}
          <button type="button" className="account-page__btn account-page__btn--outline" onClick={() => refetch()}>
            Try Again
          </button>
        </div>
      )}

      {!isLoading && !error && profile && identity && (
        <section className="account-page__card account-page__identity">
          {profile.avatar_url ? (
            <img
              className="account-page__avatar"
              src={profile.avatar_url}
              alt=""
              loading="lazy"
              width={64}
              height={64}
            />
          ) : (
            <span className="account-page__avatar account-page__avatar--initials" aria-hidden="true">
              {initialsFor(identity)}
            </span>
          )}

          <div className="account-page__identity-body">
            <div className="account-page__identity-name-row">
              <span className="account-page__name">{identity.name}</span>
              <span className="account-page__role-badge">{roleLabel}</span>
            </div>

            {identity.usernameLine && (
              <span className="account-page__muted">{identity.usernameLine}</span>
            )}
            {identity.usernameMissing && (
              <span className="account-page__muted account-page__username-missing">Username not set</span>
            )}

            {user?.email && (
              <span className="account-page__muted">
                <span className="account-page__meta-label">Account email:</span> {user.email}
              </span>
            )}
            <span className="account-page__hint">Used for sign-in and account security.</span>

            <span className="account-page__muted">Member since {memberSinceLabel(profile.created_at)}</span>
          </div>

          <div className="account-page__identity-actions">
            <Link to="/profile" className="account-page__btn account-page__btn--primary">
              View Profile
            </Link>
          </div>
        </section>
      )}

      {!isLoading && !error && profile && identity && (
        <section className="account-page__capabilities" aria-labelledby="account-capabilities-heading">
          <div className="account-page__capabilities-heading">
            <span className="account-page__eyebrow">What you can do</span>
            <h2 id="account-capabilities-heading">What you can do</h2>
          </div>
          <div className="account-page__capability-grid">
            {capabilityCards.map((card) => (
              <article className="account-page__card account-page__capability-card" key={card.title}>
                <div className="account-page__capability-title-row">
                  <h3>{card.title}</h3>
                  <span className="account-page__availability">Available</span>
                </div>
                <p>{card.description}</p>
                <div className="account-page__capability-actions">
                  {card.links.map((link) => (
                    <Link
                      className={`account-page__capability-link${
                        link.primary ? " account-page__capability-link--primary" : ""
                      }`}
                      key={link.to}
                      to={link.to}
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
