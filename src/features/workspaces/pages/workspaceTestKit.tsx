import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type {
  EntityMemberRole,
  EntityWorkspace,
  PricePlan,
  PrivateOffer,
  SchoolClass,
  WorkspaceMember,
  WorkspaceRole,
} from "../model";

/** Shared fixtures and rendering for the workspace page tests. */

export function schoolClass(overrides: Partial<SchoolClass> = {}): SchoolClass {
  return {
    id: "class-1",
    title: "Salsa On2 Fundamentals",
    style_term_id: "style-salsa",
    style_name: "Salsa",
    level: "beginner",
    weekday: 2,
    start_time: "19:00",
    duration_minutes: 60,
    instructor_id: null,
    instructor_name: "Ana Rivera",
    instructor_slug: null,
    room: "Studio B",
    drop_in_cents: 2000,
    notes: null,
    status: "active",
    ...overrides,
  };
}

export function privateOffer(overrides: Partial<PrivateOffer> = {}): PrivateOffer {
  return {
    id: "private-1",
    title: "Solo coaching",
    duration_minutes: 60,
    price_cents: 8500,
    instructor_id: null,
    instructor_name: "Ana Rivera",
    instructor_slug: null,
    notes: null,
    status: "active",
    position: 0,
    ...overrides,
  };
}

export function pricePlan(overrides: Partial<PricePlan> = {}): PricePlan {
  return {
    id: "plan-1",
    name: "Eight-class pack",
    plan_type: "class_pack",
    price_cents: 12000,
    class_count: 8,
    valid_days: 60,
    notes: null,
    status: "active",
    position: 0,
    ...overrides,
  };
}

export function member(role: EntityMemberRole, overrides: Partial<WorkspaceMember> = {}): WorkspaceMember {
  return {
    user_id: `user-${role}`,
    email: `${role}@example.com`,
    display_name: null,
    member_role: role,
    created_at: "2026-10-01T00:00:00Z",
    ...overrides,
  };
}

type SchoolWorkspace = Extract<EntityWorkspace, { kind: "school" }>;

export function schoolWorkspace(
  overrides: Partial<Omit<SchoolWorkspace, "offerings" | "kind">> & {
    offerings?: Partial<SchoolWorkspace["offerings"]>;
    role?: WorkspaceRole;
  } = {}
): SchoolWorkspace {
  const { offerings, ...rest } = overrides;
  return {
    kind: "school",
    role: "owner",
    members: [member("owner")],
    upcoming: [],
    entity: {
      id: "school-1",
      name: "Salsa Academy",
      slug: "salsa-academy",
      status: "active",
      city: "boston",
      state_region: "MA",
      country: "US",
      address_line1: "1 Main St",
      postal_code: "02110",
      website: null,
      instagram: null,
      phone: null,
      description: null,
      image_url: null,
    },
    offerings: { classes: [], privates: [], plans: [], ...offerings },
    ...rest,
  };
}

/** Renders `element` at `path`, matched by `pattern`, with a fresh query cache. */
export function renderWorkspacePage(element: ReactElement, path: string, pattern: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={pattern} element={element} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}
