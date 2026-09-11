import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import FounderRequestForm from "./FounderRequestForm";
import type { FounderRequestPayload } from "../../lib/founderRequest";

const validPayload: FounderRequestPayload = {
  applicantName: "John Doe",
  email: "john@example.com",
  organizationName: "Salsa Nights Boston",
  instagram: "@salsanights",
  website: "https://salsanights.com",
  city: "Boston",
  region: "MA",
  description: "We run weekly salsa socials",
  message: "Looking forward to joining",
};

function renderForm(
  onSubmit: (p: FounderRequestPayload) => Promise<{ success: boolean }> = vi.fn().mockResolvedValue({ success: true })
) {
  return render(
    <MemoryRouter>
      <FounderRequestForm onSubmit={onSubmit} />
    </MemoryRouter>
  );
}

async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/your name \*/i), validPayload.applicantName);
  await user.type(screen.getByLabelText(/email \*/i), validPayload.email);
  await user.type(screen.getByLabelText(/organization \/ event brand \*/i), validPayload.organizationName);
}

describe("FounderRequestForm", () => {
  it("renders all required and optional fields", () => {
    renderForm();

    expect(screen.getByLabelText(/your name \*/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email \*/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/organization \/ event brand \*/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/instagram/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^website$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/city/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/region \/ state/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/tell us about your events/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/anything else you.d like us to know/i)).toBeInTheDocument();
  });

  it("renders a hidden honeypot field excluded from the tab order", () => {
    renderForm();

    const honeypot = screen.getByLabelText("Company website");
    expect(honeypot).toBeInTheDocument();
    expect(honeypot).toHaveAttribute("tabIndex", "-1");
    expect(honeypot.closest(".honeypot")).toHaveAttribute("aria-hidden", "true");
  });

  it("shows validation errors for empty required fields", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("button", { name: /submit request/i }));

    await waitFor(() => {
      expect(screen.getByText(/your name is required/i)).toBeInTheDocument();
      expect(screen.getByText(/email is required/i)).toBeInTheDocument();
      expect(screen.getByText(/organization name is required/i)).toBeInTheDocument();
    });
  });

  it("shows email format error", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(/email \*/i), "not-an-email");
    await user.click(screen.getByRole("button", { name: /submit request/i }));

    await waitFor(() => {
      expect(screen.getByText(/invalid email format/i)).toBeInTheDocument();
    });
  });

  it("shows max length errors", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(/your name \*/i), "a".repeat(256));
    await user.type(screen.getByLabelText(/email \*/i), "john@example.com");
    await user.type(screen.getByLabelText(/organization \/ event brand \*/i), "a".repeat(256));
    await user.click(screen.getByRole("button", { name: /submit request/i }));

    await waitFor(() => {
      expect(screen.getByText(/^name too long/i)).toBeInTheDocument();
      expect(screen.getByText(/organization name too long/i)).toBeInTheDocument();
    });
  });

  it("validates website URL format", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(/^website$/i), "not-a-url");
    await user.click(screen.getByRole("button", { name: /submit request/i }));

    await waitFor(() => {
      expect(screen.getByText(/website must start with http/i)).toBeInTheDocument();
    });
  });

  it("submits valid form with normalized values and shows the success state", async () => {
    const onSubmit = vi.fn().mockResolvedValue({ success: true });
    const user = userEvent.setup();
    renderForm(onSubmit);

    await fillRequiredFields(user);
    await user.type(screen.getByLabelText(/instagram/i), validPayload.instagram!);
    await user.type(screen.getByLabelText(/^website$/i), validPayload.website!);
    await user.type(screen.getByLabelText(/city/i), validPayload.city!);
    await user.type(screen.getByLabelText(/region \/ state/i), validPayload.region!);
    await user.type(screen.getByLabelText(/tell us about your events/i), validPayload.description!);
    await user.type(screen.getByLabelText(/anything else you.d like us to know/i), validPayload.message!);

    await user.click(screen.getByRole("button", { name: /submit request/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        applicantName: "John Doe",
        email: "john@example.com",
        organizationName: "Salsa Nights Boston",
        instagram: "salsanights",
        website: "https://salsanights.com",
      })
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /request received/i })).toBeInTheDocument();
    });
    // Enumeration-safe copy covers the duplicate case without distinguishing it.
    expect(screen.getByText(/no need to submit again/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /return home/i })).toHaveAttribute("href", "/");
  });

  it("moves focus to the success heading after submission", async () => {
    const user = userEvent.setup();
    renderForm();

    await fillRequiredFields(user);
    await user.click(screen.getByRole("button", { name: /submit request/i }));

    const heading = await screen.findByRole("heading", { name: /request received/i });
    await waitFor(() => {
      expect(heading).toHaveFocus();
    });
  });

  it("shows a generic error state on submit failure and retains form values", async () => {
    const onSubmit = vi.fn().mockResolvedValue({ success: false });
    const user = userEvent.setup();
    renderForm(onSubmit);

    await fillRequiredFields(user);
    await user.click(screen.getByRole("button", { name: /submit request/i }));

    await waitFor(() => {
      expect(screen.getByText(/couldn't submit your request right now/i)).toBeInTheDocument();
    });
    // Form values are retained after failure.
    expect(screen.getByLabelText(/your name \*/i)).toHaveValue("John Doe");
    expect(screen.getByLabelText(/email \*/i)).toHaveValue("john@example.com");
  });

  it("shows a generic error when the submit call throws", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error("Network error"));
    const user = userEvent.setup();
    renderForm(onSubmit);

    await fillRequiredFields(user);
    await user.click(screen.getByRole("button", { name: /submit request/i }));

    await waitFor(() => {
      expect(screen.getByText(/couldn't submit your request right now/i)).toBeInTheDocument();
    });
  });

  it("shows a loading state and prevents double submission", async () => {
    let resolveSubmit: ((v: { success: boolean }) => void) | undefined;
    const onSubmit = vi.fn().mockImplementation(
      () =>
        new Promise<{ success: boolean }>((resolve) => {
          resolveSubmit = resolve;
        })
    );
    const user = userEvent.setup();
    renderForm(onSubmit);

    await fillRequiredFields(user);
    await user.click(screen.getByRole("button", { name: /submit request/i }));

    // Button switches to a disabled loading state while the promise is pending.
    const pendingButton = await screen.findByRole("button", { name: /submitting…/i });
    expect(pendingButton).toBeDisabled();
    expect(onSubmit).toHaveBeenCalledTimes(1);

    // A second click on the disabled button does not submit again.
    await user.click(pendingButton).catch(() => {});
    expect(onSubmit).toHaveBeenCalledTimes(1);

    resolveSubmit?.({ success: true });
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /request received/i })).toBeInTheDocument();
    });
  });

  it("clears a field error when the user edits that field", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("button", { name: /submit request/i }));
    await waitFor(() => {
      expect(screen.getByText(/your name is required/i)).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText(/your name \*/i), "John");

    await waitFor(() => {
      expect(screen.queryByText(/your name is required/i)).not.toBeInTheDocument();
    });
  });

  it("focuses the first invalid field after a failed submit", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue({ success: true });
    renderForm(onSubmit);

    await user.click(screen.getByRole("button", { name: /submit request/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/your name \*/i)).toHaveFocus();
    });
    expect(onSubmit).not.toHaveBeenCalled();

    // With the name supplied, focus moves to the next field that still fails.
    await user.type(screen.getByLabelText(/your name \*/i), "John Doe");
    await user.click(screen.getByRole("button", { name: /submit request/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/email \*/i)).toHaveFocus();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });
});