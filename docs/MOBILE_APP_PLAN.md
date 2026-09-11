# Salsa Segura Mobile App Development Plan

> **Strategy:** Separate project now → Monorepo after Phase 4
> **Timeline:** Parallel development with web app
> **Stack:** React Native + Expo + Supabase (shared backend)

---

## Table of Contents

1. [Overview & Strategy](#overview--strategy)
2. [Phase M1: Project Setup](#phase-m1-project-setup-week-1)
3. [Phase M2: Core Screens](#phase-m2-core-screens-weeks-2-3)
4. [Phase M3: Calendar Views](#phase-m3-calendar-views-weeks-4-5)
5. [Phase M4: Event Details & Interactions](#phase-m4-event-details--interactions-week-6)
6. [Phase M5: Mobile-Specific Features](#phase-m5-mobile-specific-features-weeks-7-8)
7. [Phase M6: Monorepo Migration](#phase-m6-monorepo-migration-after-web-phase-4)
8. [Shared Code Inventory](#shared-code-inventory)
9. [Environment Setup](#environment-setup)
10. [Testing Strategy](#testing-strategy)
11. [Deployment](#deployment)

---

## Overview & Strategy

### Why Separate Projects First?

| Approach                | Pros                                                      | Cons                                           |
| ----------------------- | --------------------------------------------------------- | ---------------------------------------------- |
| **Separate (chosen)**   | Faster to start, simpler tooling, independent deployments | Code duplication temporarily                   |
| **Monorepo from start** | Code sharing from day 1                                   | Complex setup, learning curve, blocks progress |

**Decision:** Start separate, consolidate when both apps are stable (after web Phase 4).

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     SUPABASE CLOUD                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  PostgreSQL │  │   Storage   │  │   Auth (Phase 5)    │  │
│  │   Database  │  │   Buckets   │  │                     │  │
│  │             │  │             │  │                     │  │
│  │  events     │  │  event-     │  │  users              │  │
│  │  table      │  │  posters    │  │  sessions           │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
           │                              │
           │      Same API calls          │
           ▼                              ▼
┌─────────────────────┐        ┌─────────────────────┐
│    WEB APP          │        │    MOBILE APP       │
│    (React + Vite)   │        │    (React Native)   │
│                     │        │                     │
│  /Salsa/            │        │  /salsasegura-      │
│    src/             │        │   mobile/           │
│      hooks/         │        │     src/            │
│      types/         │        │       hooks/        │
│      lib/           │        │       types/        │
│                     │        │       lib/          │
└─────────────────────┘        └─────────────────────┘
           │                              │
           └──────────┬───────────────────┘
                      │
                      ▼
        ┌─────────────────────────┐
        │   AFTER PHASE 4:        │
        │   MONOREPO STRUCTURE    │
        │                         │
        │   /salsasegura/         │
        │     /packages/          │
        │       /shared/          │
        │       /web/             │
        │       /mobile/          │
        └─────────────────────────┘
```

### Timeline Overview

| Phase   | Web App            | Mobile App         | Duration |
| ------- | ------------------ | ------------------ | -------- |
| Current | Phase 3 (Supabase) | —                  | —        |
| **M1**  | Phase 3 continues  | Project setup      | 1 week   |
| **M2**  | Phase 3-4          | Core screens       | 2 weeks  |
| **M3**  | Phase 4            | Calendar views     | 2 weeks  |
| **M4**  | Phase 4            | Event details      | 1 week   |
| **M5**  | Phase 5 (Auth)     | Mobile features    | 2 weeks  |
| **M6**  | Stable             | Monorepo migration | 1 week   |

---

## Phase M1: Project Setup (Week 1)

### M1.1: Create Expo Project

```bash
# Navigate to parent directory of your web project
cd /Users/roosevelt/work

# Create new Expo project with TypeScript
npx create-expo-app@latest salsasegura-mobile --template blank-typescript

# Navigate into project
cd salsasegura-mobile

# Install core dependencies
npx expo install @supabase/supabase-js
npx expo install @react-native-async-storage/async-storage
npx expo install react-native-url-polyfill
```

### M1.2: Install Navigation

```bash
# Core navigation
npx expo install @react-navigation/native
npx expo install @react-navigation/native-stack
npx expo install @react-navigation/bottom-tabs

# Required peer dependencies
npx expo install react-native-screens react-native-safe-area-context
```

### M1.3: Install Calendar Libraries

```bash
# For day/week agenda view (highly recommended)
npx expo install @howljs/calendar-kit

# For month view with marked dates
npx expo install react-native-calendars

# Required for gestures
npx expo install react-native-gesture-handler react-native-reanimated
```

### M1.4: Project Structure

Create this folder structure:

```
salsasegura-mobile/
├── app.json                    # Expo config
├── App.tsx                     # Entry point
├── babel.config.js
├── tsconfig.json
├── .env                        # Environment variables (gitignored!)
├── .env.example                # Template for env vars
├── src/
│   ├── components/
│   │   ├── EventCard.tsx       # Event list item
│   │   ├── EventModal.tsx      # Event detail modal
│   │   ├── LoadingSpinner.tsx
│   │   └── ErrorMessage.tsx
│   ├── screens/
│   │   ├── HomeScreen.tsx      # Event list
│   │   ├── CalendarScreen.tsx  # Calendar views
│   │   ├── EventDetailScreen.tsx
│   │   ├── SettingsScreen.tsx
│   │   └── index.ts            # Export all screens
│   ├── navigation/
│   │   ├── AppNavigator.tsx    # Main navigation setup
│   │   ├── TabNavigator.tsx    # Bottom tab navigation
│   │   └── types.ts            # Navigation type definitions
│   ├── hooks/
│   │   ├── useSupabaseEvents.ts  # 📋 COPY from web
│   │   ├── useEvents.ts          # 📋 COPY from web
│   │   └── useRefresh.ts         # Pull-to-refresh hook
│   ├── lib/
│   │   └── supabase.ts           # 📋 ADAPT from web
│   ├── types/
│   │   └── events.ts             # 📋 COPY from web
│   ├── utils/
│   │   ├── dateFormatters.ts     # Date display helpers
│   │   └── colors.ts             # App color palette
│   └── constants/
│       └── theme.ts              # Design tokens
└── assets/
    ├── icon.png
    ├── splash.png
    └── adaptive-icon.png
```

### M1.5: Environment Variables

Create `.env` file:

```bash
# Supabase Configuration (same values as web app!)
EXPO_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

Create `.env.example` (for git):

```bash
# Supabase Configuration
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

Add to `.gitignore`:

```
.env
.env.local
.env*.local
```

### M1.6: Supabase Client Setup

Create `src/lib/supabase.ts`:

```typescript
import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // Important for React Native
  },
});

export default supabase;
```

**Key differences from web:**

| Web Version                | Mobile Version                       |
| -------------------------- | ------------------------------------ |
| `import.meta.env.VITE_*`   | `process.env.EXPO_PUBLIC_*`          |
| Browser localStorage       | AsyncStorage                         |
| No URL polyfill needed     | `react-native-url-polyfill` required |
| `detectSessionInUrl: true` | `detectSessionInUrl: false`          |

### M1.7: Copy Shared Types

Copy `src/types/events.ts` from web project — **no changes needed!**

```typescript
// src/types/events.ts — IDENTICAL to web version

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

export interface ScheduleXEvent {
  id: string | number;
  title: string;
  start: string;
  end: string;
  calendarId: EventType;
  location?: string;
  description?: string;
  address?: string;
  rsvpLink?: string;
}

// Conversion function — also works in React Native
export function databaseEventToScheduleX(event: DatabaseEvent): ScheduleXEvent {
  const startDate = new Date(event.event_date);
  const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000); // +2 hours default

  return {
    id: event.id,
    title: event.title,
    start: formatDateTimeForScheduleX(startDate),
    end: formatDateTimeForScheduleX(endDate),
    calendarId: event.event_type,
    location: event.location ?? undefined,
    description: event.description ?? undefined,
    address: event.address ?? undefined,
    rsvpLink: event.rsvp_link ?? undefined,
  };
}

function formatDateTimeForScheduleX(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}
```

### M1.8: Copy Shared Hooks

Copy `src/hooks/useSupabaseEvents.ts` — **no changes needed!**

```typescript
// src/hooks/useSupabaseEvents.ts — IDENTICAL to web version

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import {
  DatabaseEvent,
  ScheduleXEvent,
  databaseEventToScheduleX,
} from "../types/events";

export function useSupabaseEvents() {
  const [events, setEvents] = useState<ScheduleXEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchEvents() {
      try {
        setLoading(true);
        setError(null);

        const { data, error: queryError } = await supabase
          .from("events")
          .select("*")
          .eq("status", "approved")
          .gte("event_date", new Date().toISOString())
          .order("event_date", { ascending: true });

        if (queryError) throw queryError;

        const transformedEvents = (data as DatabaseEvent[]).map(
          databaseEventToScheduleX
        );

        setEvents(transformedEvents);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch events");
      } finally {
        setLoading(false);
      }
    }

    fetchEvents();
  }, []);

  return { events, loading, error };
}
```

### M1.9: Checkpoint — Verify Setup

```bash
# Start Expo development server
npx expo start

# Test on:
# - iOS Simulator (press 'i')
# - Android Emulator (press 'a')
# - Expo Go app on physical device (scan QR)
```

**Success criteria:**

- [ ] App launches without errors
- [ ] No TypeScript errors
- [ ] Supabase client initializes (check console)
- [ ] Environment variables load correctly

---

## Phase M2: Core Screens (Weeks 2-3)

### M2.1: Navigation Setup

Create `src/navigation/types.ts`:

```typescript
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { ScheduleXEvent } from "../types/events";

// Root stack (includes modals)
export type RootStackParamList = {
  Main: undefined;
  EventDetail: { event: ScheduleXEvent };
  Settings: undefined;
};

// Bottom tabs
export type TabParamList = {
  Home: undefined;
  Calendar: undefined;
  Search: undefined;
};

// Screen props types
export type HomeScreenProps = BottomTabScreenProps<TabParamList, "Home">;
export type CalendarScreenProps = BottomTabScreenProps<
  TabParamList,
  "Calendar"
>;
export type EventDetailScreenProps = NativeStackScreenProps<
  RootStackParamList,
  "EventDetail"
>;
```

Create `src/navigation/TabNavigator.tsx`:

```typescript
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import HomeScreen from "../screens/HomeScreen";
import CalendarScreen from "../screens/CalendarScreen";
import SearchScreen from "../screens/SearchScreen";
import { TabParamList } from "./types";

const Tab = createBottomTabNavigator<TabParamList>();

export default function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap;

          switch (route.name) {
            case "Home":
              iconName = focused ? "home" : "home-outline";
              break;
            case "Calendar":
              iconName = focused ? "calendar" : "calendar-outline";
              break;
            case "Search":
              iconName = focused ? "search" : "search-outline";
              break;
            default:
              iconName = "ellipse";
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: "#e63946", // Salsa red
        tabBarInactiveTintColor: "gray",
        headerShown: false,
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Calendar" component={CalendarScreen} />
      <Tab.Screen name="Search" component={SearchScreen} />
    </Tab.Navigator>
  );
}
```

Create `src/navigation/AppNavigator.tsx`:

```typescript
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import TabNavigator from "./TabNavigator";
import EventDetailScreen from "../screens/EventDetailScreen";
import SettingsScreen from "../screens/SettingsScreen";
import { RootStackParamList } from "./types";

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen
          name="Main"
          component={TabNavigator}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="EventDetail"
          component={EventDetailScreen}
          options={{
            presentation: "modal",
            headerTitle: "Event Details",
          }}
        />
        <Stack.Screen
          name="Settings"
          component={SettingsScreen}
          options={{ headerTitle: "Settings" }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
```

### M2.2: Home Screen (Event List)

Create `src/screens/HomeScreen.tsx`:

```typescript
import React from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useEvents } from "../hooks/useEvents";
import { RootStackParamList } from "../navigation/types";
import { ScheduleXEvent } from "../types/events";
import EventCard from "../components/EventCard";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorMessage from "../components/ErrorMessage";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function HomeScreen() {
  const { events, loading, error, refetch } = useEvents();
  const [refreshing, setRefreshing] = React.useState(false);
  const navigation = useNavigation<NavigationProp>();

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleEventPress = (event: ScheduleXEvent) => {
    navigation.navigate("EventDetail", { event });
  };

  if (loading && !refreshing) {
    return <LoadingSpinner message="Loading events..." />;
  }

  if (error) {
    return <ErrorMessage message={error} onRetry={refetch} />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Upcoming Events</Text>
        <Text style={styles.subtitle}>Boston Salsa & Bachata</Text>
      </View>

      <FlatList
        data={events}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <EventCard event={item} onPress={() => handleEventPress(item)} />
        )}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No upcoming events</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#1a1a1a",
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    marginTop: 4,
  },
  listContent: {
    padding: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: "#999",
  },
});
```

### M2.3: Event Card Component

Create `src/components/EventCard.tsx`:

```typescript
import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ScheduleXEvent } from "../types/events";

interface EventCardProps {
  event: ScheduleXEvent;
  onPress: () => void;
}

const EVENT_COLORS = {
  social: "#e63946",
  class: "#457b9d",
  workshop: "#2a9d8f",
};

export default function EventCard({ event, onPress }: EventCardProps) {
  const eventDate = new Date(event.start.replace(" ", "T"));

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const typeColor = EVENT_COLORS[event.calendarId] || "#666";

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.typeIndicator, { backgroundColor: typeColor }]} />

      <View style={styles.content}>
        <View style={styles.dateTimeRow}>
          <Text style={styles.date}>{formatDate(eventDate)}</Text>
          <Text style={styles.time}>{formatTime(eventDate)}</Text>
        </View>

        <Text style={styles.title} numberOfLines={2}>
          {event.title}
        </Text>

        {event.location && (
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={14} color="#666" />
            <Text style={styles.location} numberOfLines={1}>
              {event.location}
            </Text>
          </View>
        )}

        <View style={styles.typeTag}>
          <Text style={[styles.typeText, { color: typeColor }]}>
            {event.calendarId.toUpperCase()}
          </Text>
        </View>
      </View>

      <Ionicons name="chevron-forward" size={20} color="#ccc" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    marginBottom: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  typeIndicator: {
    width: 4,
    height: "100%",
    borderRadius: 2,
    marginRight: 12,
  },
  content: {
    flex: 1,
  },
  dateTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  date: {
    fontSize: 12,
    color: "#666",
    fontWeight: "600",
  },
  time: {
    fontSize: 12,
    color: "#999",
    marginLeft: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1a1a1a",
    marginBottom: 4,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  location: {
    fontSize: 13,
    color: "#666",
    marginLeft: 4,
    flex: 1,
  },
  typeTag: {
    alignSelf: "flex-start",
  },
  typeText: {
    fontSize: 10,
    fontWeight: "bold",
    letterSpacing: 0.5,
  },
});
```

### M2.4: Update useEvents Hook with Refetch

Create `src/hooks/useEvents.ts`:

```typescript
import { useState, useCallback } from "react";
import { useSupabaseEvents } from "./useSupabaseEvents";

export function useEvents() {
  const { events, loading, error } = useSupabaseEvents();
  const [refreshKey, setRefreshKey] = useState(0);

  // Force refetch by changing the key
  const refetch = useCallback(() => {
    setRefreshKey((prev) => prev + 1);
  }, []);

  return { events, loading, error, refetch };
}
```

**Note:** For a more robust solution, you'd modify `useSupabaseEvents` to expose a `refetch` function. This is a simple wrapper for now.

### M2.5: Loading & Error Components

Create `src/components/LoadingSpinner.tsx`:

```typescript
import React from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";

interface LoadingSpinnerProps {
  message?: string;
}

export default function LoadingSpinner({ message = "Loading..." }: LoadingSpinnerProps) {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#e63946" />
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  message: {
    marginTop: 16,
    fontSize: 16,
    color: "#666",
  },
});
```

Create `src/components/ErrorMessage.tsx`:

```typescript
import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface ErrorMessageProps {
  message: string;
  onRetry?: () => void;
}

export default function ErrorMessage({ message, onRetry }: ErrorMessageProps) {
  return (
    <View style={styles.container}>
      <Ionicons name="alert-circle-outline" size={48} color="#e63946" />
      <Text style={styles.title}>Something went wrong</Text>
      <Text style={styles.message}>{message}</Text>
      {onRetry && (
        <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
          <Text style={styles.retryText}>Try Again</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1a1a1a",
    marginTop: 16,
  },
  message: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginTop: 8,
  },
  retryButton: {
    marginTop: 24,
    backgroundColor: "#e63946",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
```

### M2.6: Update App Entry Point

Update `App.tsx`:

```typescript
import React from "react";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import AppNavigator from "./src/navigation/AppNavigator";

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="dark" />
      <AppNavigator />
    </GestureHandlerRootView>
  );
}
```

### M2.7: Checkpoint — Core Screens

**Success criteria:**

- [ ] App launches with bottom tab navigation
- [ ] Home screen shows list of events from Supabase
- [ ] Pull-to-refresh works
- [ ] Event cards display correctly
- [ ] Loading and error states work
- [ ] Tapping event navigates to detail (placeholder for now)

---

## Phase M3: Calendar Views (Weeks 4-5)

### M3.1: Month View with react-native-calendars

Create `src/components/MonthCalendar.tsx`:

```typescript
import React from "react";
import { View, StyleSheet } from "react-native";
import { Calendar, DateData } from "react-native-calendars";
import { ScheduleXEvent } from "../types/events";

interface MonthCalendarProps {
  events: ScheduleXEvent[];
  onDayPress: (date: DateData) => void;
  selectedDate?: string;
}

const EVENT_DOT_COLORS = {
  social: "#e63946",
  class: "#457b9d",
  workshop: "#2a9d8f",
};

export default function MonthCalendar({
  events,
  onDayPress,
  selectedDate,
}: MonthCalendarProps) {
  // Create marked dates object
  const markedDates = React.useMemo(() => {
    const marks: Record<string, any> = {};

    events.forEach((event) => {
      const dateStr = event.start.split(" ")[0]; // "YYYY-MM-DD"
      const dotColor = EVENT_DOT_COLORS[event.calendarId] || "#666";

      if (!marks[dateStr]) {
        marks[dateStr] = { dots: [], marked: true };
      }

      // Add dot if not already present for this type
      const hasType = marks[dateStr].dots.some(
        (d: any) => d.color === dotColor
      );
      if (!hasType) {
        marks[dateStr].dots.push({ color: dotColor });
      }
    });

    // Mark selected date
    if (selectedDate) {
      marks[selectedDate] = {
        ...marks[selectedDate],
        selected: true,
        selectedColor: "#e63946",
      };
    }

    return marks;
  }, [events, selectedDate]);

  return (
    <View style={styles.container}>
      <Calendar
        markingType="multi-dot"
        markedDates={markedDates}
        onDayPress={onDayPress}
        theme={{
          todayTextColor: "#e63946",
          arrowColor: "#e63946",
          dotColor: "#e63946",
          selectedDayBackgroundColor: "#e63946",
          textDayFontWeight: "500",
          textMonthFontWeight: "bold",
          textDayHeaderFontWeight: "600",
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#fff",
  },
});
```

### M3.2: Week/Day View with @howljs/calendar-kit

Create `src/components/WeekCalendar.tsx`:

```typescript
import React from "react";
import { View, StyleSheet, Text } from "react-native";
import {
  CalendarContainer,
  CalendarHeader,
  CalendarBody,
  EventItem,
} from "@howljs/calendar-kit";
import { ScheduleXEvent } from "../types/events";

interface WeekCalendarProps {
  events: ScheduleXEvent[];
  onEventPress: (event: ScheduleXEvent) => void;
}

const EVENT_COLORS = {
  social: "#e63946",
  class: "#457b9d",
  workshop: "#2a9d8f",
};

export default function WeekCalendar({ events, onEventPress }: WeekCalendarProps) {
  // Transform events for calendar-kit format
  const calendarEvents = React.useMemo(() => {
    return events.map((event) => ({
      id: String(event.id),
      title: event.title,
      start: new Date(event.start.replace(" ", "T")),
      end: new Date(event.end.replace(" ", "T")),
      color: EVENT_COLORS[event.calendarId] || "#666",
      // Store original event for press handler
      _original: event,
    }));
  }, [events]);

  const renderEvent = (event: any) => (
    <EventItem
      event={event}
      onPress={() => onEventPress(event._original)}
      style={{ backgroundColor: event.color, borderRadius: 4 }}
    >
      <Text style={styles.eventTitle} numberOfLines={2}>
        {event.title}
      </Text>
    </EventItem>
  );

  return (
    <View style={styles.container}>
      <CalendarContainer
        numberOfDays={7}
        scrollByDay={true}
        events={calendarEvents}
      >
        <CalendarHeader />
        <CalendarBody renderEvent={renderEvent} />
      </CalendarContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  eventTitle: {
    fontSize: 12,
    color: "#fff",
    fontWeight: "500",
    padding: 4,
  },
});
```

### M3.3: Calendar Screen with View Toggle

Create `src/screens/CalendarScreen.tsx`:

```typescript
import React, { useState } from "react";
import { View, StyleSheet, Text, TouchableOpacity, FlatList } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { DateData } from "react-native-calendars";
import { useEvents } from "../hooks/useEvents";
import { ScheduleXEvent } from "../types/events";
import { RootStackParamList } from "../navigation/types";
import MonthCalendar from "../components/MonthCalendar";
import WeekCalendar from "../components/WeekCalendar";
import EventCard from "../components/EventCard";
import LoadingSpinner from "../components/LoadingSpinner";

type ViewMode = "month" | "week";
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function CalendarScreen() {
  const { events, loading } = useEvents();
  const navigation = useNavigation<NavigationProp>();
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [selectedDate, setSelectedDate] = useState<string | undefined>();

  const handleDayPress = (date: DateData) => {
    setSelectedDate(date.dateString);
  };

  const handleEventPress = (event: ScheduleXEvent) => {
    navigation.navigate("EventDetail", { event });
  };

  // Filter events for selected date
  const eventsForSelectedDate = React.useMemo(() => {
    if (!selectedDate) return [];
    return events.filter((event) => event.start.startsWith(selectedDate));
  }, [events, selectedDate]);

  if (loading) {
    return <LoadingSpinner message="Loading calendar..." />;
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* View Toggle */}
      <View style={styles.toggleContainer}>
        <TouchableOpacity
          style={[
            styles.toggleButton,
            viewMode === "month" && styles.toggleButtonActive,
          ]}
          onPress={() => setViewMode("month")}
        >
          <Text
            style={[
              styles.toggleText,
              viewMode === "month" && styles.toggleTextActive,
            ]}
          >
            Month
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.toggleButton,
            viewMode === "week" && styles.toggleButtonActive,
          ]}
          onPress={() => setViewMode("week")}
        >
          <Text
            style={[
              styles.toggleText,
              viewMode === "week" && styles.toggleTextActive,
            ]}
          >
            Week
          </Text>
        </TouchableOpacity>
      </View>

      {/* Calendar View */}
      {viewMode === "month" ? (
        <View style={styles.monthContainer}>
          <MonthCalendar
            events={events}
            onDayPress={handleDayPress}
            selectedDate={selectedDate}
          />

          {/* Events for selected date */}
          {selectedDate && (
            <View style={styles.selectedDateEvents}>
              <Text style={styles.selectedDateTitle}>
                Events on {selectedDate}
              </Text>
              {eventsForSelectedDate.length > 0 ? (
                <FlatList
                  data={eventsForSelectedDate}
                  keyExtractor={(item) => String(item.id)}
                  renderItem={({ item }) => (
                    <EventCard
                      event={item}
                      onPress={() => handleEventPress(item)}
                    />
                  )}
                />
              ) : (
                <Text style={styles.noEventsText}>No events on this day</Text>
              )}
            </View>
          )}
        </View>
      ) : (
        <WeekCalendar events={events} onEventPress={handleEventPress} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  toggleContainer: {
    flexDirection: "row",
    padding: 8,
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    margin: 16,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 6,
  },
  toggleButtonActive: {
    backgroundColor: "#e63946",
  },
  toggleText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
  },
  toggleTextActive: {
    color: "#fff",
  },
  monthContainer: {
    flex: 1,
  },
  selectedDateEvents: {
    flex: 1,
    padding: 16,
  },
  selectedDateTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 12,
    color: "#1a1a1a",
  },
  noEventsText: {
    fontSize: 14,
    color: "#999",
    textAlign: "center",
    marginTop: 20,
  },
});
```

### M3.4: Checkpoint — Calendar Views

**Success criteria:**

- [ ] Month view displays with event dots
- [ ] Week view displays event blocks
- [ ] View toggle switches between month/week
- [ ] Tapping a day shows events for that date
- [ ] Tapping an event opens detail modal
- [ ] Calendar scrolls smoothly

---

## Phase M4: Event Details & Interactions (Week 6)

### M4.1: Event Detail Screen

Create `src/screens/EventDetailScreen.tsx`:

```typescript
import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Share,
  Alert,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { EventDetailScreenProps } from "../navigation/types";

const EVENT_COLORS = {
  social: "#e63946",
  class: "#457b9d",
  workshop: "#2a9d8f",
};

export default function EventDetailScreen({ route }: EventDetailScreenProps) {
  const { event } = route.params;
  const eventDate = new Date(event.start.replace(" ", "T"));
  const typeColor = EVENT_COLORS[event.calendarId] || "#666";

  const formatFullDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const handleOpenMaps = () => {
    if (event.address) {
      const url = `https://maps.google.com/?q=${encodeURIComponent(event.address)}`;
      Linking.openURL(url);
    }
  };

  const handleOpenRSVP = () => {
    if (event.rsvpLink) {
      Linking.openURL(event.rsvpLink);
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        title: event.title,
        message: `Check out this event: ${event.title}\n${formatFullDate(eventDate)} at ${formatTime(eventDate)}\n${event.location || ""}`,
      });
    } catch (error) {
      Alert.alert("Error", "Failed to share event");
    }
  };

  const handleAddToCalendar = () => {
    // TODO: Implement calendar integration
    Alert.alert("Coming Soon", "Add to calendar feature will be available soon!");
  };

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Event Type Badge */}
        <View style={[styles.typeBadge, { backgroundColor: typeColor }]}>
          <Text style={styles.typeText}>
            {event.calendarId.toUpperCase()}
          </Text>
        </View>

        {/* Title */}
        <Text style={styles.title}>{event.title}</Text>

        {/* Date & Time */}
        <View style={styles.infoRow}>
          <Ionicons name="calendar-outline" size={20} color="#666" />
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>Date</Text>
            <Text style={styles.infoValue}>{formatFullDate(eventDate)}</Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <Ionicons name="time-outline" size={20} color="#666" />
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>Time</Text>
            <Text style={styles.infoValue}>{formatTime(eventDate)}</Text>
          </View>
        </View>

        {/* Location */}
        {event.location && (
          <TouchableOpacity style={styles.infoRow} onPress={handleOpenMaps}>
            <Ionicons name="location-outline" size={20} color="#666" />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Location</Text>
              <Text style={styles.infoValue}>{event.location}</Text>
              {event.address && (
                <Text style={styles.infoSubvalue}>{event.address}</Text>
              )}
            </View>
            <Ionicons name="open-outline" size={16} color="#999" />
          </TouchableOpacity>
        )}

        {/* Description */}
        {event.description && (
          <View style={styles.descriptionContainer}>
            <Text style={styles.descriptionLabel}>About</Text>
            <Text style={styles.description}>{event.description}</Text>
          </View>
        )}
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.actionContainer}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleAddToCalendar}
        >
          <Ionicons name="calendar-outline" size={20} color="#e63946" />
          <Text style={styles.actionButtonText}>Add to Calendar</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
          <Ionicons name="share-outline" size={20} color="#e63946" />
          <Text style={styles.actionButtonText}>Share</Text>
        </TouchableOpacity>

        {event.rsvpLink && (
          <TouchableOpacity
            style={[styles.actionButton, styles.primaryButton]}
            onPress={handleOpenRSVP}
          >
            <Ionicons name="ticket-outline" size={20} color="#fff" />
            <Text style={[styles.actionButtonText, styles.primaryButtonText]}>
              RSVP
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  scrollContent: {
    padding: 20,
  },
  typeBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 12,
  },
  typeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1a1a1a",
    marginBottom: 24,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  infoContent: {
    flex: 1,
    marginLeft: 12,
  },
  infoLabel: {
    fontSize: 12,
    color: "#999",
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 16,
    color: "#1a1a1a",
    fontWeight: "500",
  },
  infoSubvalue: {
    fontSize: 14,
    color: "#666",
    marginTop: 2,
  },
  descriptionContainer: {
    marginTop: 8,
  },
  descriptionLabel: {
    fontSize: 12,
    color: "#999",
    marginBottom: 8,
  },
  description: {
    fontSize: 15,
    color: "#333",
    lineHeight: 22,
  },
  actionContainer: {
    flexDirection: "row",
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#eee",
    backgroundColor: "#fff",
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    marginHorizontal: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e63946",
  },
  actionButtonText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: "600",
    color: "#e63946",
  },
  primaryButton: {
    backgroundColor: "#e63946",
    borderColor: "#e63946",
  },
  primaryButtonText: {
    color: "#fff",
  },
});
```

### M4.2: Checkpoint — Event Details

**Success criteria:**

- [ ] Event detail modal opens from list and calendar
- [ ] All event information displays correctly
- [ ] "Open in Maps" works
- [ ] Share functionality works
- [ ] RSVP link opens in browser

---

## Phase M5: Mobile-Specific Features (Weeks 7-8)

### M5.1: Push Notifications Setup

```bash
npx expo install expo-notifications expo-device expo-constants
```

Create `src/services/notifications.ts`:

```typescript
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForPushNotifications() {
  let token;

  if (!Device.isDevice) {
    console.log("Push notifications require a physical device");
    return;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.log("Push notification permission not granted");
    return;
  }

  token = (
    await Notifications.getExpoPushTokenAsync({
      projectId: Constants.expoConfig?.extra?.eas?.projectId,
    })
  ).data;

  if (Platform.OS === "android") {
    Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
    });
  }

  return token;
}

export async function scheduleEventReminder(
  eventId: string,
  eventTitle: string,
  eventDate: Date,
  reminderMinutes: number = 60
) {
  const reminderDate = new Date(
    eventDate.getTime() - reminderMinutes * 60 * 1000
  );

  if (reminderDate <= new Date()) {
    console.log("Event is too soon for reminder");
    return;
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Event Reminder 💃",
      body: `${eventTitle} starts in ${reminderMinutes} minutes!`,
      data: { eventId },
    },
    trigger: {
      date: reminderDate,
    },
  });
}
```

### M5.2: Add to Device Calendar

```bash
npx expo install expo-calendar
```

Create `src/services/calendar.ts`:

```typescript
import * as Calendar from "expo-calendar";
import { Platform } from "react-native";
import { ScheduleXEvent } from "../types/events";

export async function requestCalendarPermissions(): Promise<boolean> {
  const { status } = await Calendar.requestCalendarPermissionsAsync();
  return status === "granted";
}

export async function addEventToDeviceCalendar(
  event: ScheduleXEvent
): Promise<string | null> {
  const hasPermission = await requestCalendarPermissions();

  if (!hasPermission) {
    throw new Error("Calendar permission not granted");
  }

  const calendars = await Calendar.getCalendarsAsync(
    Calendar.EntityTypes.EVENT
  );

  // Get default calendar
  const defaultCalendar = calendars.find((cal) =>
    Platform.OS === "ios"
      ? cal.source.name === "iCloud" || cal.source.name === "Default"
      : cal.accessLevel === Calendar.CalendarAccessLevel.OWNER
  );

  if (!defaultCalendar) {
    throw new Error("No writable calendar found");
  }

  const startDate = new Date(event.start.replace(" ", "T"));
  const endDate = new Date(event.end.replace(" ", "T"));

  const eventId = await Calendar.createEventAsync(defaultCalendar.id, {
    title: event.title,
    startDate,
    endDate,
    location: event.address || event.location || undefined,
    notes: event.description || undefined,
    timeZone: "America/New_York", // Boston timezone
  });

  return eventId;
}
```

### M5.3: Location-Based Filtering (Optional)

```bash
npx expo install expo-location
```

Create `src/hooks/useLocation.ts`:

```typescript
import { useState, useEffect } from "react";
import * as Location from "expo-location";

interface LocationState {
  latitude: number | null;
  longitude: number | null;
  loading: boolean;
  error: string | null;
}

export function useLocation() {
  const [location, setLocation] = useState<LocationState>({
    latitude: null,
    longitude: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        setLocation((prev) => ({
          ...prev,
          loading: false,
          error: "Location permission denied",
        }));
        return;
      }

      try {
        const position = await Location.getCurrentPositionAsync({});
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          loading: false,
          error: null,
        });
      } catch (error) {
        setLocation((prev) => ({
          ...prev,
          loading: false,
          error: "Failed to get location",
        }));
      }
    })();
  }, []);

  return location;
}
```

### M5.4: Checkpoint — Mobile Features

**Success criteria:**

- [ ] Push notifications work on physical device
- [ ] Event reminders can be scheduled
- [ ] "Add to Calendar" creates device calendar event
- [ ] Location services work (if implementing proximity filter)

---

## Phase M6: Monorepo Migration (After Web Phase 4)

### M6.1: Prerequisites

Before migration, ensure:

- [ ] Web app Phase 4 (event submission) is complete and stable
- [ ] Mobile app core features working
- [ ] Both apps using same Supabase project
- [ ] Shared code identified and documented

### M6.2: Create Monorepo Structure

```bash
# Create new monorepo root
mkdir salsasegura-monorepo
cd salsasegura-monorepo

# Initialize package.json for workspace
cat > package.json << 'EOF'
{
  "name": "salsasegura-monorepo",
  "private": true,
  "workspaces": [
    "packages/*"
  ]
}
EOF

# Create packages directory
mkdir -p packages

# Move existing projects
mv /path/to/Salsa packages/web
mv /path/to/salsasegura-mobile packages/mobile

# Create shared package
mkdir -p packages/shared/src/{hooks,types,lib,utils}
```

### M6.3: Shared Package Structure

```
packages/shared/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts              # Main export
│   ├── hooks/
│   │   ├── index.ts
│   │   ├── useSupabaseEvents.ts
│   │   └── useEvents.ts
│   ├── types/
│   │   ├── index.ts
│   │   └── events.ts
│   ├── lib/
│   │   ├── index.ts
│   │   └── supabase.ts       # Platform-agnostic parts
│   └── utils/
│       ├── index.ts
│       └── dateFormatters.ts
└── README.md
```

Create `packages/shared/package.json`:

```json
{
  "name": "@salsasegura/shared",
  "version": "1.0.0",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "dependencies": {
    "@supabase/supabase-js": "^2.x"
  },
  "peerDependencies": {
    "react": "^18.x"
  }
}
```

### M6.4: Update Import Paths

**In packages/web:**

```typescript
// Before
import { useSupabaseEvents } from "../hooks/useSupabaseEvents";
import { ScheduleXEvent } from "../types/events";

// After
import { useSupabaseEvents, ScheduleXEvent } from "@salsasegura/shared";
```

**In packages/mobile:**

```typescript
// Before
import { useSupabaseEvents } from "../hooks/useSupabaseEvents";
import { ScheduleXEvent } from "../types/events";

// After
import { useSupabaseEvents, ScheduleXEvent } from "@salsasegura/shared";
```

### M6.5: Platform-Specific Supabase Clients

The Supabase client needs platform-specific setup. Create separate entry points:

`packages/shared/src/lib/supabase.web.ts`:

```typescript
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(url!, key!);
```

`packages/shared/src/lib/supabase.native.ts`:

```typescript
import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(url!, key!, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
```

Configure bundlers to resolve the correct file based on platform.

### M6.6: Bun Workspace Configuration

For Bun workspaces, update root `package.json`:

```json
{
  "name": "salsasegura-monorepo",
  "private": true,
  "workspaces": ["packages/*"],
  "scripts": {
    "web:dev": "bun --cwd packages/web run dev",
    "web:build": "bun --cwd packages/web run build",
    "mobile:start": "bun --cwd packages/mobile expo start",
    "mobile:ios": "bun --cwd packages/mobile expo run:ios",
    "mobile:android": "bun --cwd packages/mobile expo run:android"
  }
}
```

### M6.7: Checkpoint — Monorepo

**Success criteria:**

- [ ] All three packages exist (web, mobile, shared)
- [ ] Shared code imported correctly in both apps
- [ ] Web app builds and runs
- [ ] Mobile app builds and runs
- [ ] No duplicate code between web and mobile
- [ ] TypeScript types shared correctly

---

## Shared Code Inventory

### Files to Share (Copy Now, Consolidate Later)

| File                   | Web Location                     | Mobile Location                  | Changes Needed          |
| ---------------------- | -------------------------------- | -------------------------------- | ----------------------- |
| `events.ts`            | `src/types/events.ts`            | `src/types/events.ts`            | None                    |
| `useSupabaseEvents.ts` | `src/hooks/useSupabaseEvents.ts` | `src/hooks/useSupabaseEvents.ts` | None                    |
| `useEvents.ts`         | `src/hooks/useEvent.ts`          | `src/hooks/useEvents.ts`         | Minor                   |
| `supabase.ts`          | `src/lib/supabase.ts`            | `src/lib/supabase.ts`            | Env vars + AsyncStorage |

### Files NOT to Share (Platform-Specific)

| Web Only                | Mobile Only                           |
| ----------------------- | ------------------------------------- |
| React Router navigation | React Navigation                      |
| Schedule-X calendar     | calendar-kit / react-native-calendars |
| HTML/CSS components     | React Native components               |
| Vite config             | Expo config                           |
| `index.html`            | `app.json`                            |

---

## Environment Setup

### Required Accounts

| Service             | Purpose                 | Link                    |
| ------------------- | ----------------------- | ----------------------- |
| **Supabase**        | Database, Auth, Storage | supabase.com            |
| **Expo**            | Build service, updates  | expo.dev                |
| **Apple Developer** | iOS App Store           | developer.apple.com     |
| **Google Play**     | Android Store           | play.google.com/console |

### Development Tools

| Tool               | Purpose                  | Install                                     |
| ------------------ | ------------------------ | ------------------------------------------- |
| **Bun**            | Package manager, runtime | `curl -fsSL https://bun.sh/install \| bash` |
| **Expo CLI**       | Mobile development       | `npm install -g expo-cli`                   |
| **iOS Simulator**  | Test iOS                 | Xcode (Mac only)                            |
| **Android Studio** | Test Android             | developer.android.com                       |
| **Expo Go**        | Test on device           | App Store / Play Store                      |

### Environment Variables Mapping

| Purpose      | Web (Vite)               | Mobile (Expo)                   |
| ------------ | ------------------------ | ------------------------------- |
| Supabase URL | `VITE_SUPABASE_URL`      | `EXPO_PUBLIC_SUPABASE_URL`      |
| Supabase Key | `VITE_SUPABASE_ANON_KEY` | `EXPO_PUBLIC_SUPABASE_ANON_KEY` |

---

## Testing Strategy

### Manual Testing Checklist

**Home Screen:**

- [ ] Events load from Supabase
- [ ] Pull-to-refresh works
- [ ] Empty state displays correctly
- [ ] Error state displays correctly
- [ ] Event cards show all information

**Calendar:**

- [ ] Month view shows event dots
- [ ] Week view shows event blocks
- [ ] View toggle works
- [ ] Date selection shows filtered events
- [ ] Event tap opens detail

**Event Detail:**

- [ ] All fields display correctly
- [ ] Maps link opens
- [ ] Share works
- [ ] RSVP link opens
- [ ] Add to Calendar works

**Platform Testing:**

- [ ] iOS Simulator
- [ ] Android Emulator
- [ ] Physical iOS device
- [ ] Physical Android device
- [ ] Different screen sizes

---

## Deployment

### Expo Application Services (EAS)

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Configure project
eas build:configure

# Build for iOS
eas build --platform ios

# Build for Android
eas build --platform android

# Submit to stores
eas submit --platform ios
eas submit --platform android
```

### App Store Requirements

**iOS (App Store Connect):**

- Apple Developer Program ($99/year)
- App icons (1024x1024)
- Screenshots (various sizes)
- Privacy policy URL
- App description

**Android (Google Play Console):**

- Google Play Developer account ($25 one-time)
- App icons (512x512)
- Feature graphic (1024x500)
- Screenshots
- Privacy policy URL

---

## Timeline Summary

| Week | Milestone                                  |
| ---- | ------------------------------------------ |
| 1    | M1: Project setup, Supabase connected      |
| 2-3  | M2: Home screen, event list working        |
| 4-5  | M3: Calendar views (month + week)          |
| 6    | M4: Event details, sharing, maps           |
| 7-8  | M5: Push notifications, device calendar    |
| 9    | M6: Monorepo migration (after web Phase 4) |
| 10+  | Polish, testing, store submission          |

---

## Quick Reference Commands

```bash
# Start mobile development
cd salsasegura-mobile
npx expo start

# Run on iOS simulator
npx expo run:ios

# Run on Android emulator
npx expo run:android

# Install a package
npx expo install [package-name]

# Build for production
eas build --platform all

# Check for issues
npx expo-doctor
```

---

_Last Updated: February 2026_
