# Medeasy — Frontend Architecture (Next.js App Router)

**Version:** 1.0
**Companion to:** Medeasy PRD, System Architecture, PostgreSQL Schema, Backend Architecture docs
**Status:** Draft for Engineering Review
**Date:** July 2026

> **Note on scope:** No Figma file was available at the time of writing this document — the structure below is derived from the PRD's three portals (Patient, Doctor, Hospital Admin) and the API contracts in the Backend Architecture doc. If you share the actual Figma (link or exported frames), this document should be revisited to align exact component props, spacing, and visual tokens to it — the architectural shape (routes, state boundaries, data-fetching patterns) will likely stay the same regardless.

**Stack:** Next.js 14+ (App Router), TypeScript, TanStack Query, Zustand, Tailwind CSS, shadcn/ui, Socket.IO client, React Hook Form + Zod.

---

## 1. App Router Structure

```
medeasy-frontend/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   ├── otp/page.tsx
│   │   └── layout.tsx                    # centered auth shell, no nav
│   │
│   ├── (patient)/
│   │   ├── layout.tsx                    # patient shell: bottom nav (mobile) / sidebar (desktop)
│   │   ├── home/page.tsx                 # search + recommendations
│   │   ├── search/page.tsx               # hospital/doctor search results
│   │   ├── hospitals/[hospitalId]/page.tsx
│   │   ├── doctors/[doctorId]/page.tsx
│   │   ├── book/[doctorId]/page.tsx      # slot selection + confirm
│   │   ├── appointments/page.tsx         # upcoming + past
│   │   ├── appointments/[id]/page.tsx    # detail + live queue status
│   │   ├── prescriptions/page.tsx
│   │   ├── profile/page.tsx
│   │   └── emergency/page.tsx            # emergency mode hospital finder
│   │
│   ├── (doctor)/
│   │   ├── layout.tsx                    # doctor shell: sidebar nav
│   │   ├── dashboard/page.tsx            # today's queue + summary
│   │   ├── queue/page.tsx                # live patient queue
│   │   ├── patients/[patientId]/page.tsx # patient history view
│   │   ├── consultation/[appointmentId]/page.tsx
│   │   ├── calendar/page.tsx             # availability management
│   │   └── performance/page.tsx          # personal metrics
│   │
│   ├── (admin)/
│   │   ├── layout.tsx                    # admin shell: sidebar + top bar
│   │   ├── dashboard/page.tsx            # hospital-wide overview
│   │   ├── beds/page.tsx                 # live bed grid
│   │   ├── doctors/page.tsx              # staff management
│   │   ├── doctors/onboard/page.tsx
│   │   ├── inventory/page.tsx
│   │   ├── inventory/[itemId]/page.tsx
│   │   ├── analytics/page.tsx
│   │   └── settings/page.tsx
│   │
│   ├── api/
│   │   └── auth/[...nextauth]/route.ts   # optional: if using NextAuth as a session bridge
│   │
│   ├── layout.tsx                        # root layout: providers, fonts, global CSS
│   ├── page.tsx                          # marketing/landing → redirects by role post-login
│   ├── not-found.tsx
│   └── error.tsx                         # root error boundary
│
├── components/
│   ├── ui/                               # shadcn/ui primitives (button, dialog, input...)
│   ├── shared/                           # cross-portal composites
│   ├── patient/
│   ├── doctor/
│   └── admin/
│
├── lib/
│   ├── api/                              # typed API client (per domain)
│   ├── hooks/                            # shared React Query hooks
│   ├── stores/                           # Zustand stores
│   ├── socket/                           # Socket.IO client setup
│   ├── auth/                             # token storage, refresh logic
│   ├── validation/                       # Zod schemas (mirrors backend validation)
│   └── utils/
│
├── middleware.ts                         # route-guard by role, redirects
├── public/
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

**Route group rationale:** `(auth)`, `(patient)`, `(doctor)`, `(admin)` are Next.js route groups — they don't affect the URL but let each portal have its own `layout.tsx` (different navigation shells) while keeping them in one Next.js app and one deploy. This matches the PRD's three-portal structure while avoiding three separate frontend repos.

---

## 2. Pages

| Route | Portal | Purpose | Primary data needs |
|---|---|---|---|
| `/login`, `/otp` | Public | Patient OTP login, Doctor/Admin credential login | `POST /auth/otp/*`, `/auth/login` |
| `/home` | Patient | Search entry + personalized recommendations | `GET /recommendations` |
| `/search` | Patient | Filtered hospital/doctor results | `GET /recommendations?specialty=&location=` |
| `/hospitals/[id]` | Patient | Hospital profile, departments, doctors, live bed snapshot | `GET /hospitals/:id` |
| `/doctors/[id]` | Patient | Doctor profile, ratings, available slots | `GET /doctors/:id`, `GET /doctors/:id/slots` |
| `/book/[doctorId]` | Patient | Slot picker + booking confirmation | `POST /appointments` |
| `/appointments` | Patient | Upcoming/past appointment list | `GET /appointments` |
| `/appointments/[id]` | Patient | Detail + **live queue position (socket)** | `GET /appointments/:id` + `/queue` socket namespace |
| `/emergency` | Patient | Emergency-mode hospital finder (bed+ICU priority) | `GET /recommendations?mode=emergency` |
| `/dashboard` (doctor) | Doctor | Today's queue summary, quick stats | `GET /appointments?doctorId=&date=today` |
| `/queue` (doctor) | Doctor | Live patient queue, check-in status | `/queue` socket namespace, `GET /appointments` |
| `/consultation/[appointmentId]` | Doctor | Consult workspace: history, notes, e-prescription | `GET /patients/:id/history`, `POST /prescriptions` |
| `/calendar` (doctor) | Doctor | Set availability/leave | `PATCH /doctors/:id/availability` |
| `/dashboard` (admin) | Admin | Hospital-wide KPIs | `GET /analytics/hospital/:id` |
| `/beds` | Admin | Live bed grid by category | `GET /beds`, `/beds` socket namespace |
| `/doctors` (admin) | Admin | Staff roster, verification status | `GET /doctors?hospitalId=` |
| `/inventory` | Admin | Stock levels, reorder alerts | `GET /inventory`, `POST /inventory/:id/reorder` |
| `/analytics` | Admin | Full analytics dashboard | `GET /analytics/*` |

**Rendering strategy per page type:**
- **Server Components (default):** hospital/doctor profile pages, appointment list shells, admin analytics shells — fetched server-side for fast first paint and SEO where relevant (hospital/doctor profiles are the only public-facing SEO surface).
- **Client Components:** anything with sockets, forms, or interactive state — booking flow, live queue, live bed grid, consultation workspace.
- Server Components fetch initial data; Client Components hydrate with React Query using that server data as `initialData`, then take over for live updates — avoids a loading flash on first render while still enabling real-time updates after.

---

## 3. Components

```
components/
├── ui/                          # shadcn/ui: button, input, dialog, select, badge, table, tabs...
│
├── shared/
│   ├── AppShell/                # role-aware nav shell (sidebar/bottom-nav switch)
│   ├── DataTable/                # generic sortable/paginated table wrapper
│   ├── EmptyState/
│   ├── ErrorBoundary/
│   ├── LoadingSkeleton/
│   ├── ConfirmDialog/
│   └── NotificationToast/
│
├── patient/
│   ├── HospitalCard.tsx          # ranked result card w/ "why recommended" tags
│   ├── DoctorCard.tsx
│   ├── SlotPicker.tsx            # calendar + time-slot grid
│   ├── QueueStatusBanner.tsx     # live position + ETA, socket-driven
│   ├── AppointmentCard.tsx
│   ├── PrescriptionViewer.tsx
│   └── EmergencyModeToggle.tsx
│
├── doctor/
│   ├── QueueList.tsx             # live, socket-driven patient queue
│   ├── PatientHistoryPanel.tsx
│   ├── ConsultationNotesForm.tsx
│   ├── PrescriptionForm.tsx
│   ├── AvailabilityCalendar.tsx
│   └── PerformanceStatsCard.tsx
│
└── admin/
    ├── BedGrid.tsx                # live grid, color-coded by status, socket-driven
    ├── BedAllocationDialog.tsx
    ├── DoctorOnboardForm.tsx
    ├── InventoryTable.tsx
    ├── ReorderAlertBanner.tsx
    ├── OccupancyChart.tsx
    ├── RevenueChart.tsx
    └── DepartmentPerformanceTable.tsx
```

**Composition convention:** portal-specific components (`patient/`, `doctor/`, `admin/`) compose `shared/` primitives and `ui/` atoms — no portal folder reaches into another portal's folder. If two portals need the same composite (e.g. both Doctor and Admin show a patient history panel), it's promoted to `shared/`.

**Example — `QueueStatusBanner` (patient-facing, socket-driven):**

```tsx
// components/patient/QueueStatusBanner.tsx
'use client';

import { useQueueSocket } from '@/lib/socket/useQueueSocket';

interface Props {
  appointmentId: string;
  initialPosition: number;
  initialEtaMinutes: number;
}

export function QueueStatusBanner({ appointmentId, initialPosition, initialEtaMinutes }: Props) {
  const { position, etaMinutes, isTurnSoon } = useQueueSocket(appointmentId, {
    position: initialPosition,
    etaMinutes: initialEtaMinutes,
  });

  return (
    <div className={`rounded-xl p-4 ${isTurnSoon ? 'bg-amber-50 border-amber-300' : 'bg-blue-50 border-blue-200'} border`}>
      <p className="text-sm text-muted-foreground">Your position in queue</p>
      <p className="text-2xl font-medium">{position} {position === 1 ? 'patient' : 'patients'} ahead</p>
      <p className="text-sm text-muted-foreground">Estimated wait: ~{etaMinutes} min</p>
      {isTurnSoon && <p className="text-sm font-medium text-amber-700 mt-1">Please head to the waiting area now</p>}
    </div>
  );
}
```

---

## 4. State Management

Three distinct kinds of state, each handled by a different tool — this separation is deliberate and avoids the common mistake of putting server data in a global client store.

| State type | Tool | Examples |
|---|---|---|
| **Server/remote state** | TanStack Query | appointments, hospitals, beds, inventory, analytics — anything from the API |
| **Real-time/live state** | Socket.IO + local component state (or a small Zustand slice) | queue position, live bed grid |
| **Client/UI state** | Zustand | auth session, active filters, booking-flow wizard step, sidebar collapsed/expanded |
| **Form state** | React Hook Form + Zod | booking form, consultation notes, doctor onboarding form |

```typescript
// lib/stores/authStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  user: { id: string; role: 'patient' | 'doctor' | 'admin'; name: string } | null;
  accessToken: string | null;
  setSession: (user: AuthState['user'], accessToken: string) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      setSession: (user, accessToken) => set({ user, accessToken }),
      clearSession: () => set({ user: null, accessToken: null }),
    }),
    { name: 'medeasy-auth', partialize: (state) => ({ user: state.user }) }, // access token NOT persisted to storage
  ),
);
```

```typescript
// lib/hooks/useAppointments.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { appointmentApi } from '@/lib/api/appointmentApi';

export function usePatientAppointments(page: number) {
  return useQuery({
    queryKey: ['appointments', 'patient', page],
    queryFn: () => appointmentApi.listForPatient(page),
    staleTime: 30_000,
  });
}

export function useBookAppointment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: appointmentApi.book,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments', 'patient'] });
    },
  });
}
```

**Why the access token is never persisted to `localStorage`:** it's held in memory (Zustand, non-persisted field) and refreshed via an httpOnly refresh-token cookie set by the backend — this avoids XSS-exposed token theft. See Section 6.

---

## 5. API Integration

```typescript
// lib/api/client.ts
import axios, { AxiosError } from 'axios';
import { useAuthStore } from '@/lib/stores/authStore';
import { refreshAccessToken } from '@/lib/auth/refresh';

export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL,
  withCredentials: true, // sends the httpOnly refresh-token cookie
});

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let isRefreshing = false;
let pendingQueue: Array<() => void> = [];

apiClient.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config!;
    if (error.response?.status === 401 && !isRefreshing) {
      isRefreshing = true;
      try {
        const newToken = await refreshAccessToken();
        useAuthStore.getState().setSession(useAuthStore.getState().user, newToken);
        pendingQueue.forEach((cb) => cb());
        pendingQueue = [];
        return apiClient(original);
      } catch {
        useAuthStore.getState().clearSession();
        window.location.href = '/login';
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  },
);
```

```typescript
// lib/api/appointmentApi.ts
import { apiClient } from './client';
import type { Appointment, CreateAppointmentInput, PaginatedResponse } from './types';

export const appointmentApi = {
  book: (input: CreateAppointmentInput) =>
    apiClient.post<{ data: Appointment }>('/appointments', input).then((r) => r.data.data),

  listForPatient: (page: number) =>
    apiClient
      .get<PaginatedResponse<Appointment>>('/appointments', { params: { page } })
      .then((r) => r.data),

  cancel: (id: string) => apiClient.patch(`/appointments/${id}/cancel`),

  reschedule: (id: string, newSlotStart: string) =>
    apiClient.patch(`/appointments/${id}/reschedule`, { newSlotStart }),
};
```

**Conventions:**
- One `*Api.ts` file per backend domain (mirrors the module boundaries in the Backend Architecture doc) — `appointmentApi`, `bedApi`, `inventoryApi`, `recommendationApi`.
- All API errors surface the backend's `{ error: { code, message } }` envelope; a shared `getErrorMessage(err)` util maps known `code` values to user-facing copy, with a generic fallback for unknown codes.
- 401s trigger a single in-flight refresh (via the `isRefreshing` guard) so concurrent failed requests don't each fire their own refresh call.

---

## 6. Authentication Flow

```
Patient flow:
  /login → enter phone → POST /auth/otp/request
        → /otp → enter code → POST /auth/otp/verify
        → { accessToken } in response body, refreshToken set as httpOnly cookie by backend
        → accessToken stored in Zustand (memory only)
        → redirect to /home

Doctor/Admin flow:
  /login → email + password (+ MFA step for admin) → POST /auth/login
        → same token handling as above
        → redirect to /dashboard (role-specific)

Silent refresh (on 401 or app load):
  → POST /auth/refresh (httpOnly cookie sent automatically, no JS access needed)
  → new accessToken → retry original request

Logout:
  → POST /auth/logout (backend clears the refresh cookie + Redis jti)
  → clearSession() → redirect to /login
```

### Route Guarding (`middleware.ts`)

```typescript
// middleware.ts
import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const PORTAL_PREFIX_TO_ROLE: Record<string, string> = {
  '/dashboard': 'doctor', // note: disambiguated further by cookie-encoded role claim
  '/beds': 'admin',
  '/inventory': 'admin',
  '/queue': 'doctor',
};

export async function middleware(req: NextRequest) {
  const sessionCookie = req.cookies.get('medeasy_session')?.value;
  const isPublicRoute = req.nextUrl.pathname.startsWith('/login') || req.nextUrl.pathname === '/';

  if (!sessionCookie && !isPublicRoute) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  if (sessionCookie) {
    try {
      const { payload } = await jwtVerify(sessionCookie, new TextEncoder().encode(process.env.JWT_ACCESS_SECRET!));
      const requiredRole = PORTAL_PREFIX_TO_ROLE[req.nextUrl.pathname];
      if (requiredRole && payload.role !== requiredRole) {
        return NextResponse.redirect(new URL('/unauthorized', req.url));
      }
    } catch {
      return NextResponse.redirect(new URL('/login', req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
```

**Design points:**
- The refresh token is httpOnly + `Secure` + `SameSite=Strict`, set by the backend — never touched by client JS, closing the main XSS token-theft vector.
- The access token lives in memory only (Zustand, non-persisted) — a page refresh triggers one silent `/auth/refresh` call rather than reading a stored token, trading a small latency cost for meaningfully better security posture.
- `middleware.ts` does a lightweight role check for route-gating (fast redirect before any page code runs); each portal's `layout.tsx` does a second, authoritative check via the authenticated `/auth/me`-style call, since middleware JWT verification alone shouldn't be the only gate for sensitive admin actions.

---

## 7. Dashboard Design

### 7.1 Doctor Dashboard (`/dashboard`)

```
┌─────────────────────────────────────────────────────┐
│ Today, Jul 22          Dr. Anjali Sharma · Cardiology│
├───────────────┬───────────────┬─────────────────────┤
│ Patients today │ Avg wait time │ Completed / Total   │
│      14        │    18 min     │      6 / 14         │
├───────────────┴───────────────┴─────────────────────┤
│  Live Queue                                          │
│  ┌───────────────────────────────────────────────┐  │
│  │ 1. Rohit Kumar     — checked in   [Start]       │  │
│  │ 2. Priya Singh     — checked in                 │  │
│  │ 3. Amit Verma      — running late               │  │
│  └───────────────────────────────────────────────┘  │
├───────────────────────────────────────────────────────┤
│  Quick actions: [Set today's leave] [View calendar]  │
└─────────────────────────────────────────────────────┘
```
- Top stat row: server-rendered on load, revalidated via React Query polling fallback if socket disconnects.
- Live Queue list: fully socket-driven (`/queue` namespace), re-renders on `queue:position_update`/`doctor:queue_updated`.

### 7.2 Hospital Admin Dashboard (`/dashboard`)

```
┌─────────────────────────────────────────────────────────────┐
│ Apex Multispecialty Hospital — Overview                      │
├─────────────┬─────────────┬─────────────┬───────────────────┤
│ Bed occupancy│ Today's OPD │ Low-stock   │ Revenue (MTD)     │
│    82%       │    142      │  items: 3   │   ₹ [figure]      │
├─────────────┴─────────────┴─────────────┴───────────────────┤
│  Bed Grid (by category)         │  Department Performance    │
│  ICU  ●●●●○ 4/5 occupied        │  [bar chart: consults/dept]│
│  Gen  ●●●●●●●○○○ 7/10           │                             │
│  Mat  ●●○○○ 2/5                 │                             │
├──────────────────────────────────┴─────────────────────────┤
│  Reorder Alerts: IV Cannula 18G (8 left), Gauze rolls (12)   │
└───────────────────────────────────────────────────────────┘
```
- Bed grid cells are the highest-priority live element: socket-driven, color-coded (green=vacant, red=occupied, amber=reserved, gray=cleaning), matching the `BedStatus` enum from the schema.
- Charts (occupancy trend, department performance, revenue) use Recharts, fed by React Query hitting the Analytics Service; these are near-real-time (30–60s poll or on-demand refresh), not socket-driven — analytics doesn't need sub-second freshness, and keeping it off the socket layer matches the backend's decoupled Analytics design.

### 7.3 Patient Home (`/home`)
- Search bar (symptom/specialty) → triggers Recommendation Service query.
- "Continue where you left off": upcoming appointment card with live `QueueStatusBanner` if today.
- Ranked hospital/doctor cards with visible "why recommended" tags (distance, rating, bed availability) — surfacing the Recommendation Engine's explainability field from the PRD.
- Prominent, visually distinct "Emergency" entry point — per the PRD's emergency mode requirement, this bypasses normal search filtering.

---

## 8. Responsive Layout

| Breakpoint | Patient Portal | Doctor Portal | Admin Portal |
|---|---|---|---|
| **Mobile** (<640px) | Bottom tab nav (Home, Search, Appointments, Profile); single-column cards; booking flow as full-screen steps | Simplified queue list view; consultation form as scrollable single column | Read-mostly: bed grid as stacked category list, key stats as swipeable cards |
| **Tablet** (640–1024px) | Collapsible side drawer nav; 2-column card grids | Sidebar nav collapses to icons; queue + patient panel can show side-by-side in landscape | Sidebar nav collapses to icons; bed grid becomes 2-column |
| **Desktop** (≥1024px) | Persistent sidebar nav; multi-column layouts (search results + map/filters side panel) | Full sidebar; 3-panel consultation workspace (queue list + patient history + notes form) | Full sidebar + top bar; dense multi-widget dashboard grid |

**Implementation approach:**
- Tailwind's responsive utilities (`sm:`, `md:`, `lg:`) drive layout shifts directly in components rather than separate mobile/desktop component trees — keeps one source of truth per component.
- `AppShell` component switches between bottom-nav (mobile) and sidebar (desktop) at the `md` breakpoint via CSS, not JS-based device detection — avoids layout flash and works correctly with server rendering.
- The **Bed Grid** and **Live Queue** — the two most information-dense, admin/doctor-facing real-time views — get the most aggressive mobile simplification (card-per-item instead of grid-per-cell) since these are usually checked on the move between wards/rooms, not sat in front of a desktop.
- Charts (Recharts) are given explicit `ResponsiveContainer` wrappers and reduced tick/legend density below `md` to avoid overlapping labels on narrow screens.

---

*End of Document*
