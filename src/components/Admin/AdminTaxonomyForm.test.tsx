import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import AdminTaxonomyForm from "./AdminTaxonomyForm";
import { EMPTY_TAXONOMY_FORM } from "../../features/admin/model/taxonomy";

describe("AdminTaxonomyForm", () => {
  it("blocks an empty name and reports the validation error", async () => {
    const onSubmit = vi.fn();
    render(<AdminTaxonomyForm initial={EMPTY_TAXONOMY_FORM} submitLabel="Save term" onSubmit={onSubmit} onCancel={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Save term" }));
    expect(screen.getByText("Enter a name")).toBeVisible();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("preserves a saved slug while editing the display name", async () => {
    render(<AdminTaxonomyForm initial={{ ...EMPTY_TAXONOMY_FORM, name: "Salsa", slug: "salsa" }} submitLabel="Save term" onSubmit={vi.fn()} onCancel={vi.fn()} />);
    await userEvent.clear(screen.getByLabelText("Name *"));
    await userEvent.type(screen.getByLabelText("Name *"), "Salsa On2");
    expect(screen.getByLabelText("Slug *")).toHaveValue("salsa");
  });
});
