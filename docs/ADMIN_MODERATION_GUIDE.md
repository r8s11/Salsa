# Admin Event Moderation Dashboard — Implementation Guide

> **Learning Notes & Step-by-Step Implementation**
> For the Salsa Community Events Platform (SalsaSegura.com)
> Phase: Week 5-6 of 52-Week Plan

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture & Data Flow](#architecture--data-flow)
3. [Step 1: Supabase Auth Setup](#step-1-supabase-auth-setup)
4. [Step 2: Database — RLS Policies for Admin](#step-2-database--rls-policies-for-admin)
5. [Step 3: Auth Context & Hook](#step-3-auth-context--hook)
6. [Step 4: Protected Route Component](#step-4-protected-route-component)
7. [Step 5: Admin Login Page](#step-5-admin-login-page)
8. [Step 6: usePendingEvents Hook](#step-6-usependingevents-hook)
9. [Step 7: Admin Dashboard Page](#step-7-admin-dashboard-page)
10. [Step 8: Styling the Dashboard](#step-8-styling-the-dashboard)
11. [Step 9: Add Routes to App.tsx](#step-9-add-routes-to-apptsx)
12. [Step 10: Testing Your Implementation](#step-10-testing-your-implementation)
13. [Troubleshooting](#troubleshooting)
14. [Future Enhancements](#future-enhancements)

---

## Overview

### What We're Building

An admin moderation dashboard that lets you (the site admin) review, approve, and reject
community-submitted events. Only authenticated admins can access it.

```
User submits event (/submit)
        │
        ▼
  status = "pending"  ──→  stored in Supabase
        │
        ▼
  Admin logs in (/admin/login)
        │
        ▼
  Admin sees pending events (/admin)
        │
        ├── ✅ Approve  →  status = "approved"  →  appears on calendar
        └── ❌ Reject   →  status = "rejected"  →  hidden from public
```

### Why This Matters

Right now, your `SubmitEventPage` sets `status: "pending"`, but your `useSupabaseEvents` hook only
fetches events with `status: 'approved'`. That means submitted events are invisible until someone
manually updates them in the Supabase dashboard. This admin page replaces that manual SQL work.

### Prerequisites

- Supabase project configured (you already have this ✅)
- Environment variables set (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY`) ✅
- Understanding of React hooks and TypeScript ✅
- Understanding of React Router (you already use it) ✅

### Files We'll Create

```
src/
├── contexts/
│   └── AuthContext.tsx          # React Context for auth state
├── hooks/
│   └── usePendingEvents.ts     # Hook to fetch & moderate events
├── pages/
│   ├── AdminPage.tsx           # Moderation dashboard
│   ├── AdminPage.css           # Dashboard styles
│   └── AdminLoginPage.tsx      # Login form
│   └── AdminLoginPage.css      # Login styles
└── components/
    └── ProtectedRoute/
        └── ProtectedRoute.tsx  # Guards admin routes
```

### Files We'll Modify

```
src/
├── App.tsx                     # Add admin routes
```

### SQL to Run in Supabase

```
Supabase Dashboard → SQL Editor (or local CLI)
├── Create admin role policies
├── Update RLS for event moderation
```

---

## Architecture & Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     FRONTEND (React App)                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  AuthContext (wraps entire app)                                 │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Provides: user, session, loading, signIn(), signOut()    │ │
│  │  Listens to: supabase.auth.onAuthStateChange()            │ │
│  └────────────────────────────────────────────────────────────┘ │
│           │                                                     │
│           ▼                                                     │
│  ProtectedRoute                                                 │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  IF user exists → render children (AdminPage)             │ │
│  │  IF no user     → redirect to /admin/login                │ │
│  │  IF loading     → show spinner                            │ │
│  └────────────────────────────────────────────────────────────┘ │
│           │                                                     │
│           ▼                                                     │
│  AdminPage                                                      │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  usePendingEvents() hook                                  │ │
│  │  ├── fetchPendingEvents() → SELECT * WHERE status='pending│ │
│  │  ├── approveEvent(id)     → UPDATE status='approved'      │ │
│  │  └── rejectEvent(id)     → UPDATE status='rejected'       │ │
│  │                                                           │ │
│  │  Renders: Event cards with Approve/Reject buttons         │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                     SUPABASE (Backend)                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Auth                                                           │
│  ├── Email/Password sign-in (built-in)                         │
│  └── Session management via JWT                                │
│                                                                 │
│  Database (PostgreSQL)                                         │
│  ├── events table (already exists)                             │
│  └── RLS Policies:                                             │
│      ├── Public: SELECT WHERE status='approved'                │
│      ├── Admin:  SELECT all events (any status)                │
│      └── Admin:  UPDATE status on any event                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

> **Learning Note — Why This Architecture?**
>
> We're using a pattern called "auth-gated routes." Instead of building a separate admin app,
> we add protected routes inside the same React app. Supabase handles authentication (who you are)
> and RLS handles authorization (what you can do). This means even if someone finds the `/admin`
> URL, they can't see or modify data without valid credentials — the security lives in the
> database, not just the frontend.

---

## Step 1: Supabase Auth Setup

### 1A. Create Your Admin User

You only need one admin user (yourself). Go to the Supabase Dashboard:

1. Open your project at https://supabase.com/dashboard
2. Go to **Authentication** → **Users**
3. Click **Add User** → **Create New User**
4. Enter your email and a strong password
5. Copy the user's **UUID** — you'll need it in Step 2

```
Example UUID: a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

> **Learning Note — Supabase Auth Users vs Database Users**
>
> Supabase Auth maintains its own `auth.users` table, separate from your `public.events` table.
> When a user signs in, Supabase issues a JWT (JSON Web Token) that contains their user ID.
> Every subsequent request from the Supabase client automatically includes this JWT.
> RLS policies can then check `auth.uid()` to see who's making the request.

### 1B. Mark Your User as Admin

We need a way to identify admin users. The simplest approach: use Supabase's built-in
`app_metadata` field on the auth user. Run this SQL in the **SQL Editor**:

```sql
-- Replace 'YOUR-USER-UUID-HERE' with the UUID you copied above
UPDATE auth.users
SET raw_app_meta_data = raw_app_meta_data || '{"role": "admin"}'::jsonb
WHERE id = 'YOUR-USER-UUID-HERE';
```

> **Learning Note — app_metadata vs user_metadata**
>
> Supabase users have TWO metadata fields:
>
> | Field           | Who can change it?           | Use case             |
> | --------------- | ---------------------------- | -------------------- |
> | `app_metadata`  | Only server/service role key | Roles, permissions   |
> | `user_metadata` | The user themselves          | Display name, avatar |
>
> We use `app_metadata` for the admin role because regular users can't modify it.
> This prevents privilege escalation — a user can't make themselves an admin
> by calling `supabase.auth.updateUser()`.

### 1C. Verify It Worked

Run this query to confirm your user has the admin role:

```sql
SELECT id, email, raw_app_meta_data
FROM auth.users
WHERE raw_app_meta_data->>'role' = 'admin';
```

You should see your user with `{"role": "admin"}` in the metadata.

---

## Step 2: Database — RLS Policies for Admin

Currently, your `events` table has two RLS policies:

1. **"Public events are viewable by everyone"** — `SELECT` where `status = 'approved'`
2. **"Anyone can insert events"** — `INSERT` with no restrictions

We need to add policies that let admins:

- **See ALL events** (including pending and rejected)
- **Update the status** of any event

### 2A. Add Admin Select Policy

```sql
-- Allow admin users to see ALL events (any status)
CREATE POLICY "Admins can view all events"
  ON public.events
  FOR SELECT
  TO authenticated                                       -- only logged-in users
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'  -- only if role is admin
  );
```

> **Learning Note — How RLS Policies Combine**
>
> PostgreSQL RLS uses OR logic for multiple policies of the same command type.
> So for SELECT, a row is visible if ANY select policy allows it:
>
> ```
> Can see the row IF:
>   Policy 1: status = 'approved'     ← public visitors see approved events
>   OR
>   Policy 2: user role = 'admin'     ← admin sees ALL events
> ```
>
> This means regular users still only see approved events, but admins see everything.
> You don't need to modify the existing public policy.

### 2B. Add Admin Update Policy

```sql
-- Allow admin users to update any event (approve/reject)
CREATE POLICY "Admins can update events"
  ON public.events
  FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );
```

> **Learning Note — USING vs WITH CHECK**
>
> UPDATE policies have TWO clauses:
>
> | Clause       | When it runs                           | Purpose                    |
> | ------------ | -------------------------------------- | -------------------------- |
> | `USING`      | Before the update (reading the row)    | "Can you see this row?"    |
> | `WITH CHECK` | After the update (validating new data) | "Is the new data allowed?" |
>
> Both must pass for the UPDATE to succeed. We use the same condition for both:
> the user must be an admin. This prevents non-admins from updating events
> even if they somehow craft a direct API request.

### 2C. Full SQL Script (Run All at Once)

```sql
-- ============================================
-- Admin Moderation Policies for events table
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================

-- 1. Allow admins to SELECT all events regardless of status
CREATE POLICY "Admins can view all events"
  ON public.events
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- 2. Allow admins to UPDATE events (change status)
CREATE POLICY "Admins can update events"
  ON public.events
  FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- Verify: List all policies on the events table
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'events';
```

Expected output after running the verify query:

| policyname                             | cmd    | qual                  |
| -------------------------------------- | ------ | --------------------- |
| Public events are viewable by everyone | SELECT | (status = 'approved') |
| Anyone can insert events               | INSERT | —                     |
| Admins can view all events             | SELECT | (jwt role = 'admin')  |
| Admins can update events               | UPDATE | (jwt role = 'admin')  |

---

## Step 3: Auth Context & Hook

### Why a Context?

Multiple components need to know if a user is logged in:

- `ProtectedRoute` needs it to allow/block access
- `AdminPage` needs the user info for display
- `Header` could show a "Log out" button (future)

React Context lets us compute auth state once and share it everywhere.

### 3A. Create `src/contexts/AuthContext.tsx`

```tsx
// Purpose: Provide authentication state to the entire app
// Learning: React Context + Supabase Auth listener pattern

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "../lib/supabase";
import type { User, Session } from "@supabase/supabase-js";

// ── Define the shape of our context value ──
// This interface tells TypeScript exactly what data and functions
// are available when consuming this context.
interface AuthContextType {
  user: User | null; // The logged-in user object, or null
  session: Session | null; // The active session (contains JWT), or null
  loading: boolean; // True while we're checking if user is logged in
  isAdmin: boolean; // Convenience flag: is this user an admin?
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

// ── Create the context with undefined default ──
// We use undefined as default so we can detect if someone tries
// to use the context outside of the provider.
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ── Provider component ──
// Wraps the app and manages auth state. Children can access
// auth data via the useAuth() hook.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Check if there's an existing session when app loads
    //    This handles page refreshes — the user stays logged in.
    async function getInitialSession() {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      setLoading(false);
    }

    getInitialSession();

    // 2. Listen for auth state changes (sign in, sign out, token refresh)
    //    This returns an "unsubscribe" function we call on cleanup.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      setLoading(false);
    });

    // 3. Cleanup: unsubscribe when component unmounts
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // ── Derive admin status from user metadata ──
  // We check the app_metadata we set in Step 1
  const isAdmin = user?.app_metadata?.role === "admin";

  // ── Sign in function ──
  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  }

  // ── Sign out function ──
  async function signOut() {
    await supabase.auth.signOut();
  }

  // ── Provide the value to children ──
  const value: AuthContextType = {
    user,
    session,
    loading,
    isAdmin,
    signIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ── Custom hook for consuming the context ──
// This is the ONLY way components should access auth state.
// It throws a helpful error if used outside the provider.
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
```

> **Learning Note — The "Context + Hook" Pattern**
>
> This is a very common React pattern with three parts:
>
> 1. **`createContext()`** — Creates a "mailbox" for data
> 2. **`<Provider>`** — The component that puts data IN the mailbox
> 3. **`useContext()` / custom hook** — How other components READ the mailbox
>
> ```
> App
>  └── AuthProvider          ← Manages state, puts it in context
>       ├── Header           ← Can call useAuth() to get user
>       ├── HomePage         ← Can call useAuth() (doesn't need to)
>       └── ProtectedRoute   ← Calls useAuth() to check access
>            └── AdminPage   ← Calls useAuth() for user info
> ```
>
> Without context, you'd have to pass `user` as a prop through every
> intermediate component ("prop drilling"). Context solves that.

> **Learning Note — Why Check for `undefined`?**
>
> ```ts
> if (context === undefined) {
>   throw new Error("useAuth must be used within an AuthProvider");
> }
> ```
>
> This is a developer experience (DX) safeguard. If you accidentally use
> `useAuth()` in a component that isn't inside `<AuthProvider>`, you'll get
> a clear error instead of mysterious `undefined` errors. Always do this
> with custom context hooks.

> **Learning Note — `onAuthStateChange`**
>
> ```ts
> supabase.auth.onAuthStateChange((_event, newSession) => { ... })
> ```
>
> This is a **listener** (like `addEventListener` in vanilla JS). It fires
> whenever the auth state changes:
>
> - `SIGNED_IN` — user logged in
> - `SIGNED_OUT` — user logged out
> - `TOKEN_REFRESHED` — JWT was refreshed automatically
>
> The first parameter `_event` tells you what happened (we ignore it with `_`).
> The second parameter `newSession` contains the updated session.
> Supabase handles token refresh automatically — you don't need to.

---

## Step 4: Protected Route Component

This component acts as a "bouncer" — it checks if you're logged in before
letting you see the admin pages.

### 4A. Create `src/components/ProtectedRoute/ProtectedRoute.tsx`

```tsx
// Purpose: Guard admin routes — redirect unauthenticated users to login
// Learning: Route protection pattern with React Router

import { Navigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading, isAdmin } = useAuth();

  // While checking auth state, show a loading indicator.
  // This prevents a flash of the login page on refresh.
  if (loading) {
    return (
      <div className="admin-loading">
        <p>Checking authentication...</p>
      </div>
    );
  }

  // Not logged in → redirect to login page
  if (!user) {
    return <Navigate to="/admin/login" replace />;
  }

  // Logged in but NOT an admin → show access denied
  // This is a second layer of protection (RLS is the first)
  if (!isAdmin) {
    return (
      <div className="admin-denied">
        <h2>Access Denied</h2>
        <p>You don't have permission to access the admin dashboard.</p>
      </div>
    );
  }

  // ✅ Authenticated admin → render the protected content
  return <>{children}</>;
}
```

> **Learning Note — `<Navigate>` vs `useNavigate()`**
>
> React Router gives you two ways to redirect:
>
> | Method          | When to use                       |
> | --------------- | --------------------------------- |
> | `<Navigate to>` | Inside JSX (render-time redirect) |
> | `useNavigate()` | Inside event handlers or effects  |
>
> Here we use `<Navigate>` because the redirect decision happens during
> rendering — "if not logged in, render a redirect instead of the children."
>
> The `replace` prop means the login page replaces the current history entry,
> so pressing "back" won't take you to the blocked admin page.

> **Learning Note — Defense in Depth**
>
> We have THREE layers of security:
>
> ```
> Layer 1: ProtectedRoute (frontend)
>   → Prevents UI access — user never sees the admin page
>
> Layer 2: isAdmin check (frontend)
>   → Even if authenticated, non-admins are blocked
>
> Layer 3: RLS Policies (database)
>   → Even if someone bypasses the frontend (e.g., cURL),
>     the database won't return pending events or allow updates
> ```
>
> Never rely on frontend-only security. The RLS policies are the real
> security boundary. The frontend checks are for user experience.

---

## Step 5: Admin Login Page

A simple email/password login form for the admin.

### 5A. Create `src/pages/AdminLoginPage.tsx`

```tsx
// Purpose: Login page for admin authentication
// Learning: Form handling with async operations, error states

import { useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import "./AdminLoginPage.css";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  // If already logged in, redirect to admin dashboard
  // This prevents showing the login form to already-authenticated users
  if (user) {
    navigate("/admin", { replace: true });
    return null;
  }

  const handleSubmit = async (e: FormEvent) => {
    // preventDefault stops the browser from doing a full page reload
    // (default behavior for form submission)
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const { error: signInError } = await useAuth().signIn(email, password);

      if (signInError) {
        setError("Invalid email or password. Please try again.");
        return;
      }

      // Success! Navigate to admin dashboard
      navigate("/admin", { replace: true });
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="admin-login">
      <div className="container">
        <div className="login-card">
          <h1>🔐 Admin Login</h1>
          <p className="login-subtitle">Event moderation dashboard access</p>

          {error && (
            <div className="login-error">
              <p>❌ {error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="login-form">
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@salsasegura.com"
                required
                autoComplete="email"
                disabled={isLoading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                disabled={isLoading}
              />
            </div>

            <button type="submit" className="login-button" disabled={isLoading}>
              {isLoading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
```

**Wait! There's a bug in the code above.** The `handleSubmit` function calls `useAuth().signIn()`,
but hooks can't be called inside event handlers — they must be called at the top level of the
component. Here's the corrected version:

```tsx
// ✅ CORRECT — call useAuth at the top level, destructure signIn
export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { user, signIn } = useAuth(); // ← destructure signIn HERE
  const navigate = useNavigate();

  if (user) {
    navigate("/admin", { replace: true });
    return null;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const { error: signInError } = await signIn(email, password); // ← use it here

      if (signInError) {
        setError("Invalid email or password. Please try again.");
        return;
      }

      navigate("/admin", { replace: true });
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // ... rest of JSX stays the same
}
```

> **Learning Note — Rules of Hooks**
>
> React hooks have strict rules:
>
> 1. **Only call hooks at the top level** — not inside loops, conditions, or nested functions
> 2. **Only call hooks from React function components** or other custom hooks
>
> ```tsx
> // ❌ WRONG — calling hook inside event handler
> const handleClick = () => {
>   const { signIn } = useAuth(); // This breaks!
> };
>
> // ✅ RIGHT — call hook at top level, use returned value in handler
> const { signIn } = useAuth();
> const handleClick = () => {
>   signIn(email, password); // This works!
> };
> ```
>
> Why? React tracks hooks by the ORDER they're called. If hooks are inside
> conditions or loops, the order could change between renders, breaking React.

### 5B. Corrected Full `AdminLoginPage.tsx`

Here is the complete, corrected file you should actually create:

```tsx
// Purpose: Login page for admin authentication
// Learning: Form handling with async operations, error states

import { useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import "./AdminLoginPage.css";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { user, signIn } = useAuth();
  const navigate = useNavigate();

  // If already logged in, redirect to admin dashboard
  if (user) {
    navigate("/admin", { replace: true });
    return null;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const { error: signInError } = await signIn(email, password);

      if (signInError) {
        setError("Invalid email or password. Please try again.");
        return;
      }

      navigate("/admin", { replace: true });
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="admin-login">
      <div className="container">
        <div className="login-card">
          <h1>🔐 Admin Login</h1>
          <p className="login-subtitle">Event moderation dashboard access</p>

          {error && (
            <div className="login-error">
              <p>❌ {error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="login-form">
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@salsasegura.com"
                required
                autoComplete="email"
                disabled={isLoading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                disabled={isLoading}
              />
            </div>

            <button type="submit" className="login-button" disabled={isLoading}>
              {isLoading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
```

### 5C. Create `src/pages/AdminLoginPage.css`

```css
/* ── Admin Login Page ── */
.admin-login {
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
  color: white;
  min-height: calc(100dvh - 200px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 60px 0;
}

.login-card {
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 20px;
  padding: 2.5rem;
  width: 100%;
  max-width: 420px;
  text-align: center;
}

.login-card h1 {
  font-size: 1.8rem;
  margin-bottom: 0.5rem;
}

.login-subtitle {
  opacity: 0.7;
  margin-bottom: 2rem;
  font-size: 0.95rem;
}

.login-error {
  background: rgba(231, 76, 60, 0.2);
  border: 1px solid rgba(231, 76, 60, 0.4);
  border-radius: 10px;
  padding: 0.75rem 1rem;
  margin-bottom: 1.5rem;
  font-size: 0.9rem;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  text-align: left;
}

.login-form .form-group label {
  display: block;
  margin-bottom: 0.4rem;
  font-weight: 500;
  font-size: 0.9rem;
}

.login-form .form-group input {
  width: 100%;
  padding: 12px 16px;
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.1);
  color: white;
  font-size: 1rem;
  transition: all 0.3s ease;
}

.login-form .form-group input::placeholder {
  color: rgba(255, 255, 255, 0.4);
}

.login-form .form-group input:focus {
  outline: none;
  border-color: #ff8c42;
  background: rgba(255, 255, 255, 0.15);
}

.login-form .form-group input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.login-button {
  width: 100%;
  padding: 14px;
  background: linear-gradient(135deg, #ff8c42, #e74c3c);
  color: white;
  border: none;
  border-radius: 10px;
  font-size: 1.05rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  margin-top: 0.5rem;
}

.login-button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(255, 140, 66, 0.4);
}

.login-button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}
```

---

## Step 6: usePendingEvents Hook

This hook handles all database operations for the moderation dashboard:
fetching pending events, approving them, and rejecting them.

### 6A. Create `src/hooks/usePendingEvents.ts`

```ts
// Purpose: Fetch pending events and provide approve/reject functions
// Learning: Custom hooks with multiple async operations, optimistic updates

import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import type { DatabaseEvent } from "../types/events";

// ── Define the filter type ──
// This lets the admin toggle between different views
export type EventFilter = "pending" | "approved" | "rejected" | "all";

export function usePendingEvents(filter: EventFilter = "pending") {
  const [events, setEvents] = useState<DatabaseEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  // ↑ Tracks which event ID is currently being approved/rejected

  // ── Fetch events based on filter ──
  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Build the query dynamically based on filter
      let query = supabase.from("events").select("*").order("created_at", { ascending: false });

      // If not showing "all", filter by status
      if (filter !== "all") {
        query = query.eq("status", filter);
      }

      const { data, error: supabaseError } = await query;

      if (supabaseError) {
        setError(supabaseError.message);
        return;
      }

      setEvents((data as DatabaseEvent[]) || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  // Fetch events on mount and when filter changes
  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // ── Approve an event ──
  const approveEvent = async (eventId: string) => {
    setActionLoading(eventId);
    try {
      const { error: updateError } = await supabase
        .from("events")
        .update({ status: "approved" })
        .eq("id", eventId);

      if (updateError) {
        setError(`Failed to approve: ${updateError.message}`);
        return;
      }

      // Remove the event from the local list (optimistic update)
      // This gives instant visual feedback without re-fetching
      setEvents((prev) => prev.filter((e) => e.id !== eventId));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
    } finally {
      setActionLoading(null);
    }
  };

  // ── Reject an event ──
  const rejectEvent = async (eventId: string) => {
    setActionLoading(eventId);
    try {
      const { error: updateError } = await supabase
        .from("events")
        .update({ status: "rejected" })
        .eq("id", eventId);

      if (updateError) {
        setError(`Failed to reject: ${updateError.message}`);
        return;
      }

      // Remove from local list (same optimistic update pattern)
      setEvents((prev) => prev.filter((e) => e.id !== eventId));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
    } finally {
      setActionLoading(null);
    }
  };

  return {
    events,
    loading,
    error,
    actionLoading,
    approveEvent,
    rejectEvent,
    refetch: fetchEvents,
  };
}
```

> **Learning Note — `useCallback`: Why and When**
>
> ```ts
> const fetchEvents = useCallback(async () => {
>   // ... fetch logic
> }, [filter]);
> ```
>
> `useCallback` memoizes a function — it returns the SAME function reference
> unless its dependencies change. Without it:
>
> ```ts
> // ❌ Without useCallback: new function created every render
> const fetchEvents = async () => { ... };
>
> useEffect(() => {
>   fetchEvents();      // This runs EVERY render because fetchEvents changed!
> }, [fetchEvents]);    // fetchEvents is a new reference each time
>
> // ✅ With useCallback: same function unless `filter` changes
> const fetchEvents = useCallback(async () => { ... }, [filter]);
>
> useEffect(() => {
>   fetchEvents();      // Only runs when `filter` changes
> }, [fetchEvents]);    // fetchEvents only changes when filter does
> ```
>
> Rule of thumb: wrap functions in `useCallback` when they're used in
> dependency arrays of `useEffect`, `useMemo`, or passed as props
> to `React.memo` components.

> **Learning Note — Optimistic Updates**
>
> ```ts
> setEvents((prev) => prev.filter((e) => e.id !== eventId));
> ```
>
> This is an **optimistic update** — we update the UI BEFORE confirming
> the database change succeeded. The event disappears from the list
> instantly, making the UI feel fast.
>
> The tradeoff: if the database update fails, the UI will be wrong.
> That's why we show errors — in a production app, you might also
> "rollback" the optimistic update on failure:
>
> ```ts
> // More robust pattern (optional enhancement):
> const previousEvents = events;
> setEvents(prev => prev.filter(e => e.id !== eventId));
>
> const { error } = await supabase...;
> if (error) {
>   setEvents(previousEvents);  // Rollback!
>   setError("Failed to approve");
> }
> ```

> **Learning Note — `actionLoading` Pattern**
>
> ```ts
> const [actionLoading, setActionLoading] = useState<string | null>(null);
> ```
>
> Instead of a boolean, we store the EVENT ID that's currently being
> processed. This lets us disable/show a spinner on JUST that one
> event's buttons, not all of them:
>
> ```tsx
> <button disabled={actionLoading === event.id}>
>   {actionLoading === event.id ? "Approving..." : "Approve"}
> </button>
> ```

---

## Step 7: Admin Dashboard Page

The main moderation interface where you see pending events and take action.

### 7A. Create `src/pages/AdminPage.tsx`

```tsx
// Purpose: Admin moderation dashboard for reviewing submitted events
// Learning: Filter state, conditional rendering, action handlers

import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { usePendingEvents, EventFilter } from "../hooks/usePendingEvents";
import type { DatabaseEvent } from "../types/events";
import "./AdminPage.css";

// ── Filter options configuration ──
// Keeping this as a constant array makes it easy to add new filters
const FILTER_OPTIONS: { value: EventFilter; label: string; emoji: string }[] = [
  { value: "pending", label: "Pending", emoji: "⏳" },
  { value: "approved", label: "Approved", emoji: "✅" },
  { value: "rejected", label: "Rejected", emoji: "❌" },
  { value: "all", label: "All", emoji: "📋" },
];

export default function AdminPage() {
  const { user, signOut } = useAuth();
  const [filter, setFilter] = useState<EventFilter>("pending");
  const { events, loading, error, actionLoading, approveEvent, rejectEvent, refetch } =
    usePendingEvents(filter);

  // ── Format date for display ──
  function formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  // ── Format price for display ──
  function formatPrice(event: DatabaseEvent): string {
    if (event.price_type === "free") return "Free";
    if (event.price_type === "paid" && event.price_amount) {
      return `$${event.price_amount.toFixed(2)}`;
    }
    return "Not specified";
  }

  return (
    <section className="admin-page">
      <div className="container">
        {/* ── Header ── */}
        <div className="admin-header">
          <div>
            <h1>📋 Event Moderation</h1>
            <p className="admin-subtitle">
              Logged in as <strong>{user?.email}</strong>
            </p>
          </div>
          <button onClick={signOut} className="signout-button">
            Sign Out
          </button>
        </div>

        {/* ── Filter Tabs ── */}
        <div className="filter-tabs">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              className={`filter-tab ${filter === opt.value ? "active" : ""}`}
              onClick={() => setFilter(opt.value)}
            >
              {opt.emoji} {opt.label}
            </button>
          ))}
          <button onClick={refetch} className="refresh-button" title="Refresh">
            🔄
          </button>
        </div>

        {/* ── Error Banner ── */}
        {error && (
          <div className="admin-error">
            <p>❌ {error}</p>
            <button onClick={refetch}>Retry</button>
          </div>
        )}

        {/* ── Loading State ── */}
        {loading && (
          <div className="admin-loading">
            <p>Loading events...</p>
          </div>
        )}

        {/* ── Empty State ── */}
        {!loading && events.length === 0 && (
          <div className="admin-empty">
            <p>
              {filter === "pending"
                ? "🎉 No pending events! All caught up."
                : `No ${filter} events found.`}
            </p>
          </div>
        )}

        {/* ── Event Cards ── */}
        {!loading && events.length > 0 && (
          <>
            <p className="event-count">
              Showing {events.length} {filter === "all" ? "" : filter} event
              {events.length !== 1 ? "s" : ""}
            </p>
            <div className="admin-events-list">
              {events.map((event) => (
                <div key={event.id} className="admin-event-card">
                  {/* Status Badge */}
                  <span className={`status-badge status-${event.status}`}>{event.status}</span>

                  {/* Event Info */}
                  <div className="event-info">
                    <h3>{event.title}</h3>
                    <div className="event-meta">
                      <span className="meta-item">📅 {formatDate(event.event_date)}</span>
                      <span className="meta-item">🏷️ {event.event_type}</span>
                      {event.location && <span className="meta-item">📍 {event.location}</span>}
                      <span className="meta-item">💰 {formatPrice(event)}</span>
                    </div>

                    {event.description && <p className="event-description">{event.description}</p>}

                    {event.address && <p className="event-address">📌 {event.address}</p>}

                    {event.rsvp_link && (
                      <a
                        href={event.rsvp_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="event-link"
                      >
                        🔗 RSVP Link
                      </a>
                    )}

                    <p className="event-submitted">Submitted: {formatDate(event.created_at)}</p>
                  </div>

                  {/* Action Buttons */}
                  {event.status === "pending" && (
                    <div className="event-actions">
                      <button
                        className="action-approve"
                        onClick={() => approveEvent(event.id)}
                        disabled={actionLoading === event.id}
                      >
                        {actionLoading === event.id ? "..." : "✅ Approve"}
                      </button>
                      <button
                        className="action-reject"
                        onClick={() => rejectEvent(event.id)}
                        disabled={actionLoading === event.id}
                      >
                        {actionLoading === event.id ? "..." : "❌ Reject"}
                      </button>
                    </div>
                  )}

                  {/* Re-approve rejected events */}
                  {event.status === "rejected" && (
                    <div className="event-actions">
                      <button
                        className="action-approve"
                        onClick={() => approveEvent(event.id)}
                        disabled={actionLoading === event.id}
                      >
                        {actionLoading === event.id ? "..." : "♻️ Re-approve"}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
```

> **Learning Note — Derived Filter Config Pattern**
>
> ```ts
> const FILTER_OPTIONS: { value: EventFilter; label: string; emoji: string }[] = [
>   { value: "pending", label: "Pending", emoji: "⏳" },
>   ...
> ];
> ```
>
> Instead of hardcoding four `<button>` elements in JSX, we define the
> options as data and `.map()` over them. Benefits:
>
> - **Single source of truth** — add a new filter by adding to the array
> - **Less duplication** — button logic is written once
> - **Easier to test** — you can export and test the array separately
>
> This is called "data-driven rendering" and it's a best practice when
> you have a list of similar UI elements.

> **Learning Note — Why `refetch` Is Useful**
>
> The dashboard removes events from the list when you approve/reject them
> (optimistic update). But what if:
>
> - A new event was submitted while you were reviewing?
> - Another admin approved something (future: multi-admin)?
> - The optimistic update was wrong?
>
> The 🔄 Refresh button calls `refetch()`, which re-fetches the full list
> from Supabase. It's a simple safety net for stale data.

---

## Step 8: Styling the Dashboard

### 8A. Create `src/pages/AdminPage.css`

```css
/* ── Admin Moderation Dashboard ── */
.admin-page {
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
  color: white;
  min-height: calc(100dvh - 200px);
  padding: 40px 0 80px;
}

/* ── Header ── */
.admin-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  flex-wrap: wrap;
  gap: 1rem;
}

.admin-header h1 {
  font-size: 2rem;
  margin-bottom: 0.25rem;
}

.admin-subtitle {
  opacity: 0.7;
  font-size: 0.9rem;
}

.signout-button {
  background: rgba(231, 76, 60, 0.2);
  color: #e74c3c;
  border: 1px solid rgba(231, 76, 60, 0.4);
  padding: 8px 20px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.3s ease;
}

.signout-button:hover {
  background: rgba(231, 76, 60, 0.4);
}

/* ── Filter Tabs ── */
.filter-tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 2rem;
  flex-wrap: wrap;
  align-items: center;
}

.filter-tab {
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.15);
  padding: 8px 18px;
  border-radius: 20px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.3s ease;
}

.filter-tab:hover {
  background: rgba(255, 255, 255, 0.15);
  color: white;
}

.filter-tab.active {
  background: linear-gradient(135deg, #ff8c42, #e74c3c);
  color: white;
  border-color: transparent;
  font-weight: 600;
}

.refresh-button {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  padding: 8px 12px;
  border-radius: 20px;
  cursor: pointer;
  font-size: 1rem;
  transition: all 0.3s ease;
  margin-left: auto;
}

.refresh-button:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: rotate(90deg);
}

/* ── States ── */
.admin-loading,
.admin-empty,
.admin-denied {
  text-align: center;
  padding: 4rem 2rem;
  opacity: 0.8;
  font-size: 1.1rem;
}

.admin-error {
  background: rgba(231, 76, 60, 0.2);
  border: 1px solid rgba(231, 76, 60, 0.4);
  border-radius: 12px;
  padding: 1rem 1.5rem;
  margin-bottom: 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.admin-error button {
  background: rgba(255, 255, 255, 0.15);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.3);
  padding: 6px 16px;
  border-radius: 6px;
  cursor: pointer;
}

.event-count {
  opacity: 0.6;
  font-size: 0.85rem;
  margin-bottom: 1rem;
}

/* ── Event Cards ── */
.admin-events-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.admin-event-card {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 16px;
  padding: 1.5rem;
  position: relative;
  transition: all 0.3s ease;
}

.admin-event-card:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
}

/* ── Status Badge ── */
.status-badge {
  position: absolute;
  top: 1rem;
  right: 1rem;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.status-pending {
  background: rgba(243, 156, 18, 0.25);
  color: #f39c12;
  border: 1px solid rgba(243, 156, 18, 0.4);
}

.status-approved {
  background: rgba(39, 174, 96, 0.25);
  color: #27ae60;
  border: 1px solid rgba(39, 174, 96, 0.4);
}

.status-rejected {
  background: rgba(231, 76, 60, 0.25);
  color: #e74c3c;
  border: 1px solid rgba(231, 76, 60, 0.4);
}

/* ── Event Info ── */
.event-info h3 {
  font-size: 1.25rem;
  margin-bottom: 0.75rem;
  padding-right: 6rem; /* space for badge */
}

.event-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 0.75rem;
  font-size: 0.9rem;
  opacity: 0.85;
}

.meta-item {
  white-space: nowrap;
}

.event-description {
  font-size: 0.9rem;
  opacity: 0.75;
  margin-bottom: 0.5rem;
  line-height: 1.5;
  /* Clamp to 3 lines max */
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.event-address {
  font-size: 0.85rem;
  opacity: 0.65;
  margin-bottom: 0.5rem;
}

.event-link {
  color: #85c1e9;
  font-size: 0.85rem;
  text-decoration: none;
  display: inline-block;
  margin-bottom: 0.5rem;
}

.event-link:hover {
  text-decoration: underline;
}

.event-submitted {
  font-size: 0.8rem;
  opacity: 0.5;
  margin-top: 0.5rem;
}

/* ── Action Buttons ── */
.event-actions {
  display: flex;
  gap: 0.75rem;
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.action-approve,
.action-reject {
  padding: 8px 20px;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 500;
  transition: all 0.3s ease;
}

.action-approve {
  background: rgba(39, 174, 96, 0.2);
  color: #27ae60;
  border: 1px solid rgba(39, 174, 96, 0.4);
}

.action-approve:hover:not(:disabled) {
  background: rgba(39, 174, 96, 0.4);
  transform: translateY(-1px);
}

.action-reject {
  background: rgba(231, 76, 60, 0.2);
  color: #e74c3c;
  border: 1px solid rgba(231, 76, 60, 0.4);
}

.action-reject:hover:not(:disabled) {
  background: rgba(231, 76, 60, 0.4);
  transform: translateY(-1px);
}

.action-approve:disabled,
.action-reject:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

/* ── Responsive ── */
@media (max-width: 600px) {
  .admin-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .admin-header h1 {
    font-size: 1.5rem;
  }

  .event-info h3 {
    font-size: 1.1rem;
    padding-right: 0;
  }

  .status-badge {
    position: static;
    display: inline-block;
    margin-bottom: 0.75rem;
  }

  .event-meta {
    flex-direction: column;
    gap: 0.4rem;
  }

  .event-actions {
    flex-direction: column;
  }

  .action-approve,
  .action-reject {
    width: 100%;
    text-align: center;
  }
}
```

> **Learning Note — CSS Design Decisions**
>
> 1. **Dark admin theme** — Matches your submit page (`linear-gradient(135deg, #1a1a2e...)`)
>    while looking distinct enough to feel like an "internal tool"
> 2. **`backdrop-filter: blur()`** — Creates a frosted glass effect. Not all
>    browsers support it, but it degrades gracefully (just no blur)
> 3. **`calc(100dvh - 200px)`** — `100dvh` is the "dynamic viewport height"
>    which accounts for mobile browser chrome (address bar).
>    We subtract 200px for header + footer (same as your submit page)
> 4. **`.status-badge` positioning** — Absolutely positioned on desktop for
>    a clean look, but `static` on mobile to avoid overlapping the title
> 5. **`-webkit-line-clamp: 3`** — Limits descriptions to 3 lines with
>    ellipsis. This keeps cards compact even for long descriptions

---

## Step 9: Add Routes to App.tsx

### 9A. What We're Changing

We need to:

1. Wrap the app in `AuthProvider`
2. Add routes for `/admin` and `/admin/login`
3. Protect the `/admin` route with `ProtectedRoute`

### 9B. Updated `App.tsx`

```tsx
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext"; // NEW
import MainLayout from "./layouts/MainLayout";
import HomePage from "./pages/HomePage";
import AboutPage from "./pages/AboutPage";
import ContactPage from "./pages/ContactPage";
import WorkInProgress from "./components/WIP/WorkInProgress";
import Lessons from "./pages/Lessons";
import Instructors from "./pages/Instructors";
import ScrollToTop from "./components/Scroll/ScrollToTop";
import NotFoundPage from "./pages/NotFoundPage";
import CalendarPage from "./pages/CalendarPage";
import SubmitEventPage from "./pages/SubmitEventPage";
import AdminPage from "./pages/AdminPage"; // NEW
import AdminLoginPage from "./pages/AdminLoginPage"; // NEW
import ProtectedRoute from "./components/ProtectedRoute/ProtectedRoute"; // NEW

function App() {
  const showWIP = false;

  if (showWIP) {
    return <WorkInProgress />;
  }

  return (
    <Router>
      <AuthProvider>
        {" "}
        {/* NEW — wraps everything */}
        <ScrollToTop />
        <Routes>
          <Route path="/" element={<MainLayout />}>
            <Route index element={<HomePage />} />
            <Route path="about" element={<AboutPage />} />
            <Route path="contact" element={<ContactPage />} />
            <Route path="calendar" element={<CalendarPage />} />
            <Route path="submit" element={<SubmitEventPage />} />
            <Route path="Lessons" element={<Lessons />} />
            <Route path="Instructors" element={<Instructors />} />

            {/* ── Admin Routes ── */}
            <Route path="admin/login" element={<AdminLoginPage />} />
            <Route
              path="admin"
              element={
                <ProtectedRoute>
                  <AdminPage />
                </ProtectedRoute>
              }
            />

            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </AuthProvider>{" "}
      {/* NEW — closes wrapper */}
    </Router>
  );
}

export default App;
```

> **Learning Note — Provider Placement**
>
> Why is `AuthProvider` INSIDE `Router` but OUTSIDE `Routes`?
>
> ```
> Router              ← Provides routing context
>   AuthProvider      ← Provides auth context (can use useNavigate)
>     ScrollToTop     ← Needs Router context
>     Routes          ← Defines route tree
>       Route...
> ```
>
> `AuthProvider` needs to be inside `Router` because it (and its children)
> might use React Router hooks like `useNavigate`. If you placed it outside
> `Router`, any navigation calls would fail.
>
> It's outside `Routes` because ALL routes need access to auth state — both
> the admin pages and (eventually) the header showing a logout button.

> **Learning Note — Nested Admin Routes**
>
> Notice we have `admin/login` and `admin` as sibling routes, not nested:
>
> ```tsx
> // ✅ What we did — flat sibling routes
> <Route path="admin/login" element={<AdminLoginPage />} />
> <Route path="admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
>
> // ❌ Alternative — nested route (would need Outlet in AdminPage)
> <Route path="admin">
>   <Route index element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
>   <Route path="login" element={<AdminLoginPage />} />
> </Route>
> ```
>
> We use flat routes because it's simpler — no need for an Outlet in AdminPage.
> If you later add more admin sub-pages (e.g., `/admin/users`, `/admin/analytics`),
> switch to nested routes with a shared admin layout.

---

## Step 10: Testing Your Implementation

### 10A. Manual Testing Checklist

```
Test Case                          Expected Result
──────────────────────────────────────────────────────────────────
1. Visit /admin (not logged in)    → Redirected to /admin/login
2. Visit /admin/login              → See login form
3. Enter wrong credentials         → "Invalid email or password" error
4. Enter correct admin credentials → Redirected to /admin dashboard
5. See pending events              → Events with status "pending" shown
6. Click "Approve" on an event     → Event disappears from pending list
7. Switch to "Approved" tab        → See the event you just approved
8. Visit /calendar                 → See the approved event on calendar
9. Switch to "Rejected" tab        → See rejected events (if any)
10. Click "Sign Out"               → Redirected to login, /admin blocked
11. Submit a new event via /submit → Event shows as pending in dashboard
12. Click "Reject" on pending      → Event disappears from pending list
13. Visit /admin on mobile         → Layout is responsive, buttons stack
14. Refresh /admin page            → Still logged in (session persisted)
```

### 10B. Testing the RLS Policies

Open your browser's **DevTools → Console** and try:

```js
// This should FAIL for non-admin users (or logged-out users):
const { data, error } = await supabase.from("events").select("*").eq("status", "pending");

console.log(data); // Should be empty array []
console.log(error); // Should be null (RLS silently filters, no error)
```

> **Learning Note — RLS Doesn't Throw Errors**
>
> When RLS blocks a query, it doesn't return an error — it returns an empty
> result set. This is by design: you don't want to tell unauthorized users
> "there IS data here, you just can't see it." The query succeeds, but
> returns no rows. This is important for security (no information leakage).

### 10C. Test with Supabase Local (Optional)

If you're running the local Supabase emulator:

```bash
# Start local Supabase
supabase start

# Run the migration SQL
supabase db reset

# Open Supabase Studio
# Visit http://localhost:54323
```

---

## Troubleshooting

### "Invalid email or password" but credentials are correct

```
Possible causes:
1. User not confirmed — go to Auth → Users in dashboard, check "Confirmed"
2. Wrong Supabase URL/key — check your .env.local matches the project
3. Auth disabled — check supabase/config.toml has [auth] enabled = true
```

### Admin can't see pending events

```
Possible causes:
1. RLS policy not created — run the SQL from Step 2C
2. Admin role not set — run the SQL from Step 1B
3. User not actually logged in — check network tab for 401 errors
4. Using anon key vs service key confusion — the anon key is correct for
   client-side; RLS uses the JWT from the logged-in session
```

### Events don't disappear after approve/reject

```
Possible causes:
1. UPDATE RLS policy missing — run Step 2B SQL
2. Check browser console for Supabase errors
3. Verify the event ID is a valid UUID (check types)
```

### "useAuth must be used within an AuthProvider"

```
Cause: A component using useAuth() is rendered outside <AuthProvider>
Fix: Make sure AuthProvider wraps the Router's children in App.tsx
```

---

## Future Enhancements

Once the basic moderation dashboard is working, here are improvements
to consider for future weeks:

### Near-term (Weeks 7-8)

- [ ] **Confirmation dialog** before approve/reject ("Are you sure?")
- [ ] **Toast notifications** — brief "Event approved!" messages
- [ ] **Event count badges** on filter tabs (e.g., "Pending (3)")
- [ ] **Event preview** — click to expand full details

### Medium-term (Weeks 9-12)

- [ ] **Bulk actions** — select multiple events and approve/reject at once
- [ ] **Email notifications** — notify submitter when their event is approved
- [ ] **Edit before approve** — modify event details before publishing
- [ ] **Supabase Realtime** — new submissions appear without refresh

### Long-term (Weeks 13+)

- [ ] **Multi-admin support** — add more admin users with different roles
- [ ] **Audit log** — track who approved/rejected which events and when
- [ ] **Analytics** — submission trends, approval rates, busiest days
- [ ] **Auto-approve** trusted submitters based on history

---

## Quick Reference

### File Map

```
src/
├── contexts/
│   └── AuthContext.tsx          # Auth state provider + useAuth hook
├── components/
│   └── ProtectedRoute/
│       └── ProtectedRoute.tsx   # Route guard component
├── hooks/
│   └── usePendingEvents.ts     # Fetch + moderate events hook
├── pages/
│   ├── AdminLoginPage.tsx      # Login form
│   ├── AdminLoginPage.css
│   ├── AdminPage.tsx           # Moderation dashboard
│   └── AdminPage.css
└── App.tsx                     # Updated with admin routes + AuthProvider
```

### SQL to Run

```sql
-- 1. Set admin role (one-time, replace UUID)
UPDATE auth.users
SET raw_app_meta_data = raw_app_meta_data || '{"role": "admin"}'::jsonb
WHERE id = 'YOUR-USER-UUID';

-- 2. Admin can view all events
CREATE POLICY "Admins can view all events"
  ON public.events FOR SELECT TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- 3. Admin can update events
CREATE POLICY "Admins can update events"
  ON public.events FOR UPDATE TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
```

### Key Concepts Covered

| Concept                       | Where Used                  |
| ----------------------------- | --------------------------- |
| React Context + Provider      | AuthContext.tsx             |
| Custom Hooks                  | usePendingEvents.ts         |
| Route Protection              | ProtectedRoute.tsx          |
| Supabase Auth                 | AuthContext.tsx, Login page |
| RLS (Row Level Security)      | SQL policies                |
| Optimistic Updates            | usePendingEvents.ts         |
| useCallback                   | usePendingEvents.ts         |
| Rules of Hooks                | AdminLoginPage.tsx          |
| Data-driven Rendering         | AdminPage.tsx filter tabs   |
| Defense in Depth              | ProtectedRoute + RLS        |
| app_metadata vs user_metadata | Admin role setup            |
| `<Navigate>` vs `useNavigate` | ProtectedRoute + Login      |

---

_Guide written for SalsaSegura.com — Week 6: Moderation Dashboard_
_Stack: React 19 + TypeScript 5.9 + Supabase + Vite 7.3_
