import type { FormEvent } from "react";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createSubmission } from "../admin/api/submissionsRepo";
import { useSubmitEventForm } from "./useSubmitEventForm";

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
    });

    await act(async () => {
      await result.current.handleSubmit({
        preventDefault: () => {},
      } as unknown as FormEvent);
    });

    expect(createSubmission).toHaveBeenCalledWith(
      expect.objectContaining({
        dance_styles: [],
      }),
    );
  });
});
