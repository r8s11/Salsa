import { describe, expect, it } from "vitest";
import {
  eventTypeFields,
  eventTypeFieldsFrom,
  eventTypePayload,
  toggleEventType,
} from "./eventTypeSelection";

describe("toggleEventType", () => {
  it("adds types in selection order and keeps the first as primary", () => {
    const first = toggleEventType({ event_type: "", event_types: [] }, "concert");
    const second = toggleEventType(first, "social");

    expect(second).toEqual({ event_type: "concert", event_types: ["concert", "social"] });
  });

  it("promotes the next type when the primary is removed", () => {
    const next = toggleEventType(
      { event_type: "social", event_types: ["social", "class", "workshop"] },
      "social"
    );

    expect(next).toEqual({ event_type: "class", event_types: ["class", "workshop"] });
  });

  it("leaves the primary alone when a later type is removed", () => {
    const next = toggleEventType(
      { event_type: "social", event_types: ["social", "class"] },
      "class"
    );

    expect(next).toEqual({ event_type: "social", event_types: ["social"] });
  });

  it("empties both fields when the only type is removed", () => {
    expect(toggleEventType({ event_type: "class", event_types: ["class"] }, "class")).toEqual({
      event_type: "",
      event_types: [],
    });
  });

  it("treats a primary-only draft as a one-item selection", () => {
    expect(toggleEventType({ event_type: "class" }, "concert")).toEqual({
      event_type: "class",
      event_types: ["class", "concert"],
    });
  });
});

describe("eventTypeFieldsFrom", () => {
  it("reads the persisted list and drops unsupported or duplicate entries", () => {
    expect(
      eventTypeFieldsFrom({
        event_type: "social",
        event_types: ["live_music", "bogus", "live_music", "concert"],
      })
    ).toEqual({ event_type: "live_music", event_types: ["live_music", "concert"] });
  });

  it("falls back to the primary when the list is missing or unusable", () => {
    expect(eventTypeFieldsFrom({ event_type: "class" })).toEqual({
      event_type: "class",
      event_types: ["class"],
    });
    expect(eventTypeFieldsFrom({ event_type: "class", event_types: "class" })).toEqual({
      event_type: "class",
      event_types: ["class"],
    });
  });

  it("yields an empty selection when nothing valid is present", () => {
    expect(eventTypeFieldsFrom({ event_type: "nope" })).toEqual(eventTypeFields([]));
  });
});

describe("eventTypePayload", () => {
  it("makes the first listed type the primary", () => {
    expect(eventTypePayload({ event_type: "social", event_types: ["class", "social"] })).toEqual({
      event_type: "class",
      event_types: ["class", "social"],
    });
  });

  it("throws when nothing is selected", () => {
    expect(() => eventTypePayload({ event_type: "", event_types: [] })).toThrow(
      "Choose at least one event type."
    );
  });
});
