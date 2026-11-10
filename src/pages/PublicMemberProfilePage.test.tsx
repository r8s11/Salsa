import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import PublicMemberProfilePage from "./PublicMemberProfilePage";

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("../lib/supabase", () => ({
  supabase: { rpc: mocks.rpc },
}));

const payload = {
  username: "mariasalsa",
  display_name: "Maria Santos",
  avatar_url: null,
  cover_url: null,
  bio: "Dancing on1 since 2012.",
  city: "boston",
  city_name: "Boston",
  dance_styles: ["salsa"],
  instagram: "https://instagram.com/maria",
  website: null,
  member_since: "2026-01",
};

function renderAt(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/u/:username" element={<PublicMemberProfilePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("PublicMemberProfilePage", () => {
  beforeEach(() => {
    mocks.rpc.mockReset();
  });

  it("renders a public member profile as a member, not a listing", async () => {
    mocks.rpc.mockResolvedValue({
      data: { ...payload, activity: { events_hosted: 4 } },
      error: null,
    });
    renderAt("/u/MariaSalsa");

    expect(await screen.findByRole("heading", { level: 1, name: "Maria Santos" })).toBeInTheDocument();
    expect(mocks.rpc).toHaveBeenCalledWith("public_member_profile", { p_username: "MariaSalsa" });
    expect(screen.getByText("@mariasalsa")).toBeInTheDocument();
    expect(screen.getByText("Member profile")).toBeInTheDocument();
    expect(screen.getByText("Dancing in Boston · Member since Jan 2026")).toBeInTheDocument();
    expect(screen.getByText("Dancing on1 since 2012.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Instagram" })).toHaveAttribute(
      "href",
      "https://instagram.com/maria"
    );
    expect(screen.getByText("Events Hosted")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.queryByText(/claim/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /edit/i })).not.toBeInTheDocument();
  });

  it("hides activity when the payload omits it", async () => {
    mocks.rpc.mockResolvedValue({ data: payload, error: null });
    renderAt("/u/mariasalsa");

    await screen.findByRole("heading", { level: 1, name: "Maria Santos" });
    expect(screen.queryByText("Events Hosted")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Activity" })).not.toBeInTheDocument();
  });

  it("renders one not-found state for a null response", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: null });
    renderAt("/u/privateperson");

    expect(await screen.findByRole("heading", { level: 1, name: "Member not found" })).toBeInTheDocument();
    expect(screen.getByText(/no public member profile at this address/i)).toBeInTheDocument();
  });

  it("renders not-found without a request for a segment that cannot be a username", async () => {
    renderAt("/u/a-b");

    expect(await screen.findByRole("heading", { name: "Member not found" })).toBeInTheDocument();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("shows a retryable error state when the lookup fails", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    renderAt("/u/mariasalsa");

    expect(await screen.findByRole("alert")).toHaveTextContent(/couldn't load this profile/i);
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(screen.queryByText("Member not found")).not.toBeInTheDocument();
  });

  it("shows a loading state while the lookup is pending", () => {
    mocks.rpc.mockReturnValue(new Promise(() => {}));
    renderAt("/u/mariasalsa");

    expect(screen.getByRole("status")).toHaveTextContent(/loading profile/i);
  });
});
