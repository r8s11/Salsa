import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import AdminEditedFieldDisclosure from "./AdminEditedFieldDisclosure";

describe("AdminEditedFieldDisclosure", () => {
  it("renders value and toggle button", () => {
    render(
      <AdminEditedFieldDisclosure label="Venue" value="Havana Club" originalValue="Havanna Club" />
    );
    expect(screen.getByText("Venue")).toBeDefined();
    expect(screen.getByText("Havana Club")).toBeDefined();
    expect(screen.getByRole("button")).toBeDefined();
  });

  it("toggles original value visibility", () => {
    render(
      <AdminEditedFieldDisclosure label="Venue" value="Havana Club" originalValue="Havanna Club" />
    );
    const button = screen.getByRole("button");
    fireEvent.click(button);
    expect(screen.getByText("Original value:")).toBeDefined();
    expect(screen.getByText("Havanna Club")).toBeDefined();
  });
});
