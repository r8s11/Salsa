import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import FoundersAcceptPage from "./FoundersAcceptPage";

const { useAuth } = vi.hoisted(() => ({ useAuth: vi.fn() }));
vi.mock("../contexts/useAuth", () => ({ useAuth }));

const { validateFounderInvitation, acceptFounderInvitation } = vi.hoisted(() => ({
  validateFounderInvitation: vi.fn(),
  acceptFounderInvitation: vi.fn(),
}));
vi.mock("../features/founder/api/founderInvitationAcceptance", () => ({
  validateFounderInvitation,
  acceptFounderInvitation,
}));

const { provisionFounderOrganization } = vi.hoisted(() => ({ provisionFounderOrganization: vi.fn() }));
vi.mock("../features/founder/api/founderOnboarding", () => ({ provisionFounderOrganization }));

// sessionStorage-backed in the real module; mocked here so the test drives
// the token purely through the URL, matching the emailed-link entry path.
vi.mock("../lib/founderInvitationToken", () => ({
  setFounderInvitationToken: vi.fn(),
  getFounderInvitationToken: vi.fn(() => "a".repeat(64)),
  clearFounderInvitationToken: vi.fn(),
}));

vi.mock("../lib/authReturnDestination", () => ({ setAuthReturnDestination: vi.fn() }));

const VALID_TOKEN = "a".repeat(64);

function renderPage() {
  return render(
    <MemoryRouter initialEntries={[`/founders/accept?token=${VALID_TOKEN}`]}>
      <Routes>
        <Route path="/founders/accept" element={<FoundersAcceptPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("FoundersAcceptPage — acceptance success path (Phase 8 delta)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuth.mockReturnValue({
      user: { id: "user-1", email: "founder@example.com" },
      loading: false,
      signOut: vi.fn(),
    });
    validateFounderInvitation.mockResolvedValue({
      valid: true,
      organizationName: "Riverside Salsa Co",
      invitedEmail: "founder@example.com",
      expiresAt: "2026-09-10T00:00:00.000Z",
    });
  });

  it("provisions the organization inline after a successful accept, then routes the CTA to /founders/welcome", async () => {
    acceptFounderInvitation.mockResolvedValue({
      accepted: true,
      organizationName: "Riverside Salsa Co",
      founderRequestId: "req-1",
    });
    provisionFounderOrganization.mockResolvedValue({
      organizerId: "org-1",
      organizationName: "Riverside Salsa Co",
      role: "owner",
    });

    renderPage();

    const acceptButton = await screen.findByRole("button", { name: /accept invitation/i });
    await userEvent.click(acceptButton);

    await waitFor(() => expect(acceptFounderInvitation).toHaveBeenCalledWith(VALID_TOKEN));
    // Provisioning must be called AFTER acceptance succeeds, not before.
    expect(provisionFounderOrganization).toHaveBeenCalledTimes(1);

    expect(await screen.findByRole("heading", { name: /invitation accepted/i })).toBeInTheDocument();
    const continueLink = screen.getByRole("link", { name: /continue/i });
    expect(continueLink).toHaveAttribute("href", "/founders/welcome");
    // The old Phase 6 destination must not remain.
    expect(continueLink).not.toHaveAttribute("href", "/profile");
  });

  it("still shows the accepted success state when inline provisioning fails — acceptance already committed and stands", async () => {
    acceptFounderInvitation.mockResolvedValue({
      accepted: true,
      organizationName: "Riverside Salsa Co",
      founderRequestId: "req-1",
    });
    provisionFounderOrganization.mockRejectedValue(new Error("network blip"));

    renderPage();

    const acceptButton = await screen.findByRole("button", { name: /accept invitation/i });
    await userEvent.click(acceptButton);

    await waitFor(() => expect(provisionFounderOrganization).toHaveBeenCalledTimes(1));
    // Never a generic error screen just because the best-effort provisioning
    // call failed — the accepted state renders regardless (spec §19).
    expect(await screen.findByRole("heading", { name: /invitation accepted/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /continue/i })).toHaveAttribute("href", "/founders/welcome");
  });

  it("does not provision when acceptance itself fails", async () => {
    acceptFounderInvitation.mockRejectedValue(
      new Error("invitation is invalid, expired, or no longer available")
    );

    renderPage();

    const acceptButton = await screen.findByRole("button", { name: /accept invitation/i });
    await userEvent.click(acceptButton);

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /invalid, expired, or no longer available/i })).toBeInTheDocument()
    );
    expect(provisionFounderOrganization).not.toHaveBeenCalled();
  });
});
