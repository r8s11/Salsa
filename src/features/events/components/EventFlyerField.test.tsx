import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import EventFlyerField from "./EventFlyerField";

describe("EventFlyerField", () => {
  it("labels the picker and reports a selected supported flyer", async () => {
    const user = userEvent.setup();
    const onFileChange = vi.fn();
    render(<EventFlyerField currentUrl={null} onFileChange={onFileChange} />);

    await user.upload(
      screen.getByLabelText("Event flyer"),
      new File(["png"], "flyer.png", { type: "image/png" })
    );

    expect(onFileChange).toHaveBeenCalledWith(
      expect.objectContaining({ name: "flyer.png", type: "image/png" })
    );
  });

  it("clears a selected file when its local preview fails", async () => {
    const user = userEvent.setup();
    const onFileChange = vi.fn();
    render(<EventFlyerField currentUrl={null} onFileChange={onFileChange} />);

    await user.upload(
      screen.getByLabelText("Event flyer"),
      new File(["png"], "broken-preview.png", { type: "image/png" })
    );
    fireEvent.error(screen.getByAltText("Event flyer preview"));

    expect(onFileChange).toHaveBeenLastCalledWith(null);
  });

  it("rejects unsupported files without changing the selection", async () => {
    const user = userEvent.setup({ applyAccept: false });
    const onFileChange = vi.fn();
    render(
      <EventFlyerField
        currentUrl="https://example.com/current-flyer.jpg"
        onFileChange={onFileChange}
      />
    );

    await user.upload(
      screen.getByLabelText("Event flyer"),
      new File(["gif"], "flyer.gif", { type: "image/gif" })
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(/JPEG, PNG, or WebP/i);
    expect(onFileChange).not.toHaveBeenCalled();
  });

  it("reports a flyer preview load failure", async () => {
    render(
      <EventFlyerField currentUrl="https://example.com/missing-flyer.jpg" onFileChange={vi.fn()} />
    );

    fireEvent.error(screen.getByAltText("Event flyer preview"));

    expect(await screen.findByRole("alert")).toHaveTextContent(/couldn't load/i);
  });
});
