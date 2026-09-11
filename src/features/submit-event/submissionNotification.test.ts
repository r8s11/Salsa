import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  notifySubmissionReceived,
  notifySubmissionApproved,
  notifySubmissionRejected,
} from "./submissionNotification";

// vi.hoisted so the mock factory can reference this before the static import
// of the module under test is evaluated — the repo's established pattern
// (see useSubmitEventForm.test.ts mockEventFlyers).
const mocks = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock("../../lib/supabase", () => ({
  supabase: { functions: { invoke: mocks.invoke } },
}));

const SUBMISSION_ID = "3f1c8d9e-4b2a-4c7d-9e8f-1a2b3c4d5e6f";

describe("submissionNotification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.invoke.mockResolvedValue({ data: { success: true }, error: null });
  });

  describe("anti-relay contract", () => {
    // The single most important property of this module. The previous
    // implementation posted a full {from, to, subject, html} payload from the
    // browser, which made the Edge Function an open relay. The body must now
    // carry ONLY an id and an event name.
    it("sends only submissionId and event — never a recipient, subject, or body", async () => {
      await notifySubmissionReceived(SUBMISSION_ID);

      expect(mocks.invoke).toHaveBeenCalled();
      for (const [functionName, options] of mocks.invoke.mock.calls) {
        expect(functionName).toBe("send-submission-email");
        expect(Object.keys(options.body).sort()).toEqual(["event", "submissionId"]);
        expect(options.body).not.toHaveProperty("to");
        expect(options.body).not.toHaveProperty("from");
        expect(options.body).not.toHaveProperty("replyTo");
        expect(options.body).not.toHaveProperty("subject");
        expect(options.body).not.toHaveProperty("html");
        expect(options.body).not.toHaveProperty("text");
      }
    });

    it("cannot be used to target an arbitrary recipient", async () => {
      // Even if a caller passes something recipient-shaped as the id, it
      // travels as submissionId and the Edge Function rejects non-UUIDs.
      await notifySubmissionApproved("attacker@evil.example.com");

      expect(mocks.invoke).toHaveBeenCalledWith("send-submission-email", {
        body: { submissionId: "attacker@evil.example.com", event: "approved" },
      });
      // No recipient field exists to hijack.
      const [, options] = mocks.invoke.mock.calls[0];
      expect(options.body).not.toHaveProperty("to");
    });
  });

  describe("notifySubmissionReceived", () => {
    it("requests both the submitter confirmation and the moderator notification", async () => {
      await notifySubmissionReceived(SUBMISSION_ID);

      expect(mocks.invoke).toHaveBeenCalledTimes(2);
      expect(mocks.invoke).toHaveBeenCalledWith("send-submission-email", {
        body: { submissionId: SUBMISSION_ID, event: "received" },
      });
      expect(mocks.invoke).toHaveBeenCalledWith("send-submission-email", {
        body: { submissionId: SUBMISSION_ID, event: "awaiting_review" },
      });
    });

    it("still requests the moderator notification when the submitter email fails", async () => {
      // The two are independent: one failing must not suppress the other.
      mocks.invoke
        .mockResolvedValueOnce({ data: null, error: { message: "resend down" } })
        .mockResolvedValueOnce({ data: { success: true }, error: null });

      await expect(notifySubmissionReceived(SUBMISSION_ID)).resolves.toBeUndefined();
      expect(mocks.invoke).toHaveBeenCalledTimes(2);
    });
  });

  describe("notifySubmissionApproved / notifySubmissionRejected", () => {
    it("requests the approved event", async () => {
      await notifySubmissionApproved(SUBMISSION_ID);
      expect(mocks.invoke).toHaveBeenCalledWith("send-submission-email", {
        body: { submissionId: SUBMISSION_ID, event: "approved" },
      });
    });

    it("requests the rejected event", async () => {
      await notifySubmissionRejected(SUBMISSION_ID);
      expect(mocks.invoke).toHaveBeenCalledWith("send-submission-email", {
        body: { submissionId: SUBMISSION_ID, event: "rejected" },
      });
    });

    it("never sends rejection copy from the browser", async () => {
      // rejection_message is read server-side from the row; internal_note is
      // not selected there at all. Neither can be supplied by this caller.
      await notifySubmissionRejected(SUBMISSION_ID);
      const [, options] = mocks.invoke.mock.calls[0];
      expect(options.body).not.toHaveProperty("rejectionMessage");
      expect(options.body).not.toHaveProperty("internalNote");
      expect(options.body).not.toHaveProperty("internal_note");
    });
  });

  describe("failures never propagate", () => {
    // Database state is the source of truth. A mail failure must never be
    // able to surface as a submission/approval/rejection failure.
    it("resolves when the function returns an error", async () => {
      mocks.invoke.mockResolvedValue({ data: null, error: { message: "boom" } });

      await expect(notifySubmissionApproved(SUBMISSION_ID)).resolves.toBeUndefined();
      await expect(notifySubmissionRejected(SUBMISSION_ID)).resolves.toBeUndefined();
      await expect(notifySubmissionReceived(SUBMISSION_ID)).resolves.toBeUndefined();
    });

    it("resolves when invoke throws outright", async () => {
      mocks.invoke.mockRejectedValue(new Error("network down"));

      await expect(notifySubmissionApproved(SUBMISSION_ID)).resolves.toBeUndefined();
      await expect(notifySubmissionReceived(SUBMISSION_ID)).resolves.toBeUndefined();
    });

    it("resolves when the function returns no data at all", async () => {
      mocks.invoke.mockResolvedValue({ data: null, error: null });

      await expect(notifySubmissionRejected(SUBMISSION_ID)).resolves.toBeUndefined();
    });
  });
});
