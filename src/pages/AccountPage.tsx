import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Flag, PauseCircle, Ban } from "lucide-react";
import { useEscapeKey } from "../features/calendar/hooks/useEscapeKey";
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

function SignOutEverywhereDialog({
  error,
  isPending,
  onCancel,
  onConfirm,
}: {
  error: string | null;
  isPending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<Element | null>(null);

  useEscapeKey(() => {
    if (!isPending) {
      onCancel();
    }
  });

  useEffect(() => {
    previousFocusRef.current = document.activeElement;
    cancelRef.current?.focus();

    return () => {
      if (previousFocusRef.current instanceof HTMLElement) {
        previousFocusRef.current.focus();
      }
    };
  }, []);

  const trapFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab") {
      return;
    }

    const focusable = dialogRef.current?.querySelectorAll<HTMLButtonElement>("button:not([disabled])");
    if (!focusable || focusable.length === 0) {
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const cancel = () => {
    if (!isPending) {
      onCancel();
    }
  };

  return (
    <div className="account-page__dialog-overlay" onMouseDown={cancel}>
      <div
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="account-page__dialog"
        onKeyDown={trapFocus}
        onMouseDown={(event) => event.stopPropagation()}
        ref={dialogRef}
        role="dialog"
      >
        <h2 id={titleId}>Sign out everywhere?</h2>
        <p id={descriptionId}>
          This ends every session, including this browser. People using another device may keep access until
          their current access token expires.
        </p>
        {error && (
          <p className="account-page__session-error" role="alert">
            {error}
          </p>
        )}
        <div className="account-page__dialog-actions">
          <button
            aria-label="Cancel sign out everywhere"
            className="account-page__btn account-page__btn--outline"
            disabled={isPending}
            onClick={cancel}
            ref={cancelRef}
            type="button"
          >
            Cancel
          </button>
          <button
            aria-label={isPending ? "Signing out everywhere" : "Confirm sign out everywhere"}
            className="account-page__btn account-page__btn--session-global"
            disabled={isPending}
            onClick={onConfirm}
            type="button"
          >
            {isPending ? "Signing out everywhere" : "Confirm sign out everywhere"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AccountPage() {
  const { user, role, signOut } = useAuth();
  const navigate = useNavigate();
  const { profile, isLoading, error, refetch } = useOwnProfile(user?.id);
  const [pendingAction, setPendingAction] = useState<"local" | "others" | "global" | null>(null);
  const [sessionActionError, setSessionActionError] = useState<string | null>(null);
  const [otherSessionsMessage, setOtherSessionsMessage] = useState<string | null>(null);
  const [isGlobalDialogOpen, setIsGlobalDialogOpen] = useState(false);
  const [globalSignOutError, setGlobalSignOutError] = useState<string | null>(null);

  const roleLabel = ROLE_LABEL[role ?? "user"];
  const statusMessage = profile ? statusMessageFor(profile.status) : null;
  const identity = profile ? resolveIdentity(profile) : null;
  const StatusIcon = profile ? STATUS_ICON[profile.status] : undefined;
  const capabilityCards = profile ? capabilityCardsFor(role) : [];
  const isSessionActionPending = pendingAction !== null;

  const handleScopedSignOut = async (scope: "local" | "others") => {
    if (isSessionActionPending) {
      return;
    }

    setPendingAction(scope);
    setSessionActionError(null);
    setOtherSessionsMessage(null);

    try {
      const { error } = await signOut(scope);
      if (error) {
        setSessionActionError(
          scope === "local"
            ? "We couldn't sign you out on this device. Please try again."
            : "We couldn't sign out your other devices. Please try again."
        );
        return;
      }

      if (scope === "local") {
        navigate("/", { replace: true });
        return;
      }

      setOtherSessionsMessage(
        "Other sessions were ended. Their current access may continue until each access token expires."
      );
    } catch {
      setSessionActionError(
        scope === "local"
          ? "We couldn't sign you out on this device. Please try again."
          : "We couldn't sign out your other devices. Please try again."
      );
    } finally {
      setPendingAction(null);
    }
  };

  const openGlobalSignOutDialog = () => {
    if (isSessionActionPending) {
      return;
    }

    setSessionActionError(null);
    setOtherSessionsMessage(null);
    setGlobalSignOutError(null);
    setIsGlobalDialogOpen(true);
  };

  const closeGlobalSignOutDialog = () => {
    if (!isSessionActionPending) {
      setIsGlobalDialogOpen(false);
    }
  };

  const handleGlobalSignOut = async () => {
    if (isSessionActionPending) {
      return;
    }

    setPendingAction("global");
    setGlobalSignOutError(null);

    try {
      const { error } = await signOut("global");
      if (error) {
        setGlobalSignOutError("We couldn't sign you out everywhere. Please try again.");
        return;
      }

      navigate("/", { replace: true });
    } catch {
      setGlobalSignOutError("We couldn't sign you out everywhere. Please try again.");
    } finally {
      setPendingAction(null);
    }
  };

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

      {!isLoading && !error && profile && identity && (
        <section
          className="account-page__card account-page__notifications"
          aria-labelledby="account-notifications-heading"
        >
          <h2 id="account-notifications-heading">Email &amp; notifications</h2>
          <p>Required account and security emails are always sent to your account email.</p>
          <p>Optional email preferences aren&rsquo;t available yet.</p>
        </section>
      )}

      {user && (
        <section
          className="account-page__card account-page__security"
          aria-labelledby="account-security-heading"
        >
          <h2 id="account-security-heading">Security &amp; sessions</h2>
          <p className="account-page__security-intro">
            Manage your current sign-in and protect your account.
          </p>

          {sessionActionError && (
            <p className="account-page__session-error" role="alert">
              {sessionActionError}
            </p>
          )}
          {otherSessionsMessage && (
            <p className="account-page__session-success" role="status">
              {otherSessionsMessage}
            </p>
          )}

          <div className="account-page__session-group">
            <h3>Current session</h3>
            <div className="account-page__session-row">
              <div>
                <div className="account-page__session-name-row">
                  <span className="account-page__session-name">This browser</span>
                  <span className="account-page__session-current">Current</span>
                </div>
                {user.email && <p className="account-page__session-email">Signed in as {user.email}</p>}
              </div>
              <button
                className="account-page__btn account-page__btn--outline"
                disabled={isSessionActionPending}
                onClick={() => void handleScopedSignOut("local")}
                type="button"
              >
                {pendingAction === "local" ? "Signing out on this device" : "Sign out on this device"}
              </button>
            </div>
          </div>

          <div className="account-page__session-group">
            <h3>Other sessions</h3>
            <p>End sessions on your other browsers and devices. A current access token may continue until it expires.</p>
            <button
              className="account-page__btn account-page__btn--outline"
              disabled={isSessionActionPending}
              onClick={() => void handleScopedSignOut("others")}
              type="button"
            >
              {pendingAction === "others" ? "Signing out other devices" : "Sign out other devices"}
            </button>
          </div>

          <div className="account-page__session-group account-page__session-group--global">
            <h3>All sessions</h3>
            <p>End every session, including this browser.</p>
            <button
              className="account-page__btn account-page__btn--session-global"
              disabled={isSessionActionPending}
              onClick={openGlobalSignOutDialog}
              type="button"
            >
              Sign out everywhere
            </button>
          </div>
        </section>
      )}

      {isGlobalDialogOpen && (
        <SignOutEverywhereDialog
          error={globalSignOutError}
          isPending={pendingAction === "global"}
          onCancel={closeGlobalSignOutDialog}
          onConfirm={() => void handleGlobalSignOut()}
        />
      )}
    </main>
  );
}
