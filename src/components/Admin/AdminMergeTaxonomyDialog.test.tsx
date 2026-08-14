import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import AdminMergeTaxonomyDialog from "./AdminMergeTaxonomyDialog";

const source = { id: "source", category: "dance_style" as const, name: "Salsa Dancing", slug: "salsa-dancing", description: null, parent_id: null, status: "active" as const, display_order: 1, usage_count: 12, updated_at: "2026-08-14T00:00:00Z" };
const keep = { ...source, id: "keep", name: "Salsa", slug: "salsa", usage_count: 42 };
const wrongCategory = { ...keep, id: "outdoor", name: "Outdoor", category: "event_attribute" as const };

describe("AdminMergeTaxonomyDialog", () => {
  it("states the impact and merges into the selected same-category term", async () => {
    const onMerge = vi.fn();
    render(<AdminMergeTaxonomyDialog source={source} candidates={[keep]} onClose={vi.fn()} onMerge={onMerge} />);
    expect(screen.getByText("12 event relationships will move to Salsa.")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Merge terms" }));
    expect(onMerge).toHaveBeenCalledWith({ keepId: "keep", mergeId: "source" });
  });

  it("defaults to a same-category target and restores opener focus on Escape", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { rerender } = render(<button type="button">Open merge</button>);
    screen.getByRole("button", { name: "Open merge" }).focus();
    rerender(<><button type="button">Open merge</button><AdminMergeTaxonomyDialog source={source} candidates={[wrongCategory, keep]} onClose={onClose} onMerge={vi.fn()} /></>);
    expect(screen.getByRole("combobox")).toHaveValue("keep");
    await user.keyboard("{Escape}");
    expect(screen.getByRole("button", { name: "Open merge" })).toHaveFocus();
  });
});
