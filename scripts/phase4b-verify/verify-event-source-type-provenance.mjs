// Verifies the Phase 4B events.source_type provenance contract against the
// local Supabase stack. It never targets production credentials.
//
// Run with: node scripts/phase4b-verify/verify-event-source-type-provenance.mjs
// Requires: supabase start (local stack running on ports 54321/54322)

import { execFileSync } from "node:child_process";

const repoRoot = new URL("../..", import.meta.url);
let env;
try {
  const lines = execFileSync("npx", ["supabase", "status", "-o", "env"], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 15000,
  }).split("\n");
  env = Object.fromEntries(
    lines.flatMap((line) => {
      const match = line.match(/^(API_URL|ANON_KEY|SERVICE_ROLE_KEY)=(.*)$/);
      return match ? [[match[1], match[2].replace(/^"|"$/g, "")]] : [];
    })
  );
} catch (error) {
  console.log("DB_VERIFICATION_NOT_RUN: local Supabase status unavailable");
  console.log(error instanceof Error ? error.message : String(error));
  process.exitCode = 2;
}

if (!env?.API_URL || !env.ANON_KEY || !env.SERVICE_ROLE_KEY) {
  if (process.exitCode !== 2) {
    console.log("DB_VERIFICATION_NOT_RUN: Supabase status did not expose required local keys");
    process.exitCode = 2;
  }
} else {
  const password = "Phase4BProvenance!1";
  const stamp = Date.now();
  const users = [
    { role: "user", email: `phase4b-user-${stamp}@example.test`, id: null, token: null },
    { role: "admin", email: `phase4b-admin-${stamp}@example.test`, id: null, token: null },
    { role: "moderator", email: `phase4b-mod-${stamp}@example.test`, id: null, token: null },
    { role: "organizer", email: `phase4b-org-${stamp}@example.test`, id: null, token: null },
  ];
  const eventIds = [];
  const submissionIds = [];
  const organizerIds = [];
  const results = [];
  let exitCode = 0;
  let notRun = false;

  function expect(label, condition, detail) {
    if (condition) {
      results.push({ label, status: "PASS", detail });
    } else {
      results.push({ label, status: "FAIL", detail });
      exitCode = 1;
    }
  }

  function markNotRun(label, detail) {
    results.push({ label, status: "NOT RUN", detail });
    notRun = true;
  }

  function authHeaders(token) {
    return {
      apikey: env.ANON_KEY,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  }

  async function request(path, { token = env.SERVICE_ROLE_KEY, method = "GET", body } = {}) {
    const response = await fetch(`${env.API_URL}${path}`, {
      method,
      headers: authHeaders(token),
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    return { response, data, text };
  }

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
    const result = await request("/auth/v1/admin/users", {
      method: "POST",
      token: env.SERVICE_ROLE_KEY,
      body: {
        email: user.email,
        password,
        email_confirm: true,
        app_metadata: { role: user.role },
      },
    });
    if (!result.response.ok)
      throw new Error(`create ${user.role}: HTTP ${result.response.status} ${result.text}`);
    user.id = result.data.id;

    const tokenResult = await request("/auth/v1/token?grant_type=password", {
      method: "POST",
      token: env.ANON_KEY,
      body: { email: user.email, password },
    });
    if (!tokenResult.response.ok) {
      throw new Error(
        `token ${user.role}: HTTP ${tokenResult.response.status} ${tokenResult.text}`
      );
    }
    user.token = tokenResult.data.access_token;
  }

  async function insertEvent(userToken, sourceType, status = "pending", submitterId = null) {
    const result = await request("/rest/v1/events?select=id,source_type,created_at", {
      method: "POST",
      token: userToken,
      body: {
        title: `Phase 4B ${sourceType} ${Date.now()}`,
        event_type: "social",
        event_date: "2099-01-01T20:00:00Z",
        city: "boston",
        status,
        source_type: sourceType,
        submitter_id: submitterId,
      },
    });
    if (result.response.ok && Array.isArray(result.data) && result.data[0]?.id) {
      eventIds.push(result.data[0].id);
    }
    return result;
  }

  async function patchEvent(userToken, id, body) {
    return request(`/rest/v1/events?id=eq.${id}`, {
      method: "PATCH",
      token: userToken,
      body,
    });
  }

  async function createSubmission(user) {
    const result = await request("/rest/v1/event_submissions?select=id", {
      method: "POST",
      token: env.SERVICE_ROLE_KEY,
      body: {
        submitter_id: user.id,
        submitter_email: user.email,
        submitter_name: "Phase 4B verifier",
        status: "pending",
        submitted_data: {
          title: `Phase 4B approval ${Date.now()}`,
          event_type: "social",
          city: "boston",
          event_date: "2099-01-01T20:00:00Z",
        },
        edited_data: null,
        rejection_reason: null,
        rejection_message: null,
        internal_note: null,
        duplicate_of_event_id: null,
        dismissed_duplicate_ids: [],
        approved_event_id: null,
      },
    });
    if (result.response.ok && Array.isArray(result.data) && result.data[0]?.id) {
      submissionIds.push(result.data[0].id);
    }
    return result;
  }

  async function cleanup() {
    try {
      if (eventIds.length)
        psql(
          `delete from public.events where id in (${eventIds.map((id) => `'${id}'`).join(",")});`
        );
      if (submissionIds.length) {
        psql(
          `delete from public.event_submissions where id in (${submissionIds.map((id) => `'${id}'`).join(",")});`
        );
      }
      if (organizerIds.length) {
        psql(
          `delete from public.organizer_members where organizer_id in (${organizerIds.map((id) => `'${id}'`).join(",")});`
        );
        psql(
          `delete from public.organizers where id in (${organizerIds.map((id) => `'${id}'`).join(",")});`
        );
      }
      for (const user of users.filter((candidate) => candidate.id)) {
        await request(`/auth/v1/admin/users/${user.id}`, {
          method: "DELETE",
          token: env.SERVICE_ROLE_KEY,
        });
      }
    } catch (error) {
      console.log(`Cleanup warning: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  try {
    for (const user of users) await createUser(user);
    const [user, admin, moderator, organizer] = users;

    const anonUserSubmission = await insertEvent(env.ANON_KEY, "user_submission");
    expect(
      "ANON pending user_submission allowed",
      anonUserSubmission.response.status === 201,
      `status=${anonUserSubmission.response.status}`
    );

    const anonModerator = await insertEvent(env.ANON_KEY, "moderator");
    expect(
      "ANON pending moderator denied",
      anonModerator.response.status >= 400,
      `status=${anonModerator.response.status}`
    );

    const authenticatedUserSubmission = await insertEvent(
      user.token,
      "user_submission",
      "pending",
      user.id
    );
    expect(
      "AUTHENTICATED pending user_submission allowed",
      authenticatedUserSubmission.response.status === 201,
      `status=${authenticatedUserSubmission.response.status}`
    );

    const authenticatedModerator = await insertEvent(user.token, "moderator", "pending", user.id);
    expect(
      "AUTHENTICATED direct moderator denied",
      authenticatedModerator.response.status >= 400,
      `status=${authenticatedModerator.response.status}`
    );

    const adminEvent = await insertEvent(admin.token, "admin", "approved", admin.id);
    expect(
      "ADMIN direct admin allowed",
      adminEvent.response.status === 201,
      `status=${adminEvent.response.status}`
    );

    const moderatorImport = await insertEvent(
      moderator.token,
      "imported",
      "approved",
      moderator.id
    );
    expect(
      "MODERATOR direct imported allowed",
      moderatorImport.response.status === 201,
      `status=${moderatorImport.response.status}`
    );

    const adminModerator = await insertEvent(admin.token, "moderator", "approved", admin.id);
    expect(
      "ADMIN direct moderator denied",
      adminModerator.response.status >= 400,
      `status=${adminModerator.response.status}`
    );

    if (authenticatedUserSubmission.response.ok && authenticatedUserSubmission.data?.[0]?.id) {
      const submitterPatch = await patchEvent(user.token, authenticatedUserSubmission.data[0].id, {
        source_type: "moderator",
      });
      expect(
        "SUBMITTER UPDATE source_type moderator denied",
        submitterPatch.response.status >= 400,
        `status=${submitterPatch.response.status}`
      );
    } else {
      markNotRun(
        "SUBMITTER UPDATE source_type moderator denied",
        "authenticated fixture insert was not available"
      );
    }

    if (adminEvent.response.ok && adminEvent.data?.[0]?.id) {
      const adminPatch = await patchEvent(admin.token, adminEvent.data[0].id, {
        source_type: "moderator",
      });
      expect(
        "ADMIN UPDATE source_type moderator denied",
        adminPatch.response.status >= 400,
        `status=${adminPatch.response.status}`
      );
    } else {
      markNotRun(
        "ADMIN UPDATE source_type moderator denied",
        "admin fixture insert was not available"
      );
    }

    const submission = await createSubmission(user);
    if (submission.response.status === 201 && submission.data?.[0]?.id) {
      const approval = await request("/rest/v1/rpc/approve_event_submission", {
        method: "POST",
        token: moderator.token,
        body: { p_submission_id: submission.data[0].id, p_taxonomy_term_ids: [] },
      });
      if (approval.response.status === 404) {
        markNotRun(
          "APPROVAL RPC",
          "approve_event_submission is not installed in this local database"
        );
      } else {
        expect(
          "APPROVAL RPC succeeds",
          approval.response.status === 200,
          `status=${approval.response.status} body=${approval.text}`
        );
        const approvalEventId =
          typeof approval.data === "string" ? approval.data : approval.data?.[0]?.id;
        if (approval.response.ok && approvalEventId) {
          eventIds.push(approvalEventId);
          const stored = await request(
            `/rest/v1/events?id=eq.${approvalEventId}&select=id,source_type,created_at`,
            { token: env.SERVICE_ROLE_KEY }
          );
          const row = stored.data?.[0];
          expect(
            "APPROVAL result source_type moderator",
            row?.source_type === "moderator",
            JSON.stringify(row)
          );
          expect(
            "APPROVAL result created_at populated",
            typeof row?.created_at === "string",
            JSON.stringify(row)
          );

          const forgedAfterApproval = await patchEvent(moderator.token, approvalEventId, {
            source_type: "moderator",
          });
          expect(
            "DIRECT caller cannot mutate approval provenance",
            forgedAfterApproval.response.status >= 400,
            `status=${forgedAfterApproval.response.status}`
          );
        } else {
          markNotRun(
            "APPROVAL result provenance checks",
            "approval RPC did not return an event id"
          );
        }
      }
    } else {
      markNotRun(
        "APPROVAL RPC",
        `submission fixture failed with status=${submission.response.status}`
      );
    }

    const organizerExists = psql(
      "select to_regclass('public.organizers') is not null and to_regclass('public.organizer_members') is not null;"
    );
    if (organizerExists === "t") {
      const organizerInsert = await request("/rest/v1/organizers?select=id", {
        method: "POST",
        token: env.SERVICE_ROLE_KEY,
        body: { name: `Phase 4B Organizer ${stamp}`, status: "active" },
      });
      const organizerId = organizerInsert.data?.[0]?.id;
      if (organizerInsert.response.ok && organizerId) {
        organizerIds.push(organizerId);
        await request("/rest/v1/organizer_members", {
          method: "POST",
          token: env.SERVICE_ROLE_KEY,
          body: {
            organizer_id: organizerId,
            user_id: organizer.id,
            member_role: "owner",
            status: "active",
          },
        });
        const organizerCreate = await request("/rest/v1/rpc/organizer_create_event", {
          method: "POST",
          token: organizer.token,
          body: {
            p_organizer_id: organizerId,
            p_payload: {
              title: `Phase 4B organizer ${stamp}`,
              event_type: "social",
              city: "boston",
              event_date: "2099-01-01T20:00:00Z",
              dance_styles: [],
            },
            p_publish: true,
          },
        });
        if (organizerCreate.response.status === 404) {
          markNotRun(
            "ORGANIZER create RPC",
            "organizer_create_event is not installed in this local database"
          );
        } else {
          expect(
            "ORGANIZER create RPC succeeds",
            organizerCreate.response.status === 200,
            `status=${organizerCreate.response.status}`
          );
          const organizerEventId =
            typeof organizerCreate.data === "string"
              ? organizerCreate.data
              : organizerCreate.data?.[0]?.id;
          if (organizerEventId) {
            eventIds.push(organizerEventId);
            const stored = await request(
              `/rest/v1/events?id=eq.${organizerEventId}&select=source_type`,
              { token: env.SERVICE_ROLE_KEY }
            );
            expect(
              "ORGANIZER result source_type organizer",
              stored.data?.[0]?.source_type === "organizer",
              JSON.stringify(stored.data)
            );
          }
        }
      } else {
        markNotRun(
          "ORGANIZER create RPC",
          `organizer fixture insert failed with status=${organizerInsert.response.status}`
        );
      }
    } else {
      markNotRun(
        "ORGANIZER create RPC",
        "organizer tables are not installed in this local database"
      );
    }
  } catch (error) {
    results.push({
      label: "Verifier execution",
      status: "FAIL",
      detail: error instanceof Error ? error.message : String(error),
    });
    exitCode = 1;
  } finally {
    await cleanup();
  }

  for (const result of results) console.log(`${result.status} ${result.label} — ${result.detail}`);
  if (notRun && exitCode === 0) exitCode = 2;
  console.log(`DB_VERIFICATION_EXIT=${exitCode}`);
  process.exitCode = exitCode;
}
