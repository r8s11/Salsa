import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Contact from "./Contact";

type MockFetch = { mockRejectedValue: (v: unknown) => void; mockResolvedValue: (v: unknown) => void; mockReturnValue: (v: unknown) => void };

describe("Contact", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("renders four inline errors and focuses name on empty submit", async () => {
    render(<Contact />);
    fireEvent.click(screen.getByRole("button", { name: /send message/i }));

    expect(await screen.findByText(/please enter your name/i)).toBeInTheDocument();
    expect(screen.getByText(/please enter your email/i)).toBeInTheDocument();
    expect(screen.getByText(/please choose what you're interested in/i)).toBeInTheDocument();
    expect(screen.getByText(/please enter a message/i)).toBeInTheDocument();
    expect(document.getElementById("name")).toHaveFocus();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("shows email format error with aria-invalid and resolving aria-describedby", async () => {
    render(<Contact />);
    fireEvent.change(screen.getByLabelText(/^name/i), { target: { value: "Jane" } });
    fireEvent.change(screen.getByLabelText(/^email/i), { target: { value: "not-an-email" } });
    fireEvent.change(screen.getByLabelText(/interested in/i), { target: { value: "corporate" } });
    fireEvent.change(screen.getByLabelText(/^message/i), { target: { value: "Hello there" } });

    fireEvent.click(screen.getByRole("button", { name: /send message/i }));

    const emailInput = await screen.findByLabelText(/^email/i);
    expect(emailInput).toHaveAttribute("aria-invalid", "true");
    const describedBy = emailInput.getAttribute("aria-describedby");
    expect(describedBy).toBe("contact-email-error");
    expect(document.getElementById(describedBy as string)).toHaveTextContent(
      /valid email address/i
    );
  });

  it("clears a field's error as the user edits it", async () => {
    render(<Contact />);
    fireEvent.click(screen.getByRole("button", { name: /send message/i }));
    expect(await screen.findByText(/please enter your name/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/^name/i), { target: { value: "Jane" } });
    expect(screen.queryByText(/please enter your name/i)).not.toBeInTheDocument();
  });

  const fillValidForm = () => {
    fireEvent.change(screen.getByLabelText(/^name/i), { target: { value: "Jane" } });
    fireEvent.change(screen.getByLabelText(/^email/i), { target: { value: "jane@example.com" } });
    fireEvent.change(screen.getByLabelText(/interested in/i), { target: { value: "corporate" } });
    fireEvent.change(screen.getByLabelText(/^message/i), { target: { value: "Hello there" } });
  };

  it("renders actionable network copy and never 'Failed to fetch' on aborted fetch", async () => {
    (fetch as unknown as MockFetch).mockRejectedValue(new TypeError("Failed to fetch"));
    render(<Contact />);
    fillValidForm();
    fireEvent.click(screen.getByRole("button", { name: /send message/i }));

    await waitFor(() => {
      expect(screen.getByText(/check your connection and try again/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/^Failed to fetch$/i)).not.toBeInTheDocument();

    // values survive failure
    expect(screen.getByLabelText(/^name/i)).toHaveValue("Jane");
    expect(screen.getByLabelText(/^email/i)).toHaveValue("jane@example.com");
  });

  it("renders generic fallback copy on a non-ok response", async () => {
    (fetch as unknown as MockFetch).mockResolvedValue({
      ok: false,
      json: async () => ({ success: false }),
    });
    render(<Contact />);
    fillValidForm();
    fireEvent.click(screen.getByRole("button", { name: /send message/i }));

    expect(
      await screen.findByText(/we couldn't send your message\. please try again in a moment/i)
    ).toBeInTheDocument();
  });

  it("disables the submit button while pending", async () => {
    const { promise: fetchPromise, resolve: resolveFetch } = Promise.withResolvers<unknown>();
    (fetch as unknown as MockFetch).mockReturnValue(fetchPromise);
    render(<Contact />);
    fillValidForm();
    const button = screen.getByRole("button", { name: /send message/i });
    fireEvent.click(button);

    await waitFor(() => expect(button).toBeDisabled());
    resolveFetch({ ok: true, json: async () => ({ success: true }) });
  });
});
