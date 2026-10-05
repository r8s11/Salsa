import { describe, expect, it } from "vitest";
import { buildEntityForm, entityPayload, type AdminEntityRow } from "./model";

const baseRow = (kind: AdminEntityRow["kind"]): AdminEntityRow => ({
  id: `${kind}-id`,
  kind,
  name: "Name",
  slug: "stable-slug",
  status: "active",
  description: null,
  image_url: null,
  city: "boston",
  website: null,
  instagram: null,
  quality_issues: [],
  linked_events: [],
});

describe("entityPayload", () => {
  it("keeps Series defaults as explicit entity links and preserves its editable fields", () => {
    const form = buildEntityForm({ ...baseRow("series"), venue_id: "venue-id", organizer_id: "organizer-id", image_url: "https://example.test/series.png" });
    expect(entityPayload("series", form)).toMatchObject({
      name: "Name", slug: "stable-slug", status: "active", city: "boston",
      venue_id: "venue-id", organizer_id: "organizer-id", image_url: "https://example.test/series.png",
    });
  });

  it("maps organizer fields without emitting membership or account mutations", () => {
    const payload = entityPayload("organizer", { ...buildEntityForm(baseRow("organizer")), category: "promoter", image_url: "https://example.test/logo.png" });
    expect(payload).toMatchObject({ category: "promoter", image_url: "https://example.test/logo.png" });
    expect(payload).not.toHaveProperty("members");
    expect(payload).not.toHaveProperty("role");
    expect(payload).not.toHaveProperty("user_id");
  });

  it("maps school and instructor description and image metadata", () => {
    const school = entityPayload("school", {
      ...buildEntityForm(baseRow("school")),
      address: "10 Main St",
      phone: "555-0100",
      description: "Weekly classes",
      image_url: "https://example.test/school.png",
    });
    const instructor = entityPayload("instructor", {
      ...buildEntityForm(baseRow("instructor")),
      organization: "Salsa Lab",
      description: "Teaches salsa",
      image_url: "https://example.test/instructor.png",
    });
    expect(school).toMatchObject({
      address: "10 Main St",
      phone: "555-0100",
      description: "Weekly classes",
      image_url: "https://example.test/school.png",
    });
    expect(instructor).toMatchObject({
      organization: "Salsa Lab",
      description: "Teaches salsa",
      image_url: "https://example.test/instructor.png",
    });
  });
});
