import assert from "node:assert/strict";
import { createArtistRsvpWorker, type ArtistRsvpClaim, type ArtistRsvpMail, type ArtistRsvpWorkerDependencies } from "./artistRsvpWorker.ts";
import type { ArtistRsvpFacts } from "./artistRsvpEmail.ts";
const secret = "a".repeat(32);
const facts: ArtistRsvpFacts = { event_title: "Musicality", event_date: "2099-12-05T19:00:00Z", time_zone: "America/New_York", artist_name: "Ari Rivera", artist_slug: "ari", event_slug: "musicality", external_url: "https://artist.test/pay", is_free: false, city: "new-york-city" };
const request = (headers = { "x-rsvp-scheduler-secret": secret }) => new Request("https://worker.test", { method: "POST", headers, body: JSON.stringify({ to: "attacker@evil.test", kind: "acceptance", html: "FORGED" }) });
function setup(claims: ArtistRsvpClaim[]) {
  const sent: { mail: ArtistRsvpMail; key: string; time: number }[] = [];
  const finished: { id: string; token: string; status: string; failure: string | null }[] = [];
  let time = 0;
  const deps: ArtistRsvpWorkerDependencies = {
    secret, siteUrl: "https://site.test", from: "Salsa <hello@site.test>", due: async () => claims.map((claim) => claim.id), claim: async (id) => claims.find((claim) => claim.id === id) ?? null, allowed: async () => true,
    send: async (mail, key) => { sent.push({ mail, key, time }); return { data: { id: `provider-${sent.length}` }, error: null }; },
    finish: async (id, token, status, _providerId, failure) => { finished.push({ id, token, status, failure }); return true; },
    now: () => time, sleep: async (ms) => { time += ms; }, log: () => {},
  };
  return { deps, sent, finished, run: (req = request()) => createArtistRsvpWorker(deps)(req) };
}
function claim(id: string, kind: ArtistRsvpClaim["kind"], email = "guest@fixture.test"): ArtistRsvpClaim { return { id, token: `token-${id}`, kind, event_id: "event", artist_id: "artist", rsvp_id: "guest", recipient_email: email, recipient_user_id: kind === "capacity_full" || kind === "new_waitlist" ? "owner" : null, facts: structuredClone(facts), idempotency_key: `artist:${kind}:${id}:1:guest` }; }
Deno.test("U11 recipients and factual mail dispatch only stored guests and currently authorized owners", async () => {
  const claims = [claim("main", "main_receipt"), claim("wait", "waitlist_receipt", "wait@fixture.test"), claim("full", "capacity_full", "owner@fixture.test"), claim("revoked", "capacity_full", "revoked@fixture.test"), claim("teacher", "new_waitlist", "teacher@fixture.test")];
  const t = setup(claims); t.deps.allowed = async (id) => !["revoked", "teacher"].includes(id);
  assert.equal((await t.run()).status, 200);
  assert.deepEqual(t.sent.map((entry) => entry.mail.to), ["guest@fixture.test", "wait@fixture.test", "owner@fixture.test"]);
  assert.match(t.sent[0].mail.text, /not artist acceptance or verified payment/); assert.match(t.sent[1].mail.text, /waitlist/); assert.match(t.sent[1].mail.text, /before paying/); assert.match(t.sent[2].mail.text, /private RSVP roster/);
  assert.ok(t.sent.every((entry) => !entry.mail.html.includes("FORGED") && entry.mail.to !== "attacker@evil.test"));
  assert.deepEqual(t.finished.filter((entry) => entry.status === "suppressed").map((entry) => entry.id), ["revoked", "teacher"]);
  assert.deepEqual(t.sent.map((entry) => entry.time), [0, 1000, 2000]);
  const bounded = setup(Array.from({ length: 25 }, (_, i) => claim(String(i), "main_receipt"))); await bounded.run(); assert.equal(bounded.sent.length, 20);
});
Deno.test("F9 leases and idempotency fail closed and preserve keys through ambiguous outcomes", async () => {
  const t = setup([claim("retry", "acceptance")]);
  assert.equal((await t.run(request({ "x-rsvp-scheduler-secret": "wrong" }))).status, 401);
  assert.equal((await t.run(new Request("https://worker.test"))).status, 405); assert.equal(t.sent.length, 0); assert.equal(t.finished.length, 0);
  const originalSend = t.deps.send;
  t.deps.send = async (mail, key) => { await originalSend(mail, key); throw Error("timeout after provider acceptance"); };
  await t.run(); assert.deepEqual(t.finished.map((entry) => [entry.status, entry.failure]), [["failed", "ambiguous"]]);
  t.deps.claim = async () => ({ ...claim("retry", "acceptance"), token: "new-lease-token" }); t.deps.send = originalSend;
  t.deps.finish = async (id, token, status, _provider, failure) => { t.finished.push({ id, token, status, failure }); return false; };
  const response = await t.run(); assert.equal((await response.json()).sent, 0); assert.equal(t.sent[1].key, t.sent[0].key); assert.deepEqual(t.sent[1].mail, t.sent[0].mail); assert.equal(t.finished[1].token, "new-lease-token");
  t.deps.send = async () => ({ data: null, error: { name: "rate_limited" }, httpStatus: 429 }); await t.run(); assert.equal(t.finished.at(-1)?.failure, "transient");
  t.deps.allowed = async () => false; const before = t.sent.length; await t.run(); assert.equal(t.sent.length, before); assert.equal(t.finished.at(-1)?.status, "suppressed");
  t.deps.allowed = async () => true; t.deps.send = originalSend; t.deps.finish = async () => { throw Error("finish database unavailable"); }; const uncertain = await t.run(); assert.equal((await uncertain.json()).sent, 0);
});
