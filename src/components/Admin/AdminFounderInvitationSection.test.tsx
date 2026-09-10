import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminFounderInvitationSection from "./AdminFounderInvitationSection";

const { useFounderInvitation } = vi.hoisted(() => ({ useFounderInvitation: vi.fn() }));

vi.mock("../../hooks/useFounderInvitation", () => ({ useFounderInvitation }));

const pendingInvitation = {
  id: "inv-1",
  founder_request_id: "request-1",
  email: "founder@example.com",
  status: "pending" as const,
  expires_at: "2026-09-10T00:00:00.000Z",
  created_at: "2026-09-04T00:00:00.000Z",
  created_by: "admin-1",
  revoked_at: null,
  revoked_by: null,
  accepted_at: null,
  accepted_by: null,
  latest_delivery_status: "attempting" as const,
  latest_delivery_provider_message_id: null,
  latest_delivery_attempted_at: "2026-09-04T00:00:01.000Z",
  latest_delivery_error_code: null,
  delivery_attempt_count: 1,
};

function hookValue(overrides: Record<string, unknown> = {}) {
  return {
    invitation: pendingInvitation,
    isLoading: false,
    error: null,
    createInvitation: vi.fn(),
    isCreating: false,
    createError: null,
    createdInvitation: null,
    resetCreatedInvitation: vi.fn(),
    revokeInvitation: vi.fn(),
    isRevoking: false,
    revokeError: null,
    sendInvitation: vi.fn(),
    isSending: false,
    sendError: null,
    sentInvitation: null,
    reissueInvitation: vi.fn(),
    isReissuing: false,
    reissueError: null,
    reissuedInvitation: null,
    resetReissueResult: vi.fn(),
    invitationHistory: [pendingInvitation],
    deliveryAttemptsByInvitation: {
      "inv-1": [
        {
          id: "attempt-1",
          invitation_id: "inv-1",
          attempt_number: 1,
          provider: "resend",
          provider_message_id: null,
          status: "attempting",
          error_code: null,
          attempted_by: "admin-1",
          attempted_at: "2026-09-04T00:00:01.000Z",
          completed_at: null,
        },
      ],
    },
    isHistoryLoading: false,
    historyError: null,
    ...overrides,
  };
}

describe("AdminFounderInvitationSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useFounderInvitation.mockReturnValue(hookValue());
  });

  it("shows an incomplete delivery distinctly and retains one key for the open reissue dialog", async () => {
    const reissueInvitation = vi.fn();
    useFounderInvitation.mockReturnValue(hookValue({ reissueInvitation }));
    vi.spyOn(crypto, "randomUUID").mockReturnValue("123e4567-e89b-42d3-a456-426614174000");
    const user = userEvent.setup();

    render(<AdminFounderInvitationSection founderRequestId="request-1" isAdmin />);

    expect(screen.getAllByText("Email delivery attempting").length).toBeGreaterThan(0);
    await user.click(screen.getByRole("button", { name: "Reissue Fresh Invitation" }));
    const dialog = screen.getByRole("dialog", { name: "Reissue a fresh Founder invitation?" });
    await user.click(within(dialog).getByRole("button", { name: "Reissue Fresh Invitation" }));

    expect(reissueInvitation).toHaveBeenCalledWith(
      "123e4567-e89b-42d3-a456-426614174000",
      expect.objectContaining({ onSuccess: expect.any(Function) })
    );
  });

  it("hides revoke and reissue after acceptance", () => {
    useFounderInvitation.mockReturnValue(
      hookValue({
        invitation: {
          ...pendingInvitation,
          status: "accepted",
          accepted_at: "2026-09-04T01:00:00.000Z",
          accepted_by: "founder-1",
        },
      })
    );

    render(<AdminFounderInvitationSection founderRequestId="request-1" isAdmin />);

    expect(screen.queryByRole("button", { name: "Revoke Invitation" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reissue Fresh Invitation" })).not.toBeInTheDocument();
  });

  it("keeps moderator history read-only", () => {
    render(<AdminFounderInvitationSection founderRequestId="request-1" isAdmin={false} />);

    expect(screen.getByRole("heading", { name: "Invitation and email history" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Revoke Invitation" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reissue Fresh Invitation" })).not.toBeInTheDocument();
  });
});
