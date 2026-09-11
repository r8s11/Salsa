import { describe, expect, it } from "vitest";
import {
  deriveInvitationDisplayStatus,
  deriveEmailDisplayStatus,
  canCreateFounderInvitation,
  canRevokeFounderInvitation,
  canReissueFounderInvitation,
  founderInvitationAcceptUrl,
  FOUNDER_INVITATION_DISPLAY_LABEL,
  FOUNDER_INVITATION_EMAIL_DISPLAY_LABEL,
  type FounderInvitationRow,
} from "./founderInvitationQuery";

const NOW = new Date("2026-09-01T00:00:00Z");

function invitation(overrides: Partial<FounderInvitationRow> = {}): FounderInvitationRow {
  return {
    id: "inv-1",
    founder_request_id: "req-1",
    email: "applicant@example.com",
    status: "pending",
    expires_at: "2026-09-03T00:00:00Z",
    created_at: "2026-08-31T00:00:00Z",
    created_by: "admin-1",
    revoked_at: null,
    revoked_by: null,
    accepted_at: null,
    accepted_by: null,
    latest_delivery_status: null,
    latest_delivery_provider_message_id: null,
    latest_delivery_attempted_at: null,
    latest_delivery_error_code: null,
    delivery_attempt_count: 0,
    ...overrides,
  };
}

describe("deriveInvitationDisplayStatus", () => {
  it("returns none for no invitation", () => {
    expect(deriveInvitationDisplayStatus(null, NOW)).toBe("none");
  });

  it("returns pending for a live pending invitation", () => {
    expect(deriveInvitationDisplayStatus(invitation({ status: "pending", expires_at: "2026-09-03T00:00:00Z" }), NOW)).toBe(
      "pending"
    );
  });

  it("returns expired for a pending invitation past expires_at", () => {
    expect(
      deriveInvitationDisplayStatus(invitation({ status: "pending", expires_at: "2026-08-30T00:00:00Z" }), NOW)
    ).toBe("expired");
  });

  it("treats expires_at exactly equal to now as expired", () => {
    expect(
      deriveInvitationDisplayStatus(invitation({ status: "pending", expires_at: NOW.toISOString() }), NOW)
    ).toBe("expired");
  });

  it("returns revoked regardless of expires_at", () => {
    expect(
      deriveInvitationDisplayStatus(
        invitation({ status: "revoked", expires_at: "2026-09-05T00:00:00Z", revoked_at: "2026-08-31T12:00:00Z" }),
        NOW
      )
    ).toBe("revoked");
  });

  it("returns accepted regardless of expires_at", () => {
    expect(
      deriveInvitationDisplayStatus(
        invitation({
          status: "accepted",
          expires_at: "2026-08-25T00:00:00Z",
          accepted_at: "2026-08-24T00:00:00Z",
          accepted_by: "user-1",
        }),
        NOW
      )
    ).toBe("accepted");
  });
});

describe("canCreateFounderInvitation", () => {
  it("allows creation when none exists", () => {
    expect(canCreateFounderInvitation("none")).toBe(true);
  });

  it("allows creation when the latest invitation expired", () => {
    expect(canCreateFounderInvitation("expired")).toBe(true);
  });

  it("allows creation when the latest invitation was revoked", () => {
    expect(canCreateFounderInvitation("revoked")).toBe(true);
  });

  it("blocks creation while a pending invitation is active", () => {
    expect(canCreateFounderInvitation("pending")).toBe(false);
  });

  it("blocks creation once accepted", () => {
    expect(canCreateFounderInvitation("accepted")).toBe(false);
  });
});

describe("canRevokeFounderInvitation", () => {
  it("allows revoke only while pending", () => {
    expect(canRevokeFounderInvitation("pending")).toBe(true);
  });

  it("blocks revoke for none/expired/revoked/accepted", () => {
    expect(canRevokeFounderInvitation("none")).toBe(false);
    expect(canRevokeFounderInvitation("expired")).toBe(false);
    expect(canRevokeFounderInvitation("revoked")).toBe(false);
    expect(canRevokeFounderInvitation("accepted")).toBe(false);
  });
});

describe("founderInvitationAcceptUrl", () => {
  it("builds the canonical relative accept URL", () => {
    expect(founderInvitationAcceptUrl("abc123")).toBe("/founders/accept?token=abc123");
  });

  it("URL-encodes the token", () => {
    expect(founderInvitationAcceptUrl("a/b c")).toBe("/founders/accept?token=a%2Fb%20c");
  });
});

describe("FOUNDER_INVITATION_DISPLAY_LABEL", () => {
  it("has a human label for every display status", () => {
    expect(Object.keys(FOUNDER_INVITATION_DISPLAY_LABEL).sort()).toEqual(
      ["accepted", "expired", "none", "pending", "revoked"].sort()
    );
  });
});

describe("deriveEmailDisplayStatus", () => {
  it("returns not_sent when no invitation exists", () => {
    expect(deriveEmailDisplayStatus(null)).toBe("not_sent");
  });

  it("returns not_sent when an invitation exists but no delivery attempt was recorded", () => {
    expect(deriveEmailDisplayStatus(invitation({ latest_delivery_status: null }))).toBe("not_sent");
  });


  it("keeps an incomplete delivery distinct from sent and failed", () => {
    expect(
      deriveEmailDisplayStatus(
        invitation({
          latest_delivery_status: "attempting",
          delivery_attempt_count: 1,
        })
      )
    ).toBe("attempting");
  });
  it("returns sent when the latest delivery attempt succeeded", () => {
    expect(
      deriveEmailDisplayStatus(
        invitation({
          latest_delivery_status: "sent",
          latest_delivery_provider_message_id: "resend-msg-1",
          delivery_attempt_count: 1,
        })
      )
    ).toBe("sent");
  });

  it("returns failed when the latest delivery attempt failed", () => {
    expect(
      deriveEmailDisplayStatus(
        invitation({
          latest_delivery_status: "failed",
          latest_delivery_error_code: "provider_error",
          delivery_attempt_count: 1,
        })
      )
    ).toBe("failed");
  });
});

describe("FOUNDER_INVITATION_EMAIL_DISPLAY_LABEL", () => {
  it("has a human label for every email display status", () => {
    expect(Object.keys(FOUNDER_INVITATION_EMAIL_DISPLAY_LABEL).sort()).toEqual(
      ["attempting", "failed", "not_sent", "sent"].sort()
    );
  });
});

describe("canReissueFounderInvitation", () => {
  it.each(["pending", "expired", "revoked"] as const)(
    "allows an explicit fresh credential for a %s invitation",
    (status) => {
      expect(canReissueFounderInvitation(status)).toBe(true);
    }
  );

  it.each(["none", "accepted"] as const)("does not offer reissue for %s", (status) => {
    expect(canReissueFounderInvitation(status)).toBe(false);
  });
});
