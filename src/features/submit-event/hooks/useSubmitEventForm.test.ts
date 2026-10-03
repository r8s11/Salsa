import type { FormEvent } from "react";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSubmission } from "../../admin/api/submissionsRepo";
import { notifySubmissionReceived } from "../api/submissionNotification";
import { useSubmitEventForm } from "./useSubmitEventForm";
import type { EntityReview, EntityReviewItem } from "../../entity-matching/entityReview";

const CANONICAL = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Canonical Club",
  address: "1 Main",
  city: "Boston",
};
const venueItem = (overrides: Partial<EntityReviewItem> = {}): EntityReviewItem => ({
  candidate: { name: "Havana Club", address: "288 Green Street", city: "Cambridge" },
  state: "POSSIBLE MATCH",
  matches: [CANONICAL],
  decision: "pending",
  selected_id: null,
  ...overrides,
});
const reviewWithVenue = (venue: EntityReviewItem): EntityReview => ({
  venue,
  organizer: null,
  instructors: [],
  school: null,
});

vi.mock("../../admin/api/submissionsRepo", () => ({
  createSubmission: vi.fn(),
}));
vi.mock("../../metros/hooks/useMetros", () => import("../../../test/mockMetros"));

vi.mock("../api/submissionNotification", () => ({
  notifySubmissionReceived: vi.fn(),
}));

const mockEventFlyers = vi.hoisted(() => ({
  uploadEventFlyer: vi.fn(),
  removeEventFlyer: vi.fn(),
}));

vi.mock("../../events/api/eventFlyers", () => mockEventFlyers);

const mockFlyerExtraction = vi.hoisted(() => ({
  extractEventFromFlyer: vi.fn(),
}));

vi.mock("../../flyer-extraction/client", () => mockFlyerExtraction);

const mockReconciliation = vi.hoisted(() => ({
  reconcileEntities: vi.fn(),
  searchEntityMatches: vi.fn(),
}));
vi.mock("../../entity-matching/entityReviewClient", () => mockReconciliation);

vi.mock("../../../contexts/useCity", () => ({
  useCity: () => ({ city: "boston" }),
}));
const mockAuth = vi.hoisted(() => ({
  user: { id: "user123", email: "a@b.com" } as { id: string; email: string } | null,
}));

vi.mock("../../../contexts/useAuth", () => ({
  useAuth: () => ({ user: mockAuth.user }),
}));

const pngFile = () => new File(["png"], "flyer.png", { type: "image/png" });
const flyerUrl =
  "https://project.supabase.co/storage/v1/object/public/event-flyers/user123/submission-abc/flyer.png";
const extractionFixture = {
  title: "Boston Salsa Night",
  date: "2026-09-18",
  start_time: "21:00",
  end_time: "01:00",
  venue_name: "Havana Club",
  address: "288 Green Street",
  city: "Cambridge",
  dance_styles: ["Salsa", "Bachata"],
  event_type: null,
  price: "$20",
  organizer_name: "SalsaSegura",
  instagram: "@salsasegura",
  website: null,
  details: [],
};

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
    mockReconciliation.reconcileEntities.mockResolvedValue({
      venue: null,
      organizer: null,
      instructors: [],
      school: null,
    });
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

  it("ignores a second handleSubmit call while the first is still in flight", async () => {
    const { promise: submitBlock, resolve: resolveSubmit } = Promise.withResolvers<string>();
    vi.mocked(createSubmission).mockReturnValueOnce(submitBlock);
    const { result } = renderHook(() => useSubmitEventForm());

    await act(async () => {
      result.current.update("title", "Test Event");
      result.current.update("event_type", "social");
      result.current.update("event_date", "2026-08-20");
    });

    let firstSubmit!: Promise<void>;
    let secondSubmit!: Promise<void>;
    await act(async () => {
      // Two rapid invocations in the same tick — e.g. a double form-submit
      // event or Enter+click racing — must yield exactly one createSubmission
      // call, not one row per invocation.
      firstSubmit = result.current.handleSubmit({
        preventDefault: () => {},
      } as unknown as FormEvent);
      secondSubmit = result.current.handleSubmit({
        preventDefault: () => {},
      } as unknown as FormEvent);
    });

    expect(createSubmission).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveSubmit("submission-abc");
      await Promise.all([firstSubmit, secondSubmit]);
    });

    expect(createSubmission).toHaveBeenCalledTimes(1);
  });

  it("ignores a second handleSubmit call while an in-flight flyer upload is awaited", async () => {
    const { promise: uploadBlock, resolve: resolveUpload } = Promise.withResolvers<{ path: string; url: string }>();
    mockEventFlyers.uploadEventFlyer.mockReturnValueOnce(uploadBlock);
    const { promise: submitBlock, resolve: resolveSubmit } = Promise.withResolvers<string>();
    vi.mocked(createSubmission).mockReturnValueOnce(submitBlock);
    const { result } = renderHook(() => useSubmitEventForm());

    await act(async () => {
      result.current.handleFlyerChange(pngFile());
      result.current.update("title", "Test Event");
      result.current.update("event_type", "social");
      result.current.update("event_date", "2026-08-20");
    });

    let firstSubmit!: Promise<void>;
    let secondSubmit!: Promise<void>;
    await act(async () => {
      // Two rapid invocations while the flyer upload is still in flight must
      // both await the SAME upload promise and still yield exactly one
      // createSubmission call — the in-flight lock holds across the await.
      firstSubmit = result.current.handleSubmit({
        preventDefault: () => {},
      } as unknown as FormEvent);
      secondSubmit = result.current.handleSubmit({
        preventDefault: () => {},
      } as unknown as FormEvent);
    });

    expect(mockEventFlyers.uploadEventFlyer).toHaveBeenCalledTimes(1);
    expect(createSubmission).toHaveBeenCalledTimes(0);

    await act(async () => {
      resolveUpload({ path: "user123/submission-abc/flyer.png", url: flyerUrl });
    });

    expect(createSubmission).toHaveBeenCalledTimes(1);
    expect(createSubmission).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Test Event" }),
      { image_url: flyerUrl }
    );

    await act(async () => {
      resolveSubmit("submission-abc");
      await Promise.all([firstSubmit, secondSubmit]);
    });

    expect(createSubmission).toHaveBeenCalledTimes(1);
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
    expect(mockEventFlyers.removeEventFlyer).toHaveBeenCalledWith(flyerUrl);
  });

  it("uploads an anonymous flyer's persisted URL with the submission", async () => {
    mockAuth.user = null;
    const file = pngFile();
    const { result } = renderHook(() => useSubmitEventForm());

    await act(async () => {
      result.current.handleFlyerChange(file);
    });

    expect(mockEventFlyers.uploadEventFlyer).toHaveBeenCalledWith({
      file,
      ownerId: "anonymous",
      eventId: expect.stringMatching(/^submission-/),
    });
    expect(result.current.flyerReady).toBe(true);

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
      { image_url: flyerUrl }
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
    expect(result.current.serverError).toBeNull();
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

    expect(result.current.fieldErrors.submitter_name).toMatch(/name/i);
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

    expect(result.current.fieldErrors.submitter_email).toMatch(/valid email/i);
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

    expect(result.current.serverError).toBeNull();
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

    expect(result.current.serverError).toBeNull();
    expect(createSubmission).toHaveBeenCalledTimes(1);
  });

  // ── Flyer extraction (Phase 3): review-only ──

  describe("flyer extraction", () => {
    beforeEach(() => {
      mockFlyerExtraction.extractEventFromFlyer.mockReset();
    });

    it("extracts against the persisted flyer URL and stores the result", async () => {
      mockFlyerExtraction.extractEventFromFlyer.mockResolvedValue(extractionFixture);
      const { result } = renderHook(() => useSubmitEventForm());

      await act(async () => {
        result.current.handleFlyerChange(pngFile());
      });
      expect(result.current.extractionStatus).toBe("idle");

      await act(async () => {
        result.current.handleExtractFlyer();
      });

      expect(mockFlyerExtraction.extractEventFromFlyer).toHaveBeenCalledWith(flyerUrl);
      expect(result.current.extractionStatus).toBe("success");
      expect(result.current.extractionResult).toEqual(extractionFixture);
      expect(result.current.extractionError).toBeNull();
    });

    it("enriches the form from an explicitly selected existing venue without setting venue_id", async () => {
      mockFlyerExtraction.extractEventFromFlyer.mockResolvedValue(extractionFixture);
      mockReconciliation.reconcileEntities.mockResolvedValue(
        reviewWithVenue(
          venueItem({ state: "MATCHED", decision: "existing", selected_id: CANONICAL.id })
        )
      );
      const { result } = renderHook(() => useSubmitEventForm());
      await act(async () => {
        result.current.handleFlyerChange(pngFile());
      });
      await act(async () => {
        result.current.handleExtractFlyer();
      });
      expect(result.current.form.location).toBe("Canonical Club");
      expect(result.current.form.address).toBe("1 Main");
      expect(result.current.form.venue_id).toBe("");
      expect(result.current.extractionResult?.venue_name).toBe("Havana Club");
      expect(result.current.entityReview?.venue).toMatchObject({
        decision: "existing",
        selected_id: CANONICAL.id,
      });
      expect(result.current.form.entity_review).toBe(result.current.entityReview);
      expect(result.current.reconciliation).toEqual({ status: "success", error: null });
    });

    it("sends the flyer's structured candidates to reconcile, never the event contact", async () => {
      mockFlyerExtraction.extractEventFromFlyer.mockResolvedValue({
        ...extractionFixture,
        venue: { name: "Havana Club", address: "288 Green Street", city: "Cambridge" },
        organizer: { name: "SalsaSegura Events" },
        instructors: [{ name: "Ana Rivera" }],
        school: null,
      });
      const { result } = renderHook(() => useSubmitEventForm());
      await act(async () => {
        result.current.handleFlyerChange(pngFile());
      });
      await act(async () => {
        result.current.handleExtractFlyer();
      });
      const sent = mockReconciliation.reconcileEntities.mock.calls[0][0];
      expect(sent.venue.name).toBe("Havana Club");
      expect(sent.organizer.name).toBe("SalsaSegura Events");
      expect(sent.instructors.map((entry: { name: string }) => entry.name)).toEqual(["Ana Rivera"]);
      expect(sent.school).toBeNull();
      expect(JSON.stringify(sent)).not.toContain("@salsasegura");
    });

    it("keeps raw flyer values for a possible match the user has not chosen", async () => {
      mockFlyerExtraction.extractEventFromFlyer.mockResolvedValue(extractionFixture);
      mockReconciliation.reconcileEntities.mockResolvedValue(reviewWithVenue(venueItem()));
      const { result } = renderHook(() => useSubmitEventForm());
      await act(async () => {
        result.current.handleFlyerChange(pngFile());
      });
      await act(async () => {
        result.current.handleExtractFlyer();
      });
      expect(result.current.form.location).toBe("Havana Club");
      expect(result.current.form.address).toBe("288 Green Street");
      expect(result.current.entityReview?.venue).toMatchObject({
        state: "POSSIBLE MATCH",
        decision: "pending",
      });
    });

    it("does not auto-link a flyer venue over a venue the person already typed", async () => {
      mockFlyerExtraction.extractEventFromFlyer.mockResolvedValue(extractionFixture);
      mockReconciliation.reconcileEntities.mockResolvedValue(
        reviewWithVenue(
          venueItem({ state: "MATCHED", decision: "existing", selected_id: CANONICAL.id })
        )
      );
      const { result } = renderHook(() => useSubmitEventForm());
      await act(async () => {
        result.current.handleFlyerChange(pngFile());
        result.current.update("location", "My Own Hall");
      });
      await act(async () => {
        result.current.handleExtractFlyer();
      });
      expect(result.current.form.location).toBe("My Own Hall");
      expect(result.current.entityReview?.venue).toMatchObject({
        decision: "pending",
        selected_id: null,
      });
    });

    it("detaches an automatic venue link when the venue text is edited, but keeps one the person chose", async () => {
      mockFlyerExtraction.extractEventFromFlyer.mockResolvedValue(extractionFixture);
      mockReconciliation.reconcileEntities.mockResolvedValue(
        reviewWithVenue(
          venueItem({ state: "MATCHED", decision: "existing", selected_id: CANONICAL.id })
        )
      );
      const { result } = renderHook(() => useSubmitEventForm());
      await act(async () => {
        result.current.handleFlyerChange(pngFile());
      });
      await act(async () => {
        result.current.handleExtractFlyer();
      });
      expect(result.current.entityReview?.venue?.decision).toBe("existing");

      await act(async () => {
        result.current.update("location", "Somewhere Else");
      });
      expect(result.current.entityReview?.venue).toMatchObject({
        decision: "pending",
        selected_id: null,
      });

      await act(async () => {
        result.current.setEntityReview({
          ...result.current.entityReview!,
          venue: {
            ...venueItem({ decision: "existing", selected_id: CANONICAL.id }),
            explicit: true,
          } as EntityReviewItem,
        });
      });
      await act(async () => {
        result.current.update("location", "A Third Label");
      });
      expect(result.current.entityReview?.venue).toMatchObject({
        decision: "existing",
        selected_id: CANONICAL.id,
      });
    });

    it("falls back to an unresolved review when matching is unavailable", async () => {
      mockFlyerExtraction.extractEventFromFlyer.mockResolvedValue(extractionFixture);
      mockReconciliation.reconcileEntities.mockRejectedValue(new Error("We couldn't check."));
      const { result } = renderHook(() => useSubmitEventForm());
      await act(async () => {
        result.current.handleFlyerChange(pngFile());
      });
      await act(async () => {
        result.current.handleExtractFlyer();
      });
      expect(result.current.extractionStatus).toBe("success");
      expect(result.current.reconciliation.status).toBe("error");
      expect(result.current.form.location).toBe("Havana Club");
      expect(result.current.entityReview?.venue).toMatchObject({
        candidate: { name: "Havana Club" },
        state: "NEEDS REVIEW",
        decision: "pending",
        matches: [],
      });
    });

    it("does not call reconcile or create a review when the flyer shows no entities", async () => {
      mockFlyerExtraction.extractEventFromFlyer.mockResolvedValue({
        ...extractionFixture,
        venue_name: null,
        organizer_name: null,
        venue: null,
        organizer: null,
        instructors: [],
        school: null,
      });
      const { result } = renderHook(() => useSubmitEventForm());
      await act(async () => {
        result.current.handleFlyerChange(pngFile());
      });
      await act(async () => {
        result.current.handleExtractFlyer();
      });
      expect(mockReconciliation.reconcileEntities).not.toHaveBeenCalled();
      expect(result.current.entityReview).toBeNull();
      expect(result.current.form.entity_review).toBeUndefined();
    });

    it("keeps the person's decision and edits when the flyer is analysed again", async () => {
      mockFlyerExtraction.extractEventFromFlyer.mockResolvedValue(extractionFixture);
      mockReconciliation.reconcileEntities.mockResolvedValue(reviewWithVenue(venueItem()));
      const { result } = renderHook(() => useSubmitEventForm());
      await act(async () => {
        result.current.handleFlyerChange(pngFile());
      });
      await act(async () => {
        result.current.handleExtractFlyer();
      });
      await act(async () => {
        result.current.setEntityReview({
          ...result.current.entityReview!,
          venue: venueItem({ decision: "existing", selected_id: CANONICAL.id }),
        });
        result.current.update("title", "My own title");
      });
      await act(async () => {
        result.current.handleExtractFlyer();
      });
      expect(result.current.entityReview?.venue).toMatchObject({
        decision: "existing",
        selected_id: CANONICAL.id,
      });
      expect(result.current.form.title).toBe("My own title");
    });

    it("discards a late reconcile result after the flyer is replaced", async () => {
      mockFlyerExtraction.extractEventFromFlyer.mockResolvedValue(extractionFixture);
      const pending = Promise.withResolvers<EntityReview>();
      mockReconciliation.reconcileEntities.mockReturnValue(pending.promise);
      const { result } = renderHook(() => useSubmitEventForm());
      await act(async () => {
        result.current.handleFlyerChange(pngFile());
      });
      await act(async () => {
        result.current.handleExtractFlyer();
      });
      expect(result.current.reconciliation.status).toBe("loading");
      const titleBefore = result.current.form.title;

      await act(async () => {
        result.current.handleFlyerChange(pngFile());
      });
      await act(async () => {
        pending.resolve(reviewWithVenue(venueItem()));
      });

      expect(result.current.extractionStatus).toBe("idle");
      expect(result.current.entityReview).toBeNull();
      expect(result.current.form.title).toBe(titleBefore);
      expect(result.current.form.location).toBe("");
    });

    it("drops an untouched review with its flyer but keeps one the person decided", async () => {
      mockFlyerExtraction.extractEventFromFlyer.mockResolvedValue(extractionFixture);
      mockReconciliation.reconcileEntities.mockResolvedValue(reviewWithVenue(venueItem()));
      const { result } = renderHook(() => useSubmitEventForm());
      await act(async () => {
        result.current.handleFlyerChange(pngFile());
      });
      await act(async () => {
        result.current.handleExtractFlyer();
      });
      await act(async () => {
        await result.current.handleFlyerRemove();
      });
      expect(result.current.entityReview).toBeNull();

      await act(async () => {
        result.current.handleFlyerChange(pngFile());
      });
      await act(async () => {
        result.current.handleExtractFlyer();
      });
      await act(async () => {
        result.current.setEntityReview({
          ...result.current.entityReview!,
          venue: venueItem({ decision: "new" }),
        });
      });
      await act(async () => {
        await result.current.handleFlyerRemove();
      });
      expect(result.current.entityReview?.venue?.decision).toBe("new");
    });

    it("passes the reviewed entities through to the submission", async () => {
      mockFlyerExtraction.extractEventFromFlyer.mockResolvedValue(extractionFixture);
      mockReconciliation.reconcileEntities.mockResolvedValue(reviewWithVenue(venueItem()));
      const { result } = renderHook(() => useSubmitEventForm());
      await act(async () => {
        result.current.handleFlyerChange(pngFile());
      });
      await act(async () => {
        result.current.handleExtractFlyer();
      });
      await act(async () => {
        result.current.update("event_type", "social");
        result.current.update("event_date", "2026-08-20");
        result.current.setEntityReview({
          ...result.current.entityReview!,
          venue: venueItem({ decision: "new" }),
        });
      });
      await act(async () => {
        await result.current.handleSubmit({ preventDefault: () => {} } as unknown as FormEvent);
      });
      expect(createSubmission).toHaveBeenCalledWith(
        expect.objectContaining({
          entity_review: expect.objectContaining({
            venue: expect.objectContaining({ decision: "new", selected_id: null }),
          }),
        }),
        expect.anything()
      );
      expect(result.current.entityReview).toBeNull();
    });

    it("leaves a city the person chose alone, but follows the flyer for the default city", async () => {
      mockFlyerExtraction.extractEventFromFlyer.mockResolvedValue({
        ...extractionFixture,
        city: "Miami",
      });
      const first = renderHook(() => useSubmitEventForm());
      await act(async () => {
        first.result.current.handleFlyerChange(pngFile());
      });
      await act(async () => {
        first.result.current.handleExtractFlyer();
      });
      expect(first.result.current.form.city).toBe("miami");

      const second = renderHook(() => useSubmitEventForm());
      await act(async () => {
        second.result.current.update("city", "new-york-city");
        second.result.current.handleFlyerChange(pngFile());
      });
      await act(async () => {
        second.result.current.handleExtractFlyer();
      });
      expect(second.result.current.form.city).toBe("new-york-city");
    });

    it("does nothing before a flyer is persisted", async () => {
      const { result } = renderHook(() => useSubmitEventForm());

      await act(async () => {
        result.current.handleExtractFlyer();
      });

      expect(mockFlyerExtraction.extractEventFromFlyer).not.toHaveBeenCalled();
      expect(result.current.extractionStatus).toBe("idle");
    });

    it("surfaces a safe error and lets the user retry into success", async () => {
      mockFlyerExtraction.extractEventFromFlyer.mockRejectedValueOnce(
        new Error("We couldn't read this flyer. Please try again.")
      );
      const { result } = renderHook(() => useSubmitEventForm());
      await act(async () => {
        result.current.handleFlyerChange(pngFile());
      });

      await act(async () => {
        result.current.handleExtractFlyer();
      });
      expect(result.current.extractionStatus).toBe("error");
      expect(result.current.extractionError).toBe("We couldn't read this flyer. Please try again.");
      expect(result.current.extractionResult).toBeNull();

      mockFlyerExtraction.extractEventFromFlyer.mockResolvedValueOnce(extractionFixture);
      await act(async () => {
        result.current.handleExtractFlyer();
      });

      expect(result.current.extractionStatus).toBe("success");
      expect(result.current.extractionResult).toEqual(extractionFixture);
      expect(result.current.extractionError).toBeNull();
      expect(mockFlyerExtraction.extractEventFromFlyer).toHaveBeenCalledTimes(2);
    });

    it("ignores a second extraction click while one is already in flight", async () => {
      let resolveExtraction!: (value: typeof extractionFixture) => void;
      mockFlyerExtraction.extractEventFromFlyer.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveExtraction = resolve;
        })
      );
      const { result } = renderHook(() => useSubmitEventForm());
      await act(async () => {
        result.current.handleFlyerChange(pngFile());
      });

      await act(async () => {
        // Both calls happen inside the same act — the second must be a no-op
        // against the same in-flight request, not a second network call.
        result.current.handleExtractFlyer();
        result.current.handleExtractFlyer();
      });
      expect(mockFlyerExtraction.extractEventFromFlyer).toHaveBeenCalledTimes(1);
      expect(result.current.extractionStatus).toBe("loading");

      await act(async () => {
        resolveExtraction(extractionFixture);
      });
      expect(result.current.extractionStatus).toBe("success");
    });

    it("clears the extraction result when the flyer is replaced", async () => {
      mockFlyerExtraction.extractEventFromFlyer.mockResolvedValue(extractionFixture);
      const { result } = renderHook(() => useSubmitEventForm());
      await act(async () => {
        result.current.handleFlyerChange(pngFile());
      });
      await act(async () => {
        result.current.handleExtractFlyer();
      });
      expect(result.current.extractionStatus).toBe("success");

      await act(async () => {
        result.current.handleFlyerChange(pngFile());
      });

      expect(result.current.extractionStatus).toBe("idle");
      expect(result.current.extractionResult).toBeNull();
      expect(result.current.extractionError).toBeNull();
      expect(result.current.prefillFeedback).toBeNull();
    });

    it("clears the extraction result when the flyer is removed", async () => {
      mockFlyerExtraction.extractEventFromFlyer.mockResolvedValue(extractionFixture);
      const { result } = renderHook(() => useSubmitEventForm());
      await act(async () => {
        result.current.handleFlyerChange(pngFile());
      });
      await act(async () => {
        result.current.handleExtractFlyer();
      });
      expect(result.current.extractionStatus).toBe("success");

      await act(async () => {
        await result.current.handleFlyerRemove();
      });

      expect(result.current.extractionStatus).toBe("idle");
      expect(result.current.extractionResult).toBeNull();
      expect(result.current.flyerReady).toBe(false);
      expect(result.current.prefillFeedback).toBeNull();
    });

    it("discards a stale response after the flyer changes mid-request", async () => {
      let resolveFirst!: (value: typeof extractionFixture) => void;
      mockFlyerExtraction.extractEventFromFlyer.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveFirst = resolve;
        })
      );
      const { result } = renderHook(() => useSubmitEventForm());
      await act(async () => {
        result.current.handleFlyerChange(pngFile());
      });

      await act(async () => {
        result.current.handleExtractFlyer();
      });
      expect(result.current.extractionStatus).toBe("loading");

      // The flyer is replaced while the first request is still pending —
      // this bumps the generation and must invalidate that request.
      await act(async () => {
        result.current.handleFlyerChange(pngFile());
      });
      expect(result.current.extractionStatus).toBe("idle");

      // The stale request now resolves. Its result must never appear.
      await act(async () => {
        resolveFirst(extractionFixture);
      });

      expect(result.current.extractionStatus).toBe("idle");
      expect(result.current.extractionResult).toBeNull();
    });

    it("fills only empty fields from a successful extraction", async () => {
      mockFlyerExtraction.extractEventFromFlyer.mockResolvedValue(extractionFixture);
      const { result } = renderHook(() => useSubmitEventForm());

      await act(async () => {
        result.current.handleFlyerChange(pngFile());
      });
      await act(async () => {
        result.current.handleExtractFlyer();
      });

      expect(result.current.extractionStatus).toBe("success");
      expect(result.current.form.title).toBe("Boston Salsa Night");
      expect(result.current.form.location).toBe("Havana Club");
      expect(result.current.form.event_date).toBe("2026-09-18");
      expect(result.current.form.price_type).toBe("paid");
      expect(result.current.form.price_amount).toBe("20");
      expect(result.current.prefillFeedback?.filled).toContain("Title");
    });

    it("never overwrites a manually typed value that was already non-empty", async () => {
      mockFlyerExtraction.extractEventFromFlyer.mockResolvedValue(extractionFixture);
      const { result } = renderHook(() => useSubmitEventForm());

      await act(async () => {
        result.current.update("title", "My Own Title");
      });
      await act(async () => {
        result.current.handleFlyerChange(pngFile());
      });
      await act(async () => {
        result.current.handleExtractFlyer();
      });

      expect(result.current.extractionStatus).toBe("success");
      // The fixture's title differs from what was typed — proving the
      // manual value survived, not merely that it was never assigned to.
      expect(result.current.extractionResult?.title).toBe("Boston Salsa Night");
      expect(result.current.form.title).toBe("My Own Title");
    });

    it("leaves the current city unchanged and reports it skipped when the flyer's locality is unmappable", async () => {
      mockFlyerExtraction.extractEventFromFlyer.mockResolvedValue({
        ...extractionFixture,
        city: "Providence, RI",
      });
      const { result } = renderHook(() => useSubmitEventForm());

      await act(async () => {
        result.current.update("city", "new-york-city");
      });
      await act(async () => {
        result.current.handleFlyerChange(pngFile());
      });
      await act(async () => {
        result.current.handleExtractFlyer();
      });

      expect(result.current.extractionStatus).toBe("success");
      expect(result.current.form.city).toBe("new-york-city");
      expect(result.current.prefillFeedback?.skipped).toContain("City");
    });

    it("retrying extraction does not overwrite a field the user edited after the first prefill", async () => {
      mockFlyerExtraction.extractEventFromFlyer.mockResolvedValue(extractionFixture);
      const { result } = renderHook(() => useSubmitEventForm());
      await act(async () => {
        result.current.handleFlyerChange(pngFile());
      });
      await act(async () => {
        result.current.handleExtractFlyer();
      });
      expect(result.current.form.title).toBe("Boston Salsa Night");

      await act(async () => {
        result.current.update("title", "Edited After Prefill");
      });
      await act(async () => {
        result.current.handleExtractFlyer();
      });

      expect(result.current.extractionStatus).toBe("success");
      expect(result.current.form.title).toBe("Edited After Prefill");
    });

    it("a stale response must not prefill the form, even though it already committed once", async () => {
      let resolveFirst!: (value: typeof extractionFixture) => void;
      mockFlyerExtraction.extractEventFromFlyer.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveFirst = resolve;
        })
      );
      const { result } = renderHook(() => useSubmitEventForm());
      await act(async () => {
        result.current.handleFlyerChange(pngFile());
      });
      await act(async () => {
        result.current.handleExtractFlyer();
      });
      expect(result.current.extractionStatus).toBe("loading");

      // Replace the flyer while extraction A is still in flight.
      await act(async () => {
        result.current.handleFlyerChange(pngFile());
      });
      expect(result.current.extractionStatus).toBe("idle");
      expect(result.current.form.title).toBe("");

      // A's response arrives late. It must not render AND must not prefill.
      await act(async () => {
        resolveFirst(extractionFixture);
      });

      expect(result.current.extractionStatus).toBe("idle");
      expect(result.current.extractionResult).toBeNull();
      expect(result.current.form.title).toBe("");
      expect(result.current.prefillFeedback).toBeNull();
    });

    it("leaves the form untouched on extraction failure", async () => {
      mockFlyerExtraction.extractEventFromFlyer.mockRejectedValueOnce(new Error("read failed"));
      const { result } = renderHook(() => useSubmitEventForm());
      await act(async () => {
        result.current.update("title", "Kept On Failure");
      });
      await act(async () => {
        result.current.handleFlyerChange(pngFile());
      });
      await act(async () => {
        result.current.handleExtractFlyer();
      });

      expect(result.current.extractionStatus).toBe("error");
      expect(result.current.form.title).toBe("Kept On Failure");
      expect(result.current.prefillFeedback).toBeNull();
    });

    it("dismissing a failed extraction clears the error without touching the flyer", async () => {
      mockFlyerExtraction.extractEventFromFlyer.mockRejectedValueOnce(new Error("read failed"));
      const { result } = renderHook(() => useSubmitEventForm());
      await act(async () => {
        result.current.handleFlyerChange(pngFile());
      });
      await act(async () => {
        result.current.handleExtractFlyer();
      });
      expect(result.current.extractionStatus).toBe("error");

      await act(async () => {
        result.current.dismissExtractionError();
      });

      expect(result.current.extractionStatus).toBe("idle");
      expect(result.current.extractionError).toBeNull();
      expect(result.current.flyerReady).toBe(true);
    });
  });
});
