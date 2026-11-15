import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor, within, type RenderResult } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { marked, type Tokens } from 'marked';
import { Providers } from '../../app/providers';
import App from '../../app/App';
import { CityProvider } from '../../contexts/CityContext';
import { GUIDES, guideBySlug, loadGuideSource, type GuideSlug } from './guides';
import { parseGuide } from './markdown/parseGuide';
import { headingSlugger } from './slug';
import uiLabels from '../../content/help/uiLabels.json';
import SignInForm from '../../features/auth/components/SignInForm';
import SubmitEventPage from '../../pages/SubmitEventPage';
import RequestListingPage from '../../features/listingRequests/pages/RequestListingPage';
import { listingRequest } from '../../features/listingRequests/listingRequestTestKit';
import HostDashboard from '../../features/host/components/HostDashboard';
import HostEventImportPage from '../../pages/host/HostEventImportPage';
import BulkFlyerImportPage from '../../pages/BulkFlyerImportPage';
import HostAttendeeListPage from '../../pages/host/HostAttendeeListPage';
import HostAttendeeEditPage from '../../pages/host/HostAttendeeEditPage';
import HostCheckInPage from '../../pages/host/HostCheckInPage';
import HostOrganizationPage from '../../pages/host/HostOrganizationPage';
import ProfileEditPage from '../../pages/account/ProfileEditPage';
import EntityWorkspaceTeamPage from '../../features/workspaces/pages/EntityWorkspaceTeamPage';
import { member, schoolWorkspace } from '../../features/workspaces/pages/workspaceTestKit';
import { EntityClaimDialog } from '../../features/workspaces/components/public/EntityClaimDialog';
import type { EntityWorkspace } from '../../features/workspaces/model';

// jsdom gaps: pages call scrollIntoView (help anchors, focus handling) and the
// calendar views register ResizeObserver. Neither exists in jsdom.
Element.prototype.scrollIntoView = () => {};
if (!('ResizeObserver' in globalThis)) {
  Object.defineProperty(globalThis, 'ResizeObserver', {
    configurable: true,
    writable: true,
    value: class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  });
}

/* ───────────────────────── shared mock state ───────────────────────── */

type QueryBuilderStub = {
  then?: (
    onFulfilled: (value: unknown) => unknown,
    onRejected: (reason: unknown) => unknown
  ) => Promise<unknown>;
  [method: string]: unknown;
};

type AttendanceRow = Record<string, unknown>;
type MemberRpcArgs = { p_email: string; p_role: string; p_user_id: string; p_remove: boolean };
type TeamWorkspaceStub = { members: { user_id: string; email: string; display_name: string | null; member_role: string; created_at: string }[] };

const h = vi.hoisted(() => {
  const queryBuilder = (): QueryBuilderStub => {
    const b: QueryBuilderStub = {};
    for (const m of ['select', 'insert', 'update', 'delete', 'upsert', 'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'in', 'is', 'not', 'or', 'and', 'order', 'limit', 'range', 'offset', 'contains', 'filter']) {
      b[m] = () => b;
    }
    b.single = async () => ({ data: null, error: null, count: 0 });
    b.maybeSingle = async () => ({ data: null, error: null, count: 0 });
    b.then = (resolve, reject) => Promise.resolve({ data: [], error: null, count: 0 }).then(resolve, reject);
    return b;
  };
  const attendance: { attendees: AttendanceRow[]; checkIns: AttendanceRow[]; seq: number } = {
    attendees: [],
    checkIns: [],
    seq: 0,
  };
  const attendanceRepo = {
    fetchEventAttendees: vi.fn().mockImplementation(async () => structuredClone(attendance.attendees)),
    fetchEventCheckIns: vi.fn().mockImplementation(async () => structuredClone(attendance.checkIns)),
    addEventAttendee: vi.fn().mockImplementation(async (eventId: string, input: AttendanceRow) => {
      const row: AttendanceRow = {
        id: `att-new-${++attendance.seq}`,
        eventId,
        profileId: null,
        displayName: input.displayName,
        email: input.email ?? null,
        category: input.category ?? 'guest',
        source: 'host',
        partySize: input.partySize ?? 1,
        notes: input.notes ?? null,
        createdBy: 'user-1',
        createdAt: '2026-11-01T00:00:00Z',
        updatedAt: '2026-11-01T00:00:00Z',
      };
      attendance.attendees.push(row);
      return structuredClone(row);
    }),
    updateEventAttendee: vi.fn().mockImplementation(async (_eventId: string, attendeeId: string, updates: AttendanceRow) => {
      const row = attendance.attendees.find((a) => a.id === attendeeId);
      if (row) {
        for (const key of ['displayName', 'email', 'category', 'partySize', 'notes'] as const) {
          if (updates[key] !== undefined) row[key] = updates[key];
        }
        row.updatedAt = '2026-11-02T00:00:00Z';
      }
      return structuredClone(row);
    }),
    deleteEventAttendee: vi.fn().mockImplementation(async () => undefined),
    checkInAttendee: vi.fn().mockImplementation(async (eventId: string, input: { attendeeId: string; method?: string }) => {
      const rows = attendance.checkIns;
      if (rows.some((c) => c.attendeeId === input.attendeeId && !c.reversedAt)) {
        throw new Error('This attendee is already checked in.');
      }
      const row: AttendanceRow = {
        id: `ci-${++attendance.seq}`,
        attendeeId: input.attendeeId,
        eventId,
        checkedInAt: new Date(2026, 10, 9, 20, attendance.seq).toISOString(),
        checkedInBy: 'user-1',
        method: input.method ?? 'manual',
        reversedAt: null,
        reversedBy: null,
        reversalReason: null,
        createdAt: new Date(2026, 10, 9, 20, attendance.seq).toISOString(),
      };
      rows.unshift(row);
      return structuredClone(row);
    }),
    reverseCheckIn: vi.fn().mockImplementation(async (_eventId: string, input: { checkInId: string }) => {
      const row = attendance.checkIns.find((c) => c.id === input.checkInId);
      if (!row || row.reversedAt) throw new Error('Could not undo this check-in.');
      row.reversedAt = new Date(2026, 10, 9, 21, ++attendance.seq).toISOString();
      row.reversedBy = 'user-1';
      return structuredClone(row);
    }),
  };
  return {
    auth: {
      getSession: vi.fn().mockImplementation(async () => ({ data: { session: null }, error: null })),
      onAuthStateChange: vi.fn().mockImplementation(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signInWithPassword: vi.fn().mockImplementation(async () => ({ error: null, user: null })),
      signInWithOAuth: vi.fn().mockImplementation(async () => ({ data: null, error: null })),
      signInWithIdToken: vi.fn().mockImplementation(async () => ({ data: { user: null, session: null }, error: null })),
      resendConfirmation: vi.fn().mockImplementation(async () => ({ error: null })),
      requestPasswordReset: vi.fn().mockImplementation(async () => ({ error: null })),
      updateEmail: vi.fn().mockImplementation(async () => ({ error: null })),
      signUp: vi.fn().mockImplementation(async () => ({ data: null, error: null })),
      signOut: vi.fn().mockImplementation(async () => ({ error: null })),
      clearDeletedAccount: vi.fn(),
    },
    rpc: vi.fn(),
    from: vi.fn().mockImplementation(() => queryBuilder()),
    invoke: vi.fn().mockImplementation(async () => ({ data: null, error: null })),
    attendance,
    attendanceRepo,
    createSubmission: vi.fn().mockImplementation(async () => 'submission-id'),
    updateOwnProfile: vi.fn().mockImplementation(async () => ({})),
    fetchOrganizerProfile: vi.fn().mockImplementation(async () => null),
    updateOrganizerProfile: vi.fn().mockImplementation(async () => undefined),
    createOrganizerEvent: vi.fn().mockImplementation(async () => 'event-1'),
    uploadEventFlyer: vi.fn().mockImplementation(async () => ({ url: '', path: '' })),
    removeEventFlyer: vi.fn().mockImplementation(async () => undefined),
    extractEventFromFlyer: vi.fn().mockImplementation(async () => ({})),
    hooks: {
      useAuth: vi.fn(),
      useOwnProfile: vi.fn(),
      useUpdateOwnProfile: vi.fn(),
      useSubmissionAccess: vi.fn(),
      useMyOrganizers: vi.fn(),
      useMyOrganizerEvents: vi.fn(),
      useMySubmissions: vi.fn(),
      useMyEntityMemberships: vi.fn(),
      useHostEventImport: vi.fn(),
      useActiveTaxonomyTerms: vi.fn(),
    },
  };
});

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: h.auth,
    rpc: h.rpc,
    from: h.from,
    functions: { invoke: h.invoke },
  },
  supabaseAuthStorageKey: 'sb-salsa-test-auth-token',
  supabaseURL: 'http://localhost:54321',
  supabasePublishableKey: 'test-publishable-key',
}));
vi.mock('../../contexts/useAuth', () => ({ useAuth: h.hooks.useAuth }));
vi.mock('../../features/metros/hooks/useMetros', () => import('../../test/mockMetros'));
vi.mock('../../features/account/hooks/useOwnProfile', () => ({ useOwnProfile: h.hooks.useOwnProfile }));
vi.mock('../../features/account/hooks/useUpdateOwnProfile', () => ({ useUpdateOwnProfile: h.hooks.useUpdateOwnProfile }));
vi.mock('../../features/submit-event/hooks/useSubmissionAccess', () => ({ useSubmissionAccess: h.hooks.useSubmissionAccess }));
vi.mock('../../features/admin/api/submissionsRepo', () => ({ createSubmission: h.createSubmission }));
vi.mock('../../features/submit-event/api/submissionNotification', () => ({ notifySubmissionReceived: vi.fn() }));
vi.mock('../../features/host/hooks/useMyOrganizers', () => ({ useMyOrganizers: h.hooks.useMyOrganizers }));
vi.mock('../../features/host/hooks/useMyOrganizerEvents', () => ({ useMyOrganizerEvents: h.hooks.useMyOrganizerEvents }));
vi.mock('../../features/account/hooks/useMySubmissions', () => ({ useMySubmissions: h.hooks.useMySubmissions }));
vi.mock('../../features/workspaces/hooks/useMyEntityMemberships', () => ({
  useMyEntityMemberships: h.hooks.useMyEntityMemberships,
  MY_ENTITY_MEMBERSHIPS_KEY: 'my-entity-memberships',
  MY_ENTITY_CLAIMS_KEY: 'my-entity-claims',
}));
vi.mock('../../features/host/hooks/useHostEventImport', () => ({ useHostEventImport: h.hooks.useHostEventImport }));
vi.mock('../../features/admin/hooks/useAdminTaxonomy', () => ({ useActiveTaxonomyTerms: h.hooks.useActiveTaxonomyTerms }));
vi.mock('../../features/host/api/organizerAccessRepo', async (importOriginal) => {
  // Keep real exports like OrganizerAccessError; stub the three data calls.
  const original = (await importOriginal()) as Record<string, unknown>;
  return {
    ...original,
    fetchOrganizerProfile: h.fetchOrganizerProfile,
    updateOrganizerProfile: h.updateOrganizerProfile,
    createOrganizerEvent: h.createOrganizerEvent,
  };
});
vi.mock('../../features/events/api/eventFlyers', async (importOriginal) => {
  // Keep real validateEventFlyer; only the storage-touching calls are stubbed.
  const original = (await importOriginal()) as Record<string, unknown>;
  return { ...original, uploadEventFlyer: h.uploadEventFlyer, removeEventFlyer: h.removeEventFlyer };
});
vi.mock('../../features/flyer-extraction/client', async (importOriginal) => {
  // Keep the real module surface for SubmitEventPage's extraction panel.
  const original = (await importOriginal()) as Record<string, unknown>;
  return { ...original, extractEventFromFlyer: h.extractEventFromFlyer };
});
vi.mock('../../features/entity-matching/entityReviewClient', async (importOriginal) => {
  // Entity lookup stays unavailable in tests, as the page tests prescribe.
  const original = (await importOriginal()) as Record<string, unknown>;
  return {
    ...original,
    reconcileEntities: vi.fn().mockImplementation(async () => {
      throw new Error('Entity lookup unavailable');
    }),
    searchEntityMatches: vi.fn().mockImplementation(async () => []),
  };
});
vi.mock('../../features/host/api/attendanceRepo', () => h.attendanceRepo);
vi.mock('posthog-js', () => ({
  default: { capture: vi.fn(), logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } },
}));

/* ───────────────────── shared fixtures and helpers ───────────────────── */

function authValue(overrides: Record<string, unknown> = {}) {
  return {
    user: null,
    session: null,
    loading: false,
    role: null,
    isAdmin: false,
    isModerator: false,
    isOrganizer: false,
    signInWithPassword: h.auth.signInWithPassword,
    signInWithOAuth: h.auth.signInWithOAuth,
    signInWithIdToken: h.auth.signInWithIdToken,
    resendConfirmation: h.auth.resendConfirmation,
    requestPasswordReset: h.auth.requestPasswordReset,
    updateEmail: h.auth.updateEmail,
    signUp: h.auth.signUp,
    signOut: h.auth.signOut,
    clearDeletedAccount: h.auth.clearDeletedAccount,
    ...overrides,
  };
}

function baseProfile(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    display_name: 'Maria Santos',
    username: 'mariasalsa',
    avatar_url: null,
    status: 'active',
    status_reason: null,
    created_at: '2026-01-15T00:00:00Z',
    bio: null,
    city: null,
    dance_styles: [],
    instagram: null,
    website: null,
    cover_url: null,
    public_profile: true,
    stats_public: true,
    notification_prefs: {},
    onboarding_completed_at: '2026-01-15T00:00:00Z',
    ...overrides,
  };
}

const organizerMembership = {
  organizerId: 'org-1',
  organizerName: 'Boston Salsa Collective',
  organizerSlug: 'boston-salsa',
  organizerStatus: 'active',
  memberRole: 'owner',
  description: 'Weekly salsa socials around Greater Boston.',
  logoUrl: null,
  website: 'https://bostonsalsa.com',
  instagram: '@bostonsalsa',
  organizerType: 'promoter',
  primaryCity: 'Boston',
};

const ana: AttendanceRow = {
  id: 'att-1',
  eventId: 'evt-1',
  profileId: null,
  displayName: 'Ana Garcia',
  email: 'ana@example.com',
  category: 'guest',
  source: 'host',
  partySize: 2,
  notes: 'VIP',
  createdBy: 'user-1',
  createdAt: '2026-08-30T10:00:00Z',
  updatedAt: '2026-08-30T10:00:00Z',
};

function withQuery(children: ReactNode) {
  return (
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}
    >
      {children}
    </QueryClientProvider>
  );
}

/** Section body of a guide: from the heading with `anchor` to the next peer heading. */
function guideSection(source: string, anchor: string): string {
  const lines = source.split('\n');
  const slug = headingSlugger();
  const out: string[] = [];
  let collecting = false;
  let depth = 0;
  for (const line of lines) {
    const heading = /^(#{2,4})\s+(.*)$/.exec(line);
    if (heading) {
      const headingDepth = heading[1].length;
      if (collecting && headingDepth <= depth) break;
      if (slug(heading[2]) === anchor) {
        collecting = true;
        depth = headingDepth;
      }
    }
    if (collecting) out.push(line);
  }
  return out.join('\n');
}

beforeEach(() => {
  vi.clearAllMocks();
  h.hooks.useAuth.mockReturnValue(authValue());
  h.hooks.useOwnProfile.mockReturnValue({ profile: null, isLoading: false, error: null, refetch: vi.fn() });
  h.hooks.useUpdateOwnProfile.mockReturnValue({ update: h.updateOwnProfile, isSaving: false, error: null });
  h.hooks.useSubmissionAccess.mockReturnValue({ isLoading: false, canSubmit: true, error: null });
  h.hooks.useMyOrganizers.mockReturnValue({ data: [], isLoading: false, error: null, refetch: vi.fn() });
  h.hooks.useMyOrganizerEvents.mockReturnValue({ events: [], isLoading: false, error: null, refetch: vi.fn() });
  h.hooks.useMySubmissions.mockReturnValue({ submissions: [], approvedEvents: [], isLoading: false, error: null, refetch: vi.fn() });
  h.hooks.useMyEntityMemberships.mockReturnValue({ data: [], isLoading: false, isError: false, refetch: vi.fn() });
  h.hooks.useHostEventImport.mockReturnValue(null);
  h.hooks.useActiveTaxonomyTerms.mockReturnValue({ terms: [], isLoading: false, error: null });
  h.rpc.mockImplementation(async () => ({ data: null, error: null }));
  h.attendance.attendees = [];
  h.attendance.checkIns = [];
  h.attendance.seq = 0;
});

/* ───────────────── existing content integrity checks ───────────────── */

const slugs = ['index' as const, ...GUIDES.map((g) => g.slug)];
const sources = new Map(await Promise.all(slugs.map(async (slug) => [slug, await loadGuideSource(slug)] as const)));

it.each(slugs)('%s has safe content and every guide anchor resolves', (slug) => {
  const source = sources.get(slug)!;
  const parsed = parseGuide(source);
  marked.walkTokens(parsed.tokens, (token) => {
    if (token.type !== 'link') return;
    const { href } = token as Tokens.Link;
    if (!href.startsWith('/help') && !href.startsWith('#')) return;
    const url = new URL(href, `https://www.salsasegura.com/help${slug === 'index' ? '' : `/${slug}`}`);
    const target = url.pathname === '/help' ? 'index' : url.pathname.slice('/help/'.length);
    expect(target === 'index' || !!guideBySlug(target), `${slug}: unknown guide ${href}`).toBe(true);
    if (url.hash) {
      const headings = parseGuide(sources.get(target as typeof slug)!).headings.map((x) => x.slug);
      expect(headings, `${slug}: broken anchor ${href}`).toContain(decodeURIComponent(url.hash.slice(1)));
    }
  });
  const emails = source.match(/[\w.+-]+@[\w.-]+\.[a-z]+/gi) ?? [];
  expect(emails.filter((email) => email.toLowerCase() !== 'info@salsasegura.com'), `${slug}: private email`).toEqual([]);
});

/* ───────────────────── route checks (site links) ───────────────────── */

function linkHrefs(source: string): string[] {
  const found: string[] = [];
  marked.walkTokens(parseGuide(source).tokens, (token) => {
    if (token.type !== 'link') return;
    const { href } = token as Tokens.Link;
    found.push(href);
  });
  return found;
}

// Site-rooted links after guides.ts rewrites salsasegura.com URLs to product routes.
const sitePaths = [
  ...new Set(
    slugs
      .flatMap((slug) => linkHrefs(sources.get(slug)!))
      .filter((href) => href.startsWith('/') && !href.startsWith('/help'))
      .map((href) => href.split('#')[0])
  ),
].sort();


it.each(sitePaths)('guide route %s resolves to a real screen', async (path) => {
  window.history.replaceState({}, '', path);
  render(
    <Providers>
      <App />
    </Providers>
  );
  await waitFor(() => expect(document.querySelector('.page-loading')).toBeNull());
  expect(screen.queryByRole('heading', { name: 'Page Not Found' })).not.toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Page unavailable' })).not.toBeInTheDocument();
});

/* ───────────────── UI control scenarios (uiLabels.json) ───────────────── */

type Scenario = {
  id: string;
  guide: string;
  anchor: string;
  route: string;
  state: string;
  control: { role: string; name: string };
  action?: string;
  instruction: string;
};
const scenarios = uiLabels as Scenario[];

type Locate = () => HTMLElement;
type Run = { render: () => void; drive: (locate: Locate) => Promise<void> };

/* Sign-in screen */
function renderSignIn() {
  return render(
    withQuery(
      <MemoryRouter initialEntries={[{ pathname: '/signin', state: { from: '/submit' } }]}>
        <Routes>
          <Route path="/signin" element={<SignInForm />} />
          <Route path="/submit" element={<p>Sign-in destination</p>} />
        </Routes>
      </MemoryRouter>
    )
  );
}

/* Host event import */
function importState(overrides: Record<string, unknown> = {}) {
  return {
    stage: 'idle',
    fileName: null,
    fileSize: null,
    fileErrors: [],
    rows: [],
    counts: { total: 0, valid: 0, warning: 0, invalid: 0 },
    includedDuplicates: new Set<number>(),
    toggleIncludeDuplicate: vi.fn(),
    importableCount: 0,
    excludedDuplicateCount: 0,
    importResult: null,
    importError: null,
    duplicateCheckError: null,
    handleFile: vi.fn(),
    runImport: vi.fn(),
    reset: vi.fn(),
    taxonomyLoading: false,
    ...overrides,
  };
}
function importRow(overrides: Record<string, unknown> = {}) {
  return {
    rowNumber: 2,
    raw: { title: 'Salsa Social', event_date: '2026-09-15' },
    payload: {
      title: 'Salsa Social',
      description: null,
      event_type: 'social',
      city: 'boston',
      event_date: '2026-09-16T00:00:00Z',
      event_time: '20:00',
      location: null,
      address: null,
      price_type: null,
      price_amount: null,
      rsvp_link: null,
      host: null,
      image_url: null,
      recurrence: null,
      contact_email: null,
      contact_instagram: null,
      contact_website: null,
      taxonomy_term_ids: [],
      venue_id: null,
    },
    danceStyleNames: [],
    eventAttributeNames: [],
    venueName: '',
    errors: [],
    warnings: [],
    status: 'valid',
    duplicates: [],
    ...overrides,
  };
}
const importRunImport = vi.fn();
let importHookState: unknown = null;
let importView: RenderResult | undefined;

/* Flyer import */
const extractedFlyer = (title: string) => ({
  title,
  date: '2099-07-12',
  start_time: '20:00',
  end_time: null,
  venue_name: 'Studio 5',
  address: '5 Main St',
  city: 'Boston',
  dance_styles: ['salsa'],
  event_type: 'social',
  price: null,
  organizer_name: null,
  instagram: null,
  website: null,
  details: [],
});

/* Team pages */
const teamState: { workspace: TeamWorkspaceStub | null } = { workspace: null };
// The RPC serves the full workspace object; the stub only types what the drivers mutate.
function serveTeam(workspace: EntityWorkspace & TeamWorkspaceStub) {
  teamState.workspace = workspace;
  h.rpc.mockImplementation(async (fn: string, args: MemberRpcArgs) => {
    const ws = teamState.workspace;
    if (!ws) return { data: null, error: null };
    if (fn === 'entity_workspace') return { data: ws, error: null };
    if (fn === 'entity_member_add') {
      ws.members.push({
        user_id: `user-${args.p_email}`,
        email: args.p_email,
        display_name: null,
        member_role: args.p_role,
        created_at: '2026-11-01T00:00:00Z',
      });
      return { data: null, error: null };
    }
    if (fn === 'entity_member_update') {
      if (args.p_remove) {
        ws.members = ws.members.filter((m) => m.user_id !== args.p_user_id);
      } else {
        const target = ws.members.find((m) => m.user_id === args.p_user_id);
        if (target) target.member_role = args.p_role;
      }
      return { data: null, error: null };
    }
    return { data: null, error: null };
  });
}

function renderTeam() {
  return render(
    withQuery(
      <MemoryRouter initialEntries={['/host/schools/school-1/team']}>
        <Routes>
          <Route path="/host/schools/:id/team" element={<EntityWorkspaceTeamPage kind="school" />} />
        </Routes>
      </MemoryRouter>
    )
  );
}

function renderAttendeeScreens(initialPath: string) {
  return render(
    withQuery(
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/host/events/:eventId/attendees" element={<HostAttendeeListPage />} />
          <Route path="/host/events/:eventId/attendees/:attendeeId/edit" element={<HostAttendeeEditPage />} />
          <Route path="/host/events/:eventId" element={<p>Event detail</p>} />
        </Routes>
      </MemoryRouter>
    )
  );
}

function renderCheckIn() {
  return render(
    withQuery(
      <MemoryRouter initialEntries={['/host/events/evt-1/check-in']}>
        <Routes>
          <Route path="/host/events/:eventId/check-in" element={<HostCheckInPage />} />
        </Routes>
      </MemoryRouter>
    )
  );
}

function renderProfileEdit() {
  return render(
    withQuery(
      <MemoryRouter initialEntries={['/profile/edit']}>
        <Routes>
          <Route path="/profile/edit" element={<ProfileEditPage />} />
          <Route path="/profile" element={<p>Profile page</p>} />
        </Routes>
      </MemoryRouter>
    )
  );
}

const runs: Record<string, Run> = {
  'signin-sign-in': {
    render() {
      h.hooks.useAuth.mockReturnValue(authValue());
      renderSignIn();
    },
    async drive(locate) {
      const user = userEvent.setup();
      fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'user@example.com' } });
      fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'password123' } });
      await user.click(locate());
      await waitFor(() => expect(h.auth.signInWithPassword).toHaveBeenCalledWith('user@example.com', 'password123'));
      expect(await screen.findByText('Sign-in destination')).toBeInTheDocument();
    },
  },
  'signin-forgot-password': {
    render() {
      h.hooks.useAuth.mockReturnValue(authValue());
      renderSignIn();
    },
    async drive(locate) {
      const user = userEvent.setup();
      await user.click(locate());
      await screen.findByRole('heading', { name: 'Reset your password' });
      fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'user@example.com' } });
      await user.click(screen.getByRole('button', { name: 'Send reset link' }));
      await waitFor(() => expect(h.auth.requestPasswordReset).toHaveBeenCalledWith('user@example.com'));
      expect(await screen.findByText(/If an account exists for that email/)).toBeInTheDocument();
    },
  },
  'submit-event': {
    render() {
      h.hooks.useAuth.mockReturnValue(authValue({ user: { id: 'test-user-id', email: 'test@example.com' } }));
      h.createSubmission.mockResolvedValue('submission-id');
      render(
        withQuery(
          <MemoryRouter initialEntries={['/submit']}>
            <CityProvider>
              <SubmitEventPage />
            </CityProvider>
          </MemoryRouter>
        )
      );
    },
    async drive(locate) {
      const user = userEvent.setup();
      fireEvent.change(screen.getByLabelText(/Event Title \*/i), { target: { value: 'Saturday Bachata Night' } });
      fireEvent.click(screen.getByRole('button', { name: 'Social' }));
      fireEvent.change(screen.getByLabelText(/Date \*/i), { target: { value: '2026-08-15' } });
      await user.click(locate());
      await waitFor(() => expect(h.createSubmission).toHaveBeenCalledTimes(1));
      expect(await screen.findByText(/Event Submitted!/i)).toBeInTheDocument();
    },
  },
  'claim-relationship': {
    render() {
      render(
        withQuery(
          <MemoryRouter>
            <EntityClaimDialog
              kind="school"
              entity={{ id: 'school-1', name: 'Salsa Academy', slug: 'salsa-academy' }}
              isOpen
              onClose={() => {}}
            />
          </MemoryRouter>
        )
      );
    },
    async drive(locate) {
      const user = userEvent.setup();
      const radio = locate();
      expect(radio).not.toBeChecked();
      await user.click(radio);
      expect(radio).toBeChecked();
    },
  },
  'claim-submit': {
    render() {
      h.rpc.mockImplementation(async (fn: string) =>
        fn === 'entity_claim_submit' ? { data: 'claim-1', error: null } : { data: null, error: null }
      );
      render(
        withQuery(
          <MemoryRouter>
            <EntityClaimDialog
              kind="school"
              entity={{ id: 'school-1', name: 'Salsa Academy', slug: 'salsa-academy' }}
              isOpen
              onClose={() => {}}
            />
          </MemoryRouter>
        )
      );
    },
    async drive(locate) {
      const user = userEvent.setup();
      await user.click(screen.getByRole('radio', { name: 'I own it' }));
      fireEvent.change(screen.getByLabelText('Message (optional)'), {
        target: { value: 'I manage the school with Ana.' },
      });
      await user.click(locate());
      expect(await screen.findByRole('heading', { name: 'Claim submitted' })).toBeInTheDocument();
      expect(screen.getByText('Your claim is waiting for review.')).toBeInTheDocument();
      expect(h.rpc).toHaveBeenCalledWith('entity_claim_submit', expect.objectContaining({ p_relationship: 'owner' }));
    },
  },
  'request-listing-send': {
    render() {
      const mine: unknown[] = [];
      h.rpc.mockImplementation(async (fn: string, args: { p_name: string }) => {
        if (fn === 'public_entity_directory') return { data: [], error: null };
        if (fn === 'listing_request_submit_missing') {
          mine.unshift(listingRequest({ id: 'r-new', proposed_name: args.p_name }));
          return { data: 'r-new', error: null };
        }
        if (fn === 'my_listing_requests') return { data: [...mine], error: null };
        return { data: null, error: null };
      });
      render(withQuery(<MemoryRouter initialEntries={['/request-listing']}><RequestListingPage /></MemoryRouter>));
    },
    async drive(locate) {
      const user = userEvent.setup();
      await user.selectOptions(screen.getByLabelText('Type of listing'), 'venue');
      await user.type(screen.getByLabelText('Name'), 'Casa Habana');
      await user.type(screen.getByLabelText('City'), 'Boston');
      await user.click(screen.getByLabelText('I searched and this listing is not here'));
      await user.click(locate());
      expect(await screen.findByRole('listitem', { name: 'Add "Casa Habana" as a Venue' })).toBeInTheDocument();
    },
  },
  'host-desk-create-event': {
    render() {
      h.hooks.useAuth.mockReturnValue(authValue({ user: { id: 'user-1' }, role: 'organizer', isOrganizer: true }));
      h.hooks.useMyOrganizers.mockReturnValue({ data: [organizerMembership], isLoading: false, error: null, refetch: vi.fn() });
      render(
        <MemoryRouter initialEntries={['/host']}>
          <Routes>
            <Route path="/host" element={<HostDashboard />} />
            <Route path="/host/events/new" element={<p>Create event page</p>} />
          </Routes>
        </MemoryRouter>
      );
    },
    async drive(locate) {
      const user = userEvent.setup();
      const link = locate();
      expect(link).toHaveAttribute('href', '/host/events/new');
      await user.click(link);
      expect(await screen.findByText('Create event page')).toBeInTheDocument();
    },
  },
  'import-csv-template': {
    render() {
      h.hooks.useHostEventImport.mockReturnValue(importState());
      h.hooks.useMyOrganizers.mockReturnValue({ data: [organizerMembership], isLoading: false, error: null, refetch: vi.fn() });
      render(<MemoryRouter><HostEventImportPage /></MemoryRouter>);
    },
    async drive(locate) {
      const user = userEvent.setup();
      const createElementSpy = vi.spyOn(document, 'createElement');
      globalThis.URL.createObjectURL = vi.fn().mockImplementation(() => 'blob:mock');
      globalThis.URL.revokeObjectURL = vi.fn();
      await user.click(locate());
      const anchor = createElementSpy.mock.results
        .map((r) => r.value as HTMLElement)
        .find((el): el is HTMLAnchorElement => el instanceof HTMLAnchorElement && el.download !== '');
      expect(anchor?.download).toBe('salsasegura-host-import-template.csv');
      createElementSpy.mockRestore();
    },
  },
  'import-valid-events': {
    render() {
      importRunImport.mockClear();
      importHookState = importState({
        stage: 'reviewing',
        fileName: 'events.csv',
        fileSize: 32,
        rows: [importRow()],
        counts: { total: 1, valid: 1, warning: 0, invalid: 0 },
        importableCount: 1,
        runImport: importRunImport,
      });
      h.hooks.useHostEventImport.mockImplementation(() => importHookState);
      h.hooks.useMyOrganizers.mockReturnValue({ data: [organizerMembership], isLoading: false, error: null, refetch: vi.fn() });
      importView = render(<MemoryRouter><HostEventImportPage /></MemoryRouter>);
    },
    async drive(locate) {
      const user = userEvent.setup();
      await user.click(locate());
      expect(importRunImport).toHaveBeenCalledWith('org-1');
      // The hook settles into its result state; rerender with it as the page tests do.
      importHookState = importState({
        stage: 'done',
        importResult: { totalRows: 1, createdCount: 1, failedCount: 0, rows: [] },
      });
      importView!.rerender(<MemoryRouter><HostEventImportPage /></MemoryRouter>);
      expect(await screen.findByRole('heading', { name: 'Import Complete' })).toBeInTheDocument();
    },
  },
  'flyer-confirm-details': {
    render() {
      h.hooks.useAuth.mockReturnValue(authValue({ user: { id: 'user-1', email: 'owner@example.com' }, isAdmin: true }));
      h.hooks.useMyOrganizers.mockReturnValue({
        data: [{ organizerId: 'org-1', organizerName: 'Dance Club', organizerStatus: 'active', memberRole: 'owner' }],
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });
      h.hooks.useActiveTaxonomyTerms.mockImplementation((category: string) => ({
        terms:
          category === 'dance_style'
            ? [{ id: 'salsa-id', name: 'Salsa', slug: 'salsa', category: 'dance_style', status: 'active' }]
            : [],
        isLoading: false,
        error: null,
      }));
      h.uploadEventFlyer.mockImplementation(async ({ file, eventId }: { file: File; eventId: string }) => ({
        url: `https://example.com/${file.name}`,
        path: `user-1/${eventId}/${file.name}`,
      }));
      h.extractEventFromFlyer.mockImplementation(async (url: string) =>
        extractedFlyer(url.includes('first') ? 'First social' : 'Second social')
      );
      render(
        withQuery(
          <MemoryRouter>
            <CityProvider>
              <BulkFlyerImportPage mode="host" />
            </CityProvider>
          </MemoryRouter>
        )
      );
    },
    async drive(locate) {
      const user = userEvent.setup();
      await user.upload(screen.getByLabelText('Flyer images'), [
        new File(['one'], 'first.png', { type: 'image/png' }),
      ]);
      await waitFor(() => expect(screen.getByLabelText('Flyer images')).toBeEnabled());
      if (!screen.queryByRole('button', { name: 'Confirm details against flyer' })) {
        await user.click(await screen.findByRole('button', { name: /^first\.png: / }));
      }
      await user.click(locate());
      const saveBar = screen.getByRole('region', { name: 'Save confirmed flyers' });
      expect(within(saveBar).getByRole('button', { name: 'Publish 1 event' })).toBeDisabled();
      for (const checkbox of within(screen.getByRole('group', { name: 'Before you publish' })).getAllByRole('checkbox')) await user.click(checkbox);
      expect(await within(saveBar).findByRole('button', { name: 'Publish 1 event' })).toBeEnabled();
    },
  },
  'attendee-add': {
    render() {
      h.attendance.attendees = [structuredClone(ana)];
      renderAttendeeScreens('/host/events/evt-1/attendees');
    },
    async drive(locate) {
      const user = userEvent.setup();
      await user.type(screen.getByLabelText('Name *'), 'Nina Diaz');
      await user.click(locate());
      expect(await screen.findByText('Nina Diaz')).toBeInTheDocument();
      expect(h.attendanceRepo.addEventAttendee).toHaveBeenCalledWith(
        'evt-1',
        expect.objectContaining({ displayName: 'Nina Diaz' })
      );
    },
  },
  'attendee-edit': {
    render() {
      h.attendance.attendees = [structuredClone(ana)];
      renderAttendeeScreens('/host/events/evt-1/attendees');
    },
    async drive(locate) {
      await screen.findByText('Ana Garcia');
      await userEvent.setup().click(locate());
      expect(await screen.findByLabelText('Name *')).toHaveValue('Ana Garcia');
    },
  },
  'attendee-save-changes': {
    render() {
      h.attendance.attendees = [structuredClone(ana)];
      renderAttendeeScreens('/host/events/evt-1/attendees/att-1/edit');
    },
    async drive(locate) {
      const user = userEvent.setup();
      const name = await screen.findByLabelText('Name *');
      await user.clear(name);
      await user.type(name, 'Ana G.');
      await user.click(locate());
      // Saving returns to the roster with the same attendee record updated.
      expect(await screen.findByText('Ana G.')).toBeInTheDocument();
      expect(h.attendanceRepo.updateEventAttendee).toHaveBeenCalledWith(
        'evt-1',
        'att-1',
        expect.objectContaining({ displayName: 'Ana G.' })
      );
    },
  },
  'checkin-check-in': {
    render() {
      h.attendance.attendees = [structuredClone(ana)];
      renderCheckIn();
    },
    async drive(locate) {
      await screen.findByRole('button', { name: 'Check in Ana Garcia' });
      await userEvent.setup().click(locate());
      expect(await screen.findByRole('button', { name: 'Undo check-in for Ana Garcia' })).toBeInTheDocument();
      expect(screen.getAllByText('Checked in').length).toBeGreaterThan(0);
      expect(screen.getByText(/1 of 1 roster entry checked in/)).toBeInTheDocument();
    },
  },
  'checkin-undo': {
    render() {
      h.attendance.attendees = [structuredClone(ana)];
      h.attendance.checkIns = [
        {
          id: 'ci-1',
          attendeeId: 'att-1',
          eventId: 'evt-1',
          checkedInAt: '2026-11-09T20:00:00.000Z',
          checkedInBy: 'user-1',
          method: 'manual',
          reversedAt: null,
          reversedBy: null,
          reversalReason: null,
          createdAt: '2026-11-09T20:00:00.000Z',
        },
      ];
      renderCheckIn();
    },
    async drive(locate) {
      await screen.findByRole('button', { name: 'Undo check-in for Ana Garcia' });
      await userEvent.setup().click(locate());
      expect(await screen.findByRole('button', { name: 'Check in Ana Garcia' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /recent reversals/i })).toBeInTheDocument();
    },
  },
  'organization-save-changes': {
    render() {
      h.hooks.useMyOrganizers.mockReturnValue({ data: [organizerMembership], isLoading: false });
      h.fetchOrganizerProfile.mockResolvedValue(organizerMembership);
      h.updateOrganizerProfile.mockResolvedValue(undefined);
      render(<MemoryRouter><HostOrganizationPage /></MemoryRouter>);
    },
    async drive(locate) {
      const user = userEvent.setup();
      await user.click(await screen.findByRole('button', { name: 'Edit Organization' }));
      const name = screen.getByLabelText('Organization name');
      await user.clear(name);
      await user.type(name, 'Boston Salsa Social');
      await user.click(locate());
      expect(await screen.findByText('Organization updated.')).toBeInTheDocument();
      expect(h.updateOrganizerProfile).toHaveBeenCalledWith(
        'org-1',
        expect.objectContaining({ name: 'Boston Salsa Social' })
      );
    },
  },
  'profile-notification-toggle': {
    render() {
      h.hooks.useAuth.mockReturnValue(authValue({ user: { id: 'user-1', email: 'maria@example.com' } }));
      h.hooks.useOwnProfile.mockReturnValue({ profile: baseProfile(), isLoading: false, error: null, refetch: vi.fn() });
      renderProfileEdit();
    },
    async drive(locate) {
      const user = userEvent.setup();
      await screen.findByLabelText(/display name/i);
      const toggle = locate();
      expect(toggle).toHaveAttribute('aria-checked', 'false');
      await user.click(toggle);
      expect(toggle).toHaveAttribute('aria-checked', 'true');
    },
  },
  'profile-save-changes': {
    render() {
      h.hooks.useAuth.mockReturnValue(authValue({ user: { id: 'user-1', email: 'maria@example.com' } }));
      h.hooks.useOwnProfile.mockReturnValue({ profile: baseProfile(), isLoading: false, error: null, refetch: vi.fn() });
      h.hooks.useUpdateOwnProfile.mockReturnValue({ update: h.updateOwnProfile, isSaving: false, error: null });
      renderProfileEdit();
    },
    async drive(locate) {
      const user = userEvent.setup();
      const displayName = await screen.findByLabelText(/display name/i);
      fireEvent.change(displayName, { target: { value: 'Maria S.' } });
      await user.click(locate());
      expect(await screen.findByText('Saved. Your profile is up to date.')).toBeInTheDocument();
      expect(h.updateOwnProfile).toHaveBeenCalled();
    },
  },
  'team-add': {
    render() {
      serveTeam(schoolWorkspace());
      renderTeam();
    },
    async drive(locate) {
      const user = userEvent.setup();
      const form = await screen.findByRole('form', { name: 'Add team member' });
      await user.type(within(form).getByLabelText('Email'), 'newperson@example.com');
      await user.selectOptions(within(form).getByLabelText('Role'), 'Editor');
      await user.click(locate());
      expect(await within(form).findByText(/newperson@example.com is now editor of this listing\./)).toBeInTheDocument();
      const list = await screen.findByRole('list', { name: 'Team members' });
      expect(await within(list).findByText('newperson@example.com')).toBeInTheDocument();
    },
  },
  'team-remove': {
    render() {
      serveTeam(schoolWorkspace({ members: [member('owner'), member('manager')] }));
      renderTeam();
    },
    async drive(locate) {
      const user = userEvent.setup();
      await user.click(await screen.findByRole('button', { name: 'Remove manager@example.com' }));
      await user.click(locate());
      await waitFor(() =>
        expect(h.rpc).toHaveBeenCalledWith(
          'entity_member_update',
          expect.objectContaining({ p_user_id: 'user-manager', p_remove: true })
        )
      );
      const list = await screen.findByRole('list', { name: 'Team members' });
      expect(within(list).queryByText('manager@example.com')).not.toBeInTheDocument();
      expect(within(list).getByText('owner@example.com')).toBeInTheDocument();
    },
  },
};

describe('documented UI controls match the rendered screens', () => {
  it.each(scenarios.map((s) => [s.id, s] as const))('%s', async (_id, scenario) => {
    // (b) The guide section must still document the instruction label.
    const source = sources.get(scenario.guide as GuideSlug | 'index')!;
    const section = guideSection(source, scenario.anchor);
    expect(
      section,
      `${scenario.id}: ${scenario.guide} #${scenario.anchor} no longer documents "${scenario.instruction}"`
    ).toContain(scenario.instruction);

    // (a) The actual screen must offer the documented control and action.
    const run = runs[scenario.id];
    expect(run, `${scenario.id}: no scenario harness`).toBeDefined();
    run.render();
    const locate: Locate = () => {
      const control = screen.queryByRole(scenario.control.role, { name: scenario.control.name });
      expect(
        control,
        `${scenario.id}: control ${scenario.control.role} "${scenario.control.name}" not found`
      ).not.toBeNull();
      return control as HTMLElement;
    };
    await run.drive(locate);
  });
});
