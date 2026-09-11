import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import AdminLayout from "./AdminLayout";
import AdminUserDetailPage from "../pages/Admin/AdminUserDetailPage";

/**
 * AdminLayout owns the document's single <main> landmark. These tests verify
 * that Admin pages rendered inside AdminLayout do not introduce a nested <main>,
 * which would create two main landmarks for assistive technology.
 */

vi.mock("../contexts/useTheme", () => ({
  useTheme: () => ({ theme: "system", effectiveTheme: "light", setTheme: vi.fn() }),
}));
vi.mock("../features/admin/hooks/useOrganizerRequests", () => ({
  useOrganizerRequests: () => ({
    pendingCount: 0,
    pendingCountLoading: false,
    pendingCountError: null,
  }),
}));
vi.mock("../features/admin/hooks/useFounderRequests", () => ({
  useFounderRequests: () => ({ pendingCount: 0 }),
}));
vi.mock("../contexts/useAuth", () => ({
  useAuth: () => ({
    user: { id: "admin-1", email: "admin@example.com" },
    role: "admin",
    isAdmin: true,
    isModerator: false,
    isOrganizer: false,
    signOut: vi.fn(),
  }),
}));
vi.mock("../features/host/hooks/useMyOrganizers", () => ({
  useMyOrganizers: () => ({ data: [], isLoading: false }),
}));
vi.mock("../features/admin/api/adminUsersRepo", () => ({
  fetchAdminUserDetail: vi.fn(() => Promise.resolve(null)),
  fetchAdminUserAuditLog: vi.fn(() => Promise.resolve([])),
}));

function renderAdminRoute(path: string, routePath: string, page: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/admin" element={<AdminLayout />}>
            <Route path={routePath} element={page} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("Admin pages inside AdminLayout", () => {
  it.each([["/admin/users/u-1", "users/:id", <AdminUserDetailPage />]])(
    "exposes exactly one main landmark on %s",
    (path, routePath, page) => {
      renderAdminRoute(path, routePath, page);

      expect(screen.getAllByRole("main")).toHaveLength(1);
      expect(screen.getByRole("main")).toHaveClass("admin-main");
    }
  );
});
