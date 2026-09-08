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
  // Do NOT insert the profiles row here. The on_auth_user_created trigger
  // (handle_new_user) already created it, and its `on conflict (id) do
  // nothing` means a second insert would silently no-op — masking a broken
  // or absent trigger instead of surfacing it. Assert the real signup
  // behaviour provisioned the row.
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

  // 2. User A cannot update User B (cross-user). PostgREST returns 200 with
  //    an empty representation when RLS matches no row, so assert BOTH that
  //    zero rows came back AND that B's row still exists unchanged. The
  //    previous form (`bRow?.display_name !== "Pwned by A"`) also passed
  //    when bRow was null, letting a missing row satisfy the assertion.
  const resCross = await updateAs(a, { display_name: "Pwned by A" }, b.id);
  const crossBody = resCross.ok ? await resCross.json().catch(() => null) : null;
  expect(
    "User A's cross-user PATCH affects zero rows",
    resCross.status >= 400 || (Array.isArray(crossBody) && crossBody.length === 0),
    `status=${resCross.status} body=${JSON.stringify(crossBody)}`
  );
  // Read B's row with trusted access — A cannot read it (asserted later), so
  // reading "as B" is what proves the row still exists and is untouched.
  const bRow = await readAs(b);
  expect(
    "User B's row still exists after A's attempt",
    bRow != null && bRow.__status === undefined && bRow.id === b.id,
    JSON.stringify(bRow)
  );
  expect(
    "User B's display_name is unchanged",
    bRow != null && bRow.display_name !== "Pwned by A",
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

  // 6. updated_at is stamped by the real profiles_set_updated_at trigger.
  //    The trigger uses now(), which is fixed for the life of a transaction,
  //    so it cannot be observed to advance inside one transaction and an
  //    UPDATE-based "backdating" would just be overwritten by the trigger.
  //    Each PostgREST request is its own transaction, so comparing across
  //    two requests is the deterministic way to assert it — with the real
  //    trigger left intact.
  const beforeStamp = psql(
    `select updated_at from public.profiles where id = '${a.id}';`
  );
  const resStamp = await updateAs(a, { display_name: "Alice Stamped" });
  const afterStamp = psql(
    `select updated_at from public.profiles where id = '${a.id}';`
  );
  expect(
    "Owner update is stamped by profiles_set_updated_at (strictly newer)",
    resStamp.status === 200 &&
      beforeStamp !== "" &&
      afterStamp !== "" &&
      new Date(afterStamp).getTime() > new Date(beforeStamp).getTime(),
    `before=${beforeStamp} after=${afterStamp} status=${resStamp.status}`
  );

  // 7. A null display_name write is rejected outright by the
  //    profiles_reject_display_name_blanking trigger
  //    (20260830000002), while pre-existing null rows stay readable
  //    (asserted separately below).
  const resNull = await updateAs(a, { display_name: null });
  const aAfterNull = await readAs(a);
  expect(
    "Writing a null display_name is rejected",
    resNull.status >= 400,
    `status=${resNull.status}`
  );
  expect(
    "Stored display_name survives the rejected null write",
    aAfterNull != null && aAfterNull.display_name === "Alice Stamped",
    JSON.stringify(aAfterNull)
  );

  // 8. Clearing the photo (avatar_url -> null) is an allowed owner edit.
  const resClear = await updateAs(a, { avatar_url: null });
  const aCleared = await readAs(a);
  expect(
    "Owner can clear their photo (avatar_url -> null)",
    resClear.status === 200 && aCleared != null && aCleared.avatar_url === null,
    `status=${resClear.status} row=${JSON.stringify(aCleared)}`
  );

  // 9. A legacy row whose display_name was never set stays readable by its
  //    owner — the Phase 6 CHECK must not have broken historical rows.
  //    Seeded by DELETE + INSERT, not UPDATE: the new blanking guard
  //    (20260830000002) correctly refuses a non-null -> null UPDATE, so a
  //    genuine "never had a name" row has to be constructed as an insert.
  //    Nothing is disabled to achieve this.
  psql(
    `delete from public.profiles where id = '${b.id}';
     insert into public.profiles (id, display_name, role) values ('${b.id}', null, 'user');`
  );
  const bLegacy = await readAs(b);
  expect(
    "Legacy null-display_name row remains readable by its owner",
    bLegacy != null && bLegacy.__status === undefined && bLegacy.display_name === null,
    JSON.stringify(bLegacy)
  );
  // And such a row must still be updatable in other columns — the guard
  // only forbids erasing an established name.
  const legacyPhoto = await updateAs(b, { avatar_url: "https://cdn.test/legacy.png" });
  const bLegacyAfter = await readAs(b);
  expect(
    "Legacy null-name row is still updatable in other columns",
    legacyPhoto.status === 200 &&
      bLegacyAfter != null &&
      bLegacyAfter.avatar_url === "https://cdn.test/legacy.png" &&
      bLegacyAfter.display_name === null,
    `status=${legacyPhoto.status} row=${JSON.stringify(bLegacyAfter)}`
  );

  // 10. The trusted admin path must still work after Phase 6's revoke +
  //     column-level re-grant. In this codebase that path is NOT a direct
  //     service_role table write — service_role has never held table
  //     privileges on public.profiles (no migration grants them), so a
  //     direct PATCH is 403 by design. Privileged writes go through
  //     SECURITY DEFINER RPCs owned by postgres. Verify one end to end
  //     with a real admin JWT.
  const adminEmail = `phase6-admin-${stamp}@example.test`;
  const adminRes = await fetch(`${env.API_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: env.SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: adminEmail,
      password,
      email_confirm: true,
      app_metadata: { role: "admin" },
    }),
  });
  const adminUser = await adminRes.json();
  created.push(adminUser.id);
  const adminTokenRes = await fetch(`${env.API_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: env.ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email: adminEmail, password }),
  });
  const adminToken = (await adminTokenRes.json()).access_token;

  const beforeTrusted = psql(
    `select updated_at from public.profiles where id = '${b.id}';`
  );
  const rpc = await fetch(`${env.API_URL}/rest/v1/rpc/admin_set_user_status`, {
    method: "POST",
    headers: {
      apikey: env.ANON_KEY,
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_user_id: b.id, p_status: "flagged", p_reason: "phase6 check" }),
  });
  const bStatus = psql(
    `select status from public.profiles where id = '${b.id}';`
  );
  const afterTrusted = psql(
    `select updated_at from public.profiles where id = '${b.id}';`
  );
  expect(
    "Trusted admin RPC can still write privileged columns (status)",
    rpc.status < 300 && bStatus === "flagged",
    `status=${rpc.status} stored=${bStatus}`
  );
  expect(
    "Trusted admin RPC write also advances updated_at",
    beforeTrusted !== "" &&
      afterTrusted !== "" &&
      new Date(afterTrusted).getTime() > new Date(beforeTrusted).getTime(),
    `before=${beforeTrusted} after=${afterTrusted}`
  );
  expect(
    "A non-admin cannot call the trusted admin RPC",
    (
      await fetch(`${env.API_URL}/rest/v1/rpc/admin_set_user_status`, {
        method: "POST",
        headers: {
          apikey: env.ANON_KEY,
          Authorization: `Bearer ${a.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ p_user_id: b.id, p_status: "banned" }),
      })
    ).status >= 400,
    "non-admin RPC call must be rejected"
  );

  console.log(JSON.stringify({ results, exitCode }));
} catch (err) {
  console.log(
    JSON.stringify({ error: err?.message ?? String(err), results, exitCode: 1 })
  );
  exitCode = 1;
} finally {
  // Fixtures must leave nothing behind. auth.users deletion is blocked by
  // audit_logs.actor_id (the trusted admin RPC writes an audit row), so the
  // child rows have to go first or the admin user survives teardown.
  for (const id of created) {
    try {
      psql(`delete from public.audit_logs where actor_id = '${id}';`);
    } catch {
      // No audit rows for this fixture, or already gone.
    }
    await fetch(`${env.API_URL}/auth/v1/admin/users/${id}`, {
      method: "DELETE",
      headers: { apikey: env.SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SERVICE_ROLE_KEY}` },
    });
  }
  const leaked = psql(
    `select count(*) from auth.users where email like 'phase6-%@example.test';`
  );
  if (leaked !== "0") {
    console.error(`WARNING: ${leaked} fixture user(s) survived teardown`);
    exitCode = 1;
  }
  process.exit(exitCode);
}
