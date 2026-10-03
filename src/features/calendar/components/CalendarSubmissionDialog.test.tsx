import type { UserEvent } from "@testing-library/user-event";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CalendarSubmissionDialog from "./CalendarSubmissionDialog";
import { createSubmission } from "../../admin/api/submissionsRepo";
import { reconcileEntities } from "../../entity-matching/entityReviewClient";
import { useSubmissionAccess } from "../../submit-event/hooks/useSubmissionAccess";

// jsdom has no layout engine and no ResizeObserver/scrollIntoView; Radix
// Dialog's focus-scope + scroll-lock internals touch both on mount. These
// are no-op stand-ins so the dialog can render in jsdom, not part of what the
// tests assert on.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
if (!("ResizeObserver" in globalThis)) {
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
}
HTMLElement.prototype.scrollIntoView = HTMLElement.prototype.scrollIntoView ?? (() => {});
HTMLElement.prototype.hasPointerCapture = HTMLElement.prototype.hasPointerCapture ?? (() => false);

vi.mock("../../admin/api/submissionsRepo", () => ({
  createSubmission: vi.fn(),
}));
vi.mock("../../metros/hooks/useMetros", () => import("../../../test/mockMetros"));
vi.mock("../../submit-event/api/submissionNotification", () => ({
  notifySubmissionReceived: vi.fn(),
}));
vi.mock("../../events/api/eventFlyers", () => ({
  uploadEventFlyer: vi.fn(),
  removeEventFlyer: vi.fn(),
}));
vi.mock("../../flyer-extraction/client", () => ({
  extractEventFromFlyer: vi.fn(),
}));
vi.mock("../../entity-matching/entityReviewClient", () => ({
  reconcileEntities: vi.fn(),
  searchEntityMatches: vi.fn(),
}));
vi.mock("../../../contexts/useCity", () => ({
  useCity: () => ({ city: "boston" }),
}));
vi.mock("../../../contexts/useAuth", () => ({
  useAuth: () => ({ user: null, isOrganizer: false }),
}));
vi.mock("../../account/hooks/useOwnProfile", () => ({
  useOwnProfile: () => ({ profile: null }),
}));
vi.mock("../../submit-event/hooks/useSubmissionAccess", () => ({
  useSubmissionAccess: vi.fn(),
}));

async function fillRequiredFields(user: UserEvent) {
  await act(async () => {
    await user.type(screen.getByLabelText("Event Title *"), "Test Event");
    await user.click(screen.getByRole("button", { name: "Social" }));
    const dateInput = document.getElementById("event-date") as HTMLInputElement;
    await user.type(dateInput, "2026-08-20");
    await user.type(screen.getByLabelText("Your name"), "Public Dancer");
    await user.type(screen.getByLabelText("Email"), "[EMAIL]");
  });
}

describe("CalendarSubmissionDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("locks the event form fields while a submission is in flight, before the network call resolves", async () => {
    vi.mocked(useSubmissionAccess).mockReturnValue({
      isLoading: false,
      canSubmit: true,
      error: null,
      refetch: vi.fn(),
    });
    const { promise: submitBlock, resolve: resolveSubmit } = Promise.withResolvers<string>();
    vi.mocked(createSubmission).mockReturnValueOnce(submitBlock);

    const user = userEvent.setup();
    render(<CalendarSubmissionDialog open onOpenChange={vi.fn()} />);

    await fillRequiredFields(user);

    await act(async () => {
      await user.click(screen.getByRole("button", { name: "Submit Event" }));
    });

    // Verify the form fields are locked: the parent fieldset carries disabled while the
    // in-flight request is pending, which prevents any edit or resubmit.
    await vi.waitFor(() => {
      const fs = document.querySelector(".calendar-sub-dialog__fields") as HTMLFieldSetElement;
      expect(fs).not.toBeNull();
      return fs && fs.disabled;
    }, { timeout: 5000 });
    await act(async () => {
      resolveSubmit("submission-abc");
      await submitBlock;
    });
  });
  it("offers an in-place retry after a failed submission-access lookup, without a page reload", async () => {
    const refetch = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useSubmissionAccess).mockReturnValue({
      isLoading: false,
      canSubmit: false,
      error: "network down",
      refetch,
    });

    const user = userEvent.setup();
    render(<CalendarSubmissionDialog open onOpenChange={vi.fn()} />);

    expect(screen.getByText("Submissions Unavailable")).toBeInTheDocument();
    const retryButton = screen.getByRole("button", { name: /try again/i });
    await act(async () => {
      await user.click(retryButton);
    });

    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("shows no entity review until a flyer has been analysed", () => {
    vi.mocked(useSubmissionAccess).mockReturnValue({
      isLoading: false,
      canSubmit: true,
      error: null,
      refetch: vi.fn(),
    });

    render(<CalendarSubmissionDialog open onOpenChange={vi.fn()} />);

    expect(screen.getByLabelText("Event Title *")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Venue, organizer, instructors and school" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("group", { name: /^(Venue|Organizer|Instructor|School):/ })
    ).not.toBeInTheDocument();
    expect(reconcileEntities).not.toHaveBeenCalled();
  });
});