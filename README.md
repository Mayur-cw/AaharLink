# AaharLink — Rescue Food. Connect Communities

A verified, atomic, civic surplus food rescue platform connecting restaurants, caterers, and food businesses with accredited community NGOs and soup kitchens. Built for extreme integrity, zero fabricated data, synchronous food safety handling declarations, and explainable multi-factor logistics.

---

## Problem

Urban food waste and community nutritional deficits coexist in severe disproportion. While commercial food businesses and catering halls routinely discard surplus portions of prepared meals, community kitchens and shelter NGOs struggle daily to meet food demand. Traditional coordination over social channels and ad-hoc spreadsheets fails systematically due to four critical vulnerabilities:

1. **Race Conditions & Double Allocation**: Multiple volunteers arrive for the same batch of food, causing wasted fuel, logistical frustration, and abandonment of future rescue efforts.
2. **Contact & Privacy Leakage**: Publishing donor phone numbers and private facility addresses indiscriminately exposes businesses to unauthorized solicitations and safety risks.
3. **Unverified Claims & False Impact**: Organizations routinely report unverified estimates of food rescued rather than actual physical quantities received on site.
4. **Food Safety & Cold-Chain Uncertainty**: Lack of factual, accountable declarations regarding preparation time, temperature preservation, and packaging integrity leads to hesitation and food spoiling before transit.

AaharLink resolves these systemic issues through a strict, state-machine-driven civic logistics pipeline featuring atomic first-to-claim guarantees, zero-contact leakage, one-time cryptographically hashed handover codes, and verified actual-portion reporting.

---

## Features

- **Multi-Role Organizational Onboarding (`REQ-AUTH`, `REQ-ROLES`)**: Dedicated onboarding workflows for Food Donors, NGOs, and Platform Coordinators. Registration enters a strict `pending` state requiring coordinator credential verification before surplus listings can be published or claimed.
- **Truthful Surplus Publishing & Safety Declarations (`REQ-DONOR`, `REQ-SAFE`)**: Donors declare portion counts, preparation timestamp, strict pickup deadlines, food category, and mandatory handling attestations (safe preparation, hot/cold temperature hold, clean packaging).
- **Explainable Match & Discovery Engine (`REQ-DISCOVER`, `REQ-MATCH`)**: NGOs discover nearby donations ranked by a transparent composite score: 45% urgency (approaching pickup deadline), 35% straight-line Haversine proximity, and 20% NGO vehicle capacity fit.
- **Atomic Exclusive Claiming & Concurrency Lock (`REQ-CLAIM`, `REQ-CONCURRENCY`)**: When multiple NGOs attempt to claim an active surplus batch simultaneously, database transactions enforce a strict exclusive lock. Exactly one NGO claims the batch (`201 Created`); the competitor receives an immediate conflict notice (`409 Conflict`) with zero contact or address information leaked.
- **Cryptographic 6-Digit Handover Verification (`REQ-HANDOVER`, `REQ-CODE`)**: When the donor marks the pickup ready on site, a secure 6-digit one-time handover code is generated using timing-safe HMAC hashing. The NGO driver verifies the code in person and enters the actual portion count physically loaded.
- **Atomic Two-Phase Transition & Verified Impact (`REQ-ANALYTICS`)**: Upon valid code entry, the platform atomically records `Collected` followed by `Completed` status. Operational metrics compute strictly from verified database rows, eliminating fabricated metrics.
- **Comprehensive Audit Trail & Dispute Resolution (`REQ-AUDIT`, `REQ-DISPUTE`)**: Every lifecycle action records an immutable, append-only audit event with correlation IDs, timestamps, and actor principals. Coordinators monitor real-time exception logs, unverified applicants, and contested pickups.
- **Authoritative Server Clock Expiry (`REQ-EXPIRY`)**: All state transitions enforce a strict server-authoritative deadline check. Unclaimed or uncollected donations past their deadline transition to `Expired`, releasing reserved vehicle capacity back to the NGO.

---

## Architecture

AaharLink is engineered with a strict separation of concerns, fail-closed access control, and zero external paid API dependencies:

```mermaid
flowchart TD
  subgraph Client [Browser / React 19 Client]
    UI[26 Accessible Pages P-001..P-026]
    AuthCtx[Auth Context & CSRF Interceptor]
    Tokens[Civic Logistics CSS Tokens]
  end

  subgraph Server [Express 5 Application]
    MW[Security Headers & Rate Limiters]
    Session[HttpOnly Session Store & Cookie Auth]
    Router[36 Typed API Endpoints EP-001..EP-036]
    Domain[Domain Services & State Transitions]
  end

  subgraph Database [SQLite WAL Storage]
    Repo[Repository Adapter]
    DB[(SQLite Native Database)]
    Triggers[Append-Only Audit Triggers]
  end

  UI --> AuthCtx
  AuthCtx -->|HTTPS + HttpOnly Cookie + CSRF Header| MW
  MW --> Session
  Session --> Router
  Router --> Domain
  Domain --> Repo
  Repo -->|BEGIN IMMEDIATE Transaction| DB
  DB --> Triggers
```

### Technology Stack
- **Frontend**: React 19, TypeScript, React Router 7, Vite 7, pure CSS Custom Properties (Civic Logistics Palette).
- **Backend**: Node.js 26, Express 5, Zod v3 contract validation, Helmet security headers, timing-safe crypto code hashing.
- **Persistence**: SQLite 3 with Write-Ahead Logging (WAL) enabled, foreign key enforcement, and append-only audit triggers.
- **Testing**: Vitest 3, Supertest, Axe-core accessibility engine, React Testing Library.

---

## Run

### Prerequisites
- Node.js >= 22.0.0 (Tested and optimized on Node.js v26.13.1)
- npm >= 10.0.0

### Local Development Setup

1. **Install Dependencies**:
   ```bash
   npm ci
   ```

2. **Seed Deterministic Demo Personas**:
   Populates the local SQLite database with verified organizational accounts, sample surplus items, and test listings:
   ```bash
   npm run seed:demo
   ```

3. **Start Development Server**:
   Launches both backend API on `:8080` and frontend client on `:5173`:
   ```bash
   npm run dev
   ```
   Open **`http://127.0.0.1:5173/`** in your browser.

### Local Demo Personas (LOCAL DEMO ONLY)

> [!WARNING]
> These credentials are strictly for local functional evaluation and test fixtures. They must never be used in a production deployment.

| Role | Email | Password | Persona Details |
| :--- | :--- | :--- | :--- |
| **Donor** | `donor@aaharlink.example` | `DemoDonor!2026` | Verified commercial kitchen ("Annapurna Kitchen") in Delhi |
| **NGO A** | `ngo-a@aaharlink.example` | `DemoNgoA!2026` | Verified relief organization ("Seva Food Rescue"), capacity: 60 |
| **NGO B** | `ngo-b@aaharlink.example` | `DemoNgoB!2026` | Verified community foundation ("Karuna Kitchen"), capacity: 80 |
| **Coordinator** | `coordinator@aaharlink.example` | `DemoCoord!2026` | Platform Operations Lead with audit and review powers |
| **Pending NGO** | `ngo-pending@aaharlink.example` | `DemoPending!2026` | Unverified applicant awaiting organizational review |

---

## Test

The test suite provides comprehensive coverage of all state machine transitions, access control policies, concurrent race conditions, and contractual UI surfaces:

```bash
# Run all unit, integration, and accessibility tests
npm test

# Run code coverage report (verifies >80% line coverage target)
npm run test:coverage

# Run contractual accessibility test sweep (Axe-core on all 26 pages)
npm run test:a11y

# Run full pre-release gate check (lint, typecheck, coverage, build, repo audit)
npm run check
```

### Verified Test Summary
- **135 automated tests passing** across 11 test suites.
- **100% pass rate** on the 8-step Golden Multi-Role Scenario (`tests/integration/golden-flow.test.ts`).
- **0 Axe accessibility violations** across all 26 contractual pages.
- **81.3% line coverage** on server and shared contracts.

---

## Security

AaharLink implements a strict defense-in-depth security model:

1. **Default-Deny Access Control**: Every endpoint verifies session validity, active organization membership, and explicit role permissions before processing requests. Anonymous and cross-organization requests fail closed with 401 or 403.
2. **Contact Redaction & Anti-Harvesting**: Donor telephone numbers and exact street addresses are scrubbed from public discovery endpoints (`/api/ngo/discover`) and are released exclusively to the winning NGO after an atomic claim is committed.
3. **Zero-Leak 409 Conflict Response**: If an NGO attempts to claim a listing that has already been awarded, the server issues a `409 Conflict` without leaking the winning organization or any contact information.
4. **Timing-Safe HMAC Handover Codes**: Pickup codes are hashed using `crypto.timingSafeEqual` to eliminate side-channel timing attacks. Code entry enforces a maximum of 3 failed attempts before permanent lockout.
5. **CSRF & Session Hardening**: Mutations require a valid `X-CSRF-Token` header matching the active session. Cookies use `HttpOnly`, `SameSite=Lax`, and `Secure` attributes in production.
6. **Immutable Audit Triggers**: SQLite triggers automatically record `INSERT` and `UPDATE` events to an append-only `audit_events` table, preventing manual record tampering.

---

## Accessibility

- **WCAG 2.1 Level AA Compliance**: All 26 pages (`P-001` through `P-026`) pass automated Axe-core accessibility scans with zero critical or serious issues.
- **Semantic HTML & Regional Landmarks**: Valid document heading hierarchy (`h1` $\rightarrow$ `h2` $\rightarrow$ `h3`), navigation landmarks, and `skip-link` shortcuts for keyboard users.
- **Accessible Form Controls**: Every input element includes explicit `<label>` bindings, descriptive helper text, and accessible `aria-invalid` and `role="alert"` regions.
- **Focus Indicators**: High-visibility 3px civic green outline (`#22744F`) on all interactive focusable elements with appropriate offset.
- **Reduced Motion Support**: Media queries respect user `prefers-reduced-motion` settings by neutralizing transitions and animations.

---

## Efficiency

- **Route-Level Code Splitting**: All 26 page views are dynamically loaded using React lazy-loading, keeping initial bundle size minimal (~88 kB gzipped main chunk).
- **Indexed Database Queries**: SQLite indexes cover active claims (`idx_claims_active_donation`), status deadlines (`idx_donations_status_deadline`), and organization lookups.
- **Paginated Endpoints**: Discovery, notifications, donation history, and audit ledger queries implement cursor and limit-offset pagination to avoid memory bloat.
- **Zero Heavy Assets**: System-native font stack, CSS-based icons and indicators, and zero external font or script dependencies.

---

## Google services

AaharLink is architecturally pre-configured for frictionless deployment to Google Cloud:

- **Google Cloud Run**: The application is containerized with a production multi-stage Dockerfile that runs as a dedicated non-root user (`USER node`) on port 8080.
- **Google Cloud Secret Manager**: Production database encryption keys, cookie session secrets, and coordinator bootstrap tokens can be mounted directly into the Cloud Run container via secret volume mounts.
- **Google Cloud Monitoring & Logging**: Structured JSON log outputs include standard severity tags (`INFO`, `WARN`, `ERROR`), request latency metrics, and distributed tracing correlation IDs (`X-Correlation-Id`).
- **Google Maps Optimization (Architectural Design)**: The matching engine utilizes internal Haversine mathematics for zero-cost operation. When integrated with Google Maps Distance Matrix or Geocoding APIs, coordinates can be enriched without altering the core ranking contracts.

---

## Deployment

### Container Build

```bash
# Build production container image
docker build -t aaharlink:latest .

# Run container locally on port 8080
docker run -p 8080:8080 -e NODE_ENV=production aaharlink:latest
```

### Production Deployment Script

To deploy to Google Cloud Run:

```bash
bash scripts/deploy.sh <PROJECT_ID> <REGION> aaharlink-service
```

The script builds the image via Cloud Build, configures container environment variables, and deploys to Cloud Run with automatic SSL and auto-scaling.

---

## Requirement table

| Requirement | Description | Implementation Path | Verification Test |
| :--- | :--- | :--- | :--- |
| **REQ-BOOT** | Service health and environment readiness | `src/server/app.ts` | `tests/integration/health.test.ts` |
| **REQ-AUTH** | Cookie session management, CSRF, and rate limiting | `src/server/authz.ts`, `src/server/session.ts` | `tests/integration/authz.test.ts` |
| **REQ-ROLES** | Multi-role authorization (Donor, NGO, Coordinator) | `src/server/routes/auth.ts` | `tests/integration/identity.test.ts` |
| **REQ-DONOR** | Surplus creation, updates, and cancellations | `src/server/routes/donor.ts` | `tests/integration/donor.test.ts` |
| **REQ-SAFE** | Mandatory food safety and temperature attestations | `src/shared/contracts.ts` | `tests/unit/repository.test.ts` |
| **REQ-DISCOVER**| NGO surplus discovery with contact redaction | `src/server/routes/ngo.ts` | `tests/integration/claims-race.test.ts` |
| **REQ-MATCH** | Urgency, distance, and capacity ranking | `src/server/routes/ngo.ts` | `tests/integration/claims-race.test.ts` |
| **REQ-CLAIM** | Exclusive atomic surplus claim commitment | `src/server/routes/ngo.ts`, `repository.ts` | `tests/integration/claims-race.test.ts` |
| **REQ-CONCURRENCY**| Concurrency conflict lock with zero contact leak | `src/server/routes/ngo.ts` | `tests/integration/claims-race.test.ts` |
| **REQ-HANDOVER**| On-site pickup readiness confirmation | `src/server/routes/donor.ts` | `tests/integration/golden-flow.test.ts` |
| **REQ-CODE** | Timing-safe HMAC 6-digit one-time code verification | `src/server/routes/ngo.ts`, `repository.ts` | `tests/integration/golden-flow.test.ts` |
| **REQ-ANALYTICS**| Database-derived platform impact analytics | `src/server/domain/analytics.ts` | `tests/integration/coordinator.test.ts` |
| **REQ-AUDIT** | Append-only immutable audit trail recording | `src/server/routes/coordinator.ts` | `tests/integration/coordinator.test.ts` |
| **REQ-DISPUTE** | Exception reporting and resolution management | `src/server/routes/coordinator.ts` | `tests/integration/coordinator.test.ts` |
| **REQ-EXPIRY** | Authoritative clock expiry reconciliation | `src/server/domain/expiry.ts` | `tests/integration/expiry.test.ts` |
| **REQ-DEMO** | Deterministic seed accounts and personas | `src/server/db/seed.ts` | `tests/unit/repository.test.ts` |
| **REQ-A11Y** | Zero Axe accessibility violations across all pages | `src/client/pages/*` | `tests/a11y/pages.test.tsx` |
| **REQ-PERF** | Sub-second builds and lean bundle size (<300kB) | `vite.config.ts` | `scripts/check-repo.sh` |
