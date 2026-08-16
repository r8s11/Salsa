import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { buildInitialForm } from "../validation";
import YourInfoFieldset from "./YourInfoFieldset";

const form = buildInitialForm("boston");

describe("YourInfoFieldset", () => {
  it("lets a guest enter a contact email", () => {
    const update = vi.fn();
    render(<YourInfoFieldset form={form} update={update} email="" />);

    fireEvent.change(screen.getByLabelText("Your Email"), {
      target: { value: "guest@salsa.test" },
    });

    expect(update).toHaveBeenCalledWith("submitter_email", "guest@salsa.test");
  });
});
