// Verifies the Phase 1B event_submissions email-enforcement trigger contract.
//
// Tests the BEFORE INSERT trigger `event_submissions_normalize_email` that
// ensures authenticated submissions always use the caller's trusted Auth email,
// while preserving anonymous submission behavior.
//
// Run with: node verify-submission-email-enforcement.mjs
// Requires: supabase start (local stack running on ports 54321/54322)

import { execFileSync } from "node:child_process";

const lines = execFileSync("npx", ["supabase", "status", "-o", "env"], {
  cwd: new URL("../..", import.meta.url),
  encoding: "utf8",
}).split("\n");
const env = Object.fromEntries(
  lines.flatMap((line) => {
    const match = line.match(/^(API_URL|ANON_KEY|SERVICE_ROLE_KEY)=(.*)$/);
    return match ? [[match[1], match[2].replace(/^"|"$/g, "")]] : [];
  })
);

const password = "Phase1BEmailEnforcement!1";
const stamp = Date.now();
const users = [
  { id: null, email: `phase1b-a-${stamp}@example.test`, token: null },
  { id: null, email: `phase1b-b-${stamp}@example.test`, token: null },
];
const created = [];
const cleanedSubmissions = [];

function psql(statement) {
  return execFileSync(
    "docker",
    [
      "exec",
      "supabase_db_Salsa",
      "psql",
      "-v",
      "ON_ERROR_STOP=1",
      "-t",
      "-A",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-c",
      statement,
    ],
    { encoding: "utf8" }
  ).trim();
}

async function createUser(user) {
  const res = await fetch(`${env.API_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: env.ANON_KEY,
      Authorization: `Bearer ${env.SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email: user.email, password, email_confirm: true }),
  });
  if (!res.ok) throw new Error(`create:${res.status}`);
  const { id } = await res.json();
  user.id = id;
  created.push(id);

  // Verify the profiles row was provisioned by the on_auth_user_created trigger.
  const provisioned = psql(
    `select count(*) from public.profiles where id = '${id}';`
  );
  if (provisioned !== "1") {
    throw new Error(
      `handle_new_user did not provision a profiles row for ${id} (count=${provisioned})`
    );
  }

  const token = await fetch(`${env.API_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: env.ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email: user.email, password }),
  });
  if (!token.ok) throw new Error(`token:${token.status}`);
  const tokenJson = await token.json();
  user.token = tokenJson.access_token;
}

function insertSubmissionAs(userToken, payload) {
  return fetch(`${env.API_URL}/rest/v1/event_submissions`, {
    method: "POST",
    headers: {
      apikey: env.ANON_KEY,
      Authorization: `Bearer ${userToken}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(payload),
  });
}

function insertAnonSubmission(payload) {
  return fetch(`${env.API_URL}/rest/v1/event_submissions`, {
    method: "POST",
    headers: {
      apikey: env.ANON_KEY,
      Authorization: `Bearer ${env.ANON_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(payload),
  });
}

const results = [];
let exitCode = 0;
function expect(label, condition, detail) {
  if (condition) {
    results.push({ label, status: "ok", detail });
  } else {
    results.push({ label, status: "FAIL", detail });
    exitCode = 1;
  }
}

async function insertWithServiceRole(payload) {
  const res = await fetch(`${env.API_URL}/rest/v1/event_submissions`, {
    method: "POST",
    headers: {
      apikey: env.ANON_KEY,
      Authorization: `Bearer ${env.SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(payload),
  });
  const data = res.ok ? await res.json() : null;
  if (data) cleanedSubmissions.push(data[0]?.id);
  return res;
}

function cleanupSubmission(id) {
  if (!id) return;
  try {
    psql(`delete from public.event_submissions where id = '${id}';`);
  } catch {
    // Best-effort
  }
}

try {
  await createUser(users[0]);
  await createUser(users[1]);
  const [a, b] = users;

  // ─── 1. ANONYMOUS: name + email preserved, submitter_id null ───
  const anonPayload = {
    submitter_id: null,
    submitter_name: "Anonymous Dancer",
    submitter_email: "anon@example.com",
    status: "pending",
    submitted_data: { title: "Anon Event", event_type: "social", city: "boston", event_date: "2026-09-20T20:00:00Z" },
    edited_data: null,
    reviewed_by: null,
    reviewed_at: null,
    rejection_reason: null,
    rejection_message: null,
    internal_note: null,
    duplicate_of_event_id: null,
    dismissed_duplicate_ids: [],
    approved_event_id: null,
  };
  const anonRes = await insertAnonSubmission(anonPayload);
  expect(
    "Anonymous: Name + Email preserved (submitter_name)",
    anonRes.status === 201 || anonRes.status === 200,
    `status=${anonRes.status}`
  );
  if (anonRes.ok) {
    const anonRow = await anonRes.json();
    const stored = psql(
      `select submitter_id, submitter_email, submitter_name from public.event_submissions where id = '${anonRow[0].id}';`
    );
    const [sid, email, name] = stored.split("|");
    expect(
      "Anonymous: submitter_id is NULL",
      sid === "" || sid === null,
      `submitter_id=${sid}`
    );
    expect(
      "Anonymous: submitter_email preserved as user-entered",
      email === "anon@example.com",
      `submitter_email=${email}`
    );
    expect(
      "Anonymous: submitter_name preserved as user-entered",
      name === "Anonymous Dancer",
      `submitter_name=${name}`
    );
    cleanedSubmissions.push(anonRow[0].id);
  }

  // ─── 2. AUTHENTICATED: correct uid + correct email → succeeds ───
  const authOkPayload = {
    submitter_id: a.id,
    submitter_email: a.email,
    submitter_name: "Alice Phase1B",
    status: "pending",
    submitted_data: { title: "Auth Event", event_type: "social", city: "boston", event_date: "2026-09-20T20:00:00Z" },
    edited_data: null,
    reviewed_by: null,
    reviewed_at: null,
    rejection_reason: null,
    rejection_message: null,
    internal_note: null,
    duplicate_of_event_id: null,
    dismissed_duplicate_ids: [],
    approved_event_id: null,
  };
  const authOkRes = await insertSubmissionAs(a.token, authOkPayload);
  expect(
    "Authenticated: correct uid + correct email succeeds",
    authOkRes.status === 200 || authOkRes.status === 201,
    `status=${authOkRes.status}`
  );

  // ─── 3. AUTHENTICATED: correct uid + spoofed email → email normalized ───
  const spoofedPayload = {
    submitter_id: a.id,
    submitter_email: "attacker-controlled@example.com",
    submitter_name: "Alice Spoof",
    status: "pending",
    submitted_data: { title: "Spoofed Email Event", event_type: "social", city: "boston", event_date: "2026-09-20T20:00:00Z" },
    edited_data: null,
    reviewed_by: null,
    reviewed_at: null,
    rejection_reason: null,
    rejection_message: null,
    internal_note: null,
    duplicate_of_event_id: null,
    dismissed_duplicate_ids: [],
    approved_event_id: null,
  };
  const spoofRes = await insertSubmissionAs(a.token, spoofedPayload);
  expect(
    "Authenticated: spoofed email insert is accepted (trigger normalizes)",
    spoofRes.status === 200 || spoofRes.status === 201,
    `status=${spoofRes.status}`
  );
  if (spoofRes.ok) {
    const spoofRow = await spoofRes.json();
    const stored = psql(
      `select submitter_email from public.event_submissions where id = '${spoofRow[0].id}';`
    );
    expect(
      "Authenticated: stored email is the trusted Auth email, not spoofed",
      stored === a.email.toLowerCase(),
      `stored=${stored} expected=${a.email.toLowerCase()}`
    );
    cleanedSubmissions.push(spoofRow[0].id);
  }

  // ─── 4. AUTHENTICATED: another user's submitter_id → denied by RLS ───
  const crossPayload = {
    submitter_id: b.id,
    submitter_email: b.email,
    submitter_name: "Alice as Bob",
    status: "pending",
    submitted_data: { title: "Cross-user Event", event_type: "social", city: "boston", event_date: "2026-09-20T20:00:00Z" },
    edited_data: null,
    reviewed_by: null,
    reviewed_at: null,
    rejection_reason: null,
    rejection_message: null,
    internal_note: null,
    duplicate_of_event_id: null,
    dismissed_duplicate_ids: [],
    approved_event_id: null,
  };
  const crossRes = await insertSubmissionAs(a.token, crossPayload);
  expect(
    "Authenticated: other user's submitter_id is DENIED",
    crossRes.status >= 400,
    `status=${crossRes.status}`
  );

  // ─── 5. AUTHENTICATED: submitter_id = NULL, token present → trigger sets it ───
  const nullIdPayload = {
    submitter_id: null,
    submitter_email: "should-be-overwritten@example.com",
    submitter_name: "Auto ID",
    status: "pending",
    submitted_data: { title: "Null ID Event", event_type: "social", city: "boston", event_date: "2026-09-20T20:00:00Z" },
    edited_data: null,
    reviewed_by: null,
    reviewed_at: null,
    rejection_reason: null,
    rejection_message: null,
    internal_note: null,
    duplicate_of_event_id: null,
    dismissed_duplicate_ids: [],
    approved_event_id: null,
  };
  const nullIdRes = await insertSubmissionAs(a.token, nullIdPayload);
  expect(
    "Authenticated: null submitter_id insert succeeds (trigger fills auth.uid())",
    nullIdRes.status === 200 || nullIdRes.status === 201,
    `status=${nullIdRes.status}`
  );
  if (nullIdRes.ok) {
    const nullIdRow = await nullIdRes.json();
    const storedId = psql(
      `select submitter_id, submitter_email from public.event_submissions where id = '${nullIdRow[0].id}';`
    );
    const [sid, email] = storedId.split("|");
    expect(
      "Authenticated: null submitter_id was set to auth.uid()",
      sid === a.id,
      `submitter_id=${sid} expected=${a.id}`
    );
    expect(
      "Authenticated: submitter_email is trusted Auth email, not client value",
      email === a.email.toLowerCase(),
      `submitter_email=${email} expected=${a.email.toLowerCase()}`
    );
    cleanedSubmissions.push(nullIdRow[0].id);
  }

  // ─── 6. Anonymous user cannot read auth.users through trigger ───
  // Verify: the function has no EXECUTE grant, so anon cannot call it directly.
  const rpcRes = await fetch(`${env.API_URL}/rest/v1/rpc/normalize_authenticated_submission_email`, {
    method: "POST",
    headers: {
      apikey: env.ANON_KEY,
      Authorization: `Bearer ${a.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(""),
  });
  expect(
    "Authenticated: cannot call trigger function directly via RPC (no execute grant)",
    rpcRes.status >= 400,
    `status=${rpcRes.status}`
  );

  console.log(JSON.stringify({ results, exitCode }));
} catch (err) {
  console.log(
    JSON.stringify({ error: err?.message ?? String(err), results, exitCode: 1 })
  );
  exitCode = 1;
} finally {
  for (const id of cleanedSubmissions) {
    cleanupSubmission(id);
  }
  for (const id of created) {
    try {
      psql(`delete from public.audit_logs where actor_id = '${id}';`);
    } catch {
      // No audit rows, or already gone
    }
    await fetch(`${env.API_URL}/auth/v1/admin/users/${id}`, {
      method: "DELETE",
      headers: {
        apikey: env.ANON_KEY,
        Authorization: `Bearer ${env.SERVICE_ROLE_KEY}`,
      },
    });
  }
  const leaked = psql(
    `select count(*) from auth.users where email like 'phase1b-%@example.test';`
  );
  if (leaked !== "0") {
    console.error(`WARNING: ${leaked} fixture user(s) survived teardown`);
    exitCode = 1;
  }
  process.exit(exitCode);
}
