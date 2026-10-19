import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import EventForm, { CAPABILITIES } from "./EventForm";
import type { EventFormDraft } from "./EventForm";

vi.mock("../../metros/hooks/useMetros", () => ({
  useMetros: () => ({
    metros: [
      { slug: "boston", name: "Boston" },
      { slug: "new-york-city", name: "New York City" },
    ],
    loading: false,
    error: null,
  }),
}));

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
      "Host & contact",
    ]);
    expect(screen.getByText("Upload flyer")).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Your info" })).not.toBeInTheDocument();
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

  it("updates event type, city, and price", () => {
    const onChange = vi.fn();
    render(<EventForm draft={draft} onChange={onChange} capabilities={CAPABILITIES.submit} />);

    fireEvent.click(screen.getByRole("button", { name: "Class" }));
    fireEvent.change(screen.getByLabelText("City *"), { target: { value: "new-york-city" } });
    fireEvent.click(screen.getByRole("button", { name: "Paid" }));

    expect(onChange).toHaveBeenNthCalledWith(1, { ...draft, event_type: "class" });
    expect(onChange).toHaveBeenNthCalledWith(2, { ...draft, city: "new-york-city" });
    expect(onChange).toHaveBeenNthCalledWith(3, { ...draft, price_type: "paid" });
  });
  it("updates event type to Live Music", () => {
    const onChange = vi.fn();
    render(<EventForm draft={draft} onChange={onChange} capabilities={CAPABILITIES.submit} />);

    fireEvent.click(screen.getByRole("button", { name: "Live Music" }));

    expect(onChange).toHaveBeenCalledWith({ ...draft, event_type: "live_music" });
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

  it("renders admin artwork first when flyerFirst is enabled", () => {
    render(
      <EventForm
        draft={draft}
        onChange={vi.fn()}
        capabilities={CAPABILITIES.admin}
        flyerFirst
        renderFlyerField={() => <p>Flyer upload</p>}
      />
    );
    expect(sectionNames()).toEqual([
      "Artwork",
      "Basics",
      "Styles & tags",
      "When",
      "Where",
      "Pricing & RSVP",
      "Host & contact",
    ]);
  });
});

describe("EventForm time zone control", () => {
  it("is not shown on public or organizer surfaces", () => {
    render(<EventForm draft={draft} onChange={vi.fn()} capabilities={CAPABILITIES.submit} />);
    expect(screen.queryByLabelText("Time zone")).not.toBeInTheDocument();
  });

  it("shows the resolved zone and where it came from on the admin surface", () => {
    render(<EventForm draft={draft} onChange={vi.fn()} capabilities={CAPABILITIES.admin} />);
    expect(screen.getByLabelText("Time zone")).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Automatic (America/New_York, from metro)" })
    ).toBeInTheDocument();
  });

  it("reflects a venue zone that overrides the city", () => {
    render(
      <EventForm
        draft={{ ...draft, venue_time_zone: "America/Chicago" }}
        onChange={vi.fn()}
        capabilities={CAPABILITIES.admin}
      />
    );
    expect(
      screen.getByRole("option", { name: "Automatic (America/Chicago, from venue)" })
    ).toBeInTheDocument();
  });

  it("asks for a manual choice and explains why when nothing resolves", () => {
    render(
      <EventForm draft={{ ...draft, city: "atlantis" }} onChange={vi.fn()} capabilities={CAPABILITIES.admin} />
    );
    expect(screen.getByRole("option", { name: "Choose a time zone" })).toBeInTheDocument();
    expect(screen.getByText(/no time zone/i)).toBeInTheDocument();
  });

  it("reports an invalid zone by name instead of falling back", () => {
    render(
      <EventForm
        draft={{ ...draft, time_zone: "Mars/Olympus" }}
        onChange={vi.fn()}
        capabilities={CAPABILITIES.admin}
      />
    );
    expect(screen.getByText(/Mars\/Olympus/)).toBeInTheDocument();
  });

  it("writes an explicit choice onto the draft, and clears it back to automatic", () => {
    const onChange = vi.fn();
    render(<EventForm draft={draft} onChange={onChange} capabilities={CAPABILITIES.admin} />);
    fireEvent.change(screen.getByLabelText("Time zone"), { target: { value: "America/Los_Angeles" } });
    expect(onChange).toHaveBeenLastCalledWith({ ...draft, time_zone: "America/Los_Angeles" });
    fireEvent.change(screen.getByLabelText("Time zone"), { target: { value: "" } });
    expect(onChange).toHaveBeenLastCalledWith({ ...draft, time_zone: undefined });
  });
});
