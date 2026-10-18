import type { SubmitEvent } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ComposerEntitySelect from "./ComposerEntitySelect";

const mocks = vi.hoisted(() => ({
  searchEntityMatches: vi.fn(),
  searchVenues: vi.fn(),
  fetchAdminEntityDirectory: vi.fn(),
  fetchAdminEntityDetail: vi.fn(),
  saveAdminEntity: vi.fn(),
  createVenue: vi.fn(),
}));
vi.mock("../../../entity-matching/entityReviewClient", () => ({
  searchEntityMatches: mocks.searchEntityMatches,
}));
vi.mock("../../api/venuesRepo", () => ({
  searchVenues: mocks.searchVenues,
  createVenue: mocks.createVenue,
}));
vi.mock("../../entities/api/entitiesRepo", () => ({
  fetchAdminEntityDirectory: mocks.fetchAdminEntityDirectory,
  fetchAdminEntityDetail: mocks.fetchAdminEntityDetail,
  saveAdminEntity: mocks.saveAdminEntity,
}));

const match = { id: "e-1", name: "Salsa House", address: "10 Main St", city: "Boston" };
function renderSelect(
  kind: "venue" | "organizer" | "instructor" | "school" | "series" = "organizer",
  onSelect = vi.fn()
) {
  return {
    onSelect,
    ...render(
      <div className="admin-shell">
        <ComposerEntitySelect kind={kind} value={null} onSelect={onSelect} city="Boston" />
      </div>
    ),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.searchEntityMatches.mockResolvedValue([]);
  mocks.searchVenues.mockResolvedValue([]);
  mocks.fetchAdminEntityDirectory.mockResolvedValue([]);
  mocks.saveAdminEntity.mockResolvedValue({
    id: "created",
    kind: "organizer",
    name: "New Org",
    status: "active",
  });
  mocks.createVenue.mockResolvedValue({
    id: "venue-new",
    name: "New Venue",
    city: "Boston",
    address_line1: "12 Main",
  });
});

describe("ComposerEntitySelect", () => {
  it("selects a search result with keyboard navigation and Enter", async () => {
    const user = userEvent.setup();
    const { onSelect } = renderSelect();
    mocks.searchEntityMatches.mockResolvedValue([match]);
    const input = screen.getByRole("combobox", { name: "Organizer" });
    await user.type(input, "Salsa");
    const option = await screen.findByRole("option", { name: /Salsa House/ });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: "e-1", name: "Salsa House" })
    );
    expect(option).not.toBeInTheDocument();
  });
  it("requires choosing an exact duplicate instead of creating it", async () => {
    const user = userEvent.setup();
    renderSelect();
    mocks.searchEntityMatches.mockResolvedValue([match]);
    await user.type(screen.getByRole("combobox", { name: "Organizer" }), "Salsa House");
    await screen.findByRole("option", { name: /Salsa House/ });
    expect(screen.queryByRole("button", { name: /Create organizer/ })).not.toBeInTheDocument();
    expect(mocks.saveAdminEntity).not.toHaveBeenCalled();
  });
  it("ignores duplicate results for a name changed while lookup is pending", async () => {
    const user = userEvent.setup();
    renderSelect();
    const request = Promise.withResolvers<(typeof match)[]>();
    mocks.searchEntityMatches.mockReturnValueOnce(request.promise);
    const input = screen.getByRole("combobox", { name: "Organizer" });
    await user.type(input, "Old Name");
    await waitFor(() => expect(mocks.searchEntityMatches).toHaveBeenCalledTimes(1));
    await user.clear(input);
    mocks.searchEntityMatches.mockResolvedValueOnce([]);
    await user.type(input, "New Name");
    await waitFor(() => expect(mocks.searchEntityMatches).toHaveBeenCalledTimes(2));
    request.resolve([match]);
    await waitFor(() =>
      expect(screen.queryByRole("option", { name: /Salsa House/ })).not.toBeInTheDocument()
    );
    expect(screen.getByRole("button", { name: /Create organizer/ })).toBeEnabled();
  });

  it("requires explicit acknowledgment before creating with possible matches", async () => {
    const user = userEvent.setup();
    const { onSelect } = renderSelect();
    mocks.searchEntityMatches.mockResolvedValue([match]);
    await user.type(screen.getByRole("combobox", { name: "Organizer" }), "Salsa House Boston");
    await screen.findByRole("option", { name: /Salsa House/ });
    await user.click(screen.getByRole("button", { name: /Create organizer/ }));
    expect(await screen.findByRole("checkbox", { name: /not a duplicate/i })).toBeInTheDocument();
    expect(mocks.saveAdminEntity).not.toHaveBeenCalled();
    await user.click(screen.getByRole("checkbox", { name: /not a duplicate/i }));
    await user.click(screen.getByRole("button", { name: /Save new organizer/ }));
    await waitFor(() =>
      expect(mocks.saveAdminEntity).toHaveBeenCalledWith(
        "organizer",
        null,
        expect.objectContaining({ name: "Salsa House Boston", city: "Boston", status: "active" })
      )
    );
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: "created", name: "New Org" })
    );
  });

  it("fails closed when duplicate lookup fails", async () => {
    const user = userEvent.setup();
    renderSelect();
    mocks.searchEntityMatches.mockRejectedValue(new Error("offline"));
    await user.type(screen.getByRole("combobox", { name: "Organizer" }), "New Org");
    expect(await screen.findByRole("alert")).toHaveTextContent(/couldn't search/i);
    expect(screen.queryByRole("button", { name: /Create organizer/ })).not.toBeInTheDocument();
    expect(mocks.saveAdminEntity).not.toHaveBeenCalled();
  });

  it("stops dialog form submission from reaching the parent event form", async () => {
    const user = userEvent.setup();
    const submit = vi.fn((event: SubmitEvent<HTMLFormElement>) => event.preventDefault());
    render(
      <form onSubmit={submit}>
        <div className="admin-shell">
          <ComposerEntitySelect kind="organizer" value={null} onSelect={vi.fn()} city="Boston" />
        </div>
      </form>
    );
    mocks.searchEntityMatches.mockResolvedValue([]);
    await user.type(screen.getByRole("combobox", { name: "Organizer" }), "New Org");
    await user.click(await screen.findByRole("button", { name: /Create organizer/ }));
    expect(await screen.findByLabelText("Name")).toHaveValue("New Org");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Save new organizer/ })).toBeEnabled()
    );
    await user.click(screen.getByRole("button", { name: /Save new organizer/ }));
    await waitFor(() => expect(mocks.saveAdminEntity).toHaveBeenCalled());
    expect(submit).not.toHaveBeenCalled();
  });
});

it("ignores a stale series detail response after a newer selection completed", async () => {
  const user = userEvent.setup();
  const first = Promise.withResolvers<unknown>();
  const second = Promise.withResolvers<unknown>();
  mocks.fetchAdminEntityDirectory.mockResolvedValue([
    { id: "series-a", name: "Series A" },
    { id: "series-b", name: "Series B" },
  ]);
  mocks.fetchAdminEntityDetail.mockImplementation((_kind, id) =>
    id === "series-a" ? first.promise : second.promise
  );
  const { onSelect } = renderSelect("series");
  await user.type(screen.getByRole("combobox", { name: "Series" }), "Series");
  await user.click(await screen.findByRole("option", { name: "Series A" }));
  await user.click(screen.getByRole("option", { name: "Series B" }));
  second.resolve({ id: "series-b", name: "Series B" });
  await waitFor(() => expect(onSelect).toHaveBeenCalledOnce());
  first.resolve({ id: "series-a", name: "Series A" });
  await waitFor(() => expect(screen.queryByRole("option")).not.toBeInTheDocument());
  expect(onSelect.mock.calls.map(([entity]) => entity.id)).toEqual(["series-b"]);
});

it("cancels a pending duplicate-series choice when the creation name changes", async () => {
  const user = userEvent.setup();
  const pending = Promise.withResolvers<unknown>();
  mocks.fetchAdminEntityDirectory.mockResolvedValue([{ id: "existing-series", name: "Weekly Salsa" }]);
  mocks.fetchAdminEntityDetail.mockReturnValue(pending.promise);
  const { onSelect } = renderSelect("series");
  await user.type(screen.getByRole("combobox", { name: "Series" }), "Weekly Salsa New");
  await user.click(await screen.findByRole("button", { name: /Create series/ }));
  await user.click(await screen.findByRole("button", { name: "Weekly Salsa" }));
  await user.clear(screen.getByLabelText("Name"));
  await user.type(screen.getByLabelText("Name"), "Different series");
  await act(async () => pending.resolve({ id: "existing-series", name: "Weekly Salsa" }));
  expect(onSelect).not.toHaveBeenCalled();
  expect(screen.getByRole("dialog", { name: "Create series" })).toBeInTheDocument();
  expect(screen.getByLabelText("Name")).toHaveValue("Different series");
});
