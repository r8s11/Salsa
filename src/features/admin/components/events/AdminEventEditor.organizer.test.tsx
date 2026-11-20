import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminEventEditor from "./AdminEventEditor";
import { buildEmptyAdminForm } from "../../model/adminEventForm";
import { emptyEntityReview } from "../../../entity-matching/entityReview";
import { chooseExisting, newReviewItem } from "../../../entity-matching/entityReviewState";
import type { ComposerEntity } from "./ComposerEntitySelect";

const { setEventOrganizer } = vi.hoisted(() => ({ setEventOrganizer: vi.fn() }));
vi.mock("../../api/organizerAssignmentRepo", () => ({ setEventOrganizer }));
vi.mock("../../hooks/useAdminTaxonomy", () => ({ useActiveTaxonomyTerms: () => ({ terms: [] }) }));
vi.mock("../../../metros/hooks/useMetros", () => import("../../../../test/mockMetros"));
vi.mock("./EventOrganizerPanel", () => ({
  default: ({ organizer }: { organizer: { name: string } | null }) => (
    <p data-testid="panel">{organizer ? `Team of ${organizer.name}` : "no organizer"}</p>
  ),
}));
// Stand-in for the picker: one button per candidate organizer, plus a clear button.
vi.mock("./ComposerEntitySelect", () => ({
  default: ({
    kind,
    value,
    onSelect,
  }: {
    kind: string;
    value: ComposerEntity | null;
    onSelect: (entity: ComposerEntity | null) => void;
  }) =>
    kind === "organizer" ? (
      <div>
        <p>Selected: {value?.name ?? "none"}</p>
        <button type="button" onClick={() => onSelect({ id: "o-new", name: "New Org" })}>
          pick new
        </button>
        <button type="button" onClick={() => onSelect(null)}>
          clear
        </button>
      </div>
    ) : null,
}));

const old: ComposerEntity = { id: "o-old", name: "Old Org" };

function renderEditor(withOrganizer: boolean, eventId?: string) {
  const initial = buildEmptyAdminForm("boston");
  if (withOrganizer) {
    initial.entity_review = {
      ...emptyEntityReview(),
      organizer: chooseExisting(newReviewItem(old.name), old, { moderator: true }),
    };
  }
  render(
    <MemoryRouter>
      <AdminEventEditor
        initial={initial}
        initialTaxonomyTerms={[]}
        heading="Edit"
        isSaving={false}
        error={null}
        eventId={eventId}
        onSubmit={vi.fn().mockResolvedValue(undefined)}
        onCancel={vi.fn()}
      />
    </MemoryRouter>
  );
}

beforeEach(() => {
  localStorage.clear();
  setEventOrganizer.mockReset().mockResolvedValue({ changed: true, previous_organizer_id: null });
});

describe("AdminEventEditor organizer assignment", () => {
  it("links an organizer to a saved event through the audited RPC without confirmation", async () => {
    renderEditor(false, "event-1");
    expect(screen.getByTestId("panel")).toHaveTextContent("no organizer");
    await userEvent.click(screen.getByRole("button", { name: "pick new" }));
    await waitFor(() => expect(setEventOrganizer).toHaveBeenCalledWith("event-1", "o-new", false));
    expect(await screen.findByText("Selected: New Org")).toBeInTheDocument();
    expect(screen.getByTestId("panel")).toHaveTextContent("Team of New Org");
  });

  it("asks for confirmation before changing an existing organizer", async () => {
    renderEditor(true, "event-1");
    await userEvent.click(screen.getByRole("button", { name: "pick new" }));
    expect(setEventOrganizer).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toHaveTextContent("Change organizer to New Org?");
    expect(screen.getByRole("dialog")).toHaveTextContent("Old Org");
    await userEvent.click(screen.getByRole("button", { name: "Change organizer" }));
    await waitFor(() => expect(setEventOrganizer).toHaveBeenCalledWith("event-1", "o-new", true));
    expect(await screen.findByText("Selected: New Org")).toBeInTheDocument();
  });

  it("keeps the current organizer when the change is cancelled", async () => {
    renderEditor(true, "event-1");
    await userEvent.click(screen.getByRole("button", { name: "pick new" }));
    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel" })
    );
    expect(setEventOrganizer).not.toHaveBeenCalled();
    expect(screen.getByText("Selected: Old Org")).toBeInTheDocument();
  });

  it("surfaces a rejected change and keeps the organizer unchanged", async () => {
    setEventOrganizer.mockRejectedValue(
      new Error("Organizer is archived and cannot receive events.")
    );
    renderEditor(false, "event-1");
    await userEvent.click(screen.getByRole("button", { name: "pick new" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("archived");
    expect(screen.getByText("Selected: none")).toBeInTheDocument();
  });

  it("only edits the form for an event that is not saved yet", async () => {
    renderEditor(false);
    await userEvent.click(screen.getByRole("button", { name: "pick new" }));
    expect(setEventOrganizer).not.toHaveBeenCalled();
    expect(await screen.findByText("Selected: New Org")).toBeInTheDocument();
  });
});
