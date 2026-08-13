import { describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSubmitEventForm } from "./useSubmitEventForm";
import { createSubmission } from "../admin/api/submissionsRepo";

vi.mock("../admin/api/submissionsRepo", () => ({
  createSubmission: vi.fn(),
}));

vi.mock("../../contexts/useCity", () => ({
  useCity: () => ({ city: "boston" }),
}));

vi.mock("../../contexts/useAuth", () => ({
  useAuth: () => ({ user: { id: "user123", email: "a@b.com" } }),
}));

describe("useSubmitEventForm", () => {
  it("submits dance_styles as an empty array when nothing is selected", async () => {
    const { result } = renderHook(() => useSubmitEventForm());
    
    await act(async () => {
      result.current.update("title", "Test Event");
      result.current.update("event_type", "social");
      result.current.update("event_date", "2026-08-20");
      await result.current.handleSubmit({ preventDefault: vi.fn() } as unknown as React.FormEvent);
    });

    // Submit
    await act(async () => {
      await result.current.handleSubmit({ preventDefault: () => {} } as any);
    });

    expect(createSubmission).toHaveBeenCalledWith(
      expect.objectContaining({
        dance_styles: [],
      })
    );
  });
});
