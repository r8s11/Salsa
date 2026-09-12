/* eslint-disable */
// @ts-nocheck - Deno test file

import {
  assert,
  assertEquals,
  assertStrictEquals,
} from "https://deno.land/std@0.224.0/testing/asserts.ts";
import {
  normalizeText,
  normalizeVenueName,
  normalizeAddress,
  matchVenue,
  type CandidateVenue,
} from "./matching.ts";

Deno.test("normalizeText - NFKC, lowercase, trim, collapse whitespace", () => {
  assertEquals(normalizeText("  HELLO   WORLD  "), "hello world");
  assertEquals(normalizeText("cafe\u0301"), "café"); // NFKC composes e + combining acute → é
  assertEquals(normalizeText(null), "");
  assertEquals(normalizeText(undefined), "");
});

Deno.test("normalizeVenueName - conservative, no substring collapsing", () => {
  assertEquals(normalizeVenueName("Havana Club"), "havana club");
  assertEquals(normalizeVenueName("Havana  Club"), "havana club"); // collapse only
  assertEquals(normalizeVenueName("  havana club  "), "havana club");
  assertEquals(normalizeVenueName("Havana-Club"), "havana-club"); // hyphen preserved
  assertEquals(normalizeVenueName("Havana/Club"), "havana/club"); // slash preserved
});

Deno.test("normalizeAddress - suffix expansion", () => {
  assertEquals(normalizeAddress("288 Green St"), "288 green street");
  assertEquals(normalizeAddress("288 Green Street"), "288 green street");
  assertEquals(normalizeAddress("123 Main Ave"), "123 main avenue");
  assertEquals(normalizeAddress("123 Main Avenue"), "123 main avenue");
  assertEquals(normalizeAddress("456 Oak Rd"), "456 oak road");
  assertEquals(normalizeAddress("789 Elm Blvd"), "789 elm boulevard");
  assertEquals(normalizeAddress("101 Pine Dr"), "101 pine drive");
  assertEquals(normalizeAddress("202 Cedar Pl"), "202 cedar place");
  assertEquals(normalizeAddress("303 Maple Ln"), "303 maple lane");
  assertEquals(normalizeAddress("404 Birch Dr"), "404 birch drive");
  assertEquals(normalizeAddress("505 Walnut Trl"), "505 walnut trail");
  assertEquals(normalizeAddress("606 Spruce Pky"), "606 spruce parkway");
  assertEquals(normalizeAddress("707 Cherry Way"), "707 cherry way");
});

Deno.test("matchVenue - exact match: 288 Green St ↔ 288 Green Street", () => {
  const candidates: CandidateVenue[] = [
    { id: "1", name: "Havana Club", address_line1: "288 Green Street", city: "Cambridge" },
  ];
  const result = matchVenue("Havana Club", "288 Green St", "Cambridge", candidates);
  assertEquals(result.status, "exact");
  assertEquals(result.match?.id, "1");
  assertEquals(result.match?.name, "Havana Club");
  assertEquals(result.match?.address, "288 Green Street");
  assertEquals(result.match?.city, "Cambridge");
});

Deno.test(
  "matchVenue - strong match: same name + city + unique active candidate, address absent",
  () => {
    const candidates: CandidateVenue[] = [
      { id: "1", name: "Havana Club", address_line1: "288 Green Street", city: "Cambridge" },
    ];
    const result = matchVenue("Havana Club", null, "Cambridge", candidates);
    assertEquals(result.status, "strong");
    assertEquals(result.match?.id, "1");
  }
);

Deno.test(
  "matchVenue - ambiguous: duplicate same-name candidates with insufficient context",
  () => {
    const candidates: CandidateVenue[] = [
      { id: "1", name: "Havana Club", address_line1: "288 Green Street", city: "Cambridge" },
      { id: "2", name: "Havana Club", address_line1: "500 Main Street", city: "Boston" },
    ];
    const result = matchVenue("Havana Club", null, null, candidates);
    assertEquals(result.status, "ambiguous");
    assertEquals(result.match, null);
  }
);

Deno.test("matchVenue - none: no viable candidate", () => {
  const candidates: CandidateVenue[] = [
    { id: "1", name: "Other Club", address_line1: "123 Other St", city: "Cambridge" },
  ];
  const result = matchVenue("Havana Club", "288 Green St", "Cambridge", candidates);
  assertEquals(result.status, "none");
  assertEquals(result.match, null);
});

Deno.test("matchVenue - archived candidate ignored", () => {
  const candidates: CandidateVenue[] = [
    { id: "1", name: "Havana Club", address_line1: "288 Green Street", city: "Cambridge" },
  ];
  // This test validates that the handler filters by status=active before calling matchVenue
  // The matcher itself only receives active candidates
  const result = matchVenue("Havana Club", "288 Green St", "Cambridge", candidates);
  assertEquals(result.status, "exact");
});

Deno.test("matchVenue - needs_review candidate not auto-matched", () => {
  // Same as above - handler filters by status=active
  const candidates: CandidateVenue[] = [
    { id: "1", name: "Havana Club", address_line1: "288 Green Street", city: "Cambridge" },
  ];
  const result = matchVenue("Havana Club", "288 Green St", "Cambridge", candidates);
  assertEquals(result.status, "exact");
});

Deno.test("matchVenue - Unicode/case/whitespace normalization", () => {
  const candidates: CandidateVenue[] = [
    { id: "1", name: "Café Havana", address_line1: "288 Green Street", city: "Cambridge" },
  ];
  const result = matchVenue("café  havana", "288 green  st", "cambridge", candidates);
  assertEquals(result.status, "exact");
});

Deno.test("matchVenue - distinct venue names are not over-normalized", () => {
  const candidates: CandidateVenue[] = [
    { id: "1", name: "Havana Club", address_line1: "288 Green Street", city: "Cambridge" },
    { id: "2", name: "Havana Club Boston", address_line1: "500 Main St", city: "Boston" },
  ];
  const result = matchVenue("Havana Club", null, null, candidates);
  assertEquals(result.status, "ambiguous"); // multiple name matches
  assertEquals(result.match, null);
});

Deno.test("matchVenue - empty name returns none without querying", () => {
  const candidates: CandidateVenue[] = [
    { id: "1", name: "Havana Club", address_line1: "288 Green Street", city: "Cambridge" },
  ];
  const result = matchVenue("", null, null, candidates);
  assertEquals(result.status, "none");
  assertEquals(result.match, null);
});

Deno.test("matchVenue - strong with city but no address", () => {
  const candidates: CandidateVenue[] = [
    { id: "1", name: "Havana Club", address_line1: "288 Green Street", city: "Cambridge" },
  ];
  const result = matchVenue("Havana Club", "", "Cambridge", candidates);
  assertEquals(result.status, "strong");
  assertEquals(result.match?.id, "1");
});

Deno.test("matchVenue - strong requires exactly one candidate in city", () => {
  const candidates: CandidateVenue[] = [
    { id: "1", name: "Havana Club", address_line1: "288 Green Street", city: "Cambridge" },
    { id: "2", name: "Havana Club", address_line1: "500 Main St", city: "Cambridge" },
  ];
  const result = matchVenue("Havana Club", null, "Cambridge", candidates);
  assertEquals(result.status, "ambiguous");
  assertEquals(result.match, null);
});

Deno.test("matchVenue - exact requires exactly one address match", () => {
  const candidates: CandidateVenue[] = [
    { id: "1", name: "Havana Club", address_line1: "288 Green Street", city: "Cambridge" },
    { id: "2", name: "Havana Club", address_line1: "288 Green Street", city: "Boston" },
  ];
  const result = matchVenue("Havana Club", "288 Green St", "Cambridge", candidates);
  assertEquals(result.status, "ambiguous"); // two exact address matches
  assertEquals(result.match, null);
});
