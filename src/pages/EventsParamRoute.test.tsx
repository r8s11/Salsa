import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import EventsParamRoute from "./EventsParamRoute";

const setCity = vi.fn();

vi.mock("../contexts/useCity", () => ({ useCity: () => ({ setCity }) }));
vi.mock("../features/metros/hooks/useMetros", () => ({
  useMetros: () => ({
    metros: [
      { slug: "new-york-city", name: "New York City" },
      { slug: "boston", name: "Boston" },
      { slug: "miami", name: "Miami" },
    ],
    loading: false,
    error: null,
  }),
}));
vi.mock("./HomePage", () => ({ default: () => <main>Metro home</main> }));
vi.mock("./EventDetailPage", () => ({ default: () => <main>Event detail</main> }));
vi.mock("./NotFoundPage", () => ({ default: () => <main>Not found</main> }));

function Path() {
  return <output data-testid="path">{useLocation().pathname}</output>;
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Path />
      <Routes>
        <Route path="/events/:id" element={<EventsParamRoute />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => setCity.mockClear());

describe("/events/:id", () => {
  it("serves a metro home at its canonical slug and selects that metro", async () => {
    renderAt("/events/miami");
    expect(await screen.findByText("Metro home")).toBeInTheDocument();
    expect(setCity).toHaveBeenCalledWith("miami");
    expect(document.title).toBe("Salsa & Bachata Events in Miami | Salsa Segura");
  });

  it("collapses aliases onto the canonical metro URL", async () => {
    renderAt("/events/nyc");
    expect(await screen.findByText("Metro home")).toBeInTheDocument();
    expect(screen.getByTestId("path")).toHaveTextContent("/events/new-york-city");
    expect(setCity).toHaveBeenCalledWith("new-york-city");
  });

  it("still opens event details for event ids", async () => {
    renderAt("/events/3f2b8c1e-9d4a-4e6b-8f0a-1c2d3e4f5a6b");
    expect(await screen.findByText("Event detail")).toBeInTheDocument();
    expect(setCity).not.toHaveBeenCalled();
  });

  it("404s a city that is not a registered metro", async () => {
    renderAt("/events/atlantis");
    expect(await screen.findByText("Not found")).toBeInTheDocument();
  });
});
