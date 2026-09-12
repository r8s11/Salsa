/* eslint-disable */
// @ts-nocheck - Deno test file

import {
  assert,
  assertEquals,
  assertStrictEquals,
} from "https://deno.land/std@0.224.0/testing/asserts.ts";
import { createReconcileFlyerHandler } from "./index.ts";
import type { CandidateVenue, ReconcileFlyerDependencies } from "./index.ts";

function makeDeps(overrides: Partial<ReconcileFlyerDependencies> = {}): ReconcileFlyerDependencies {
  return {
    getUser: async (_req: Request) => ({ userId: "test-user-id" }),
    findVenueCandidates: async (_name: string): Promise<CandidateVenue[]> => [],
    ...overrides,
  };
}

function makeRequest(body: unknown, authHeader = "Bearer valid-token"): Request {
  return new Request("https://example.com/functions/v1/reconcile-flyer", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader,
    },
    body: JSON.stringify(body),
  });
}

function parseResponse(response: Response): Promise<Record<string, unknown>> {
  return response.json();
}

Deno.test("handler - successful function response", async () => {
  const candidates: CandidateVenue[] = [
    {
      id: "1",
      name: "Havana Club",
      address_line1: "288 Green Street",
      city: "Cambridge",
      normalized_name: "havana club",
      normalized_address: "288 green street",
    },
  ];
  const deps = makeDeps({
    findVenueCandidates: async () => candidates,
  });
  const handler = createReconcileFlyerHandler(deps);

  const response = await handler(
    makeRequest({ venue: { name: "Havana Club", address: "288 Green St", city: "Cambridge" } })
  );
  const data = await parseResponse(response);

  assertEquals(response.status, 200);
  assertEquals(data.venue.status, "exact");
  assertEquals(data.venue.match?.id, "1");
});

Deno.test("handler - missing Authorization → unauthorized", async () => {
  const handler = createReconcileFlyerHandler(makeDeps());
  const request = new Request("https://example.com/functions/v1/reconcile-flyer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ venue: { name: "Havana Club" } }),
  });

  const response = await handler(request);
  assertEquals(response.status, 401);
  const data = await parseResponse(response);
  assertEquals(data.error, "Unauthorized");
});

Deno.test("handler - invalid auth (getUser returns null) → unauthorized", async () => {
  const deps = makeDeps({
    getUser: async () => ({ userId: null }),
  });
  const handler = createReconcileFlyerHandler(deps);

  const response = await handler(makeRequest({ venue: { name: "Havana Club" } }));
  assertEquals(response.status, 401);
});

Deno.test("handler - malformed body → controlled 400", async () => {
  const handler = createReconcileFlyerHandler(makeDeps());
  const request = new Request("https://example.com/functions/v1/reconcile-flyer", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer token" },
    body: "not json",
  });

  const response = await handler(request);
  assertEquals(response.status, 400);
  const data = await parseResponse(response);
  assertEquals(data.error, "Malformed request body");
});

Deno.test("handler - unexpected top-level fields → controlled 400", async () => {
  const handler = createReconcileFlyerHandler(makeDeps());
  const response = await handler(makeRequest({ venue: { name: "Havana Club" }, extra: "field" }));
  assertEquals(response.status, 400);
  const data = await parseResponse(response);
  assertEquals(data.error, "Invalid request payload");
});

Deno.test("handler - unexpected venue fields → controlled 400", async () => {
  const handler = createReconcileFlyerHandler(makeDeps());
  const response = await handler(makeRequest({ venue: { name: "Havana Club", extra: "field" } }));
  assertEquals(response.status, 400);
  const data = await parseResponse(response);
  assertEquals(data.error, "Invalid request payload");
});

Deno.test("handler - non-string venue fields → controlled 400", async () => {
  const handler = createReconcileFlyerHandler(makeDeps());
  const response = await handler(makeRequest({ venue: { name: 123 } }));
  assertEquals(response.status, 400);
  const data = await parseResponse(response);
  assertEquals(data.error, "Invalid request payload");
});

Deno.test("handler - no meaningful venue name → none without querying", async () => {
  let queryCalled = false;
  const deps = makeDeps({
    findVenueCandidates: async () => {
      queryCalled = true;
      return [];
    },
  });
  const handler = createReconcileFlyerHandler(deps);

  const response = await handler(
    makeRequest({ venue: { name: "", address: "288 Green St", city: "Cambridge" } })
  );
  const data = await parseResponse(response);

  assertEquals(response.status, 200);
  assertEquals(data.venue.status, "none");
  assertEquals(queryCalled, false);
});

Deno.test("handler - service-role configuration missing → controlled server error", async () => {
  const deps = makeDeps({
    findVenueCandidates: async () => {
      const err = new Error("SUPABASE_SERVICE_ROLE_KEY is not configured") as Error & { code: string };
      err.code = "CONFIG_ERROR";
      throw err;
    },
  });
  const handler = createReconcileFlyerHandler(deps);

  const response = await handler(
    makeRequest({ venue: { name: "Havana Club", address: "288 Green St", city: "Cambridge" } })
  );
  const data = await parseResponse(response);

  assertEquals(response.status, 500);
  assertEquals(data.error, "Server configuration error");
});

Deno.test(
  "handler - privileged query never runs before successful caller authentication",
  async () => {
    let getUserCalled = false;
    let findVenueCandidatesCalled = false;

    const deps = makeDeps({
      getUser: async () => {
        getUserCalled = true;
        return { userId: "test-user-id" };
      },
      findVenueCandidates: async () => {
        findVenueCandidatesCalled = true;
        return [
          {
            id: "1",
            name: "Havana Club",
            address_line1: "288 Green Street",
            city: "Cambridge",
            normalized_name: "havana club",
            normalized_address: "288 green street",
          },
        ];
      },
    });
    const handler = createReconcileFlyerHandler(deps);

    await handler(
      makeRequest({ venue: { name: "Havana Club", address: "288 Green St", city: "Cambridge" } })
    );

    assertEquals(getUserCalled, true);
    assertEquals(findVenueCandidatesCalled, true);
  }
);

Deno.test("handler - database/query failure → controlled server error", async () => {
  const deps = makeDeps({
    findVenueCandidates: async () => {
      throw new Error("Database connection failed");
    },
  });
  const handler = createReconcileFlyerHandler(deps);

  const response = await handler(
    makeRequest({ venue: { name: "Havana Club", address: "288 Green St", city: "Cambridge" } })
  );
  const data = await parseResponse(response);

  assertEquals(response.status, 500);
  assertEquals(data.error, "Venue lookup failed");
});

Deno.test("handler - no candidate list or privileged metadata leaked", async () => {
  const candidates: CandidateVenue[] = [
    {
      id: "1",
      name: "Havana Club",
      address_line1: "288 Green Street",
      city: "Cambridge",
      normalized_name: "havana club",
      normalized_address: "288 green street",
    },
    {
      id: "2",
      name: "Havana Club",
      address_line1: "500 Main St",
      city: "Boston",
      normalized_name: "havana club",
      normalized_address: "500 main street",
    },
  ];
  const deps = makeDeps({
    findVenueCandidates: async () => candidates,
  });
  const handler = createReconcileFlyerHandler(deps);

  const response = await handler(
    makeRequest({ venue: { name: "Havana Club", address: null, city: null } })
  );
  const data = await parseResponse(response);

  assertEquals(response.status, 200);
  assertEquals(data.venue.status, "ambiguous");
  assertEquals(data.venue.match, null);
  assert(!("candidates" in data.venue));
});

Deno.test("handler - OPTIONS request → 200", async () => {
  const handler = createReconcileFlyerHandler(makeDeps());
  const request = new Request("https://example.com/functions/v1/reconcile-flyer", {
    method: "OPTIONS",
    headers: { Authorization: "Bearer token" },
  });

  const response = await handler(request);
  assertEquals(response.status, 200);
});

Deno.test("handler - non-POST method → 405", async () => {
  const handler = createReconcileFlyerHandler(makeDeps());
  const request = new Request("https://example.com/functions/v1/reconcile-flyer", {
    method: "GET",
    headers: { Authorization: "Bearer token" },
  });

  const response = await handler(request);
  assertEquals(response.status, 405);
});

Deno.test("handler - strong match response structure", async () => {
  const candidates: CandidateVenue[] = [
    {
      id: "2",
      name: "Havana Club",
      address_line1: "288 Green Street",
      city: "Cambridge",
      normalized_name: "havana club",
      normalized_address: "288 green street",
    },
  ];
  const deps = makeDeps({
    findVenueCandidates: async () => candidates,
  });
  const handler = createReconcileFlyerHandler(deps);

  const response = await handler(
    makeRequest({ venue: { name: "Havana Club", address: null, city: "Cambridge" } })
  );
  const data = await parseResponse(response);

  assertEquals(response.status, 200);
  assertEquals(data.venue.status, "strong");
  assertEquals(data.venue.match?.id, "2");
  assertEquals(data.venue.match?.name, "Havana Club");
  assertEquals(data.venue.match?.address, "288 Green Street");
  assertEquals(data.venue.match?.city, "Cambridge");
});

Deno.test("handler - ambiguous response has match: null", async () => {
  const candidates: CandidateVenue[] = [
    {
      id: "1",
      name: "Havana Club",
      address_line1: "288 Green Street",
      city: "Cambridge",
      normalized_name: "havana club",
      normalized_address: "288 green street",
    },
    {
      id: "2",
      name: "Havana Club",
      address_line1: "500 Main St",
      city: "Boston",
      normalized_name: "havana club",
      normalized_address: "500 main street",
    },
  ];
  const deps = makeDeps({
    findVenueCandidates: async () => candidates,
  });
  const handler = createReconcileFlyerHandler(deps);

  const response = await handler(
    makeRequest({ venue: { name: "Havana Club", address: null, city: null } })
  );
  const data = await parseResponse(response);

  assertEquals(response.status, 200);
  assertEquals(data.venue.status, "ambiguous");
  assertEquals(data.venue.match, null);
});

Deno.test("handler - none response has match: null", async () => {
  const candidates: CandidateVenue[] = [
    {
      id: "1",
      name: "Other Club",
      address_line1: "123 Other St",
      city: "Cambridge",
      normalized_name: "other club",
      normalized_address: "123 other street",
    },
  ];
  const deps = makeDeps({
    findVenueCandidates: async () => candidates,
  });
  const handler = createReconcileFlyerHandler(deps);

  const response = await handler(
    makeRequest({ venue: { name: "Havana Club", address: "288 Green St", city: "Cambridge" } })
  );
  const data = await parseResponse(response);

  assertEquals(response.status, 200);
  assertEquals(data.venue.status, "none");
  assertEquals(data.venue.match, null);
});

Deno.test("handler - getUser error returns null userId → unauthorized", async () => {
  const deps = makeDeps({
    getUser: async () => ({ userId: null }),
  });
  const handler = createReconcileFlyerHandler(deps);

  const response = await handler(makeRequest({ venue: { name: "Havana Club" } }));
  assertEquals(response.status, 401);
});
