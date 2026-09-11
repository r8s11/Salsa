// Simulates the full client-side profile save flow against local Supabase
// using the same REST API calls the browser would make, then verifies
// the persisted values via a fresh REST read and a fresh auth session.
// Run with: node verify-browser-save.mjs

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

const password = "Phase6BrowserPassword!1";
const stamp = Date.now();
const email = `phase6-browser-${stamp}@example.test`;

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

const created = [];
async function adminApi(path, init = {}) {
  const res = await fetch(`${env.API_URL}/auth/v1/admin/${path}`, {
    ...init,
    headers: {
      apikey: env.SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  return res;
}

async function restAs(token, path, init = {}) {
  return fetch(`${env.API_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: env.ANON_KEY,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init.headers ?? {}),
    },
  });
}

const results = [];
let exitCode = 0;
function expect(label, condition, detail) {
  results.push({
    label,
    status: condition ? "ok" : "FAIL",
    detail: detail ?? "",
  });
  if (!condition) exitCode = 1;
}

try {
  // 1. Create a real authenticated user (simulates sign-up).
  const createdRes = await adminApi("users", {
    method: "POST",
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  if (!createdRes.ok) throw new Error(`create:${createdRes.status}`);
  const { id: userId } = await createdRes.json();
  created.push(userId);
  psql(
    `insert into public.profiles (id, display_name) values ('${userId}', 'Original Maria') on conflict (id) do update set display_name = excluded.display_name;`
  );

  // 2. Sign in and obtain an access token (simulates login).
  const tokenRes = await fetch(`${env.API_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: env.ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!tokenRes.ok) throw new Error(`token:${tokenRes.status}`);
  const { access_token: token } = await tokenRes.json();

  // 3. Read the initial profile state via the same query ProfileEditPage uses.
  const initialRes = await restAs(token, `profiles?id=eq.${userId}&select=id,display_name,username,avatar_url,status,status_reason,created_at`);
  const initial = (await initialRes.json())[0];
  expect(
    "Initial fetch returns the original display_name",
    initial?.display_name === "Original Maria",
    JSON.stringify(initial)
  );

  // 4. Save the new display_name and avatar_url using the same PATCH
  //    the client makes (only those two fields, never username).
  const saveRes = await restAs(token, `profiles?id=eq.${userId}`, {
    method: "PATCH",
    body: JSON.stringify({
      display_name: "Renamed Maria",
      avatar_url: "https://cdn.test/maria.png",
    }),
  });
  expect(
    "Profile save returns 200 with the updated row",
    saveRes.status === 200,
    `status=${saveRes.status}`
  );
  const saved = (await saveRes.json())[0];
  expect(
    "Returned row reflects new display_name and avatar_url",
    saved?.display_name === "Renamed Maria" &&
      saved?.avatar_url === "https://cdn.test/maria.png",
    JSON.stringify(saved)
  );
  expect(
    "Returned row does not contain a username change (column was not in payload)",
    saved?.username === null,
    JSON.stringify(saved)
  );

  // 5. Re-read the profile after a fresh sign-in (simulates /profile/edit
  //    reload). The new values must persist.
  const tokenRes2 = await fetch(`${env.API_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: env.ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const { access_token: token2 } = await tokenRes2.json();
  const reloadRes = await restAs(token2, `profiles?id=eq.${userId}&select=id,display_name,username,avatar_url,status,status_reason,created_at`);
  const reloaded = (await reloadRes.json())[0];
  expect(
    "After reload, the new display_name is persisted",
    reloaded?.display_name === "Renamed Maria",
    JSON.stringify(reloaded)
  );
  expect(
    "After reload, the new avatar_url is persisted",
    reloaded?.avatar_url === "https://cdn.test/maria.png",
    JSON.stringify(reloaded)
  );

  // 6. Failed save: a save with an empty display_name is rejected and
  //    the previous value is preserved.
  const failedRes = await restAs(token2, `profiles?id=eq.${userId}`, {
    method: "PATCH",
    body: JSON.stringify({ display_name: "" }),
  });
  expect(
    "Empty display_name save is rejected by the database",
    failedRes.status !== 200,
    `status=${failedRes.status}`
  );
  const afterFailedRes = await restAs(token2, `profiles?id=eq.${userId}&select=display_name`);
  const afterFailed = (await afterFailedRes.json())[0];
  expect(
    "After a failed empty save, the previous display_name is still in storage",
    afterFailed?.display_name === "Renamed Maria",
    JSON.stringify(afterFailed)
  );

  // 7. /profile/edit and /profile/edit/:eventId co-existence is a
  //    routing concern verified by ProfileEditPage.test.tsx and
  //    UserEventEditPage.test.tsx. Here we just confirm the API rows
  //    remain consistent with the readonly contract.
  expect(
    "Username is still null (not part of the editable contract)",
    reloaded?.username === null,
    JSON.stringify(reloaded)
  );

  console.log(JSON.stringify({ results, exitCode }));
} catch (err) {
  console.log(
    JSON.stringify({
      error: err?.message ?? String(err),
      results,
      exitCode: 1,
    })
  );
  exitCode = 1;
} finally {
  for (const id of created) {
    await adminApi(`users/${id}`, { method: "DELETE" });
  }
  process.exit(exitCode);
}
