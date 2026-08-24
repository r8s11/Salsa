import type { FormEvent } from "react";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSubmission } from "../admin/api/submissionsRepo";
import { notifyAdminsOfNewSubmission } from "./submissionNotification";
import { useSubmitEventForm } from "./useSubmitEventForm";

vi.mock("../admin/api/submissionsRepo", () => ({
  createSubmission: vi.fn(),
}));

vi.mock("./submissionNotification", () => ({
  notifyAdminsOfNewSubmission: vi.fn(),
}));

vi.mock("../../contexts/useCity", () => ({
  useCity: () => ({ city: "boston" }),
}));
const mockAuth = vi.hoisted(() => ({
  user: { id: "user123", email: "a@b.com" } as { id: string; email: string } | null,
}));

vi.mock("../../contexts/useAuth", () => ({
  useAuth: () => ({ user: mockAuth.user }),
}));

describe("useSubmitEventForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.user = { id: "user123", email: "a@b.com" };
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
      })
    );
    expect(notifyAdminsOfNewSubmission).toHaveBeenCalledWith(
      expect.objectContaining({ dance_styles: [] })
    );
  });

  it("allows public submissions without an authenticated user object", async () => {
    mockAuth.user = null;
    const { result } = renderHook(() => useSubmitEventForm());

    await act(async () => {
      result.current.update("title", "Public Event");
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
        submitter_id: null,
        submitter_email: null,
      })
    );
  });
});
