import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import EventEntityLinks from "./EventEntityLinks";

const ref = (kind: "venue" | "organizer" | "school" | "instructor" | "dj" | "series" | "city" | "style", name: string, slug: string) => ({
  kind, id: slug, name, slug, description: null, image_url: null, city: "boston",
});

describe("event attribution", () => {
  it("makes every linked entity reachable without exposing identifier labels", () => {
    render(<MemoryRouter><EventEntityLinks entities={{
      venue: ref("venue", "Dance Hall", "dance-hall"),
      organizer: ref("organizer", "Dance Company", "dance-company"),
      school: ref("school", "Dance School", "dance-school"),
      schools: [ref("school", "Dance School", "dance-school")],
      instructors: [ref("instructor", "Ana", "ana")],
      djs: [ref("dj", "DJ Coco", "dj-coco")],
      series: ref("series", "Friday Social", "friday-social"),
      city: ref("city", "Boston", "boston"),
      styles: [ref("style", "Salsa", "salsa")],
    }} /></MemoryRouter>);
    for (const [name, path] of [
      ["Dance Hall", "/v/dance-hall"], ["Dance Company", "/o/dance-company"],
      ["Dance School", "/s/dance-school"], ["Ana", "/i/ana"], ["DJ Coco", "/dj/dj-coco"],
      ["Friday Social", "/series/friday-social"], ["Boston", "/cities/boston"],
      ["Salsa", "/styles/salsa"],
    ]) expect(screen.getByRole("link", { name: new RegExp(`${name}$`) })).toHaveAttribute("href", path);
    expect(screen.getAllByRole("link", { name: "School Dance School" })).toHaveLength(1);
  });
});

describe("same-name listings", () => {
  it("keeps a venue, organizer and school sharing one name as three labeled links", () => {
    render(<MemoryRouter><EventEntityLinks entities={{
      venue: ref("venue", "ABC Studio", "abc-venue"),
      organizer: ref("organizer", "ABC Studio", "abc-org"),
      school: null,
      schools: [ref("school", "ABC Studio", "abc-school")],
      instructors: [], djs: [], series: null, city: null, styles: [],
    }} /></MemoryRouter>);
    expect(screen.getByRole("link", { name: "Venue ABC Studio" })).toHaveAttribute("href", "/v/abc-venue");
    expect(screen.getByRole("link", { name: "Organizer ABC Studio" })).toHaveAttribute("href", "/o/abc-org");
    expect(screen.getByRole("link", { name: "School ABC Studio" })).toHaveAttribute("href", "/s/abc-school");
  });
});
