import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Real-local proof for the event composer persistence boundary. Uses the running
// Supabase stack only; it never resets or migrates the database.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const environment = JSON.parse(
  execFileSync("npx", ["supabase", "status", "-o", "json"], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  })
);
assert.match(
  environment.API_URL,
  /^http:\/\/(127\.0\.0\.1|localhost):\d+$/,
  "Refusing to run against a non-local Supabase API"
);
assert.ok(environment.ANON_KEY && environment.SERVICE_ROLE_KEY, "Local Supabase keys are required");

const stamp = `${Date.now()}-${randomUUID().slice(0, 8)}`;
const password = `Composer-${randomUUID()}!`;
const users = [];
const eventIds = [];
const entityIds = {};
const q = (value) => `'${String(value).replaceAll("'", "''")}'`;

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
      "-q",
      "-t",
      "-A",
      "-c",
      statement,
    ],
    { encoding: "utf8" }
  ).trim();
}

async function request(path, options = {}) {
  const { token = environment.ANON_KEY, apikey = environment.ANON_KEY, method, body } = options;
  const requestMethod = method ?? (body === undefined ? "GET" : "POST");
  if (body !== undefined && (requestMethod === "GET" || requestMethod === "HEAD")) {
    throw new Error(`${requestMethod} request cannot include a body`);
  }
  const response = await fetch(`${environment.API_URL}${path}`, {
    method: requestMethod,
    headers: { apikey, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { response, status: response.status, ok: response.ok, data, text };
}

async function makeUser(role) {
  const email = `event-composer-${role}-${stamp}@example.test`;
  const created = await request("/auth/v1/admin/users", {
    token: environment.SERVICE_ROLE_KEY,
    body: {
      email,
      password,
      email_confirm: true,
      ...(role === "admin" ? { app_metadata: { role: "admin" } } : {}),
    },
  });
  assert.equal(created.ok, true, `create ${role}: ${created.status} ${created.text}`);
  const user = { id: created.data.id, email, role };
  users.push(user);
  const loggedIn = await request("/auth/v1/token?grant_type=password", {
    body: { email, password },
    method: "POST",
  });
  assert.equal(loggedIn.ok, true, `login ${role}: ${loggedIn.status} ${loggedIn.text}`);
  user.token = loggedIn.data.access_token;
  return user;
}

async function rpc(token, args, { expectSuccess = true } = {}) {
  const result = await request("/rest/v1/rpc/save_event_with_entities", {
    token,
    method: "POST",
    body: args,
  });
  if (expectSuccess)
    assert.equal(result.ok, true, `save_event_with_entities: ${result.status} ${result.text}`);
  return result;
}

async function publicRows(query) {
  const result = await request(`/rest/v1/public_events?${query}`);
  assert.equal(result.ok, true, `public_events: ${result.status} ${result.text}`);
  return result.data;
}

async function createEntities() {
  const slug = (kind) => `composer-${kind}-${stamp}`;
  const result = JSON.parse(
    sql(`
    with venue as (
      insert into public.venues(name,slug,address_line1,city,state_region,country,status)
      values (${q(`Composer Venue ${stamp}`)},${q(slug("venue"))},${q(`${stamp} Main Street`)},'new-york-city','NY','US','active') returning id
    ), organizer as (
      insert into public.organizers(name,slug,primary_city,state_region,country,status)
      values (${q(`Composer Organizer ${stamp}`)},${q(slug("organizer"))},'new-york-city','NY','US','active') returning id
    ), school as (
      insert into public.schools(name,slug,city,state_region,country,status)
      values (${q(`Composer School ${stamp}`)},${q(slug("school"))},'new-york-city','NY','US','active') returning id
    ), instructor as (
      insert into public.instructors(name,slug,city,state_region,country,status)
      values (${q(`Composer Instructor ${stamp}`)},${q(slug("instructor"))},'new-york-city','NY','US','active') returning id
    ), series as (
      insert into public.event_series(name,slug,status,city)
      values (${q(`Composer Series ${stamp}`)},${q(slug("series"))},'active','new-york-city') returning id
    )
    select json_build_object('venue',(select id from venue),'organizer',(select id from organizer),
      'school',(select id from school),'instructor',(select id from instructor),'series',(select id from series))
  `)
  );
  Object.assign(entityIds, result);
}

function eventPayload(title) {
  return {
    title,
    description: `Composer integration fixture ${stamp}`,
    event_type: "social",
    city: "new-york-city",
    event_date: "2099-10-08T23:00:00Z",
    event_time: "19:00",
    location: `Composer Hall ${stamp}`,
    address: `${stamp} Main Street, New York, NY`,
    price_type: "free",
    price_amount: null,
    rsvp_link: null,
    host: null,
    image_url: null,
    recurrence: null,
    contact_email: null,
    contact_instagram: null,
    contact_website: null,
    taxonomy_term_ids: [],
    venue_id: null,
    organizer_id: null,
    series_id: entityIds.series,
    entity_review: {
      venue: { decision: "existing", selected_id: entityIds.venue },
      organizer: { decision: "existing", selected_id: entityIds.organizer },
      instructors: [{ decision: "existing", selected_id: entityIds.instructor }],
      school: { decision: "existing", selected_id: entityIds.school },
    },
  };
}

let failed = false;
try {
  const admin = await makeUser("admin");
  const ordinary = await makeUser("ordinary");
  await createEntities();

  const anonymousDenied = await rpc(
    environment.ANON_KEY,
    {
      p_event_id: null,
      p_payload: eventPayload(`Composer unauthorized anon ${stamp}`),
      p_publish: true,
    },
    { expectSuccess: false }
  );
  assert.ok(anonymousDenied.status >= 400, "anonymous publication must be denied");

  const ordinaryDenied = await rpc(
    ordinary.token,
    {
      p_event_id: null,
      p_payload: eventPayload(`Composer unauthorized user ${stamp}`),
      p_publish: true,
    },
    { expectSuccess: false }
  );
  assert.ok(ordinaryDenied.status >= 400, "ordinary-user publication must be denied");

  const draftResult = await rpc(admin.token, {
    p_event_id: null,
    p_payload: eventPayload(`Composer private draft ${stamp}`),
    p_publish: false,
  });
  const draftId = draftResult.data;
  assert.match(
    draftId,
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    "draft save returns event UUID"
  );
  eventIds.push(draftId);
  assert.deepEqual(
    await publicRows(`id=eq.${encodeURIComponent(draftId)}&select=id,slug`),
    [],
    "draft must not be visible in public_events"
  );

  const publishResult = await rpc(admin.token, {
    p_event_id: null,
    p_payload: eventPayload(`Composer published ${stamp}`),
    p_publish: true,
  });
  const publishedId = publishResult.data;
  assert.match(
    publishedId,
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    "publish save returns event UUID"
  );
  eventIds.push(publishedId);

  const stored = JSON.parse(
    sql(`select json_build_object(
    'status',e.status,'venue_id',e.venue_id,'organizer_id',e.organizer_id,'series_id',e.series_id,
    'instructor_ids',(select coalesce(json_agg(instructor_id order by position),'[]'::json) from public.event_instructors where event_id=e.id),
    'school_ids',(select coalesce(json_agg(school_id),'[]'::json) from public.event_schools where event_id=e.id)
  ) from public.events e where e.id=${q(publishedId)}::uuid`)
  );
  assert.equal(stored.status, "approved", "publication status persisted");
  assert.equal(stored.venue_id, entityIds.venue, "canonical venue link persisted");
  assert.equal(stored.organizer_id, entityIds.organizer, "canonical organizer link persisted");
  assert.equal(stored.series_id, entityIds.series, "series link persisted");
  assert.deepEqual(
    stored.instructor_ids,
    [entityIds.instructor],
    "instructor relationship persisted in the RPC transaction"
  );
  assert.deepEqual(
    stored.school_ids,
    [entityIds.school],
    "school relationship persisted in the RPC transaction"
  );

  const visible = await publicRows(
    `id=eq.${encodeURIComponent(publishedId)}&select=id,slug,title,status,event_date,city`
  );
  assert.equal(
    visible.length,
    1,
    "published event must appear in the anonymous public detail projection"
  );
  assert.equal(visible[0].status, "approved");
  assert.equal(visible[0].title, `Composer published ${stamp}`);
  assert.ok(visible[0].slug, "public detail projection supplies a slug");
  const detail = await publicRows(
    `slug=eq.${encodeURIComponent(visible[0].slug)}&select=id,slug,title`
  );
  assert.equal(detail[0]?.id, publishedId, "anonymous slug lookup resolves published event detail");
  const calendar = await publicRows(
    `city=eq.new-york-city&event_date=gte.${encodeURIComponent(new Date().toISOString())}&id=eq.${encodeURIComponent(publishedId)}&select=id`
  );
  assert.equal(
    calendar[0]?.id,
    publishedId,
    "anonymous upcoming calendar query includes published event"
  );

  console.log(
    "PASS: denied anonymous/ordinary publication; private draft; admin atomic entity links; anonymous public detail and calendar reads."
  );
} catch (error) {
  failed = true;
  throw error;
} finally {
  const cleanupErrors = [];
  if (eventIds.length) {
    const ids = eventIds.map(q).join(",");
    try {
      sql(
        `delete from public.event_taxonomy_terms where event_id in (${ids}); delete from public.event_schools where event_id in (${ids}); delete from public.event_instructors where event_id in (${ids}); delete from public.events where id in (${ids});`
      );
    } catch (error) {
      cleanupErrors.push(`events: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  for (const [key, table] of [
    ["series", "event_series"],
    ["instructor", "instructors"],
    ["school", "schools"],
    ["organizer", "organizers"],
    ["venue", "venues"],
  ]) {
    if (!entityIds[key]) continue;
    try {
      sql(`delete from public.${table} where id=${q(entityIds[key])}::uuid`);
    } catch (error) {
      cleanupErrors.push(`${table}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  for (const user of users) {
    try {
      sql(`delete from public.audit_logs where actor_id=${q(user.id)}::uuid`);
    } catch (error) {
      cleanupErrors.push(
        `audit logs for ${user.id}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
    try {
      const removed = await request(`/auth/v1/admin/users/${user.id}`, {
        token: environment.SERVICE_ROLE_KEY,
        method: "DELETE",
      });
      if (!removed.ok) throw new Error(`HTTP ${removed.status} ${removed.text}`);
    } catch (error) {
      cleanupErrors.push(
        `auth user ${user.id}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  if (cleanupErrors.length) {
    console.error(
      `Event composer fixture cleanup incomplete${failed ? " after test failure" : ""}: ${cleanupErrors.join(" | ")}`
    );
    process.exitCode = 1;
  }
}
