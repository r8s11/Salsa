import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { User } from "@supabase/supabase-js";
import { CityProvider } from "../contexts/CityContext";
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
    signOut: vi.fn(),
    clearDeletedAccount: vi.fn(),
    ...overrides,
  } as AuthContextValue;
}

function renderManualSubmission() {
  render(
    <CityProvider>
      <SubmitEventPage />
    </CityProvider>
  );
  fireEvent.click(screen.getByRole("button", { name: /Enter event details manually/i }));
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
    isLoading: false,
    canSubmit: true,
    error: null,
  });
  vi.mocked(useAuth).mockReturnValue(authValue());
});

describe("SubmitEventPage anonymous access contract", () => {
  it("renders the public page instead of redirecting while auth is still loading", () => {
    vi.mocked(useAuth).mockReturnValue(authValue({ loading: true }));

    render(
      <CityProvider>
        <SubmitEventPage />
      </CityProvider>
    );

    expect(screen.getByRole("heading", { name: "Submit an Event" })).toBeInTheDocument();
    expect(screen.queryByText(/sign in/i)).not.toBeInTheDocument();
  });

  it("renders required name and email inputs for a confirmed anonymous visitor", () => {
    renderManualSubmission();

    expect(screen.getByLabelText(/Your name/i)).toBeRequired();
    expect(screen.getByLabelText(/^Email$/i)).toBeRequired();
    expect(screen.queryByText(/Submitting as/i)).not.toBeInTheDocument();
  });
});

describe("SubmitEventPage authenticated access contract", () => {
  // Admin is intentionally absent: an Admin is redirected to the canonical
  // direct-create route instead of rendering the moderated flow. That
  // behavior is covered in SubmitEventPage.routing.test.tsx.
  it.each([
    ["regular user", "user", false, false],
    ["host", "organizer", true, false],
    ["moderator", "moderator", false, true],
  ] as const)("allows a %s to render /submit", (_label, role, isOrganizer, isModerator) => {
    vi.mocked(useAuth).mockReturnValue(
      authValue({
        user: { id: `user-${role}`, app_metadata: { role } } as unknown as User,
        role: role === "user" ? null : role,
        isOrganizer,
        isModerator,
        isAdmin: false,
      })
    );

    renderManualSubmission();

    expect(
      screen.getByRole("heading", { name: /Submit an Event|Create a new event/i })
    ).toBeInTheDocument();
  });

  it("shows trusted authenticated identity instead of editable contact fields", () => {
    vi.mocked(useAuth).mockReturnValue(
      authValue({
        user: {
          id: "user-authenticated",
          email: "member@example.com",
        } as unknown as User,
        role: null,
      })
    );
    vi.mocked(useOwnProfile).mockReturnValue({
      profile: { display_name: "Maria Santos", username: "mariasalsa" } as never,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    renderManualSubmission();
    expect(screen.getByText("Your info")).toBeInTheDocument();

    expect(screen.getByText(/Submitting as/i)).toHaveTextContent("Maria Santos");
    expect(screen.queryByLabelText(/Your name/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^Email$/i)).not.toBeInTheDocument();
  });
});
