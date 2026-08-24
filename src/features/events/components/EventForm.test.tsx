import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import EventForm from "./EventForm";
import type { EventFormDraft } from "../model/eventFormAdapters";

const draft: EventFormDraft = {
  title: "", description: "", event_type: "", city: "boston", event_date: "", event_time: "", recurrence: "", location: "", address: "", venue_id: "", price_type: "", price_amount: "", rsvp_link: "", image_url: "", host: "", contact_email: "", contact_instagram: "", contact_website: "", submitter_name: "", submitter_email: "", dance_styles: [], taxonomy_term_ids: [],
};

describe("EventForm", () => {
  it("shows only submitter-authorized sections for a submission", () => {
    render(<EventForm draft={draft} onChange={vi.fn()} capabilities={{ styles: "slug-chips", attributes: false, venue: "free-text", flyer: false, hostAndContact: false, submitterInfo: true }} />);
    expect(screen.getByRole("heading", { name: "Basics" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Your info" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Artwork" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Host & contact" })).not.toBeInTheDocument();
  });
});
