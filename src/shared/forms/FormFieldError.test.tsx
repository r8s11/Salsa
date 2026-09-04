import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import FormFieldError from "./FormFieldError";
import { fieldErrorProps } from "./fieldErrorProps";

describe("FormFieldError", () => {
  it("announces the message under a stable id", () => {
    render(<FormFieldError id="event-title-error" message="Event title is required." />);

    const error = screen.getByRole("alert");
    expect(error).toHaveAttribute("id", "event-title-error");
    expect(error).toHaveTextContent("Event title is required.");
  });

  it("renders nothing when the field is valid", () => {
    const { container } = render(<FormFieldError id="event-title-error" message={null} />);

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("associates a control with its error and resolves the reference", () => {
    render(
      <>
        <input aria-label="Event title" {...fieldErrorProps("event-title-error", "Event title is required.")} />
        <FormFieldError id="event-title-error" message="Event title is required." />
      </>
    );

    const input = screen.getByLabelText("Event title");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input.getAttribute("aria-describedby")).toBe("event-title-error");
    expect(document.getElementById("event-title-error")).toHaveTextContent("Event title is required.");
  });
});

describe("fieldErrorProps", () => {
  it("reports a valid field without describing a missing error", () => {
    expect(fieldErrorProps("email-error", null)).toEqual({
      "aria-invalid": "false",
      "aria-describedby": undefined,
    });
  });

  it("keeps an existing hint id when the field is valid", () => {
    expect(fieldErrorProps("instagram-error", undefined, "instagram-hint")).toEqual({
      "aria-invalid": "false",
      "aria-describedby": "instagram-hint",
    });
  });

  it("keeps the hint alongside the error when validation fails", () => {
    expect(fieldErrorProps("instagram-error", "Handle only, no URLs.", "instagram-hint")).toEqual({
      "aria-invalid": "true",
      "aria-describedby": "instagram-error instagram-hint",
    });
  });
});
