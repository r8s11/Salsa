import type { ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import * as api from "../api";
import type { ArtistEvent, RsvpRoster, RsvpRow } from "../model";
import ArtistRsvpRosterPage from "./ArtistRsvpRosterPage";
const auth = vi.hoisted(() => ({ user: { id: "owner" } as { id: string } | null }));
vi.mock("../../../contexts/useAuth", () => ({ useAuth: () => auth }));
vi.mock("../../workspaces/components/WorkspaceFrame", () => ({ default: ({ children }: { children: () => ReactNode }) => children() }));
vi.mock("../api", async (original) => ({ ...await original<typeof api>(), listArtistRsvps: vi.fn(), updateArtistRsvp: vi.fn(), updateArtistEvent: vi.fn(), removeArtistRsvp: vi.fn() }));
function guest(id: string, role: RsvpRow["role"], placement: RsvpRow["placement"], confirmed = false): RsvpRow { return { id, event_id: "event", name: `Guest ${id}`, email: `${id}@fixture.test`, role, placement, confirmed, contacted: false, version: 1, contact_version: 1, acceptance_version: confirmed ? 1 : 0, created_at: "2099-01-01", updated_at: "2099-01-01", delivery: { kind: confirmed ? "acceptance" : "main_receipt", status: "failed", failure: "transient" } }; }
let roster: RsvpRoster;
function Page({ client }: { client: QueryClient }) { return <QueryClientProvider client={client}><MemoryRouter initialEntries={["/host/instructors/artist/events/event/rsvps"]}><Routes><Route path="/host/instructors/:id/events/:eventId/rsvps" element={<ArtistRsvpRosterPage />} /></Routes></MemoryRouter></QueryClientProvider>; }
function show() { const client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); return { ...render(<Page client={client} />), client }; }
beforeEach(() => {
  vi.clearAllMocks(); auth.user = { id: "owner" };
  roster = { event: { id: "event", artist_id: "artist", title: "Workshop", status: "approved", rsvp_enabled: true, rsvp_closed: false, rsvp_limit: 30 } as ArtistEvent, rows: [guest("leader", "leader", "main_list"), guest("follower", "follower", "main_list", true), guest("waiting", "undecided", "waitlist")], totals: { main_list: 2, waitlist: 1, confirmed: 1, roles: { leader: 1, follower: 1, undecided: 1 }, confirmed_roles: { leader: 0, follower: 1, undecided: 0 } } };
  vi.mocked(api.listArtistRsvps).mockImplementation(async () => structuredClone(roster));
  vi.mocked(api.updateArtistEvent).mockImplementation(async (_id, value) => { roster.event = { ...roster.event, ...value }; });
  vi.mocked(api.updateArtistRsvp).mockImplementation(async (id, _version, changes) => { const row = roster.rows.find((item) => item.id === id)!; Object.assign(row, changes, { version: row.version + 1 }); return structuredClone(row); });
});
it("U7 closed roster preserves independent marks, contacts and separate role totals", async () => {
  show(); const user = userEvent.setup(); await screen.findByRole("heading", { name: "Workshop — RSVPs" });
  await user.click(screen.getByRole("button", { name: "Close new signups" })); await screen.findByRole("button", { name: "Reopen new signups" });
  const form = screen.getByRole("form", { name: "Signup for Guest leader" });
  await user.clear(within(form).getByLabelText("Name")); await user.type(within(form).getByLabelText("Name"), "Corrected guest");
  await user.selectOptions(within(form).getByLabelText("Dance role"), "undecided"); await user.click(within(form).getByLabelText("Contacted"));
  await user.click(within(form).getByRole("button", { name: "Save signup" }));
  await waitFor(() => expect(api.updateArtistRsvp).toHaveBeenCalledWith("leader", 1, { name: "Corrected guest", email: "leader@fixture.test", role: "undecided", contacted: true, confirmed: false }));
  expect(within(form).getByLabelText("Contacted")).toBeChecked(); expect(within(form).getByLabelText("Confirmed")).not.toBeChecked(); expect(within(form).getByText(/Email: failed/)).toBeInTheDocument();
  expect(within(screen.getByRole("region", { name: "Main list" })).getByText("Artist-confirmed: Leader 0 · Follower 1 · Undecided 0")).toBeInTheDocument();
  expect(within(screen.getByRole("region", { name: "Waitlist" })).getByText("Signups: Leader 0 · Follower 0 · Undecided 1")).toBeInTheDocument();
  expect(screen.getByText("2 main-list signups / 30")).toBeInTheDocument(); expect(screen.getByText("1 waiting · 1 artist-confirmed")).toBeInTheDocument();
  expect(api.updateArtistEvent).toHaveBeenCalledWith("event", { rsvp_closed: true });
});
it("F11 session isolation removes cached contacts before denied account reads", async () => {
  const view = show(); await screen.findByDisplayValue("leader@fixture.test");
  const denied = Promise.withResolvers<RsvpRoster>(); vi.mocked(api.listArtistRsvps).mockReturnValue(denied.promise);
  auth.user = { id: "outsider" }; view.rerender(<Page client={view.client} />);
  expect(screen.queryByDisplayValue("leader@fixture.test")).not.toBeInTheDocument();
  denied.reject(new api.ArtistRsvpError("42501", "Artist access denied."));
  expect(await screen.findByRole("alert")).toHaveTextContent("Artist access denied"); expect(screen.queryByDisplayValue("follower@fixture.test")).not.toBeInTheDocument();
  expect(view.client.getQueriesData({ queryKey: ["artist-private", "owner"] })).toEqual([]);
});
it("stale contact edit stays local until explicit refresh and review", async () => {
  show(); const user = userEvent.setup(); const input = await screen.findByDisplayValue("leader@fixture.test"); await user.clear(input); await user.type(input, "new@fixture.test");
  vi.mocked(api.updateArtistRsvp).mockRejectedValueOnce(new api.ArtistRsvpError("40001", "Another manager changed this signup. Refresh and review."));
  const form = input.closest("form")!; await user.click(within(form).getByRole("button", { name: "Save signup" }));
  expect(await within(form).findByRole("alert")).toHaveTextContent("Refresh and review"); expect(input).toHaveValue("new@fixture.test"); expect(within(form).getByRole("button", { name: "Save signup" })).toBeDisabled();
  roster.rows[0].email = "latest@fixture.test"; roster.rows[0].version = 2;
  await user.click(within(form).getByRole("button", { name: "Refresh and review signup" })); await waitFor(() => expect(input).toHaveValue("latest@fixture.test"));
});
