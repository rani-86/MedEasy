# Product Requirements Document: Medeasy

**Version:** 1.0
**Document Owner:** Product Architecture
**Status:** Draft for Review
**Date:** July 2026

---

## 1. Overview

Medeasy is a multi-sided healthcare platform connecting patients, doctors, and hospital administrators. It streamlines appointment booking, hospital discovery, bed availability, queue management, and hospital operations (inventory, analytics) through three coordinated portals and a set of intelligent backend services.

**Core Modules:**
1. Patient Portal
2. Doctor Portal
3. Hospital Admin Portal
4. Appointment System
5. Bed Management
6. Queue Prediction
7. Hospital Recommendation Engine
8. Analytics Dashboard
9. Inventory Management

---

## 2. Functional Requirements

### 2.1 Patient Portal
- FR-1: Patient registration/login via phone/email/OTP, with profile creation (demographics, medical history, allergies, insurance info).
- FR-2: Search hospitals/doctors by specialty, location, availability, ratings.
- FR-3: Book, reschedule, cancel appointments (in-person or teleconsultation).
- FR-4: View real-time queue position and estimated wait time.
- FR-5: Access digital prescriptions, lab reports, and visit history.
- FR-6: Receive notifications (appointment reminders, queue updates, bed status).
- FR-7: Rate and review doctors/hospitals post-visit.
- FR-8: View and pay bills online; download invoices.
- FR-9: Family/dependent profile management (book on behalf of family members).

### 2.2 Doctor Portal
- FR-10: Doctor login with credential verification (license number, specialization).
- FR-11: Manage availability calendar (slots, leaves, OPD timings).
- FR-12: View daily patient queue with case summaries.
- FR-13: Access patient history, previous prescriptions, lab results.
- FR-14: Issue e-prescriptions and refer patients to specialists/labs.
- FR-15: Mark consultations complete; add consultation notes.
- FR-16: View personal performance metrics (patients seen, avg. consult time, ratings).

### 2.3 Hospital Admin Portal
- FR-17: Manage hospital profile (departments, doctors, facilities, services).
- FR-18: Onboard/offboard doctors and staff; assign roles and permissions.
- FR-19: Configure department-wise appointment slots and capacity.
- FR-20: Manage bed inventory (ICU, general, emergency, maternity) in real time.
- FR-21: Manage hospital-wide inventory (medicines, consumables, equipment).
- FR-22: View hospital-level analytics (occupancy, revenue, patient flow).
- FR-23: Configure pricing for consultations/procedures.
- FR-24: Handle patient complaints/escalations.

### 2.4 Appointment System
- FR-25: Real-time slot availability across departments/doctors.
- FR-26: Conflict detection (double-booking prevention).
- FR-27: Auto-reminders (SMS/email/push) at configurable intervals.
- FR-28: Waitlist management with auto-fill on cancellation.
- FR-29: Support recurring appointments (e.g., dialysis, physiotherapy).
- FR-30: Integration with Queue Prediction for dynamic slot buffering.

### 2.5 Bed Management
- FR-31: Real-time bed status dashboard (occupied/vacant/reserved/cleaning).
- FR-32: Bed reservation linked to admission requests.
- FR-33: Auto-alerts when bed occupancy crosses threshold (e.g., >90%).
- FR-34: Bed category management (ICU, general ward, isolation, maternity).
- FR-35: Discharge workflow triggering bed status update.
- FR-36: Cross-hospital bed availability visibility (network-level, for referrals).

### 2.6 Queue Prediction
- FR-37: Predict expected wait time per doctor/department using historical + live data.
- FR-38: Dynamic recalculation as consultations complete or run over time.
- FR-39: Notify patients when their turn is approaching (e.g., 3 patients away).
- FR-40: Flag anomalies (e.g., doctor delay) and auto-notify affected patients.

### 2.7 Hospital Recommendation Engine
- FR-41: Recommend hospitals based on symptom/specialty input, location, ratings, bed availability, and cost.
- FR-42: Personalize recommendations using patient history and preferences.
- FR-43: Emergency mode: prioritize nearest hospital with available beds/ICU for critical cases.
- FR-44: Explainability: show why a hospital was recommended (distance, rating, availability).

### 2.8 Analytics Dashboard
- FR-45: Hospital admin view: occupancy trends, patient inflow/outflow, revenue, department performance.
- FR-46: Doctor-level view: consultation volume, average wait time, patient satisfaction.
- FR-47: Platform-level view (for Medeasy internal ops): active users, booking conversion, churn.
- FR-48: Exportable reports (PDF/Excel) with configurable date ranges.
- FR-49: Real-time and historical (trend) views with drill-down filters.

### 2.9 Inventory Management
- FR-50: Track stock levels for medicines, consumables, and equipment per department.
- FR-51: Auto-generate reorder alerts based on threshold/consumption rate.
- FR-52: Supplier/vendor management with purchase order generation.
- FR-53: Batch and expiry tracking with expiry alerts.
- FR-54: Usage logging tied to patient consultations/procedures (for audit and billing).

---

## 3. Non-Functional Requirements

| Category | Requirement |
|---|---|
| **Performance** | API response time < 300ms (p95) for read operations; < 800ms for booking transactions |
| **Availability** | 99.9% uptime for core booking/queue services; 99.95% for emergency-related modules |
| **Scalability** | Support 100K+ concurrent users and 1000+ hospitals at launch scale |
| **Usability** | Mobile-first responsive design; WCAG 2.1 AA accessibility compliance |
| **Reliability** | Graceful degradation — booking system remains functional if recommendation engine or analytics is down |
| **Interoperability** | Support HL7/FHIR standards for future EHR integration |
| **Maintainability** | Modular microservices architecture with independent deployability |
| **Localization** | Multi-language support (English + regional languages), multi-currency ready |
| **Auditability** | Full audit trail for admin actions, prescriptions, and inventory changes |
| **Data Retention** | Configurable retention policy compliant with regional health data laws |

---

## 4. User Stories

### Patient
- As a patient, I want to search for the nearest available hospital for my symptoms so that I can get timely treatment.
- As a patient, I want to see my live queue position so that I don't waste time waiting at the hospital.
- As a patient, I want to book an appointment in under 2 minutes so that the process is quick and frictionless.
- As a patient, I want to view my past prescriptions so that I don't lose track of my medical history.
- As a patient in an emergency, I want to instantly find a hospital with an available ICU bed near me.

### Doctor
- As a doctor, I want to view my day's patient queue with case summaries so that I can prepare in advance.
- As a doctor, I want to set my leave/availability so that patients don't book slots I can't honor.
- As a doctor, I want to issue e-prescriptions directly from the portal so that I don't need paper records.

### Hospital Admin
- As a hospital admin, I want a real-time bed occupancy dashboard so that I can manage admissions efficiently.
- As a hospital admin, I want automated low-stock alerts so that critical medicines never run out.
- As a hospital admin, I want analytics on department performance so that I can optimize staffing.

### Platform/Internal
- As a platform operator, I want to monitor booking conversion rates so that I can identify drop-off points in the funnel.

---

## 5. Use Cases

### UC-1: Book an Appointment
- **Actor:** Patient
- **Precondition:** Patient is registered and logged in.
- **Flow:** Search doctor/hospital → View available slots → Select slot → Confirm booking → Receive confirmation notification.
- **Postcondition:** Slot is reserved; doctor's queue updated; reminders scheduled.
- **Exception:** Slot taken concurrently → system shows next available slot.

### UC-2: Emergency Hospital Discovery
- **Actor:** Patient/Caregiver
- **Precondition:** Location services enabled.
- **Flow:** Trigger emergency mode → Enter/select critical symptom → System filters hospitals by ICU/bed availability + proximity → Display ranked list with ETA.
- **Postcondition:** Patient/caregiver selects hospital; optionally triggers ambulance dispatch (future scope).

### UC-3: Bed Allocation on Admission
- **Actor:** Hospital Admin/Staff
- **Flow:** Receive admission request → Check bed availability by category → Allocate bed → Update patient record → Bed status changes to "Occupied".
- **Exception:** No beds available → system suggests nearby network hospital via Recommendation Engine.

### UC-4: Inventory Reorder
- **Actor:** Hospital Admin/Inventory Manager
- **Flow:** Stock level drops below threshold → System auto-generates reorder alert → Admin approves purchase order → Order sent to supplier → Stock updated on delivery confirmation.

### UC-5: Doctor Consultation Completion
- **Actor:** Doctor
- **Flow:** Doctor opens patient case → Conducts consultation → Adds notes/prescription → Marks complete → Queue advances → Analytics updated.

---

## 6. User Flow (Key Journey — Patient Booking to Consultation)

1. Patient opens app → Login/OTP verification
2. Patient searches by symptom or specialty
3. Recommendation Engine surfaces ranked hospitals/doctors
4. Patient views doctor profile, ratings, available slots
5. Patient selects slot → confirms booking → payment (if applicable)
6. Confirmation + calendar reminder sent
7. On appointment day: Queue Prediction sends live wait-time updates
8. Patient notified when 2–3 positions away
9. Patient checks in (QR/geofence or manual) → enters queue
10. Doctor consults → issues e-prescription → marks visit complete
11. Patient receives prescription + can rate the visit
12. Bed/discharge flow triggers only if admission is required

---

## 7. Feature Prioritization (MoSCoW)

| Priority | Features |
|---|---|
| **Must Have** | Patient Portal (core booking), Doctor Portal (calendar + consultation), Appointment System, Hospital Admin Portal (basic setup), Bed Management (real-time status) |
| **Should Have** | Queue Prediction, Analytics Dashboard (core metrics), Inventory Management (stock tracking) |
| **Could Have** | Hospital Recommendation Engine (advanced personalization), Cross-hospital bed visibility, Multi-language support |
| **Won't Have (v1)** | Ambulance dispatch integration, Full EHR/HL7 interoperability, AI-based diagnosis assistance, Insurance claim automation |

**Rationale:** Core booking + bed visibility solve the primary pain point (access to care). Prediction and recommendation layers add intelligence once baseline data volume exists to train/calibrate them. Advanced integrations are deferred to post-MVP phases.

---

## 8. Edge Cases

- **Appointment System:** Two patients book the last slot simultaneously (race condition) → need atomic slot-locking.
- **Appointment System:** Doctor cancels last-minute → auto-reassign or notify all affected patients with rebooking options.
- **Bed Management:** Bed marked "vacant" but not yet cleaned → require a "cleaning/turnover" intermediate state to prevent premature allocation.
- **Queue Prediction:** Doctor takes an unscheduled break → predictions must recalibrate live, not just extrapolate from historical averages.
- **Recommendation Engine:** No hospitals match filters in emergency mode → expand radius automatically and clearly flag reduced confidence.
- **Inventory:** Two departments consume from shared stock simultaneously → risk of negative inventory; needs transactional stock deduction.
- **Patient Portal:** Patient books for a dependent without a separate medical history → require minimal linked profile before booking.
- **Doctor Portal:** Doctor's license verification pending → restrict portal access to read-only/onboarding state until verified.
- **Payments:** Payment succeeds but booking confirmation fails (network drop) → reconciliation job to prevent charged-but-unbooked state.
- **Multi-hospital chains:** Same doctor practices across multiple branches → calendar must prevent cross-branch double-booking.

---

## 9. Scalability Requirements

- **Architecture:** Microservices per domain (Appointments, Beds, Inventory, Analytics, Recommendation) with independent scaling and deployment.
- **Data Layer:** Read replicas for high-read services (search, recommendation); write-optimized stores for transactional services (bookings, bed allocation).
- **Caching:** Cache hospital/doctor availability and recommendation results with short TTLs (seconds-level) to balance freshness and load.
- **Queueing:** Event-driven architecture (message broker) for cross-service updates (e.g., bed status change → recommendation engine refresh → analytics update).
- **Horizontal Scaling:** Stateless API services behind load balancers; auto-scaling based on traffic (e.g., seasonal illness surges, city-wide events).
- **Multi-region:** Support regional data residency and low-latency access as hospital network expands across geographies.
- **Prediction/ML Services:** Isolate Queue Prediction and Recommendation Engine as independently scalable inference services, decoupled from core transactional path so ML latency never blocks booking.

---

## 10. Security Requirements

- **Authentication:** OTP/MFA for patients; credential + license verification for doctors; role-based SSO for hospital admin staff.
- **Authorization:** Strict RBAC — doctors see only their patients; admins see only their hospital's data (unless network-level role).
- **Data Protection:** Encryption at rest (AES-256) and in transit (TLS 1.2+) for all health records and PII.
- **Compliance:** Alignment with applicable health data regulations (e.g., India's DPDP Act, and HIPAA-equivalent practices for any international deployment).
- **Audit Logging:** Immutable logs for all access to patient records, prescriptions, and admin actions.
- **Consent Management:** Explicit patient consent for data sharing across hospitals/doctors; consent withdrawal support.
- **Payment Security:** PCI-DSS compliant payment gateway integration; no raw card data stored on Medeasy servers.
- **Vulnerability Management:** Regular penetration testing, dependency scanning, and rate-limiting/anti-abuse on public-facing APIs.
- **Data Minimization:** Recommendation and Analytics engines operate on de-identified/aggregated data wherever possible.

---

## 11. Final Product Scope

### In Scope (v1 / MVP)
- Patient, Doctor, and Hospital Admin portals with core workflows
- Appointment booking with real-time slot management
- Bed management with real-time status tracking (single-hospital view)
- Basic queue prediction (rule-based + historical averages)
- Hospital recommendation (rule-based: specialty, distance, rating, availability)
- Core analytics dashboard (occupancy, bookings, revenue)
- Inventory management (stock tracking, reorder alerts)

### Out of Scope (v1, Future Phases)
- ML-driven predictive queue modeling (v1 uses rule-based/statistical approach; ML upgrade in v2)
- Cross-hospital network-wide bed visibility and referral automation
- Ambulance dispatch and emergency logistics integration
- Full EHR/HL7-FHIR interoperability with external hospital systems
- Insurance claims processing and automation
- AI-assisted diagnosis or clinical decision support
- Telemedicine video consultation (may be fast-followed post-MVP)

### Success Metrics
- Appointment booking completion rate > 90%
- Average queue wait-time prediction accuracy within ±10 minutes
- Bed status data freshness < 2 minutes lag
- Hospital admin adoption: 80% of onboarded hospitals actively using bed/inventory modules within 30 days
- Patient satisfaction (post-visit rating) average ≥ 4.2/5

---

*End of Document*
