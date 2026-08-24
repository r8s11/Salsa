import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the supabase module before importing the client
const mockInvoke = vi.fn();
vi.mock("../../../lib/supabase", () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => mockInvoke(...args),
    },
  },
}));

// Import after mocks are set up
const { sendEmail } = await import("./emailClient");

describe("sendEmail", () => {
  beforeEach(() => {
    mockInvoke.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls the send-email function with the correct payload", async () => {
    mockInvoke.mockResolvedValue({
      data: { success: true, id: "email-123" },
      error: null,
    });

    const result = await sendEmail({
      from: "onboarding@resend.dev",
      to: "roosevelt.bseg@gmail.com",
      subject: "Hello World",
      html: "<p>Congrats on sending your <strong>first email</strong>!</p>",
    });

    expect(mockInvoke).toHaveBeenCalledWith("send-email", {
      body: {
        from: "onboarding@resend.dev",
        to: "roosevelt.bseg@gmail.com",
        subject: "Hello World",
        html: "<p>Congrats on sending your <strong>first email</strong>!</p>",
      },
    });
    expect(result).toEqual({ success: true, id: "email-123" });
  });

  it("supports replyTo field", async () => {
    mockInvoke.mockResolvedValue({
      data: { success: true, id: "email-456" },
      error: null,
    });

    await sendEmail({
      from: "onboarding@resend.dev",
      to: "user@example.com",
      subject: "Test",
      html: "<p>Test</p>",
      replyTo: "support@example.com",
    });

    expect(mockInvoke).toHaveBeenCalledWith("send-email", {
      body: {
        from: "onboarding@resend.dev",
        to: "user@example.com",
        subject: "Test",
        html: "<p>Test</p>",
        replyTo: "support@example.com",
      },
    });
  });

  it("returns error when the function responds with an error", async () => {
    const fakeError = { message: "Invalid API key" };
    mockInvoke.mockResolvedValue({
      data: null,
      error: fakeError,
    });

    const result = await sendEmail({
      from: "onboarding@resend.dev",
      to: "user@example.com",
      subject: "Test",
      html: "<p>Test</p>",
    });

    expect(result).toEqual({
      success: false,
      error: "Invalid API key",
    });
  });

  it("returns error when no data is returned", async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: null,
    });

    const result = await sendEmail({
      from: "onboarding@resend.dev",
      to: "user@example.com",
      subject: "Test",
      html: "<p>Test</p>",
    });

    expect(result).toEqual({
      success: false,
      error: "No response from email function",
    });
  });
});
