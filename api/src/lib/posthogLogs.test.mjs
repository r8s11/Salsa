import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ emit: vi.fn(), forceFlush: vi.fn(), exporterOptions: null }));

vi.mock("@opentelemetry/exporter-logs-otlp-http", () => ({
  OTLPLogExporter: class { constructor(options) { state.exporterOptions = options; } },
}));
vi.mock("@opentelemetry/resources", () => ({ resourceFromAttributes: (attrs) => attrs }));
vi.mock("@opentelemetry/sdk-logs", () => ({
  BatchLogRecordProcessor: class {},
  LoggerProvider: class {
    getLogger() { return { emit: state.emit }; }
    forceFlush() { return state.forceFlush(); }
  },
}));

const { createPosthogLogs } = await import("./posthogLogs.mjs");

describe("createPosthogLogs", () => {
  beforeEach(() => {
    state.emit.mockReset();
    state.forceFlush.mockReset().mockResolvedValue(undefined);
    state.exporterOptions = null;
  });

  it("returns null without a project token so nothing is exported", () => {
    expect(createPosthogLogs({})).toBeNull();
    expect(state.exporterOptions).toBeNull();
  });

  it("targets POSTHOG_HOST (trailing slashes stripped) and defaults to the US cloud", () => {
    createPosthogLogs({ POSTHOG_PROJECT_TOKEN: "phc_x" });
    expect(state.exporterOptions.url).toBe("https://us.i.posthog.com/i/v1/logs");
    expect(state.exporterOptions.headers).toEqual({ Authorization: "Bearer phc_x" });
    createPosthogLogs({ POSTHOG_PROJECT_TOKEN: "phc_x", POSTHOG_HOST: "https://eu.i.posthog.com//" });
    expect(state.exporterOptions.url).toBe("https://eu.i.posthog.com/i/v1/logs");
  });

  it("emits an ERROR record with attributes and flushes before resolving", async () => {
    const logs = createPosthogLogs({ POSTHOG_PROJECT_TOKEN: "phc_x" });
    const error = new Error("boom");
    await logs.error("failed", error, { city: "nyc" });
    expect(state.emit).toHaveBeenCalledWith(expect.objectContaining({
      severityNumber: 17,
      body: "failed",
      attributes: { city: "nyc", "error.message": "boom" },
      exception: error,
    }));
    expect(state.forceFlush).toHaveBeenCalledOnce();
  });

  it("never rejects when the flush fails", async () => {
    state.forceFlush.mockRejectedValue(new Error("offline"));
    const logs = createPosthogLogs({ POSTHOG_PROJECT_TOKEN: "phc_x" });
    await expect(logs.error("failed", "not-an-error")).resolves.toBeUndefined();
    expect(state.emit.mock.calls[0][0].attributes["error.message"]).toBe("not-an-error");
  });
});
