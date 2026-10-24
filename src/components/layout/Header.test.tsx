import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { User } from "@supabase/supabase-js";
import type { AuthContextValue } from "../../contexts/authContextObject";
import { useAuth } from "../../contexts/useAuth";
import { useCity } from "../../contexts/useCity";
import type { CityContextValue } from "../../contexts/cityContextObject";
import type { OwnProfile } from "../../features/account/model/account";
import { useOwnProfile } from "../../features/account/hooks/useOwnProfile";
import { useMetroName } from "../../features/metros/hooks/useMetros";
import { useCart } from "../../features/shopify/cart/useCart";
import type { CartState } from "../../features/shopify/cart/CartContext";
import { SHOP_NAV } from "../../features/shopify/collections";
import type { RankedMetro } from "../../features/metros/model/metro";
import Header from "./Header";

vi.mock("../../contexts/useAuth", () => ({ useAuth: vi.fn() }));
vi.mock("../../contexts/useCity", () => ({ useCity: vi.fn() }));
vi.mock("../../features/account/hooks/useOwnProfile", () => ({ useOwnProfile: vi.fn() }));
vi.mock("../../features/metros/hooks/useMetros", () => ({ useMetroName: vi.fn() }));
vi.mock("../../features/shopify/cart/useCart", () => ({ useCart: vi.fn() }));

afterEach(() => vi.unstubAllGlobals());

const setCity = vi.fn();
const chooseNearMe = vi.fn();
const setCartOpen = vi.fn();

function mockCart(totalQuantity?: number) {
  vi.mocked(useCart).mockReturnValue({
    cart: totalQuantity === undefined ? null : { totalQuantity },
    setOpen: setCartOpen,
  } as unknown as CartState);
}

beforeEach(() => {
  setCartOpen.mockClear();
  mockCart();
});

const activeMetros: RankedMetro[] = [
  {
    slug: "boston",
    name: "Boston",
    stateRegion: "MA",
    countryCode: "US",
    latitude: 42.3601,
    longitude: -71.0589,
    upcomingEventCount: 5,
    nextEventAt: "2099-01-01T00:00:00Z",
    distanceKm: null,
  },
  {
    slug: "new-york-city",
    name: "New York City",
    stateRegion: "NY",
    countryCode: "US",
    latitude: 40.7128,
    longitude: -74.006,
    upcomingEventCount: 5,
    nextEventAt: "2099-01-01T00:00:00Z",
    distanceKm: null,
  },
];

function mockCityValue(city: CityContextValue["city"] = "boston") {
  vi.mocked(useCity).mockReturnValue({
    city,
    source: "explicit",
    resolving: false,
    setCity,
    chooseNearMe,
    activeMetros,
    activeMetrosError: null,
    locationStatus: "idle",
  });
}

const metroNameLookup = (slug: string | null | undefined) =>
  slug === "boston" ? "Boston" : slug === "new-york-city" ? "New York City" : (slug ?? "");

const defaultAuth = (overrides: Partial<AuthContextValue> = {}): AuthContextValue => ({
  user: null,
  session: null,
  loading: false,
  role: null,
  isAdmin: false,
  isModerator: false,
  isOrganizer: false,
  signInWithPassword: vi.fn(),
  resendConfirmation: vi.fn(),
  requestPasswordReset: vi.fn(),
  updateEmail: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn().mockResolvedValue(undefined),
  clearDeletedAccount: vi.fn(),
  ...overrides,
});

const defaultProfileQuery = () => ({
  profile: null,
  isLoading: false,
  error: null,
  refetch: vi.fn(),
});

const memberProfile = (overrides: Partial<OwnProfile> = {}): OwnProfile => ({
  id: "member",
  display_name: null,
  username: null,
  avatar_url: null,
  status: "active",
  status_reason: null,
  created_at: "2026-01-01T00:00:00Z",
  bio: null,
  city: null,
  dance_styles: [],
  instagram: null,
  website: null,
  cover_url: null,
  public_profile: true,
  stats_public: true,
  notification_prefs: {},
  onboarding_completed_at: null,
  ...overrides,
});

function renderHeader(initialEntry = "/") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route
          path="*"
          element={
            <>
              <Header />
              <main>
                Destination <button type="button">Destination action</button>
              </main>
            </>
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

describe("Header", () => {
  beforeEach(() => {
    vi.mocked(useOwnProfile).mockReturnValue(defaultProfileQuery());
    vi.mocked(useMetroName).mockReturnValue(metroNameLookup);
  });

  it("renders the logo home link, exact primary navigation, and guest sign in", () => {
    vi.mocked(useAuth).mockReturnValue(defaultAuth());
    mockCityValue("boston");

    renderHeader();

    expect(screen.getByRole("link", { name: /salsa segura/i })).toHaveAttribute("href", "/");
    expect(screen.getAllByRole("link", { name: "Calendar" })).toHaveLength(1);
    expect(screen.queryByRole("link", { name: "Lessons" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Instructors" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "About" })).toHaveLength(1);
    expect(screen.getAllByRole("link", { name: "Contact" })).toHaveLength(1);
    expect(screen.queryByRole("link", { name: "Events" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Sign In" })[0]).toHaveAttribute("href", "/signin");
  });

  it("shows a short city code in the compact picker without losing its full name", () => {
    vi.mocked(useAuth).mockReturnValue(defaultAuth());
    mockCityValue("new-york-city");

    const { container } = renderHeader();
    const compactPicker = container.querySelector(".metro-explorer--compact") as HTMLElement;
    expect(within(compactPicker).getByText("NYC")).toBeInTheDocument();
    expect(
      within(compactPicker).getByRole("button", {
        name: "City: New York City. Explore other cities",
      })
    ).toBeInTheDocument();
  });

  it("renders member account disclosure without Dashboard", () => {
    vi.mocked(useAuth).mockReturnValue(defaultAuth({ user: { id: "member" } as User }));
    mockCityValue("boston");

    renderHeader();

    const account = screen.getByLabelText("Open account menu").closest("details");
    expect(account).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Submit Event" })[0]).toHaveAttribute(
      "href",
      "/submit"
    );
    expect(
      within(account as HTMLElement).getByRole("link", { name: "My Profile" })
    ).toHaveAttribute("href", "/profile");
    expect(
      within(account as HTMLElement).getByRole("button", { name: "Sign Out" })
    ).toBeInTheDocument();
    expect(screen.queryAllByRole("link", { name: "Dashboard" })).toHaveLength(0);
  });

  it("labels the reviewer dashboard by role", () => {
    vi.mocked(useAuth).mockReturnValue(
      defaultAuth({ user: { id: "admin" } as User, isAdmin: true, isModerator: true })
    );
    mockCityValue("boston");

    renderHeader();

    expect(screen.getAllByRole("link", { name: "Admin" })[0]).toHaveAttribute("href", "/admin");
    expect(screen.queryByRole("link", { name: "Moderator" })).not.toBeInTheDocument();
  });

  it("labels a moderator without admin as Moderator", () => {
    vi.mocked(useAuth).mockReturnValue(
      defaultAuth({ user: { id: "mod" } as User, isModerator: true })
    );
    mockCityValue("boston");

    renderHeader();

    expect(screen.getAllByRole("link", { name: "Moderator" })[0]).toHaveAttribute("href", "/admin");
    expect(screen.queryByRole("link", { name: "Admin" })).not.toBeInTheDocument();
  });

  it("renders no DASHBOARDS section for a guest", () => {
    vi.mocked(useAuth).mockReturnValue(defaultAuth());
    mockCityValue("boston");

    renderHeader();

    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Host" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Admin" })).not.toBeInTheDocument();
  });

  it("renders no DASHBOARDS section for a regular authenticated user with no role", () => {
    vi.mocked(useAuth).mockReturnValue(defaultAuth({ user: { id: "member" } as User }));
    mockCityValue("boston");

    renderHeader();

    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Host" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Admin" })).not.toBeInTheDocument();
  });

  it("renders the Host dashboard link in both desktop and mobile blocks", async () => {
    vi.mocked(useAuth).mockReturnValue(
      defaultAuth({ user: { id: "organizer" } as User, isOrganizer: true })
    );
    mockCityValue("boston");
    const user = userEvent.setup();
    renderHeader();

    const desktopAccount = screen
      .getByLabelText("Open account menu")
      .closest("details") as HTMLElement;
    expect(within(desktopAccount).getByRole("link", { name: "Host" })).toHaveAttribute(
      "href",
      "/host"
    );

    await user.click(screen.getByRole("button", { name: "Open menu" }));
    const drawer = document.getElementById("site-navigation") as HTMLElement;
    const mobileAccount = within(drawer).getByRole("region", { name: "Account" });
    expect(within(mobileAccount).getByRole("link", { name: "Host" })).toHaveAttribute(
      "href",
      "/host"
    );
  });

  it("removes dashboard links after sign out", async () => {
    const signOutResult = Promise.withResolvers<{ error: null }>();
    const signOut = vi.fn(() => signOutResult.promise);
    vi.mocked(useAuth).mockReturnValue(
      defaultAuth({ user: { id: "moderator" } as User, isModerator: true, signOut })
    );
    mockCityValue("boston");
    const user = userEvent.setup();
    const { rerender } = renderHeader();

    expect(screen.getAllByRole("link", { name: "Moderator" }).length).toBeGreaterThan(0);

    await user.click(screen.getAllByRole("button", { name: "Sign Out" })[0]);
    expect(signOut).toHaveBeenCalledWith("global");
    signOutResult.resolve({ error: null });

    vi.mocked(useAuth).mockReturnValue(defaultAuth());
    rerender(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route
            path="*"
            element={
              <>
                <Header />
                <main>Destination</main>
              </>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() =>
      expect(screen.queryByRole("link", { name: "Moderator" })).not.toBeInTheDocument()
    );
  });

  it("opens and closes the drawer after a navigation link", async () => {
    vi.mocked(useAuth).mockReturnValue(defaultAuth());
    mockCityValue("boston");
    const user = userEvent.setup();
    renderHeader();

    await user.click(screen.getByRole("button", { name: "Open menu" }));
    expect(screen.getByRole("button", { name: "Close menu" })).toHaveAttribute(
      "aria-expanded",
      "true"
    );
    await user.click(screen.getByRole("link", { name: "Calendar" }));
    expect(screen.getByRole("button", { name: "Open menu" })).toHaveAttribute(
      "aria-expanded",
      "false"
    );
  });

  it("turns to condensed glass only past 100px of scroll, and keeps full height while the menu is open", async () => {
    vi.mocked(useAuth).mockReturnValue(defaultAuth());
    mockCityValue("boston");
    const user = userEvent.setup();
    const scrollTo = (y: number) => {
      Object.defineProperty(window, "scrollY", { configurable: true, value: y });
      fireEvent.scroll(window);
    };
    renderHeader();
    const bar = screen.getByRole("banner");
    expect(bar).toHaveAttribute("data-glass", "false");
    expect(bar).toHaveAttribute("data-condensed", "false");

    scrollTo(100);
    expect(bar).toHaveAttribute("data-condensed", "false");
    scrollTo(101);
    expect(bar).toHaveAttribute("data-glass", "true");
    expect(bar).toHaveAttribute("data-condensed", "true");

    await user.click(screen.getByRole("button", { name: "Open menu" }));
    const sheet = screen.getByRole("dialog", { name: "Site navigation" });
    expect(sheet).toHaveAttribute("data-glass", "true");
    expect(sheet).toHaveAttribute("data-condensed", "false");
    await user.click(screen.getByRole("button", { name: "Close menu" }));

    scrollTo(0);
    expect(screen.getByRole("banner")).toHaveAttribute("data-glass", "false");
    expect(screen.getByRole("banner")).toHaveAttribute("data-condensed", "false");
  });

  it("closes the drawer after a guest action", async () => {
    vi.mocked(useAuth).mockReturnValue(defaultAuth());
    mockCityValue("boston");
    const user = userEvent.setup();
    renderHeader();

    await user.click(screen.getByRole("button", { name: "Open menu" }));
    await user.click(
      within(document.getElementById("site-navigation") as HTMLElement).getByRole("link", {
        name: "Sign In",
      })
    );
    expect(screen.getByRole("button", { name: "Open menu" })).toHaveAttribute(
      "aria-expanded",
      "false"
    );
  });

  it("awaits member sign out and closes the drawer", async () => {
    const signOutResult = Promise.withResolvers<{ error: null }>();
    const signOut = vi.fn(() => signOutResult.promise);
    vi.mocked(useAuth).mockReturnValue(defaultAuth({ user: { id: "member" } as User, signOut }));
    mockCityValue("boston");
    const user = userEvent.setup();
    renderHeader();

    await user.click(screen.getByRole("button", { name: "Open menu" }));
    await user.click(
      within(document.getElementById("site-navigation") as HTMLElement).getByRole("button", {
        name: "Sign Out",
      })
    );
    expect(signOut).toHaveBeenCalledWith("global");
    expect(screen.getByRole("button", { name: "Close menu" })).toHaveAttribute(
      "aria-expanded",
      "true"
    );
    signOutResult.resolve({ error: null });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Open menu" })).toHaveAttribute(
        "aria-expanded",
        "false"
      )
    );
  });

  it("contains keyboard focus in the mobile navigation and restores it on dismissal", async () => {
    vi.mocked(useAuth).mockReturnValue(defaultAuth());
    mockCityValue("boston");
    const user = userEvent.setup();
    renderHeader();

    const opener = screen.getByRole("button", { name: "Open menu" });
    const main = screen.getByRole("main");
    await user.click(opener);
    expect(main).toHaveAttribute("inert");
    const dialog = screen.getByRole("dialog", { name: "Site navigation" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    const close = within(dialog).getByRole("button", { name: "Close menu" });
    expect(close).toHaveFocus();

    await user.tab();
    const first = within(dialog).getByRole("link", { name: /salsa segura/i });
    expect(first).toHaveFocus();
    await user.tab({ shift: true });
    expect(close).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(main).not.toHaveAttribute("inert");
    expect(opener).toHaveFocus();
    expect(screen.queryByRole("dialog", { name: "Site navigation" })).not.toBeInTheDocument();
  });

  it("releases the public page after choosing a mobile navigation destination", async () => {
    vi.mocked(useAuth).mockReturnValue(defaultAuth());
    mockCityValue("boston");
    const user = userEvent.setup();
    renderHeader();

    const main = screen.getByRole("main");
    await user.click(screen.getByRole("button", { name: "Open menu" }));
    expect(main).toHaveAttribute("inert");
    await user.click(screen.getByRole("link", { name: "Calendar" }));
    expect(main).not.toHaveAttribute("inert");
    expect(screen.getByRole("button", { name: "Open menu" })).toHaveAttribute(
      "aria-expanded",
      "false"
    );
    screen.getByRole("button", { name: "Destination action" }).focus();
    expect(screen.getByRole("button", { name: "Destination action" })).toHaveFocus();
  });

  it("releases background focus when an open mobile menu becomes desktop navigation", async () => {
    vi.mocked(useAuth).mockReturnValue(defaultAuth());
    mockCityValue("boston");
    const user = userEvent.setup();
    renderHeader();

    const main = screen.getByRole("main");
    await user.click(screen.getByRole("button", { name: "Open menu" }));
    expect(main).toHaveAttribute("inert");
    vi.stubGlobal("innerWidth", 1440);
    fireEvent(window, new Event("resize"));

    expect(main).not.toHaveAttribute("inert");
    expect(screen.getByRole("button", { name: "Open menu" })).toHaveAttribute(
      "aria-expanded",
      "false"
    );
    expect(document.body.style.overflow).not.toBe("hidden");
  });

  it("closes the drawer with Escape", async () => {
    vi.mocked(useAuth).mockReturnValue(defaultAuth());
    mockCityValue("boston");
    const user = userEvent.setup();
    renderHeader();

    await user.click(screen.getByRole("button", { name: "Open menu" }));
    await user.keyboard("{Escape}");
    expect(screen.getByRole("button", { name: "Open menu" })).toHaveAttribute(
      "aria-expanded",
      "false"
    );
  });

  it("groups signed-out mobile navigation into destinations, city, and account actions", async () => {
    vi.mocked(useAuth).mockReturnValue(defaultAuth());
    mockCityValue("boston");
    const user = userEvent.setup();
    renderHeader();

    await user.click(screen.getByRole("button", { name: "Open menu" }));
    const drawer = document.getElementById("site-navigation") as HTMLElement;
    const city = within(drawer).getByRole("region", { name: "Your city" });
    const account = within(drawer).getByRole("region", { name: "Account" });

    expect(within(drawer).getByText("Explore Salsa Segura")).toBeInTheDocument();
    expect(within(account).getByRole("link", { name: "Submit Event" })).toHaveClass("ui-button");
    expect(within(account).getByRole("link", { name: "Sign In" })).toHaveAttribute(
      "href",
      "/signin"
    );
    expect(within(city).getByRole("button", { name: /Boston/ })).toBeInTheDocument();
  });

  it("keeps member and moderator actions inside the mobile account group", async () => {
    vi.mocked(useAuth).mockReturnValue(
      defaultAuth({ user: { id: "moderator" } as User, isModerator: true })
    );
    mockCityValue("new-york-city");
    const user = userEvent.setup();
    renderHeader();

    await user.click(screen.getByRole("button", { name: "Open menu" }));
    const drawer = document.getElementById("site-navigation") as HTMLElement;
    const account = within(drawer).getByRole("region", { name: "Account" });
    const city = within(drawer).getByRole("region", { name: "Your city" });

    expect(within(account).getByRole("link", { name: "My Profile" })).toHaveAttribute(
      "href",
      "/profile"
    );
    expect(within(account).getByRole("link", { name: "Moderator" })).toHaveAttribute(
      "href",
      "/admin"
    );
    expect(within(account).getByRole("button", { name: "Sign Out" })).toBeInTheDocument();
    expect(within(city).getByRole("button", { name: /New York/ })).toBeInTheDocument();
  });

  it("picks a city from the mobile explorer and closes the drawer", async () => {
    vi.mocked(useAuth).mockReturnValue(defaultAuth());
    mockCityValue("boston");
    const user = userEvent.setup();
    renderHeader();

    await user.click(screen.getByRole("button", { name: "Open menu" }));
    const drawer = document.getElementById("site-navigation") as HTMLElement;
    const city = within(drawer).getByRole("region", { name: "Your city" });
    await user.click(within(city).getByRole("button", { name: /Boston/ }));
    await user.click(screen.getByRole("button", { name: /New York City/ }));

    expect(setCity).toHaveBeenCalledWith("new-york-city");
    expect(screen.getByRole("button", { name: "Open menu" })).toHaveAttribute(
      "aria-expanded",
      "false"
    );
  });

  it("uses rose-red CTA only for Submit Event and quiet secondary style for Sign In", async () => {
    vi.mocked(useAuth).mockReturnValue(defaultAuth());
    mockCityValue("boston");
    const user = userEvent.setup();
    renderHeader();

    await user.click(screen.getByRole("button", { name: "Open menu" }));
    const drawer = document.getElementById("site-navigation") as HTMLElement;
    const account = within(drawer).getByRole("region", { name: "Account" });

    expect(within(account).getByRole("link", { name: "Submit Event" })).toHaveClass("ui-button");
    expect(within(account).getByRole("link", { name: "Sign In" })).toHaveClass("ui-button");
  });

  it("shows the profile photo inside the account menu trigger when avatar_url is set", () => {
    vi.mocked(useAuth).mockReturnValue(
      defaultAuth({ user: { id: "member", email: "member@example.com" } as User })
    );
    mockCityValue("boston");
    vi.mocked(useOwnProfile).mockReturnValue({
      ...defaultProfileQuery(),
      profile: memberProfile({
        display_name: "Sofia Martinez",
        username: "sofia",
        avatar_url: "https://example.com/sofia.jpg",
      }),
    });

    renderHeader();
    const trigger = screen.getByLabelText("Open account menu");
    const img = trigger.querySelector("img.account-avatar");
    expect(img).toHaveAttribute("src", "https://example.com/sofia.jpg");
  });

  it("falls back to display_name initials when there is no avatar_url", () => {
    vi.mocked(useAuth).mockReturnValue(defaultAuth({ user: { id: "member" } as User }));
    mockCityValue("boston");
    vi.mocked(useOwnProfile).mockReturnValue({
      ...defaultProfileQuery(),
      profile: memberProfile({ display_name: "Sofia Martinez" }),
    });

    renderHeader();

    const trigger = screen.getByLabelText("Open account menu");
    expect(trigger.querySelector("img")).not.toBeInTheDocument();
    expect(trigger).toHaveTextContent("SM");
  });

  it("falls back through username then email when display_name is missing", () => {
    vi.mocked(useAuth).mockReturnValue(
      defaultAuth({ user: { id: "member", email: "dancefan@example.com" } as User })
    );
    mockCityValue("boston");
    vi.mocked(useOwnProfile).mockReturnValue({
      ...defaultProfileQuery(),
      profile: memberProfile({ username: "@sofia" }),
    });

    const { rerender } = renderHeader();
    expect(screen.getByLabelText("Open account menu")).toHaveTextContent("S");

    vi.mocked(useOwnProfile).mockReturnValue({
      ...defaultProfileQuery(),
      profile: memberProfile(),
    });
    rerender(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route
            path="*"
            element={
              <>
                <Header />
                <main>Destination</main>
              </>
            }
          />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByLabelText("Open account menu")).toHaveTextContent("D");
  });

  it("exposes 'Open account menu' as the accessible name, not the initials text", () => {
    vi.mocked(useAuth).mockReturnValue(defaultAuth({ user: { id: "member" } as User }));
    mockCityValue("boston");
    vi.mocked(useOwnProfile).mockReturnValue({
      ...defaultProfileQuery(),
      profile: memberProfile({ display_name: "Roosevelt" }),
    });

    renderHeader();

    const trigger = screen.getByLabelText("Open account menu");
    expect(trigger.tagName).toBe("SUMMARY");
    expect(screen.queryByLabelText("R")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "R" })).not.toBeInTheDocument();
  });

  it("still reveals My Account, My Profile, and Sign Out when the avatar trigger is open", () => {
    vi.mocked(useAuth).mockReturnValue(defaultAuth({ user: { id: "member" } as User }));
    mockCityValue("boston");

    renderHeader();

    const details = screen
      .getByLabelText("Open account menu")
      .closest("details") as HTMLDetailsElement;
    details.open = true;

    expect(within(details).getByRole("link", { name: "My Account" })).toHaveAttribute(
      "href",
      "/account"
    );
    expect(within(details).getByRole("link", { name: "My Profile" })).toHaveAttribute(
      "href",
      "/profile"
    );
    expect(within(details).getByRole("button", { name: "Sign Out" })).toBeInTheDocument();
  });

  it("shows the signed-in identity in the account disclosure without replacing its destinations", async () => {
    vi.mocked(useAuth).mockReturnValue(
      defaultAuth({
        user: { id: "member", email: "sofia@example.com" } as User,
        isAdmin: true,
      })
    );
    vi.mocked(useOwnProfile).mockReturnValue({
      ...defaultProfileQuery(),
      profile: memberProfile({ display_name: "Sofia Martinez" }),
    });
    mockCityValue();
    const user = userEvent.setup();
    renderHeader();
    await user.click(screen.getByLabelText("Open account menu"));
    const disclosure = screen.getByLabelText("Open account menu").closest("details")!;
    expect(within(disclosure).getByText("Sofia Martinez")).toBeInTheDocument();
    expect(within(disclosure).getByText("sofia@example.com")).toBeInTheDocument();
    expect(within(disclosure).getByRole("link", { name: "My Account" })).toHaveAttribute(
      "href",
      "/account"
    );
    expect(within(disclosure).getByRole("link", { name: "Admin" })).toHaveAttribute(
      "href",
      "/admin"
    );
  });

  it("returns focus to the avatar when Escape dismisses the account disclosure", async () => {
    vi.mocked(useAuth).mockReturnValue(defaultAuth({ user: { id: "member" } as User }));
    mockCityValue();
    const user = userEvent.setup();
    renderHeader();
    const trigger = screen.getByLabelText("Open account menu");
    await user.click(trigger);
    const details = trigger.closest("details")!;
    within(details).getByRole("link", { name: "My Profile" }).focus();
    await user.keyboard("{Escape}");
    expect(details).not.toHaveAttribute("open");
    expect(trigger).toHaveFocus();
  });

  it("dismisses on outside pointer interaction without stealing the next action's focus", async () => {
    vi.mocked(useAuth).mockReturnValue(defaultAuth({ user: { id: "member" } as User }));
    mockCityValue();
    const user = userEvent.setup();
    renderHeader();
    const trigger = screen.getByLabelText("Open account menu");
    await user.click(trigger);
    const nextAction = screen.getByRole("button", { name: "Destination action" });
    await user.click(nextAction);
    expect(trigger.closest("details")).not.toHaveAttribute("open");
    expect(nextAction).toHaveFocus();
  });

  it("keeps a failed sign-out visible and allows retry without leaving the account menu", async () => {
    const signOut = vi.fn().mockResolvedValue({ error: new Error("offline") });
    vi.mocked(useAuth).mockReturnValue(defaultAuth({ user: { id: "member" } as User, signOut }));
    mockCityValue();
    const user = userEvent.setup();
    renderHeader();
    const trigger = screen.getByLabelText("Open account menu");
    await user.click(trigger);
    const details = trigger.closest("details")!;
    await user.click(within(details).getByRole("button", { name: "Sign Out" }));
    expect(await within(details).findByRole("alert")).toBeInTheDocument();
    expect(details).toHaveAttribute("open");
    expect(within(details).getByRole("button", { name: "Sign Out" })).toBeEnabled();
  });
});

describe("Header event creation call to action", () => {
  beforeEach(() => {
    mockCityValue("boston");
    vi.mocked(useOwnProfile).mockReturnValue(defaultProfileQuery());
    vi.mocked(useMetroName).mockReturnValue(metroNameLookup);
  });

  it("sends an anonymous visitor to the public submission flow", () => {
    vi.mocked(useAuth).mockReturnValue(defaultAuth());

    renderHeader();

    for (const link of screen.getAllByRole("link", { name: "Submit Event" })) {
      expect(link).toHaveAttribute("href", "/submit");
    }
  });

  it("sends a regular authenticated member to the public submission flow", () => {
    vi.mocked(useAuth).mockReturnValue(defaultAuth({ user: { id: "member" } as User }));

    renderHeader();

    for (const link of screen.getAllByRole("link", { name: "Submit Event" })) {
      expect(link).toHaveAttribute("href", "/submit");
    }
  });

  it("sends an admin to the canonical direct-create route instead of the moderated queue", () => {
    vi.mocked(useAuth).mockReturnValue(
      defaultAuth({ user: { id: "admin-1" } as User, role: "admin", isAdmin: true })
    );

    renderHeader();

    const links = screen.getAllByRole("link", { name: "Add Event" });
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link).toHaveAttribute("href", "/admin/events?new=1");
    }
    expect(screen.queryByRole("link", { name: "Submit Event" })).not.toBeInTheDocument();
  });
});

describe("Header shop disclosure", () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue(defaultAuth());
    mockCityValue("boston");
    vi.mocked(useOwnProfile).mockReturnValue(defaultProfileQuery());
    vi.mocked(useMetroName).mockReturnValue(metroNameLookup);
  });

  const shopTrigger = () => screen.getByRole("link", { name: "Shop" });

  it("lists every shop collection with its route once opened from the keyboard", async () => {
    const user = userEvent.setup();
    renderHeader();

    expect(shopTrigger()).toHaveAttribute("href", "/shop");
    expect(shopTrigger()).toHaveAttribute("aria-expanded", "false");

    shopTrigger().focus();
    await user.keyboard("{ArrowDown}");

    expect(shopTrigger()).toHaveAttribute("aria-expanded", "true");
    const list = screen.getByRole("list", { name: "Shop collections" });
    const links = within(list).getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual(SHOP_NAV.map((e) => e.to));
    expect(SHOP_NAV).toHaveLength(5);
    expect(links.map((link) => link.getAttribute("aria-label"))).toEqual(
      SHOP_NAV.map((e) => e.label)
    );
    expect(links[0]).toHaveFocus();
  });

  it("opens on pointer hover", async () => {
    const user = userEvent.setup();
    renderHeader();

    await user.hover(shopTrigger());
    expect(shopTrigger()).toHaveAttribute("aria-expanded", "true");
    await user.unhover(shopTrigger());
    expect(shopTrigger()).toHaveAttribute("aria-expanded", "false");
  });

  it("closes on Escape and returns focus to the trigger", async () => {
    const user = userEvent.setup();
    renderHeader();

    shopTrigger().focus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("link", { name: "Men" })).toBeInTheDocument();
    expect(shopTrigger()).toHaveAttribute("aria-expanded", "true");

    await user.keyboard("{Escape}");

    expect(shopTrigger()).toHaveAttribute("aria-expanded", "false");
    expect(shopTrigger()).toHaveFocus();
  });

  it("closes when focus leaves the panel", async () => {
    const user = userEvent.setup();
    renderHeader();

    shopTrigger().focus();
    await user.keyboard("{ArrowDown}");
    await user.click(screen.getByRole("button", { name: "Destination action" }));

    expect(shopTrigger()).toHaveAttribute("aria-expanded", "false");
  });

  it("opens the cart from the Cart row with the live item count", async () => {
    mockCart(3);
    const user = userEvent.setup();
    renderHeader();

    shopTrigger().focus();
    await user.keyboard("{ArrowDown}");
    const cartRow = screen.getByRole("button", { name: "Cart, 3 items" });
    expect(cartRow).toHaveTextContent("3 items");
    await user.click(cartRow);

    expect(setCartOpen).toHaveBeenCalledWith(true);
    expect(shopTrigger()).toHaveAttribute("aria-expanded", "false");
  });

  it("lists the collections in the mobile drawer and closes it on activation", async () => {
    const user = userEvent.setup();
    renderHeader();

    await user.click(screen.getByRole("button", { name: "Open menu" }));
    await user.click(screen.getByRole("button", { name: "Shop collections" }));
    const list = screen.getByRole("list", { name: "Shop collections" });
    await user.click(within(list).getByRole("link", { name: "Women" }));

    expect(screen.getByRole("button", { name: "Open menu" })).toHaveAttribute(
      "aria-expanded",
      "false"
    );
  });

  it("collapses the drawer's Shop group outside the shop and toggles it in place", async () => {
    const user = userEvent.setup();
    renderHeader();

    await user.click(screen.getByRole("button", { name: "Open menu" }));
    const toggle = screen.getByRole("button", { name: "Shop collections" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    // The Shop link itself still navigates rather than toggling.
    expect(within(document.getElementById("site-navigation") as HTMLElement).getByRole("link", { name: /^Shop$/ })).toHaveAttribute("href", "/shop");
  });

  it("opens the drawer's Shop group when already inside the shop", async () => {
    const user = userEvent.setup();
    renderHeader("/shop/women");

    await user.click(screen.getByRole("button", { name: "Open menu" }));
    expect(screen.getByRole("button", { name: "Shop collections" })).toHaveAttribute("aria-expanded", "true");
  });
});
