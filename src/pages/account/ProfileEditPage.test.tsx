import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ProfileEditPage from "./ProfileEditPage";

const mocks = vi.hoisted(() => ({
  auth: {
    user: { id: "user-1", email: "[EMAIL]" } as { id: string; email: string } | null,
  },
  profile: {
    profile: null as unknown,
    isLoading: false,
    error: null as string | null,
    refetch: vi.fn(),
  },
  update: {
    update: vi.fn(),
    isSaving: false,
    error: null as string | null,
  },
}));

vi.mock("../../contexts/useAuth", () => ({
  useAuth: () => mocks.auth,
}));

vi.mock("../../features/account/hooks/useOwnProfile", () => ({
  useOwnProfile: () => mocks.profile,
}));

vi.mock("../../features/account/hooks/useUpdateOwnProfile", () => ({
  useUpdateOwnProfile: () => mocks.update,
}));

function renderPage(initialPath = "/profile/edit") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/profile/edit" element={<ProfileEditPage />} />
          <Route path="/profile" element={<p>Profile destination</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

// Mirrors the real composition: MainLayout owns the single <main> landmark
// and the page renders into its <Outlet />.
function renderComposed(initialPath = "/profile/edit") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <main className="page-content">
          <Routes>
            <Route path="/profile/edit" element={<ProfileEditPage />} />
            <Route path="/profile" element={<p>Profile destination</p>} />
          </Routes>
        </main>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

function baseProfile(overrides: Record<string, unknown> = {}) {
  return {
    id: "user-1",
    display_name: "Maria Santos",
    username: "mariasalsa",
    avatar_url: null,
    status: "active",
    status_reason: null,
    created_at: "2026-01-15T00:00:00Z",
    bio: null,
    city: null,
    dance_styles: [],
    instagram: null,
    website: null,
    cover_url: null,
    public_profile: true,
    stats_public: true,
    notification_prefs: {},
    ...overrides,
  };
}

describe("ProfileEditPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.user = { id: "user-1", email: "[EMAIL]" };
    mocks.profile.profile = null;
    mocks.profile.isLoading = false;
    mocks.profile.error = null;
    mocks.profile.refetch.mockReset();
    mocks.update.update.mockReset();
    mocks.update.update.mockResolvedValue({});
    mocks.update.isSaving = false;
    mocks.update.error = null;
  });

  it("renders a single h1, the eyebrow, and the lede", () => {
    mocks.profile.profile = baseProfile();
    renderPage();

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByText("PROFILE SETTINGS")).toBeInTheDocument();
    expect(
      screen.getByText(/update how you appear across salsasegura/i)
    ).toBeInTheDocument();
  });

  it("links back to the public profile", () => {
    mocks.profile.profile = baseProfile();
    renderPage();

    const back = screen.getByRole("link", { name: /back to my profile/i });
    expect(back).toHaveAttribute("href", "/profile");
  });

  it("prefills the existing profile values and disables Save until changed", async () => {
    mocks.profile.profile = baseProfile();
    renderPage();

    const displayName = await screen.findByLabelText(/display name/i);
    const save = screen.getByRole("button", { name: "Save Changes" });

    expect((displayName as HTMLInputElement).value).toBe("Maria Santos");
    expect(save).toBeDisabled();
  });


  it("shows the public URL hint with the current username and the Phase 7 deferral", async () => {
    mocks.profile.profile = baseProfile();
    renderPage();

    // The hint is a single <p> whose text is concatenated across two
    // children. Find it via the parent element's textContent.
    const hint = await screen.findByText((_, element) => {
      if (!element) return false;
      if (element.tagName !== "P") return false;
      const text = element.textContent ?? "";
      return text.includes("salsasegura.com/u/mariasalsa") &&
        text.includes("Username changes arrive in a later update");
    });
    expect(hint).toBeInTheDocument();
  });
  it("renders the initials avatar fallback when no avatar_url is set", async () => {
    mocks.profile.profile = baseProfile({ display_name: "Maria Santos", avatar_url: null });
    renderPage();

    const heading = await screen.findByRole("heading", { name: "PHOTOS & NAME" });
    const section = heading.closest("section") as HTMLElement;
    expect(within(section).getByText("M")).toBeInTheDocument();
  });

  it("renders the avatar image when avatar_url is set", async () => {
    mocks.profile.profile = baseProfile({ avatar_url: "https://cdn.test/maria.png" });
    renderPage();

    const heading = await screen.findByRole("heading", { name: "PHOTOS & NAME" });
    const section = heading.closest("section") as HTMLElement;
    const img = within(section).getByRole("presentation", { hidden: true }) as HTMLImageElement;
    expect(img.getAttribute("src")).toBe("https://cdn.test/maria.png");
    expect(img.getAttribute("alt")).toBe("");
  });

  it("saves the bio, city, dance styles, and links the redesign added", async () => {
    mocks.profile.profile = baseProfile();
    mocks.update.update.mockResolvedValue(baseProfile());
    const user = userEvent.setup();
    renderPage();

    await user.type(await screen.findByLabelText("Bio"), "On2 every Thursday.");
    await user.selectOptions(screen.getByLabelText("City"), "boston");
    await user.click(screen.getByRole("button", { name: "Bachata" }));
    await user.type(screen.getByLabelText("Instagram"), "https://instagram.com/maria");
    await user.type(screen.getByLabelText("Website"), "https://maria.example");

    await user.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => expect(mocks.update.update).toHaveBeenCalled());
    const [patch] = mocks.update.update.mock.calls[0];
    expect(patch).toMatchObject({
      bio: "On2 every Thursday.",
      city: "boston",
      dance_styles: ["bachata"],
      instagram: "https://instagram.com/maria",
      website: "https://maria.example",
    });
  });

  it("blocks Save for a non-http link in a social field", async () => {
    mocks.profile.profile = baseProfile();
    const user = userEvent.setup();
    renderPage();

    await user.type(await screen.findByLabelText("Website"), "javascript:alert(1)");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /use a full link starting with https/i
    );
    expect(screen.getByRole("button", { name: "Save Changes" })).toBeDisabled();
  });

  it("saves the notification and privacy toggles the owner flipped", async () => {
    mocks.profile.profile = baseProfile();
    mocks.update.update.mockResolvedValue(baseProfile());
    const user = userEvent.setup();
    renderPage();

    await user.click(
      await screen.findByRole("switch", { name: "Show my activity numbers on my profile" })
    );
    await user.click(screen.getByRole("switch", { name: "Weekly digest of what's on" }));

    await user.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => expect(mocks.update.update).toHaveBeenCalled());
    const [patch] = mocks.update.update.mock.calls[0];
    expect(patch.stats_public).toBe(false);
    expect(patch.notification_prefs).toMatchObject({ weekly_digest: true });
  });

  it("rejects malformed photo URLs but enables Save when corrected", async () => {
    mocks.profile.profile = baseProfile();
    const user = userEvent.setup();
    renderPage();

    const photoUrl = await screen.findByLabelText("Photo URL");
    await user.type(photoUrl, "not-a-url");

    expect(await screen.findByRole("alert")).toHaveTextContent(/use a full link starting with https/i);
    expect(screen.getByRole("button", { name: "Save Changes" })).toBeDisabled();

    await user.clear(photoUrl);
    await user.type(photoUrl, "https://cdn.test/me.png");
    await waitFor(() => {
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });

  it("never sends username, role, or status to the update hook", async () => {
    mocks.profile.profile = baseProfile();
    mocks.update.update.mockResolvedValue(baseProfile());
    const user = userEvent.setup();
    renderPage();

    const displayName = await screen.findByLabelText(/display name/i);
    await user.clear(displayName);
    await user.type(displayName, "  Maria Lucia  ");
    await user.type(screen.getByLabelText("Photo URL"), "https://cdn.test/maria.png");

    await user.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => expect(mocks.update.update).toHaveBeenCalled());
    const [patch] = mocks.update.update.mock.calls[0];
    expect(patch).toMatchObject({
      display_name: "Maria Lucia",
      avatar_url: "https://cdn.test/maria.png",
    });
    expect(patch).not.toHaveProperty("username");
    expect(patch).not.toHaveProperty("role");
    expect(patch).not.toHaveProperty("status");
  });

  it("ignores typing in the disabled username field — the value never changes", async () => {
    mocks.profile.profile = baseProfile();
    const user = userEvent.setup();
    renderPage();

    const username = await screen.findByLabelText(/username/i);
    await user.type(username, "anything");

    expect((username as HTMLInputElement).value).toBe("mariasalsa");
  });

  it("surfaces a success notice after a real save and shows the updated value", async () => {
    mocks.profile.profile = baseProfile();
    mocks.update.update.mockResolvedValue(baseProfile({ display_name: "Maria L." }));
    const user = userEvent.setup();
    renderPage();

    const displayName = await screen.findByLabelText(/display name/i);
    await user.clear(displayName);
    await user.type(displayName, "Maria L.");

    await user.click(screen.getByRole("button", { name: "Save Changes" }));

    expect(await screen.findByText(/your profile is up to date/i)).toBeInTheDocument();
  });

  it("shows a clean page error without leaking the raw Supabase message", async () => {
    mocks.profile.profile = baseProfile();
    mocks.update.update.mockRejectedValue(new Error("duplicate key value violates unique constraint"));
    mocks.update.error = "duplicate key value violates unique constraint";
    const user = userEvent.setup();
    renderPage();

    const displayName = await screen.findByLabelText(/display name/i);
    await user.clear(displayName);
    await user.type(displayName, "Maria L.");

    await user.click(screen.getByRole("button", { name: "Save Changes" }));

    expect(
      await screen.findByText(/we couldn't save your changes\. please try again\./i)
    ).toBeInTheDocument();
    expect(screen.queryByText(/duplicate key value/i)).not.toBeInTheDocument();
  });

  it("preserves the typed values when a save fails", async () => {
    mocks.profile.profile = baseProfile();
    mocks.update.update.mockRejectedValue(new Error("RLS denied"));
    mocks.update.error = "RLS denied";
    const user = userEvent.setup();
    renderPage();

    const displayName = await screen.findByLabelText(/display name/i);
    await user.clear(displayName);
    await user.type(displayName, "  Maria Lucia  ");
    await user.type(screen.getByLabelText("Photo URL"), "https://cdn.test/maria.png");

    await user.click(screen.getByRole("button", { name: "Save Changes" }));

    await screen.findByText(/we couldn't save your changes/i);
    // The component trims only on submit; the input still reflects
    // what the user typed so they can retry without re-typing.
    expect((displayName as HTMLInputElement).value).toBe("  Maria Lucia  ");
    expect(
      (screen.getByLabelText("Photo URL") as HTMLInputElement).value
    ).toBe("https://cdn.test/maria.png");
  });

  it("disables Save when the display name is blank", async () => {
    mocks.profile.profile = baseProfile();
    const user = userEvent.setup();
    renderPage();

    const displayName = await screen.findByLabelText(/display name/i);
    await user.clear(displayName);

    expect(screen.getByRole("button", { name: "Save Changes" })).toBeDisabled();
  });

  it("routes Cancel back to /profile without invoking the update hook", async () => {
    mocks.profile.profile = baseProfile();
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Cancel" }));

    expect(screen.getByText("Profile destination")).toBeInTheDocument();
    expect(mocks.update.update).not.toHaveBeenCalled();
  });

  it("renders a loading skeleton while the profile is pending", () => {
    mocks.profile.profile = null;
    mocks.profile.isLoading = true;
    renderPage();

    expect(screen.getByRole("status")).toHaveTextContent(/loading your profile/i);
    expect(screen.queryByRole("button", { name: "Save Changes" })).not.toBeInTheDocument();
  });

  it("renders an error card with a Try Again retry affordance", async () => {
    mocks.profile.profile = null;
    mocks.profile.error = "Network unavailable";
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent(/we couldn't load your profile/i);

    await user.click(screen.getByRole("button", { name: "Try Again" }));
    expect(mocks.profile.refetch).toHaveBeenCalledOnce();
  });

  // ---- Phase 6 correction: preview must obey the save-time URL rule ----
  // Previously the preview rendered whenever the string was non-empty, so a
  // malformed URL or one with embedded credentials was assigned to src.
  // These assert the rendered DOM, not just a validator return value.

  function photoSection() {
    const heading = screen.getByRole("heading", { name: "PHOTOS & NAME" });
    return heading.closest("section") as HTMLElement;
  }

  it.each([
    ["a malformed value", "not-a-url"],
    ["a scheme-relative value", "//cdn.test/x.png"],
    ["a file: scheme", "file:///etc/passwd"],
    ["a javascript: scheme", "javascript:alert(1)"],
    ["a data: scheme", "data:image/png;base64,iVBORw0KGgo="],
    ["credentials in the authority", "https://user:pass@cdn.test/x.png"],
  ])("never assigns %s to the preview src", async (_label, value) => {
    mocks.profile.profile = baseProfile({ avatar_url: null });
    const user = userEvent.setup();
    renderPage();

    await user.type(await screen.findByLabelText("Photo URL"), value);

    const section = photoSection();
    expect(section.querySelector("img")).toBeNull();
    // and the initials fallback is what the user sees instead
    expect(within(section).getByText("M")).toBeInTheDocument();
  });

  it("previews a valid URL and keeps referrers off the request", async () => {
    mocks.profile.profile = baseProfile({ avatar_url: null });
    const user = userEvent.setup();
    renderPage();

    await user.type(await screen.findByLabelText("Photo URL"), "https://cdn.test/ok.png");

    const img = photoSection().querySelector("img") as HTMLImageElement;
    expect(img).not.toBeNull();
    expect(img.getAttribute("src")).toBe("https://cdn.test/ok.png");
    expect(img.getAttribute("referrerpolicy")).toBe("no-referrer");
  });

  it("falls back to initials when a syntactically valid preview image fails to load", async () => {
    mocks.profile.profile = baseProfile({ avatar_url: "https://cdn.test/gone.png" });
    renderPage();

    const img = (await screen.findByRole("presentation", { hidden: true })) as HTMLImageElement;
    fireEvent.error(img);

    const section = photoSection();
    expect(section.querySelector("img")).toBeNull();
    expect(within(section).getByText("M")).toBeInTheDocument();
  });

  it("retries the preview after a failed URL is replaced with a new one", async () => {
    mocks.profile.profile = baseProfile({ avatar_url: "https://cdn.test/gone.png" });
    const user = userEvent.setup();
    renderPage();

    fireEvent.error((await screen.findByRole("presentation", { hidden: true })) as HTMLImageElement);
    expect(photoSection().querySelector("img")).toBeNull();

    const photoUrl = screen.getByLabelText("Photo URL");
    await user.clear(photoUrl);
    await user.type(photoUrl, "https://cdn.test/fresh.png");

    const img = photoSection().querySelector("img") as HTMLImageElement;
    expect(img).not.toBeNull();
    expect(img.getAttribute("src")).toBe("https://cdn.test/fresh.png");
  });

  it("blocks Save for a credential-bearing URL the same way it blocks malformed input", async () => {
    mocks.profile.profile = baseProfile();
    const user = userEvent.setup();
    renderPage();

    await user.type(
      await screen.findByLabelText("Photo URL"),
      "https://user:pass@cdn.test/x.png"
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(/full link starting with https/i);
    expect(screen.getByRole("button", { name: "Save Changes" })).toBeDisabled();
    expect(mocks.update.update).not.toHaveBeenCalled();
  });

  // ---- Phase 6 correction: accessibility claims must be true ----

  it("contributes no main landmark of its own, leaving MainLayout's as the only one", () => {
    mocks.profile.profile = baseProfile();
    renderComposed();

    expect(screen.getAllByRole("main")).toHaveLength(1);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("associates the read-only username help text with the username input", async () => {
    mocks.profile.profile = baseProfile();
    renderPage();

    const username = (await screen.findByLabelText(/username/i)) as HTMLInputElement;
    const describedBy = username.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    const help = document.getElementById(describedBy as string);
    expect(help?.textContent).toMatch(/username changes arrive in a later update/i);
  });

  it("associates the photo hint with the photo input, and swaps in the error when invalid", async () => {
    mocks.profile.profile = baseProfile();
    const user = userEvent.setup();
    renderPage();

    const photoUrl = (await screen.findByLabelText("Photo URL")) as HTMLInputElement;
    const hintId = photoUrl.getAttribute("aria-describedby");
    expect(hintId).toBeTruthy();
    expect(document.getElementById(hintId as string)?.textContent).toMatch(/hosted image/i);
    expect(photoUrl.getAttribute("aria-invalid")).toBeNull();

    await user.type(photoUrl, "not-a-url");

    expect(photoUrl.getAttribute("aria-invalid")).toBe("true");
    const ids = (photoUrl.getAttribute("aria-describedby") ?? "").split(/\s+/);
    const texts = ids.map((id) => document.getElementById(id)?.textContent ?? "").join(" ");
    expect(texts).toMatch(/full link starting with https/i);
  });

  it("marks a blank required display name as invalid", async () => {
    mocks.profile.profile = baseProfile();
    const user = userEvent.setup();
    renderPage();

    const displayName = (await screen.findByLabelText(/display name/i)) as HTMLInputElement;
    expect(displayName.getAttribute("aria-invalid")).toBeNull();

    await user.clear(displayName);

    expect(displayName.getAttribute("aria-invalid")).toBe("true");
    const describedBy = displayName.getAttribute("aria-describedby");
    expect(document.getElementById(describedBy as string)?.textContent).toMatch(/required/i);
  });
});
