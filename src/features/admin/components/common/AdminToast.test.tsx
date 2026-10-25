import { describe, expect, it, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminToast from "./AdminToast";

describe("AdminToast", () => {
  it("renders the message with role=status", () => {
    render(<AdminToast message="Role changed to Moderator" onDismiss={vi.fn()} />);
    expect(screen.getByRole("status")).toHaveTextContent("Role changed to Moderator");
  });

  it("error tone renders with role=alert instead of role=status", () => {
    render(<AdminToast message="Something failed" tone="error" onDismiss={vi.fn()} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Something failed");
  });

  it("clicking the dismiss button calls onDismiss", async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(<AdminToast message="Done" onDismiss={onDismiss} />);
    await user.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("auto-dismisses after 4 seconds", () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(<AdminToast message="Done" onDismiss={onDismiss} />);
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(onDismiss).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });
});
