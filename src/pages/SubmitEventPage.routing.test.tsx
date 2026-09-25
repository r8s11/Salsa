import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { User } from "@supabase/supabase-js";
import { CityProvider } from "../contexts/CityContext";
vi.mock("../features/metros/hooks/useMetros", () => import("../test/mockMetros"));
import type { AuthContextValue } from "../contexts/authContextObject";
import SubmitEventPage from "./SubmitEventPage";

const { useAuth, useSubmissionAccess, useOwnProfile } = vi.hoisted(() => ({
  useAuth: vi.fn(),
  useSubmissionAccess: vi.fn(),
  useOwnProfile: vi.fn(),
}));

vi.mock("../contexts/useAuth", () => ({ useAuth }));
vi.mock("../features/account/hooks/useOwnProfile", () => ({ useOwnProfile }));
vi.mock("../features/submit-event/hooks/useSubmissionAccess", () => ({ useSubmissionAccess }));
vi.mock("../features/admin/api/submissionsRepo", () => ({ createSubmission: vi.fn() }));
vi.mock("../features/submit-event/api/submissionNotification", () => ({
  notifySubmissionReceived: vi.fn(),
}));
vi.mock("../features/events/api/eventsRepo", () => ({}));

function authValue(overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  return {
    user: null,
    session: null,
    loading: false,
    role: null,
    isAdmin: false,
    isModerator: false,
    isOrganizer: false,
    signInWithPassword: vi.fn(),
    resendConfirmation: vi.fn(),
    requestPasswordReset: vi.fn(),
    updateEmail: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn().mockResolvedValue(undefined),
    clearDeletedAccount: vi.fn(),
    ...overrides,
  } as AuthContextValue;
}

function renderAt() {
  return render(
    <MemoryRouter initialEntries={["/submit"]}>
      <CityProvider>
        <Routes>
          <Route path="/submit" element={<SubmitEventPage />} />
          <Route path="/admin/events" element={<main>Admin event create</main>} />
        </Routes>
      </CityProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useOwnProfile).mockReturnValue({
    profile: null,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  });
  vi.mocked(useSubmissionAccess).mockReturnValue({
    canSubmit: true,
    isLoading: false,
    error: null,
  });
  vi.mocked(useAuth).mockReturnValue(authValue());
});

describe("direct /submit behavior by role", () => {
  it("keeps the moderated flow for an anonymous visitor", () => {
    renderAt();

    expect(screen.getByRole("heading", { name: /Submit an Event/i })).toBeInTheDocument();
    expect(screen.queryByText("Admin event create")).not.toBeInTheDocument();
  });

  it("keeps the moderated flow for a regular authenticated member", () => {
    vi.mocked(useAuth).mockReturnValue(authValue({ user: { id: "member" } as User }));

    renderAt();

    expect(screen.getByRole("heading", { name: /Submit an Event/i })).toBeInTheDocument();
    expect(screen.queryByText("Admin event create")).not.toBeInTheDocument();
  });

  it("redirects an admin to the direct-create route", () => {
    vi.mocked(useAuth).mockReturnValue(
      authValue({ user: { id: "admin-1" } as User, role: "admin", isAdmin: true })
    );

    renderAt();

    expect(screen.getByText("Admin event create")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Submit an Event/i })).not.toBeInTheDocument();
  });

  it("keeps the moderated flow for a moderator", () => {
    vi.mocked(useAuth).mockReturnValue(
      authValue({ user: { id: "mod-1" } as User, role: "moderator", isModerator: true })
    );

    renderAt();

    expect(screen.getByRole("heading", { name: /Submit an Event/i })).toBeInTheDocument();
  });
});
