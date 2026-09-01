import type { FormEvent } from "react";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSubmission } from "../admin/api/submissionsRepo";
import { notifySubmissionReceived } from "./submissionNotification";
import { useSubmitEventForm } from "./useSubmitEventForm";

vi.mock("../admin/api/submissionsRepo", () => ({
  createSubmission: vi.fn(),
}));

vi.mock("./submissionNotification", () => ({
  notifySubmissionReceived: vi.fn(),
}));

const mockEventFlyers = vi.hoisted(() => ({
  uploadEventFlyer: vi.fn(),
  removeEventFlyer: vi.fn(),
}));

vi.mock("../events/api/eventFlyers", () => mockEventFlyers);

vi.mock("../../contexts/useCity", () => ({
  useCity: () => ({ city: "boston" }),
}));
const mockAuth = vi.hoisted(() => ({
  user: { id: "user123", email: "a@b.com" } as { id: string; email: string } | null,
}));

vi.mock("../../contexts/useAuth", () => ({
  useAuth: () => ({ user: mockAuth.user }),
}));

const pngFile = () => new File(["png"], "flyer.png", { type: "image/png" });
const flyerUrl = "https://project.supabase.co/storage/v1/object/public/event-flyers/user123/submission-abc/flyer.png";

describe("useSubmitEventForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.user = { id: "user123", email: "a@b.com" };
    mockEventFlyers.uploadEventFlyer.mockResolvedValue({
      path: "user123/submission-abc/flyer.png",
      url: flyerUrl,
    });
    mockEventFlyers.removeEventFlyer.mockResolvedValue(undefined);
    vi.mocked(createSubmission).mockResolvedValue("submission-abc");
  });

  it("submits dance_styles as an empty array when nothing is selected", async () => {
    const { result } = renderHook(() => useSubmitEventForm());

    await act(async () => {
      result.current.update("title", "Test Event");
      result.current.update("event_type", "social");
      result.current.update("event_date", "2026-08-20");
    });

    await act(async () => {
      await result.current.handleSubmit({
        preventDefault: () => {},
      } as unknown as FormEvent);
    });

    expect(createSubmission).toHaveBeenCalledWith(
      expect.objectContaining({
        dance_styles: [],
      }),
      undefined
    );
    // The notification now carries only the submission id — the payload
    // itself is never sent from the browser.
    expect(notifySubmissionReceived).toHaveBeenCalledWith("submission-abc");
  });

  it("allows public submissions without an authenticated user object", async () => {
    mockAuth.user = null;
    const { result } = renderHook(() => useSubmitEventForm());

    await act(async () => {
      result.current.update("title", "Public Event");
      result.current.update("event_type", "social");
      result.current.update("event_date", "2026-08-20");
      // Name and email are now REQUIRED for an anonymous submission: they are
      // the only way to send the submitter their confirmation and the review
      // outcome. Enforced here, in the anon RLS policy, and by the
      // require_anon_submitter_contact() trigger.
      result.current.update("submitter_name", "Public Dancer");
      result.current.update("submitter_email", "public@example.com");
    });

    await act(async () => {
      await result.current.handleSubmit({
        preventDefault: () => {},
      } as unknown as FormEvent);
    });

    expect(createSubmission).toHaveBeenCalledWith(
      expect.objectContaining({
        submitter_id: null,
        submitter_name: "Public Dancer",
        submitter_email: "public@example.com",
      }),
      undefined
    );
  });

  it("uploads the flyer as soon as it is chosen (persist-before-ready)", async () => {
    const { result } = renderHook(() => useSubmitEventForm());

    await act(async () => {
      result.current.handleFlyerChange(pngFile());
    });

    expect(mockEventFlyers.uploadEventFlyer).toHaveBeenCalledTimes(1);
    expect(mockEventFlyers.uploadEventFlyer).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: "user123",
        eventId: expect.stringMatching(/^submission-/),
      })
    );
    expect(result.current.flyerStatus).toBe("uploaded");
    expect(result.current.flyerReady).toBe(true);
    expect(result.current.uploadedFlyerUrl).toBe(flyerUrl);
  });

  it("never uploads a second time at submit — it reuses the persisted URL", async () => {
    const { result } = renderHook(() => useSubmitEventForm());

    await act(async () => {
      result.current.handleFlyerChange(pngFile());
    });
    expect(mockEventFlyers.uploadEventFlyer).toHaveBeenCalledTimes(1);

    await act(async () => {
      result.current.update("title", "Test Event");
      result.current.update("event_type", "social");
      result.current.update("event_date", "2026-08-20");
    });
    await act(async () => {
      await result.current.handleSubmit({
        preventDefault: () => {},
      } as unknown as FormEvent);
    });

    expect(mockEventFlyers.uploadEventFlyer).toHaveBeenCalledTimes(1);
    expect(createSubmission).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Test Event" }),
      { image_url: flyerUrl }
    );
  });

  it("waits for an in-flight upload to settle before submitting (no second upload)", async () => {
    let resolveUpload!: (value: { path: string; url: string }) => void;
    mockEventFlyers.uploadEventFlyer.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveUpload = resolve;
      })
    );
    const { result } = renderHook(() => useSubmitEventForm());

    await act(async () => {
      result.current.handleFlyerChange(pngFile());
      result.current.update("title", "Test Event");
      result.current.update("event_type", "social");
      result.current.update("event_date", "2026-08-20");
    });
    expect(result.current.flyerStatus).toBe("uploading");

    let submitPromise!: Promise<void>;
    await act(async () => {
      submitPromise = result.current.handleSubmit({
        preventDefault: () => {},
      } as unknown as FormEvent);
    });

    await act(async () => {
      resolveUpload({ path: "user123/submission-abc/flyer.png", url: flyerUrl });
      await submitPromise;
    });

    expect(mockEventFlyers.uploadEventFlyer).toHaveBeenCalledTimes(1);
    expect(createSubmission).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Test Event" }),
      { image_url: flyerUrl }
    );
  });

  it("shows an upload-error state with a retry path that re-uploads the same file", async () => {
    mockEventFlyers.uploadEventFlyer.mockRejectedValueOnce(new Error("storage down"));
    const { result } = renderHook(() => useSubmitEventForm());

    await act(async () => {
      result.current.handleFlyerChange(pngFile());
    });

    expect(result.current.flyerStatus).toBe("upload-error");
    expect(result.current.flyerError).toBe("storage down");
    expect(result.current.flyerReady).toBe(false);

    await act(async () => {
      result.current.handleFlyerRetry();
    });

    expect(mockEventFlyers.uploadEventFlyer).toHaveBeenCalledTimes(2);
    expect(result.current.flyerStatus).toBe("uploaded");
    expect(result.current.flyerReady).toBe(true);
    expect(result.current.uploadedFlyerUrl).toBe(flyerUrl);
  });

  it("allows submission without a flyer when the upload fails (no false ready)", async () => {
    mockEventFlyers.uploadEventFlyer.mockRejectedValueOnce(new Error("storage down"));
    const { result } = renderHook(() => useSubmitEventForm());

    await act(async () => {
      result.current.handleFlyerChange(pngFile());
    });
    await act(async () => {
      result.current.update("title", "Test Event");
      result.current.update("event_type", "social");
      result.current.update("event_date", "2026-08-20");
    });
    await act(async () => {
      await result.current.handleSubmit({
        preventDefault: () => {},
      } as unknown as FormEvent);
    });

    expect(mockEventFlyers.uploadEventFlyer).toHaveBeenCalledTimes(1);
    expect(createSubmission).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Test Event" }),
      undefined
    );
  });

  it("removes the replaced flyer object when a new file replaces an uploaded one", async () => {
    const { result } = renderHook(() => useSubmitEventForm());

    await act(async () => {
      result.current.handleFlyerChange(pngFile());
    });
    expect(result.current.uploadedFlyerUrl).toBe(flyerUrl);

    await act(async () => {
      result.current.handleFlyerChange(pngFile());
    });

    expect(mockEventFlyers.removeEventFlyer).toHaveBeenCalledWith(flyerUrl);
  });

  it("cleans up the persisted flyer when a submission fails", async () => {
    vi.mocked(createSubmission).mockRejectedValueOnce(new Error("db down"));
    const { result } = renderHook(() => useSubmitEventForm());

    await act(async () => {
      result.current.handleFlyerChange(pngFile());
      result.current.update("title", "Test Event");
      result.current.update("event_type", "social");
      result.current.update("event_date", "2026-08-20");
      await result.current.handleSubmit({
        preventDefault: () => {},
      } as unknown as FormEvent);
    });

    expect(mockEventFlyers.uploadEventFlyer).toHaveBeenCalledTimes(1);
    expect(mockEventFlyers.removeEventFlyer).toHaveBeenCalledWith(flyerUrl);
  });

  it("does not upload a flyer for a guest (no auth.uid) and submits manually", async () => {
    mockAuth.user = null;
    const { result } = renderHook(() => useSubmitEventForm());

    await act(async () => {
      result.current.handleFlyerChange(pngFile());
    });

    expect(mockEventFlyers.uploadEventFlyer).not.toHaveBeenCalled();
    expect(result.current.flyerReady).toBe(false);

    await act(async () => {
      result.current.update("title", "Guest Event");
      result.current.update("event_type", "social");
      result.current.update("event_date", "2026-08-20");
      // Required for anonymous submissions (see the contact-requirement tests).
      result.current.update("submitter_name", "Guest Dancer");
      result.current.update("submitter_email", "guest@example.com");
    });
    await act(async () => {
      await result.current.handleSubmit({
        preventDefault: () => {},
      } as unknown as FormEvent);
    });

    expect(createSubmission).toHaveBeenCalledWith(
      expect.objectContaining({ submitter_id: null }),
      undefined
    );
  });

  it("removes an uploaded flyer on explicit remove", async () => {
    const { result } = renderHook(() => useSubmitEventForm());

    await act(async () => {
      result.current.handleFlyerChange(pngFile());
    });

    await act(async () => {
      await result.current.handleFlyerRemove();
    });

    expect(mockEventFlyers.removeEventFlyer).toHaveBeenCalledWith(flyerUrl);
    expect(result.current.flyerReady).toBe(false);
    expect(result.current.flyerStatus).toBe("empty");
  });

  // ── Transactional email wiring ──
  //
  // Note the two-act() shape used throughout this file: `update` schedules a
  // functional setState, but `handleSubmit` closes over the CURRENT render's
  // `form`. Submitting inside the same act() as the updates reads a stale
  // form. Updates first, re-render, then submit.

  it("requests the submitter confirmation + moderator notification after a successful submission", async () => {
    const { result } = renderHook(() => useSubmitEventForm());

    await act(async () => {
      result.current.update("title", "Notified Event");
      result.current.update("event_type", "social");
      result.current.update("event_date", "2026-08-20");
    });
    await act(async () => {
      await result.current.handleSubmit({ preventDefault: () => {} } as unknown as FormEvent);
    });

    // Called with the id returned by createSubmission — the trusted lookup
    // key the Edge Function uses to derive recipients server-side.
    expect(notifySubmissionReceived).toHaveBeenCalledWith("submission-abc");
    expect(notifySubmissionReceived).toHaveBeenCalledTimes(1);
  });

  it("does not request any email when the submission itself failed", async () => {
    vi.mocked(createSubmission).mockRejectedValueOnce(new Error("db down"));
    const { result } = renderHook(() => useSubmitEventForm());

    await act(async () => {
      result.current.update("title", "Doomed Event");
      result.current.update("event_type", "social");
      result.current.update("event_date", "2026-08-20");
    });
    await act(async () => {
      await result.current.handleSubmit({ preventDefault: () => {} } as unknown as FormEvent);
    });

    expect(notifySubmissionReceived).not.toHaveBeenCalled();
  });

  it("still reports the submission as succeeded when the email request rejects", async () => {
    // Database state is the source of truth: a mail failure must never
    // surface as a submission failure.
    vi.mocked(notifySubmissionReceived).mockRejectedValueOnce(new Error("resend down"));
    const { result } = renderHook(() => useSubmitEventForm());

    await act(async () => {
      result.current.update("title", "Resilient Event");
      result.current.update("event_type", "social");
      result.current.update("event_date", "2026-08-20");
    });
    await act(async () => {
      await result.current.handleSubmit({ preventDefault: () => {} } as unknown as FormEvent);
    });

    expect(createSubmission).toHaveBeenCalledTimes(1);
    expect(result.current.isSubmitted).toBe(true);
    expect(result.current.error).toBeNull();
  });

  // ── Anonymous submitter contact is required ──

  it("rejects an anonymous submission with no submitter name, before touching the database", async () => {
    mockAuth.user = null;
    const { result } = renderHook(() => useSubmitEventForm());

    await act(async () => {
      result.current.update("title", "Anon Event");
      result.current.update("event_type", "social");
      result.current.update("event_date", "2026-08-20");
      result.current.update("submitter_email", "anon@example.com");
    });
    await act(async () => {
      await result.current.handleSubmit({ preventDefault: () => {} } as unknown as FormEvent);
    });

    expect(result.current.error).toMatch(/name/i);
    expect(createSubmission).not.toHaveBeenCalled();
    expect(notifySubmissionReceived).not.toHaveBeenCalled();
  });

  it("rejects an anonymous submission with a malformed submitter email", async () => {
    mockAuth.user = null;
    const { result } = renderHook(() => useSubmitEventForm());

    await act(async () => {
      result.current.update("title", "Anon Event");
      result.current.update("event_type", "social");
      result.current.update("event_date", "2026-08-20");
      result.current.update("submitter_name", "Anon Dancer");
      result.current.update("submitter_email", "not-an-email");
    });
    await act(async () => {
      await result.current.handleSubmit({ preventDefault: () => {} } as unknown as FormEvent);
    });

    expect(result.current.error).toMatch(/valid email/i);
    expect(createSubmission).not.toHaveBeenCalled();
  });

  it("accepts an anonymous submission that carries name and email", async () => {
    mockAuth.user = null;
    const { result } = renderHook(() => useSubmitEventForm());

    await act(async () => {
      result.current.update("title", "Anon Event");
      result.current.update("event_type", "social");
      result.current.update("event_date", "2026-08-20");
      result.current.update("submitter_name", "Anon Dancer");
      result.current.update("submitter_email", "anon@example.com");
    });
    await act(async () => {
      await result.current.handleSubmit({ preventDefault: () => {} } as unknown as FormEvent);
    });

    expect(result.current.error).toBeNull();
    expect(createSubmission).toHaveBeenCalledWith(
      expect.objectContaining({
        submitter_id: null,
        submitter_name: "Anon Dancer",
        submitter_email: "anon@example.com",
      }),
      undefined
    );
    expect(notifySubmissionReceived).toHaveBeenCalledWith("submission-abc");
  });

  it("leaves submitter contact optional for an authenticated submitter", async () => {
    const { result } = renderHook(() => useSubmitEventForm());

    await act(async () => {
      result.current.update("title", "Signed-in Event");
      result.current.update("event_type", "social");
      result.current.update("event_date", "2026-08-20");
    });
    await act(async () => {
      await result.current.handleSubmit({ preventDefault: () => {} } as unknown as FormEvent);
    });

    expect(result.current.error).toBeNull();
    expect(createSubmission).toHaveBeenCalledTimes(1);
  });
});
