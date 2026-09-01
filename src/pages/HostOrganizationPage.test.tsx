import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import HostOrganizationPage from "./HostOrganizationPage";
import { useMyOrganizers } from "../features/host/hooks/useMyOrganizers";
import {
  fetchOrganizerProfile,
  updateOrganizerProfile,
} from "../features/host/api/organizerAccessRepo";
import type { OrganizerMembership } from "../features/host/api/organizerAccessRepo";

vi.mock("../features/host/hooks/useMyOrganizers");
vi.mock("../features/host/api/organizerAccessRepo");

const mockOwnerMembership: OrganizerMembership = {
  organizerId: "org-1",
  organizerName: "Boston Salsa Collective",
  organizerSlug: "boston-salsa",
  organizerStatus: "active",
  memberRole: "owner",
  description: "Weekly salsa socials around Greater Boston.",
  logoUrl: null,
  website: "https://bostonsalsa.com",
  instagram: "@bostonsalsa",
  organizerType: "promoter",
  primaryCity: "Boston",
};

const mockEditorMembership: OrganizerMembership = {
  ...mockOwnerMembership,
  memberRole: "editor",
};

const mockManagerMembership: OrganizerMembership = {
  ...mockOwnerMembership,
  memberRole: "manager",
};

function renderPage() {
  return render(
    <MemoryRouter>
      <HostOrganizationPage />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  (useMyOrganizers as Mock).mockReturnValue({ data: [mockOwnerMembership], isLoading: false });
  (fetchOrganizerProfile as Mock).mockResolvedValue(mockOwnerMembership);
});

describe("HostOrganizationPage — loading and error states", () => {
  it("shows loading state while organizers load", () => {
    (useMyOrganizers as Mock).mockReturnValue({ data: [], isLoading: true });
    renderPage();
    expect(screen.getByText("Checking organizer access…")).toBeInTheDocument();
  });

  it("shows error when organizers fail to load", () => {
    (useMyOrganizers as Mock).mockReturnValue({
      data: [],
      isLoading: false,
      error: new Error("fail"),
    });
    renderPage();
    expect(screen.getByText(/We couldn't load your organizers/)).toBeInTheDocument();
  });

  it("shows empty state when user has no organizers", () => {
    (useMyOrganizers as Mock).mockReturnValue({ data: [], isLoading: false });
    renderPage();
    expect(screen.getByText(/don't have access to any organizations/)).toBeInTheDocument();
  });
});

describe("HostOrganizationPage — profile view", () => {
  it("displays the organizer name", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Boston Salsa Collective")).toBeInTheDocument();
    });
  });

  it("displays the organizer description", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Weekly salsa socials around Greater Boston.")).toBeInTheDocument();
    });
  });

  it("displays the organizer type with friendly label", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Promoter")).toBeInTheDocument();
    });
  });

  it("displays the primary city", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Boston")).toBeInTheDocument();
    });
  });

  it("displays the website link", async () => {
    renderPage();
    await waitFor(() => {
      const link = screen.getByText("https://bostonsalsa.com");
      expect(link).toHaveAttribute("href", "https://bostonsalsa.com");
    });
  });

  it("displays the Instagram handle", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("@bostonsalsa")).toBeInTheDocument();
    });
  });

  it("displays the active status badge", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Active")).toBeInTheDocument();
    });
  });

  it("shows logo fallback initials when no logo URL", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("BS")).toBeInTheDocument();
    });
  });

  it("shows logo image when logo URL is set", async () => {
    (fetchOrganizerProfile as Mock).mockResolvedValue({
      ...mockOwnerMembership,
      logoUrl: "https://example.com/logo.png",
    });
    renderPage();
    await waitFor(() => {
      const img = screen.getByAltText("Boston Salsa Collective logo");
      expect(img).toHaveAttribute("src", "https://example.com/logo.png");
    });
  });

  it("shows 'No description added yet.' when description is empty", async () => {
    (fetchOrganizerProfile as Mock).mockResolvedValue({
      ...mockOwnerMembership,
      description: null,
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("No description added yet.")).toBeInTheDocument();
    });
  });

  it("shows 'Not added.' for empty website", async () => {
    (fetchOrganizerProfile as Mock).mockResolvedValue({
      ...mockOwnerMembership,
      website: null,
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Not added.")).toBeInTheDocument();
    });
  });

  it("displays the user's role", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Owner")).toBeInTheDocument();
    });
  });
});

describe("HostOrganizationPage — access control", () => {
  it("shows Edit Organization button for owner", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Edit Organization/ })).toBeInTheDocument();
    });
  });

  it("shows Edit Organization button for manager", async () => {
    (useMyOrganizers as Mock).mockReturnValue({ data: [mockManagerMembership], isLoading: false });
    (fetchOrganizerProfile as Mock).mockResolvedValue(mockManagerMembership);
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Edit Organization/ })).toBeInTheDocument();
    });
  });

  it("shows 'View only' for editor", async () => {
    (useMyOrganizers as Mock).mockReturnValue({ data: [mockEditorMembership], isLoading: false });
    (fetchOrganizerProfile as Mock).mockResolvedValue(mockEditorMembership);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("View only")).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: /Edit Organization/ })).not.toBeInTheDocument();
  });
});

describe("HostOrganizationPage — edit form", () => {
  it("opens edit form with pre-filled values", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Boston Salsa Collective")).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole("button", { name: /Edit Organization/ }));
    expect(screen.getByLabelText("Organization name")).toHaveValue("Boston Salsa Collective");
    expect(screen.getByLabelText("About")).toHaveValue("Weekly salsa socials around Greater Boston.");
  });

  it("validates name is required", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Boston Salsa Collective")).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole("button", { name: /Edit Organization/ }));
    await userEvent.clear(screen.getByLabelText("Organization name"));
    await userEvent.click(screen.getByRole("button", { name: "Save Changes" }));
    expect(screen.getByText("Organization name is required.")).toBeInTheDocument();
  });

  it("calls updateOrganizerProfile with changed fields", async () => {
    (updateOrganizerProfile as Mock).mockResolvedValue(undefined);
    (fetchOrganizerProfile as Mock)
      .mockResolvedValueOnce(mockOwnerMembership)
      .mockResolvedValueOnce({ ...mockOwnerMembership, description: "Updated description" });

    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Boston Salsa Collective")).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole("button", { name: /Edit Organization/ }));
    await userEvent.clear(screen.getByLabelText("About"));
    await userEvent.type(screen.getByLabelText("About"), "Updated description");
    await userEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => {
      expect(updateOrganizerProfile).toHaveBeenCalledWith("org-1", {
        description: "Updated description",
      });
    });
  });

  it("shows success message after save", async () => {
    (updateOrganizerProfile as Mock).mockResolvedValue(undefined);
    (fetchOrganizerProfile as Mock)
      .mockResolvedValueOnce(mockOwnerMembership)
      .mockResolvedValueOnce({ ...mockOwnerMembership, description: "New" });

    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Boston Salsa Collective")).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole("button", { name: /Edit Organization/ }));
    await userEvent.clear(screen.getByLabelText("About"));
    await userEvent.type(screen.getByLabelText("About"), "New");
    await userEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => {
      expect(screen.getByText("Organization updated.")).toBeInTheDocument();
    });
  });

  it("shows error on save failure", async () => {
    (updateOrganizerProfile as Mock).mockRejectedValue(new Error("Save failed"));

    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Boston Salsa Collective")).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole("button", { name: /Edit Organization/ }));
    await userEvent.type(screen.getByLabelText("About"), " more");
    await userEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => {
      expect(screen.getByText("Save failed")).toBeInTheDocument();
    });
  });

  it("cancels editing and returns to view", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Boston Salsa Collective")).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole("button", { name: /Edit Organization/ }));
    expect(screen.getByLabelText("Organization name")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByLabelText("Organization name")).not.toBeInTheDocument();
  });
});

describe("HostOrganizationPage — multi-organizer selector", () => {
  it("shows selector when user has multiple organizers", async () => {
    const secondOrg: OrganizerMembership = {
      ...mockOwnerMembership,
      organizerId: "org-2",
      organizerName: "NYC Bachata",
    };
    (useMyOrganizers as Mock).mockReturnValue({
      data: [mockOwnerMembership, secondOrg],
      isLoading: false,
    });
    renderPage();
    expect(screen.getByLabelText("Organization")).toBeInTheDocument();
    expect(screen.getByText("Boston Salsa Collective")).toBeInTheDocument();
    expect(screen.getByText("NYC Bachata")).toBeInTheDocument();
  });

  it("hides selector when user has one organizer", async () => {
    renderPage();
    expect(screen.queryByLabelText("Organization")).not.toBeInTheDocument();
  });
});

describe("HostOrganizationPage — suspended organizer", () => {
  it("shows suspended status badge", async () => {
    const suspended: OrganizerMembership = {
      ...mockOwnerMembership,
      organizerStatus: "suspended",
    };
    (useMyOrganizers as Mock).mockReturnValue({ data: [suspended], isLoading: false });
    (fetchOrganizerProfile as Mock).mockResolvedValue(suspended);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Suspended")).toBeInTheDocument();
    });
  });
});
