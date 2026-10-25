import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import EventFlyersField, { type FlyerItem } from "./EventFlyersField";

const makeItems = (count: number): FlyerItem[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `f${i + 1}`,
    url: `https://example.com/flyer-${i + 1}.jpg`,
  }));

const png = (name = "a.png") => new File(["x"], name, { type: "image/png" });

function setup(items: FlyerItem[], overrides: Partial<Parameters<typeof EventFlyersField>[0]> = {}) {
  const props = {
    items,
    onAddFiles: vi.fn(),
    onRemove: vi.fn(),
    onMove: vi.fn(),
    ...overrides,
  };
  render(<EventFlyersField {...props} />);
  return props;
}

describe("EventFlyersField", () => {
  it("renders ordered flyers, badges only the first as Primary, and shows the count", () => {
    setup(makeItems(3));

    const images = screen.getAllByRole("img");
    expect(images.map((img) => img.getAttribute("src"))).toEqual([
      "https://example.com/flyer-1.jpg",
      "https://example.com/flyer-2.jpg",
      "https://example.com/flyer-3.jpg",
    ]);
    expect(screen.getAllByText("Primary")).toHaveLength(1);
    const first = screen.getAllByRole("listitem")[0];
    expect(within(first).getByText("Primary")).toBeInTheDocument();
    expect(screen.getByText("3 of 5 flyers")).toBeInTheDocument();
  });

  it("disables Move earlier on the first and Move later on the last", () => {
    setup(makeItems(3));

    expect(screen.getByRole("button", { name: "Move flyer 1 earlier" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move flyer 2 earlier" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Move flyer 3 later" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move flyer 2 later" })).toBeEnabled();
  });

  it("reports move and remove with the item id", async () => {
    const user = userEvent.setup();
    const { onMove, onRemove } = setup(makeItems(3));

    await user.click(screen.getByRole("button", { name: "Move flyer 2 earlier" }));
    await user.click(screen.getByRole("button", { name: "Move flyer 2 later" }));
    await user.click(screen.getByRole("button", { name: "Remove flyer 3" }));

    expect(onMove).toHaveBeenNthCalledWith(1, "f2", "earlier");
    expect(onMove).toHaveBeenNthCalledWith(2, "f2", "later");
    expect(onRemove).toHaveBeenCalledWith("f3");
  });

  it("passes valid files up to the parent", async () => {
    const user = userEvent.setup();
    const { onAddFiles } = setup(makeItems(2));

    await user.upload(screen.getByLabelText("Event flyers"), [png("a.png"), png("b.png")]);
    expect(onAddFiles).toHaveBeenCalledWith([
      expect.objectContaining({ name: "a.png" }),
      expect.objectContaining({ name: "b.png" }),
    ]);
  });

  it("hides the add control when the cap is reached", () => {
    setup(makeItems(5));

    expect(screen.queryByRole("button", { name: /Add flyer/i })).not.toBeInTheDocument();
    expect(screen.getByText("5 of 5 flyers")).toBeInTheDocument();
    expect(screen.getByLabelText("Event flyers")).toBeDisabled();
  });

  it("rejects invalid type and size inline while still passing valid files", async () => {
    const user = userEvent.setup({ applyAccept: false });
    const { onAddFiles } = setup([]);
    const big = new File(["x"], "big.png", { type: "image/png" });
    Object.defineProperty(big, "size", { value: 6 * 1024 * 1024 });

    await user.upload(screen.getByLabelText("Event flyers"), [
      new File(["g"], "anim.gif", { type: "image/gif" }),
      big,
      png("ok.png"),
    ]);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/anim\.gif: Choose a JPEG, PNG, or WebP image\./);
    expect(alert).toHaveTextContent(/big\.png: Image must be 5 MB or smaller\./);
    expect(onAddFiles).toHaveBeenCalledWith([expect.objectContaining({ name: "ok.png" })]);
  });

  it("accepts only what fits under the cap and flags the excess", async () => {
    const user = userEvent.setup();
    const { onAddFiles } = setup(makeItems(3));

    await user.upload(screen.getByLabelText("Event flyers"), [
      png("a.png"),
      png("b.png"),
      png("c.png"),
    ]);

    expect(onAddFiles).toHaveBeenCalledTimes(1);
    expect(onAddFiles).toHaveBeenCalledWith([
      expect.objectContaining({ name: "a.png" }),
      expect.objectContaining({ name: "b.png" }),
    ]);
    expect(await screen.findByRole("alert")).toHaveTextContent("You can add up to 5 flyers.");
  });

  it("shows uploading and error tiles, with Retry only for failed uploads", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    const items: FlyerItem[] = [
      { id: "f1", url: "https://example.com/1.jpg", status: "uploaded", sizeCaption: "1.8 MB" },
      { id: "f2", url: "blob:2", status: "uploading" },
      { id: "f3", url: "blob:3", status: "upload-error", errorMessage: "Network down" },
    ];
    setup(items, { onRetry });

    expect(screen.getByText("1.8 MB")).toBeInTheDocument();
    expect(screen.getByText("Uploading…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove flyer 2" })).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("Network down");
    expect(screen.queryByRole("button", { name: "Retry flyer 1" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Retry flyer 3" }));
    expect(onRetry).toHaveBeenCalledWith("f3");
  });

  it("disables every control when disabled", () => {
    setup(makeItems(2), { disabled: true });

    expect(screen.getByRole("button", { name: "Add flyer" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Remove flyer 1" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move flyer 1 later" })).toBeDisabled();
  });
});

describe("EventFlyersField placeholder", () => {
  it("renders a placeholder instead of an empty img src", () => {
    setup([{ id: "f1", url: "", status: "uploading" }]);

    expect(screen.getByRole("img", { name: "Flyer 1 (no preview yet)" })).toBeInTheDocument();
    expect(document.querySelector("img")).toBeNull();
  });
});
