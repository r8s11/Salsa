import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import FoundersPage from "./FoundersPage";
import { supabase } from "../lib/supabase";

vi.mock("../lib/supabase", () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
  },
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <FoundersPage />
    </MemoryRouter>
  );
}

async function fillAndSubmit(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/your name \*/i), "John Doe");
  await user.type(screen.getByLabelText(/email \*/i), "john@example.com");
  await user.type(screen.getByLabelText(/organization \/ event brand \*/i), "Salsa Nights Boston");
  await user.click(screen.getByRole("button", { name: /submit request/i }));
}

describe("FoundersPage", () => {
  beforeEach(() => {
    vi.mocked(supabase.functions.invoke).mockReset();
  });

  it("renders the request form without any authentication", () => {
    renderPage();

    // No auth provider, no signed-in user — the page is intentionally public.
    expect(screen.getByRole("heading", { name: /request host access/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/your name \*/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/organization \/ event brand \*/i)).toBeInTheDocument();
  });

  it("submits through the request-founder-access Edge Function and shows success", async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: { success: true },
      error: null,
    } as never);
    const user = userEvent.setup();
    renderPage();

    await fillAndSubmit(user);

    await waitFor(() => {
      expect(supabase.functions.invoke).toHaveBeenCalledWith(
        "request-founder-access",
        expect.objectContaining({
          body: expect.objectContaining({
            applicantName: "John Doe",
            email: "john@example.com",
            organizationName: "Salsa Nights Boston",
          }),
        })
      );
    });
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /request received/i })).toBeInTheDocument();
    });
  });

  it("shows a generic error when the Edge Function call fails", async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: null,
      error: { name: "FunctionsHttpError", message: "validation failed" },
    } as never);
    const user = userEvent.setup();
    renderPage();

    await fillAndSubmit(user);

    await waitFor(() => {
      expect(screen.getByText(/couldn't submit your request right now/i)).toBeInTheDocument();
    });
    // Raw error text is never surfaced.
    expect(screen.queryByText(/validation failed/i)).not.toBeInTheDocument();
  });
});