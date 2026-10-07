import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AdminTrendChart from "./AdminTrendChart";

describe("AdminTrendChart", () => {
  it("renders a loading state", () => {
    const { container } = render(
      <MemoryRouter>
        <AdminTrendChart label="Test Chart" data={[]} isLoading={true} />
      </MemoryRouter>
    );
    expect(container).toHaveTextContent("Loading chart…");
  });

  it("renders an empty state when data is empty", () => {
    const { container } = render(
      <MemoryRouter>
        <AdminTrendChart label="Test Chart" data={[]} isLoading={false} />
      </MemoryRouter>
    );
    expect(container).toHaveTextContent("No data for this period.");
  });

  it("renders the title", () => {
    const { container } = render(
      <MemoryRouter>
        <AdminTrendChart label="Published Events" data={[]} isLoading={false} />
      </MemoryRouter>
    );
    expect(container).toHaveTextContent("Published Events");
  });
});
