import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PostHog } from "posthog-js";

const sdk = vi.hoisted(() => ({
  init: vi.fn(),
  capture: vi.fn(),
  identify: vi.fn(),
  reset: vi.fn(),
  register: vi.fn(),
}));

vi.mock("posthog-js", () => ({ default: sdk }));

beforeEach(() => {
  vi.resetModules();
  Object.values(sdk).forEach((fn) => fn.mockClear());
});

async function load() {
  return import("./posthog");
}

describe("posthog lazy-load wrapper", () => {
  it("replays calls made before init, in order, after init runs", async () => {
    const { posthog, startPostHog } = await load();
    posthog.identify("user-1", { role: "user" }, { first_utm_source: "instagram" });
    posthog.register({ metro: "boston" });
    posthog.capture("event_viewed", { event_id: "e1" });
    posthog.reset();

    const order: string[] = [];
    Object.entries(sdk).forEach(([name, fn]) => fn.mockImplementation(() => order.push(name)));
    startPostHog((client: PostHog) => client.init("phc_test", { api_host: "https://x" }));
    await vi.waitFor(() => expect(sdk.reset).toHaveBeenCalled());

    expect(order).toEqual(["init", "identify", "register", "capture", "reset"]);
    expect(sdk.identify).toHaveBeenCalledWith("user-1", { role: "user" }, { first_utm_source: "instagram" });
    expect(sdk.capture).toHaveBeenCalledWith("event_viewed", { event_id: "e1" });
  });

  it("calls the client directly once loaded", async () => {
    const { posthog, startPostHog } = await load();
    startPostHog((client) => client.init("phc_test", {}));
    await vi.waitFor(() => expect(sdk.init).toHaveBeenCalled());
    await Promise.resolve();
    posthog.capture("event_shared");
    expect(sdk.capture).toHaveBeenCalledWith("event_shared");
  });

  it("drops queued and later calls when analytics is disabled", async () => {
    const { posthog, disablePostHog } = await load();
    posthog.capture("before");
    disablePostHog();
    posthog.capture("after");
    expect(sdk.capture).not.toHaveBeenCalled();
  });
});

