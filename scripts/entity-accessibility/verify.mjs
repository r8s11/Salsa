import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { chmod, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Local-only end-to-end acceptance proof for the entity accessibility RPCs.
// This deliberately uses the running Supabase stack and never resets/migrates it.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const keepFixtures = process.argv.includes("--keep-fixtures");
const cleanupIndex = process.argv.indexOf("--cleanup");
if (process.argv.some((arg, index) =>
  arg.startsWith("--") && arg !== "--keep-fixtures" && !(arg === "--cleanup" && index === cleanupIndex)
)) {
  throw new Error("Usage: node scripts/entity-accessibility/verify.mjs [--keep-fixtures | --cleanup <fixture-artifact>]");
}
if (cleanupIndex >= 0 && (keepFixtures || process.argv.length !== cleanupIndex + 2)) {
  throw new Error("--cleanup requires exactly one artifact path and cannot be combined with --keep-fixtures");
}
const environment = JSON.parse(
  execFileSync("npx", ["supabase", "status", "-o", "json"], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  })
);
assert.match(environment.API_URL, /^http:\/\/(127\.0\.0\.1|localhost):\d+$/,
  "Refusing to run against a non-local Supabase API");
const stamp = `${Date.now()}-${randomUUID().slice(0, 8)}`;
const password = `EntityAcceptance-${randomUUID()}!`;
const users = [];
const ids = { entities: {}, events: [], memberships: [], series: [] };
const results = [];
let failed = false;

function sql(statement) {
  return execFileSync("docker", [
    "exec", "supabase_db_Salsa", "psql", "-U", "postgres", "-d", "postgres",
    "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", statement,
  ], { encoding: "utf8" }).trim();
}
function q(value) {
  if (value === null || value === undefined) return "null";
  return `'${String(value).replaceAll("'", "''")}'`;
}
async function request(path, token, body, method = "POST", apikey = environment.ANON_KEY) {
  const response = await fetch(`${environment.API_URL}${path}`, {
    method,
    headers: {
      apikey,
      Authorization: `Bearer ${token ?? apikey}`,
      "Content-Type": "application/json",
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { response, status: response.status, ok: response.ok, data, text };
}
async function rpc(name, token, args, { allowFailure = false } = {}) {
  const result = await request(`/rest/v1/rpc/${name}`, token, args);
  if (!allowFailure) assert.equal(result.ok, true, `${name}: HTTP ${result.status} ${result.text}`);
  return result;
}
function check(label, condition, detail = "") {
  results.push({ label, ok: Boolean(condition), detail: String(detail).slice(0, 300) });
  if (!condition) failed = true;
  assert.ok(condition, `${label}${detail ? `: ${detail}` : ""}`);
}
async function makeUser(role, userMetadata = {}) {
  const email = `entity-${role}-${stamp}-${randomUUID().slice(0, 5)}@example.test`;
  const created = await request("/auth/v1/admin/users", environment.SERVICE_ROLE_KEY, {
    email, password, email_confirm: true,
    ...(role === "admin" ? { app_metadata: { role: "admin" } } : {}),
    user_metadata: userMetadata,
  });
  assert.equal(created.ok, true, `create ${role}: ${created.status} ${created.text}`);
  const user = { id: created.data.id, email, role };
  users.push(user);
  const loggedIn = await request("/auth/v1/token?grant_type=password", null, { email, password });
  assert.equal(loggedIn.ok, true, `login ${role}: ${loggedIn.status} ${loggedIn.text}`);
  user.token = loggedIn.data.access_token;
  return user;
}
function rows(data) {
  if (Array.isArray(data)) return data;
  return data === null || data === undefined ? [] : [data];
}
function entityBySlug(data, slug) {
  const entity = data?.entity;
  return entity?.slug === slug ? entity : null;
}

// Fixture identity is chosen so every database write and cleanup is scoped to
// this invocation. SQL strings contain generated IDs and are quoted above.
const slug = (kind, suffix = "") => `ea-${kind}-${stamp}${suffix}`;
const handleSuffix = stamp.replaceAll("-", "_");
const handles = {
  venue: `ea_venue_${handleSuffix}`,
  organizer: `ea_org_${handleSuffix}`,
  school: `ea_school_${handleSuffix}`,
  instructor: `ea_teacher_${handleSuffix}`,
};
const names = Object.fromEntries(
  ["event", "series", "organizer", "venue", "school", "instructor", "city", "style", "attribute"]
    .map((kind) => [kind, `Entity accessibility ${kind} ${stamp}`])
);
const publicRefs = {};
const entities = {};
let fixtureIds = {};

async function seedFixtures() {
  // A separately-created metro fixture exercises city slug resolution and is
  // removed by its exact generated ID.
  const citySlug = slug("city");
  const sqlResult = sql(`
    with metro as (
      insert into public.metros (slug, name, state_region)
      values (${q(citySlug)}, '${names.city}', 'MA') returning id, slug
    ),
    venue as (
      insert into public.venues (name, slug, address_line1, city, state_region, country, website, instagram, status)
      values ('${names.venue}', ${q(slug("venue"))}, '${stamp} Main Street', '${citySlug}', 'MA', 'US', 'https://venue-${stamp}.example.test', '${handles.venue}', 'active') returning id, slug
    ),
    organizer as (
      insert into public.organizers (name, slug, primary_city, state_region, country, website, instagram, status)
      values ('${names.organizer}', ${q(slug("organizer"))}, '${citySlug}', 'MA', 'US', 'https://organizer-${stamp}.example.test', '${handles.organizer}', 'active') returning id, slug
    ),
    school as (
      insert into public.schools (name, slug, city, state_region, country, website, instagram, phone, status)
      values ('${names.school}', ${q(slug("school"))}, '${citySlug}', 'MA', 'US', 'https://school-${stamp}.example.test', '${handles.school}', '+1-617-555-0188', 'active') returning id, slug
    ),
    instructor as (
      insert into public.instructors (name, slug, city, state_region, country, website, instagram, status)
      values ('${names.instructor}', ${q(slug("instructor"))}, '${citySlug}', 'MA', 'US', 'https://instructor-${stamp}.example.test', '${handles.instructor}', 'active') returning id, slug
    ),
    style as (
      insert into public.taxonomy_terms (category, name, slug, description, status)
      values ('dance_style', '${names.style}', ${q(slug("style"))}, 'public style description', 'active') returning id, slug
    ),
    attribute as (
      insert into public.taxonomy_terms (category, name, slug, description, status)
      values ('event_attribute', '${names.attribute}', ${q(slug("attribute"))}, 'public attribute description', 'active') returning id, slug
    ),
    series as (
      insert into public.event_series (name, slug, description, image_url, status, city)
      values ('${names.series}', ${q(slug("series"))}, 'public series description', null, 'active', '${citySlug}') returning id, slug
    ),
    inactive_venue as (
      insert into public.venues (name, slug, address_line1, city, status)
      values ('Inactive ${names.venue}', ${q(slug("venue", "-inactive"))}, '${stamp} inactive street', '${citySlug}', 'needs_review') returning id
    ),
    inactive_organizer as (
      insert into public.organizers (name, slug, primary_city, status)
      values ('Inactive ${names.organizer}', ${q(slug("organizer", "-inactive"))}, '${citySlug}', 'suspended') returning id
    ),
    inactive_school as (
      insert into public.schools (name, slug, city, status)
      values ('Inactive ${names.school}', ${q(slug("school", "-inactive"))}, '${citySlug}', 'needs_review') returning id
    ),
    inactive_instructor as (
      insert into public.instructors (name, slug, city, status)
      values ('Inactive ${names.instructor}', ${q(slug("instructor", "-inactive"))}, '${citySlug}', 'needs_review') returning id
    ),
    inactive_style as (
      insert into public.taxonomy_terms (category, name, slug, status)
      values ('dance_style', 'Inactive ${names.style}', ${q(slug("style", "-inactive"))}, 'needs_review') returning id
    ),
    inactive_series as (
      insert into public.event_series (name, slug, status, city)
      values ('Inactive ${names.series}', ${q(slug("series", "-inactive"))}, 'needs_review', '${citySlug}') returning id
    ),
    private_active_venue as (
      select id from venue
    ),
    ev_future as (
      insert into public.events (title, description, event_type, event_date, city, location, status, source_type,
        venue_id, organizer_id, series_id, submitter_id, contact_email, contact_website, contact_instagram)
      select 'Entity future ${stamp}', 'future event description', 'social', now() + interval '14 days', '${citySlug}',
        '${names.venue}', 'approved', 'admin', v.id, o.id, s.id, null,
        'private-${stamp}@example.test', 'https://private-${stamp}.example.test', 'private_event_${stamp}'
      from venue v, organizer o, series s returning id
    ),
    ev_past as (
      insert into public.events (title, description, event_type, event_date, city, location, status, source_type,
        venue_id, organizer_id, series_id, submitter_id)
      select 'Entity past ${stamp}', 'past event description', 'social', now() - interval '14 days', '${citySlug}',
        '${names.venue}', 'approved', 'admin', v.id, o.id, s.id, null
      from venue v, organizer o, series s returning id
    ),
    ev_pending as (
      insert into public.events (title, description, event_type, event_date, city, location, status, source_type,
        venue_id, organizer_id, series_id, submitter_id)
      select 'Entity pending ${stamp}', 'pending event description', 'social', now() + interval '7 days', '${citySlug}',
        '${names.venue}', 'pending', 'admin', v.id, o.id, s.id, null
      from venue v, organizer o, series s returning id
    ),
    rel_school as (insert into public.event_schools (event_id, school_id) select e.id, s.id from (select id from ev_future union all select id from ev_past) e cross join (select id from school union all select id from inactive_school) s returning event_id),
    rel_instructor as (insert into public.event_instructors (event_id, instructor_id, position) select e.id, i.id, row_number() over (partition by e.id order by i.id)::integer from (select id from ev_future union all select id from ev_past) e cross join (select id from instructor union all select id from inactive_instructor) i returning event_id),
    rel_style as (insert into public.event_taxonomy_terms (event_id, taxonomy_term_id) select e.id, t.id from (select id from ev_future union all select id from ev_past) e cross join (select id from style union all select id from inactive_style) t returning event_id),
    rel_attribute as (insert into public.event_taxonomy_terms (event_id, taxonomy_term_id) select e.id, attribute.id from (select id from ev_future union all select id from ev_past) e cross join attribute returning event_id)
    select json_build_object(
      'city', (select row_to_json(metro) from metro), 'venue', (select row_to_json(venue) from venue),
      'organizer', (select row_to_json(organizer) from organizer), 'school', (select row_to_json(school) from school),
      'instructor', (select row_to_json(instructor) from instructor), 'style', (select row_to_json(style) from style),
      'attribute', (select row_to_json(attribute) from attribute), 'series', (select row_to_json(series) from series),
      'inactive_venue', (select id from inactive_venue),
      'inactive_organizer', (select id from inactive_organizer),
      'inactive_school', (select id from inactive_school),
      'inactive_instructor', (select id from inactive_instructor),
      'inactive_style', (select id from inactive_style),
      'inactive_series', (select id from inactive_series),
      'events', json_build_array((select id from ev_future), (select id from ev_past), (select id from ev_pending))
    );
  `);
  fixtureIds = JSON.parse(sqlResult);
  for (const kind of ["venue", "organizer", "school", "instructor", "series", "city", "style", "attribute"]) {
    const row = fixtureIds[kind];
    entities[kind] = { id: row.id, slug: row.slug, name: names[kind] };
    ids.entities[kind] = row.id;
  }
  ids.events.push(...fixtureIds.events);
  ids.entities.inactiveVenue = fixtureIds.inactive_venue;
  ids.entities.inactiveOrganizer = fixtureIds.inactive_organizer;
  ids.entities.inactiveSchool = fixtureIds.inactive_school;
  ids.entities.inactiveInstructor = fixtureIds.inactive_instructor;
  ids.entities.inactiveStyle = fixtureIds.inactive_style;
  ids.entities.inactiveSeries = fixtureIds.inactive_series;
  ids.series.push(entities.series.id);
  return citySlug;
}

function assertNoPrivateData(value, needles, label) {
  const text = JSON.stringify(value);
  for (const needle of needles) check(`${label} excludes ${needle}`, !text.includes(needle));
  for (const forbidden of ["contact_email", "contact_website", "contact_instagram", "phone", "source_type", "source_event_id", "source_submission_id", "internal_note", "organizer_members"]) {
    check(`${label} excludes private key ${forbidden}`, !new RegExp(`\\"${forbidden}\\"\\s*:`).test(text));
  }
}

async function verifyPublicSurface(citySlug) {
  const kinds = ["event", "series", "organizer", "venue", "school", "instructor", "city", "style"];
  // Every entity type supports a populated canonical slug, empty slug and miss.
  for (const kind of kinds) {
    const testEntity = kind === "event"
      ? { id: fixtureIds.events[0], slug: slug("event"), name: `Entity future ${stamp}` }
      : entities[kind];
    if (kind === "event") {
      // Event slugs are assigned as fixture IDs by the migration's slug field.
      testEntity.slug = sql(`select slug from public.events where id=${q(testEntity.id)}::uuid`);
      testEntity.name = `Entity future ${stamp}`;
      testEntity.id = fixtureIds.events[0];
    }
    const detail = await rpc("public_entity_detail", null, { p_kind: kind, p_slug: testEntity.slug });
    const entity = entityBySlug(detail.data, testEntity.slug);
    check(`${kind} detail resolves canonical slug`, detail.ok && Boolean(entity), detail.text);
    check(`${kind} empty slug returns no entity`, (await rpc("public_entity_detail", null, { p_kind: kind, p_slug: "" })).data === null);
    check(`${kind} unknown slug returns no entity`, (await rpc("public_entity_detail", null, { p_kind: kind, p_slug: `${testEntity.slug}-missing` })).data === null);
    if (entity) {
      publicRefs[kind] = entity;
      check(`${kind} public entity has stable id/name/slug`, entity.id === testEntity.id && entity.name === testEntity.name && entity.slug === testEntity.slug, JSON.stringify(entity));
      assertNoPrivateData(entity, [`private-${stamp}`, `private_event_${stamp}`, `+1-617-555-0188`], `${kind} entity`);
    }
  }

  const all = await rpc("public_entity_directory", null, { p_kind: null, p_query: stamp, p_city: null, p_limit: 100, p_offset: 0 });
  check("cross-kind directory returns all active fixture entity kinds", all.ok && ["series", "organizer", "venue", "school", "instructor", "city", "style", "attribute"].every((kind) => rows(all.data).some((row) => row.id === entities[kind].id)), all.text);
  const cityFiltered = await rpc("public_entity_directory", null, { p_kind: null, p_query: "", p_city: citySlug, p_limit: 100, p_offset: 0 });
  check("directory city filter matches canonical city and approved associated events", cityFiltered.ok && ["series", "organizer", "venue", "school", "instructor", "style", "attribute"].every((kind) => rows(cityFiltered.data).some((row) => row.id === entities[kind].id)), cityFiltered.text);
  const narrow = await rpc("public_entity_directory", null, { p_kind: "school", p_query: names.school, p_city: citySlug, p_limit: 1, p_offset: 0 });
  check("directory kind/search/city filter and limit work together", narrow.ok && rows(narrow.data).length === 1 && rows(narrow.data)[0].id === entities.school.id, narrow.text);
  const paged = await rpc("public_entity_directory", null, { p_kind: null, p_query: stamp, p_city: null, p_limit: 2, p_offset: 1 });
  check("directory pagination advances deterministically", paged.ok && rows(paged.data).length === 2 && rows(paged.data)[0].id !== rows(all.data)[0]?.id, paged.text);
  const inactive = await rpc("public_entity_detail", null, { p_kind: "venue", p_slug: slug("venue", "-inactive") });
  check("needs_review venue is not publicly resolvable", inactive.data === null, inactive.text);
  const inactiveSearch = await rpc("public_entity_directory", null, { p_kind: "venue", p_query: `Inactive ${names.venue}`, p_city: null, p_limit: 50, p_offset: 0 });
  check("inactive venue is absent from directory", !rows(inactiveSearch.data).some((row) => row.id === fixtureIds.inactive_venue));
  const inactiveFixtures = [
    ["series", slug("series", "-inactive"), fixtureIds.inactive_series],
    ["organizer", slug("organizer", "-inactive"), fixtureIds.inactive_organizer],
    ["school", slug("school", "-inactive"), fixtureIds.inactive_school],
    ["instructor", slug("instructor", "-inactive"), fixtureIds.inactive_instructor],
    ["style", slug("style", "-inactive"), fixtureIds.inactive_style],
  ];
  for (const [kind, inactiveSlug, inactiveId] of inactiveFixtures) {
    const hidden = await rpc("public_entity_detail", null, { p_kind: kind, p_slug: inactiveSlug });
    check(`${kind} inactive entity is not publicly resolvable`, hidden.data === null, hidden.text);
    const directory = await rpc("public_entity_directory", null, { p_kind: kind, p_query: `Inactive ${names[kind]}`, p_city: null, p_limit: 50, p_offset: 0 });
    check(`${kind} inactive entity is absent from its directory`, !rows(directory.data).some((row) => row.id === inactiveId), directory.text);
  }

  // City lifecycle: an archived metro leaves public detail, directory, and
  // the anonymous Data API projection, then is restored for later checks.
  sql(`update public.metros set status='archived' where id=${q(entities.city.id)}::uuid`);
  try {
    check("archived city is not publicly resolvable",
      (await rpc("public_entity_detail", null, { p_kind: "city", p_slug: entities.city.slug })).data === null);
    check("archived city is absent from directory",
      !rows((await rpc("public_entity_directory", null, { p_kind: "city", p_query: stamp, p_city: null, p_limit: 50, p_offset: 0 })).data)
        .some((row) => row.id === entities.city.id));
    const metros = await request(`/rest/v1/metros?id=eq.${entities.city.id}&select=id`, null, undefined, "GET");
    check("anonymous raw metro projection hides archived city", metros.ok && Array.isArray(metros.data) && metros.data.length === 0, `HTTP ${metros.status}`);
  } finally {
    sql(`update public.metros set status='active' where id=${q(entities.city.id)}::uuid`);
  }

  for (const kind of ["event", "series", "organizer", "venue", "school", "instructor", "city", "style"]) {
    const ref = kind === "event" ? { ...publicRefs.event } : publicRefs[kind];
    const detail = (await rpc("public_entity_detail", null, { p_kind: kind, p_slug: ref.slug })).data;
    if (!detail) continue;
    if (["venue", "organizer", "series", "school", "instructor", "style"].includes(kind)) {
      check(`${kind} detail has only approved future and past event summaries`, detail.upcoming?.length === 1 && detail.past?.length === 1 && !JSON.stringify(detail).includes("Entity pending"), JSON.stringify(detail));
      check(`${kind} event relation order is future ascending and past descending`, detail.upcoming?.[0]?.id === fixtureIds.events[0] && detail.past?.[0]?.id === fixtureIds.events[1]);
      assertNoPrivateData(detail.upcoming, [`private-${stamp}`, `private_${stamp}`], `${kind} upcoming events`);
      assertNoPrivateData(detail.past, [`private-${stamp}`, `private_${stamp}`], `${kind} past events`);
    }
  }
  const futureEvent = (await rpc("public_entity_detail", null, { p_kind: "event", p_slug: publicRefs.event?.slug })).data;
  check("event detail is approved-only and has no pending relation", !futureEvent || !JSON.stringify(futureEvent).includes("Entity pending"));

  // Series with zero occurrences: explicit empty lists, still linked to its
  // canonical Venue/Organizer defaults, and visible from the Organizer side.
  const emptySeriesId = sql(`insert into public.event_series(name,slug,status,venue_id,organizer_id)
    values (${q(`Empty series ${stamp}`)}, ${q(slug("series", "-empty"))}, 'active',
      ${q(entities.venue.id)}::uuid, ${q(entities.organizer.id)}::uuid) returning id`);
  fixtureIds.emptySeries = emptySeriesId;
  ids.entities.emptySeries = emptySeriesId;
  try {
    const empty = (await rpc("public_entity_detail", null, { p_kind: "series", p_slug: slug("series", "-empty") })).data;
    check("active Series with no occurrences has empty future and past lists",
      empty?.upcoming?.length === 0 && empty?.past?.length === 0, JSON.stringify(empty));
    check("empty Series still links its canonical Venue and Organizer defaults",
      empty?.related?.some((ref) => ref.id === entities.venue.id) &&
      empty?.related?.some((ref) => ref.id === entities.organizer.id), JSON.stringify(empty?.related));
    const organizer = (await rpc("public_entity_detail", null, { p_kind: "organizer", p_slug: entities.organizer.slug })).data;
    check("Organizer links default-only Series without requiring an occurrence",
      organizer?.related?.some((ref) => ref.id === emptySeriesId), JSON.stringify(organizer?.related));
  } finally {
    sql(`delete from public.event_series where id=${q(emptySeriesId)}::uuid`);
  }
  const schoolDetail = (await rpc("public_entity_detail", null, { p_kind: "school", p_slug: entities.school.slug })).data;
  const instructorDetail = (await rpc("public_entity_detail", null, { p_kind: "instructor", p_slug: entities.instructor.slug })).data;
  check("School and Instructor are related through their approved shared events",
    schoolDetail.related.some((ref) => ref.id === entities.instructor.id) &&
    instructorDetail.related.some((ref) => ref.id === entities.school.id),
    JSON.stringify({ school: schoolDetail.related, instructor: instructorDetail.related }));
  const attributeDetail = await rpc("public_entity_detail", null, { p_kind: "style", p_slug: entities.attribute.slug });
  check("event_attribute term is also addressable through the style kind", attributeDetail.ok && attributeDetail.data?.entity?.category === "event_attribute" && attributeDetail.data.upcoming?.length === 1 && attributeDetail.data.past?.length === 1, attributeDetail.text);
  const eventRows = await request(`/rest/v1/public_events?id=eq.${fixtureIds.events[0]}&select=*`, null, undefined, "GET");
  check("anon reads approved event projection over the Data API", eventRows.ok && Array.isArray(eventRows.data) && eventRows.data.length === 1, eventRows.text);
  const eventProjection = eventRows.data?.[0];
  if (eventProjection) {
    for (const secret of [`private-${stamp}@example.test`, `https://private-${stamp}.example.test`, `private_event_${stamp}`]) {
      check("public_events projection excludes fixture private contact values", !JSON.stringify(eventProjection).includes(secret));
    }
    check("public_events keeps source_type provenance for existing consumers", eventProjection.source_type === "admin", JSON.stringify(eventProjection.source_type));
    check("public_events omits private contact and cancellation keys",
      !["contact_email", "contact_instagram", "contact_website", "cancellation_reason"].some((key) => Object.hasOwn(eventProjection, key)));
    const terms = eventProjection.event_taxonomy_terms ?? [];
    check("public_events exposes both active taxonomy categories", terms.some((item) => item.taxonomy_terms?.id === entities.style.id) && terms.some((item) => item.taxonomy_terms?.id === entities.attribute.id), JSON.stringify(terms));
    check("public_events excludes inactive taxonomy relations", !terms.some((item) => item.taxonomy_terms?.id === fixtureIds.inactive_style));
    check("public_events entity summary does not expose non-dance attributes as styles", !eventProjection.public_entities?.styles?.some((item) => item.id === entities.attribute.id));
    check("public_events omits submitter and internal review metadata", !["submitter_id", "submitter_email", "submitter_name", "entity_review", "internal_note", "reviewed_by", "reviewed_at"].some((key) => Object.hasOwn(eventProjection, key)));
  }
  for (const table of ["events", "event_series", "venues", "schools", "instructors"]) {
    const raw = await request(`/rest/v1/${table}?select=id&limit=1`, null, undefined, "GET");
    check(`anon cannot read raw ${table} rows`, !raw.ok, `HTTP ${raw.status}`);
  }
  const eventEntities = await rpc("public_event_entities", null, { p_event_id: fixtureIds.events[0] });
  check("approved event entity projection adds schools, series, city and styles", eventEntities.ok && eventEntities.data?.series?.id === entities.series.id && eventEntities.data?.city?.slug === citySlug && eventEntities.data?.schools?.some((item) => item.id === entities.school.id) && eventEntities.data?.styles?.some((item) => item.id === entities.style.id), eventEntities.text);
  assertNoPrivateData(eventEntities.data, [`private-${stamp}`, `private_event_${stamp}`], "approved event entity projection");
  const pendingEntities = await rpc("public_event_entities", null, { p_event_id: fixtureIds.events[2] });
  check("pending event exposes no entity projection", pendingEntities.data === null || Object.keys(pendingEntities.data ?? {}).length === 0, pendingEntities.text);
}

async function expectForbidden(label, result) {
  check(`${label} denied with SQLSTATE 42501`, result.status === 401 || result.status === 403, `HTTP ${result.status}: ${result.text}`);
  check(`${label} error identifies insufficient privilege`, /42501|permission denied|not authorized|forbidden/i.test(result.text), result.text);
}
async function verifyAdminAndAuth(admin, ordinary, spoofed) {
  const targets = [
    ["admin_entity_directory", { p_kind: "series", p_query: names.series, p_status: null }],
    ["admin_entity_detail", { p_kind: "series", p_id: entities.series.id }],
    ["admin_entity_save", { p_kind: "series", p_id: null, p_payload: { name: `Unauthorized ${stamp}`, slug: slug("unauthorized") } }],
    ["admin_entity_merge", { p_kind: "series", p_keep_id: entities.series.id, p_merge_id: entities.series.id, p_confirm: true }],
    ["entity_access_events", { p_kind: "series", p_id: entities.series.id }],
    ["entity_access_related", { p_kind: "series", p_id: entities.series.id }],
  ];
  for (const [rpcName, args] of targets) {
    await expectForbidden(`anonymous ${rpcName}`, await rpc(rpcName, null, args, { allowFailure: true }));
    await expectForbidden(`plain user ${rpcName}`, await rpc(rpcName, ordinary.token, args, { allowFailure: true }));
    await expectForbidden(`user_metadata role spoof ${rpcName}`, await rpc(rpcName, spoofed.token, args, { allowFailure: true }));
  }
  const adminDir = await rpc("admin_entity_directory", admin.token, { p_kind: "series", p_query: names.series, p_status: null });
  check("real admin JWT can list series", adminDir.ok && rows(adminDir.data).some((row) => row.id === entities.series.id), adminDir.text);

  // Membership remains an independent authorization boundary. The RPC's
  // Organizer creation is attribution only; it must not provision access.
  const created = await rpc("admin_entity_save", admin.token, { p_kind: "organizer", p_id: null, p_payload: {
    name: `Verifier-created organizer ${stamp}`, slug: slug("organizer", "-created"), status: "active",
    description: "RPC creation must not add any member or role",
  } });
  const organizer = created.data;
  check("admin can create Organizer through admin_entity_save", created.ok && Boolean(organizer?.id), created.text);
  if (organizer?.id) {
    entities.createdOrganizer = { id: organizer.id, slug: organizer.slug, name: organizer.name };
    ids.entities.createdOrganizer = organizer.id;
    const count = sql(`select count(*) from public.organizer_members where organizer_id=${q(organizer.id)}::uuid`);
    check("Organizer creation creates no memberships or roles", count === "0", `membership count=${count}`);
    const memberAccess = await request(`/rest/v1/organizer_members?organizer_id=eq.${organizer.id}&select=user_id`, ordinary.token, undefined, "GET");
    check("ordinary user cannot read any membership rows for created Organizer", !memberAccess.ok || (Array.isArray(memberAccess.data) && memberAccess.data.length === 0), `HTTP ${memberAccess.status} data=${JSON.stringify(memberAccess.data)}`);
  }

  const candidates = {
    venue: {
      name: names.venue, address: `${stamp} Main Street`, city: entities.city.slug,
      state_region: "MA", country: "US",
    },
    organizer: { name: names.organizer, instagram: handles.organizer },
    instructors: [{ name: names.instructor, instagram: handles.instructor }],
    school: { name: names.school, city: entities.city.slug, state_region: "MA", website: `https://school-${stamp}.example.test` },
  };
  const matched = await rpc("reconcile_flyer_entities", admin.token, { p_candidates: candidates });
  for (const [kind, expectedId] of [
    ["venue", entities.venue.id], ["organizer", entities.organizer.id],
    ["school", entities.school.id], ["instructor", entities.instructor.id],
  ]) {
    const item = kind === "instructor" ? matched.data?.instructors?.[0] : matched.data?.[kind];
    check(`${kind} strong corroborated duplicate reuses existing canonical entity`,
      item?.state === "MATCHED" && item?.selected_id === expectedId && item?.decision === "existing",
      JSON.stringify(item));
  }
  for (const kind of ["series", "organizer", "school", "instructor"]) {
    const duplicate = await rpc("admin_entity_save", admin.token, {
      p_kind: kind,
      p_id: null,
      p_payload: { name: names[kind], city: entities.city.slug },
    }, { allowFailure: true });
    check(`${kind} canonical save rejects exact duplicate instead of creating another row`, !duplicate.ok, duplicate.text);
    const count = sql(`select count(*) from public.${kind === "series" ? "event_series" : kind === "organizer" ? "organizers" : kind === "school" ? "schools" : "instructors"} where lower(name)=lower(${q(names[kind])})`);
    check(`${kind} duplicate rejection preserves single canonical row`, count === "1", `row count=${count}`);
  }
  const nameOnly = await rpc("reconcile_flyer_entities", admin.token, {
    p_candidates: {
      venue: { name: names.venue }, organizer: null, instructors: [], school: null,
    },
  });
  check("name-only potential duplicate remains pending for explicit ambiguous review",
    nameOnly.data?.venue?.decision === "pending" && nameOnly.data?.venue?.selected_id == null,
    JSON.stringify(nameOnly.data?.venue));
  check("organizer reconciliation does not grant membership to caller",
    sql(`select count(*) from public.organizer_members where organizer_id=${q(entities.organizer.id)}::uuid and user_id=${q(admin.id)}::uuid`) === "0");
  if (entities.createdOrganizer) {
    const createdCount = sql(`select count(*) from public.organizer_members where organizer_id=${q(entities.createdOrganizer.id)}::uuid`);
    check("RPC-created Organizer still has no memberships after reconciliation", createdCount === "0", createdCount);
  }
  for (const kind of ["organizer", "school", "instructor"]) {
    const candidate = kind === "instructor" ? { name: names.instructor } : { name: names[kind] };
    const ambiguousReview = await rpc("reconcile_flyer_entities", admin.token, {
      p_candidates: {
        venue: null, organizer: kind === "organizer" ? candidate : null,
        instructors: kind === "instructor" ? [candidate] : [],
        school: kind === "school" ? candidate : null,
      },
    });
    const item = kind === "instructor" ? ambiguousReview.data?.instructors?.[0] : ambiguousReview.data?.[kind];
    check(`${kind} uncorroborated duplicate review is unresolved`, item?.decision === "pending" && item?.selected_id == null, JSON.stringify(item));
  }
}

async function verifySeriesDefaults(admin) {
  const seriesId = entities.series.id;
  const venueId = entities.venue.id;
  const organizerId = entities.organizer.id;
  // Deliberately clear only this fixture Series defaults before the writes.
  sql(`update public.event_series set venue_id=null, organizer_id=null where id=${q(seriesId)}::uuid`);
  const review = { venue: { decision: "existing", selected_id: venueId }, organizer: { decision: "existing", selected_id: organizerId }, instructors: [], school: null };
  const draftBase = {
    title: `Series defaults ${stamp}`, description: null, event_type: "social", city: entities.city.slug,
    event_date: "2099-01-01T20:00:00Z", event_time: "20:00", location: "Manually selected event location",
    address: "Manual event address", price_type: "free", price_amount: null, rsvp_link: null, image_url: null,
    recurrence: null, host: null, contact_email: null, contact_instagram: null, contact_website: null,
    venue_id: null, organizer_id: null, series_id: seriesId, taxonomy_term_ids: [], entity_review: review,
  };
  const created = await rpc("save_event_with_entities", admin.token, { p_event_id: null, p_payload: draftBase, p_publish: false });
  ids.events.push(created.data);
  const defaults = JSON.parse(sql(`select json_build_object('venue_id', venue_id, 'organizer_id', organizer_id) from public.event_series where id=${q(seriesId)}::uuid`));
  check("empty Series defaults inherit canonical resolved venue and organizer", defaults.venue_id === venueId && defaults.organizer_id === organizerId, JSON.stringify(defaults));
  const manualVenue = fixtureIds.manualVenueId = sql(`insert into public.venues(name,slug,status) values ('Manual series venue ${stamp}',${q(slug("venue", "-manual"))},'active') returning id`);
  const manualOrganizer = fixtureIds.manualOrganizerId = sql(`insert into public.organizers(name,slug,status) values ('Manual series organizer ${stamp}',${q(slug("organizer", "-manual"))},'active') returning id`);
  ids.entities.manualVenue = manualVenue;
  ids.entities.manualOrganizer = manualOrganizer;
  sql(`update public.event_series set venue_id=${q(manualVenue)}::uuid, organizer_id=${q(manualOrganizer)}::uuid where id=${q(seriesId)}::uuid`);
  const next = { ...draftBase, title: `Series defaults preserve manual ${stamp}`, venue_id: venueId, organizer_id: organizerId };
  const saved = await rpc("save_event_with_entities", admin.token, { p_event_id: null, p_payload: next, p_publish: false });
  ids.events.push(saved.data);
  const preserved = JSON.parse(sql(`select json_build_object('venue_id', venue_id, 'organizer_id', organizer_id) from public.event_series where id=${q(seriesId)}::uuid`));
  check("manual Series defaults are never overwritten by event canonical links", preserved.venue_id === manualVenue && preserved.organizer_id === manualOrganizer, JSON.stringify(preserved));
  const eventLinks = JSON.parse(sql(`select json_build_object('venue_id',venue_id,'organizer_id',organizer_id) from public.events where id=${q(saved.data)}::uuid`));
  check("manually selected event links survive Series defaults", eventLinks.venue_id === venueId && eventLinks.organizer_id === organizerId, JSON.stringify(eventLinks));
}

async function verifyAdminLifecycle(admin) {
  const kind = "school";
  const school = entities[kind];
  const original = JSON.parse(sql(`select row_to_json(s) from public.schools s where id=${q(school.id)}::uuid`));
  const editedWebsite = `https://edited-${stamp}.example.test`;
  const updated = await rpc("admin_entity_save", admin.token, {
    p_kind: kind, p_id: school.id, p_payload: { name: school.name, website: editedWebsite },
  });
  check("admin edits entity without changing existing slug", updated.ok && updated.data?.slug === school.slug && updated.data?.website === editedWebsite, updated.text);
  check("admin edit preserves event-school relationships", sql(`select count(*) from public.event_schools where school_id=${q(school.id)}::uuid`) === "2");
  for (const entityKind of ["series", "organizer", "school", "instructor"]) {
    const identity = entities[entityKind];
    const changedSlug = await rpc("admin_entity_save", admin.token, {
      p_kind: entityKind, p_id: identity.id, p_payload: { slug: `${identity.slug}-renamed` },
    }, { allowFailure: true });
    check(`${entityKind} save rejects replacement of an existing public URL`,
      !changedSlug.ok && changedSlug.data?.code === "22023", changedSlug.text);
    const originalUrl = await rpc("public_entity_detail", null, { p_kind: entityKind, p_slug: identity.slug });
    check(`${entityKind} rejected slug edit preserves its canonical public URL`,
      originalUrl.data?.entity?.id === identity.id);
  }
  const archive = await rpc("admin_entity_save", admin.token, {
    p_kind: kind, p_id: school.id, p_payload: { status: "archived" },
  });
  check("admin archives instead of deleting linked entity", archive.ok && archive.data?.status === "archived" && sql(`select count(*) from public.schools where id=${q(school.id)}::uuid`) === "1", archive.text);
  check("archived entity is absent from public detail", (await rpc("public_entity_detail", null, { p_kind: kind, p_slug: school.slug })).data === null);
  const restored = await rpc("admin_entity_save", admin.token, {
    p_kind: kind, p_id: school.id, p_payload: { name: school.name, status: "active", website: original.website },
  });
  check("fixture school is restored active for browser smoke", restored.data?.status === "active" && restored.data?.website === original.website);
  const keep = entities.instructor;
  const donorSlug = slug("instructor", "-donor");
  const donorId = sql(`insert into public.instructors(name,slug,status) values ('Merge donor ${stamp}',${q(donorSlug)},'active') returning id`);
  ids.entities.mergeDonor = donorId;
  sql(`insert into public.event_instructors(event_id,instructor_id,position) values (${q(fixtureIds.events[0])}::uuid,${q(donorId)}::uuid,9)`);
  const merged = await rpc("admin_entity_merge", admin.token, {
    p_kind: "instructor", p_keep_id: keep.id, p_merge_id: donorId, p_confirm: true,
  });
  check("confirmed instructor merge transfers event links and archives donor",
    merged.ok &&
      sql(`select count(*) from public.event_instructors where event_id=${q(fixtureIds.events[0])}::uuid and instructor_id=${q(keep.id)}::uuid`) === "1" &&
      sql(`select count(*) from public.event_instructors where instructor_id=${q(donorId)}::uuid`) === "0" &&
      sql(`select status from public.instructors where id=${q(donorId)}::uuid`) === "archived",
    merged.text);

  const organizer = entities.createdOrganizer;
  if (organizer?.id) {
    const donor = await rpc("admin_entity_save", admin.token, {
      p_kind: "organizer", p_id: null,
      p_payload: { name: `Member donor ${stamp}`, slug: slug("organizer", "-member-donor"), status: "active" },
    });
    if (donor.data?.id) {
      ids.entities.memberDonor = donor.data.id;
      sql(`insert into public.organizer_members(organizer_id,user_id,member_role,status) values (${q(donor.data.id)}::uuid,${q(admin.id)}::uuid,'owner','active')`);
      const refused = await rpc("admin_entity_merge", admin.token, {
        p_kind: "organizer", p_keep_id: organizer.id, p_merge_id: donor.data.id, p_confirm: true,
      }, { allowFailure: true });
      check("Organizer merge refuses donor with members", !refused.ok, refused.text);
      check("refused Organizer merge leaves membership on donor",
        sql(`select count(*) from public.organizer_members where organizer_id=${q(donor.data.id)}::uuid`) === "1");
    }
  }
  const unconfirmedDonor = sql(`insert into public.instructors(name,slug,status) values ('Unconfirmed donor ${stamp}',${q(slug("instructor", "-unconfirmed"))},'active') returning id`);
  ids.entities.unconfirmedDonor = unconfirmedDonor;
  const unconfirmed = await rpc("admin_entity_merge", admin.token, {
    p_kind: "instructor", p_keep_id: keep.id, p_merge_id: unconfirmedDonor, p_confirm: false,
  }, { allowFailure: true });
  check("merge requires explicit confirmation",
    !unconfirmed.ok && sql(`select status from public.instructors where id=${q(unconfirmedDonor)}::uuid`) === "active",
    unconfirmed.text);
}

async function persistKeptFixture(citySlug, auth) {
  const path = `/tmp/salsa-entity-accessibility-${stamp}.json`;
  const content = JSON.stringify({
    generatedAt: new Date().toISOString(),
    apiUrl: environment.API_URL,
    citySlug,
    publicSlugs: Object.fromEntries(Object.entries(entities).map(([kind, row]) => [kind, row.slug])),
    publicRefs,
    ids,
    fixtureIds,
    auth: auth.map(({ role, id, email }) => ({ role, id, email, password })),
  }, null, 2) + "\n";
  await writeFile(path, content, { mode: 0o600 });
  await chmod(path, 0o600);
  return path;
}
async function cleanup() {
  const hasFixtures = ids.events.length > 0 || Object.keys(ids.entities).length > 0;
  if (hasFixtures) {
    try {
      // Delete the occurrence-less default Series first: the guard trigger
      // blocks Organizer deletion while any Series still references it.
      if (fixtureIds.emptySeries) sql(`delete from public.event_series where id=${q(fixtureIds.emptySeries)}::uuid`);
      const eventIn = ids.events.map(q).join(",");
      if (ids.events.length) {
        sql(`delete from public.event_taxonomy_terms where event_id in (${eventIn})`);
        sql(`delete from public.event_schools where event_id in (${eventIn})`);
        sql(`delete from public.event_instructors where event_id in (${eventIn})`);
        sql(`delete from public.events where id in (${eventIn})`);
      }
      for (const [kind, table] of [["instructor", "instructors"], ["school", "schools"], ["series", "event_series"], ["organizer", "organizers"], ["venue", "venues"], ["style", "taxonomy_terms"], ["attribute", "taxonomy_terms"], ["city", "metros"]]) {
        const id = entities[kind]?.id;
        if (!id) continue;
        if (kind === "organizer") sql(`delete from public.organizer_members where organizer_id=${q(id)}::uuid`);
        sql(`delete from public.${table} where id=${q(id)}::uuid`);
      }
      for (const [id, table] of [
        [fixtureIds.inactive_venue, "venues"], [fixtureIds.inactive_organizer, "organizers"],
        [fixtureIds.inactive_school, "schools"], [fixtureIds.inactive_instructor, "instructors"],
        [fixtureIds.inactive_series, "event_series"], [fixtureIds.inactive_style, "taxonomy_terms"],
        [fixtureIds.manualVenueId, "venues"], [fixtureIds.manualOrganizerId, "organizers"],
        [ids.entities.createdOrganizer, "organizers"], [ids.entities.memberDonor, "organizers"],
        [ids.entities.mergeDonor, "instructors"], [ids.entities.unconfirmedDonor, "instructors"],
      ]) {
        if (!id) continue;
        if (table === "organizers") sql(`delete from public.organizer_members where organizer_id=${q(id)}::uuid`);
        sql(`delete from public.${table} where id=${q(id)}::uuid`);
      }
    } catch (error) {
      console.error(`Fixture database cleanup failed: ${error instanceof Error ? error.message : String(error)}`);
      failed = true;
    }
  }
  for (const user of users) {
    try {
      // admin_entity_* writes audit_logs rows with the actor FK set to NO
      // ACTION, which blocks GoTrue's user delete; drop test-actor audit rows.
      sql(`delete from public.audit_logs where actor_id=${q(user.id)}::uuid`);
      const deleted = await request(`/auth/v1/admin/users/${user.id}`, environment.SERVICE_ROLE_KEY, undefined, "DELETE");
      if (!deleted.ok) throw new Error(`HTTP ${deleted.status}`);
    } catch (error) {
      console.error(`Auth fixture cleanup failed for ${user.id}: ${error instanceof Error ? error.message : String(error)}`);
      failed = true;
    }
  }
}

async function cleanupSavedFixture(artifactPath) {
  const artifact = JSON.parse(await readFile(artifactPath, "utf8"));
  assert.match(artifact.apiUrl, /^http:\/\/(127\.0\.0\.1|localhost):\d+$/);
  assert.equal(artifact.apiUrl, environment.API_URL, "Fixture artifact belongs to a different local Supabase API");
  const saved = artifact.ids;
  const eventIds = saved.events ?? [];
  if (eventIds.length) {
    const eventIn = eventIds.map(q).join(",");
    sql(`delete from public.event_taxonomy_terms where event_id in (${eventIn})`);
    sql(`delete from public.event_schools where event_id in (${eventIn})`);
    sql(`delete from public.event_instructors where event_id in (${eventIn})`);
    sql(`delete from public.events where id in (${eventIn})`);
  }
  const entityIds = saved.entities ?? {};
  const errors = [];
  const remove = (table, keys) => {
    for (const key of keys) {
      const id = entityIds[key];
      if (!id) continue;
      try {
        if (table === "organizers") sql(`delete from public.organizer_members where organizer_id=${q(id)}::uuid`);
        sql(`delete from public.${table} where id=${q(id)}::uuid`);
      } catch (error) {
        errors.push(`${table}.${key}: ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`);
      }
    }
  };
  remove("event_series", ["series", "inactiveSeries", "emptySeries"]);
  remove("instructors", ["instructor", "inactiveInstructor", "mergeDonor", "unconfirmedDonor"]);
  remove("schools", ["school", "inactiveSchool"]);
  remove("organizers", ["organizer", "createdOrganizer", "memberDonor", "manualOrganizer", "inactiveOrganizer"]);
  remove("venues", ["venue", "manualVenue", "inactiveVenue"]);
  remove("taxonomy_terms", ["style", "attribute", "inactiveStyle"]);
  remove("metros", ["city"]);
  for (const user of artifact.auth ?? []) {
    try {
      sql(`delete from public.audit_logs where actor_id=${q(user.id)}::uuid`);
      const deleted = await request(`/auth/v1/admin/users/${user.id}`, environment.SERVICE_ROLE_KEY, undefined, "DELETE");
      if (!deleted.ok) throw new Error(`HTTP ${deleted.status}`);
    } catch (error) {
      errors.push(`auth ${user.id}: ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`);
    }
  }
  if (errors.length) throw new Error(`Cleanup incomplete; artifact kept for retry: ${errors.join(" | ")}`);
  await unlink(artifactPath);
  console.log(JSON.stringify({ cleanedFixtureArtifact: artifactPath }));
}

if (cleanupIndex >= 0) {
  try {
    await cleanupSavedFixture(resolve(process.argv[cleanupIndex + 1]));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
} else {
  let auth = [];
  let citySlug;
  let fixtureArtifactPath = null;
  try {
    const admin = await makeUser("admin");
    const ordinary = await makeUser("user");
    const spoofed = await makeUser("spoofed", { role: "admin", is_admin: true });
    auth = [admin, ordinary, spoofed];
    citySlug = await seedFixtures(admin.id);
    await verifyPublicSurface(citySlug);
    await verifyAdminAndAuth(admin, ordinary, spoofed);
    await verifySeriesDefaults(admin);
    await verifyAdminLifecycle(admin);
    if (keepFixtures) fixtureArtifactPath = await persistKeptFixture(citySlug, auth);
    console.log(JSON.stringify({ ok: !failed, keepFixtures, fixtureArtifactPath, checks: results }, null, 2));
  } catch (error) {
    console.error(JSON.stringify({ ok: false, keepFixtures, checks: results, error: error instanceof Error ? error.message : String(error) }, null, 2));
    failed = true;
  } finally {
    if (!keepFixtures || failed) await cleanup();
  }
  if (failed) process.exitCode = 1;
}
