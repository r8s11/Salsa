# SalsaSegura.com - Phased Learning & Launch Plan

## Solo Developer Learning Project with Live Deployments

**Your Context:** Week 1-2 of Full-Stack Learning Journey
**Current Site:** React single-page app on Azure with markdown events
**Goal:** Learn while building, deploy after each phase
**Timeline:** 8-12 weeks (aligned with your learning schedule)

---

## Philosophy: Learn → Build → Deploy → Repeat

Each phase teaches new concepts AND produces a working feature you can deploy immediately. No waiting until "it's done" - ship improvements weekly.

---

## 🚀 PHASE 0: Current State (Already Done! ✅)

**What You Have:**

- React app deployed to Azure ✅
- Markdown-based events ✅
- Event cards displaying ✅
- Basic styling ✅

**Skills Demonstrated:**

- React basics
- Azure deployment
- Git version control

**Live URL:** www.salsasegura.com ✅

---

## 📅 PHASE 1: Calendar View (Week 1-2 of Learning)

**Status:** 🔄 In Progress (January 11, 2026)
**Implementation Guide:** [calendar-implementation-guide.md](calendar-implementation-guide.md)

### Learning Goals

- Schedule-X calendar library (mobile-first)
- Temporal API for date handling
- Component composition
- Props and state management

### What You'll Build

Transform your current list view into an interactive calendar that displays your existing markdown events.

### Features

- 🔄 Month grid/week/day/month agenda view toggle
- 🔄 Click event to see details (custom modal)
- 🔄 Color-coded events by type (social/class/workshop)
- 🔄 Mobile-first responsive calendar
- ✅ Date navigation (prev/next month)
- 📅 Your markdown events displayed on calendar (Phase 3 integration)

### Tech Stack

- Schedule-X (`@schedule-x/react`, `@schedule-x/calendar`)
- Temporal API via `temporal-polyfill`
- `@schedule-x/events-service` for event management
- `@schedule-x/theme-default` for styling

### Time Estimate: 8-12 hours

- Day 1-2: Install library, basic calendar (4 hours) - 🔄 In Progress
- Day 3-4: Transform markdown events to calendar format (3 hours) - 📅 Planned for Phase 3
- Day 5: Styling and mobile responsiveness (2 hours) - 🔄 In Progress
- Day 6: Testing and deployment (2 hours)

### Deployment

```bash
bun run build
# Deploy to Azure (same process as current)
```

### Success Criteria

- 🔄 Calendar displays events (test events for now)
- ✅ Can navigate months
- 🔄 Mobile works well (mobile-first design)
- 📅 Deployed and live

### Architecture Decisions Made

- **Library:** Schedule-X (mobile-first, Temporal API, built-in dark mode)
- **Color coding:** Social (orange #ff8c42), Class (blue #3498db), Workshop (green #27ae60)
- **Mobile strategy:** Schedule-X is mobile-first by design, auto-responsive
- **Event modal:** Custom modal component for event details with RSVP button
- **Future:** Event detail pages at `/events/:id` for shareable links (Week 11)
- **Database-ready:** Types designed for easy Supabase integration (Phase 3)
- **Recurring events:** Schedule-X has native recurrence plugin for future use

**Skills Gained:** React libraries, Temporal API, calendar UIs, mobile-first design

---

## 🗂️ PHASE 2: Multi-Page Navigation (Week 3 of Learning)

### Learning Goals

- React Router
- Client-side routing
- Component organization
- Navigation patterns

### What You'll Build

Convert single-page app to multi-page with proper navigation.

### Features

- ✅ Header with navigation
- ✅ Calendar page (home)
- ✅ About page (who you are, your mission)
- ✅ Contact page (existing, just moved to route)
- ✅ Smooth transitions
- ✅ Active link highlighting

### Tech Stack

- React Router DOM
- Your existing components (reorganized)

### Time Estimate: 6-8 hours

- Day 1: Install React Router, setup routes (2 hours)
- Day 2: Create About page content (2 hours)
- Day 3: Create Header/Nav component (2 hours)
- Day 4: Testing, styling, deploy (2 hours)

### New File Structure

```
src/
  ├── App.jsx              ← Add Router
  ├── pages/
  │   ├── CalendarPage.jsx ← Your calendar
  │   ├── AboutPage.jsx    ← NEW
  │   └── ContactPage.jsx  ← Existing
  └── components/
      ├── Header.jsx       ← NEW
      └── calendar/
          └── Calendar.jsx
```

### Success Criteria

- ✅ 3 pages working
- ✅ Clean URLs (/calendar, /about, /contact)
- ✅ Navigation works
- ✅ Deployed and live

**Skills Gained:** Routing, multi-page apps, navigation UX

---

## 🗄️ PHASE 3: Database Backend (Week 4-5 of Learning)

### Learning Goals

- Backend APIs
- Database basics (Supabase)
- API integration
- Environment variables
- Async JavaScript (fetch, promises)

### What You'll Build

Add ability to store events in database alongside your markdown files.

### Features

- ✅ Supabase PostgreSQL database
- ✅ Events table created
- ✅ Fetch events from database
- ✅ Display database + markdown events on calendar
- ✅ Visual distinction (your events vs future community events)

### Tech Stack

- Supabase (backend as a service)
- @supabase/supabase-js
- PostgreSQL database

### Time Estimate: 10-12 hours

- Day 1: Create Supabase account, set up project (2 hours)
- Day 2: Create database schema, add test data (2 hours)
- Day 3: Connect React to Supabase (3 hours)
- Day 4: Combine markdown + DB events (2 hours)
- Day 5: Add "Salsa Segura" badges to your events (2 hours)
- Day 6: Deploy with environment variables (1 hour)

### Database Schema (Start Simple)

```sql
create table events (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  description text,
  event_type text check (event_type in ('social', 'workshop', 'class')),
  event_date timestamp not null,
  event_time text,
  location text,
  address text,
  price_type text check (price_type in ('free', 'paid')),
  price_amount numeric,
  rsvp_link text,
  image_url text,
  status text default 'approved',
  created_at timestamp default now()
);
```

### New Component

```javascript
// hooks/useEvents.js
export function useEvents() {
  const markdownEvents = useMarkdownEvents(); // existing
  const [dbEvents, setDbEvents] = useState([]);

  useEffect(() => {
    // Fetch from Supabase
    fetchEvents().then(setDbEvents);
  }, []);

  return {
    allEvents: [...markdownEvents, ...dbEvents],
    loading,
  };
}
```

### Success Criteria

- ✅ Database connected
- ✅ Can fetch events from DB
- ✅ Calendar shows both sources
- ✅ "Salsa Segura Event" badge on your events
- ✅ Deployed and live

**Skills Gained:** Backend integration, databases, APIs, async programming

---

## 📝 PHASE 4: Event Submission Form (Week 6-7 of Learning)

### Learning Goals

- Forms in React
- Form validation
- Controlled components
- React Hook Form library
- POST requests to database

### What You'll Build

Public form where people can submit events (they'll just be saved to DB for now, no moderation yet).

### Features

- ✅ Multi-step form (3-4 steps)
- ✅ Form validation
- ✅ Image upload to Supabase Storage
- ✅ Submit to database
- ✅ Success/error messages
- ✅ Preview before submit

### Tech Stack

- React Hook Form
- Supabase Storage (for images)
- Your existing database

### Time Estimate: 12-15 hours

- Day 1-2: Build basic form structure (4 hours)
- Day 3: Add validation (3 hours)
- Day 4: Image upload (3 hours)
- Day 5: Submit to Supabase (2 hours)
- Day 6: Preview step, styling (2 hours)
- Day 7: Testing and deploy (1 hour)

### Form Steps

1. **Basic Info**: Title, type, date, time
2. **Location**: Venue, address (Google Maps autocomplete later)
3. **Details**: Description, dance styles, skill level
4. **Image & Links**: Upload image, RSVP link

### Success Criteria

- ✅ Form accessible at /submit
- ✅ Can submit events
- ✅ Events saved to database (status: 'pending')
- ✅ Success message after submission
- ✅ Deployed and live

**Note:** At this phase, submitted events WON'T show on calendar yet (need approval). That's Phase 5.

**Skills Gained:** Forms, validation, file uploads, UX design

---

## 🔐 PHASE 5: Authentication (Week 8 of Learning)

### Learning Goals

- User authentication
- Protected routes
- Login/signup flows
- Session management
- Role-based access

### What You'll Build

Login system so hosts can manage their events and you can moderate.

### Features

- ✅ Sign up page
- ✅ Login page
- ✅ Logout
- ✅ Protected routes
- ✅ User profile page (basic)
- ✅ "My Events" dashboard for hosts

### Tech Stack

- Supabase Auth
- React Context for auth state
- Protected route components

### Time Estimate: 10-12 hours

- Day 1-2: Set up Supabase Auth (3 hours)
- Day 3: Build login/signup pages (3 hours)
- Day 4: Create auth context (2 hours)
- Day 5: Protected routes (2 hours)
- Day 6: My Events dashboard (2 hours)

### New Features

- Login button in header
- "My Events" page shows user's submissions
- Edit own events (triggers re-approval)
- Delete own events

### Success Criteria

- ✅ Can sign up and log in
- ✅ Session persists
- ✅ Can view own submitted events
- ✅ Deployed and live

**Skills Gained:** Authentication, sessions, protected routes, user management

---

## 👮 PHASE 6: Moderation Dashboard (Week 9 of Learning)

### Learning Goals

- Role-based access control
- Admin interfaces
- CRUD operations
- Email notifications
- Workflow management

### What You'll Build

Dashboard where YOU (as moderator) can approve/reject submitted events.

### Features

- ✅ Moderator-only dashboard at /moderate
- ✅ List of pending events
- ✅ Approve button → event appears on public calendar
- ✅ Reject button with reason
- ✅ Edit event before approving
- ✅ Email notifications to submitters

### Tech Stack

- Supabase Row Level Security (RLS)
- SendGrid (email) or Supabase Edge Functions
- Your existing database

### Time Estimate: 12-15 hours

- Day 1: Set up roles in database (2 hours)
- Day 2-3: Build moderation UI (5 hours)
- Day 4: Approve/reject logic (3 hours)
- Day 5: Email notifications (3 hours)
- Day 6: Testing and deploy (2 hours)

### Database Updates

```sql
-- Add roles to users
alter table users add column role text default 'host';

-- Add moderation fields to events
alter table events
  add column approved_by uuid references users(id),
  add column approved_at timestamp,
  add column rejection_reason text;
```

### Success Criteria

- ✅ Moderator dashboard accessible
- ✅ Can approve events → they appear on calendar
- ✅ Can reject events → submitter notified
- ✅ Can edit before approving
- ✅ Deployed and live

**Skills Gained:** Admin interfaces, workflows, permissions, email integration

---

## 🔍 PHASE 7: Filters & Search (Week 10 of Learning)

### Learning Goals

- State management (filters)
- Query parameters
- Search algorithms
- Performance optimization
- Debouncing

### What You'll Build

Filter bar so users can find specific events easily.

### Features

- ✅ Filter by date range
- ✅ Filter by event type
- ✅ Filter by dance style
- ✅ Filter free/paid
- ✅ Search by keyword
- ✅ URL reflects filters (shareable)

### Tech Stack

- React state management
- URL search params
- Debouncing (lodash or custom)

### Time Estimate: 8-10 hours

- Day 1-2: Build filter UI (4 hours)
- Day 3: Implement filter logic (3 hours)
- Day 4: Search functionality (2 hours)
- Day 5: URL sync, deploy (1 hour)

### Success Criteria

- ✅ Filter bar at top of calendar
- ✅ Filters work instantly
- ✅ Search filters events
- ✅ Can share filtered URL
- ✅ Deployed and live

**Skills Gained:** State management, search, URL manipulation, UX

---

## 🗺️ PHASE 8: Map View (Week 11 of Learning)

### Learning Goals

- Map APIs (Google Maps / Mapbox)
- Geolocation
- Markers and clustering
- API key management
- Third-party integrations

### What You'll Build

Interactive map showing event locations with markers.

### Features

- ✅ Map view toggle (calendar ↔️ map)
- ✅ Event markers on map
- ✅ Click marker → event details
- ✅ Filter sync with map
- ✅ Cluster nearby events
- ✅ User location (optional)

### Tech Stack

- Google Maps API or Mapbox
- react-map-gl or @react-google-maps/api
- Geocoding for addresses

### Time Estimate: 10-12 hours

- Day 1: Set up map API account (1 hour)
- Day 2-3: Integrate map library (5 hours)
- Day 4: Add markers for events (3 hours)
- Day 5: Clustering and interaction (2 hours)
- Day 6: Deploy with API key (1 hour)

### Success Criteria

- ✅ Toggle between calendar and map
- ✅ Events shown as markers
- ✅ Click marker shows event
- ✅ Deployed and live

**Skills Gained:** Map APIs, geolocation, markers, third-party services

---

## 🔄 PHASE 9: Recurring Events (Week 12 of Learning)

### Learning Goals

- Complex data models
- Date calculations
- Recurrence patterns
- Instance generation
- Advanced forms

### What You'll Build

Support for recurring events (e.g., "Every Tuesday salsa class").

### Features

- ✅ "Recurring event" checkbox in form
- ✅ Frequency selector (weekly, monthly)
- ✅ Days of week selector
- ✅ End date or "ongoing"
- ✅ Generate instances on calendar
- ✅ Edit series vs single instance

### Time Estimate: 10-12 hours

- Day 1: Database schema for recurrence (2 hours)
- Day 2-3: Form updates (4 hours)
- Day 4: Instance generation logic (3 hours)
- Day 5: Edit/cancel logic (2 hours)
- Day 6: Deploy (1 hour)

### Success Criteria

- ✅ Can create recurring events
- ✅ Instances appear on calendar
- ✅ Can edit series
- ✅ Can cancel specific dates
- ✅ Deployed and live

**Skills Gained:** Complex data models, recurrence logic, date math

---

## ✨ PHASE 10: Polish & Features (Week 13-14)

### Learning Goals

- User experience refinement
- Performance optimization
- Analytics integration
- SEO basics
- Production readiness

### What You'll Build

Final touches to make site production-ready and delightful.

### Features

- ✅ Save favorite events (logged-in users)
- ✅ RSVP functionality
- ✅ Share to social media
- ✅ Add to personal calendar
- ✅ Loading states everywhere
- ✅ Error boundaries
- ✅ Google Analytics
- ✅ SEO optimization
- ✅ Performance optimization
- ✅ Accessibility audit

### Time Estimate: 15-20 hours

- Favorites/RSVP (4 hours)
- Social sharing (2 hours)
- Loading/error states (3 hours)
- Analytics (2 hours)
- SEO (3 hours)
- Performance (3 hours)
- Accessibility (2 hours)

### Success Criteria

- ✅ Site feels fast and smooth
- ✅ No obvious bugs
- ✅ Good Google Lighthouse scores
- ✅ Analytics tracking
- ✅ Professional appearance

**Skills Gained:** Polish, UX, analytics, SEO, performance

---

## 📊 Deployment After Each Phase

### Deployment Checklist (Every Phase)

```bash
# 1. Test locally
npm run dev

# 2. Build
npm run build

# 3. Test build
npm run preview

# 4. Deploy to Azure
# (your existing process)

# 5. Update environment variables if needed
# Azure Portal → Web App → Configuration

# 6. Verify live site
# Visit www.salsasegura.com

# 7. Git commit and push
git add .
git commit -m "Phase X: [Feature] complete"
git push
```

### Version Tags

```bash
# Tag each phase
git tag -a v0.1 -m "Phase 1: Calendar view"
git tag -a v0.2 -m "Phase 2: Multi-page navigation"
git push --tags
```

---

## 📈 Learning Progress Tracker

### Week-by-Week Alignment

| Week  | Your Learning Plan | SalsaSegura Phase | Deployed Feature    |
| ----- | ------------------ | ----------------- | ------------------- |
| 1-2   | React + SQL basics | Phase 1           | Calendar view ✅    |
| 3     | React Router       | Phase 2           | Multi-page nav ✅   |
| 4-5   | FastAPI + Database | Phase 3           | Database backend ✅ |
| 6-7   | Forms + Validation | Phase 4           | Submission form ✅  |
| 8     | Authentication     | Phase 5           | Login system ✅     |
| 9     | Advanced CRUD      | Phase 6           | Moderation ✅       |
| 10    | State Management   | Phase 7           | Filters/Search ✅   |
| 11    | API Integration    | Phase 8           | Map view ✅         |
| 12    | Complex Features   | Phase 9           | Recurring events ✅ |
| 13-14 | Polish + DevOps    | Phase 10          | Production ready ✅ |

---

## 🎯 Minimum Viable Product (MVP)

**If you need to launch FAST, stop after Phase 6.**

### MVP = Phases 1-6 (8 weeks)

- ✅ Calendar view of events
- ✅ Multi-page site
- ✅ Database backend
- ✅ Community submissions
- ✅ Login for hosts
- ✅ Moderation dashboard

This is **fully functional** and you can start accepting community events!

### Nice-to-Have = Phases 7-10 (4-6 weeks)

- Filters and search
- Map view
- Recurring events
- Polish features

---

## 💡 Learning Resources Per Phase

### Phase 1 (Calendar)

- React Big Calendar docs
- FreeCodeCamp: "React Calendar Tutorial"
- date-fns documentation

### Phase 2 (Routing)

- React Router official tutorial
- "React Router in Depth" (YouTube)

### Phase 3 (Database)

- Supabase Quick Start
- "PostgreSQL Tutorial" (tutorialspoint)
- Your SQL learning plan

### Phase 4 (Forms)

- React Hook Form docs
- "Mastering Forms in React" (LogRocket)

### Phase 5 (Auth)

- Supabase Auth tutorial
- "React Authentication Simplified" (freeCodeCamp)

### Phase 6 (Moderation)

- "Building Admin Dashboards" (YouTube)
- Supabase Row Level Security docs

### Phases 7-10

- Aligned with your advanced learning weeks

---

## 🚦 Decision Points

### After Phase 3 (Database)

**Ask yourself:**

- Am I comfortable with React?
- Do I understand databases?
- Ready for forms and auth?

**If No:** Pause and solidify. Build a simple CRUD app.
**If Yes:** Continue to Phase 4.

### After Phase 6 (Moderation)

**Ask yourself:**

- Do I have a working product?
- Should I launch MVP now?
- Do I need more features first?

**Option A:** Launch MVP, gather feedback, iterate
**Option B:** Continue to Phase 7+ for more features

### After Phase 10 (Polish)

**Time to:**

- Launch publicly
- Market to Boston dance community
- Gather real users
- Start building community content

---

## 📝 Phase Completion Checklist

### Every Phase Must Have:

- [ ] Feature works locally
- [ ] Code committed to Git
- [ ] Deployed to Azure
- [ ] Tested on mobile
- [ ] README updated with new feature
- [ ] Tagged in Git (v0.X)
- [ ] Screenshot/demo recorded
- [ ] Added to portfolio documentation

---

## 🎓 Skills Progression

### After Phase 3: Junior Developer Level

- React fundamentals
- Database basics
- API integration
- Azure deployment

### After Phase 6: Mid-Level Developer

- Full-stack CRUD app
- Authentication
- User management
- Admin interfaces

### After Phase 10: Senior Developer Ready

- Complex features
- Production polish
- Performance optimization
- Complete product ownership

---

## 🔥 Quick Start: Phase 1 This Week

### Day 1 (2-3 hours)

```bash
# Install calendar library
npm install react-big-calendar date-fns

# Create Calendar component
mkdir src/components/calendar
touch src/components/calendar/Calendar.jsx
```

### Day 2 (2-3 hours)

- Implement basic calendar
- Display static events
- Test in browser

### Day 3 (2-3 hours)

- Transform markdown events to calendar format
- Display your actual events
- Add styling

### Day 4 (2 hours)

- Mobile responsiveness
- Deploy to Azure
- ✅ Phase 1 complete!

**Next Week:** Phase 2 (Navigation)

---

## 📞 Support & Questions

As you build each phase, refer back to:

- [Full project plan](salsasegura_project_plan.md)
- Your 14-week learning curriculum
- React docs
- Supabase docs
- Stack Overflow

**Remember:** Each phase is a complete, deployable feature. Ship it!

---

**Start Phase 1 today. Deploy by end of week. 🚀**

_Last Updated: January 2025_
_Your Current Phase: [Update as you progress]_
_Next Deployment: [Target date]_
