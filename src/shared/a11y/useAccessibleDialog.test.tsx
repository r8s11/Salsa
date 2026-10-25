import { useRef } from "react";
import { describe, it, expect } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { useAccessibleDialog } from "./useAccessibleDialog";

function Dialog() {
  const ref = useRef<HTMLDivElement>(null);
  const { onKeyDown } = useAccessibleDialog({ dialogRef: ref, onDismiss: () => {} });
  return (
    <div role="dialog" aria-modal="true" ref={ref} onKeyDown={onKeyDown}>
      <button type="button">Close</button>
    </div>
  );
}

function Page({ late }: { late: boolean }) {
  return (
    <>
      <main>
        <button type="button">Background</button>
        <Dialog />
      </main>
      {late && <button type="button">Late control</button>}
    </>
  );
}

describe("useAccessibleDialog", () => {
  it("inerts background that mounts after the dialog opened", async () => {
    const { rerender } = render(<Page late={false} />);
    expect(
      screen.getByRole("button", { name: "Background", hidden: true }).closest("[inert]")
    ).not.toBeNull();

    // A scroll-revealed control appearing mid-dialog must not be reachable.
    rerender(<Page late />);
    await act(async () => {});
    expect(
      screen.getByRole("button", { name: "Late control", hidden: true }).closest("[inert]")
    ).not.toBeNull();
  });
});
