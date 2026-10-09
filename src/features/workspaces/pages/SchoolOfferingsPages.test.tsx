import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SchoolPricesPage from "./SchoolPricesPage";
import SchoolPrivatesPage from "./SchoolPrivatesPage";
import { pricePlan, privateOffer, renderWorkspacePage, schoolWorkspace } from "./workspaceTestKit";
import type { EntityWorkspace } from "../model";

const rpc = vi.hoisted(() => vi.fn());
vi.mock("../../../lib/supabase", () => ({ supabase: { rpc } }));

function serve(workspace: EntityWorkspace) {
  rpc.mockImplementation((fn: string) =>
    Promise.resolve(fn === "entity_workspace" ? { data: workspace, error: null } : { data: "saved-id", error: null })
  );
}

function saves() {
  return rpc.mock.calls.filter(([name]) => name === "school_offering_save").map(([, args]) => args);
}

function renderPrivates() {
  return renderWorkspacePage(<SchoolPrivatesPage />, "/host/schools/school-1/privates", "/host/schools/:id/privates");
}

function renderPrices() {
  return renderWorkspacePage(<SchoolPricesPage />, "/host/schools/school-1/prices", "/host/schools/:id/prices");
}

beforeEach(() => {
  rpc.mockReset();
});

describe("SchoolPrivatesPage", () => {
  it("lists privates in order with price, duration and instructor", async () => {
    serve(
      schoolWorkspace({
        offerings: {
          privates: [
            privateOffer({ id: "p1", title: "Solo coaching", position: 0 }),
            privateOffer({ id: "p2", title: "Couples coaching", price_cents: 12500, position: 1, status: "paused" }),
          ],
        },
      })
    );
    renderPrivates();

    const list = await screen.findByRole("list", { name: "Private lessons" });
    const rows = within(list).getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText("Solo coaching")).toBeInTheDocument();
    expect(within(rows[0]).getByText("$85")).toBeInTheDocument();
    expect(within(rows[1]).getByText("$125")).toBeInTheDocument();
    expect(within(rows[1]).getByText(/Paused — hidden from the public page/)).toBeInTheDocument();
  });

  it("adds a private lesson, converting dollars to cents", async () => {
    const user = userEvent.setup();
    serve(schoolWorkspace());
    renderPrivates();

    await user.click(await screen.findByRole("button", { name: "Add private lesson" }));
    const form = screen.getByRole("form", { name: "New private lesson" });
    await user.type(within(form).getByLabelText("Title"), "Solo coaching");
    await user.type(within(form).getByLabelText("Price (USD)"), "85.5");
    await user.click(within(form).getByRole("button", { name: "Add private lesson" }));

    await waitFor(() => expect(saves()).toHaveLength(1));
    expect(saves()[0]).toEqual({
      p_school_id: "school-1",
      p_type: "private",
      p_id: null,
      p_payload: {
        title: "Solo coaching",
        duration_minutes: 60,
        price_cents: 8550,
        instructor_id: null,
        instructor_name: null,
        notes: null,
        status: "active",
      },
    });
  });

  it("requires a price", async () => {
    const user = userEvent.setup();
    serve(schoolWorkspace());
    renderPrivates();

    await user.click(await screen.findByRole("button", { name: "Add private lesson" }));
    const form = screen.getByRole("form", { name: "New private lesson" });
    await user.type(within(form).getByLabelText("Title"), "Solo coaching");
    await user.click(within(form).getByRole("button", { name: "Add private lesson" }));

    expect(await within(form).findByText("Enter a price.")).toBeInTheDocument();
    expect(saves()).toHaveLength(0);
  });

  it("moves a lesson up by swapping the two positions", async () => {
    const user = userEvent.setup();
    serve(
      schoolWorkspace({
        offerings: {
          privates: [
            privateOffer({ id: "p1", title: "First", position: 0 }),
            privateOffer({ id: "p2", title: "Second", position: 1 }),
          ],
        },
      })
    );
    renderPrivates();

    expect(await screen.findByRole("button", { name: "Move First up" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move Second down" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Move Second up" }));

    await waitFor(() => expect(saves()).toHaveLength(2));
    expect(saves().map((args) => [args.p_id, args.p_payload.position])).toEqual([
      ["p2", 0],
      ["p1", 1],
    ]);
  });

  it("renumbers a list whose positions were never distinct", async () => {
    const user = userEvent.setup();
    serve(
      schoolWorkspace({
        offerings: {
          privates: [
            privateOffer({ id: "p1", title: "First", position: 0 }),
            privateOffer({ id: "p2", title: "Second", position: 0 }),
            privateOffer({ id: "p3", title: "Third", position: 0 }),
          ],
        },
      })
    );
    renderPrivates();

    await user.click(await screen.findByRole("button", { name: "Move Third up" }));

    await waitFor(() => expect(saves()).toHaveLength(2));
    expect(saves().map((args) => [args.p_id, args.p_payload.position])).toEqual([
      ["p3", 1],
      ["p2", 2],
    ]);
  });

  it("pauses and deletes with confirmation", async () => {
    const user = userEvent.setup();
    serve(schoolWorkspace({ offerings: { privates: [privateOffer()] } }));
    renderPrivates();

    await user.click(await screen.findByRole("button", { name: "Pause Solo coaching" }));
    await waitFor(() => expect(saves()).toHaveLength(1));
    expect(saves()[0].p_payload).toMatchObject({ status: "paused", position: 0 });

    await user.click(screen.getByRole("button", { name: "Delete Solo coaching" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete private lesson" }));
    await waitFor(() =>
      expect(rpc).toHaveBeenCalledWith("school_offering_delete", {
        p_school_id: "school-1",
        p_type: "private",
        p_id: "private-1",
      })
    );
  });
});

describe("SchoolPricesPage", () => {
  it("states each plan's price, type, class count and validity", async () => {
    serve(schoolWorkspace({ offerings: { plans: [pricePlan()] } }));
    renderPrices();

    const list = await screen.findByRole("list", { name: "Price plans" });
    for (const part of ["$120", "Class pack", "8 classes", "valid 60 days"]) {
      expect(within(list).getByText(part)).toBeInTheDocument();
    }
  });

  it("adds a plan with its plan type and optional counts", async () => {
    const user = userEvent.setup();
    serve(schoolWorkspace());
    renderPrices();

    await user.click(await screen.findByRole("button", { name: "Add price plan" }));
    const form = screen.getByRole("form", { name: "New price plan" });
    await user.type(within(form).getByLabelText("Name"), "Unlimited month");
    await user.selectOptions(within(form).getByLabelText("Type"), "Membership");
    await user.type(within(form).getByLabelText("Price (USD)"), "150");
    await user.type(within(form).getByLabelText("Valid for (days)"), "30");
    await user.click(within(form).getByRole("button", { name: "Add price plan" }));

    await waitFor(() => expect(saves()).toHaveLength(1));
    expect(saves()[0]).toEqual({
      p_school_id: "school-1",
      p_type: "plan",
      p_id: null,
      p_payload: {
        name: "Unlimited month",
        plan_type: "membership",
        price_cents: 15000,
        class_count: null,
        valid_days: 30,
        notes: null,
        status: "active",
      },
    });
  });

  it("rejects counts that are not whole numbers", async () => {
    const user = userEvent.setup();
    serve(schoolWorkspace());
    renderPrices();

    await user.click(await screen.findByRole("button", { name: "Add price plan" }));
    const form = screen.getByRole("form", { name: "New price plan" });
    await user.type(within(form).getByLabelText("Name"), "Pack");
    await user.type(within(form).getByLabelText("Price (USD)"), "100");
    await user.type(within(form).getByLabelText("Number of classes"), "eight");
    await user.click(within(form).getByRole("button", { name: "Add price plan" }));

    expect(await within(form).findByText("Enter 1–1000 classes, or leave blank.")).toBeInTheDocument();
    expect(saves()).toHaveLength(0);
  });

  it("moves a plan down", async () => {
    const user = userEvent.setup();
    serve(
      schoolWorkspace({
        offerings: {
          plans: [
            pricePlan({ id: "a", name: "Alpha", position: 0 }),
            pricePlan({ id: "b", name: "Bravo", position: 1 }),
          ],
        },
      })
    );
    renderPrices();

    await user.click(await screen.findByRole("button", { name: "Move Alpha down" }));

    await waitFor(() => expect(saves()).toHaveLength(2));
    expect(saves().map((args) => [args.p_id, args.p_payload.position])).toEqual([
      ["b", 0],
      ["a", 1],
    ]);
  });
});
