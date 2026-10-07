import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { Check, Plus, Upload, X } from "lucide-react";
import { useAdminEvents } from "../hooks/useAdminEvents";
import {
  removeEventFlyer,
  uploadEventFlyer,
  validateEventFlyer,
} from "../../events/api/eventFlyers";
import { updateEventFlyer } from "../../events/api/eventsRepo";
import { useCity } from "../../../contexts/useCity";
import { useMetros, useMetroName } from "../../metros/hooks/useMetros";
import { usePlatformSettings } from "../hooks/usePlatformSettings";
import { fromEventDateInstant } from "../../events/model/eventDateTime";
import type { DatabaseEvent } from "../../events/model/types";
import { draftToAdminPayload } from "../../events/components/EventForm";
import { findPotentialDuplicates } from "../model/overviewMetrics";
import {
  applyView,
  applyFilters,
  applySort,
  defaultSortFor,
  eventsListDefinition,
  viewCounts,
  DANCE_STYLES,
  SOURCE_TYPE_LABEL,
  EVENT_VIEWS,
  type EventFilters,
  type EventView,
  type SortKey,
} from "../model/eventsQuery";
import { useListState, usePageWindow } from "../hooks/useListState";
import { buildAdminFormFromEvent, buildEmptyAdminForm } from "../model/adminEventForm";
import type { AdminEventForm as AdminEventFormValues } from "../model/adminEventForm";
import AdminPageHeader from "../components/shell/AdminPageHeader";
import AdminViewTabs from "../components/shell/AdminViewTabs";
import AdminEventsToolbar from "../components/events/AdminEventsToolbar";
import AdminEventsFilterDrawer from "../components/events/AdminEventsFilterDrawer";
import AdminEventsTable, {
  type FocusRequest,
  type RowAction,
  type TableSelection,
} from "../components/events/AdminEventsTable";
import AdminPagination from "../components/common/AdminPagination";
import AdminUndoNotice from "../components/events/AdminUndoNotice";
import AdminEventEditor from "../components/events/AdminEventEditor";
import AdminConfirmDialog from "../components/common/AdminConfirmDialog";
import AdminDuplicateEventDialog from "../components/events/AdminDuplicateEventDialog";
import "./AdminEventsPage.css";

type AdminEventsView =
  { mode: "list" } | { mode: "create" } | { mode: "edit"; event: DatabaseEvent };
type PendingAction = {
  kind: "reject" | "cancel" | "archive" | "delete";
  event: DatabaseEvent;
} | null;

const VIEW_LABEL: Record<EventView, string> = {
  all: "All Events",
  upcoming: "Upcoming",
  drafts: "Drafts",
  pending: "Pending Review",
  published: "Published",
  cancelled: "Cancelled",
  archived: "Archived",
};

const STATUS_LABEL: Record<DatabaseEvent["status"], string> = {
  draft: "Draft",
  pending: "Pending Review",
  approved: "Published",
  rejected: "Rejected",
  cancelled: "Cancelled",
  archived: "Archived",
};

function formatShortDate(yyyyMmDd: string): string {
  const [year, month, day] = yyyyMmDd.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

type StatusKind = "approve" | "publish" | "unpublish" | "reject" | "archive" | "cancel" | "restore";

// One row per decision: the status it writes and the sentence announced after.
const STATUS_OUTCOME: Record<
  StatusKind,
  { status: DatabaseEvent["status"]; outcome: (title: string, day: string) => string }
> = {
  approve: {
    status: "approved",
    outcome: (title, day) => `Approved “${title}”. It is live for ${day}.`,
  },
  publish: {
    status: "approved",
    outcome: (title, day) => `Published “${title}”. It is live for ${day}.`,
  },
  unpublish: {
    status: "draft",
    outcome: (title) => `Unpublished “${title}”. It is now a draft.`,
  },
  reject: { status: "rejected", outcome: (title) => `Rejected “${title}”.` },
  archive: { status: "archived", outcome: (title) => `Archived “${title}”.` },
  cancel: { status: "cancelled", outcome: (title) => `Cancelled “${title}”.` },
  restore: {
    status: "draft",
    outcome: (title) => `Restored “${title}” as a draft.`,
  },
};

function formatLongDay(iso: string): string {
  const [year, month, day] = fromEventDateInstant(iso).date.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

interface FilterChip {
  key: string;
  label: string;
  onRemove: () => void;
}

export default function AdminEventsPage() {
  const { city } = useCity();
  const { metros } = useMetros();
  const metroName = useMetroName();
  const metroSlugs = useMemo(() => new Set(metros.map((metro) => metro.slug)), [metros]);
  const { settings: platformSettings, isLoading: platformSettingsLoading } = usePlatformSettings();
  const {
    events: queriedEvents,
    isLoading,
    error,
    refetch,
    changeStatus,
    changeStatusAsync,
    changingStatusId,
    changeStatusErrorId,
    changeStatusError,
    saveAsync,
    isSaving,
    saveError,
    remove,
    removingId,
    removeErrorId,
    removeError,
    duplicate,
    isDuplicating,
    duplicateError,
    actorId,
  } = useAdminEvents();

  const [searchParams, setSearchParams] = useSearchParams();

  const [formView, setFormView] = useState<AdminEventsView>(() =>
    searchParams.get("new") === "1" ? { mode: "create" } : { mode: "list" }
  );
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [duplicatingEvent, setDuplicatingEvent] = useState<DatabaseEvent | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [lastRowAction, setLastRowAction] = useState<RowAction | null>(null);

  // Flyer quick-action state
  const flyerInputRef = useRef<HTMLInputElement>(null);
  const [flyerTarget, setFlyerTarget] = useState<{
    event: DatabaseEvent;
    action: "upload" | "replace";
  } | null>(null);
  const [flyerBusy, setFlyerBusy] = useState<{
    id: string;
    action: "upload-flyer" | "replace-flyer" | "remove-flyer";
  } | null>(null);
  const [flyerError, setFlyerError] = useState<{ id: string; message: string } | null>(null);
  const [pendingRemoveFlyer, setPendingRemoveFlyer] = useState<DatabaseEvent | null>(null);
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set());
  const [bulkBusyIds, setBulkBusyIds] = useState<ReadonlySet<string>>(new Set());
  const [bulkRejectOpen, setBulkRejectOpen] = useState(false);
  const [notice, setNotice] = useState<{
    id: number;
    message: string;
    undo: (() => void) | null;
  } | null>(null);
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null);
  const noticeSeq = useRef(0);
  const focusSeq = useRef(0);
  const resultCountRef = useRef<HTMLParagraphElement>(null);

  const events = useMemo(() => queriedEvents ?? [], [queriedEvents]);

  // ?edit=<uuid> depends on events, which load asynchronously, so it can't
  // be resolved in the useState initializer above. Adjusted during render
  // (React's documented pattern for state derived from a changing external
  // value) rather than in an effect, which would cost an extra render pass.
  // resolvedEditId ensures this runs once per id — a match switches to edit
  // mode; no match (deleted, or not yet loaded) silently stays on the list
  // and is not retried once the query has settled.
  const editId = searchParams.get("edit");
  const [resolvedEditId, setResolvedEditId] = useState<string | null>(null);
  if (editId && editId !== resolvedEditId && queriedEvents) {
    setResolvedEditId(editId);
    const event = queriedEvents.find((candidate) => candidate.id === editId);
    if (event) setFormView({ mode: "edit", event });
  }
  if (!editId && resolvedEditId !== null) setResolvedEditId(null);

  // /admin/submissions is a dedicated route that defaults to the pending view.
  const { pathname } = useLocation();
  const listDefinition = useMemo(
    () => eventsListDefinition(metroSlugs, pathname === "/admin/submissions" ? "pending" : "upcoming"),
    [metroSlugs, pathname]
  );
  const list = useListState(listDefinition);
  const { view, filters, sort, size } = list.state;
  const sorted = useMemo(() => {
    const now = new Date();
    return applySort(applyFilters(applyView(events, view, now), filters, now), sort.key, sort.dir);
  }, [events, view, filters, sort]);
  const total = sorted.length;
  const pageBounds = usePageWindow(list, queriedEvents ? total : null);
  const pagedEvents = useMemo(
    () => sorted.slice(pageBounds.offset, pageBounds.offset + size),
    [sorted, pageBounds.offset, size]
  );
  const { page: currentPage, pageCount, from, to } = pageBounds;

  const counts = useMemo(() => viewCounts(events, new Date()), [events]);
  const duplicateIds = useMemo(() => findPotentialDuplicates(events), [events]);

  // Selection is derived against the visible page, so rows that leave (decided,
  // filtered out, paged away) drop out of it without any cleanup.
  const selectable = view === "pending";
  const selectedOnPage = useMemo(
    () => pagedEvents.filter((candidate) => selectedIds.has(candidate.id)),
    [pagedEvents, selectedIds]
  );
  const selection = useMemo<TableSelection | undefined>(
    () =>
      selectable
        ? {
            selectedIds,
            onToggle: (id) =>
              setSelectedIds((current) => {
                const next = new Set(current);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                return next;
              }),
            onToggleAll: (checked) =>
              setSelectedIds(
                checked ? new Set(pagedEvents.map((candidate) => candidate.id)) : new Set()
              ),
          }
        : undefined,
    [selectable, selectedIds, pagedEvents]
  );

  // With no explicit view in the URL, land where the work is: Pending Review
  // when anything waits there. Resolved once per visit, so deciding the last
  // entry does not bounce the page to another view.
  const landingResolved = useRef(false);
  useEffect(() => {
    if (landingResolved.current || !queriedEvents) return;
    landingResolved.current = true;
    if (searchParams.toString() === "" && counts.pending > 0) {
      list.change({ view: "pending" }, { replace: true });
    }
  }, [queriedEvents, counts, searchParams, list]);

  const handleFiltersChange = (nextFilters: EventFilters) => list.change({ filters: nextFilters });

  const clearAllFilters = () =>
    handleFiltersChange({
      q: "",
      from: null,
      to: null,
      status: [],
      organizer: null,
      venue: null,
      city: null,
      style: null,
      source: null,
      incompleteOnly: false,
      submitter: null,
    });

  const handleTableSortChange = (key: SortKey) => {
    const dir = sort.key === key ? (sort.dir === "asc" ? "desc" : "asc") : defaultSortFor(view).dir;
    list.change({ sort: { key, dir } });
  };

  const chips: FilterChip[] = [];
  if (filters.q)
    chips.push({
      key: "q",
      label: `"${filters.q}"`,
      onRemove: () => handleFiltersChange({ ...filters, q: "" }),
    });
  if (filters.from || filters.to) {
    const label =
      filters.from && filters.to
        ? `${formatShortDate(filters.from)} – ${formatShortDate(filters.to)}`
        : filters.from
          ? `From ${formatShortDate(filters.from)}`
          : `Until ${formatShortDate(filters.to!)}`;
    chips.push({
      key: "date",
      label,
      onRemove: () => handleFiltersChange({ ...filters, from: null, to: null }),
    });
  }
  filters.status.forEach((status) => {
    chips.push({
      key: `status-${status}`,
      label: STATUS_LABEL[status],
      onRemove: () =>
        handleFiltersChange({ ...filters, status: filters.status.filter((s) => s !== status) }),
    });
  });
  if (filters.organizer) {
    chips.push({
      key: "organizer",
      label: filters.organizer,
      onRemove: () => handleFiltersChange({ ...filters, organizer: null }),
    });
  }
  if (filters.venue) {
    chips.push({
      key: "venue",
      label: filters.venue,
      onRemove: () => handleFiltersChange({ ...filters, venue: null }),
    });
  }
  if (filters.submitter) {
    const needle = filters.submitter.toLowerCase();
    const matched = events.find(
      (event) =>
        event.submitter_id === filters.submitter || event.submitter_email?.toLowerCase() === needle
    );
    const matchedName = matched
      ? matched.submitter_id === null
        ? matched.submitter_name || "Guest Submitter"
        : matched.submitter_name || "this account"
      : null;
    chips.push({
      key: "submitter",
      label: matchedName ? `Submitted by ${matchedName}` : "Submitted by this account",
      onRemove: () => handleFiltersChange({ ...filters, submitter: null }),
    });
  }
  if (filters.city) {
    chips.push({
      key: "city",
      label: metroName(filters.city),
      onRemove: () => handleFiltersChange({ ...filters, city: null }),
    });
  }
  if (filters.style) {
    const styleLabel =
      DANCE_STYLES.find((option) => option.value === filters.style)?.label ?? filters.style;
    chips.push({
      key: "style",
      label: styleLabel,
      onRemove: () => handleFiltersChange({ ...filters, style: null }),
    });
  }
  if (filters.source) {
    chips.push({
      key: "source",
      label: SOURCE_TYPE_LABEL[filters.source],
      onRemove: () => handleFiltersChange({ ...filters, source: null }),
    });
  }
  if (filters.incompleteOnly) {
    chips.push({
      key: "incomplete",
      label: "Missing info",
      onRemove: () => handleFiltersChange({ ...filters, incompleteOnly: false }),
    });
  }

  const drawerFilterCount = [
    filters.organizer,
    filters.venue,
    filters.style,
    filters.city,
    filters.source,
  ].filter(Boolean).length;

  const [drawerOpen, setDrawerOpen] = useState(false);

  const busy =
    flyerBusy ??
    (changingStatusId
      ? { id: changingStatusId, action: lastRowAction ?? "publish" }
      : removingId
        ? { id: removingId, action: "delete" as const }
        : null);
  const errorId = flyerError?.id ?? changeStatusErrorId ?? removeErrorId;
  const rowError =
    flyerError?.message ??
    (changeStatusErrorId ? changeStatusError : removeErrorId ? removeError : null);

  const closeEditor = () => {
    setFormView({ mode: "list" });
    // Leaving ?edit= / ?new= behind would make the next title click a no-op.
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      next.delete("edit");
      next.delete("new");
      return next;
    });
  };

  const announce = (message: string, undo: (() => void) | null) => {
    noticeSeq.current += 1;
    setNotice({ id: noticeSeq.current, message, undo });
  };

  const requestFocus = (rowIds: string[]) => {
    focusSeq.current += 1;
    setFocusRequest({
      rowIds,
      nonce: focusSeq.current,
      onNone: () => resultCountRef.current?.focus(),
    });
  };

  const undoStatuses = (targets: DatabaseEvent[], label: string) => {
    setNotice(null);
    void Promise.allSettled(
      targets.map((target) => changeStatusAsync({ id: target.id, status: target.status }))
    ).then((results) => {
      const failed = results.filter((result) => result.status === "rejected").length;
      announce(
        failed > 0
          ? `Couldn't undo ${failed} of ${targets.length}. Use the row menu to change them back.`
          : `Undone. ${label}`,
        null
      );
    });
    requestFocus(targets.map((target) => target.id));
  };

  const applyStatus = (kind: StatusKind, event: DatabaseEvent, reason?: string) => {
    const { status, outcome } = STATUS_OUTCOME[kind];
    const index = pagedEvents.findIndex((candidate) => candidate.id === event.id);
    const neighbours = [pagedEvents[index + 1]?.id, pagedEvents[index - 1]?.id].filter(
      (id): id is string => Boolean(id)
    );
    changeStatus(
      { id: event.id, status, reason },
      {
        onSuccess: () => {
          announce(outcome(event.title, formatLongDay(event.event_date)), () =>
            undoStatuses([event], `“${event.title}” is back to ${STATUS_LABEL[event.status]}.`)
          );
          requestFocus([event.id, ...neighbours]);
        },
      }
    );
  };

  const runBulk = async (kind: "approve" | "reject") => {
    const targets = pagedEvents.filter(
      (candidate) => selectedIds.has(candidate.id) && candidate.status === "pending"
    );
    if (targets.length === 0) return;
    const { status } = STATUS_OUTCOME[kind];
    setBulkBusyIds(new Set(targets.map((target) => target.id)));
    const results = await Promise.allSettled(
      targets.map((target) => changeStatusAsync({ id: target.id, status }))
    );
    const done = targets.filter((_, index) => results[index].status === "fulfilled");
    const failed = targets.length - done.length;
    setBulkBusyIds(new Set());
    setSelectedIds((current) => {
      const next = new Set(current);
      done.forEach((target) => next.delete(target.id));
      return next;
    });
    const verb = kind === "approve" ? "Approved" : "Rejected";
    const count = `${done.length} event${done.length === 1 ? "" : "s"}`;
    announce(
      failed > 0
        ? `${verb} ${done.length} of ${targets.length}. ${failed} failed and stay selected.`
        : `${verb} ${count}.`,
      done.length > 0 ? () => undoStatuses(done, `${count} back in Pending Review.`) : null
    );
    requestFocus(pagedEvents.filter((candidate) => !done.includes(candidate)).map((c) => c.id));
  };

  const handleRowAction = (action: RowAction, event: DatabaseEvent) => {
    setLastRowAction(action);
    switch (action) {
      case "edit":
        setFormView({ mode: "edit", event });
        setSearchParams((previous) => {
          const next = new URLSearchParams(previous);
          next.set("edit", event.id);
          return next;
        });
        break;
      case "duplicate":
        setDuplicatingEvent(event);
        break;
      case "publish":
        applyStatus(event.status === "pending" ? "approve" : "publish", event);
        break;
      case "unpublish":
        applyStatus("unpublish", event);
        break;
      case "restore":
        applyStatus("restore", event);
        break;
      case "reject":
        setPendingAction({ kind: "reject", event });
        break;
      case "cancel":
        setPendingAction({ kind: "cancel", event });
        break;
      case "archive":
        setPendingAction({ kind: "archive", event });
        break;
      case "delete":
        setPendingAction({ kind: "delete", event });
        break;
      case "upload-flyer":
      case "replace-flyer":
      case "remove-flyer":
        handleFlyerMenuAction(action, event);
        break;
    }
  };

  const confirmPendingAction = (reason?: string) => {
    if (!pendingAction) return;
    switch (pendingAction.kind) {
      case "reject":
        applyStatus("reject", pendingAction.event);
        break;
      case "cancel":
        applyStatus("cancel", pendingAction.event, reason);
        break;
      case "archive":
        applyStatus("archive", pendingAction.event);
        break;
      case "delete":
        remove(pendingAction.event.id);
        break;
    }
    setPendingAction(null);
  };

  // --- Quick flyer actions ---

  const handleFlyerMenuAction = (action: RowAction, event: DatabaseEvent) => {
    setFlyerError(null);
    if (action === "remove-flyer") {
      setPendingRemoveFlyer(event);
      return;
    }
    // upload-flyer or replace-flyer → open file picker
    setFlyerTarget({ event, action: action === "upload-flyer" ? "upload" : "replace" });
    // Reset input so re-selecting the same file fires onChange
    if (flyerInputRef.current) flyerInputRef.current.value = "";
    flyerInputRef.current?.click();
  };

  const handleFlyerFileChange = async (e: {
    target: { files?: FileList | null; value: string };
  }) => {
    const file = e.target.files?.[0];
    if (!file || !flyerTarget) return;
    const { event, action } = flyerTarget;
    const busyAction = action === "upload" ? "upload-flyer" : "replace-flyer";
    setFlyerTarget(null);
    setFlyerBusy({ id: event.id, action: busyAction });
    setFlyerError(null);

    const validationError = validateEventFlyer(file);
    if (validationError) {
      setFlyerError({ id: event.id, message: validationError });
      setFlyerBusy(null);
      return;
    }

    const previousFlyerUrl = event.image_url;
    let uploadedFlyerUrl: string | null = null;

    try {
      const uploaded = await uploadEventFlyer({
        file,
        ownerId: actorId!,
        eventId: event.id,
      });
      uploadedFlyerUrl = uploaded.url;

      await updateEventFlyer(event.id, uploaded.url);

      // DB updated — now best-effort delete the old object
      if (previousFlyerUrl) {
        try {
          await removeEventFlyer(previousFlyerUrl);
        } catch {
          // Cleanup failure is non-blocking; the event already points to the new flyer.
        }
      }

      refetch();
    } catch (err) {
      // If DB update failed after upload, clean up the newly uploaded object
      if (uploadedFlyerUrl) {
        try {
          await removeEventFlyer(uploadedFlyerUrl);
        } catch {
          // Best-effort cleanup
        }
      }
      const message =
        err instanceof Error && err.message
          ? err.message
          : action === "upload"
            ? "Unable to upload flyer."
            : "Unable to replace flyer.";
      setFlyerError({ id: event.id, message });
    } finally {
      setFlyerBusy(null);
    }
  };

  const confirmRemoveFlyer = async () => {
    if (!pendingRemoveFlyer) return;
    const event = pendingRemoveFlyer;
    setPendingRemoveFlyer(null);
    setFlyerBusy({ id: event.id, action: "remove-flyer" });
    setFlyerError(null);

    try {
      await updateEventFlyer(event.id, null);
      // DB cleared — now best-effort delete the old object
      if (event.image_url) {
        try {
          await removeEventFlyer(event.image_url);
        } catch {
          // Cleanup failure is non-blocking
        }
      }
      refetch();
    } catch (err) {
      const message = err instanceof Error && err.message ? err.message : "Unable to remove flyer.";
      setFlyerError({ id: event.id, message });
    } finally {
      setFlyerBusy(null);
    }
  };

  // --- End quick flyer actions ---

  const isPendingActionBusy =
    pendingAction?.kind === "delete"
      ? removingId === pendingAction.event.id
      : changingStatusId === pendingAction?.event.id;

  const submitForm = async (form: AdminEventFormValues, flyer: File | null) => {
    const id = formView.mode === "edit" ? formView.event.id : null;
    const previousFlyerUrl = formView.mode === "edit" ? formView.event.image_url : null;
    let uploadedFlyerUrl: string | null = null;

    try {
      const payload = draftToAdminPayload(form);
      if (flyer && formView.mode === "edit") {
        const uploadedFlyer = await uploadEventFlyer({
          file: flyer,
          ownerId: actorId!,
          eventId: formView.event.id,
        });
        uploadedFlyerUrl = uploadedFlyer.url;
        payload.image_url = uploadedFlyer.url;
      }

      await saveAsync({ id, payload });
    } catch (submissionError) {
      if (uploadedFlyerUrl) {
        try {
          await removeEventFlyer(uploadedFlyerUrl);
        } catch {
          // Preserve the primary upload/save error for the administrator.
        }
      }
      throw submissionError;
    }

    if (uploadedFlyerUrl && previousFlyerUrl) {
      try {
        await removeEventFlyer(previousFlyerUrl);
      } catch {
        // The new flyer is persisted; stale-object cleanup is best effort.
      }
    }
    closeEditor();
  };

  if (formView.mode !== "list") {
    const isEdit = formView.mode === "edit";
    if (!isEdit && platformSettingsLoading) {
      return (
        <section className="admin-page" aria-busy="true">
          <div className="admin-skeleton" />
        </section>
      );
    }
    return (
      <AdminEventEditor
        initial={
          isEdit
            ? buildAdminFormFromEvent(formView.event)
            : buildEmptyAdminForm(platformSettings?.default_city ?? city ?? "")
        }
        initialTaxonomyTerms={isEdit ? formView.event.taxonomy_terms : []}
        heading={isEdit ? "Edit event" : "New event"}
        submitLabel={isEdit ? "Save changes" : "Create event"}
        isSaving={isSaving}
        error={saveError}
        eventId={isEdit ? formView.event.id : undefined}
        onSubmit={submitForm}
        flyerOwnerId={actorId}
        onCancel={closeEditor}
      />
    );
  }

  const noFiltersActive = chips.length === 0;
  const emptyDb = !isLoading && !error && events.length === 0;

  return (
    <>
      <AdminPageHeader
        title="Events"
        description="Manage events appearing on the SalsaSegura calendar."
        actions={
          <>
            <Link to="/admin/events/import" className="admin-btn admin-btn--secondary">
              <Upload size={16} />
              Import Events
            </Link>
            <Link to="/admin/events/import-flyers" className="admin-btn admin-btn--secondary">
              <Upload size={16} />
              Import Flyers
            </Link>
            <button
              type="button"
              className="admin-btn admin-btn--primary"
              onClick={() => setFormView({ mode: "create" })}
            >
              <Plus size={16} />
              Create Event
            </button>
          </>
        }
      />

      {!isLoading && error && (
        <div className="admin-banner admin-banner--error" role="alert">
          <p>We couldn&apos;t load events.</p>
          <button
            type="button"
            className="admin-btn admin-btn--secondary"
            onClick={() => refetch()}
          >
            Try Again
          </button>
        </div>
      )}
      {duplicateWarning && (
        <div className="admin-banner admin-banner--warning" role="status">
          <p>{duplicateWarning}</p>
          <button
            type="button"
            className="admin-btn admin-btn--secondary"
            onClick={() => setDuplicateWarning(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {!error && (
        <>
          <AdminViewTabs
            views={EVENT_VIEWS}
            active={view}
            counts={counts}
            panelId="admin-events-tabpanel"
            ariaLabel="Event views"
            selectId="admin-view-tabs-select"
            selectLabel="Event view"
            onChange={(nextView) => list.change({ view: nextView })}
          />

          <div className="admin-card admin-events-page__toolbar-card">
            <AdminEventsToolbar
              filters={filters}
              onFiltersChange={handleFiltersChange}
              sort={sort}
              onSortChange={(nextSort) => list.change({ sort: nextSort })}
              drawerFilterCount={drawerFilterCount}
              onOpenDrawer={() => setDrawerOpen(true)}
            />

            {chips.length > 0 && (
              <div className="admin-events-page__chips">
                {chips.map((chip) => (
                  <div key={chip.key} className="admin-chip admin-filter-chip">
                    <span>{chip.label}</span>
                    <button
                      type="button"
                      className="admin-filter-chip-dismiss"
                      aria-label={`Remove ${chip.label} filter`}
                      onClick={chip.onRemove}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
                {chips.length >= 2 && (
                  <button
                    type="button"
                    className="admin-btn admin-btn--ghost admin-events-page__clear-all"
                    onClick={clearAllFilters}
                  >
                    Clear all
                  </button>
                )}
              </div>
            )}
          </div>

          <p
            role="status"
            className="admin-events-page__result-count"
            ref={resultCountRef}
            tabIndex={-1}
          >
            {total} event{total === 1 ? "" : "s"}
          </p>

          <div
            className="admin-card admin-events-page__table-card"
            id="admin-events-tabpanel"
            role="tabpanel"
            aria-labelledby={`admin-view-tab-${view}`}
          >
            {isLoading ? (
              <div className="admin-events-page__skeleton" aria-busy="true">
                <p role="status" className="admin-events-page__status">
                  Loading events…
                </p>
                {Array.from({ length: size }, (_, index) => (
                  <div key={index} className="admin-events-page__skeleton-row" aria-hidden="true">
                    <span className="admin-skeleton admin-events-page__skeleton-thumb" />
                    <span className="admin-events-page__skeleton-lines">
                      <span className="admin-skeleton admin-events-page__skeleton-line" />
                      <span className="admin-skeleton admin-events-page__skeleton-line admin-events-page__skeleton-line--short" />
                    </span>
                    <span className="admin-skeleton admin-events-page__skeleton-pill" />
                  </div>
                ))}
              </div>
            ) : emptyDb ? (
              <div className="admin-events-page__empty">
                <h2>No events yet</h2>
                <p>Create the first SalsaSegura event.</p>
                <button
                  type="button"
                  className="admin-btn admin-btn--primary"
                  onClick={() => setFormView({ mode: "create" })}
                >
                  <Plus size={16} />
                  Create Event
                </button>
              </div>
            ) : total === 0 && !noFiltersActive ? (
              <div className="admin-events-page__empty">
                <h2>No events match your filters.</h2>
                <p>Try adjusting your filters or clearing them.</p>
                <button
                  type="button"
                  className="admin-btn admin-btn--ghost"
                  onClick={clearAllFilters}
                >
                  Clear Filters
                </button>
              </div>
            ) : total === 0 && view === "upcoming" ? (
              <div className="admin-events-page__empty">
                <h2>No upcoming events</h2>
                <p>Nothing is scheduled from today onward.</p>
                <button
                  type="button"
                  className="admin-btn admin-btn--primary"
                  onClick={() => setFormView({ mode: "create" })}
                >
                  <Plus size={16} />
                  Create Event
                </button>
              </div>
            ) : total === 0 && view === "pending" ? (
              <div className="admin-events-page__empty">
                <h2>Nothing waiting for review</h2>
                <p>Every submission has been handled.</p>
              </div>
            ) : total === 0 ? (
              <div className="admin-events-page__empty">
                <h2>No {VIEW_LABEL[view]} events</h2>
              </div>
            ) : (
              <>
                <AdminEventsTable
                  events={pagedEvents}
                  duplicateIds={duplicateIds}
                  sort={sort}
                  onSortChange={handleTableSortChange}
                  onAction={handleRowAction}
                  busy={busy}
                  busyIds={bulkBusyIds}
                  errorId={errorId}
                  error={rowError}
                  selection={selection}
                  focusRequest={focusRequest}
                  hideCity={Boolean(filters.city)}
                />
                <AdminPagination
                  page={currentPage}
                  pageCount={pageCount}
                  total={total}
                  from={from}
                  to={to}
                  size={size}
                  onPageChange={(nextPage) => list.change({ page: nextPage })}
                  onSizeChange={(nextSize) => list.change({ size: nextSize })}
                />
              </>
            )}
          </div>

          <div className="admin-events-dock">
            {/* Always mounted so assistive tech announces each outcome as it changes. */}
            <div role="status" aria-live="polite" className="admin-visually-hidden">
              {notice?.message ?? ""}
            </div>
            {selection && selectedOnPage.length > 0 && (
              <div className="admin-events-bulkbar" role="region" aria-label="Bulk decisions">
                <p className="admin-events-bulkbar__count">{selectedOnPage.length} selected</p>
                <div className="admin-events-bulkbar__actions">
                  <button
                    type="button"
                    className="admin-events-decision admin-events-decision--approve"
                    disabled={bulkBusyIds.size > 0}
                    onClick={() => void runBulk("approve")}
                  >
                    <Check size={14} aria-hidden="true" />
                    Approve {selectedOnPage.length}
                  </button>
                  <button
                    type="button"
                    className="admin-events-decision admin-events-decision--reject"
                    disabled={bulkBusyIds.size > 0}
                    onClick={() => setBulkRejectOpen(true)}
                  >
                    <X size={14} aria-hidden="true" />
                    Reject {selectedOnPage.length}
                  </button>
                  <button
                    type="button"
                    className="admin-btn admin-btn--ghost"
                    disabled={bulkBusyIds.size > 0}
                    onClick={() => setSelectedIds(new Set())}
                  >
                    Clear selection
                  </button>
                </div>
              </div>
            )}
            {notice && (
              <AdminUndoNotice
                key={notice.id}
                message={notice.message}
                onUndo={notice.undo ?? undefined}
                onDismiss={() => setNotice(null)}
              />
            )}
          </div>
        </>
      )}

      <AdminEventsFilterDrawer
        open={drawerOpen}
        events={events}
        filters={filters}
        onFiltersChange={handleFiltersChange}
        onClearAll={clearAllFilters}
        onClose={() => setDrawerOpen(false)}
      />

      {pendingAction && (
        <AdminConfirmDialog
          title={
            pendingAction.kind === "reject"
              ? "Reject this event?"
              : pendingAction.kind === "cancel"
                ? "Cancel this event?"
                : pendingAction.kind === "archive"
                  ? "Archive this event?"
                  : "Delete this event?"
          }
          body={
            pendingAction.kind === "reject"
              ? `"${pendingAction.event.title}" will be hidden from the public calendar. You can approve it again later.`
              : pendingAction.kind === "cancel"
                ? `"${pendingAction.event.title}" will be marked cancelled. It stays visible in the admin list and is removed from the public calendar.`
                : pendingAction.kind === "archive"
                  ? `"${pendingAction.event.title}" will be moved to Archived and hidden from the main event list. You can restore it later.`
                  : `"${pendingAction.event.title}" will be permanently deleted. This cannot be undone.`
          }
          confirmLabel={
            pendingAction.kind === "reject"
              ? "Reject event"
              : pendingAction.kind === "cancel"
                ? "Cancel event"
                : pendingAction.kind === "archive"
                  ? "Archive event"
                  : "Delete event"
          }
          tone={pendingAction.kind === "archive" ? "neutral" : "danger"}
          cancelLabel={pendingAction.kind === "cancel" ? "Keep event" : undefined}
          reasonField={
            pendingAction.kind === "cancel"
              ? { label: "Reason (optional)", required: false }
              : undefined
          }
          isBusy={isPendingActionBusy}
          onConfirm={confirmPendingAction}
          onCancel={() => setPendingAction(null)}
        />
      )}

      {bulkRejectOpen && (
        <AdminConfirmDialog
          title={`Reject ${selectedOnPage.length} event${selectedOnPage.length === 1 ? "" : "s"}?`}
          body="They will be hidden from the public calendar. You can approve them again later."
          confirmLabel={`Reject ${selectedOnPage.length}`}
          cancelLabel="Keep reviewing"
          tone="danger"
          isBusy={bulkBusyIds.size > 0}
          onConfirm={() => {
            setBulkRejectOpen(false);
            void runBulk("reject");
          }}
          onCancel={() => setBulkRejectOpen(false)}
        />
      )}

      {duplicatingEvent && (
        <AdminDuplicateEventDialog
          event={duplicatingEvent}
          isBusy={isDuplicating}
          error={duplicateError}
          onConfirm={(input) => {
            duplicate(
              {
                source: duplicatingEvent,
                input,
                onTaxonomyFailure: setDuplicateWarning,
              },
              { onSuccess: () => setDuplicatingEvent(null) }
            );
          }}
          onCancel={() => setDuplicatingEvent(null)}
        />
      )}

      {/* Hidden file input for quick flyer upload/replace */}
      <input
        ref={flyerInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={handleFlyerFileChange}
      />

      {pendingRemoveFlyer && (
        <AdminConfirmDialog
          title="Remove flyer"
          body={`Remove the flyer from "${pendingRemoveFlyer.title}"? The event will show the default image.`}
          confirmLabel="Remove flyer"
          tone="danger"
          isBusy={flyerBusy?.id === pendingRemoveFlyer.id && flyerBusy.action === "remove-flyer"}
          onConfirm={confirmRemoveFlyer}
          onCancel={() => setPendingRemoveFlyer(null)}
        />
      )}
    </>
  );
}
