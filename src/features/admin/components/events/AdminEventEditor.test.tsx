import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminEventEditor from "./AdminEventEditor";
import { buildEmptyAdminForm } from "../../model/adminEventForm";

vi.mock("../../hooks/useAdminTaxonomy", () => ({ useActiveTaxonomyTerms: () => ({ terms: [] }) }));
vi.mock("../../../metros/hooks/useMetros", () => import("../../../../test/mockMetros"));

beforeEach(() => localStorage.clear());

function renderEditor(onCancel = vi.fn()) {
  render(
    <MemoryRouter>
      <AdminEventEditor
        initial={buildEmptyAdminForm("boston")}
        initialTaxonomyTerms={[]}
        heading="New event"
        isSaving={false}
        error={null}
        onSubmit={vi.fn().mockResolvedValue(undefined)}
        onCancel={onCancel}
      />
    </MemoryRouter>
  );
  return onCancel;
}

describe("AdminEventEditor", () => {
  it("shows the primary flyer and all additional flyers while editing an event", () => {
    render(
      <MemoryRouter>
        <AdminEventEditor
          initial={{
            ...buildEmptyAdminForm("boston"),
            title: "Salsa Tuesday",
            image_url: "https://example.com/flyer.png",
            image_urls: ["https://example.com/flyer.png", "https://example.com/second.png"],
          }}
          initialTaxonomyTerms={[]}
          heading="Edit event"
          isSaving={false}
          error={null}
          eventId="event-1"
          onSubmit={vi.fn().mockResolvedValue(undefined)}
          onCancel={vi.fn()}
        />
      </MemoryRouter>
    );
    expect(screen.getByRole("img", { name: "Flyer 1" })).toHaveAttribute(
      "src",
      "https://example.com/flyer.png"
    );
    expect(screen.getByRole("img", { name: "Flyer 2" })).toHaveAttribute(
      "src",
      "https://example.com/second.png"
    );
    expect(screen.getByText("Primary")).toBeInTheDocument();
  });

  it("does not ask administrators to re-enter submitter identity", () => {
    renderEditor();
    expect(screen.queryByLabelText(/Your name/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^Email/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Your info/i })).not.toBeInTheDocument();
  });

  it("leaves immediately when there are no unsaved edits", async () => {
    const onCancel = renderEditor();
    await userEvent.click(screen.getByRole("button", { name: "Events" }));
    expect(onCancel).toHaveBeenCalledOnce();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("requires a decision before discarding edits and preserves them on Keep editing", async () => {
    const user = userEvent.setup();
    const onCancel = renderEditor();
    await user.type(screen.getByLabelText("Event Title *"), "Draft title");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    const dialog = screen.getByRole("dialog", { name: "Discard changes?" });
    expect(onCancel).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole("button", { name: "Keep editing" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Event Title *")).toHaveValue("Draft title");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(screen.getByRole("button", { name: "Discard changes" }));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
