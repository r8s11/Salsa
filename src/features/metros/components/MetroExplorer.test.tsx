import { mockActiveLocationQuery, mockActiveMetroQuery } from "../../../test/mockMetros";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
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
    <output data-testid="location">{city}:{subLocation ?? "all"}</output>
    <output data-testid="neighborhood">{neighborhood ?? "all"}</output>
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
  Object.assign(mockActiveLocationQuery, {
    activeLocations: successfulActiveLocations,
    loading: false,
    fetching: false,
    error: null,
    loadFailed: false,
    refreshFailed: false,
    refetch: refetchActiveLocations,
  });
  refetchActiveLocations.mockClear();
});

const successfulActiveMetros = mockActiveMetroQuery.activeMetros;
const refetchActiveMetros = vi.fn(async () => undefined);
const successfulActiveLocations = mockActiveLocationQuery.activeLocations;
const refetchActiveLocations = vi.fn(async () => undefined);

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
    for (const name of ["Brooklyn", "Queens", "All NYC"]) {
      expect(within(boroughs).getByRole("button", { name })).toBeInTheDocument();
    }
    for (const name of ["Manhattan", "The Bronx", "Staten Island"]) {
      expect(within(boroughs).queryByRole("button", { name })).not.toBeInTheDocument();
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

  it("dismisses with Escape and restores keyboard focus", async () => {
    renderExplorer();
    const trigger = await screen.findByRole("button", { name: /Location: New York City/ });
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("button", { name: "NYC boroughs" }));
    act(() => screen.getByRole("button", { name: "Queens" }).focus());
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("selects a neighborhood under its borough, then clears it when choosing the parent", async () => {
    renderExplorer();
    const trigger = await screen.findByRole("button", { name: /Location: New York City/ });
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("button", { name: "NYC boroughs" }));
    expect(screen.queryByRole("button", { name: "Bushwick" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Brooklyn neighborhoods" }));
    const areas = screen.getByRole("list", { name: "Brooklyn neighborhoods" });
    expect(within(areas).queryByRole("button", { name: "Astoria" })).not.toBeInTheDocument();
    expect(within(areas).queryByRole("button", { name: "Williamsburg" })).not.toBeInTheDocument();
    fireEvent.click(within(areas).getByRole("button", { name: "Bushwick" }));
    expect(screen.getByTestId("location")).toHaveTextContent("new-york-city:brooklyn");
    expect(screen.getByTestId("neighborhood")).toHaveTextContent("bushwick");
    expect(screen.getByTestId("url").textContent).toBe("/events/new-york-city?borough=brooklyn&neighborhood=bushwick");
    expect(window.localStorage.getItem("salsa.neighborhood")).toBe("bushwick");
    fireEvent.click(trigger);
    expect(screen.getByRole("button", { name: "Bushwick", current: true })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "All Brooklyn" }));
    expect(screen.getByTestId("neighborhood")).toHaveTextContent("all");
    expect(window.localStorage.getItem("salsa.neighborhood")).toBeNull();
    expect(screen.getByTestId("url").textContent).toBe("/events/new-york-city?borough=brooklyn");
  });

  it("offers neighborhoods directly beneath a city without boroughs", async () => {
    renderExplorer("/calendar");
    const trigger = await screen.findByRole("button", { name: /Location: New York City/ });
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("button", { name: "Boston neighborhoods" }));
    fireEvent.click(screen.getByRole("button", { name: "Allston" }));
    expect(screen.getByTestId("location")).toHaveTextContent("boston:all");
    expect(screen.getByTestId("neighborhood")).toHaveTextContent("allston");
    expect(screen.getByTestId("url").textContent).toBe("/calendar");
  });

  it("keeps a populated parent borough with an unspecified neighborhood, without empty child disclosure", async () => {
    renderExplorer();
    fireEvent.click(await screen.findByRole("button", { name: /Location: New York City/ }));
    fireEvent.click(screen.getByRole("button", { name: "NYC boroughs" }));
    expect(screen.getByRole("button", { name: "Queens" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Queens neighborhoods" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Astoria" })).not.toBeInTheDocument();
  });

  it("filters neighborhood siblings and retains the all-city control", async () => {
    renderExplorer();
    fireEvent.click(await screen.findByRole("button", { name: /Location: New York City/ }));
    fireEvent.click(screen.getByRole("button", { name: "Boston neighborhoods" }));
    const areas = screen.getByRole("list", { name: "Boston neighborhoods" });
    expect(within(areas).getByRole("button", { name: "Allston" })).toBeInTheDocument();
    expect(within(areas).getByRole("button", { name: "All Boston" })).toBeInTheDocument();
    expect(within(areas).queryByRole("button", { name: "Brighton" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Miami neighborhoods" })).not.toBeInTheDocument();
  });

  it("keeps city selection available without disclosure when nested inventory is verified empty", async () => {
    mockActiveLocationQuery.activeLocations = [];
    renderExplorer();
    fireEvent.click(await screen.findByRole("button", { name: /Location: New York City/ }));
    expect(screen.queryByRole("button", { name: "NYC boroughs" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Boston neighborhoods" })).not.toBeInTheDocument();
    expect(screen.queryByText("Loading boroughs and neighborhoods…")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry locations" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Boston, MA/ }));
    expect(screen.getByTestId("location")).toHaveTextContent("boston:all");
    expect(screen.getByTestId("url").textContent).toBe("/events/boston");
  });

  it("does not clear an existing stored neighborhood when its inventory becomes empty", async () => {
    window.localStorage.setItem("salsa.sublocation", "brooklyn");
    window.localStorage.setItem("salsa.neighborhood", "bushwick");
    mockActiveLocationQuery.activeLocations = [];
    renderExplorer("/calendar");
    const trigger = await screen.findByRole("button", { name: /Location: New York City › Brooklyn › Bushwick/ });
    fireEvent.click(trigger);
    expect(screen.getByTestId("location")).toHaveTextContent("new-york-city:brooklyn");
    expect(screen.getByTestId("neighborhood")).toHaveTextContent("bushwick");
    expect(window.localStorage.getItem("salsa.neighborhood")).toBe("bushwick");
    expect(screen.queryByRole("button", { name: "NYC boroughs" })).not.toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(trigger).toHaveFocus();
  });

  it("distinguishes pending and failed nested inventory from zero and preserves retry focus", async () => {
    Object.assign(mockActiveLocationQuery, { activeLocations: [], loading: true, fetching: true });
    const view = renderExplorer();
    const rerenderExplorer = () => view.rerender(<><MetroExplorer /><LocationState /></>);
    fireEvent.click(await screen.findByRole("button", { name: /Location: New York City/ }));
    expect(screen.getByText("Loading boroughs and neighborhoods…")).toHaveAttribute("role", "status");
    expect(screen.queryByRole("button", { name: "NYC boroughs" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Boston, MA/ })).toBeInTheDocument();

    Object.assign(mockActiveLocationQuery, { loading: false, fetching: false, error: "offline", loadFailed: true });
    rerenderExplorer();
    expect(screen.getByRole("alert")).toHaveTextContent("Boroughs and neighborhoods didn't load.");
    const retry = screen.getByRole("button", { name: "Retry locations" });
    fireEvent.click(retry);
    expect(refetchActiveLocations).toHaveBeenCalledOnce();
    Object.assign(mockActiveLocationQuery, { loading: true, fetching: true, error: null });
    rerenderExplorer();
    expect(screen.getByRole("button", { name: "Trying locations again…" })).toBe(retry);
    expect(retry).toBeDisabled();
    expect(screen.queryByRole("button", { name: "NYC boroughs" })).not.toBeInTheDocument();

    Object.assign(mockActiveLocationQuery, { loading: false, fetching: false, error: "offline" });
    rerenderExplorer();
    await waitFor(() => expect(retry).toHaveFocus());
    fireEvent.click(retry);
    Object.assign(mockActiveLocationQuery, { loading: true, fetching: true, error: null });
    rerenderExplorer();
    Object.assign(mockActiveLocationQuery, { loading: false, fetching: false, loadFailed: false });
    rerenderExplorer();
    await waitFor(() => expect(screen.getByRole("heading", { name: "Explore cities" })).toHaveFocus());
    expect(screen.queryByRole("button", { name: "Retry locations" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "NYC boroughs" })).not.toBeInTheDocument();
  });

  it("retains cached populated choices after a nested inventory refresh failure", async () => {
    Object.assign(mockActiveLocationQuery, { error: "offline", refreshFailed: true });
    const view = renderExplorer();
    fireEvent.click(await screen.findByRole("button", { name: /Location: New York City/ }));
    expect(screen.getByText(/Couldn't refresh boroughs and neighborhoods/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "NYC boroughs" }));
    expect(screen.getByRole("button", { name: "Brooklyn" })).toBeInTheDocument();
    const retry = screen.getByRole("button", { name: "Retry locations" });
    fireEvent.click(retry);
    Object.assign(mockActiveLocationQuery, { fetching: true, error: null });
    view.rerender(<><MetroExplorer /><LocationState /></>);
    expect(screen.getByRole("button", { name: "Trying locations again…" })).toBe(retry);
    expect(screen.getByRole("button", { name: "Brooklyn" })).toBeInTheDocument();
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
