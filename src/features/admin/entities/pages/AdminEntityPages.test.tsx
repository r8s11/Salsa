import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import AdminEntityDirectoryPage from "./AdminEntityDirectoryPage";
import AdminEntityDetailPage from "./AdminEntityDetailPage";
import type { AdminEntityRow, EntityKind } from "../model";
import type { WorkspaceMember } from "../../../workspaces/model";

const mocks = vi.hoisted(() => ({
  fetchDirectory: vi.fn(),
  fetchDetail: vi.fn(),
  saveEntity: vi.fn(),
  mergeEntities: vi.fn(),
  useDirectory: vi.fn(),
  directory: [] as AdminEntityRow[],
  detail: null as AdminEntityRow | null,
  members: [] as WorkspaceMember[],
  membersFor: vi.fn(),
  submissions: [] as unknown[],
}));

vi.mock("../api/entitiesRepo", () => ({
  fetchAdminEntityDirectory: (...args: unknown[]) => mocks.fetchDirectory(...args),
  fetchAdminEntityDetail: (...args: unknown[]) => mocks.fetchDetail(...args),
  saveAdminEntity: (...args: unknown[]) => mocks.saveEntity(...args),
  mergeAdminEntities: (...args: unknown[]) => mocks.mergeEntities(...args),
}));

vi.mock("../hooks/useAdminEntities", () => ({
  useAdminEntityDirectory: (kind: EntityKind, query: string, status: string | null) => {
    mocks.useDirectory(kind, query, status);
    return { rows: mocks.directory.filter((row) => (!query || row.name.toLowerCase().includes(query.toLowerCase())) && (!status || row.status === status)), isLoading: false, error: null, refetch: vi.fn() };
  },
  useAdminEntity: () => ({ entity: mocks.detail, isLoading: false, error: null, refetch: vi.fn() }),
  useAdminEntityActions: () => ({ save: mocks.saveEntity, archive: mocks.saveEntity, merge: mocks.mergeEntities, isSaving: false, isMerging: false, error: null }),
  useAdminVenueOptions: () => [],
}));

vi.mock("../../hooks/useAdminEntityClaims", () => ({
  useAdminEntityMembers: (kind: string | null, id: string | null) => {
    mocks.membersFor(kind, id);
    return { members: mocks.members, isLoading: false, error: null, refetch: vi.fn() };
  },
}));

vi.mock("../../hooks/useAdminSubmissionList", () => ({
  useAdminSubmissions: () => ({ submissions: mocks.submissions, isLoading: false, error: null }),
}));

vi.mock("../../../metros/hooks/useMetros", () => import("../../../../test/mockMetros"));

const entity = (kind: EntityKind, overrides: Partial<AdminEntityRow> = {}): AdminEntityRow => ({
  id: `${kind}-1`, kind, name: "Boston Dance Collective", slug: "boston-dance-collective", status: "needs_review",
  description: "Community dance classes", image_url: null, city: "boston", website: null, instagram: null,
  quality_issues: ["missing_description"], linked_events: [{ id: "event-1", title: "Friday Salsa", status: "approved", event_date: "2026-10-09T20:00:00Z" }],
  ...overrides,
});

function renderDirectory(kind: EntityKind) {
  return render(<MemoryRouter><AdminEntityDirectoryPage kind={kind} /></MemoryRouter>);
}

function renderDetail(kind: EntityKind, id: string) {
  const directory = kind === "organizer" ? "organizers" : kind === "series" ? "series" : `${kind}s`;
  return render(
    <MemoryRouter initialEntries={[`/admin/${directory}/${id}`]}>
      <Routes>
        <Route path={`/admin/${directory}/:id`} element={<AdminEntityDetailPage kind={kind} />} />
      </Routes>
    </MemoryRouter>
  );
}
function renderCreate(kind: EntityKind) {
  const directory = kind === "organizer" ? "organizers" : kind === "series" ? "series" : `${kind}s`;
  return render(
    <MemoryRouter initialEntries={[`/admin/${directory}/new`]}>
      <Routes>
        <Route path={`/admin/${directory}/new`} element={<AdminEntityDetailPage kind={kind} mode="create" />} />
      </Routes>
    </MemoryRouter>
  );
}

afterEach(() => {
  mocks.directory = [];
  mocks.detail = null;
  mocks.members = [];
  mocks.submissions = [];
  mocks.membersFor.mockReset();
  mocks.fetchDirectory.mockReset();
  mocks.fetchDetail.mockReset();
  mocks.saveEntity.mockReset();
  mocks.useDirectory.mockReset();
});
describe("AdminEntityDirectoryPage", () => {
  it("shows searchable entity names and needs-review quality flags", () => {
    mocks.directory = [entity("school")];
    renderDirectory("school");
    expect(screen.getByRole("heading", { name: "Schools" })).toBeVisible();
    expect(screen.getByRole("link", { name: /Boston Dance Collective/ })).toHaveAttribute("href", "/admin/schools/school-1");
    expect(screen.getByText("Missing description")).toBeVisible();
    expect(screen.getByRole("searchbox", { name: "Search schools" })).toBeVisible();
  });

  it("provides status filtering and a name-labeled create action", () => {
    renderDirectory("series");
    expect(screen.getByRole("combobox", { name: "Filter by status" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Create series" })).toHaveAttribute("href", "/admin/series/new");
  });

  it("keeps the full typed search and preserves the status filter on submission", async () => {
    const user = userEvent.setup();
    mocks.directory = [
      entity("school", { id: "active", name: "Boston Dance Collective", status: "active" }),
      entity("school", { id: "review", name: "Boston Dance Collective Review" }),
      entity("school", { id: "other", name: "Other school", status: "active" }),
    ];
    renderDirectory("school");
    await user.selectOptions(screen.getByRole("combobox", { name: "Filter by status" }), "active");
    const search = screen.getByRole("searchbox", { name: "Search schools" });
    await user.type(search, "Boston Dance Collective");
    expect(search).toHaveValue("Boston Dance Collective");
    await user.click(screen.getByRole("button", { name: "Search" }));
    expect(screen.getByRole("link", { name: "Boston Dance Collective" })).toBeVisible();
    expect(screen.queryByRole("link", { name: "Boston Dance Collective Review" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Other school" })).not.toBeInTheDocument();
  });

});
describe("AdminEntity creation", () => {
  it("requires a separate confirmation before creating an entity", () => {
    renderCreate("school");
    fireEvent.change(screen.getByRole("textbox", { name: "Name" }), { target: { value: "Salsa Lab" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue to create" }));
    expect(screen.getByRole("dialog", { name: "Create school?" })).toBeVisible();
    expect(mocks.saveEntity).not.toHaveBeenCalled();
  });

  it("picks the city from registered metros and sends its slug", () => {
    mocks.saveEntity.mockResolvedValue({ id: "series-9" });
    renderCreate("series");
    fireEvent.change(screen.getByRole("textbox", { name: "Name" }), { target: { value: "Candela" } });
    fireEvent.change(screen.getByRole("combobox", { name: "City" }), { target: { value: "boston" } });
    expect(screen.getByRole("option", { name: "Boston" })).toHaveProperty("selected", true);
    fireEvent.click(screen.getByRole("button", { name: "Continue to create" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "Create series?" })).getByRole("button", { name: "Create series" }));
    expect(mocks.saveEntity).toHaveBeenCalledWith({ id: null, payload: expect.objectContaining({ city: "boston" }) });
  });

  it("stops a save whose city is not a registered metro and says so before the server does", () => {
    mocks.detail = entity("series", { status: "active", city: "Boston, MA" });
    renderDetail("series", "series-1");
    fireEvent.click(screen.getByRole("button", { name: "Edit series" }));
    expect(screen.getByRole("combobox", { name: "City" })).toHaveValue("Boston, MA");
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(screen.getByRole("alert")).toHaveTextContent("“Boston, MA” is not a registered city. Choose one from the list or No city.");
    expect(mocks.saveEntity).not.toHaveBeenCalled();
  });
});

describe("AdminEntityDetailPage", () => {
  it("shows linked events and offers an edit form with entity fields", () => {
    mocks.detail = entity("organizer", { status: "active" });
    renderDetail("organizer", "organizer-1");
    expect(screen.getByRole("heading", { name: "Boston Dance Collective" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Friday Salsa" })).toHaveAttribute("href", "/admin/events?edit=event-1");
    fireEvent.click(screen.getByRole("button", { name: "Edit organizer" }));
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue("Boston Dance Collective");
    expect(screen.getByRole("textbox", { name: "Public URL slug" })).toHaveAttribute("readonly");
    expect(screen.getByRole("button", { name: "Save changes" })).toBeVisible();
  });

  it("requires explicit confirmation before archiving", () => {
    mocks.detail = entity("school", { status: "active" });
    renderDetail("school", "school-1");
    fireEvent.click(screen.getByRole("button", { name: "Archive school" }));
    expect(screen.getByRole("dialog", { name: "Archive school?" })).toBeVisible();
    expect(mocks.saveEntity).not.toHaveBeenCalled();
  });

  it("requires explicit confirmation before merging duplicates", () => {
    mocks.detail = entity("instructor", { status: "active" });
    renderDetail("instructor", "instructor-1");
    fireEvent.click(screen.getByRole("button", { name: "Merge duplicate" }));
    expect(screen.getByRole("dialog", { name: "Merge duplicate instructors?" })).toBeVisible();
    expect(mocks.mergeEntities).not.toHaveBeenCalled();
  });

  it("shows the team of a school with a link into its workspace and the claims queue", () => {
    mocks.detail = entity("school", { status: "active" });
    mocks.members = [
      { user_id: "u1", email: "ana@example.com", display_name: "Ana Reyes", member_role: "owner", created_at: "2026-10-01T00:00:00Z" },
      { user_id: "u2", email: "luis@example.com", display_name: null, member_role: "editor", created_at: "2026-10-02T00:00:00Z" },
    ];
    renderDetail("school", "school-1");
    const team = screen.getByRole("region", { name: /Team/ });
    expect(within(team).getByText("Ana Reyes")).toBeVisible();
    expect(within(team).getByText("ana@example.com")).toBeVisible();
    expect(within(team).getByText("Owner")).toBeVisible();
    expect(within(team).getByText("luis@example.com")).toBeVisible();
    expect(within(team).getByText("Editor")).toBeVisible();
    expect(within(team).getByRole("link", { name: "Open workspace" })).toHaveAttribute("href", "/host/schools/school-1");
    expect(within(team).getByRole("link", { name: "Pending claims" })).toHaveAttribute("href", "/admin/claims");
    expect(mocks.membersFor).toHaveBeenCalledWith("school", "school-1");
  });

  it("says so when nobody manages an instructor listing", () => {
    mocks.detail = entity("instructor", { status: "active" });
    renderDetail("instructor", "instructor-1");
    expect(screen.getByText("Nobody manages this listing yet.")).toBeVisible();
    expect(screen.getByRole("link", { name: "Open workspace" })).toHaveAttribute("href", "/host/instructors/instructor-1");
  });

  it("has no team section for organizers or series", () => {
    mocks.detail = entity("organizer", { status: "active" });
    renderDetail("organizer", "organizer-1");
    expect(screen.queryByRole("region", { name: /Team/ })).not.toBeInTheDocument();
  });

  it("lists pending submissions whose review links this record, and not ones a moderator unlinked", () => {
    const id = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
    const organizerItem = (decision: "existing" | "removed") => ({
      candidate: { name: "Boston Dance Collective" },
      state: "MATCHED",
      matches: [{ id, name: "Boston Dance Collective" }],
      decision,
      selected_id: decision === "existing" ? id : null,
    });
    const review = (decision: "existing" | "removed") => ({
      venue: null,
      organizer: organizerItem(decision),
      instructors: [],
      school: null,
    });
    mocks.submissions = [
      {
        id: "sub-suggested",
        submitted_at: "2026-10-20T12:00:00Z",
        submitted_data: { title: "Thursday Bachata", entity_review: review("existing") },
        edited_data: null,
      },
      {
        id: "sub-unlinked",
        submitted_at: "2026-10-21T12:00:00Z",
        submitted_data: { title: "Moderator said no", entity_review: review("existing") },
        edited_data: { entity_review: review("removed") },
      },
    ];
    mocks.detail = entity("organizer", { id, status: "active" });
    renderDetail("organizer", id);

    const section = screen.getByRole("region", { name: /Pending submissions linking it/ });
    expect(within(section).getByRole("link", { name: "Thursday Bachata" })).toHaveAttribute(
      "href",
      "/admin/submissions/sub-suggested"
    );
    expect(within(section).getByText("Submitter suggested it")).toBeVisible();
    expect(within(section).queryByText("Moderator said no")).not.toBeInTheDocument();
  });
});
