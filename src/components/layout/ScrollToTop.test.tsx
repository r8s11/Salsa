import { act, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import ScrollToTop from "./ScrollToTop";

/** Renders the current route's location key so the test can save a scroll
 * position under the same key the component restores from. */
function KeyProbe({ onKey }: { onKey: (key: string) => void }) {
  const { key, pathname } = useLocation();
  onKey(key);
  return <p data-testid="location">{pathname}</p>;
}

function router(initial: string, onKey: (key: string) => void) {
  return createMemoryRouter(
    [
      {
        path: "/shop/:collection",
        element: (
          <>
            <ScrollToTop />
            <KeyProbe onKey={onKey} />
          </>
        ),
      },
      {
        path: "/shop/products/:handle",
        element: (
          <>
            <ScrollToTop />
            <KeyProbe onKey={onKey} />
          </>
        ),
      },
    ],
    { initialEntries: [initial] }
  );
}

describe("ScrollToTop", () => {
  afterEach(() => {
    window.sessionStorage.clear();
  });

  it("scrolls to the top on a fresh navigation", () => {
    const spy = vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
    render(<RouterProvider router={router("/shop/women", () => undefined)} />);
    expect(spy).toHaveBeenCalledWith(0, 0);
    spy.mockRestore();
  });

  it("ignores a saved position from another route", () => {
    const spy = vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
    window.sessionStorage.setItem("shop-scroll:women", "320");
    render(<RouterProvider router={router("/shop/products/shoe", () => undefined)} />);
    expect(spy).toHaveBeenCalledWith(0, 0);
    spy.mockRestore();
  });

  it("restores the saved scroll position when returning to a route", async () => {
    const spy = vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
    let key = "";
    const r = router("/shop/women", (k) => {
      key = k;
    });
    render(<RouterProvider router={r} />);
    expect(await screen.findByTestId("location")).toHaveTextContent("/shop/women");

    // Leave the route, saving its scroll position under its own key.
    window.sessionStorage.setItem(`shop-scroll:${key}`, "320");
    act(() => {
      r.navigate("/shop/products/shoe");
    });
    expect(await screen.findByTestId("location")).toHaveTextContent("/shop/products/shoe");

    // Return to the saved route via a POP navigation.
    act(() => {
      r.navigate(-1);
    });
    expect(await screen.findByTestId("location")).toHaveTextContent("/shop/women");
    expect(spy).toHaveBeenCalledWith(0, 320);
    expect(window.sessionStorage.getItem(`shop-scroll:${key}`)).toBeNull();
    spy.mockRestore();
  });
});
