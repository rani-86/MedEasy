# Medeasy — System Architecture Document

**Version:** 1.0
**Companion to:** Medeasy PRD v1.0
**Status:** Draft for Engineering Review
**Date:** July 2026

---

## 1. High-Level Architecture

Medeasy follows a **microservices architecture** fronted by an API Gateway, with an event bus connecting domain services, a polyglot persistence layer, and two independently-scalable intelligence services (Queue Prediction, Recommendation Engine).

```
                                   ┌───────────────────────┐
                                   │   Clients (Web/Mobile) │
                                   │ Patient / Doctor / Admin│
                                   └───────────┬────────────┘
                                               │ HTTPS / WSS
                                   ┌───────────▼────────────┐
                                   │      API Gateway        │
                                   │ (Auth, Rate-limit, LB)  │
                                   └───────────┬────────────┘
              ┌───────────────┬────────────────┼────────────────┬───────────────┐
              │               │                │                │               │
       ┌──────▼─────┐  ┌──────▼─────┐   ┌──────▼──────┐  ┌──────▼─────┐  ┌──────▼─────┐
       │  User Svc   │  │Appointment │   │  Bed Mgmt   │  │ Inventory  │  │ Analytics  │
       │(Patient/Doc/│  │  Service   │   │  Service    │  │  Service   │  │  Service   │
       │ Admin auth) │  │            │   │             │  │            │  │            │
       └──────┬─────┘  └──────┬─────┘   └──────┬──────┘  └──────┬─────┘  └──────┬─────┘
              │               │                │                │               │
              └───────────────┴───────┬────────┴────────────────┴───────────────┘
                                       │
                              ┌────────▼─────────┐
                              │   Event Bus       │
                              │ (Kafka/RabbitMQ)  │
                              └────────┬─────────┘
                       ┌───────────────┼────────────────┐
                ┌──────▼──────┐ ┌──────▼──────┐  ┌───────▼────────┐
                │Queue Predict │ │Recommendation│  │ Notification   │
                │  Service     │ │   Engine     │  │   Service      │
                │(ML/Stats)    │ │ (Rule/ML)    │  │(SMS/Push/Email)│
                └──────────────┘ └──────────────┘  └────────────────┘

       ┌─────────────────────────────── Data Layer ───────────────────────────────┐
       │ PostgreSQL (transactional) │ Redis (cache/queue state) │ MongoDB (logs/  │
       │ TimescaleDB (analytics/    │ Elasticsearch (search)    │ unstructured)   │
       │ time-series)                │                            │                 │
       └─────────────────────────────────────────────────────────────────────────┘
```

**Key architectural decisions:**
- **API Gateway** is the single entry point — handles auth token validation, rate limiting, request routing, and WebSocket upgrade for real-time channels.
- **Event-driven backbone**: state changes (bed freed, appointment completed, stock depleted) are published as events, consumed by Analytics, Notification, Queue Prediction, and Recommendation services asynchronously — this keeps the booking/transactional path fast and decoupled from downstream intelligence.
- **Intelligence services isolated**: Queue Prediction and Recommendation Engine never sit in the critical path of a booking transaction; they're consulted as advisory/read services with fallbacks.

---

## 2. Low-Level Architecture

### 2.1 Request Flow Example — "Book Appointment"

```
Client → API Gateway → Auth Middleware (JWT validate)
       → Appointment Service
            → Locks slot (Redis distributed lock, TTL 10s)
            → Validates against Doctor Calendar (Postgres)
            → Writes booking row (Postgres, transactional)
            → Publishes "AppointmentBooked" event → Event Bus
            → Releases lock
       → Response to client (booking confirmed)

Async consumers of "AppointmentBooked":
  - Notification Service → sends confirmation SMS/push
  - Queue Prediction Service → recalculates doctor's queue ETA
  - Analytics Service → updates booking funnel metrics
```

### 2.2 Component Interaction — Bed Allocation

```
Admin Portal → Bed Service.allocate(patientId, bedCategory, hospitalId)
   → Check bed_inventory table (row-level lock on bed row)
   → If available: mark OCCUPIED, link patient_admission record
   → Publish "BedAllocated" event
        → Analytics Service (occupancy dashboards)
        → Recommendation Service (invalidate cached availability for this hospital)
   → If unavailable: return 409 + call Recommendation Service for nearby alternatives
```

### 2.3 Internal Module Layering (per service)

```
┌────────────────────────────┐
│ Controller / API Layer      │  → input validation, DTO mapping
├────────────────────────────┤
│ Service / Business Logic    │  → domain rules, orchestration
├────────────────────────────┤
│ Repository / Data Access    │  → DB queries, caching
├────────────────────────────┤
│ Event Publisher/Consumer    │  → outbound/inbound event handling
└────────────────────────────┘
```
Each service follows this layered structure to keep domain logic testable and independent of transport/storage concerns.

---

## 3. Service Breakdown

| Service | Responsibility | Sync/Async | Data Store |
|---|---|---|---|
| **User Service** | Registration, login, profile, RBAC roles (patient/doctor/admin) | Sync (REST) | PostgreSQL |
| **Appointment Service** | Slot management, booking, cancellation, rescheduling, waitlist | Sync (REST) + emits events | PostgreSQL + Redis (locks) |
| **Bed Management Service** | Real-time bed inventory, allocation, discharge workflow | Sync (REST) + WebSocket push | PostgreSQL (source of truth) + Redis (live state cache) |
| **Inventory Service** | Stock tracking, reorder alerts, supplier/PO management | Sync (REST) + emits events | PostgreSQL |
| **Queue Prediction Service** | Computes live wait-time estimates | Async consumer + read API | Redis (live state) + TimescaleDB (historical) |
| **Recommendation Service** | Hospital/doctor ranking and search | Read-heavy REST API | Elasticsearch (search index) + Redis (cache) |
| **Analytics Service** | Aggregation, dashboards, reports | Async consumer + read API | TimescaleDB / OLAP store |
| **Notification Service** | SMS/email/push dispatch | Async consumer | MongoDB (delivery logs) |
| **Doctor Portal BFF** | Aggregates doctor-facing data from multiple services | Sync (REST) | N/A (composition layer) |
| **Hospital Admin BFF** | Aggregates admin-facing data (beds, inventory, analytics) | Sync (REST) | N/A (composition layer) |
| **API Gateway** | AuthN/AuthZ enforcement, routing, rate limiting, WS upgrade | Sync | Redis (rate-limit counters, session cache) |

**BFF (Backend-for-Frontend) rationale:** Doctor and Admin portals need composed views spanning multiple services (e.g., admin dashboard needs bed + inventory + analytics data in one screen). BFFs avoid chatty client-side calls and let each portal evolve its API shape independently of core domain services.

---

## 4. Database Design

### 4.1 Core Entities (PostgreSQL — transactional)

```
users
  id (PK), role (patient/doctor/admin), name, phone, email,
  password_hash, created_at, verified_at

patient_profiles
  id (PK), user_id (FK), dob, blood_group, allergies[],
  emergency_contact, linked_dependents[]

doctors
  id (PK), user_id (FK), hospital_id (FK), specialty,
  license_no, license_verified, rating_avg

hospitals
  id (PK), name, address, lat, lng, departments[],
  contact_info, network_id (nullable, for hospital chains)

appointments
  id (PK), patient_id (FK), doctor_id (FK), hospital_id (FK),
  slot_start, slot_end, status (booked/completed/cancelled/no_show),
  created_at

beds
  id (PK), hospital_id (FK), category (ICU/general/maternity/isolation),
  status (vacant/occupied/reserved/cleaning), current_patient_id (nullable)

bed_admissions
  id (PK), bed_id (FK), patient_id (FK), admitted_at, discharged_at

inventory_items
  id (PK), hospital_id (FK), item_name, category, unit,
  current_stock, reorder_threshold, expiry_date

purchase_orders
  id (PK), hospital_id (FK), supplier_id (FK), item_id (FK),
  quantity, status, created_at

prescriptions
  id (PK), appointment_id (FK), doctor_id (FK), patient_id (FK),
  notes, medicines[], created_at
```

### 4.2 Supporting Stores

| Store | Purpose |
|---|---|
| **Redis** | Distributed locks (slot booking), live queue state, session/rate-limit cache, Socket.IO adapter (pub/sub across nodes) |
| **TimescaleDB** | Time-series data: queue wait-times, bed occupancy history, appointment volume — feeds Analytics + Queue Prediction |
| **Elasticsearch** | Search index for hospital/doctor discovery (geo-search, specialty filters, ratings) — feeds Recommendation Service |
| **MongoDB** | Unstructured/semi-structured data: notification logs, audit trails, doctor consultation free-text notes |

### 4.3 Indexing & Partitioning Notes
- `appointments`: composite index on (`doctor_id`, `slot_start`) for conflict checks; partitioned monthly for retention/archival.
- `beds`: index on (`hospital_id`, `category`, `status`) for fast availability lookups — this table is read-heavy and benefits from a Redis mirror for sub-50ms reads.
- `inventory_items`: index on (`hospital_id`, `current_stock`) to support reorder-threshold scans efficiently via a scheduled job rather than per-request scans.

---

## 5. Authentication Design

### 5.1 Approach
- **Token scheme:** JWT (short-lived access token, ~15 min) + refresh token (7–30 days, rotated on use, stored hashed).
- **Patients:** OTP-based login (phone/email) → issues JWT with `role: patient`.
- **Doctors:** Credential login (email + password) + license verification gate — a doctor with `license_verified: false` receives a restricted-scope token (read-only/onboarding).
- **Hospital Admin/Staff:** Email + password + MFA (TOTP) mandatory; role-scoped tokens (e.g., `admin:bed_manager`, `admin:inventory_manager`, `admin:super`).

### 5.2 Token Claims
```json
{
  "sub": "user_id",
  "role": "doctor",
  "hospital_id": "h_123",
  "scopes": ["appointments:read", "prescriptions:write"],
  "iat": 0, "exp": 0
}
```

### 5.3 Authorization Model
- **RBAC** at the Gateway (coarse: role-based route access) + **service-level scope checks** (fine: e.g., doctor can only access `patient_id`s tied to their own appointments).
- Hospital Admin roles are hospital-scoped — a `hospital_id` claim restricts all downstream queries; cross-hospital access requires an explicit `network_admin` role.

### 5.4 Session & Security Flow
```
Login → Credentials/OTP validated → Access + Refresh token issued
      → Access token used in Authorization header per request
      → Gateway validates signature + expiry + scope per route
      → On expiry: client calls /refresh with refresh token
           → Refresh token rotated (old one invalidated in Redis blocklist)
```
- Refresh tokens stored server-side (hashed) in Redis with device fingerprint to support "log out of all devices."
- All admin actions (bed override, inventory adjustment, doctor onboarding) are logged to an immutable audit trail with `actor_id`, `action`, `before/after state`.

---

## 6. Socket.IO Design

Real-time channels are needed for: **live queue position**, **live bed status**, and **doctor's live patient queue**.

### 6.1 Namespace & Room Structure
```
/queue namespace
  room: "doctor:{doctorId}:{date}"      → patients + doctor subscribe
  room: "patient:{patientId}"           → personal updates (turn approaching)

/beds namespace
  room: "hospital:{hospitalId}"         → admin dashboard subscribes for live bed grid

/notifications namespace
  room: "user:{userId}"                 → generic push-style events over socket (fallback to FCM/APNs if disconnected)
```

### 6.2 Event Contracts
| Event | Direction | Payload |
|---|---|---|
| `queue:position_update` | Server → Client | `{ appointmentId, position, etaMinutes }` |
| `queue:your_turn_soon` | Server → Client | `{ appointmentId, position: 2 }` |
| `bed:status_changed` | Server → Client | `{ bedId, hospitalId, category, status }` |
| `doctor:queue_updated` | Server → Client | `{ doctorId, queue: [...] }` |
| `client:heartbeat` | Client → Server | `{}` (connection liveness) |

### 6.3 Scaling Socket.IO
- **Redis Adapter** (`socket.io-redis`) used for pub/sub across multiple Socket.IO server instances — ensures events reach clients regardless of which node they're connected to.
- **Sticky sessions** at the load balancer (or Redis-backed session affinity) required since Socket.IO's default long-polling fallback needs consistent server routing.
- **Backpressure handling:** queue-position updates are throttled/debounced server-side (max 1 update per patient per 10s) to avoid event storms during high-traffic periods.
- **Disconnect handling:** on reconnect, client fetches current state via REST (`GET /queue/status`) rather than relying solely on replayed socket events, to avoid state drift.

---

## 7. Queue Prediction Service

### 7.1 v1 Approach — Rule-Based / Statistical (per PRD scope)
Since ML requires historical volume the platform won't have at launch, v1 uses a **weighted statistical model**:

```
predicted_wait(patient) =
    (avg_consult_duration[doctor] × patients_ahead)
    − time_elapsed_since_last_consult_started
    + buffer_factor(doctor_historical_variance)
```

- `avg_consult_duration[doctor]`: rolling 30-day average per doctor per department, stored in TimescaleDB, recalculated nightly + adjusted live via exponential moving average as the day progresses.
- `buffer_factor`: accounts for doctors who historically run over/under schedule (variance-based padding).
- Recalculated on every `AppointmentCompleted` or `ConsultationDelayed` event (consumed from the Event Bus).

### 7.2 Data Flow
```
Event Bus (AppointmentCompleted, DoctorCheckedIn, DoctorOnBreak)
   → Queue Prediction Service (consumer)
        → Updates live queue state in Redis: queue:{doctorId}:{date}
        → Recomputes ETA for each waiting patient
        → Emits Socket.IO event: queue:position_update
```

### 7.3 v2 Roadmap (Future — ML-based)
- Move to a regression/gradient-boosted model factoring: patient case complexity (from intake form), doctor's time-of-day patterns, day-of-week seasonality, department type.
- Model served via a separate inference microservice (e.g., a lightweight model server) so ML infra changes never touch the core booking path.
- v1's statistical baseline remains as a fallback if the ML service is unavailable or has low confidence.

### 7.4 Fallback & Failure Mode
If the Queue Prediction Service is down, the Appointment Service still functions — patients see "wait time unavailable" rather than a blocked booking flow. This is a deliberate non-blocking dependency.

---

## 8. Recommendation Service

### 8.1 v1 Approach — Rule-Based Weighted Scoring (per PRD scope)
```
score(hospital) =
      w1 × specialty_match
    + w2 × (1 / distance_km)
    + w3 × normalized_rating
    + w4 × bed_availability_flag
    + w5 × cost_fit (if patient set a budget preference)
```
Weights (`w1`...`w5`) are configurable per query context (e.g., emergency mode heavily upweights `bed_availability_flag` and `distance`, deprioritizes cost).

### 8.2 Architecture
```
Client query (symptom/specialty + location)
   → Recommendation Service
        → Elasticsearch geo + specialty query → candidate hospital set
        → Enrich candidates with live bed availability (Redis cache, populated via BedAllocated/BedFreed events)
        → Score + rank candidates
        → Return ranked list with "why recommended" explanation tags
```

### 8.3 Emergency Mode
- Bypasses cost/preference weighting.
- Queries expand search radius iteratively (5km → 15km → 30km) until a minimum viable candidate count with available beds is found.
- Flags results with reduced confidence if expanded beyond the default radius.

### 8.4 Caching & Freshness
- Hospital/doctor static attributes (specialty, ratings) cached with a 10-minute TTL.
- Bed availability signal is **never** served stale beyond 2 minutes — this field bypasses the long-TTL cache and reads from the Redis live-state mirror populated by Bed Management events.

### 8.5 v2 Roadmap
- Personalization via collaborative filtering (patients with similar history/preferences) once sufficient interaction data exists.
- A/B testing framework for weight tuning.

---

## 9. Deployment Architecture

```
                         ┌─────────────────────┐
                         │   CDN (static assets) │
                         └──────────┬───────────┘
                                    │
                         ┌──────────▼───────────┐
                         │  Cloud Load Balancer   │
                         └──────────┬───────────┘
                                    │
                     ┌──────────────▼──────────────┐
                     │   API Gateway (K8s pods,      │
                     │   auto-scaled, min 3 replicas)│
                     └──────────────┬──────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        │            Kubernetes Cluster (per region)              │
        │  Namespaces: core-services / intelligence / data-jobs   │
        │  Each microservice: Deployment + HPA + Service          │
        └───────────────────────────┬───────────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        │   Managed Data Layer                                    │
        │   - PostgreSQL (Primary + read replicas, multi-AZ)      │
        │   - Redis Cluster (managed, multi-AZ)                   │
        │   - TimescaleDB (managed or self-hosted on K8s)         │
        │   - Elasticsearch cluster (managed)                     │
        │   - MongoDB Atlas / managed cluster                     │
        └───────────────────────────────────────────────────────┘

Supporting infra: Kafka/RabbitMQ (managed, multi-broker), CI/CD (per-service pipelines,
canary deploys), centralized logging (ELK/Loki), metrics (Prometheus + Grafana),
distributed tracing (OpenTelemetry + Jaeger).
```

### 9.1 Environments
- `dev` → `staging` → `prod`, with staging mirroring prod topology at reduced scale.
- Feature flags for gradual rollout of Queue Prediction v2 / Recommendation personalization.

### 9.2 Deployment Strategy
- Each microservice deployed independently via its own CI/CD pipeline (containerized, versioned images).
- **Canary releases** for core transactional services (Appointment, Bed Management) — 5% traffic → monitor error rate/latency → full rollout.
- **Blue-green deploys** for the API Gateway to avoid connection drops during upgrades.
- Database migrations run as a separate, gated pipeline step (backward-compatible migrations only, to support rolling deploys).

---

## 10. Scalability Plan

| Dimension | Strategy |
|---|---|
| **Traffic spikes** (seasonal illness, city events) | Horizontal auto-scaling (HPA) on API Gateway and Appointment/Bed services based on CPU + request-queue-depth metrics |
| **Read-heavy load** (search, recommendation) | Elasticsearch + Redis caching absorb reads; Postgres read replicas for reporting queries, isolating them from transactional writes |
| **Write contention** (slot booking) | Redis distributed locks with short TTL + optimistic concurrency control (row versioning) on `appointments` and `beds` tables |
| **Real-time fan-out** (Socket.IO) | Redis adapter for cross-node pub/sub; horizontal scaling of Socket.IO nodes behind sticky-session load balancing |
| **Analytics load** | Fully decoupled via event consumption into TimescaleDB; heavy aggregation queries never touch the transactional Postgres instance |
| **Multi-hospital/network growth** | Data partitioning by `hospital_id`/`network_id`; sharding strategy pre-planned for Postgres once hospital count crosses a defined threshold |
| **Geographic expansion** | Multi-region Kubernetes clusters with region-local data stores; global routing via latency-based DNS; data residency compliance per region |
| **Intelligence services** (Queue Prediction, Recommendation) | Deployed as independently scalable pools, decoupled from the transactional critical path — can scale, degrade, or fail without impacting core booking/bed flows |
| **Event Bus throughput** | Kafka partitioned by `hospital_id` to preserve per-hospital ordering while allowing parallel consumption across hospitals |
| **Capacity planning** | Load testing benchmarks tied to PRD scale targets (100K+ concurrent users, 1000+ hospitals) before each major release |

---

*End of Document*
