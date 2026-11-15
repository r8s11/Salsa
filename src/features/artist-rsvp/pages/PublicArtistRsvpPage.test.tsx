import { beforeEach, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import PublicArtistRsvpPage from "./PublicArtistRsvpPage";
import { ArtistRsvpError, getPublicArtistRsvp, submitGuestRsvp } from "../api";
import type { DatabaseEvent } from "../../events/model/types";
import type { GuestRsvpReceipt, RsvpSummary } from "../model";
import type * as ArtistApi from "../api";
vi.mock("../api", async (original) => ({ ...await original<typeof ArtistApi>(), getPublicArtistRsvp: vi.fn(), submitGuestRsvp: vi.fn() }));
const event: DatabaseEvent = { id: "event", title: "Musicality", artist_id: "artist", event_type: "workshop", event_date: "2099-12-05T19:00:00Z", city: "new-york-city", price_type: "paid", rsvp_enabled: true, taxonomy_terms: [], rsvp_link: null, taxonomy_term_ids: [], description: null, event_time: null, location: null, address: null, price_amount: null, image_url: null, source_type: "artist", status: "approved", updated_at: "2099-01-01", created_at: "2099-01-01", host: null, recurrence: null, gallery: null, venue_id: null, sublocation: null };
const summary: RsvpSummary = { event_id: "event", artist_id: "artist", artist_name: "Ari Rivera", artist_slug: "ari", rsvp_enabled: true, rsvp_closed: false, rsvp_limit: 30, main_list_count: 28, available: true, waitlist: false };
function show() { const client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={["/events/event/rsvp"]}><Routes><Route path="/events/:id/rsvp" element={<PublicArtistRsvpPage />} /></Routes></MemoryRouter></QueryClientProvider>); }
async function fill() { const user = userEvent.setup(); await user.type(await screen.findByLabelText("Name *"), "Jordan Lee"); await user.type(screen.getByLabelText("Email *"), "jordan@example.test"); return user; }
beforeEach(() => { vi.clearAllMocks(); vi.mocked(getPublicArtistRsvp).mockResolvedValue({ event, summary }); });
it.each(["free", "paid"] as const)("U6 guest capture first %s saves before handoff for new and duplicate responses", async (price) => {
  vi.mocked(getPublicArtistRsvp).mockResolvedValue({ event: { ...event, price_type: price }, summary });
  const gate = Promise.withResolvers<GuestRsvpReceipt>(); vi.mocked(submitGuestRsvp).mockReturnValue(gate.promise);
  show(); const user = await fill();
  expect(screen.getByLabelText("Undecided")).toBeChecked();
  expect(screen.queryByText(/sign in/i)).not.toBeInTheDocument(); expect(screen.queryByLabelText(/phone/i)).not.toBeInTheDocument();
  expect(screen.getByText(/active owners and managers/)).toHaveTextContent("Ari Rivera");
  expect(screen.queryByRole("link", { name: /Continue to artist/ })).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Save my RSVP" }));
  expect(submitGuestRsvp).toHaveBeenCalledWith({ event_id: "event", name: "Jordan Lee", email: "jordan@example.test", role: "undecided" });
  expect(screen.queryByRole("link", { name: /Continue to artist/ })).not.toBeInTheDocument();
  const response: GuestRsvpReceipt = { status: "received", event_id: "event", external_url: price === "paid" ? "https://artist.example/pay" : null };
  await act(async () => gate.resolve(response));
  expect(await screen.findByRole("heading", { name: price === "paid" ? "RSVP saved. Complete payment on the artist’s site." : "RSVP saved." })).toHaveFocus();
  expect(screen.getByText(/Check your email for main-list or waitlist/)).toBeInTheDocument();
  expect(screen.getByText("No place is confirmed by this link.")).toBeInTheDocument();
  if (price === "paid") expect(screen.getByRole("link", { name: "Continue to artist payment" })).toHaveAttribute("href", response.external_url);
  expect(response).not.toHaveProperty("placement");
});
it("F5 pending and unavailable preserves input, blocks repeats and handles rate/closed failures", async () => {
  const gate = Promise.withResolvers<GuestRsvpReceipt>(); vi.mocked(submitGuestRsvp).mockReturnValueOnce(gate.promise);
  const view = show(); const user = await fill(); const submit = screen.getByRole("button", { name: "Save my RSVP" });
  await user.click(submit); fireEvent.submit(submit.closest("form")!); expect(submitGuestRsvp).toHaveBeenCalledTimes(1); expect(submit).toBeDisabled();
  await act(async () => gate.reject(new Error("network")));
  expect(await screen.findByRole("alert")).toHaveTextContent("Your details are still here"); expect(screen.getByLabelText("Name *")).toHaveValue("Jordan Lee"); expect(screen.getByLabelText("Email *")).toHaveValue("jordan@example.test");
  vi.mocked(submitGuestRsvp).mockRejectedValueOnce(new ArtistRsvpError("rate_limited", "Wait before retrying.", 10)); await user.click(screen.getByRole("button", { name: "Save my RSVP" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Retry after 10 seconds"); expect(screen.queryByRole("link", { name: /Continue to artist/ })).not.toBeInTheDocument();
  view.unmount(); vi.mocked(getPublicArtistRsvp).mockResolvedValue({ event, summary: { ...summary, available: false, rsvp_closed: true } }); show();
  await screen.findByRole("heading", { name: "New signups unavailable" }); expect(screen.queryByRole("button", { name: "Save my RSVP" })).not.toBeInTheDocument();
});
it("invalid input focuses the first invalid field without sending", async () => {
  show(); await screen.findByLabelText("Name *"); await userEvent.click(screen.getByRole("button", { name: "Save my RSVP" }));
  expect(screen.getByLabelText("Name *")).toHaveFocus(); expect(submitGuestRsvp).not.toHaveBeenCalled();
  await userEvent.type(screen.getByLabelText("Name *"), "Jordan"); await userEvent.click(screen.getByRole("button", { name: "Save my RSVP" })); await waitFor(() => expect(screen.getByLabelText("Email *")).toHaveFocus());
});
