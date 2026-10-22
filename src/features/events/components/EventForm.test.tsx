import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
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

    expect(onChange).toHaveBeenNthCalledWith(1, {
      ...draft,
      event_type: "class",
      event_types: ["class"],
    });
    expect(onChange).toHaveBeenNthCalledWith(2, { ...draft, city: "new-york-city" });
    expect(onChange).toHaveBeenNthCalledWith(3, { ...draft, price_type: "paid" });
  });

  describe("event type multi-select", () => {
    const typeButton = (name: string) => screen.getByRole("button", { name });

    function Harness({ initial = draft }: { initial?: EventFormDraft }) {
      const [value, setValue] = useState(initial);
      return (
        <>
          <EventForm draft={value} onChange={setValue} capabilities={CAPABILITIES.submit} />
          <output data-testid="types">{JSON.stringify([value.event_type, value.event_types])}</output>
        </>
      );
    }
    const stored = () => JSON.parse(screen.getByTestId("types").textContent ?? "null");

    it("offers Concert beside the other types", () => {
      render(<Harness />);
      expect(typeButton("Concert")).toBeVisible();
    });

    it("keeps two selected categories pressed and records the first as primary", () => {
      render(<Harness />);

      fireEvent.click(typeButton("Live Music"));
      fireEvent.click(typeButton("Concert"));

      expect(typeButton("Live Music")).toHaveAttribute("aria-pressed", "true");
      expect(typeButton("Concert")).toHaveAttribute("aria-pressed", "true");
      expect(typeButton("Social")).toHaveAttribute("aria-pressed", "false");
      expect(stored()).toEqual(["live_music", ["live_music", "concert"]]);
      expect(screen.getByText(/first one you pick sets the calendar color/)).toHaveTextContent(
        "calendar color: Live Music."
      );
    });

    it("promotes the next selection when the primary is removed", () => {
      render(<Harness />);
      fireEvent.click(typeButton("Social"));
      fireEvent.click(typeButton("Class"));
      fireEvent.click(typeButton("Workshop"));

      fireEvent.click(typeButton("Social"));

      expect(typeButton("Social")).toHaveAttribute("aria-pressed", "false");
      expect(stored()).toEqual(["class", ["class", "workshop"]]);
    });

    it("clears both fields together when the last type is removed", () => {
      render(<Harness initial={{ ...draft, event_type: "class", event_types: ["class"] }} />);

      fireEvent.click(typeButton("Class"));

      expect(stored()).toEqual(["", []]);
    });

    it("shows a draft that only carries the primary as selected", () => {
      render(<Harness initial={{ ...draft, event_type: "workshop" }} />);

      expect(typeButton("Workshop")).toHaveAttribute("aria-pressed", "true");
      fireEvent.click(typeButton("Concert"));
      expect(stored()).toEqual(["workshop", ["workshop", "concert"]]);
    });
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
