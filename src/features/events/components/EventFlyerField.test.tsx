import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import EventFlyerField from "./EventFlyerField";

describe("EventFlyerField", () => {
  it("labels the dropzone and reports a selected supported flyer", async () => {
    const user = userEvent.setup();
    const onFileChange = vi.fn();
    render(<EventFlyerField currentUrl={null} onFileChange={onFileChange} />);

    expect(screen.getByLabelText("Event flyer")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Choose Flyer/i })).toBeInTheDocument();

    await user.upload(
      screen.getByLabelText("Event flyer"),
      new File(["png"], "flyer.png", { type: "image/png" })
    );

    expect(onFileChange).toHaveBeenCalledWith(
      expect.objectContaining({ name: "flyer.png", type: "image/png" })
    );
  });

  it("rejects unsupported files without changing the selection", async () => {
    const user = userEvent.setup({ applyAccept: false });
    const onFileChange = vi.fn();
    render(
      <EventFlyerField currentUrl="https://example.com/current-flyer.jpg" onFileChange={onFileChange} />
    );

    await user.upload(
      screen.getByLabelText("Event flyer"),
      new File(["gif"], "flyer.gif", { type: "image/gif" })
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(/JPEG, PNG, or WebP/i);
    expect(onFileChange).not.toHaveBeenCalled();
  });

  it("shows a preview with an accessible name for an already-persisted flyer", () => {
    render(
      <EventFlyerField currentUrl="https://example.com/flyer.png" onFileChange={vi.fn()} />
    );

    expect(screen.getByRole("img", { name: "Current event flyer" })).toHaveAttribute(
      "src",
      "https://example.com/flyer.png"
    );
    expect(screen.getByRole("button", { name: /Replace/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Remove/i })).toBeInTheDocument();
  });

  it("exposes Replace and Remove as keyboard-accessible buttons", async () => {
    const user = userEvent.setup();
    const onFileChange = vi.fn();
    const onRemove = vi.fn();
    render(
      <EventFlyerField
        currentUrl="https://example.com/flyer.png"
        onFileChange={onFileChange}
        onRemove={onRemove}
      />
    );

    await user.click(screen.getByRole("button", { name: /Remove/i }));
    expect(onRemove).toHaveBeenCalled();
    // After removal the dropzone returns.
    expect(await screen.findByLabelText(/Choose a flyer image to upload/i)).toBeInTheDocument();
  });

  it("renders an upload-error state with an accessible alert", () => {
    render(
      <EventFlyerField
        currentUrl={null}
        onFileChange={vi.fn()}
        status="upload-error"
        errorMessage="We couldn't upload this flyer."
      />
    );

    expect(screen.getByRole("alert")).toHaveTextContent(/We couldn't upload this flyer/i);
  });

  it("wires the file input's aria-describedby and aria-invalid to the upload error", () => {
    render(
      <EventFlyerField
        currentUrl={null}
        onFileChange={vi.fn()}
        status="upload-error"
        errorMessage="We couldn't upload this flyer."
      />
    );

    const input = screen.getByLabelText("Event flyer");
    const alert = screen.getByRole("alert");
    expect(alert).toHaveAttribute("id");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input.getAttribute("aria-describedby")).toBe(alert.getAttribute("id"));
  });

  it("has no aria-describedby when there is no error", () => {
    render(<EventFlyerField currentUrl={null} onFileChange={vi.fn()} />);

    const input = screen.getByLabelText("Event flyer");
    expect(input).not.toHaveAttribute("aria-describedby");
    expect(input).not.toHaveAttribute("aria-invalid");
  });

  it("announces an uploading state without exposing a broken preview", () => {
    render(<EventFlyerField currentUrl={null} onFileChange={vi.fn()} status="uploading" />);

    expect(screen.getByText(/Uploading flyer/i)).toBeInTheDocument();
  });

  it("labels a still-local selection 'Selected' — not 'Flyer ready' — before upload completes", async () => {
    const user = userEvent.setup();
    render(<EventFlyerField currentUrl={null} onFileChange={vi.fn()} />);

    await user.upload(
      screen.getByLabelText("Event flyer"),
      new File(["png"], "flyer.png", { type: "image/png" })
    );

    expect(screen.getByText("Selected")).toBeInTheDocument();
    expect(screen.queryByText("Flyer ready")).not.toBeInTheDocument();
  });

  it("labels a persisted flyer 'Flyer ready'", () => {
    render(
      <EventFlyerField currentUrl="https://example.com/flyer.png" onFileChange={vi.fn()} />
    );

    expect(screen.getByText("Flyer ready")).toBeInTheDocument();
  });

  it("renders a Try Again button on upload-error when onRetry is provided", () => {
    const onRetry = vi.fn();
    render(
      <EventFlyerField
        currentUrl="https://example.com/flyer.png"
        onFileChange={vi.fn()}
        onRetry={onRetry}
        status="upload-error"
        errorMessage="We couldn't upload this flyer."
      />
    );

    const retry = screen.getByRole("button", { name: /Try Again/i });
    retry.click();
    expect(onRetry).toHaveBeenCalled();
  });

  it("does not render Try Again on upload-error when no onRetry is provided", () => {
    render(
      <EventFlyerField
        currentUrl="https://example.com/flyer.png"
        onFileChange={vi.fn()}
        status="upload-error"
        errorMessage="We couldn't upload this flyer."
      />
    );

    expect(screen.queryByRole("button", { name: /Try Again/i })).not.toBeInTheDocument();
  });
});
