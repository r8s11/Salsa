import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { NativeEventSharePayload } from "../model/eventSharing";
import EventShareControls from "./EventShareControls";

const input = {
  eventId: "event-123",
  title: "Havana Nights Social",
  dateLabel: "Friday, October 24 at 9:00 PM",
  location: "The Grand Ballroom",
};

function mockClipboard(writeText: ReturnType<typeof vi.fn>) {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
}

function mockShare(share: ((data: NativeEventSharePayload) => Promise<void>) | undefined) {
  Object.defineProperty(navigator, "share", {
    configurable: true,
    value: share,
  });
}

describe("EventShareControls", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockClipboard(vi.fn().mockResolvedValue(undefined));
    mockShare(undefined);
  });

  it("copies canonical public URL only after clipboard succeeds", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    mockClipboard(writeText);
    render(<EventShareControls {...input} origin="https://www.salsasegura.com" />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy event link" }));
    });

    expect(writeText).toHaveBeenCalledWith("https://www.salsasegura.com/events/event-123");
    expect(screen.getByRole("status")).toHaveTextContent("Event link copied.");
  });

  it("copies truthful promotional caption", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    mockClipboard(writeText);
    render(<EventShareControls {...input} origin="https://www.salsasegura.com" />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy promotional text" }));
    });

    expect(writeText).toHaveBeenCalledWith(
      "Join us for Havana Nights Social on Friday, October 24 at 9:00 PM at The Grand Ballroom.\n\nEvent details:\nhttps://www.salsasegura.com/events/event-123"
    );
    expect(screen.getByRole("status")).toHaveTextContent("Promotional text copied.");
  });

  it("announces generic clipboard failure without raw internal error", async () => {
    mockClipboard(vi.fn().mockRejectedValue(new Error("permission backend detail")));
    render(<EventShareControls {...input} origin="https://www.salsasegura.com" />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy event link" }));
    });

    expect(screen.getByRole("alert")).toHaveTextContent("Could not copy event link.");
    expect(screen.queryByText(/backend detail/i)).not.toBeInTheDocument();
  });

  it("keeps Share event available as a copy-link fallback without native share", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    mockClipboard(writeText);
    render(<EventShareControls {...input} origin="https://www.salsasegura.com" compact />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Share event" }));
    });

    expect(writeText).toHaveBeenCalledWith("https://www.salsasegura.com/events/event-123");
  });

  it("uses native share from user action when available", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    mockShare(share);
    const user = userEvent.setup();
    render(<EventShareControls {...input} origin="https://www.salsasegura.com" />);

    await user.click(screen.getByRole("button", { name: "Share event" }));

    expect(share).toHaveBeenCalledWith({
      title: "Havana Nights Social",
      text: "Join us for Havana Nights Social on Friday, October 24 at 9:00 PM at The Grand Ballroom.",
      url: "https://www.salsasegura.com/events/event-123",
    });
  });

  it("does not announce native share cancellation as failure", async () => {
    mockShare(vi.fn().mockRejectedValue(new DOMException("cancelled", "AbortError")));
    const user = userEvent.setup();
    render(<EventShareControls {...input} origin="https://www.salsasegura.com" />);

    await user.click(screen.getByRole("button", { name: "Share event" }));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows generic native share failure", async () => {
    mockShare(vi.fn().mockRejectedValue(new Error("sdk internals")));
    const user = userEvent.setup();
    render(<EventShareControls {...input} origin="https://www.salsasegura.com" />);

    await user.click(screen.getByRole("button", { name: "Share event" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Could not share event.");
    expect(screen.queryByText(/sdk internals/i)).not.toBeInTheDocument();
  });

  it("renders encoded WhatsApp, email, Facebook links only in full mode", () => {
    render(<EventShareControls {...input} origin="https://www.salsasegura.com" />);

    expect(screen.getByRole("link", { name: "Share on WhatsApp" })).toHaveAttribute(
      "target",
      "_blank"
    );
    expect(screen.getByRole("link", { name: "Share on Facebook" })).toHaveAttribute(
      "rel",
      "noopener noreferrer"
    );
    expect(screen.getByRole("link", { name: "Share by email" })).toHaveAttribute(
      "href",
      expect.stringContaining("mailto:")
    );
  });

  it("omits destination links in compact mode", () => {
    render(<EventShareControls {...input} origin="https://www.salsasegura.com" compact />);

    expect(screen.queryByRole("link", { name: "Share on WhatsApp" })).not.toBeInTheDocument();
  });
});
