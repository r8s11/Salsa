import { mockActiveMetroQuery } from "../../../test/mockMetros";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CityProvider } from "../../../contexts/CityContext";
import { useCity } from "../../../contexts/useCity";
import MetroExplorer from "./MetroExplorer";

vi.mock("../../../contexts/useAuth", () => ({ useAuth: () => ({ user: null, loading: false }) }));
vi.mock("../hooks/useMetros", () => import("../../../test/mockMetros"));

function LocationState() {
  const { city, subLocation, neighborhood } = useCity();
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  return <>
    <output data-testid="location">{city}:{subLocation ?? "all"}:{neighborhood ?? "all"}</output>
    <output data-testid="url">{pathname}{search}</output>
    <button onClick={() => navigate(-1)}>Back</button>
  </>;
}

function renderExplorer(path = "/") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <CityProvider>
        <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>
      </CityProvider>
    </QueryClientProvider>
  );
  return render(<><MetroExplorer /><LocationState /></>, { wrapper });
}

beforeEach(() => {
  window.localStorage.clear();
  window.localStorage.setItem("salsa.metro", "new-york-city");
  mockActiveMetroQuery.activeMetros = successfulActiveMetros;
  mockActiveMetroQuery.loading = false;
  mockActiveMetroQuery.fetching = false;
  mockActiveMetroQuery.error = null;
  mockActiveMetroQuery.loadFailed = false;
  mockActiveMetroQuery.refetch = refetchActiveMetros;
  refetchActiveMetros.mockClear();
});

const successfulActiveMetros = mockActiveMetroQuery.activeMetros;
const refetchActiveMetros = vi.fn(async () => undefined);

describe("NYC borough explorer", () => {
  it("selects a borough, remembers it, and returns to All NYC", async () => {
    renderExplorer();
    const trigger = await screen.findByRole("button", { name: /Location: New York City/ });
    fireEvent.click(trigger);
    const disclosure = screen.getByRole("button", { name: "NYC boroughs" });
    expect(disclosure).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("button", { name: "Brooklyn" })).not.toBeInTheDocument();
    fireEvent.click(disclosure);
    expect(screen.getByTestId("location")).toHaveTextContent("new-york-city:all");
    expect(screen.getByTestId("url").textContent).toBe("/");
    fireEvent.click(disclosure);
    expect(screen.queryByRole("button", { name: "Brooklyn" })).not.toBeInTheDocument();
    fireEvent.click(disclosure);
    const boroughs = screen.getByRole("list", { name: "New York City boroughs" });
    for (const name of ["Manhattan", "Brooklyn", "Queens", "The Bronx", "Staten Island", "All NYC"]) {
      expect(within(boroughs).getByRole("button", { name })).toBeInTheDocument();
    }
    fireEvent.click(within(boroughs).getByRole("button", { name: "Brooklyn" }));
    expect(screen.getByTestId("location")).toHaveTextContent("new-york-city:brooklyn");
    expect(screen.getByTestId("url")).toHaveTextContent("/events/new-york-city?borough=brooklyn");
    expect(window.localStorage.getItem("salsa.sublocation")).toBe("brooklyn");
    expect(trigger).toHaveFocus();
    expect(screen.queryByRole("region", { name: "Explore cities" })).not.toBeInTheDocument();

    fireEvent.click(trigger);
    expect(screen.getByRole("button", { name: "Brooklyn", current: true })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "All NYC" }));
    expect(screen.getByTestId("location")).toHaveTextContent("new-york-city:all");
    expect(screen.getByTestId("url").textContent).toBe("/events/new-york-city");
    expect(window.localStorage.getItem("salsa.sublocation")).toBeNull();
  });

  it("changes borough without leaving the calendar, then clears it on a different metro", async () => {
    renderExplorer("/calendar");
    const trigger = await screen.findByRole("button", { name: /Location: New York City/ });
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("button", { name: "NYC boroughs" }));
    fireEvent.click(screen.getByRole("button", { name: "Queens" }));
    expect(screen.getByTestId("location")).toHaveTextContent("new-york-city:queens");
    expect(screen.getByTestId("url").textContent).toBe("/calendar");
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("button", { name: /Boston, MA/ }));
    expect(screen.getByTestId("location")).toHaveTextContent("boston:all");
    expect(window.localStorage.getItem("salsa.sublocation")).toBeNull();
  });

  it("selects NYC and Boston neighborhoods, deep-links them, and clears children on a parent change", async () => {
    renderExplorer();
    const trigger = await screen.findByRole("button", { name: /Location: New York City/ });
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("button", { name: "NYC boroughs" }));
    fireEvent.click(screen.getByRole("button", { name: "Brooklyn neighborhoods" }));
    fireEvent.click(screen.getByRole("button", { name: "Williamsburg" }));
    expect(screen.getByTestId("location")).toHaveTextContent(
      "new-york-city:brooklyn:williamsburg"
    );
    expect(screen.getByTestId("url").textContent).toBe(
      "/events/new-york-city?borough=brooklyn&neighborhood=williamsburg"
    );
    expect(window.localStorage.getItem("salsa.neighborhood")).toBe("williamsburg");

    // Selecting closes the panel; reopen it and move to a different metro, which clears the NYC child.
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("button", { name: /Boston, MA/ }));
    expect(screen.getByTestId("location")).toHaveTextContent("boston:all:all");
    expect(window.localStorage.getItem("salsa.sublocation")).toBeNull();
    expect(window.localStorage.getItem("salsa.neighborhood")).toBeNull();

    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("button", { name: "Boston neighborhoods" }));
    fireEvent.click(screen.getByRole("button", { name: "Back Bay" }));
    expect(screen.getByTestId("location")).toHaveTextContent("boston:all:back-bay");
    expect(screen.getByTestId("url").textContent).toBe(
      "/events/boston?neighborhood=back-bay"
    );
  });

  it("dismisses with Escape and restores keyboard focus", async () => {
    renderExplorer();
    const trigger = await screen.findByRole("button", { name: /Location: New York City/ });
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("button", { name: "NYC boroughs" }));
    act(() => screen.getByRole("button", { name: "Staten Island" }).focus());
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });
  it("keeps a failed city lookup actionable through retry and separates it from an empty result", async () => {
    mockActiveMetroQuery.activeMetros = [];
    mockActiveMetroQuery.error = "offline";
    mockActiveMetroQuery.loadFailed = true;
    const user = userEvent.setup();
    const view = renderExplorer();
    const rerenderExplorer = () => view.rerender(<><MetroExplorer /><LocationState /></>);
    const trigger = await screen.findByRole("button", { name: /Location: New York City/ });
    await user.click(trigger);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Cities didn't load.");
    expect(screen.queryByRole("list", { name: "Cities with upcoming events" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(refetchActiveMetros).toHaveBeenCalledOnce();

    Object.assign(mockActiveMetroQuery, {
      loading: true,
      fetching: true,
      error: null,
      loadFailed: true,
    });
    rerenderExplorer();
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Trying again…" })).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("button", { name: "Trying again…" })).toBeDisabled();

    Object.assign(mockActiveMetroQuery, { loading: false, fetching: false, error: "offline" });
    rerenderExplorer();
    await waitFor(() => expect(screen.getByRole("button", { name: "Try again" })).toHaveFocus());

    await user.click(screen.getByRole("button", { name: "Try again" }));
    Object.assign(mockActiveMetroQuery, {
      loading: true,
      fetching: true,
      error: null,
      loadFailed: true,
    });
    rerenderExplorer();
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Trying again…" })).toBeDisabled();

    Object.assign(mockActiveMetroQuery, {
      activeMetros: [],
      loading: false,
      fetching: false,
      error: null,
      loadFailed: false,
    });
    rerenderExplorer();
    const empty = screen.getByText("No cities with upcoming events yet.");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await waitFor(() => expect(empty).toHaveFocus());
  });
});
