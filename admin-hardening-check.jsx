import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Clock } from "lucide-react";
import "./src/styles/index.css";
import "./src/styles/admin.css";
import Duplicate from "./src/components/Admin/AdminDuplicateEventDialog";
import Merge from "./src/components/Admin/AdminMergeTaxonomyDialog";
import Drawer from "./src/components/Admin/AdminSubmissionsFilterDrawer";
import Venue from "./src/components/Admin/AdminVenueForm";
import User from "./src/components/Admin/AdminUserForm";
import Analytics from "./src/components/Admin/AdminAnalyticsFilters";
import Pagination from "./src/components/Admin/AdminPagination";
import Menu from "./src/components/Admin/AdminActionMenu";
import Metric from "./src/components/Admin/AdminMetricCard";
import Founder from "./src/components/Admin/AdminFounderRequestsTable";
import Events from "./src/components/Admin/AdminEventsTable";
import Submissions from "./src/components/Admin/AdminSubmissionsTable";
import Taxonomy from "./src/components/Admin/AdminTaxonomyTable";
import Users from "./src/components/Admin/AdminUsersTable";
import Venues from "./src/components/Admin/AdminVenuesTable";
import Organizers from "./src/components/Admin/AdminOrganizerRequestsTable";
import "./src/components/Admin/AdminApproveDialog.css";
import "./src/components/Admin/AdminRejectFounderDialog.css";
const noop = () => {};
const source = {
  id: "source",
  category: "dance_style",
  name: "Salsa Dancing",
  slug: "salsa-dancing",
  description: null,
  parent_id: null,
  status: "active",
  display_order: 1,
  usage_count: 12,
  updated_at: "2026-08-14T00:00:00Z",
};
const founder = {
  id: "req-1",
  applicant_name: "Test User",
  email: "test-founder@example.com",
  organization_name: "Test Founder Org",
  instagram: "testfounder",
  website: "example.com",
  city: "Test City",
  region: "Test Region",
  status: "pending",
  created_at: "2026-09-01T10:00:00Z",
  updated_at: "2026-09-01T10:00:00Z",
};
window.submits = [];
function Check() {
  const [modal, setModal] = useState(null),
    [busy, setBusy] = useState(false),
    [range, setRange] = useState("30d"),
    [granularity, setGranularity] = useState("weekly"),
    [filters, setFilters] = useState({ status: null, submitter_name: null }),
    [page, setPage] = useState(1);
  const mode = new URLSearchParams(location.search).get("mode");
  const common = {
    events: [],
    requests: [],
    submissions: [],
    terms: [],
    venues: [],
    users: [],
    duplicateIds: new Set(),
    sort: { key: "name", dir: "asc" },
    onSortChange: noop,
    onAction: noop,
    busy: null,
    error: null,
    errorId: null,
    isAdmin: true,
    adminCount: 2,
    currentUserId: null,
    onArchive: noop,
    onDelete: noop,
    onRestore: noop,
  };
  return (
    <div className="admin-shell" style={{ display: "block", padding: 20, minHeight: "160vh" }}>
      <h1>Admin hardening verification</h1>
      {mode === "tables" ? (
        <>
          {[Events, Submissions, Taxonomy, Users, Venues, Organizers].map((Table, i) => (
            <section key={i} data-table={i}>
              <h2>{Table.name}</h2>
              <div data-state="loading">
                <Table {...common} isLoading />
              </div>
              <div data-state="empty">
                <Table {...common} />
              </div>
            </section>
          ))}
          <Founder requests={[founder]} isAdmin onAction={noop} />
        </>
      ) : mode === "venue" ? (
        <Venue onSubmit={(v) => window.submits.push(v)} onCancel={noop} />
      ) : (
        <>
          <div id="openers">
            {["duplicate", "merge", "drawer", "user"].map((n) => (
              <button className="admin-btn" id={"open-" + n} key={n} onClick={() => setModal(n)}>
                Open {n}
              </button>
            ))}
          </div>
          <Analytics
            range={range}
            onRangeChange={setRange}
            granularity={granularity}
            onGranularityChange={setGranularity}
            dateRange={{ from: new Date("2026-09-01"), to: new Date("2026-09-19") }}
            fromDate="2026-09-01"
            toDate="2026-09-19"
            onCustomRangeChange={noop}
          />
          <Pagination
            page={page}
            pageCount={10}
            total={100}
            from={1}
            to={10}
            size={10}
            onPageChange={setPage}
            onSizeChange={noop}
          />
          <Menu
            label="Fixture actions"
            items={[{ id: "view", label: "View fixture", onSelect: noop }]}
          />
          <Metric label="Pending" value={null} subLabel="Unavailable" icon={Clock} onRetry={noop} />
          <div className="admin-approve-dialog">
            <p className="approve-note">Approval information</p>
          </div>
          <button id="busy-toggle" onClick={() => setBusy(!busy)}>
            Toggle busy
          </button>
          {modal === "duplicate" && (
            <Duplicate
              event={{ event_date: "2026-09-01T18:00:00Z", title: "Fixture event" }}
              isBusy={busy}
              error={null}
              onConfirm={noop}
              onCancel={() => setModal(null)}
            />
          )}
          {modal === "merge" && (
            <Merge
              source={source}
              candidates={[{ ...source, id: "keep", name: "Salsa" }]}
              onMerge={noop}
              onClose={() => setModal(null)}
            />
          )}
          <Drawer
            open={modal === "drawer"}
            submissions={[]}
            filters={filters}
            onFiltersChange={setFilters}
            onClose={() => setModal(null)}
          />
          {modal === "user" && (
            <User
              isBusy={busy}
              error={null}
              created={null}
              onSubmit={(v) => window.submits.push(v)}
              onCancel={() => setModal(null)}
            />
          )}
        </>
      )}
    </div>
  );
}
createRoot(document.getElementById("root")).render(
  <QueryClientProvider client={new QueryClient()}>
    <MemoryRouter>
      <Check />
    </MemoryRouter>
  </QueryClientProvider>
);
