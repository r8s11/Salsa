import { describe, expect, it } from "vitest";
import { privateOffer, schoolClass } from "./pages/workspaceTestKit";
import {
  BLANK_PRIVATE_FORM,
  blankClassForm,
  classFormFrom,
  classInputFrom,
  privateFormFrom,
  privateInputFrom,
  type ClassForm,
  type PrivateForm,
} from "./offeringForm";

function classInput(form: ClassForm) {
  const result = classInputFrom({ ...form, title: "Salsa On2" });
  if ("errors" in result) throw new Error(JSON.stringify(result.errors));
  return result.input;
}

function privateInput(form: PrivateForm) {
  const result = privateInputFrom({ ...form, title: "Solo coaching", price: "85" });
  if ("errors" in result) throw new Error(JSON.stringify(result.errors));
  return result.input;
}

describe("instructor link in class payloads", () => {
  it("carries the selected artist's id with their name", () => {
    const input = classInput({ ...blankClassForm(1), instructor_id: "artist-1", instructor_name: "Ana Rivera" });
    expect(input).toMatchObject({ instructor_id: "artist-1", instructor_name: "Ana Rivera" });
  });

  it("sends no id for a plain-text name, even one that matches an artist", () => {
    const input = classInput({ ...blankClassForm(1), instructor_name: "  Ana Rivera " });
    expect(input).toMatchObject({ instructor_id: null, instructor_name: "Ana Rivera" });
  });

  it("clears the id and keeps the name when unlinked, or clears both when the name is emptied", () => {
    const linked = classFormFrom(schoolClass({ instructor_id: "artist-1" }));
    expect(classInput({ ...linked, instructor_id: "" })).toMatchObject({
      instructor_id: null,
      instructor_name: "Ana Rivera",
    });
    expect(classInput({ ...linked, instructor_id: "", instructor_name: "" })).toMatchObject({
      instructor_id: null,
      instructor_name: null,
    });
  });

  it("keeps an existing link when only another field changes", () => {
    const form = { ...classFormFrom(schoolClass({ instructor_id: "artist-1" })), room: "Studio C" };
    expect(classInput(form)).toMatchObject({ instructor_id: "artist-1", instructor_name: "Ana Rivera", room: "Studio C" });
  });

  it("does not re-link when the name is retyped after an unlink", () => {
    const form = { ...classFormFrom(schoolClass({ instructor_id: "artist-1" })), instructor_id: "", instructor_name: "Ana Rivera " };
    expect(classInput(form).instructor_id).toBeNull();
  });
});

describe("instructor link in private-lesson payloads", () => {
  it("carries the selected artist's id", () => {
    expect(privateInput({ ...BLANK_PRIVATE_FORM, instructor_id: "artist-2", instructor_name: "Luis" })).toMatchObject({
      instructor_id: "artist-2",
      instructor_name: "Luis",
    });
  });

  it("sends no id for a plain-text name", () => {
    expect(privateInput({ ...BLANK_PRIVATE_FORM, instructor_name: "Luis" })).toMatchObject({
      instructor_id: null,
      instructor_name: "Luis",
    });
  });

  it("clears the id on unlink and keeps the link across unrelated edits", () => {
    const linked = privateFormFrom(privateOffer({ instructor_id: "artist-1" }));
    expect(privateInput({ ...linked, notes: "Bring shoes" })).toMatchObject({ instructor_id: "artist-1" });
    expect(privateInput({ ...linked, instructor_id: "" })).toMatchObject({
      instructor_id: null,
      instructor_name: "Ana Rivera",
    });
  });
});
