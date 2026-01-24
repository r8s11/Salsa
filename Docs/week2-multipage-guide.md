# Week 2: Multi-Page Structure

> **Deliverable:** Professional navigation with 3 working pages and smooth transitions
> **Time Commitment:** 8-10 hours (spread across 5 days)
> **Prerequisites:** Week 1 completed, React basics understood

---

## 🎯 Week 2 Objectives

By the end of this week, you will have:

- [X] React Router installed and configured
- [ ] Header with logo + professional navigation
- [X} 3 pages working (Home/Calendar, About, Contact)
- [ ] Footer with social links on all pages
- [ ] Smooth page transitions with CSS animations

---

## 📚 Concepts You'll Learn

| Concept                 | Why It Matters                     |
| ----------------------- | ---------------------------------- |
| **Client-Side Routing** | Navigate without full page reloads |
| **React Router v6**     | Industry-standard routing library  |
| **Layout Components**   | Shared UI across pages             |
| **CSS Transitions**     | Professional feel to navigation    |
| **Code Organization**   | Scalable project structure         |

---

## 🗂️ Target File Structure

After this week, your `src/` folder should look like this:

```
src/
├── App.tsx                    # Router configuration
├── main.tsx                   # Entry point (unchanged)
├── styles.css                 # Global styles
├── components/
│   ├── Header.tsx             # ✏️ Updated with React Router
│   ├── Footer.tsx             # ✅ Keep as-is
│   ├── Hero.tsx
│   ├── Events.tsx
│   ├── Contact.tsx
│   ├── ScrollToTop.tsx        # 🆕 NEW component
│   ├── calendar.tsx
│   └── ...
├── pages/                     # 🆕 NEW folder
│   ├── HomePage.tsx           # 🆕 Home/Calendar page
│   ├── AboutPage.tsx          # 🆕 About page
│   ├── ContactPage.tsx        # 🆕 Contact page
│   └── NotFoundPage.tsx       # 🆕 404 page
└── layouts/                   # 🆕 NEW folder
    └── MainLayout.tsx         # 🆕 Header + Footer wrapper
```

---

## Day 1: Install React Router & Basic Setup (1.5 hours)

### Step 1.1: Install React Router

Open your terminal in the project folder and run:

```bash
npm install react-router-dom
```

**What this does:** Adds the `react-router-dom` package which provides:

- `BrowserRouter` - Enables routing in your app
- `Routes` & `Route` - Define which component shows for each URL
- `Link` - Navigate without page reloads
- `Outlet` - Render child routes inside layouts

### Step 1.2: Create the Pages Folder

Create a new folder: `src/pages/`

This folder will contain **page components** - these are the top-level components that represent entire pages, not reusable UI pieces.

### Step 1.3: Create HomePage.tsx

Create file: `src/pages/HomePage.tsx`

```tsx
import Hero from "../components/Hero";
import Events from "../components/Events";

function HomePage() {
  return (
    <>
      <Hero />
      <Events />
    </>
  );
}

export default HomePage;
```

**💡 Learning Note:** Page components are "containers" that compose smaller components together. They typically don't have their own styling - that stays in the child components.

### Step 1.4: Create AboutPage.tsx

Create file: `src/pages/AboutPage.tsx`

```tsx
function AboutPage() {
  return (
    <section className="about-page">
      <div className="container">
        <h1>About Salsa Segura</h1>
        <p>
          Welcome to Salsa Segura! We are passionate about bringing the joy of
          Latin dance to everyone. Our mission is to create a welcoming
          community where dancers of all levels can learn, grow, and connect.
        </p>

        <h2>Our Story</h2>
        <p>
          Founded with a love for salsa and bachata, Salsa Segura has been
          helping dancers find their rhythm since day one. Whether you're taking
          your first steps or perfecting advanced patterns, we're here to guide
          your journey.
        </p>

        <h2>What We Offer</h2>
        <ul>
          <li>🎓 Beginner to advanced classes</li>
          <li>🎉 Weekly social dance events</li>
          <li>👥 Private lessons</li>
          <li>🌎 Dance community connections</li>
        </ul>
      </div>
    </section>
  );
}

export default AboutPage;
```

### Step 1.5: Create ContactPage.tsx

Create file: `src/pages/ContactPage.tsx`

```tsx
import Contact from "../components/Contact";

function ContactPage() {
  return (
    <section className="contact-page">
      <div className="container">
        <h1>Get In Touch</h1>
        <p>
          We'd love to hear from you! Reach out with any questions about
          classes, events, or private lessons.
        </p>
      </div>
      <Contact />
    </section>
  );
}

export default ContactPage;
```

### ✅ Day 1 Checkpoint

You should now have:

- [X]  `react-router-dom` in your `package.json`
- [X] `src/pages/` folder created
- [X] 3 page files: `HomePage.tsx`, `AboutPage.tsx`, `ContactPage.tsx`

---

## Day 2: Create Layout & Configure Router (2 hours)

### Step 2.1: Create the Layouts Folder

Create folder: `src/layouts/`

### Step 2.2: Create MainLayout.tsx

This component wraps every page with the Header and Footer.

Create file: `src/layouts/MainLayout.tsx`

```tsx
import { Outlet } from "react-router-dom";
import Header from "../components/Header";
import Footer from "../components/Footer";

function MainLayout() {
  return (
    <>
      <Header />
      <main className="page-content">
        <Outlet />
      </main>
      <Footer />
    </>
  );
}

export default MainLayout;
```

**💡 Learning Note:** `<Outlet />` is a placeholder. React Router replaces it with the current page's component based on the URL. This is called a **nested route pattern**.

### Step 2.3: Update App.tsx with Router

Replace your entire `src/App.tsx` with:

```tsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import MainLayout from "./layouts/MainLayout";
import HomePage from "./pages/HomePage";
import AboutPage from "./pages/AboutPage";
import ContactPage from "./pages/ContactPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<HomePage />} />
          <Route path="about" element={<AboutPage />} />
          <Route path="contact" element={<ContactPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
```

**💡 Learning Note - Route Structure Explained:**

```
<Route path="/" element={<MainLayout />}>     ← Parent route (layout)
  <Route index element={<HomePage />} />      ← "/" shows HomePage
  <Route path="about" element={<AboutPage />} /> ← "/about" shows AboutPage
  <Route path="contact" element={<ContactPage />} /> ← "/contact" shows ContactPage
</Route>
```

The `index` keyword means "show this when the parent path matches exactly."

### Step 2.4: Test Your Routes

Start your dev server:

```bash
npm run dev
```

Try these URLs manually in your browser:

- `http://localhost:5173/` → Should show Home
- `http://localhost:5173/about` → Should show About
- `http://localhost:5173/contact` → Should show Contact

### ✅ Day 2 Checkpoint

You should now have:

- [X] `MainLayout.tsx` with Header, Outlet, Footer
- [X] `App.tsx` configured with BrowserRouter and Routes
- [X] All 3 URLs working when typed directly in browser

---

## Day 3: Update Header Navigation (2 hours)

### Step 3.1: Convert Header to Use React Router Links

Replace your entire `src/components/Header.tsx` with:

```tsx
import { useState } from "react";
import { Link, NavLink } from "react-router-dom";

function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);

  const closeMenu = () => {
    setMobileOpen(false);
  };

  return (
    <header>
      <nav className="container">
        {/* Logo - links to home */}
        <Link to="/" className="logo" onClick={closeMenu}>
          🕺🏽Salsa Segura
        </Link>

        <ul className={`nav-links ${mobileOpen ? "active" : ""}`}>
          <li>
            <NavLink
              to="/"
              onClick={closeMenu}
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              Home
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/about"
              onClick={closeMenu}
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              About
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/contact"
              onClick={closeMenu}
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              Contact
            </NavLink>
          </li>
        </ul>

        <button
          className="hamburger"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-expanded={mobileOpen}
          aria-label="Toggle menu"
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
      </nav>
    </header>
  );
}

export default Header;
```

**💡 Learning Note - Link vs NavLink:**

| Component   | Use Case                                                 |
| ----------- | -------------------------------------------------------- |
| `<Link>`    | Basic navigation (logo, buttons)                         |
| `<NavLink>` | Navigation menus - provides `isActive` state for styling |

`NavLink` automatically knows which page you're on, so you can highlight the current page in the menu.

### Step 3.2: Add Active Link Styling

Add these styles to your `src/styles.css` (or main stylesheet):

```css
/* Active navigation link */
.nav-links a.active {
  color: #ff6b35; /* Your accent color */
  font-weight: 600;
  border-bottom: 2px solid #ff6b35;
}

/* Hover effect for nav links */
.nav-links a:hover {
  color: #ff6b35;
}

/* Make logo a proper link */
a.logo {
  text-decoration: none;
  color: inherit;
}
```

### Step 3.3: Test Navigation

1. Click each nav link - page should change WITHOUT full reload
2. Check the URL bar updates correctly
3. Verify the active link is highlighted
4. Test mobile hamburger menu still works
5. Click the logo - should go to home

### ✅ Day 3 Checkpoint

You should now have:

- [X] All navigation using React Router `Link`/`NavLink`
- [X] Active page highlighted in navigation
- [X] Logo clicking navigates to home
- [X] Mobile menu still works

---

## Day 4: Add Page Transitions (2 hours)

### Step 4.1: Add CSS for Page Transitions

Add to your `src/styles.css`:

```css
/* Page transition wrapper */
.page-content {
  animation: fadeIn 0.3s ease-in-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Page sections base styling */
.about-page,
.contact-page {
  padding: 2rem 0;
  min-height: 60vh;
}

.about-page h1,
.contact-page h1 {
  margin-bottom: 1rem;
  color: var(--heading-color, #333);
}

.about-page h2 {
  margin-top: 2rem;
  margin-bottom: 0.5rem;
}

.about-page ul {
  list-style: none;
  padding: 0;
}

.about-page li {
  padding: 0.5rem 0;
  font-size: 1.1rem;
}
```

### Step 4.2: Add Scroll-to-Top on Navigation

When users navigate to a new page, they should start at the top. Create a helper component.

Create file: `src/components/ScrollToTop.tsx`

```tsx
import { useEffect } from "react";
import { useLocation } from "react-router-dom";

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null; // This component doesn't render anything
}

export default ScrollToTop;
```

### Step 4.3: Add ScrollToTop to App.tsx

Update `src/App.tsx`:

```tsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import MainLayout from "./layouts/MainLayout";
import HomePage from "./pages/HomePage";
import AboutPage from "./pages/AboutPage";
import ContactPage from "./pages/ContactPage";
import ScrollToTop from "./components/ScrollToTop"; // Add this

function App() {
  return (
    <BrowserRouter>
      <ScrollToTop /> {/* Add this */}
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<HomePage />} />
          <Route path="about" element={<AboutPage />} />
          <Route path="contact" element={<ContactPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
```

### Step 4.4: Test Transitions

1. Navigate between pages - should see fade-in effect
2. Scroll down on a page, then navigate - should scroll to top
3. Use browser back/forward buttons - should still work smoothly

### ✅ Day 4 Checkpoint

You should now have:

- [ ] Smooth fade-in animation on page changes
- [X] Pages scroll to top on navigation
- [X] Browser history (back/forward) works correctly

---

## Day 5: Polish & Add 404 Page (1.5 hours)

### Step 5.1: Create a 404 Not Found Page

Create file: `src/pages/NotFoundPage.tsx`

```tsx
import { Link } from "react-router-dom";

function NotFoundPage() {
  return (
    <section className="not-found-page">
      <div className="container">
        <h1>404</h1>
        <h2>Page Not Found</h2>
        <p>Oops! Looks like this page took a wrong turn on the dance floor.</p>
        <Link to="/" className="btn-primary">
          🏠 Back to Home
        </Link>
      </div>
    </section>
  );
}

export default NotFoundPage;
```

### Step 5.2: Add 404 Route to App.tsx

Update the Routes in `src/App.tsx`:

```tsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import MainLayout from "./layouts/MainLayout";
import HomePage from "./pages/HomePage";
import AboutPage from "./pages/AboutPage";
import ContactPage from "./pages/ContactPage";
import NotFoundPage from "./pages/NotFoundPage"; // Add this
import ScrollToTop from "./components/ScrollToTop";

function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<HomePage />} />
          <Route path="about" element={<AboutPage />} />
          <Route path="contact" element={<ContactPage />} />
          <Route path="*" element={<NotFoundPage />} /> {/* Add this - catches all unknown routes */}
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
```

### Step 5.3: Style the 404 Page

Add to `src/styles.css`:

```css
/* 404 Page */
.not-found-page {
  text-align: center;
  padding: 4rem 0;
  min-height: 60vh;
  display: flex;
  align-items: center;
  justify-content: center;
}

.not-found-page h1 {
  font-size: 6rem;
  margin: 0;
  color: #ff6b35;
}

.not-found-page h2 {
  margin: 0.5rem 0 1rem;
}

.not-found-page p {
  margin-bottom: 2rem;
  color: #666;
}

.btn-primary {
  display: inline-block;
  padding: 0.75rem 1.5rem;
  background: #ff6b35;
  color: white;
  text-decoration: none;
  border-radius: 8px;
  font-weight: 600;
  transition: background 0.2s;
}

.btn-primary:hover {
  background: #e55a2b;
}
```

### Step 5.4: Final Testing Checklist

Test everything thoroughly:

- [X] **Home page** (`/`) - Shows Hero + Events
- [ ] **About page** (`/about`) - Shows about content
- [X] **Contact page** (`/contact`) - Shows contact form
- [X] **404 page** (`/anything-random`) - Shows not found
- [X] **Navigation** - All links work, active state shows
- [ ] **Logo** - Clicks back to home
- [X] **Mobile menu** - Opens, closes, navigates correctly
- [ ] **Page transitions** - Smooth fade-in effect
- [X] **Scroll behavior** - Returns to top on navigation
- [X] **Browser buttons** - Back/forward work correctly
- [X] **Footer** - Shows on all pages, dark mode toggle works

### ✅ Day 5 Checkpoint

You should now have:

- [X] 404 page catching unknown routes
- [ ] All features tested and working
- [ ] Code committed to git

---

## 🎉 Week 2 Complete!

### What You Built

| Feature                  | Status    |
| ------------------------ | --------- |
| React Router configured  | ✅        |
| Header with logo + nav   | ✅        |
| 3 pages working          | ✅        |
| Footer with social links | ✅        |
| Smooth page transitions  | ✅        |
| 404 error page           | ✅ Bonus! |
| Scroll-to-top behavior   | ✅ Bonus! |

### What You Learned

1. **Client-side routing** with React Router v6
2. **Layout components** with `Outlet`
3. **NavLink** for active states
4. **CSS animations** for transitions
5. **useLocation** hook for route changes
6. **Catch-all routes** for 404 pages

### Git Commit

```bash
git add .
git commit -m "Week 2: Add multi-page navigation with React Router"
git push
```

---

## 🔧 Troubleshooting

### "Page not found" on refresh (production)

This happens because the server doesn't know about your routes. For Vite/Netlify/Vercel, you need to configure redirects.

**For Netlify**, create `public/_redirects`:

```
/*    /index.html   200
```

**For Vercel**, create `vercel.json`:

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

### Links not working

Make sure you're using `<Link to="/path">` not `<a href="/path">`. Regular anchor tags cause full page reloads.

### Active class not applying

Check that you're using `NavLink` (not `Link`) and the `className` function syntax:

```tsx
className={({ isActive }) => (isActive ? "active" : "")}
```

---

## 📖 Further Reading

- [React Router Documentation](https://reactrouter.com/en/main)
- [React Router Tutorial](https://reactrouter.com/en/main/start/tutorial)
- [CSS Animations Guide](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Animations/Using_CSS_animations)

---

## ➡️ Next Week Preview

**Week 3: Calendar Integration**

- Display events in a calendar view
- Use your existing `calendar.tsx` component
- Connect events from markdown files
- Add event detail pages with dynamic routes (`/events/:id`)
