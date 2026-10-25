import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import AdminImportDropzone from "./AdminImportDropzone";

function csvFile(name = "events.csv"): File {
  return new File(["title\nSalsa"], name, { type: "text/csv" });
}

describe("AdminImportDropzone", () => {
  it("hands the chosen file to the caller via the file picker", async () => {
    const onFileSelected = vi.fn();
    render(<AdminImportDropzone onFileSelected={onFileSelected} />);
    const input = screen.getByLabelText("Upload CSV file");
    await userEvent.upload(input, csvFile());
    expect(onFileSelected).toHaveBeenCalledTimes(1);
    expect(onFileSelected.mock.calls[0][0].name).toBe("events.csv");
  });

  it("hands a dropped file to the caller", () => {
    const onFileSelected = vi.fn();
    render(<AdminImportDropzone onFileSelected={onFileSelected} />);
    const zone = screen.getByRole("button");
    fireEvent.drop(zone, { dataTransfer: { files: [csvFile("dropped.csv")] } });
    expect(onFileSelected).toHaveBeenCalledTimes(1);
    expect(onFileSelected.mock.calls[0][0].name).toBe("dropped.csv");
  });

  it("marks itself as drag-over while a file hovers, and clears it on leave", () => {
    render(<AdminImportDropzone onFileSelected={vi.fn()} />);
    const zone = screen.getByRole("button");
    fireEvent.dragOver(zone);
    expect(zone).toHaveAttribute("data-drag-over", "true");
    fireEvent.dragLeave(zone);
    expect(zone).toHaveAttribute("data-drag-over", "false");
  });

  it("ignores a drop while disabled", () => {
    const onFileSelected = vi.fn();
    render(<AdminImportDropzone onFileSelected={onFileSelected} disabled />);
    fireEvent.drop(screen.getByRole("button"), { dataTransfer: { files: [csvFile()] } });
    expect(onFileSelected).not.toHaveBeenCalled();
  });

  it("exposes its disabled state to assistive tech and drops out of the tab order", () => {
    render(<AdminImportDropzone onFileSelected={vi.fn()} disabled />);
    const zone = screen.getByRole("button");
    expect(zone).toHaveAttribute("aria-disabled", "true");
    expect(zone).toHaveAttribute("tabindex", "-1");
  });

  it("is keyboard-operable when enabled", () => {
    render(<AdminImportDropzone onFileSelected={vi.fn()} />);
    expect(screen.getByRole("button")).toHaveAttribute("tabindex", "0");
  });

  it("accepts only csv files at the picker level", () => {
    render(<AdminImportDropzone onFileSelected={vi.fn()} />);
    expect(screen.getByLabelText("Upload CSV file")).toHaveAttribute("accept", ".csv,text/csv");
  });
});
