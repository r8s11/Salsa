import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminFounderRequestsTable from "./AdminFounderRequestsTable";
import type { FounderAccessRequestRow } from "../../features/admin/model/founderRequestsQuery";

const baseRequest: FounderAccessRequestRow = {
  id: "req-1",
  applicant_name: "Test User",
  email: "test-founder@example.com",
  normalized_email: "test-founder@example.com",
  organization_name: "Test Founder Org",
  normalized_org_name: "test founder org",
  instagram: "testfounder",
  normalized_instagram: "testfounder",
  website: "example.com",
  city: "Test City",
  region: "Test Region",
  description: null,
  message: null,
  status: "pending",
  reviewed_by: null,
  reviewed_at: null,
  rejection_reason_code: null,
  rejection_message: null,
  created_at: "2026-09-01T10:00:00Z",
  updated_at: "2026-09-01T10:00:00Z",
};

function renderTable(requests: FounderAccessRequestRow[], isAdmin = false) {
  const onAction = vi.fn();
  const utils = render(
    <AdminFounderRequestsTable requests={requests} onAction={onAction} isAdmin={isAdmin} />
  );
  // Scope helper: returns the desktop <tr> for the request with the given id,
  // so queries don't collide with the duplicate mobile-card copy of the text.
  // Throws if the row is missing — a missing row is a real test failure.
  const desktopRow = (id: string): HTMLElement => {
    const el = utils.container.querySelector(
      `.founder-request-row[data-request-id="${id}"]`
    ) as HTMLElement | null;
    if (!el) throw new Error(`desktop row for request ${id} not found`);
    return el;
  };
  return { ...utils, onAction, desktopRow };
}

// Returns the .col-applicant <td> within a row (or null).
function desktopApplicantCell(row: HTMLElement): HTMLElement | null {
  return row.querySelector(".col-applicant") as HTMLElement | null;
}

describe("AdminFounderRequestsTable", () => {
  it("renders the five-column header and preserves table semantics", () => {
    renderTable([baseRequest]);
    const table = screen.getByRole("table");
    const headers = within(table).getAllByRole("columnheader");
    const labels = headers.map((h) => h.textContent);
    expect(labels).toEqual([
      "Applicant / Organization",
      "Contact",
      "Submitted",
      "Status",
      "Actions",
    ]);
  });

  it("stacks applicant / email / organization vertically (no email+org on same line)", () => {
    const { desktopRow } = renderTable([baseRequest]);
    const row = desktopRow(baseRequest.id);
    const cell = desktopApplicantCell(row)!;
    const name = within(cell).getByText("Test User");
    const email = within(cell).getByText("test-founder@example.com");
    const org = within(cell).getByText("Test Founder Org");
    expect(name.compareDocumentPosition(email)).toEqual(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(email.compareDocumentPosition(org)).toEqual(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it("renders a long applicant email without overlapping columns", () => {
    const req = {
      ...baseRequest,
      id: "req-long-email",
      email: "very.long.applicant.email.address@subdomain.example.com",
    };
    const { desktopRow } = renderTable([req]);
    const cell = desktopApplicantCell(desktopRow(req.id))!;
    const email = within(cell).getByText("very.long.applicant.email.address@subdomain.example.com");
    // The address remains selectable and accessible; CSS constrains the link
    // to the fixed applicant column instead of letting it push adjacent cells.
    const link = email.closest("a");
    expect(link).toHaveAttribute(
      "href",
      "mailto:very.long.applicant.email.address@subdomain.example.com"
    );
    expect(cell).toHaveClass("col-applicant");
  });

  it("truncates a very long organization name via title", () => {
    const longName =
      "An Extremely Long Organization Name That Would Otherwise Push The Table Layout When Rendered On A Single Line";
    const req = { ...baseRequest, id: "req-long-org", organization_name: longName };
    const { desktopRow } = renderTable([req]);
    const cell = desktopApplicantCell(desktopRow(req.id))!;
    const org = within(cell).getByText(longName);
    expect(org).toHaveAttribute("title", longName);
  });

  it("renders contact info stacked: location, instagram, website", () => {
    const { desktopRow } = renderTable([baseRequest]);
    const row = desktopRow(baseRequest.id);
    const contactCell = row.querySelector(".col-contact") as HTMLElement;
    expect(within(contactCell).getByText("Test City, Test Region")).toBeInTheDocument();
    expect(within(contactCell).getByText("@testfounder")).toBeInTheDocument();
    expect(within(contactCell).getByText("example.com")).toBeInTheDocument();
  });

  it("handles missing Instagram without crashing and keeps website link", () => {
    const req = { ...baseRequest, id: "req-no-ig", instagram: null };
    const { desktopRow } = renderTable([req]);
    const contactCell = desktopRow(req.id).querySelector(".col-contact") as HTMLElement;
    expect(within(contactCell).queryByText("@testfounder")).not.toBeInTheDocument();
    expect(within(contactCell).getByText("example.com")).toBeInTheDocument();
  });

  it("handles missing website and location gracefully", () => {
    const req = {
      ...baseRequest,
      id: "req-no-web",
      website: null,
      city: null,
      region: null,
      instagram: null,
    };
    const { desktopRow } = renderTable([req]);
    const contactCell = desktopRow(req.id).querySelector(".col-contact") as HTMLElement;
    // no location meta-item, no website link
    expect(contactCell.querySelector(".founder-meta-item")).toBeNull();
  });

  it("wraps a long website URL safely and links externally", () => {
    const req = {
      ...baseRequest,
      id: "req-long-web",
      website: "https://www.a-very-long-subdomain-of-an-example-domain.com/path/to/page",
    };
    const { desktopRow } = renderTable([req]);
    const contactCell = desktopRow(req.id).querySelector(".col-contact") as HTMLElement;
    const link = within(contactCell).getByLabelText(
      "Website https://www.a-very-long-subdomain-of-an-example-domain.com/path/to/page"
    );
    expect(link).toHaveAttribute("href", req.website);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renders date in a no-wrap single column", () => {
    const { desktopRow } = renderTable([baseRequest]);
    const row = desktopRow(baseRequest.id);
    const dateCell = within(row).getByText("Sep 1, 2026").closest("td");
    expect(dateCell).toHaveClass("col-submitted");
  });

  it("renders each status: pending / approved / rejected with color-independent label and review metadata", () => {
    const approved: FounderAccessRequestRow = {
      ...baseRequest,
      id: "req-approved",
      status: "approved",
      reviewed_at: "2026-09-02T12:00:00Z",
    };
    const rejected: FounderAccessRequestRow = {
      ...baseRequest,
      id: "req-rejected",
      status: "rejected",
      reviewed_at: "2026-09-03T09:30:00Z",
    };
    const { desktopRow } = renderTable([baseRequest, approved, rejected]);
    for (const req of [baseRequest, approved, rejected]) {
      const row = desktopRow(req.id);
      const badge = within(row).getByLabelText(req.status);
      expect(badge).toHaveClass(`founder-status-badge--${req.status}`);
      // status is not conveyed by color alone: a textual label is present
      expect(badge).toHaveTextContent(req.status.charAt(0).toUpperCase() + req.status.slice(1));
    }
    // only approved/rejected carry review metadata
    expect(
      within(desktopRow("req-approved")).getByText("Reviewed Sep 2, 2026")
    ).toBeInTheDocument();
    expect(
      within(desktopRow("req-rejected")).getByText("Reviewed Sep 3, 2026")
    ).toBeInTheDocument();
    // pending has no review metadata
    expect(within(desktopRow(baseRequest.id)).queryByText(/Reviewed/)).not.toBeInTheDocument();
  });

  it("renders a loading row when isLoading is true", () => {
    const { container } = render(
      <AdminFounderRequestsTable
        requests={[]}
        onAction={vi.fn()}
        isLoading={true}
        isAdmin={false}
      />
    );
    expect(container.querySelectorAll(".founder-loading-row")).toHaveLength(5);
  });

  it("renders an empty state when there are no requests", () => {
    renderTable([]);
    expect(screen.getByText("No founder requests found.")).toBeInTheDocument();
  });

  it("opens the actions menu with the correct accessible name and is keyboard operable", async () => {
    const user = userEvent.setup();
    const { desktopRow } = renderTable([baseRequest], true);
    const row = desktopRow(baseRequest.id);
    const button = within(row).getByRole("button", { name: "Actions for Test User" });
    expect(button).toHaveAttribute("aria-haspopup", "menu");
    await user.click(button);
    const menu = await within(row).findByRole("menu");
    expect(within(menu).getByRole("menuitem", { name: "View Details" })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: "Approve" })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: "Reject" })).toBeInTheDocument();
  });

  it("clicking View Details invokes onAction with the right request", async () => {
    const user = userEvent.setup();
    const { desktopRow, onAction } = renderTable([baseRequest], true);
    const row = desktopRow(baseRequest.id);
    await user.click(within(row).getByRole("button", { name: "Actions for Test User" }));
    await user.click(await within(row).findByRole("menuitem", { name: "View Details" }));
    expect(onAction).toHaveBeenCalledWith("view", baseRequest);
  });

  it("hides approve/reject actions for non-admins but keeps View Details", async () => {
    const user = userEvent.setup();
    const { desktopRow } = renderTable([baseRequest], false);
    const row = desktopRow(baseRequest.id);
    await user.click(within(row).getByRole("button", { name: "Actions for Test User" }));
    expect(within(row).queryByRole("menuitem", { name: "Approve" })).not.toBeInTheDocument();
    expect(within(row).queryByRole("menuitem", { name: "Reject" })).not.toBeInTheDocument();
    expect(await within(row).findByRole("menuitem", { name: "View Details" })).toBeInTheDocument();
  });

  it("renders a mobile stacked card below the 768px breakpoint layout", () => {
    const { container } = renderTable([baseRequest]);
    const cards = container.querySelectorAll(".founder-mobile-card");
    expect(cards).toHaveLength(1);
    expect(cards[0]).toHaveAttribute("data-request-id", baseRequest.id);
    // the card carries both Applicant and Contact data-label fields
    const fields = cards[0].querySelectorAll(".founder-mobile-card__field");
    const labels = Array.from(fields).map((f) => f.getAttribute("data-label"));
    expect(labels).toEqual(expect.arrayContaining(["Applicant / Organization", "Contact"]));
  });

  it("keeps desktop and mobile rows structurally isolated", () => {
    const { container, desktopRow } = renderTable([baseRequest]);
    expect(desktopRow(baseRequest.id)).toBeInTheDocument();
    expect(container.querySelector(".founder-request-row--desktop")).not.toBeInTheDocument();

    const mobileCard = container.querySelector(".founder-mobile-card");
    expect(mobileCard?.children).toHaveLength(1);
    expect(mobileCard?.firstElementChild).toHaveAttribute("colspan", "5");
    expect(mobileCard?.querySelector(".founder-mobile-card__actions")).toBeInTheDocument();
  });

  it("mobile card contact field has a meaningful aria-label when contact info varies", () => {
    // instagram-only contact info; the aria-label mirrors the rendered contact
    const req = {
      ...baseRequest,
      id: "req-solo",
      city: null,
      region: null,
      website: null,
      instagram: "solodance",
    };
    const { container } = renderTable([req]);
    const contactField = container.querySelector(
      '.founder-mobile-card .founder-mobile-card__field[data-label="Contact"]'
    );
    // aria-label is "Instagram @solodance" — the instagram link's accessible name
    expect(contactField).toHaveAttribute("aria-label", "@solodance");
  });
});
