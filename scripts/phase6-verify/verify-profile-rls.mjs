// Verifies the Phase 6 profile owner-update RLS contract against the
// local Supabase stack with two real authenticated users.
// Run with: node verify-profile-rls.mjs

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

const password = "Phase6RLSPassword!1";
const stamp = Date.now();
const users = [
  { id: null, email: `phase6-a-${stamp}@example.test`, token: null },
  { id: null, email: `phase6-b-${stamp}@example.test`, token: null },
];
const created = [];

function psql(statement) {
  execFileSync(
    "docker",
    [
      "exec",
      "supabase_db_Salsa",
      "psql",
      "-v",
      "ON_ERROR_STOP=1",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-c",
      statement,
    ],
    { stdio: "ignore" }
  );
}

async function createUser(user) {
  const res = await fetch(`${env.API_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: env.SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email: user.email, password, email_confirm: true }),
  });
  if (!res.ok) throw new Error(`create:${res.status}`);
  const { id } = await res.json();
  user.id = id;
  created.push(id);
  psql(`insert into public.profiles (id) values ('${id}') on conflict (id) do nothing;`);
  const token = await fetch(`${env.API_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: env.ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email: user.email, password }),
  });
  if (!token.ok) throw new Error(`token:${token.status}`);
  const tokenJson = await token.json();
  user.token = tokenJson.access_token;
}

async function updateAs(user, body, otherUserId = null) {
  const filterId = otherUserId ?? user.id;
  return fetch(`${env.API_URL}/rest/v1/profiles?id=eq.${filterId}`, {
    method: "PATCH",
    headers: {
      apikey: env.ANON_KEY,
      Authorization: `Bearer ${user.token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(body),
  });
}

async function readAs(user, otherId = null) {
  const filterId = otherId ?? user.id;
  const res = await fetch(
    `${env.API_URL}/rest/v1/profiles?id=eq.${filterId}&select=display_name,avatar_url,username,role,status,status_reason,id`,
    {
      headers: { apikey: env.ANON_KEY, Authorization: `Bearer ${user.token}` },
    }
  );
  if (!res.ok) return { __status: res.status };
  const rows = await res.json();
  return rows[0] ?? null;
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

try {
  await createUser(users[0]);
  await createUser(users[1]);
  const [a, b] = users;

  // 1. User A can update their own display_name and avatar_url.
  const resA = await updateAs(a, {
    display_name: "Alice Phase6",
    avatar_url: "https://cdn.test/alice.png",
  });
  expect(
    "User A can update own display_name + avatar_url",
    resA.status === 200 || resA.status === 204,
    `status=${resA.status}`
  );
  const aRow = await readAs(a);
  expect(
    "User A row reflects new display_name + avatar_url",
    aRow?.display_name === "Alice Phase6" && aRow?.avatar_url === "https://cdn.test/alice.png",
    JSON.stringify(aRow)
  );

  // 2. User A cannot update User B (cross-user). The REST API may
  //    return 200/204 with 0 rows updated; the assertion is that B's
  //    row is unchanged.
  const resCross = await updateAs(a, { display_name: "Pwned by A" }, b.id);
  const bRow = await readAs(b);
  expect(
    "User A cannot update User B's row (B's display_name is unchanged)",
    bRow?.display_name !== "Pwned by A",
    JSON.stringify(bRow)
  );

  // 3. User A cannot update their own or another row's role / status /
  //    status_reason / username through the Phase 6 client path.
  const privilegedFields = ["role", "status", "status_reason", "username"];
  for (const field of privilegedFields) {
    const value =
      field === "role"
        ? "admin"
        : field === "status"
          ? "banned"
          : field === "username"
            ? "hijacked"
            : "x";
    const res = await updateAs(a, { [field]: value });
    expect(
      `User A cannot update own ${field} (column-level privilege blocks it)`,
      res.status !== 200,
      `status=${res.status} field=${field}`
    );
  }
  const aAfter = await readAs(a);
  expect(
    "User A's privileged fields remain unchanged in storage",
    aAfter?.role === "user" &&
      aAfter?.status === "active" &&
      aAfter?.username !== "hijacked",
    JSON.stringify(aAfter)
  );

  // 4. Empty display_name is rejected by the database policy.
  const resEmpty = await updateAs(a, { display_name: "" });
  expect(
    "User A cannot save an empty display_name (DB CHECK constraint)",
    resEmpty.status !== 200,
    `status=${resEmpty.status}`
  );
  const aAfterEmpty = await readAs(a);
  expect(
    "User A's display_name is unchanged after empty save",
    aAfterEmpty?.display_name === "Alice Phase6",
    JSON.stringify(aAfterEmpty)
  );

  // 5. User A cannot read User B's row.
  const bReadByA = await readAs(a, b.id);
  expect(
    "User A cannot read User B's row via the profiles REST API",
    bReadByA == null || (bReadByA.__status !== undefined && bReadByA.__status !== 200),
    JSON.stringify(bReadByA)
  );

  console.log(JSON.stringify({ results, exitCode }));
} catch (err) {
  console.log(
    JSON.stringify({ error: err?.message ?? String(err), results, exitCode: 1 })
  );
  exitCode = 1;
} finally {
  for (const id of created) {
    await fetch(`${env.API_URL}/auth/v1/admin/users/${id}`, {
      method: "DELETE",
      headers: { apikey: env.SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SERVICE_ROLE_KEY}` },
    });
  }
  process.exit(exitCode);
}
