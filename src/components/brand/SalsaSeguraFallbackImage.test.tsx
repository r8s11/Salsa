import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SalsaSeguraFallbackImage from "./SalsaSeguraFallbackImage";

const templates = ["dance", "percussion", "band", "tropical", "minimal"] as const;

describe("SalsaSeguraFallbackImage", () => {
  it.each(templates)("renders the %s artwork template with the event title", (template) => {
    render(
      <SalsaSeguraFallbackImage
        title="Salsa at the Anchor"
        template={template}
        variant="card"
      />
    );

    const artwork = screen.getByRole("img", { name: "Salsa Segura artwork for Salsa at the Anchor" });
    expect(artwork).toHaveClass("ss-fallback", `ss-fallback--${template}`, "ss-fallback--card");
    expect(screen.getByText("Salsa at the Anchor")).toBeInTheDocument();
    expect(artwork.querySelector("svg")).toBeInTheDocument();
  });

  it("keeps a long title inside the controlled title layer", () => {
    const title = "Boston Salsa & Bachata Summer Rooftop Community Social";
    render(<SalsaSeguraFallbackImage title={title} template="dance" variant="card" />);

    const titleLayer = screen.getByText(title);
    expect(titleLayer).toHaveClass("ss-fallback__title", "ss-fallback__title--long");
    expect(titleLayer).toHaveTextContent(title);
  });

  it("uses the detail variant for larger title treatment", () => {
    render(<SalsaSeguraFallbackImage title="Havana Nights" template="minimal" variant="detail" />);

    expect(screen.getByRole("img", { name: "Salsa Segura artwork for Havana Nights" })).toHaveClass(
      "ss-fallback--detail"
    );
  });
});
