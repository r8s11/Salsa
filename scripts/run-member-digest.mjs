// Manual workflow entrypoint. Never takes recipient/content overrides.
const base = new URL(process.env.SUPABASE_URL ?? "");
const secret = process.env.MEMBER_DIGEST_SCHEDULER_SECRET ?? "";
if (
  base.protocol !== "https:" || base.username || base.password ||
  secret.length < 32
) throw Error("Digest scheduler configuration unavailable");
let after = null, failed = false, sent = 0;
for (let page = 0; page < 1000; page++) {
  const url = new URL("/functions/v1/send-member-digest", base.origin);
  if (after) url.searchParams.set("after", after);
  const response = await fetch(url, {
    method: "POST",
    headers: { "x-member-digest-scheduler-secret": secret },
    signal: AbortSignal.timeout(120000),
  });
  if (response.status !== 200 && response.status !== 503) {
    throw Error("Digest scheduler request rejected");
  }
  const result = await response.json();
  if (
    !["success", "error"].includes(result.status) ||
    !Number.isInteger(result.sent) ||
    !(result.next_cursor === null ||
      typeof result.next_cursor === "string" &&
        /^[0-9a-f-]{36}$/i.test(result.next_cursor))
  ) throw Error("Invalid digest scheduler response");
  sent += result.sent;
  failed ||= !response.ok || result.status === "error";
  after = result.next_cursor;
  if (!after) {
    console.log(
      JSON.stringify({
        status: failed ? "error" : "success",
        sent,
        pages: page + 1,
      }),
    );
    process.exitCode = failed ? 1 : 0;
    break;
  }
  if (page === 999) {
    throw Error(
      "Digest drain limit reached; resume manually, no recipients discarded",
    );
  }
}
