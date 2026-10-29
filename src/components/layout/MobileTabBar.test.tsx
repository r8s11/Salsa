import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { AuthContextValue } from "../../contexts/authContextObject";
import { useAuth } from "../../contexts/useAuth";
import { useCity } from "../../contexts/useCity";
import type { CityContextValue } from "../../contexts/cityContextObject";
import { useMetroName } from "../../features/metros/hooks/useMetros";
import { useCart } from "../../features/shopify/cart/useCart";
import type { CartState } from "../../features/shopify/cart/CartContext";
import MobileTabBar from "./MobileTabBar";

vi.mock("../../contexts/useAuth", () => ({ useAuth: vi.fn() }));
vi.mock("../../contexts/useCity", () => ({ useCity: vi.fn() }));
vi.mock("../../features/metros/hooks/useMetros", () => ({ useMetroName: vi.fn() }));
vi.mock("../../features/shopify/cart/useCart", () => ({ useCart: vi.fn() }));

function mockCart(totalQuantity = 0) {
  const setOpen = vi.fn();
  vi.mocked(useCart).mockReturnValue({
    cart: totalQuantity ? ({ totalQuantity } as CartState["cart"]) : null,
    isLoading: false, isBusy: false, error: null, notice: null, isOpen: false,
    setOpen, restoreFocus: vi.fn(), addVariant: vi.fn(), updateLine: vi.fn(), removeLine: vi.fn(), refresh: vi.fn(),
  });
  return setOpen;
}

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

vi.mocked(useMetroName).mockReturnValue((slug: string | null | undefined) =>
  slug === "boston" ? "Boston" : slug === "new-york-city" ? "New York City" : (slug ?? "")
);

function renderTabBar(initialEntry = "/", city: CityContextValue["city"] = "boston", cartQuantity = 0) {
  const setCartOpen = mockCart(cartQuantity);
  vi.mocked(useCity).mockReturnValue({
    city,
    subLocation: null,
    neighborhood: null,
    source: "explicit",
    resolving: false,
    setCity: vi.fn(),
    chooseNearMe: vi.fn(),
    activeMetros: [],
    activeMetrosError: null,
    locationStatus: "idle",
  });
  return {
    ...render(
      <MemoryRouter initialEntries={[initialEntry]}>
        <MobileTabBar />
      </MemoryRouter>
    ),
    setCartOpen,
  };
}

describe("MobileTabBar", () => {
  it("renders Home, Calendar, Shop and Me outside the shop", () => {
    vi.mocked(useAuth).mockReturnValue(defaultAuth());
    renderTabBar();

    expect(screen.getAllByRole("link")).toHaveLength(4);
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Calendar" })).toHaveAttribute("href", "/calendar");
    expect(screen.getByRole("link", { name: "Shop" })).toHaveAttribute("href", "/shop");
    expect(screen.queryByRole("button", { name: /cart/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /submit/i })).not.toBeInTheDocument();
  });

  it("routes the Me tab to sign in when signed out", () => {
    vi.mocked(useAuth).mockReturnValue(defaultAuth({ user: null }));
    renderTabBar();

    expect(screen.getByRole("link", { name: "Me" })).toHaveAttribute("href", "/signin");
  });

  it("routes the Me tab to the profile when signed in", () => {
    vi.mocked(useAuth).mockReturnValue(
      defaultAuth({ user: { id: "user-1" } as AuthContextValue["user"] })
    );
    renderTabBar();

    expect(screen.getByRole("link", { name: "Me" })).toHaveAttribute("href", "/profile");
  });

  it("marks the active route current", () => {
    vi.mocked(useAuth).mockReturnValue(defaultAuth());
    renderTabBar("/calendar");

    expect(screen.getByRole("link", { name: "Calendar" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Home" })).not.toHaveAttribute("aria-current");
  });

  it("magnifies the nearby dock item without changing its link destination", async () => {
    vi.mocked(useAuth).mockReturnValue(defaultAuth());
    const { container } = renderTabBar();
    const home = screen.getByRole("link", { name: "Home" });
    const item = home.closest(".dock-item");
    expect(item).not.toBeNull();

    Object.defineProperty(item, "getBoundingClientRect", {
      value: () => ({ x: 20, width: 62, left: 20, right: 82 }),
    });
    fireEvent.mouseMove(container.querySelector(".dock-panel")!, { clientX: 51 });

    await waitFor(() => expect(parseFloat((item as HTMLElement).style.width)).toBeGreaterThan(62));
    expect(home).toHaveAttribute("href", "/");
  });

  it("moves the active segment when a tab navigates", async () => {
    vi.mocked(useAuth).mockReturnValue(defaultAuth());
    const { container } = renderTabBar();
    const calendar = screen.getByRole("link", { name: "Calendar" });
    const segment = container.querySelector<HTMLElement>(".rubber-segment__thumb");
    expect(segment).not.toBeNull();

    Object.defineProperty(calendar.closest(".dock-item"), "getBoundingClientRect", {
      value: () => ({ left: 88, right: 136, width: 48 }),
    });
    fireEvent.click(calendar);

    await waitFor(() => expect(calendar).toHaveAttribute("aria-current", "page"));
    await waitFor(() => expect(segment!.style.clipPath).toContain("88px"));
  });
});

describe("MobileTabBar cart", () => {
  it("turns the Shop tab into the cart inside the shop and opens it in place", () => {
    vi.mocked(useAuth).mockReturnValue(defaultAuth());
    const { setCartOpen } = renderTabBar("/shop/women", "boston", 3);

    expect(screen.queryByRole("link", { name: "Shop" })).not.toBeInTheDocument();
    const cart = screen.getByRole("button", { name: "Cart, 3 items" });
    expect(cart).toHaveTextContent("3");
    fireEvent.click(cart);
    expect(setCartOpen).toHaveBeenCalledWith(true);
  });

  it("does not treat look-alike paths as the shop", () => {
    vi.mocked(useAuth).mockReturnValue(defaultAuth());
    renderTabBar("/shopping-guide");

    expect(screen.getByRole("link", { name: "Shop" })).toHaveAttribute("href", "/shop");
  });
});

describe("MobileTabBar city context", () => {
  it("shows the current city code and names the city in the landmark label", () => {
    vi.mocked(useAuth).mockReturnValue(defaultAuth());
    renderTabBar("/", "boston");

    expect(screen.getByText("BOS")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Primary, Boston events" })).toBeInTheDocument();
  });

  it("switches the city badge with context", () => {
    vi.mocked(useAuth).mockReturnValue(defaultAuth());
    renderTabBar("/", "new-york-city");

    expect(screen.getByText("NYC")).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "Primary, New York City events" })
    ).toBeInTheDocument();
  });

  it("falls back to a neutral label when no metro is chosen", () => {
    vi.mocked(useAuth).mockReturnValue(defaultAuth());
    renderTabBar("/", null);

    expect(screen.getByText("Cities")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Primary, Cities events" })).toBeInTheDocument();
  });
});