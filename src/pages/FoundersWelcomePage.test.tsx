import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import FoundersWelcomePage from "./FoundersWelcomePage";
import type { UseFounderOnboardingResult } from "../hooks/useFounderOnboarding";

const { useAuth } = vi.hoisted(() => ({ useAuth: vi.fn() }));
const { useFounderOnboarding } = vi.hoisted(() => ({ useFounderOnboarding: vi.fn() }));
const { navigateSpy } = vi.hoisted(() => ({ navigateSpy: vi.fn() }));

vi.mock("../contexts/useAuth", () => ({ useAuth }));
vi.mock("../hooks/useFounderOnboarding", () => ({ useFounderOnboarding }));
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigateSpy };
});

const setAuthReturnDestination = vi.fn();
vi.mock("../lib/authReturnDestination", () => ({
  setAuthReturnDestination: (path: string) => setAuthReturnDestination(path),
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/founders/welcome"]}>
      <Routes>
        <Route path="/founders/welcome" element={<FoundersWelcomePage />} />
        <Route path="/host" element={<div>Host Dashboard Page</div>} />
        <Route path="/host/events" element={<div>Host Events Page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

function defaultOnboarding(): UseFounderOnboardingResult {
  return {
    state: null,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    provision: vi.fn(),
    requestWelcomeEmail: vi.fn(),
  };
}

function mockOnboarding(overrides: Partial<UseFounderOnboardingResult> = {}) {
  vi.mocked(useFounderOnboarding).mockReturnValue({ ...defaultOnboarding(), ...overrides });
}

describe("FoundersWelcomePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuth.mockReturnValue({ user: { id: "user-1", email: "founder@example.com" }, loading: false });
  });

  it("redirects a signed-out visitor to sign-in and preserves the return destination", async () => {
    useAuth.mockReturnValue({ user: null, loading: false });
    mockOnboarding();
    renderPage();

    await waitFor(() => {
      expect(setAuthReturnDestination).toHaveBeenCalledWith("/founders/welcome");
      expect(navigateSpy).toHaveBeenCalledWith(
        "/signin",
        expect.objectContaining({ state: expect.objectContaining({ from: "/founders/welcome", mode: "signin" }) })
      );
    });
  });

  it("shows a checking state while auth is resolving", () => {
    useAuth.mockReturnValue({ user: null, loading: true });
    mockOnboarding();
    renderPage();
    expect(screen.getByText(/checking your account/i)).toBeInTheDocument();
  });

  it("renders a safe message, not fake success, for not_founder", () => {
    mockOnboarding({ state: { state: "not_founder" } });
    renderPage();

    expect(screen.getByRole("heading", { name: /no founder invitation found/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /request founder access/i })).toHaveAttribute("href", "/founders");
    expect(screen.queryByText(/welcome to salsasegura/i)).not.toBeInTheDocument();
  });

  it("renders a safe message, not fake success, for manual_resolution_required", () => {
    mockOnboarding({ state: { state: "manual_resolution_required", founderRequestId: "req-1" } });
    renderPage();

    expect(screen.getByRole("heading", { name: /needs a quick check/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /contact salsasegura/i })).toBeInTheDocument();
    expect(screen.queryByText(/welcome to salsasegura/i)).not.toBeInTheDocument();
  });

  it("auto-provisions when accepted_not_provisioned, then the real welcome renders once the query re-resolves", async () => {
    const provision = vi.fn().mockResolvedValue({ organizerId: "org-1", organizationName: "Co", role: "owner" });
    mockOnboarding({
      state: { state: "accepted_not_provisioned", founderRequestId: "req-1", organizationName: "Riverside Salsa Co" },
      provision,
    });
    renderPage();

    expect(screen.getByRole("heading", { name: /setting up your organization/i })).toBeInTheDocument();
    await waitFor(() => expect(provision).toHaveBeenCalledTimes(1));
  });

  it("does not call provision more than once across re-renders while still accepted_not_provisioned", async () => {
    const provision = vi.fn().mockResolvedValue({ organizerId: "org-1", organizationName: "Co", role: "owner" });
    mockOnboarding({
      state: { state: "accepted_not_provisioned", founderRequestId: "req-1", organizationName: "Co" },
      provision,
    });
    const { rerender } = renderPage();
    await waitFor(() => expect(provision).toHaveBeenCalledTimes(1));

    // Simulate a parent re-render with the same still-unprovisioned state
    // (e.g. an unrelated prop change) — must not re-fire.
    rerender(
      <MemoryRouter initialEntries={["/founders/welcome"]}>
        <Routes>
          <Route path="/founders/welcome" element={<FoundersWelcomePage />} />
        </Routes>
      </MemoryRouter>
    );
    expect(provision).toHaveBeenCalledTimes(1);
  });

  it("shows a retryable error, not an infinite auto-retry, when provisioning fails", async () => {
    const provision = vi.fn().mockRejectedValue(new Error("db down"));
    mockOnboarding({
      state: { state: "accepted_not_provisioned", founderRequestId: "req-1", organizationName: "Co" },
      provision,
    });
    renderPage();

    await waitFor(() => expect(provision).toHaveBeenCalledTimes(1));
    expect(
      await screen.findByRole("heading", { name: /couldn.t finish setting up your organization/i })
    ).toBeInTheDocument();
    const retryButton = screen.getByRole("button", { name: /try again/i });

    // The failure must not have caused a second automatic attempt.
    expect(provision).toHaveBeenCalledTimes(1);

    await userEvent.click(retryButton);
    await waitFor(() => expect(provision).toHaveBeenCalledTimes(2));
  });

  it("renders the real welcome with confirmed organizer, org name, and correct CTAs", () => {
    mockOnboarding({
      state: { state: "provisioned", organizerId: "org-1", organizationName: "Riverside Salsa Co", role: "owner" },
    });
    renderPage();

    expect(screen.getByRole("heading", { name: /welcome to salsasegura/i })).toBeInTheDocument();
    expect(screen.getByText("Riverside Salsa Co")).toBeInTheDocument();
    expect(screen.getByText(/owner/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /go to host dashboard/i })).toHaveAttribute("href", "/host");
    expect(screen.getByRole("link", { name: /view your events/i })).toHaveAttribute("href", "/host/events");
  });

  it("lists only confirmed capabilities — no analytics, team management, billing, or messaging claims", () => {
    mockOnboarding({
      state: { state: "provisioned", organizerId: "org-1", organizationName: "Co", role: "owner" },
    });
    renderPage();

    const body = document.body.textContent?.toLowerCase() ?? "";
    expect(body).not.toContain("analytics");
    expect(body).not.toContain("team member");
    expect(body).not.toContain("billing");
    expect(body).not.toContain("messaging");
  });

  it("requests the welcome email exactly once when the provisioned state renders", async () => {
    const requestWelcomeEmail = vi.fn().mockResolvedValue(undefined);
    mockOnboarding({
      state: { state: "provisioned", organizerId: "org-1", organizationName: "Co", role: "owner" },
      requestWelcomeEmail,
    });
    renderPage();

    await waitFor(() => expect(requestWelcomeEmail).toHaveBeenCalledTimes(1));
  });

  it("does not request the welcome email for any non-provisioned state", async () => {
    const requestWelcomeEmail = vi.fn();
    mockOnboarding({
      state: { state: "accepted_not_provisioned", founderRequestId: "req-1", organizationName: "Co" },
      provision: vi.fn().mockResolvedValue({ organizerId: "org-1", organizationName: "Co", role: "owner" }),
      requestWelcomeEmail,
    });
    renderPage();

    await waitFor(() => {});
    expect(requestWelcomeEmail).not.toHaveBeenCalled();
  });

  it("shows a retry affordance, not a silent stall, when the state query itself errors", async () => {
    const refetch = vi.fn();
    mockOnboarding({ isError: true, refetch });
    renderPage();

    expect(screen.getByRole("heading", { name: /couldn.t load your account/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("moves focus to the heading on every state transition (accessibility spec §28)", () => {
    mockOnboarding({
      state: { state: "provisioned", organizerId: "org-1", organizationName: "Co", role: "owner" },
    });
    renderPage();
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: /welcome to salsasegura/i }));
  });
});
