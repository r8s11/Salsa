import "temporal-polyfill/global";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Archive, CalendarPlus, Eye, Pencil, Plus, Send, Share2, Undo2 } from "lucide-react";
import {
  ADMIN_ITINERARIES_KEY,
  useAdminItineraries,
} from "../../itineraries/hooks/useItineraryQueries";
import {
  fetchItineraryDraft,
  findLiveItinerary,
  itineraryErrorMessage,
  saveItinerary,
  setItineraryStatus,
  type AdminItineraryRow,
} from "../../itineraries/api/itinerariesRepo";
import { fetchApprovedEventsBetween, fetchApprovedEventsByIds } from "../../events/api/eventsRepo";
import { matchNextWeek } from "../../itineraries/model/matchNextWeek";
import { formatWeekRange, weekBounds } from "../../itineraries/model/week";
import { buildPublicItineraryUrl } from "../../itineraries/model/itinerarySharing";
import type { ItineraryStatus } from "../../itineraries/model/types";
import type { City } from "../../../types/events";
import { useMetroName } from "../../metros/hooks/useMetros";
import AdminPageHeader from "../components/shell/AdminPageHeader";
import AdminViewTabs from "../components/shell/AdminViewTabs";
import AdminStatusBadge from "../components/common/AdminStatusBadge";
import AdminActionMenu, { type ActionMenuItem } from "../components/common/AdminActionMenu";
import AdminConfirmDialog from "../components/common/AdminConfirmDialog";
import AdminToast from "../components/common/AdminToast";
import AdminPagination from "../components/common/AdminPagination";
import { useListState, usePageWindow } from "../hooks/useListState";
import { enumParam, type ListDefinition } from "../model/listState";
import "./AdminItinerariesPage.css";

const VIEWS: { view: ItineraryStatus; label: string }[] = [
  { view: "draft", label: "Drafts" },
  { view: "published", label: "Published" },
  { view: "archived", label: "Archived" },
];

const PANEL_ID = "admin-itineraries-tabpanel";

const ITINERARIES_LIST: ListDefinition<ItineraryStatus, null, null> = {
  view: enumParam(
    "view",
    VIEWS.map((entry) => entry.view),
    "draft"
  ),
  filters: { parse: () => null, toParams: () => ({}) },
  sort: { parse: () => null, toParams: () => ({}) },
};

type Toast = { message: string; tone: "success" | "error" };

export default function AdminItinerariesPage() {
  const { itineraries, loading, error } = useAdminItineraries();
  const metroName = useMetroName();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const list = useListState(ITINERARIES_LIST);
  const { view } = list.state;
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [archiving, setArchiving] = useState<AdminItineraryRow | null>(null);
  const [archiveError, setArchiveError] = useState<string | null>(null);

  const counts = useMemo(() => {
    const result: Record<ItineraryStatus, number> = { draft: 0, published: 0, archived: 0 };
    for (const itinerary of itineraries) result[itinerary.status] += 1;
    return result;
  }, [itineraries]);
  const filtered = useMemo(
    () => itineraries.filter((itinerary) => itinerary.status === view),
    [itineraries, view]
  );
  const pageBounds = usePageWindow(list, loading ? null : filtered.length);
  const visible = filtered.slice(pageBounds.offset, pageBounds.offset + pageBounds.size);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ADMIN_ITINERARIES_KEY });

  const changeStatus = async (row: AdminItineraryRow, status: ItineraryStatus, message: string) => {
    setBusyId(row.id);
    try {
      await setItineraryStatus(row.id, status);
      await refresh();
      setToast({ message, tone: "success" });
    } catch (err) {
      setToast({ message: itineraryErrorMessage(err), tone: "error" });
    } finally {
      setBusyId(null);
    }
  };

  const confirmArchive = async () => {
    if (!archiving) return;
    setBusyId(archiving.id);
    setArchiveError(null);
    try {
      await setItineraryStatus(archiving.id, "archived");
      await refresh();
      setArchiving(null);
      setToast({ message: `Archived ${archiving.title}.`, tone: "success" });
    } catch (err) {
      setArchiveError(itineraryErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const share = async (row: AdminItineraryRow) => {
    try {
      await navigator.clipboard.writeText(buildPublicItineraryUrl(row.city, row.weekStart));
      setToast({ message: "Link copied.", tone: "success" });
    } catch {
      setToast({
        message: "Couldn't copy the link. Copy it from the preview instead.",
        tone: "error",
      });
    }
  };

  const createNextWeek = async (row: AdminItineraryRow) => {
    setBusyId(row.id);
    try {
      const next = Temporal.PlainDate.from(row.weekStart).add({ weeks: 1 }).toString();
      const existing = await findLiveItinerary(row.city, next);
      if (existing) {
        navigate(`/admin/itineraries/${existing}`);
        return;
      }
      const { draft } = await fetchItineraryDraft(row.id);
      const { startISO, endISO } = weekBounds(next, draft.timeZone);
      const [candidates, sourceEvents] = await Promise.all([
        fetchApprovedEventsBetween(draft.city as City, startISO, endISO),
        fetchApprovedEventsByIds(draft.items.map((item) => item.eventId)),
      ]);
      const { items, dropped } = matchNextWeek(
        draft.items,
        new Map(sourceEvents.map((event) => [event.id, event])),
        candidates,
        draft.timeZone
      );
      const id = await saveItinerary({ ...draft, id: null, weekStart: next, items });
      await refresh();
      navigate(`/admin/itineraries/${id}`, { state: { dropped } });
    } catch (err) {
      setToast({ message: itineraryErrorMessage(err), tone: "error" });
    } finally {
      setBusyId(null);
    }
  };

  const actionsFor = (row: AdminItineraryRow): ActionMenuItem[] => {
    const items: ActionMenuItem[] = [];
    if (row.status !== "archived") {
      items.push({
        id: "edit",
        label: "Edit",
        icon: Pencil,
        onSelect: () => navigate(`/admin/itineraries/${row.id}`),
      });
    }
    items.push({
      id: "preview",
      label: "Preview",
      icon: Eye,
      onSelect: () => navigate(`/admin/itineraries/${row.id}/preview`),
    });
    if (row.status === "draft") {
      items.push({
        id: "publish",
        label: "Publish",
        icon: Send,
        onSelect: () => void changeStatus(row, "published", `Published ${row.title}.`),
      });
    }
    if (row.status === "published") {
      items.push(
        {
          id: "unpublish",
          label: "Unpublish",
          icon: Undo2,
          onSelect: () => void changeStatus(row, "draft", `Moved ${row.title} back to drafts.`),
        },
        { id: "share", label: "Share", icon: Share2, onSelect: () => void share(row) }
      );
    }
    items.push({
      id: "next-week",
      label: "Create next week",
      icon: CalendarPlus,
      onSelect: () => void createNextWeek(row),
    });
    if (row.status !== "archived") {
      items.push({
        id: "archive",
        label: "Archive",
        icon: Archive,
        tone: "danger",
        separatorBefore: true,
        onSelect: () => {
          setArchiveError(null);
          setArchiving(row);
        },
      });
    }
    return items;
  };

  const activeLabel = VIEWS.find((entry) => entry.view === view)!.label.toLowerCase();

  return (
    <div className="admin-itineraries-page">
      <AdminPageHeader
        title="Weekly Itineraries"
        description="Curated week-by-week picks per city. Draft, publish and roll each week forward."
        actions={
          <Link to="/admin/itineraries/new" className="admin-btn admin-btn--primary">
            <Plus size={16} />
            New itinerary
          </Link>
        }
      />

      <AdminViewTabs
        views={VIEWS}
        active={view}
        counts={counts}
        panelId={PANEL_ID}
        ariaLabel="Itinerary views"
        selectId="admin-itineraries-view-select"
        selectLabel="Itinerary view"
        onChange={(next) => list.change({ view: next })}
      />

      <div
        className="admin-card admin-itineraries-page__card"
        id={PANEL_ID}
        role="tabpanel"
        aria-labelledby={`admin-view-tab-${view}`}
      >
        {loading ? (
          <p className="admin-table-empty" role="status">
            Loading itineraries…
          </p>
        ) : error ? (
          <p className="admin-table-empty admin-itineraries-page__error" role="alert">
            {error}
          </p>
        ) : visible.length === 0 ? (
          <div className="admin-table-empty" role="status">
            <p>No {activeLabel} itineraries.</p>
          </div>
        ) : (
          <>
            <div className="admin-itineraries-page__scroll">
              <table className="admin-itineraries-table">
                <thead>
                  <tr>
                    <th scope="col">Week</th>
                    <th scope="col">City</th>
                    <th scope="col">Title</th>
                    <th scope="col">Status</th>
                    <th scope="col" className="admin-itineraries-table__num">
                      Events
                    </th>
                    <th scope="col">Updated</th>
                    <th scope="col">
                      <span className="admin-visually-hidden">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((row) => (
                    <tr key={row.id}>
                      <td className="admin-itineraries-table__week">
                        {`${formatWeekRange(row.weekStart)}, ${Temporal.PlainDate.from(row.weekStart).year}`}
                      </td>
                      <td>{metroName(row.city)}</td>
                      <td>
                        <Link
                          to={`/admin/itineraries/${row.id}${row.status === "archived" ? "/preview" : ""}`}
                          className="admin-itineraries-table__title"
                        >
                          {row.title}
                        </Link>
                      </td>
                      <td>
                        <AdminStatusBadge
                          status={row.status === "published" ? "approved" : row.status}
                        />
                      </td>
                      <td className="admin-itineraries-table__num">{row.eventCount}</td>
                      <td className="admin-itineraries-table__date">
                        {new Intl.DateTimeFormat("en-US", {
                          month: "short",
                          day: "numeric",
                          timeZone: row.timeZone,
                        }).format(new Date(row.updatedAt))}
                      </td>
                      <td className="admin-itineraries-table__actions">
                        <AdminActionMenu
                          label={`Actions for ${row.title}`}
                          items={actionsFor(row)}
                          disabled={busyId === row.id}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <AdminPagination
              page={pageBounds.page}
              pageCount={pageBounds.pageCount}
              total={pageBounds.total}
              from={pageBounds.from}
              to={pageBounds.to}
              size={pageBounds.size}
              onPageChange={(page) => list.change({ page })}
              onSizeChange={(size) => list.change({ size })}
            />
          </>
        )}
      </div>

      {archiving && (
        <AdminConfirmDialog
          title={`Archive ${archiving.title}?`}
          body="The public page goes offline and the week leaves the published list. You can still open it from Archived."
          confirmLabel="Archive"
          busyLabel="Archiving…"
          isBusy={busyId === archiving.id}
          error={archiveError}
          onConfirm={() => void confirmArchive()}
          onCancel={() => setArchiving(null)}
        />
      )}

      {toast && (
        <AdminToast message={toast.message} tone={toast.tone} onDismiss={() => setToast(null)} />
      )}
    </div>
  );
}
