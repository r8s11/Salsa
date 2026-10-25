import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SchoolTimetablePage from "./SchoolTimetablePage";
import { renderWorkspacePage, schoolClass, schoolWorkspace } from "./workspaceTestKit";
import type { EntityWorkspace } from "../model";

const rpc = vi.hoisted(() => vi.fn());
vi.mock("../../../lib/supabase", () => ({ supabase: { rpc } }));
vi.mock("../api/danceStylesRepo", () => ({
  fetchActiveDanceStyles: vi.fn(() =>
    Promise.resolve([
      { id: "style-salsa", name: "Salsa" },
      { id: "style-bachata", name: "Bachata" },
    ])
  ),
}));

function serve(workspace: EntityWorkspace) {
  rpc.mockImplementation((fn: string) => {
    if (fn === "entity_workspace") return Promise.resolve({ data: workspace, error: null });
    if (fn === "school_offering_save") return Promise.resolve({ data: "new-class", error: null });
    if (fn === "school_offering_delete") return Promise.resolve({ data: null, error: null });
    return Promise.resolve({ data: null, error: null });
  });
}

function renderTimetable() {
  return renderWorkspacePage(<SchoolTimetablePage />, "/host/schools/school-1/timetable", "/host/schools/:id/timetable");
}

function calls(fn: string) {
  return rpc.mock.calls.filter(([name]) => name === fn);
}

beforeEach(() => {
  rpc.mockReset();
});

describe("SchoolTimetablePage", () => {
  it("sets the week as seven divisions Monday to Sunday, keeping a day with nothing in it", async () => {
    serve(schoolWorkspace({ offerings: { classes: [schoolClass({ weekday: 2 })] } }));
    renderTimetable();

    await screen.findByText("Salsa On2 Fundamentals");
    const days = screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);
    expect(days).toEqual(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]);
    const monday = screen.getByRole("region", { name: "Monday" });
    expect(within(monday).getByText("No classes.")).toBeInTheDocument();
  });

  it("states each class as time range, title, style, level, instructor, room and drop-in price", async () => {
    serve(schoolWorkspace({ offerings: { classes: [schoolClass()] } }));
    renderTimetable();

    const tuesday = await screen.findByRole("region", { name: "Tuesday" });
    expect(within(tuesday).getByText("7:00 PM – 8:00 PM")).toBeInTheDocument();
    expect(within(tuesday).getByText("Salsa On2 Fundamentals")).toBeInTheDocument();
    for (const detail of ["Salsa", "Beginner", "Ana Rivera", "Studio B", "Drop-in $20"]) {
      expect(within(tuesday).getByText(detail)).toBeInTheDocument();
    }
  });

  it("marks a paused class", async () => {
    serve(schoolWorkspace({ offerings: { classes: [schoolClass({ status: "paused" })] } }));
    renderTimetable();

    expect(await screen.findByText(/Paused — hidden from the public page/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Resume Salsa On2 Fundamentals" })).toBeInTheDocument();
  });

  it("saves a new class in place, converting the drop-in price to cents", async () => {
    const user = userEvent.setup();
    serve(schoolWorkspace());
    renderTimetable();

    await user.click(await screen.findByRole("button", { name: "Add a class on Monday" }));
    const form = screen.getByRole("form", { name: "New class on Monday" });
    await user.type(within(form).getByLabelText("Title"), "Bachata Sensual");
    fireEvent.change(within(form).getByLabelText("Start time"), { target: { value: "20:15" } });
    await user.selectOptions(within(form).getByLabelText("Dance style"), "Bachata");
    await user.type(within(form).getByLabelText("Drop-in price (USD)"), "12.50");
    await user.click(within(form).getByRole("button", { name: "Add class" }));

    await waitFor(() => expect(calls("school_offering_save")).toHaveLength(1));
    expect(calls("school_offering_save")[0][1]).toEqual({
      p_school_id: "school-1",
      p_type: "class",
      p_id: null,
      p_payload: {
        title: "Bachata Sensual",
        style_term_id: "style-bachata",
        level: "all",
        weekday: 1,
        start_time: "20:15",
        duration_minutes: 60,
        instructor_id: null,
        instructor_name: null,
        room: null,
        drop_in_cents: 1250,
        notes: null,
        status: "active",
      },
    });
    await waitFor(() => expect(screen.queryByRole("form")).not.toBeInTheDocument());
  });

  it("validates before calling the database", async () => {
    const user = userEvent.setup();
    serve(schoolWorkspace());
    renderTimetable();

    await user.click(await screen.findByRole("button", { name: "Add a class on Friday" }));
    const form = screen.getByRole("form", { name: "New class on Friday" });
    await user.type(within(form).getByLabelText("Drop-in price (USD)"), "twenty");
    await user.click(within(form).getByRole("button", { name: "Add class" }));

    expect(await within(form).findByText("Title must be 2–120 characters.")).toBeInTheDocument();
    expect(within(form).getByText("Enter a price like 20 or 12.50.")).toBeInTheDocument();
    expect(within(form).getByLabelText("Title")).toHaveFocus();
    expect(calls("school_offering_save")).toHaveLength(0);
  });

  it("surfaces the database's refusal verbatim and keeps the form open", async () => {
    const user = userEvent.setup();
    serve(schoolWorkspace());
    rpc.mockImplementation((fn: string) =>
      fn === "school_offering_save"
        ? Promise.resolve({ data: null, error: { message: "Unknown dance style", code: "22023" } })
        : Promise.resolve({ data: schoolWorkspace(), error: null })
    );
    renderTimetable();

    await user.click(await screen.findByRole("button", { name: "Add a class on Monday" }));
    const form = screen.getByRole("form", { name: "New class on Monday" });
    await user.type(within(form).getByLabelText("Title"), "Bachata Sensual");
    await user.click(within(form).getByRole("button", { name: "Add class" }));

    expect(await within(form).findByRole("alert")).toHaveTextContent("Unknown dance style");
    expect(screen.getByRole("form", { name: "New class on Monday" })).toBeInTheDocument();
  });

  it("edits a class in its own row", async () => {
    const user = userEvent.setup();
    serve(schoolWorkspace({ offerings: { classes: [schoolClass({ instructor_id: "artist-1" })] } }));
    renderTimetable();

    await user.click(await screen.findByRole("button", { name: "Edit Salsa On2 Fundamentals" }));
    const form = screen.getByRole("form", { name: "Edit Salsa On2 Fundamentals" });
    const room = within(form).getByLabelText("Room");
    await user.clear(room);
    await user.type(room, "Studio C");
    await user.click(within(form).getByRole("button", { name: "Save class" }));

    await waitFor(() => expect(calls("school_offering_save")).toHaveLength(1));
    const args = calls("school_offering_save")[0][1];
    expect(args.p_id).toBe("class-1");
    // The artist link survives while the instructor's name is untouched.
    expect(args.p_payload).toMatchObject({ room: "Studio C", instructor_id: "artist-1", drop_in_cents: 2000 });
  });

  it("pauses a class with one press", async () => {
    const user = userEvent.setup();
    serve(schoolWorkspace({ offerings: { classes: [schoolClass()] } }));
    renderTimetable();

    await user.click(await screen.findByRole("button", { name: "Pause Salsa On2 Fundamentals" }));

    await waitFor(() => expect(calls("school_offering_save")).toHaveLength(1));
    expect(calls("school_offering_save")[0][1].p_payload).toMatchObject({ status: "paused" });
  });

  it("deletes only after confirmation", async () => {
    const user = userEvent.setup();
    serve(schoolWorkspace({ offerings: { classes: [schoolClass()] } }));
    renderTimetable();

    await user.click(await screen.findByRole("button", { name: "Delete Salsa On2 Fundamentals" }));
    expect(calls("school_offering_delete")).toHaveLength(0);
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Delete class" }));

    await waitFor(() => expect(calls("school_offering_delete")).toHaveLength(1));
    expect(calls("school_offering_delete")[0][1]).toEqual({
      p_school_id: "school-1",
      p_type: "class",
      p_id: "class-1",
    });
  });

  it("explains a refusal with a way back to Host", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: "You do not manage this listing.", code: "42501" },
    });
    renderTimetable();

    expect(await screen.findByRole("heading", { name: "You can’t open this listing" })).toBeInTheDocument();
    expect(screen.getByText(/You do not manage this listing\./)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to Host" })).toHaveAttribute("href", "/host");
  });
});
