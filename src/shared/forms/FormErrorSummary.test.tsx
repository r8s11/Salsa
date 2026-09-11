import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import FormErrorSummary from "./FormErrorSummary";

const items = [
  { fieldId: "event-title", message: "Event title is required." },
  { fieldId: "event-type", message: "Choose an event type." },
];

describe("FormErrorSummary", () => {
  it("renders nothing without errors", () => {
    const { container } = render(
      <FormErrorSummary id="submit-error-summary" items={[]} focusKey={0} />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("lists every field error as a link to its field id", () => {
    render(<FormErrorSummary id="submit-error-summary" items={items} focusKey={1} />);

    const summary = screen.getByRole("alert");
    expect(summary).toHaveAttribute("id", "submit-error-summary");
    expect(summary).toHaveAttribute("tabindex", "-1");
    expect(screen.getByRole("link", { name: "Event title is required." })).toHaveAttribute(
      "href",
      "#event-title"
    );
    expect(screen.getByRole("link", { name: "Choose an event type." })).toHaveAttribute(
      "href",
      "#event-type"
    );
  });

  it("takes focus and scrolls into view on each failed attempt", () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;

    const { rerender } = render(
      <FormErrorSummary id="submit-error-summary" items={items} focusKey={1} />
    );
    expect(screen.getByRole("alert")).toHaveFocus();
    expect(scrollIntoView).toHaveBeenCalledTimes(1);

    // A second failure must re-announce rather than leave the summary off-screen.
    screen.getByRole("link", { name: "Choose an event type." }).focus();
    rerender(<FormErrorSummary id="submit-error-summary" items={items} focusKey={2} />);
    expect(screen.getByRole("alert")).toHaveFocus();
    expect(scrollIntoView).toHaveBeenCalledTimes(2);
  });

  it("carries a server-level failure with no identifiable field", () => {
    render(
      <FormErrorSummary
        id="submit-error-summary"
        items={[]}
        serverMessage="We couldn't reach the server. Check your connection and try again."
        focusKey={1}
      />
    );

    const summary = screen.getByRole("alert");
    expect(summary).toHaveTextContent("We couldn't reach the server. Check your connection and try again.");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(summary).toHaveFocus();
  });

  it("moves focus to the field a summary link points at", () => {
    render(
      <>
        <FormErrorSummary id="submit-error-summary" items={items} focusKey={1} />
        <input id="event-title" aria-label="Event title" />
      </>
    );

    fireEvent.click(screen.getByRole("link", { name: "Event title is required." }));

    expect(screen.getByLabelText("Event title")).toHaveFocus();
  });
});
