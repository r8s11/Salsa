# Event Submission Page Guide

> **Learning Notes & Implementation Guide**
> For the Salsa Community Events Platform

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture & Data Flow](#architecture--data-flow)
3. [Database Schema Review](#database-schema-review)
4. [Step 1: Create the Form Component](#step-1-create-the-form-component)
5. [Step 2: Create the Custom Hook](#step-2-create-the-custom-hook)
6. [Step 3: Supabase Storage Setup](#step-3-supabase-storage-setup)
7. [Step 4: Add Styling](#step-4-add-styling)
8. [Step 5: Add Routing](#step-5-add-routing)
9. [Step 6: Testing Your Implementation](#step-6-testing-your-implementation)
10. [Future: Authentication Integration](#future-authentication-integration)
11. [Troubleshooting](#troubleshooting)
12. [Quick Reference](#quick-reference)

---

## Overview

### What We're Building

A public event submission page that allows community members to submit salsa events (socials, classes, workshops) with:

- Event details form (title, description, date, location, etc.)
- Event poster image upload via Supabase Storage
- Direct submission to Supabase database
- Immediate visibility (`status: 'approved'`)

### Prerequisites

- Existing Supabase project configured
- Environment variables set (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)
- Basic understanding of React hooks and TypeScript

### Files We'll Create

```
src/
├── pages/
│   └── SubmitEventPage.tsx      # Main form page component
│   └── SubmitEventPage.css      # Page-specific styles
└── hooks/
    └── useSubmitEvent.ts        # Custom hook for submission logic
```

### Files We'll Modify

```
src/
└── App.tsx                      # Add new route
```

---

## Architecture & Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     User Interaction                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   SubmitEventPage.tsx                            │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Form State (useState)                                    │   │
│  │  - title, description, event_type, event_date, etc.      │   │
│  │  - imageFile (File object)                                │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                   │
│                              ▼                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  handleSubmit()                                           │   │
│  │  1. Validate form fields                                  │   │
│  │  2. Call useSubmitEvent hook                              │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    useSubmitEvent.ts                             │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  submitEvent(formData, imageFile)                         │   │
│  │                                                           │   │
│  │  Step 1: Upload image to Supabase Storage                 │   │
│  │          └── Returns public URL                           │   │
│  │                                                           │   │
│  │  Step 2: Insert event record with image_url               │   │
│  │          └── Returns created event                        │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Supabase                                   │
│  ┌─────────────────────┐    ┌─────────────────────────────┐     │
│  │  Storage Bucket     │    │  events table               │     │
│  │  "event-posters"    │    │  - id (uuid)                │     │
│  │                     │    │  - title                    │     │
│  │  /posters/          │    │  - image_url ──────────────────┐  │
│  │    {uuid}.jpg       │    │  - status: 'approved'      │  │  │
│  └─────────────────────┘    └─────────────────────────────┘  │  │
│           │                                                   │  │
│           └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Database Schema Review

### Current `events` Table Structure

Your existing schema from `Docs/sql queries/events.sql`:

```sql
create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  event_type text check (event_type in ('social', 'workshop', 'class')),
  event_date timestamp with time zone not null,
  event_time text,
  location text,
  address text,
  price_type text check(price_type in ('free','paid')),
  price_amount numeric(10, 2),
  rsvp_link text,
  image_url text,
  status text default 'approved',
  created_at timestamp with time zone default now()
);
```

### TypeScript Interface (from `src/types/events.ts`)

```typescript
export type EventType = "social" | "class" | "workshop";

export interface DatabaseEvent {
  id: string;
  title: string;
  description: string | null;
  event_type: EventType;
  event_date: string;
  event_time: string | null;
  location: string | null;
  address: string | null;
  price_type: "free" | "Paid" | null;
  price_amount: number | null;
  rsvp_link: string | null;
  image_url: string | null;
  status: "approved" | "pending" | "rejected";
  created_at: string;
}
```

### Form Field → Database Field Mapping

| Form Field   | Database Column | Type      | Required | Notes                         |
| ------------ | --------------- | --------- | -------- | ----------------------------- |
| Event Title  | `title`         | text      | ✅ Yes   | Max 100 chars recommended     |
| Description  | `description`   | text      | No       | Multi-line textarea           |
| Event Type   | `event_type`    | text      | ✅ Yes   | 'social', 'class', 'workshop' |
| Date         | `event_date`    | timestamp | ✅ Yes   | Combined with time            |
| Time         | `event_time`    | text      | No       | Format: "7:00 PM"             |
| Venue Name   | `location`      | text      | No       | e.g., "CRG Studio"            |
| Address      | `address`       | text      | No       | Full street address           |
| Price Type   | `price_type`    | text      | No       | 'free' or 'paid'              |
| Price Amount | `price_amount`  | numeric   | No       | Only if price_type = 'paid'   |
| RSVP Link    | `rsvp_link`     | text      | No       | URL to ticket/signup          |
| Event Poster | `image_url`     | text      | No       | URL from Storage              |

---

## Step 1: Create the Form Component

**What you'll accomplish:**

1. Create a form page component with controlled inputs
2. Implement form state management with `useState`
3. Handle text inputs, selects, and file uploads
4. Add image preview functionality
5. Implement conditional rendering for price fields

### Learning Concepts

- **Controlled Components**: Each input's value is tied to React state
- **Form State Object**: Group related fields in a single state object
- **Event Handlers**: `onChange` updates state, `onSubmit` processes the form

### Create `src/pages/SubmitEventPage.tsx`

````tsx
import { useState, FormEvent, ChangeEvent } from "react";
import { useSubmitEvent } from "../hooks/useSubmitEvent";
import "./SubmitEventPage.css";

// Define the form state shape (what the user fills in)
interface EventFormData {
  title: string;
  description: string;
  event_type: "social" | "class" | "workshop" | "";
  event_date: string; // HTML date input format: "2026-02-14"
  event_time: string; // e.g., "19:00" or "7:00 PM"
  location: string;
  address: string;
  price_type: "free" | "paid" | "";
  price_amount: string; // String for input, convert to number on submit
  rsvp_link: string;
}

// Initial empty form state
const initialFormState: EventFormData = {
  title: "",
  description: "",
  event_type: "",
  event_date: "",
  event_time: "",
  location: "",
  address: "",
  price_type: "",
  price_amount: "",
  rsvp_link: "",
};

export default function SubmitEventPage() {
  // Form data state
  const [form, setForm] = useState<EventFormData>(initialFormState);

  // Image file state (separate because it's a File object, not text)
  const [imageFile, setImageFile] = useState<File | null>(null);

  // Image preview URL (for showing selected image before upload)
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Get submission function and states from our custom hook
  const { submitEvent, isSubmitting, isSubmitted, error } = useSubmitEvent();

> 💡 **JS/TS Learning Note — useState Hook**
>
> `useState` is React's way to add "memory" to a component:
>
> ```typescript
> const [value, setValue] = useState<Type>(initialValue);
> //     │      │                  │      └── Starting value
> //     │      │                  └── TypeScript type (optional)
> //     │      └── Function to UPDATE the value
> //     └── Current value
> ```
>
> **Examples:**
> ```typescript
> const [count, setCount] = useState(0);        // number, starts at 0
> const [name, setName] = useState("");         // string, starts empty
> const [user, setUser] = useState<User|null>(null); // User or null
> ```
>
> **Using state:**
> ```typescript
> console.log(count);     // Read: 0
> setCount(5);            // Update to 5
> setCount(prev => prev + 1); // Update based on previous value
> ```
>
> **Why use `useState`?**
> When state changes, React **re-renders** the component with the new value.
> Regular variables don't trigger re-renders!

  // Generic handler for text inputs and selects
  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

> 💡 **JS/TS Learning Note — Arrow Functions**
>
> Arrow functions are a shorter way to write functions:
>
> ```typescript
> // Traditional function
> function add(a, b) {
>   return a + b;
> }
>
> // Arrow function (same thing)
> const add = (a, b) => {
>   return a + b;
> };
>
> // Arrow function with implicit return (even shorter)
> const add = (a, b) => a + b;
> ```
>
> **The `e` parameter:**
> - `e` is the "event" object that browsers create when something happens
> - `e.target` is the HTML element that triggered the event (the input)
> - `e.target.name` is the `name` attribute of that input
> - `e.target.value` is what the user typed
>
> **Spread operator (`...prev`):**
> ```typescript
> const prev = { a: 1, b: 2 };
> const next = { ...prev, b: 3 };  // { a: 1, b: 3 }
> // "Copy all of prev, but change b to 3"
> ```
>
> **Computed property (`[name]`):**
> ```typescript
> const name = "title";
> const obj = { [name]: "Hello" };  // { title: "Hello" }
> // The variable's VALUE becomes the key
> ```

  // Special handler for file input
  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      // Create preview URL for displaying the image
      const previewUrl = URL.createObjectURL(file);
      setImagePreview(previewUrl);
    }
  };

  // Form submission handler
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

> 💡 **JS/TS Learning Note — Async/Await**
>
> `async`/`await` makes asynchronous code look synchronous:
>
> ```typescript
> // With async/await (easy to read)
> const handleSubmit = async () => {
>   const result = await submitEvent(data);  // Wait for this to finish
>   console.log(result);                     // Then continue
> };
>
> // What it looks like without async/await (harder to read)
> const handleSubmit = () => {
>   submitEvent(data).then((result) => {
>     console.log(result);
>   });
> };
> ```
>
> **`e.preventDefault()`:**
> Forms normally reload the page when submitted. This stops that behavior
> so we can handle submission with JavaScript instead.
>
> **When to use `async`:**
> - Database operations (Supabase)
> - API calls (fetch)
> - File uploads
> - Anything that takes time and returns a Promise

    // Basic validation (HTML5 handles required fields)
    if (!form.event_type) {
      alert("Please select an event type");
      return;
    }

    // Prepare data for submission
    const eventData = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      event_type: form.event_type as "social" | "class" | "workshop",
      event_date: form.event_date,
      event_time: form.event_time || null,
      location: form.location.trim() || null,
      address: form.address.trim() || null,
      price_type: form.price_type || null,
      price_amount: form.price_amount ? parseFloat(form.price_amount) : null,
      rsvp_link: form.rsvp_link.trim() || null,
      status: "approved" as const, // Events are approved immediately
    };

> 💡 **JS/TS Learning Note — Type Assertions & String Methods**
>
> **`as` keyword (Type Assertion):**
> Tells TypeScript "trust me, I know this is the right type":
> ```typescript
> form.event_type as "social" | "class" | "workshop"
> // "I promise event_type is one of these three strings"
>
> "approved" as const
> // "This is exactly 'approved', not just any string"
> ```
>
> **`.trim()` method:**
> Removes whitespace from both ends of a string:
> ```typescript
> "  hello  ".trim()  // "hello"
> "\n text \n".trim() // "text"
> ```
>
> **`|| null` pattern:**
> If the left side is falsy (empty string, 0, undefined), use null instead:
> ```typescript
> "".trim() || null     // null (empty string is falsy)
> "hello".trim() || null // "hello"
> ```
>
> **`parseFloat()`:**
> Converts a string to a decimal number:
> ```typescript
> parseFloat("25.99")  // 25.99 (number)
> parseFloat("abc")    // NaN (Not a Number)
> ```

    // Call the submission hook
    const success = await submitEvent(eventData, imageFile);

    if (success) {
      // Reset form on success
      setForm(initialFormState);
      setImageFile(null);
      setImagePreview(null);
    }
  };

  // Show success message after submission
  if (isSubmitted) {
    return (
      <div className="submit-event-page">
        <div className="success-card">
          <div className="success-icon">🎉</div>
          <h2>Event Submitted!</h2>
          <p>Your event has been added to the calendar.</p>
          <button
            className="submit-another-btn"
            onClick={() => window.location.reload()}
          >
            Submit Another Event
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="submit-event-page">
      <div className="submit-event-container">
        <div className="submit-event-header">
          <h1>Submit an Event</h1>
          <p>Share your salsa event with the community</p>
        </div>

        <form onSubmit={handleSubmit} className="event-form">
          {/* Error Display */}
          {error && <div className="error-message">{error}</div>}

> 💡 **React Learning Note — Conditional Rendering**
>
> `{error && <div>...</div>}` only renders the div IF `error` is truthy:
>
> ```tsx
> // How && works in JSX:
> {condition && <Component />}
> //    │              └── Only rendered if condition is true
> //    └── If false/null/undefined, nothing renders
>
> // Examples:
> {error && <Error />}        // Shows error only if error exists
> {loading && <Spinner />}    // Shows spinner while loading
> {items.length > 0 && <List />}  // Shows list only if items exist
>
> // Alternative: ternary for if/else
> {loading ? <Spinner /> : <Content />}
> //   │          │              └── Show if false
> //   │          └── Show if true
> //   └── Condition
> ```
>
> **Why not use `if` statements?**
> JSX is expressions, not statements. `if` doesn't return a value, but `&&` and `?:` do.

          {/* Event Title - Required */}
          <div className="form-group">
            <label htmlFor="title">Event Title *</label>
            <input
              type="text"
              id="title"
              name="title"
              value={form.title}
              onChange={handleChange}
              placeholder="e.g., Friday Night Salsa Social"
              maxLength={100}
              required
            />
          </div>

> 💡 **React Learning Note — Controlled Inputs**
>
> In React, form inputs can be **controlled** or **uncontrolled**:
>
> ```tsx
> // CONTROLLED: React state is the "source of truth"
> <input
>   value={form.title}      // Display state value
>   onChange={handleChange}  // Update state on every keystroke
> />
>
> // What happens when user types "H":
> // 1. onChange fires with e.target.value = "H"
> // 2. handleChange calls setForm({ ...form, title: "H" })
> // 3. React re-renders with form.title = "H"
> // 4. Input displays "H"
> ```
>
> **Why controlled inputs?**
> - You always know the current value (it's in state)
> - Easy to validate, transform, or reset the value
> - Form submission just reads from state
>
> **The `htmlFor` attribute:**
> In HTML it's `for`, but `for` is a reserved word in JavaScript.
> React uses `htmlFor` instead. Same with `className` vs `class`.

          {/* Event Type - Required */}
          <div className="form-group">
            <label htmlFor="event_type">Event Type *</label>
            <select
              id="event_type"
              name="event_type"
              value={form.event_type}
              onChange={handleChange}
              required
            >
              <option value="">Select event type</option>
              <option value="social">Social / Party</option>
              <option value="class">Class</option>
              <option value="workshop">Workshop</option>
            </select>
          </div>

          {/* Date and Time Row */}
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="event_date">Date *</label>
              <input
                type="date"
                id="event_date"
                name="event_date"
                value={form.event_date}
                onChange={handleChange}
                min={new Date().toISOString().split("T")[0]} // Prevent past dates
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="event_time">Time</label>
              <input
                type="time"
                id="event_time"
                name="event_time"
                value={form.event_time}
                onChange={handleChange}
              />
            </div>
          </div>

          {/* Description */}
          <div className="form-group">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              name="description"
              value={form.description}
              onChange={handleChange}
              placeholder="Tell us about your event..."
              rows={4}
            />
          </div>

          {/* Location Fields */}
          <div className="form-group">
            <label htmlFor="location">Venue Name</label>
            <input
              type="text"
              id="location"
              name="location"
              value={form.location}
              onChange={handleChange}
              placeholder="e.g., CRG Dance Studio"
            />
          </div>

          <div className="form-group">
            <label htmlFor="address">Address</label>
            <input
              type="text"
              id="address"
              name="address"
              value={form.address}
              onChange={handleChange}
              placeholder="e.g., 123 Main St, Boston, MA 02108"
            />
          </div>

          {/* Price Fields */}
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="price_type">Price</label>
              <select
                id="price_type"
                name="price_type"
                value={form.price_type}
                onChange={handleChange}
              >
                <option value="">Select price type</option>
                <option value="free">Free</option>
                <option value="paid">Paid</option>
              </select>
            </div>
            {form.price_type === "paid" && (
              <div className="form-group">
                <label htmlFor="price_amount">Amount ($)</label>
                <input
                  type="number"
                  id="price_amount"
                  name="price_amount"
                  value={form.price_amount}
                  onChange={handleChange}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                />
              </div>
            )}
          </div>

          {/* RSVP Link */}
          <div className="form-group">
            <label htmlFor="rsvp_link">RSVP / Ticket Link</label>
            <input
              type="url"
              id="rsvp_link"
              name="rsvp_link"
              value={form.rsvp_link}
              onChange={handleChange}
              placeholder="https://..."
            />
          </div>

          {/* Image Upload */}
          <div className="form-group">
            <label htmlFor="image">Event Poster</label>
            <div className="image-upload-area">
              <input
                type="file"
                id="image"
                name="image"
                accept="image/*"
                onChange={handleImageChange}
                className="file-input"
              />
              <label htmlFor="image" className="file-label">
                {imageFile ? imageFile.name : "Choose an image..."}
              </label>
            </div>
            {imagePreview && (
              <div className="image-preview">
                <img src={imagePreview} alt="Preview" />
                <button
                  type="button"
                  className="remove-image"
                  onClick={() => {
                    setImageFile(null);
                    setImagePreview(null);
                  }}
                >
                  ✕ Remove
                </button>
              </div>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="submit-button"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Submitting..." : "Submit Event"}
          </button>
        </form>
      </div>
    </div>
  );
}
````

### Key Learning Points

1. **Controlled Inputs**: Each input's `value` is bound to state, and `onChange` updates that state
2. **Generic onChange Handler**: One function handles all text inputs by using `e.target.name`
3. **Conditional Rendering**: Price amount field only shows when `price_type === "paid"`
4. **File Preview**: `URL.createObjectURL()` creates a temporary URL for previewing selected images
5. **Form Reset**: After successful submission, reset all state to initial values

---

## Step 2: Create the Custom Hook

**What you'll accomplish:**

1. Create a custom hook to handle form submission logic
2. Implement image upload to Supabase Storage
3. Insert event records into the database
4. Handle loading states and error feedback

### Learning Concepts

- **Custom Hooks**: Encapsulate reusable logic with `use` prefix
- **Separation of Concerns**: Keep API/database logic separate from UI
- **Error Handling**: Gracefully handle failures and provide feedback

### Create `src/hooks/useSubmitEvent.ts`

````typescript
import { useState } from "react";
import { supabase } from "../lib/supabase";

// Type for event data we're inserting (without id, created_at)
interface EventInsertData {
  title: string;
  description: string | null;
  event_type: "social" | "class" | "workshop";
  event_date: string;
  event_time: string | null;
  location: string | null;
  address: string | null;
  price_type: string | null;
  price_amount: number | null;
  rsvp_link: string | null;
  status: "approved" | "pending" | "rejected";
}

export function useSubmitEvent() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Upload image to Supabase Storage
   * Returns the public URL of the uploaded image, or null if no image/error
   */
  const uploadImage = async (file: File): Promise<string | null> => {
    // Generate unique filename using timestamp and random string
    const fileExt = file.name.split(".").pop();
    const fileName = `${Date.now()}-${Math.random()
      .toString(36)
      .substring(2)}.${fileExt}`;
    const filePath = `posters/${fileName}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from("event-posters") // bucket name
      .upload(filePath, file, {
        cacheControl: "3600", // Cache for 1 hour
        upsert: false, // Don't overwrite if exists
      });

    if (uploadError) {
      console.error("Image upload error:", uploadError);
      throw new Error(`Failed to upload image: ${uploadError.message}`);
    }

    // Get the public URL for the uploaded file
    const { data: urlData } = supabase.storage
      .from("event-posters")
      .getPublicUrl(filePath);

    return urlData.publicUrl;
  };

  /**
   * Submit event to database
   * Handles image upload first if provided, then inserts event record
   */
  const submitEvent = async (
    eventData: EventInsertData,
    imageFile: File | null
  ): Promise<boolean> => {
    setIsSubmitting(true);
    setError(null);

    try {
      let imageUrl: string | null = null;

> 💡 **JS/TS Learning Note — Try/Catch/Finally**
>
> Error handling in JavaScript:
>
> ```typescript
> try {
>   // Code that might fail
>   const result = await riskyOperation();
> } catch (err) {
>   // Runs ONLY if try block throws an error
>   console.error("Something went wrong:", err);
> } finally {
>   // ALWAYS runs, whether success or failure
>   setLoading(false);  // Clean up
> }
> ```
>
> **Why use this pattern?**
> - Network requests can fail (no internet, server down)
> - Database operations can fail (permissions, constraints)
> - File uploads can fail (too large, wrong type)
>
> **The `finally` block:**
> Perfect for cleanup that should ALWAYS happen:
> - Turn off loading spinners
> - Close connections
> - Reset temporary state

      // Step 1: Upload image if provided
      if (imageFile) {
        imageUrl = await uploadImage(imageFile);
      }

      // Step 2: Prepare event record with image URL
      const eventRecord = {
        ...eventData,
        image_url: imageUrl,
        // Convert date string to ISO timestamp
        event_date: new Date(eventData.event_date).toISOString(),
      };

      // Step 3: Insert into database
      const { error: insertError } = await supabase
        .from("events")
        .insert([eventRecord]);

      if (insertError) {
        throw new Error(`Failed to submit event: ${insertError.message}`);
      }

      // Success!
      setIsSubmitted(true);
      return true;
    } catch (err) {
      // Handle any errors
      const errorMessage =
        err instanceof Error ? err.message : "An unexpected error occurred";
      setError(errorMessage);
      console.error("Event submission error:", err);
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  // Return hook interface
  return {
    submitEvent,
    isSubmitting,
    isSubmitted,
    error,
    // Optional: reset function to clear states
    reset: () => {
      setIsSubmitted(false);
      setError(null);
    },
  };
}
````

### Key Learning Points

1. **Hook Return Object**: Returns functions and state values for the component to use
2. **Async/Await**: Handle asynchronous operations cleanly
3. **Try/Catch/Finally**: Proper error handling pattern
4. **Unique Filenames**: Prevent collisions with timestamp + random string
5. **Two-Step Process**: Upload image first, then insert record with the URL

---

## Step 3: Supabase Storage Setup

**What you'll accomplish:**

1. Create a storage bucket for event poster images
2. Configure public access for the bucket
3. Set up Row Level Security (RLS) policies
4. Test file upload permissions

### Learning Concepts

- **Storage Buckets**: Containers for files in Supabase
- **Row Level Security (RLS)**: Control who can read/write files
- **Public Access**: Allow unauthenticated reads for event posters

### 3.1 Create Storage Bucket

1. Go to your Supabase Dashboard
2. Navigate to **Storage** in the sidebar
3. Click **New bucket**
4. Configure:
   - **Name**: `event-posters`
   - **Public bucket**: ✅ Enable (so images are publicly viewable)
   - **File size limit**: `5MB` (reasonable for event posters)
   - **Allowed MIME types**: `image/*`

### 3.2 Set Storage Policies

In the Supabase Dashboard, go to **Storage → Policies** and add these policies for the `event-posters` bucket:

#### Policy 1: Allow Public Read (for viewing images)

```sql
-- Policy name: "Allow public read access"
-- Applies to: SELECT

CREATE POLICY "Allow public read access"
ON storage.objects
FOR SELECT
USING (bucket_id = 'event-posters');
```

#### Policy 2: Allow Public Upload (for submitting events)

```sql
-- Policy name: "Allow public uploads"
-- Applies to: INSERT

CREATE POLICY "Allow public uploads"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'event-posters'
  AND (storage.foldername(name))[1] = 'posters'
);
```

### 3.3 Alternative: SQL Setup Script

Run this in the SQL Editor if you prefer:

```sql
-- Create the storage bucket (if not using UI)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'event-posters',
  'event-posters',
  true,
  5242880,  -- 5MB in bytes
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Allow public read
CREATE POLICY "Public read for event posters"
ON storage.objects FOR SELECT
USING (bucket_id = 'event-posters');

-- Allow public upload to posters folder
CREATE POLICY "Public upload for event posters"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'event-posters'
  AND (storage.foldername(name))[1] = 'posters'
);
```

### Key Learning Points

1. **Public Buckets**: Files are readable without authentication
2. **Folder Restrictions**: Limit uploads to specific folders for organization
3. **MIME Types**: Restrict to image types for security
4. **Size Limits**: Prevent oversized uploads

---

## Step 4: Add Styling

**What you'll accomplish:**

1. Create page-specific CSS with glassmorphism effects
2. Style form inputs, buttons, and image preview
3. Implement responsive design for mobile devices
4. Match existing app design patterns

### Learning Concepts

- **CSS Variables**: Reuse colors and values across styles
- **Glassmorphism**: Semi-transparent backgrounds with blur
- **Mobile-First**: Responsive design with media queries

### Create `src/pages/SubmitEventPage.css`

```css
/* ============================================
   Submit Event Page Styles
   Following existing glassmorphism patterns
   ============================================ */

.submit-event-page {
  min-height: 100vh;
  padding: 2rem 1rem;
  background: linear-gradient(135deg, #1a252f 0%, #2c3e50 100%);
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding-top: 120px; /* Account for fixed header */
}

.submit-event-container {
  width: 100%;
  max-width: 700px;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  padding: 2rem;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

/* Header */
.submit-event-header {
  text-align: center;
  margin-bottom: 2rem;
}

.submit-event-header h1 {
  color: white;
  font-size: 2rem;
  margin-bottom: 0.5rem;
}

.submit-event-header p {
  color: rgba(255, 255, 255, 0.7);
  font-size: 1.1rem;
}

/* Form Styles */
.event-form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-group label {
  color: white;
  font-weight: 500;
  font-size: 0.95rem;
}

.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 12px 16px;
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.1);
  color: white;
  font-size: 1rem;
  transition: all 0.3s ease;
}

.form-group input::placeholder,
.form-group textarea::placeholder {
  color: rgba(255, 255, 255, 0.5);
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #ff8c42;
  background: rgba(255, 255, 255, 0.15);
}

.form-group select {
  cursor: pointer;
}

.form-group select option {
  background: #2c3e50;
  color: white;
}

/* Form Row (side by side fields) */
.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

@media (max-width: 500px) {
  .form-row {
    grid-template-columns: 1fr;
  }
}

/* Image Upload */
.image-upload-area {
  position: relative;
}

.file-input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
}

.file-label {
  display: block;
  padding: 16px;
  border: 2px dashed rgba(255, 255, 255, 0.3);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.7);
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;
}

.file-label:hover {
  border-color: #ff8c42;
  background: rgba(255, 255, 255, 0.1);
}

.image-preview {
  margin-top: 1rem;
  position: relative;
  display: inline-block;
}

.image-preview img {
  max-width: 100%;
  max-height: 200px;
  border-radius: 10px;
  object-fit: cover;
}

.remove-image {
  position: absolute;
  top: 8px;
  right: 8px;
  background: rgba(231, 76, 60, 0.9);
  color: white;
  border: none;
  border-radius: 50%;
  width: 28px;
  height: 28px;
  cursor: pointer;
  font-size: 0.8rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.3s ease;
}

.remove-image:hover {
  background: #e74c3c;
}

/* Submit Button */
.submit-button {
  width: 100%;
  padding: 14px;
  background: linear-gradient(135deg, #ff8c42, #e74c3c);
  color: white;
  border: none;
  border-radius: 50px;
  font-size: 1.1rem;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s ease;
  margin-top: 1rem;
}

.submit-button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(255, 140, 66, 0.4);
}

.submit-button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

/* Error Message */
.error-message {
  background: rgba(231, 76, 60, 0.2);
  border: 1px solid #e74c3c;
  color: #ff6b6b;
  padding: 12px 16px;
  border-radius: 10px;
  font-size: 0.95rem;
}

/* Success Card */
.success-card {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  padding: 3rem 2rem;
  text-align: center;
  max-width: 400px;
}

.success-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
}

.success-card h2 {
  color: white;
  margin-bottom: 0.5rem;
}

.success-card p {
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 2rem;
}

.submit-another-btn {
  padding: 12px 24px;
  background: transparent;
  border: 2px solid #ff8c42;
  color: #ff8c42;
  border-radius: 50px;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.3s ease;
}

.submit-another-btn:hover {
  background: #ff8c42;
  color: white;
}

/* Responsive */
@media (max-width: 768px) {
  .submit-event-page {
    padding-top: 100px;
  }

  .submit-event-container {
    padding: 1.5rem;
  }

  .submit-event-header h1 {
    font-size: 1.75rem;
  }
}
```

---

## Step 5: Add Routing

**What you'll accomplish:**

1. Add a new route for the submit event page
2. Integrate the page into your existing layout
3. Link to the page from your navigation

### Learning Concepts

- **React Router**: Client-side navigation
- **Nested Routes**: Share layout (header/footer) across pages
- **Lazy Loading**: (Optional) Load page components on demand

### Update `src/App.tsx`

Add the import and route:

```tsx
// Add this import with your other page imports
import SubmitEventPage from "./pages/SubmitEventPage";

// Then add the route inside your <Routes> component, under MainLayout
<Route path="submit-event" element={<SubmitEventPage />} />;
```

### Full Example Context

```tsx
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import MainLayout from "./layouts/MainLayout";
import HomePage from "./pages/HomePage";
import AboutPage from "./pages/AboutPage";
import ContactPage from "./pages/ContactPage";
import CalendarPage from "./pages/CalendarPage";
import SubmitEventPage from "./pages/SubmitEventPage"; // ADD THIS
import Lessons from "./pages/Lessons";
import Instructors from "./pages/Instructors";
import NotFoundPage from "./pages/NotFoundPage";
import ScrollToTop from "./components/Scroll/ScrollToTop";

function App() {
  return (
    <Router>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<HomePage />} />
          <Route path="about" element={<AboutPage />} />
          <Route path="contact" element={<ContactPage />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="submit-event" element={<SubmitEventPage />} />{" "}
          {/* ADD THIS */}
          <Route path="Lessons" element={<Lessons />} />
          <Route path="Instructors" element={<Instructors />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
```

### Add Navigation Link (Optional)

Add a link to your Header or Nav component:

```tsx
<Link to="/submit-event">Submit Event</Link>
```

Or add a CTA button on the Calendar page:

```tsx
<Link to="/submit-event" className="submit-event-cta">
  + Add Your Event
</Link>
```

---

## Step 6: Testing Your Implementation

**What you'll accomplish:**

1. Verify form submission works end-to-end
2. Test image upload to Supabase Storage
3. Confirm database records are created correctly
4. Validate responsive design on mobile devices

### Manual Testing Checklist

- [ ] Navigate to `/submit-event` - page loads without errors
- [ ] Fill required fields only - form submits successfully
- [ ] Fill all fields - form submits successfully
- [ ] Upload an image - preview displays correctly
- [ ] Remove uploaded image - preview clears
- [ ] Submit with image - image appears in Supabase Storage
- [ ] Check database - event record has correct `image_url`
- [ ] View event on calendar - image displays correctly
- [ ] Mobile view - form is responsive and usable
- [ ] Test validation - required fields show HTML5 validation

### Supabase Dashboard Checks

1. **Storage**: Check `event-posters` bucket → `posters` folder for uploaded images
2. **Database**: Query `events` table to see new records
3. **Logs**: Check for any errors in the Supabase logs

### Browser DevTools

- **Network tab**: Watch for successful POST requests
- **Console**: Check for any JavaScript errors
- **Application tab**: Verify environment variables are set

---

## Future: Authentication Integration

When you're ready to add authentication, here's the roadmap:

### Phase 1: Basic Supabase Auth Setup

```typescript
// src/hooks/useAuth.ts
import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { User, Session } from "@supabase/supabase-js";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    return supabase.auth.signInWithPassword({ email, password });
  };

  const signUp = async (email: string, password: string) => {
    return supabase.auth.signUp({ email, password });
  };

  const signOut = async () => {
    return supabase.auth.signOut();
  };

  return { user, session, loading, signIn, signUp, signOut };
}
```

### Phase 2: Protect the Submit Page

```tsx
// src/components/ProtectedRoute.tsx
import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

// Usage in App.tsx
<Route
  path="submit-event"
  element={
    <ProtectedRoute>
      <SubmitEventPage />
    </ProtectedRoute>
  }
/>;
```

### Phase 3: Associate Events with Users

```sql
-- Add user_id column to events table
ALTER TABLE public.events
ADD COLUMN user_id uuid REFERENCES auth.users(id);

-- Update RLS policy to only allow users to insert their own events
DROP POLICY IF EXISTS "Allow public insert" ON public.events;

CREATE POLICY "Users can insert own events"
ON public.events
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own events
CREATE POLICY "Users can update own events"
ON public.events
FOR UPDATE
USING (auth.uid() = user_id);
```

### Phase 4: Update the Hook

```typescript
// In useSubmitEvent.ts, add user_id to the event record
const {
  data: { user },
} = await supabase.auth.getUser();

const eventRecord = {
  ...eventData,
  image_url: imageUrl,
  event_date: new Date(eventData.event_date).toISOString(),
  user_id: user?.id, // Associate with logged-in user
};
```

### Phase 5: Moderation Workflow (Optional)

Change default status from `approved` to `pending`:

```typescript
// In SubmitEventPage.tsx
const eventData = {
  // ... other fields
  status: "pending" as const, // Require admin approval
};
```

Then create an admin dashboard to approve/reject events.

---

## Troubleshooting

### Common Issues

#### "Missing Supabase environment variables"

**Cause**: `.env` file not configured or not loaded
**Solution**:

1. Create `.env` file in project root
2. Add `VITE_SUPABASE_URL=your_url` and `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY=your_key`
3. Restart dev server (`npm run dev`)

#### "Failed to upload image: row-level security policy"

**Cause**: Storage policies not configured
**Solution**: Follow [Step 3: Supabase Storage Setup](#step-3-supabase-storage-setup)

#### "Failed to submit event: row-level security policy"

**Cause**: Database RLS policies blocking inserts
**Solution**: Add INSERT policy for events table:

```sql
CREATE POLICY "Allow public insert" ON public.events
FOR INSERT WITH CHECK (true);
```

#### Image uploads work but URL is broken

**Cause**: Bucket not public
**Solution**: In Supabase Dashboard → Storage → Bucket settings → Enable "Public bucket"

#### Form submits but page doesn't show success

**Cause**: Error in submission not being caught
**Solution**: Check browser console for errors, verify Supabase connection

---

## Quick Reference

### File Structure

```
src/
├── pages/
│   ├── SubmitEventPage.tsx    # Form component
│   └── SubmitEventPage.css    # Styles
├── hooks/
│   └── useSubmitEvent.ts      # Submission logic
├── lib/
│   └── supabase.ts            # Client (existing)
├── types/
│   └── events.ts              # Types (existing)
└── App.tsx                    # Add route here
```

### Supabase Setup Checklist

- [ ] Storage bucket `event-posters` created
- [ ] Bucket set to public
- [ ] SELECT policy for public read
- [ ] INSERT policy for public upload
- [ ] Events table INSERT policy allows public inserts

### Form Fields Reference

| Field        | Input Type | Required | DB Column      |
| ------------ | ---------- | -------- | -------------- |
| Event Title  | text       | ✅       | `title`        |
| Event Type   | select     | ✅       | `event_type`   |
| Date         | date       | ✅       | `event_date`   |
| Time         | time       |          | `event_time`   |
| Description  | textarea   |          | `description`  |
| Venue        | text       |          | `location`     |
| Address      | text       |          | `address`      |
| Price Type   | select     |          | `price_type`   |
| Price Amount | number     |          | `price_amount` |
| RSVP Link    | url        |          | `rsvp_link`    |
| Poster Image | file       |          | `image_url`    |

### Key Imports

```typescript
// For the page component
import { useState, FormEvent, ChangeEvent } from "react";
import { useSubmitEvent } from "../hooks/useSubmitEvent";

// For the hook
import { supabase } from "../lib/supabase";

// For routing
import SubmitEventPage from "./pages/SubmitEventPage";
```

---

## Next Steps

After implementing the basic event submission:

1. **Add form validation library** (Zod, Yup) for better error messages
2. **Add rich text editor** for event description
3. **Implement image cropping** before upload
4. **Add event preview** before submission
5. **Implement authentication** per the future auth section
6. **Create admin dashboard** for event moderation
7. **Add email notifications** when events are submitted

---

_Guide created for the Salsa Community Events Platform_
_Last updated: February 2026_
