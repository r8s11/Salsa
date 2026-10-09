import type { ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import { Desk, DeskError, DeskSkeleton } from "../../../components/desk/Desk";
import MarginMark from "../../../components/desk/MarginMark";
import { WorkspaceAccessError } from "../api/workspacesRepo";
import { errorMessage, useEntityWorkspace } from "../hooks/useEntityWorkspace";
import { MANAGED_KIND_LABELS, type EntityWorkspace, type ManagedKind } from "../model";
import { PUBLIC_PATH_PREFIX } from "../offeringForm";
import { WORKSPACE_ROLE_LABELS, workspaceSections } from "../workspaceSections";
import "./workspace.css";

type WorkspaceFrameProps = {
  kind: ManagedKind;
  id: string;
  /** Names the page in the masthead kicker, e.g. "Timetable". */
  section: string;
  children: (workspace: EntityWorkspace) => ReactNode;
};

/**
 * Everything a workspace page shares: the read, its loading / refused / failed
 * states, the masthead naming the listing and the caller's standing on it, and
 * the links between the listing's pages.
 */
export default function WorkspaceFrame({ kind, id, section, children }: WorkspaceFrameProps) {
  const query = useEntityWorkspace(kind, id);
  const workspace = query.data;

  if (query.isPending) {
    return (
      <Desk>
        <div className="ws" role="status" aria-label="Loading listing">
          <DeskSkeleton rows={5} />
        </div>
      </Desk>
    );
  }

  if (query.error instanceof WorkspaceAccessError) {
    return (
      <Desk>
        <section className="ws ws-denied" aria-labelledby="ws-denied-title">
          <h1 id="ws-denied-title" className="ws-denied__title">
            You can’t open this listing
          </h1>
          <p className="ws-denied__body">
            {query.error.message} It may have been archived, or your access may have changed.
          </p>
          <Link to="/host" className="desk__action">
            Back to Host
          </Link>
        </section>
      </Desk>
    );
  }

  if (!workspace) {
    return (
      <Desk>
        <div className="ws">
          <DeskError
            message={`We couldn’t load this listing. ${errorMessage(query.error)}`}
            onRetry={() => void query.refetch()}
          />
        </div>
      </Desk>
    );
  }

  const { entity, role } = workspace;
  const live = entity.status === "active";

  return (
    <Desk>
      <div className="ws">
        <header className="ws-masthead">
          <p className="ws-masthead__kicker">
            {MANAGED_KIND_LABELS[kind]} · {section}
          </p>
          <h1 className="ws-masthead__name">{entity.name}</h1>
          <p className="ws-masthead__line">
            <span className="ws-masthead__status">
              <MarginMark state={live ? "set" : "unset"} />
              {live ? "Published" : "Awaiting review"}
            </span>
            <span className="ws-masthead__sep" aria-hidden>
              ·
            </span>
            <span>Your role: {WORKSPACE_ROLE_LABELS[role]}</span>
            {live && (
              <>
                <span className="ws-masthead__sep" aria-hidden>
                  ·
                </span>
                <Link to={`${PUBLIC_PATH_PREFIX[kind]}/${entity.slug}`} className="ws-masthead__public">
                  View public page <ExternalLink size={12} aria-hidden />
                </Link>
              </>
            )}
          </p>
        </header>

        <nav className="ws-sections" aria-label="Listing pages">
          {workspaceSections(kind, id, role).map(({ key, label, to }) => (
            <NavLink key={key} to={to} end={key === "overview"} className="ws-sections__link">
              {label}
            </NavLink>
          ))}
        </nav>

        {children(workspace)}
      </div>
    </Desk>
  );
}
