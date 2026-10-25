import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";

// Local-only acceptance proof. Never point this fixture at a remote project.
const environment = JSON.parse(
  execFileSync("npx", ["supabase", "status", "-o", "json"], {
    cwd: new URL("..", import.meta.url),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  })
);
assert.match(environment.API_URL, /^http:\/\/(127\.0\.0\.1|localhost):\d+$/);
const stamp = `${Date.now()}-${randomUUID().slice(0, 8)}`;
const password = `FlyerAcceptance-${randomUUID()}!`;
const users = [];
const eventIds = [];
const submissionIds = [];
const entityIds = {
  venue: new Set(),
  organizer: new Set(),
  instructor: new Set(),
  school: new Set(),
};
const tables = {
  venue: "venues",
  organizer: "organizers",
  instructor: "instructors",
  school: "schools",
};
function sql(statement) {
  return execFileSync(
    "docker",
    [
      "exec",
      "supabase_db_Salsa",
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-t",
      "-A",
      "-c",
      statement,
    ],
    { encoding: "utf8" }
  ).trim();
}
const createdMetro =
  sql("select not exists(select 1 from public.metros where slug='miami')") === "t";
sql(
  "insert into public.metros(slug,name,state_region) values('miami','Miami','FL') on conflict(slug) do nothing"
);
async function request(path, token, body, method = "POST") {
  const response = await fetch(`${environment.API_URL}${path}`, {
    method,
    headers: {
      apikey: environment.ANON_KEY,
      Authorization: `Bearer ${token ?? environment.ANON_KEY}`,
      "Content-Type": "application/json",
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: response.status, ok: response.ok, data };
}
async function rpc(name, token, body) {
  const result = await request(`/rest/v1/rpc/${name}`, token, body);
  assert.equal(result.ok, true, `${name}: ${result.status} ${JSON.stringify(result.data)}`);
  return result.data;
}
async function user(role) {
  const email = `flyer-${role}-${stamp}@example.test`;
  const created = await request("/auth/v1/admin/users", environment.SERVICE_ROLE_KEY, {
    email,
    password,
    email_confirm: true,
    app_metadata: { role },
  });
  assert.equal(created.ok, true, JSON.stringify(created.data));
  users.push(created.data.id);
  const login = await request("/auth/v1/token?grant_type=password", null, { email, password });
  assert.equal(login.ok, true, JSON.stringify(login.data));
  assert.equal(
    JSON.parse(Buffer.from(login.data.access_token.split(".")[1], "base64url")).app_metadata.role,
    role
  );
  return login.data.access_token;
}
const candidates = {
  venue: {
    name: "Example Dance Hall",
    address: `${stamp} Acceptance Street`,
    city: "Miami",
    state_region: "FL",
    country: "US",
  },
  organizer: { name: "Mambo Production", instagram: `mambo_${stamp.replaceAll("-", "_")}` },
  instructors: [{ name: "Jane Dancer", instagram: `jane_${stamp.replaceAll("-", "_")}` }],
  school: {
    name: "Example Salsa Academy",
    city: "Miami",
    state_region: "FL",
    website: `https://${stamp}.example.test`,
  },
};
function items(review) {
  return [review.venue, review.organizer, ...review.instructors, review.school].filter(Boolean);
}
function approveNew(review) {
  return {
    ...review,
    venue: review.venue && { ...review.venue, decision: "new", selected_id: null },
    organizer: review.organizer && { ...review.organizer, decision: "new", selected_id: null },
    instructors: review.instructors.map((item) => ({
      ...item,
      decision: "new",
      selected_id: null,
    })),
    school: review.school && { ...review.school, decision: "new", selected_id: null },
  };
}
const payload = {
  title: "Salsa Thursdays",
  description: null,
  event_type: "social",
  city: "miami",
  event_date: "2099-10-08T23:00:00Z",
  event_time: "19:00",
  location: "Manually corrected hall label",
  address: "Manually corrected event address",
  price_type: "free",
  price_amount: null,
  rsvp_link: null,
  image_url: null,
  recurrence: null,
  host: null,
  contact_email: null,
  contact_instagram: null,
  contact_website: null,
  venue_id: null,
  taxonomy_term_ids: [],
};
try {
  const admin = await user("admin");
  const moderator = await user("moderator");
  const ordinary = await user("user");
  for (const token of [null, ordinary]) {
    for (const [kind, table] of Object.entries(tables)) {
      const denied = await request(`/rest/v1/${table}`, token, { name: `Forbidden ${stamp}` });
      assert.equal(denied.ok, false, `${kind}: unauthorized canonical insert succeeded`);
    }
    const deniedSave = await request("/rest/v1/rpc/save_event_with_entities", token, {
      p_event_id: null,
      p_payload: payload,
      p_publish: true,
    });
    assert.equal(deniedSave.ok, false, "Unauthorized save succeeded");
  }
  let review = await rpc("reconcile_flyer_entities", admin, { p_candidates: candidates });
  assert.equal(items(review).length, 4);
  for (const item of items(review))
    assert.notEqual(item.state, "MATCHED", "Fresh identity unexpectedly reused");
  review = approveNew(review);
  const submissionId = randomUUID();
  submissionIds.push(submissionId);
  const submitted = await request("/rest/v1/event_submissions", null, {
    id: submissionId,
    status: "pending",
    submitter_id: null,
    submitter_name: "Flyer verifier",
    submitter_email: `guest-${stamp}@example.test`,
    submitted_data: { ...payload, entity_review: review },
  });
  assert.equal(submitted.ok, true, JSON.stringify(submitted.data));
  const before = await rpc("reconcile_flyer_entities", admin, { p_candidates: candidates });
  for (const item of items(before))
    assert.notEqual(item.state, "MATCHED", "Public submission created canonical entities");
  const createdTogether = await Promise.all(
    Array.from({ length: 4 }, async () => {
      const id = await rpc("save_event_with_entities", admin, {
        p_event_id: null,
        p_payload: { ...payload, entity_review: review },
        p_publish: true,
      });
      eventIds.push(id);
      return id;
    })
  );
  const first = createdTogether[0];
  const stored = JSON.parse(sql(`select row_to_json(e) from public.events e where id='${first}'`));
  assert.ok(stored.venue_id);
  assert.ok(stored.organizer_id);
  assert.equal(stored.location, payload.location);
  assert.equal(stored.address, payload.address);
  assert.equal(sql(`select count(*) from public.event_instructors where event_id='${first}'`), "1");
  assert.equal(sql(`select count(*) from public.event_schools where event_id='${first}'`), "1");
  const matched = await rpc("reconcile_flyer_entities", admin, { p_candidates: candidates });
  for (const item of items(matched)) {
    assert.equal(item.state, "MATCHED");
    assert.equal(item.decision, "existing");
  }
  entityIds.venue.add(matched.venue.selected_id);
  entityIds.organizer.add(matched.organizer.selected_id);
  for (const item of matched.instructors) entityIds.instructor.add(item.selected_id);
  entityIds.school.add(matched.school.selected_id);
  for (const id of createdTogether) {
    const row = JSON.parse(sql(`select row_to_json(e) from public.events e where id='${id}'`));
    assert.equal(row.venue_id, stored.venue_id);
    assert.equal(row.organizer_id, stored.organizer_id);
    assert.equal(
      sql(`select instructor_id from public.event_instructors where event_id='${id}'`),
      matched.instructors[0].selected_id
    );
    assert.equal(
      sql(`select school_id from public.event_schools where event_id='${id}'`),
      matched.school.selected_id
    );
  }
  const repeated = await Promise.all(
    Array.from({ length: 4 }, () =>
      rpc("save_event_with_entities", admin, {
        p_event_id: null,
        p_payload: { ...payload, entity_review: review },
        p_publish: false,
      })
    )
  );
  eventIds.push(...repeated);
  for (const id of repeated) {
    const row = JSON.parse(sql(`select row_to_json(e) from public.events e where id='${id}'`));
    assert.equal(row.venue_id, stored.venue_id);
    assert.equal(row.organizer_id, stored.organizer_id);
    assert.equal(row.status, "draft");
  }
  const nameOnly = await rpc("reconcile_flyer_entities", admin, {
    p_candidates: {
      venue: { name: candidates.venue.name },
      organizer: null,
      instructors: [],
      school: null,
    },
  });
  assert.notEqual(nameOnly.venue.state, "MATCHED");
  assert.equal(nameOnly.venue.decision, "pending");
  // Submitted decisions are suggestions: the moderator must persist an authorized review.
  const edited = await request(
    `/rest/v1/event_submissions?id=eq.${submissionId}`,
    moderator,
    { edited_data: { ...payload, entity_review: matched } },
    "PATCH"
  );
  assert.equal(edited.ok, true, JSON.stringify(edited.data));
  const approved = await rpc("approve_event_submission", moderator, {
    p_submission_id: submissionId,
    p_taxonomy_term_ids: [],
  });
  eventIds.push(approved);
  const replay = await rpc("approve_event_submission", moderator, {
    p_submission_id: submissionId,
    p_taxonomy_term_ids: [],
  });
  assert.equal(replay, approved, "Approval replay created another event");
  for (const [kind, ids] of Object.entries(entityIds))
    for (const id of ids) {
      const entity = JSON.parse(
        sql(`select row_to_json(t) from public.${tables[kind]} t where id='${id}'`)
      );
      assert.ok(entity.slug);
      const publicEntity = await rpc("public_flyer_entity", null, {
        p_kind: kind,
        p_slug: entity.slug,
      });
      assert.equal(publicEntity.id, id);
      assert.equal("email" in publicEntity, false);
      assert.equal("phone" in publicEntity, false);
    }
  console.log(
    "PASS: four candidates; new/existing/ambiguous review; manual event fields; atomic save/approval; concurrent reuse; approval replay; anonymous/user canonical INSERT and save denied; public submission creates no entities; safe canonical slug projections."
  );
} finally {
  if (eventIds.length) {
    const fixtureSignals = {
      venue: `address_line1='${candidates.venue.address}'`,
      organizer: `instagram in ('${candidates.organizer.instagram}','@${candidates.organizer.instagram}')`,
      instructor: `instagram in ('${candidates.instructors[0].instagram}','@${candidates.instructors[0].instagram}')`,
      school: `website='${candidates.school.website}'`,
    };
    for (const [kind, signal] of Object.entries(fixtureSignals)) {
      const ids = sql(`select id from public.${tables[kind]} where ${signal}`);
      for (const id of ids.split("\n").filter(Boolean)) entityIds[kind].add(id);
    }
  }
  if (submissionIds.length)
    sql(
      `delete from public.event_submissions where id in (${submissionIds.map((id) => `'${id}'`).join(",")})`
    );
  if (eventIds.length)
    sql(`delete from public.events where id in (${eventIds.map((id) => `'${id}'`).join(",")})`);
  for (const [kind, ids] of Object.entries(entityIds))
    if (ids.size)
      sql(
        `delete from public.${tables[kind]} where id in (${[...ids].map((id) => `'${id}'`).join(",")})`
      );
  if (users.length)
    sql(
      `delete from public.audit_logs where actor_id in (${users.map((id) => `'${id}'`).join(",")})`
    );
  if (createdMetro) sql("delete from public.metros where slug='miami'");
  for (const id of users) {
    const deleted = await request(
      `/auth/v1/admin/users/${id}`,
      environment.SERVICE_ROLE_KEY,
      undefined,
      "DELETE"
    );
    assert.equal(deleted.ok, true, `Fixture user cleanup failed: ${JSON.stringify(deleted.data)}`);
  }
}
