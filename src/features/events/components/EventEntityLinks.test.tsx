import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import EventEntityLinks from "./EventEntityLinks";

const ref = (kind: "venue" | "organizer" | "school" | "instructor" | "series" | "city" | "style", name: string, slug: string) => ({
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
      series: ref("series", "Friday Social", "friday-social"),
      city: ref("city", "Boston", "boston"),
      styles: [ref("style", "Salsa", "salsa")],
    }} /></MemoryRouter>);
    for (const [name, path] of [
      ["Dance Hall", "/v/dance-hall"], ["Dance Company", "/o/dance-company"],
      ["Dance School", "/s/dance-school"], ["Ana", "/i/ana"],
      ["Friday Social", "/series/friday-social"], ["Boston", "/cities/boston"],
      ["Salsa", "/styles/salsa"],
    ]) expect(screen.getByRole("link", { name })).toHaveAttribute("href", path);
    expect(screen.getAllByRole("link", { name: "Dance School" })).toHaveLength(1);
  });
});
