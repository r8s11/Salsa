import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import EventForm, { CAPABILITIES } from "./EventForm";
import type { EventFormDraft } from "./EventForm";

const draft: EventFormDraft = {
  title: "",
  description: "",
  event_type: "",
  city: "boston",
  event_date: "",
  event_time: "",
  recurrence: "",
  location: "",
  address: "",
  venue_id: "",
  price_type: "",
  price_amount: "",
  rsvp_link: "",
  image_url: "",
  host: "",
  contact_email: "",
  contact_instagram: "",
  contact_website: "",
  submitter_name: "",
  submitter_email: "",
  dance_styles: [],
  taxonomy_term_ids: [],
};

function sectionNames() {
  return screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);
}

describe("EventForm", () => {
  it("renders submit sections in authoring order without admin fields", () => {
    render(<EventForm draft={draft} onChange={vi.fn()} capabilities={CAPABILITIES.submit} />);
    expect(sectionNames()).toEqual([
      "Basics",
      "Styles & tags",
      "When",
      "Where",
      "Pricing & RSVP",
      "Your info",
    ]);
    expect(screen.queryByRole("heading", { name: "Artwork" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Host & contact" })).not.toBeInTheDocument();
  });

  it("renders organizer artwork without submitter or admin fields", () => {
    render(
      <EventForm
        draft={draft}
        onChange={vi.fn()}
        capabilities={CAPABILITIES.organizerEdit}
        renderFlyerField={() => <p>Upload flyer</p>}
      />
    );
    expect(sectionNames()).toEqual([
      "Basics",
      "Styles & tags",
      "When",
      "Where",
      "Pricing & RSVP",
      "Artwork",
    ]);
    expect(screen.getByText("Upload flyer")).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Your info" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Host & contact" })).not.toBeInTheDocument();
  });

  it("omits artwork for moderation submission edits without a canonical event id", () => {
    render(
      <EventForm
        draft={draft}
        onChange={vi.fn()}
        capabilities={CAPABILITIES.organizerSubmissionEdit}
      />
    );

    expect(screen.queryByRole("heading", { name: "Artwork" })).not.toBeInTheDocument();
  });

  it("uses segmented controls to update event type, city, and price", () => {
    const onChange = vi.fn();
    render(<EventForm draft={draft} onChange={onChange} capabilities={CAPABILITIES.submit} />);

    fireEvent.click(screen.getByRole("button", { name: "Class" }));
    fireEvent.click(screen.getByRole("button", { name: "New York City" }));
    fireEvent.click(screen.getByRole("button", { name: "Paid" }));

    expect(onChange).toHaveBeenNthCalledWith(1, { ...draft, event_type: "class" });
    expect(onChange).toHaveBeenNthCalledWith(2, { ...draft, city: "new-york-city" });
    expect(onChange).toHaveBeenNthCalledWith(3, { ...draft, price_type: "paid" });
  });

  it("renders taxonomy, venue, flyer, and host extensions for admins", () => {
    render(
      <EventForm
        draft={draft}
        onChange={vi.fn()}
        capabilities={CAPABILITIES.admin}
        renderVenueField={() => <p>Venue search</p>}
        renderFlyerField={() => <p>Flyer upload</p>}
        taxonomyTerms={{
          danceStyles: [
            {
              id: "salsa",
              category: "dance_style",
              name: "Salsa",
              slug: "salsa",
              status: "active",
            },
          ],
          attributes: [
            {
              id: "outdoor",
              category: "event_attribute",
              name: "Outdoor",
              slug: "outdoor",
              status: "active",
            },
          ],
          archived: [],
        }}
      />
    );
    expect(sectionNames()).toEqual([
      "Basics",
      "Styles & tags",
      "When",
      "Where",
      "Pricing & RSVP",
      "Artwork",
      "Host & contact",
    ]);
    expect(screen.getByText("Venue search")).toBeVisible();
    expect(screen.getByText("Flyer upload")).toBeVisible();
    expect(screen.getByRole("checkbox", { name: "Salsa" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Outdoor" })).toBeInTheDocument();
  });
});
