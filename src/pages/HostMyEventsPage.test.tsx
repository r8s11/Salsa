import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import HostMyEventsPage from "./HostMyEventsPage";
import { BrowserRouter } from "react-router-dom";

const { useAuth } = vi.hoisted(() => ({ useAuth: vi.fn() }));
const { useMySubmissions } = vi.hoisted(() => ({ useMySubmissions: vi.fn() }));

vi.mock("../contexts/AuthContext", () => ({ useAuth }));
vi.mock("../hooks/useMySubmissions", () => ({ useMySubmissions }));

const ownerPending = { title: "Pending Event", id: "pending-1", status: "pending", isEditable: true, date: "2026-08-30", venue: "Venue A", city: "boston" };
const ownerApproved = { title: "Approved Event", id: "approved-1", status: "approved", isEditable: false, date: "2026-09-01", venue: "Venue B", city: "boston" };
const ownerEventState = [ownerPending, ownerApproved];

function renderHostEvents() {
  vi.mocked(useAuth).mockReturnValue({ user: { id: "user-1" } });
  vi.mocked(useMySubmissions).mockReturnValue({ submissions: ownerEventState });
  
  render(
    <BrowserRouter>
      <HostMyEventsPage />
    </BrowserRouter>
  );
}

describe("HostMyEventsPage", () => {
  it("switches between Cards and Table without changing the owner event set", async () => {
    renderHostEvents();
    expect(await screen.findByText("Host · My Events")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Table" })).toBeInTheDocument();
  
    await userEvent.click(screen.getByRole("button", { name: "Table" }));
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(within(screen.getByRole("table")).getByText(ownerPending.title)).toBeInTheDocument();
  });
  
  it("uses a labelled mobile card for every event field", async () => {
    renderHostEvents();
    // Assuming table columns headers: Title, Date, Venue, Status, Action.
    expect((await screen.findAllByText(/Status:/)).length).toBe(ownerEventState.length);
    expect(screen.getAllByText(/Venue:/).length).toBe(ownerEventState.length);
  });
  
  it("links editable and published events to their existing destinations", async () => {
    renderHostEvents();
    expect(await screen.findByRole("link", { name: "Edit event" })).toHaveAttribute("href", "/profile/edit/pending-1");
    expect(screen.getByRole("link", { name: "View event" })).toHaveAttribute("href", "/calendar?event=approved-1&city=boston");
  });
});
