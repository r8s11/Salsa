import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import InstructorField, { type InstructorValue } from "./InstructorField";

const rpc = vi.hoisted(() => vi.fn());
vi.mock("../../../lib/supabase", () => ({ supabase: { rpc } }));

const ANA_BOSTON = {
  kind: "instructor",
  id: "artist-1",
  name: "Ana Rivera",
  slug: "ana-rivera",
  city: "Boston",
  state_region: "MA",
  description: "On2 and mambo.",
  image_url: null,
};
const ANA_MIAMI = { ...ANA_BOSTON, id: "artist-2", slug: "ana-rivera-miami", city: "Miami", state_region: "FL", description: null };

const changes = vi.fn();
const formKeys = vi.fn();

function Harness({ initial }: { initial: InstructorValue }) {
  const [value, setValue] = useState(initial);
  return (
    <form onKeyDown={(event) => formKeys(event.key)}>
      <InstructorField
        value={value}
        onChange={(next) => {
          changes(next);
          setValue(next);
        }}
      />
    </form>
  );
}

function renderField(initial: InstructorValue = { id: "", name: "" }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <Harness initial={initial} />
    </QueryClientProvider>
  );
}

function directory(refs: unknown[] | Error) {
  rpc.mockImplementation(() =>
    Promise.resolve(refs instanceof Error ? { data: null, error: { message: refs.message } } : { data: refs, error: null })
  );
}

beforeEach(() => {
  rpc.mockReset();
  changes.mockReset();
  formKeys.mockReset();
});

describe("InstructorField", () => {
  it("offers matching artists with their city and links only the one picked", async () => {
    const user = userEvent.setup();
    directory([ANA_BOSTON, ANA_MIAMI]);
    renderField();

    await user.type(screen.getByRole("combobox", { name: "Instructor" }), "Ana");
    const options = await screen.findAllByRole("option");
    expect(options).toHaveLength(2);
    expect(options[0]).toHaveTextContent("Ana Rivera");
    expect(options[0]).toHaveTextContent("Boston, MA");
    expect(options[1]).toHaveTextContent("Miami, FL");
    expect(rpc).toHaveBeenLastCalledWith(
      "public_entity_directory",
      expect.objectContaining({ p_kind: "instructor", p_query: "Ana" })
    );
    // Typing alone never linked anyone.
    expect(changes.mock.calls.every(([next]) => next.id === "")).toBe(true);

    await user.click(options[1]);
    expect(changes).toHaveBeenLastCalledWith({ id: "artist-2", name: "Ana Rivera" });
    expect(screen.getByRole("button", { name: "Unlink Ana Rivera" })).toBeInTheDocument();
    expect(screen.getByLabelText("Instructor")).toHaveAttribute("readonly");
  });

  it("picks from the keyboard and closes the results on Escape without leaving the form", async () => {
    const user = userEvent.setup();
    directory([ANA_BOSTON, ANA_MIAMI]);
    renderField();

    const input = screen.getByRole("combobox", { name: "Instructor" });
    await user.type(input, "Ana");
    await screen.findAllByRole("option");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
    expect(formKeys).not.toHaveBeenCalledWith("Escape");

    await user.keyboard("{ArrowDown}");
    await screen.findAllByRole("option");
    await user.keyboard("{ArrowDown}{Enter}");
    expect(changes).toHaveBeenLastCalledWith({ id: "artist-2", name: "Ana Rivera" });
  });

  it("keeps a typed name as plain text when nobody matches", async () => {
    const user = userEvent.setup();
    directory([]);
    renderField();

    await user.type(screen.getByRole("combobox", { name: "Instructor" }), "Guest Teacher");
    expect(await screen.findByText(/No artist matches “Guest Teacher”/)).toBeInTheDocument();
    expect(changes).toHaveBeenLastCalledWith({ id: "", name: "Guest Teacher" });
    expect(screen.queryByRole("button", { name: /Unlink/ })).not.toBeInTheDocument();
  });

  it("shows an existing link and unlinks only on request, keeping the name as plain text", async () => {
    const user = userEvent.setup();
    renderField({ id: "artist-1", name: "Ana Rivera" });

    expect(screen.getByLabelText("Instructor")).toHaveValue("Ana Rivera");
    expect(screen.getByLabelText("Instructor")).toHaveAttribute("readonly");
    expect(rpc).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Unlink Ana Rivera" }));
    expect(changes).toHaveBeenLastCalledWith({ id: "", name: "Ana Rivera" });
    const input = screen.getByRole("combobox", { name: "Instructor" });
    expect(input).not.toHaveAttribute("readonly");
    expect(input).toHaveFocus();
    // Unlinking does not go searching by itself.
    expect(rpc).not.toHaveBeenCalled();
  });

  it("reports a failed search and retries it", async () => {
    const user = userEvent.setup();
    directory(new Error("network down"));
    renderField();

    await user.type(screen.getByRole("combobox", { name: "Instructor" }), "Ana");
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn’t search artists right now");

    directory([ANA_BOSTON]);
    await user.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(screen.getByRole("option")).toHaveTextContent("Ana Rivera"));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("does not search for a single character", async () => {
    const user = userEvent.setup();
    directory([ANA_BOSTON]);
    renderField();

    await user.type(screen.getByRole("combobox", { name: "Instructor" }), "A");
    const { promise, resolve } = Promise.withResolvers<void>();
    setTimeout(resolve, 350);
    await promise;
    expect(rpc).not.toHaveBeenCalled();
  });
});
