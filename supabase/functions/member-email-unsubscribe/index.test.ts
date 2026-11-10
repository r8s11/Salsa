import assert from "node:assert/strict";
import { createMemberEmailUnsubscribe } from "../_shared/memberEmailUnsubscribe.ts";
const token = "00000000-0000-4000-8000-000000000001";
Deno.test("GET is confirmation only; one-click and repeated POST are successful opt-outs", async () => {
  let subscribed = true;
  const handler = createMemberEmailUnsubscribe(async (value) => {
    if (value !== token) return false;
    subscribed = false;
    return true;
  });
  const url = "https://db.test/unsubscribe?t=" + token;
  const get = await handler(new Request(url));
  assert.equal(get.status, 200);
  assert.equal(subscribed, true);
  assert.match(await get.text(), /method="post"/);
  for (const body of ["List-Unsubscribe=One-Click", "confirm=unsubscribe"]) {
    const response = await handler(
      new Request(url, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body,
      }),
    );
    assert.equal(response.status, 200);
    assert.equal(subscribed, false);
  }
});
Deno.test("unsubscribe rejects malformed/unknown tokens and hides database failures", async () => {
  const handler = createMemberEmailUnsubscribe(async (token) => {
    if (token.startsWith("f")) throw Error("private database detail");
    return false;
  });
  assert.equal(
    (await handler(new Request("https://db.test/?t=bad", { method: "POST" })))
      .status,
    400,
  );
  const response = await handler(
    new Request("https://db.test/?t=" + token, {
      method: "POST",
      body: "confirm=unsubscribe",
    }),
  );
  assert.equal(response.status, 400);
  const failed = await handler(
    new Request("https://db.test/?t=f0000000-0000-4000-8000-000000000001", {
      method: "POST",
      body: "confirm=unsubscribe",
    }),
  );
  assert.equal(failed.status, 503);
  assert.doesNotMatch(await failed.text(), /private database/);
});
