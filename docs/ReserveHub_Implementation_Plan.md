# ReserveHub — Requirements and Implementation Plan

| Document property     | Value                                                                                |
| --------------------- | ------------------------------------------------------------------------------------ |
| System                | ReserveHub — Office Resource Reservation Management System                           |
| Project               | PrimeWave Lab Software Engineering Internship Technical Assessment                   |
| Version               | 3.1                                                                                  |
| Last updated          | 13 October 2026                                                                      |
| Submission deadline   | 15 October 2026, 11:59 PM (Asia/Colombo, UTC+05:30)                                  |
| Repository            | [ishara-dhanushan/Reserve-Hub](https://github.com/ishara-dhanushan/Reserve-Hub)      |
| Implementation status | Foundation in progress; functional requirements are specified, not presumed complete |

## 1. Purpose and scope

ReserveHub provides a single location for employees to manage shared office resources and reserve them for defined periods. It replaces informal booking arrangements that make resource availability difficult to establish and allow conflicting bookings.

The application is a focused Next.js full-stack system backed by PostgreSQL. It provides user registration and login, collaborative resource management, organization-wide reservation visibility, and reliable prevention of overlapping confirmed reservations.

The internship assessment specifies Next.js App Router, TypeScript, PostgreSQL, Git/GitHub, a locally runnable application, a setup README, a shareable entity-relationship diagram, and a 3–5-minute demonstration video. The particular authentication, resource lifecycle, and reservation policies in this document are application design requirements rather than additional employer mandates.

### 1.1 Delivery priorities

| Priority         | Scope                                                                                                                                                                                                              | Delivery rule                                    |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------ |
| P0 — Required    | Authentication; resource management; reservation creation, viewing, rescheduling and cancellation; ownership authorization; conflict prevention; documentation and submission artifacts                            | Complete and verify before optional enhancements |
| P1 — Enhancement | Search and filters; richer dashboard summaries; expanded automated tests; visual polish                                                                                                                            | Implement only when P0 workflows are reliable    |
| P2 — Excluded    | Role-based access control, approval workflows, payments, recurring reservations, email verification, password recovery, notifications, external calendar synchronization, audit logging and multiple organizations | Do not introduce during MVP delivery             |

A resource represents a single exclusive bookable unit. A meeting room with a capacity of twelve is still one resource, not twelve independently reservable seats. Equipment records likewise represent distinct physical items.

### 1.2 Primary user journey

1. Open the public landing page and navigate to registration or login.
2. Register an account and sign in.
3. Arrive at the management dashboard containing direct access to Resources and Reservations.
4. Create or inspect a resource.
5. Check whether a future period is available and create a reservation.
6. View reservations created by all registered users.
7. Edit or cancel a future confirmed reservation only when the current user is its creator.
8. Receive an explicit conflict response when the requested time overlaps another confirmed reservation.

## 2. Actors and permissions

The system has one registered-user type. The `User` model contains no role field and the application has no administrator-only endpoints.

| Operation                                                     | Visitor | Authenticated user | Reservation creator only |
| ------------------------------------------------------------- | :-----: | :----------------: | :----------------------: |
| View public landing page                                      |   Yes   |        Yes         |            No            |
| Register or log in                                            |   Yes   |        Yes         |            No            |
| Access dashboard, resources and reservations                  |   No    |        Yes         |            No            |
| Create, view or edit a resource                               |   No    |        Yes         |            No            |
| Deactivate an eligible resource                               |   No    |        Yes         |            No            |
| Permanently delete a never-reserved resource                  |   No    |        Yes         |            No            |
| Check availability and create a booking                       |   No    |        Yes         |            No            |
| Read all reservations and creator names                       |   No    |        Yes         |            No            |
| Edit or cancel a future confirmed reservation                 |   No    |        Yes         |           Yes            |
| Edit or cancel an ongoing, completed or cancelled reservation |   No    |         No         |      Not permitted       |
| Permanently delete a reservation                              |   No    |         No         |      Not permitted       |

The `createdById` field on a resource records attribution, not exclusive editing permission. Every authenticated user may manage all resource records, subject to lifecycle restrictions. Reservation ownership never changes after creation.

**Security requirement:** Interface controls are not an authorization boundary. API handlers and server-side business functions must verify the authenticated user and enforce ownership and lifecycle rules independently of the browser.

## 3. Technical stack and tooling

| Layer          | Technology                           | Purpose                                                                             |
| -------------- | ------------------------------------ | ----------------------------------------------------------------------------------- |
| Application    | Next.js 16 App Router                | Server Components, pages and HTTP Route Handlers                                    |
| Language       | TypeScript                           | Typed application and data contracts                                                |
| UI styling     | Tailwind CSS 4                       | Responsive layout and styling                                                       |
| Components     | shadcn/ui, Radix UI, Nova preset     | Accessible base interface components                                                |
| Icons          | Lucide React                         | SVG interface icons                                                                 |
| Animation      | Motion (`motion/react`)              | Limited, accessible client-side transitions                                         |
| Fonts          | Geist and Geist Mono                 | Interface typography                                                                |
| Validation     | Zod                                  | Request and form validation                                                         |
| Authentication | `jose`, `bcryptjs`, HttpOnly cookies | JWT signing/verification and password hashing                                       |
| Database       | Neon PostgreSQL                      | Persistent relational storage and overlap constraint                                |
| ORM            | Prisma 7 with Neon adapter           | Typed database access and reviewed SQL migrations                                   |
| Code quality   | ESLint and Prettier                  | Static linting and consistent formatting                                            |
| CI             | GitHub Actions, Node.js 24           | Dependency installation, Prisma generation, format check, lint and production build |

Keep the application in a single Next.js repository. Separate service deployment, Redis, Docker, background workers and microservices are not required.

### 3.1 Repository workflow

- `main` is the integration and delivery branch.
- Features and fixes are developed on short-lived `feature/**` and `fix/**` branches.
- Pull requests target `main`; CI runs for PRs to `main` and pushes to `main`, `feature/**` and `fix/**`.
- Review changes, run local checks, and verify CI before merging.
- A successful build or CI run does not by itself establish correctness of database-backed business operations.

### 3.2 Existing foundation

The repository includes Prisma schema and Neon configuration, database setup and migration guides, shadcn/ui initialization, Lucide React, Motion, and a GitHub Actions workflow. Completion of authentication and reservation functionality must be established through separate implementation and testing. Avoid duplicating previously completed setup tasks.

## 4. Page architecture and interface organization

### 4.1 Route and navigation model

The public website and authenticated application use the same Next.js App Router tree without additional route groups. Headers and footers are rendered only by pages requiring them, not by the root layout.

| Route                           | Access                                   | Page purpose                                      | Navigation components           |
| ------------------------------- | ---------------------------------------- | ------------------------------------------------- | ------------------------------- |
| `/`                             | Public                                   | Simple introductory landing page                  | Public header and public footer |
| `/login`                        | Public, redirects authenticated visitors | Sign in                                           | No header or footer             |
| `/signup`                       | Public, redirects authenticated visitors | Account registration                              | No header or footer             |
| `/dashboard`                    | Authenticated                            | Main management entry point                       | Application header              |
| `/resources`                    | Authenticated                            | Resource catalogue and actions                    | Application header              |
| `/resources/new`                | Authenticated                            | Resource creation                                 | Application header              |
| `/resources/[resourceId]`       | Authenticated                            | Resource information and reservations             | Application header              |
| `/resources/[resourceId]/edit`  | Authenticated                            | Resource editing                                  | Application header              |
| `/reservations`                 | Authenticated                            | All reservations, including other users' bookings | Application header              |
| `/reservations/new`             | Authenticated                            | Reservation creation                              | Application header              |
| `/reservations/[reservationId]` | Authenticated                            | Reservation detail and eligible owner actions     | Application header              |

The public landing page is intentionally minimal in the initial release. It contains ReserveHub branding, a short product description, and login/signup calls to action. A more elaborate public landing page is a subsequent design enhancement and must not block core functions.

After a successful login, navigate to `/dashboard`. The dashboard presents clear entry points to **Resources** and **Reservations**, not fabricated metrics or unnecessary analytics. A richer dashboard can be added after the core flows are functional.

The `/signup` browser route uses `POST /api/auth/register` for account creation. The user-facing route name and API endpoint serve different purposes and are intentionally different.

### 4.2 Server and Client Component boundaries

- Every `page.tsx` is a **Server Component**. Do not add `"use client"` to page files.
- Each `page.tsx` exports route-specific `metadata` with an appropriate browser title and description. The root layout provides a title template and default metadata.
- For dynamic routes, use server-side `generateMetadata` only when entity-dependent titles are useful and safely available; a static route-specific title is sufficient for the MVP.
- Introduce separate Client Components only for interactions requiring browser state or hooks: authentication forms, mobile navigation, filters, confirmation dialogs, reservation inputs, and Motion animations.
- Database access, JWT verification, and server-only secrets stay in server modules and are never imported into Client Components.
- Server Components can import Client Components. The root layout remains a Server Component even though it renders the client-side `AuthProvider`.
- Shared headers and footers are imported explicitly into pages that render them. The root layout never renders a global header or footer.

Example route metadata:

```tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Resources",
  description: "Browse and manage shared office resources.",
};
```

With `title.template = "%s | ReserveHub"` in the root layout, the resulting browser tab title is `Resources | ReserveHub`.

### 4.3 Component placement and reuse

A component is placed in `src/components/` only when it is genuinely reusable across different application features or pages. Components specific to one feature remain within that feature's route directory.

**Use a single `components/` directory for each major route.** All resource-specific components are placed in `src/app/resources/components/`, whether used by the resource list, details, create form or edit screen. All reservation-specific components are placed in `src/app/reservations/components/`. Do not create nested `components/` directories under `new`, `[resourceId]`, `edit`, or other subroutes.

Examples:

| Component                                         | Location                               | Reason                                            |
| ------------------------------------------------- | -------------------------------------- | ------------------------------------------------- |
| shadcn Button, Card, Dialog                       | `src/components/ui/`                   | Reusable base UI                                  |
| `ProtectedRoute`                                  | `src/components/auth/`                 | Used by several protected pages                   |
| Application navigation                            | `src/components/layout/app-header.tsx` | Used by dashboard, resource and reservation pages |
| Landing header and footer                         | `src/app/components/`                  | Used only by the landing page                     |
| Landing animation or hero                         | `src/app/components/`                  | Landing-page-specific behavior                    |
| Dashboard tiles / entry cards                     | `src/app/dashboard/components/`        | Dashboard-specific display                        |
| Resource form, list row and action dialog         | `src/app/resources/components/`        | Shared within resource feature only               |
| Reservation form, availability picker and actions | `src/app/reservations/components/`     | Shared within reservation feature only            |
| Login form                                        | `src/app/login/components/`            | Login-specific behavior                           |
| Signup form                                       | `src/app/signup/components/`           | Signup-specific behavior                          |

A page does not require a separate component file for purely static markup. Avoid abstractions used only once unless they isolate substantial client-side interaction.

### 4.4 Responsive, accessible UI

- Use clear layouts for desktop and mobile screens; content must not overflow horizontally.
- Ensure labels match fields, keyboard focus is visible, error messages are readable, and dialogs have accessible titles and descriptions.
- Show loading, empty and error states rather than mock statistics or invented resource data.
- Use shadcn/ui for common accessible interactions and Lucide React for consistent icons.
- Use Motion only for restrained client-side transitions; honor reduced-motion preferences. Standard focus and hover states should generally use CSS.
- Do not introduce an advanced calendar, charting framework, or multi-level navigation merely to demonstrate visual complexity.

## 5. Authentication and session management

### AUTH-01 — Registration

**Browser page:** `/signup`  
**Endpoint:** `POST /api/auth/register`  
**Access:** Public

| Input             | Validation                                                                |
| ----------------- | ------------------------------------------------------------------------- |
| `name`            | Required, trimmed, 2–100 characters                                       |
| `email`           | Required, trimmed, lowercase, valid email, maximum 254 characters, unique |
| `password`        | Required, 8–72 UTF-8 bytes for bcrypt                                     |
| `confirmPassword` | Required in the form and must equal password; not persisted               |

Validate requests with Zod, hash passwords using `bcryptjs`, and persist the `User` record. Registration returns a successful result and directs the user to `/login`. Registration does not automatically create a session in the MVP. Duplicate normalized email returns 409; invalid input returns 400. Never store or return plaintext passwords or password hashes.

### AUTH-02 — Login

**Browser page:** `/login`  
**Endpoint:** `POST /api/auth/login`  
**Access:** Public

Normalize the email, locate the corresponding user, compare bcrypt password hashes, and issue a signed JWT through a session cookie. Invalid credentials return 401 with the same generic message regardless of whether the email or password was incorrect. The token is never returned in response JSON or written to local storage.

After the cookie is set and the auth context is refreshed, the browser navigates to `/dashboard`. Authenticated visits to `/login` or `/signup` redirect to `/dashboard`.

### AUTH-03 — JWT and cookie security

- Sign and verify JWTs using `jose` with HS256 and an unpredictable `JWT_SECRET` of at least 32 bytes, stored in server-only environment configuration.
- JWT validity is 12 hours, with signature, issuer and expiry verification.
- Cookie name is `reservehub_session`, with `HttpOnly`, `SameSite=Lax`, `Path=/`, and `Secure` in production HTTPS. Align maximum age with token expiry.
- Verify that the user identified by the JWT subject still exists.
- Check request origin for state-changing cookie-authenticated requests to reduce CSRF exposure.
- Treat the JWT subject as the source of user identity for every write. Ignore or reject client-supplied owner/creator identifiers.
- No refresh token, account-wide forced logout, token revocation list, or email-based recovery is required.

### AUTH-04 — Auth context and navigation

Implement `AuthProvider` in `src/context/auth-context.tsx`, imported by `src/app/layout.tsx`.

The provider is a Client Component exposing the current public user (`id`, `name`, `email`), loading state, and a method to refresh the session. It reads identity from `GET /api/auth/me` using the HttpOnly cookie; it must not read the JWT itself.

`ProtectedRoute` belongs in `src/components/auth/protected-route.tsx` and is rendered **only by pages that require authentication**. When session loading has completed and the user is not authenticated, the component navigates to `/login`; authenticated content is not displayed during the loading check. A successful logout clears the cookie, resets/refetches context, and navigates to the public site or login.

The auth context and client-side `ProtectedRoute` improve navigation and user experience; they do **not** constitute a security boundary. A protected Server Component must call a server-side session helper such as `requireUser()` before fetching or rendering private data, and redirect unauthenticated requests to `/login`. Every protected API route separately verifies identity and authorization and returns 401/403 where appropriate. Never place private database results into HTML or serialized React props before completing the server check.

The `GET /api/auth/me` endpoint returns only public user fields or 401; `POST /api/auth/logout` clears the session cookie.

**Implementation dependency:** UI foundation work may create public headers, static pages and navigation before authentication exists. Protected pages must not rely on a simulated authenticated user or a permanently successful stub. Complete auth context, protected navigation and server checks alongside working auth APIs.

### AUTH-05 — Ownership authorization

- Resource CRUD and eligible deactivation are available to all authenticated users.
- All authenticated users can view all reservations.
- Only a reservation's original creator can change or cancel their future confirmed reservation.
- Ownership and eligibility are validated in the server service or route handler on every mutation, even when the UI hides controls.
- Non-owner updates to existing reservations return 403. Missing reservations return 404. Reservation ownership cannot be transferred.

## 6. Resource management

### RES-01 — Resource catalogue and detail

**Routes:** `/resources`, `/resources/[resourceId]`  
**Endpoints:** `GET /api/resources`, `GET /api/resources/[resourceId]`

Display all active and inactive resources with name, type, location, optional capacity and description, status and original creator. Resource detail can show future reservations and availability. Search by text/type/status is a P1 enhancement; reliable listing and detail are P0.

### RES-02 — Create resource

**Route:** `/resources/new` (or an accessible creation dialog)  
**Endpoint:** `POST /api/resources`

| Field         | Validation                            |
| ------------- | ------------------------------------- |
| `name`        | Required, trimmed, 2–100 characters   |
| `type`        | `MEETING_ROOM` or `EQUIPMENT`         |
| `location`    | Required, trimmed, 2–120 characters   |
| `capacity`    | Optional positive integer             |
| `description` | Optional text, maximum 500 characters |

The server populates `createdById` from the authenticated JWT and sets `isActive = true` by default. Duplicate resource names are allowed; identity is established by the unique resource ID. On success, the created record is persisted and displayed in the catalogue.

### RES-03 — Edit resource

**Route:** `/resources/[resourceId]/edit` (or dialog)  
**Endpoint:** `PATCH /api/resources/[resourceId]`

Any authenticated user may update the resource's editable fields. Do not allow clients to overwrite `id`, `createdById`, or `createdAt`. Display the original creator after another user edits the resource. Return appropriate validation and missing-record errors.

### RES-04 — Deactivate and reactivate

An inactive resource remains visible and preserves reservation history, but cannot accept new bookings. Deactivation is prohibited while there is any `CONFIRMED` reservation with `endAt > now`, including ongoing or future bookings. Completed or cancelled reservations do not prevent deactivation. Reactivation is permitted and allows new bookings, subject to subsequent availability checks.

Deactivation must be validated on the server, coordinated with concurrent booking writes, and return 409 when an active or upcoming confirmed booking prevents the change. Do not silently cancel existing reservations.

### RES-05 — Permanent deletion

**Endpoint:** `DELETE /api/resources/[resourceId]`

Hard deletion is permitted **only when the resource has never been referenced by any reservation**. Historical cancelled and completed reservations also block deletion.

| Condition                                            | Result                                                 |
| ---------------------------------------------------- | ------------------------------------------------------ |
| Zero reservation records reference the resource      | Delete the resource; return 204                        |
| At least one reservation of any status references it | Return 409 with guidance about deactivation            |
| An ongoing or future confirmed reservation exists    | Hard-delete remains blocked; deactivation also blocked |

Preserve the database foreign key with `onDelete: Restrict`. Deletion and deactivation are different operations; do not convert one into the other automatically.

## 7. Reservation management

### BOOK-01 — Create reservation

**Route:** `/reservations/new` (or booking dialog)  
**Endpoint:** `POST /api/reservations`

Required inputs: `resourceId`, `purpose`, `startAt`, and `endAt`. The purpose is trimmed and validated, typically 3–200 characters. Derive `userId` only from the authenticated session.

Creation flow: select resource → choose a future interval → inspect availability → enter purpose → submit → validate on the server → insert a confirmed reservation when no conflict exists → display feedback.

### BOOK-02 — Time and status semantics

- `startAt` must be strictly in the future when a reservation is created.
- `endAt` must be strictly later than `startAt`.
- Persist instants using PostgreSQL `timestamptz(3)`; display in the configured `Asia/Colombo` local time.
- Intervals are half-open: `[startAt, endAt)`. A reservation ending at 10:00 and one starting at 10:00 do not overlap.
- Store only `CONFIRMED` and `CANCELLED` statuses.
- Derive `Upcoming`, `Ongoing` and `Completed` presentation labels from timestamps for confirmed reservations. A cancelled booking displays `Cancelled` regardless of time.
- No cron task, timezone selector, minimum duration tier or recurring-booking engine is part of the MVP.

### BOOK-03 — Prevent overlapping bookings

Two confirmed reservations on the same resource overlap when:

```text
existing.startAt < requested.endAt
AND existing.endAt > requested.startAt
```

Use a server query to produce helpful feedback, but rely on a PostgreSQL exclusion constraint to provide the final concurrency guarantee. Cancelled reservations do not block availability.

An illustrative migration, to be adapted and reviewed against the generated schema, is:

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "Reservation"
  ADD CONSTRAINT "reservation_confirmed_no_overlap"
  EXCLUDE USING gist (
    "resourceId" WITH =,
    tstzrange("startAt", "endAt", '[)') WITH &&
  )
  WHERE ("status" = 'CONFIRMED');
```

Inspect the actual PostgreSQL enum and constraint names in the migration before execution. This is a database constraint, not a replacement for validating resource existence, active state and time ordering.

Concurrent attempts to reserve the same resource and overlapping interval must produce **at most one successful insert**. Translate exclusion-constraint violations into HTTP 409 without exposing raw SQL messages.

### BOOK-04 — List and view reservations

**Routes:** `/reservations`, `/reservations/[reservationId]`  
**Endpoints:** `GET /api/reservations`, `GET /api/reservations/[reservationId]`

Show records for all registered users, including resource, purpose, creator display name, start/end time and derived status. All/Mine and status filters are useful enhancements but should not delay the core listing. Never expose password hashes or private session data in responses.

### BOOK-05 — Edit or reschedule own reservation

**Endpoint:** `PATCH /api/reservations/[reservationId]`

Only the original creator may modify purpose or time, and only when the record is currently `CONFIRMED` and its **existing** `startAt` is strictly later than now. Validate the proposed interval, active resource and overlap policy. A rejected change must leave the original reservation unchanged. The booking owner is immutable.

### BOOK-06 — Cancel own reservation

**Endpoint:** `POST /api/reservations/[reservationId]/cancel`

Cancellation is allowed only for the creator of a future confirmed reservation. Set the stored status to `CANCELLED` without deleting the record. The released interval becomes available for new confirmed bookings. Ongoing, completed and already cancelled reservations are not editable or cancellable.

### BOOK-07 — Availability lookup

**Endpoint:** `GET /api/resources/[resourceId]/availability` with a validated requested interval.

Return whether the resource is active and whether any confirmed reservation overlaps the requested interval. Include informative conflicts when useful, but avoid returning private user fields. Availability responses are advisory; the final database insert must independently enforce the exclusion constraint.

### BOOK-08 — Reservation lifecycle matrix

| Booking state        | Visible to authenticated users | Creator can edit/cancel |       Blocks availability        |
| -------------------- | :----------------------------: | :---------------------: | :------------------------------: |
| Future, confirmed    |              Yes               |           Yes           |               Yes                |
| Ongoing, confirmed   |              Yes               |           No            |          Yes until end           |
| Completed, confirmed |              Yes               |           No            | Only for its historical interval |
| Cancelled            |              Yes               |           No            |                No                |

## 8. Database schema and entity relationships

### 8.1 Entities

The relational model comprises three entities: `User`, `Resource` and `Reservation`. The project ER diagram must describe the same model and cardinalities as the Prisma schema.

**User**

| Field          | Type                     | Rule                         |
| -------------- | ------------------------ | ---------------------------- |
| `id`           | UUID                     | Primary key                  |
| `name`         | Text                     | Required                     |
| `email`        | Text                     | Required, unique, normalized |
| `passwordHash` | Text                     | Required, server-only        |
| `createdAt`    | Timestamp with time zone | Creation timestamp           |

**Resource**

| Field         | Type                     | Rule                          |
| ------------- | ------------------------ | ----------------------------- |
| `id`          | UUID                     | Primary key                   |
| `name`        | Text                     | Required                      |
| `type`        | `ResourceType`           | `MEETING_ROOM` or `EQUIPMENT` |
| `location`    | Text                     | Required                      |
| `capacity`    | Integer, nullable        | Positive when supplied        |
| `description` | Text, nullable           | Optional                      |
| `isActive`    | Boolean                  | Defaults to true              |
| `createdById` | UUID                     | Required foreign key to User  |
| `createdAt`   | Timestamp with time zone | Creation timestamp            |
| `updatedAt`   | Timestamp with time zone | Updated on modification       |

**Reservation**

| Field        | Type                     | Rule                                           |
| ------------ | ------------------------ | ---------------------------------------------- |
| `id`         | UUID                     | Primary key                                    |
| `userId`     | UUID                     | Required foreign key to User; immutable owner  |
| `resourceId` | UUID                     | Required foreign key to Resource               |
| `purpose`    | Text                     | Required                                       |
| `startAt`    | Timestamp with time zone | Beginning of interval                          |
| `endAt`      | Timestamp with time zone | End of interval; greater than start            |
| `status`     | `ReservationStatus`      | `CONFIRMED` or `CANCELLED`; defaults confirmed |
| `createdAt`  | Timestamp with time zone | Creation timestamp                             |

### 8.2 Relationships and cardinalities

- One User **creates** zero or many Resources; a Resource has exactly one original creator.
- One User **makes** zero or many Reservations; a Reservation has exactly one creator/owner.
- One Resource **has** zero or many Reservations; a Reservation references exactly one Resource.

Resource and reservation foreign keys use `onDelete: Restrict` so the system cannot erase records needed to preserve attribution or booking history. The application does not implement user deletion in the MVP.

### 8.3 Indexes and database safeguards

Recommended indexes follow the implemented schema:

- User: unique email index.
- Resource: `createdById`, `isActive`.
- Reservation: `(resourceId, startAt)`, `(userId, startAt)`, `(status, startAt)`.
- Reservation: PostgreSQL GiST exclusion constraint on resource ID and confirmed time interval.

A `CHECK ("endAt" > "startAt")` constraint may be added to the migration for defense in depth; ensure schema and migration documentation record any additional database constraints.

### 8.4 Neon and Prisma configuration

Prisma 7 uses the generated client from `src/generated/prisma/`, with runtime access through the Neon adapter in `src/lib/prisma.ts`. The generated folder is not committed to Git; run Prisma generation on installation and in CI.

Use separate environment variables:

| Variable       | Use                                                                |
| -------------- | ------------------------------------------------------------------ |
| `DATABASE_URL` | Runtime Neon database connection (pooled connection as configured) |
| `DIRECT_URL`   | Prisma CLI/migration connection                                    |
| `JWT_SECRET`   | Server-only signing secret                                         |

Never commit actual connection strings or JWT secrets. Consult `docs/NeonDB_Setup_Guide.md` and `docs/Prisma_Migrations_Guide.md` for detailed configuration and environment setup.

### 8.5 Migration workflow

All persistent schema changes must be represented by committed, reviewed Prisma migration SQL. Database schema synchronization is not achieved by editing `schema.prisma` alone.

```bash
npm run prisma:validate
npm run prisma:migrate:dev -- --name descriptive_change
```

Inspect the new `prisma/migrations/<timestamp>_descriptive_change/migration.sql`, including any manually added exclusion and check constraints. After review:

```bash
npm run prisma:migrate:deploy
npm run prisma:generate
npm run prisma:migrate:status
```

`prisma migrate deploy` applies all pending migrations to the configured database; confirm the environment and database before running it. Do not use `prisma db push` as the normal delivery workflow and do not silently rewrite or squash migration history. Generated client output does not imply migrations have been applied.

## 9. Concurrency and consistency

### 9.1 Reservation write ordering

The critical invariants are that a resource cannot be booked twice for overlapping confirmed intervals and cannot be deactivated while it has a confirmed booking that is ongoing or in the future.

The booking service should:

1. Authenticate the caller and validate input.
2. Confirm that the resource exists and is active.
3. Validate the interval and provide an advisory availability check.
4. Insert within a transaction consistent with resource lifecycle operations.
5. Let the database exclusion constraint resolve concurrent conflicting writes.
6. Translate recognized constraint failures to 409 and preserve other database errors as internal failures.

A check-then-insert without database enforcement is insufficient because two requests can check the same free interval concurrently.

### 9.2 Booking versus resource deactivation

A booking insert and a resource deactivation can race even if each operation performs a normal query. Use a consistent transaction strategy, such as acquiring a lock on the relevant Resource row before either operation checks or changes reservation eligibility. Keep the same lock order across both operations. Ensure that a transaction that deactivates a resource cannot commit while an otherwise accepted booking is inserted against the same resource.

The exact locking strategy must be validated using the selected Prisma/Neon adapter and an integration test. If the adapter cannot support the chosen transaction/lock arrangement, select and document a compatible strategy instead of relying on UI restrictions.

### 9.3 Edit and cancellation atomicity

- Apply the ownership and upcoming-status checks against the current database record, not client-submitted values.
- For rescheduling, leave the original interval intact if validation or overlap prevention fails.
- Cancellation updates one record's status; it does not delete related data.
- Use fresh server time for eligibility checks and a single authoritative database operation or transaction to avoid stale-read mutations.
- Protect against duplicate submits with a disabled loading state for usability, while relying on the server for actual correctness.

## 10. HTTP API contract

Next.js Route Handlers form the application HTTP API. All non-auth resource and reservation endpoints require a validated session. Use typed server-side service modules rather than embedding business rules separately in page components and handlers.

### 10.1 Endpoint reference

| Method | Endpoint                                   | Purpose                         | Access        |
| ------ | ------------------------------------------ | ------------------------------- | ------------- |
| POST   | `/api/auth/register`                       | Register user                   | Public        |
| POST   | `/api/auth/login`                          | Set JWT cookie                  | Public        |
| POST   | `/api/auth/logout`                         | Clear session cookie            | Authenticated |
| GET    | `/api/auth/me`                             | Current public user profile     | Authenticated |
| GET    | `/api/resources`                           | List resources                  | Authenticated |
| POST   | `/api/resources`                           | Create resource                 | Authenticated |
| GET    | `/api/resources/[resourceId]`              | Resource detail                 | Authenticated |
| PATCH  | `/api/resources/[resourceId]`              | Edit or change active state     | Authenticated |
| DELETE | `/api/resources/[resourceId]`              | Delete never-reserved resource  | Authenticated |
| GET    | `/api/resources/[resourceId]/availability` | Check a requested interval      | Authenticated |
| GET    | `/api/reservations`                        | List all reservations           | Authenticated |
| POST   | `/api/reservations`                        | Create reservation              | Authenticated |
| GET    | `/api/reservations/[reservationId]`        | Reservation detail              | Authenticated |
| PATCH  | `/api/reservations/[reservationId]`        | Edit own eligible reservation   | Creator only  |
| POST   | `/api/reservations/[reservationId]/cancel` | Cancel own eligible reservation | Creator only  |

### 10.2 Example request bodies

Registration:

```json
{
  "name": "Alice Example",
  "email": "alice@example.com",
  "password": "example-password",
  "confirmPassword": "example-password"
}
```

Create resource:

```json
{
  "name": "Meeting Room A",
  "type": "MEETING_ROOM",
  "location": "First Floor",
  "capacity": 8,
  "description": "Shared meeting room"
}
```

Create reservation:

```json
{
  "resourceId": "00000000-0000-0000-0000-000000000001",
  "purpose": "Project meeting",
  "startAt": "2026-10-20T09:00:00+05:30",
  "endAt": "2026-10-20T10:00:00+05:30"
}
```

These examples illustrate the request format, not seeded database records or guaranteed existing UUIDs. Convert valid ISO date-times to UTC instants for storage and comparisons.

### 10.3 Error and response rules

| HTTP status | Use                                                                               |
| ----------- | --------------------------------------------------------------------------------- |
| 200         | Successful reads and modifications                                                |
| 201         | Created resource, user or reservation                                             |
| 204         | Successful operation without body, including eligible resource deletion           |
| 400         | Invalid input or malformed interval                                               |
| 401         | No valid authenticated session / invalid login credentials                        |
| 403         | Authenticated user lacks ownership for attempted mutation                         |
| 404         | Requested resource or reservation does not exist                                  |
| 409         | Duplicate email, conflicting reservation, forbidden resource lifecycle transition |
| 500         | Unexpected internal error; no secrets or raw SQL in response                      |

Return predictable error payloads with a short machine-friendly code and readable message. Do not leak password hashes, JWTs, connection strings, detailed stack traces, or internal query statements. Use correct HTTP methods and validate path IDs, query parameters and bodies with Zod.

### 10.4 Server module boundaries

A Route Handler validates requests, obtains authenticated identity, delegates to a focused server business function, and serializes a safe response. Server services own business rules and database transactions. The same service functions may be called by Server Components, with authorization always checked before obtaining sensitive results.

## 11. Frontend screens and user experience

### 11.1 Public landing page

The first landing page is deliberately minimal. It introduces ReserveHub, explains shared resource reservations, and links to signup/login. It displays no mock reservations, business statistics, testimonials or dynamic user information. The public header and footer are instantiated **inside `src/app/page.tsx`**. A later visual redesign may use additional landing-only components in `src/app/components/`.

### 11.2 Login and signup

Both pages have focused, centered form layouts with no application header or footer. Form components are Client Components kept in their corresponding page-level `components/` directory. Each outer `page.tsx` remains a Server Component exporting metadata.

Login provides email and password inputs, form validation, loading and server-error feedback. Signup provides name, email, password and password confirmation. Invalid input and duplicate email errors are shown without exposing implementation details. After registration, navigate to login; after successful login, navigate to dashboard.

### 11.3 Management dashboard

The `/dashboard` page is the authenticated entry point. Its required initial view consists of a clear page heading, concise description and two direct navigation choices: Resources and Reservations. Additional metrics are optional and must be computed from real backend data. Dashboard-specific components belong in `src/app/dashboard/components/`.

### 11.4 Resources

The catalogue displays the resource name, type, location, creator and active status. Detail screens show descriptive information and relevant reservation/availability context. The create/edit form enforces required fields. Eligible actions include edit, deactivate/reactivate, and deletion of never-reserved resources with clear confirmation and error feedback. All resource UI components, irrespective of the subroute using them, belong in the one `src/app/resources/components/` directory.

### 11.5 Reservations

The reservations list shows all bookings and their creators, resources, date-time interval and lifecycle label. An owner may modify or cancel their own future confirmed bookings; other bookings display read-only actions. Reservation form validation checks dates and purpose, then handles 409 conflicts without discarding the input fields. All reservation-specific UI components belong in `src/app/reservations/components/`.

Example reservation table:

| Resource    | Created by | Start        | End        | Status    | Visible actions                       |
| ----------- | ---------- | ------------ | ---------- | --------- | ------------------------------------- |
| Room A      | Alice      | Future start | Future end | Upcoming  | Alice: Edit/Cancel; other users: View |
| Projector A | Bob        | Past start   | Past end   | Completed | View                                  |
| Room B      | Alice      | Future start | Future end | Cancelled | View                                  |

These are presentation examples, not stored sample records or automatically available application data.

### 11.6 Shared navigation

The application header provides Dashboard, Resources, Reservations and an authenticated logout action, with the current user's display name when available. Because the same header appears on multiple functional pages it belongs in `src/components/layout/app-header.tsx`. Individual pages import it directly; do not introduce a separate protected route-group layout solely to share the header. It is acceptable for each page to include the same header import for clarity.

The public landing header and footer are landing-specific and therefore belong in `src/app/components/`, not `src/components/layout/`, unless additional public pages begin reusing them.

### 11.7 Error and loading states

- On a protected page, the server verifies the session before returning sensitive content.
- Client navigation may show a brief session-loading message while the auth context checks `/api/auth/me`.
- Show explicit 401/403/404/409 responses and relevant recovery actions.
- Keep partially completed form values after recoverable server errors.
- Provide confirmation for destructive actions, and show why lifecycle restrictions prevent certain actions.
- Ensure keyboard use, accessible error text and responsive layout.

## 12. Repository architecture and folders

The following structure reflects the planned complete application. Some files will be introduced in later issue branches and are not required to exist at the time this document is written.

```text
reserve-hub/
├── .github/
│   └── workflows/
│       └── ci.yml
├── docs/
│   ├── ReserveHub_Implementation_Plan.md
│   ├── ReserveHub_ER_Diagram.drawio
│   ├── NeonDB_Setup_Guide.md
│   └── Prisma_Migrations_Guide.md
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── src/
│   ├── app/
│   │   ├── layout.tsx                  # Fonts, metadata, AuthProvider; no header/footer
│   │   ├── globals.css
│   │   ├── page.tsx                    # Public landing page; Server Component
│   │   ├── components/                 # Landing-only components, header and footer
│   │   ├── login/
│   │   │   ├── page.tsx                # Server Component, page metadata
│   │   │   └── components/             # Login form and login-only UI
│   │   ├── signup/
│   │   │   ├── page.tsx                # Server Component, page metadata
│   │   │   └── components/             # Signup form and signup-only UI
│   │   ├── dashboard/
│   │   │   ├── page.tsx                # Server Component + server auth check
│   │   │   └── components/             # Dashboard-only UI
│   │   ├── resources/
│   │   │   ├── page.tsx
│   │   │   ├── components/             # ALL resources feature UI components
│   │   │   ├── new/page.tsx
│   │   │   └── [resourceId]/
│   │   │       ├── page.tsx
│   │   │       └── edit/page.tsx
│   │   ├── reservations/
│   │   │   ├── page.tsx
│   │   │   ├── components/             # ALL reservations feature UI components
│   │   │   ├── new/page.tsx
│   │   │   └── [reservationId]/page.tsx
│   │   └── api/
│   │       ├── auth/
│   │       │   ├── register/route.ts
│   │       │   ├── login/route.ts
│   │       │   ├── logout/route.ts
│   │       │   └── me/route.ts
│   │       ├── resources/
│   │       │   ├── route.ts
│   │       │   └── [resourceId]/
│   │       │       ├── route.ts
│   │       │       └── availability/route.ts
│   │       └── reservations/
│   │           ├── route.ts
│   │           └── [reservationId]/
│   │               ├── route.ts
│   │               └── cancel/route.ts
│   ├── components/
│   │   ├── ui/                         # Reusable shadcn/ui components
│   │   ├── auth/
│   │   │   └── protected-route.tsx     # Shared client navigation guard
│   │   └── layout/
│   │       └── app-header.tsx          # Shared across authenticated pages
│   ├── context/
│   │   └── auth-context.tsx           # Client AuthProvider and useAuth
│   ├── generated/
│   │   └── prisma/                    # Generated; not committed
│   └── lib/
│       ├── prisma.ts                   # Prisma adapter / singleton
│       ├── utils.ts
│       ├── auth/                       # JWT and requireUser server helpers
│       ├── validators/                 # Shared Zod validation
│       └── services/                   # Server business functions
├── .env.example
├── components.json
├── package.json
├── package-lock.json
├── prisma.config.ts
└── README.md
```

**Structural requirements:**

1. Keep all `page.tsx` files as Server Components with metadata exports. Put interactivity into imported Client Components.
2. Use exactly one `components/` folder per major feature route. No additional `components/` directories inside nested resource or reservation subroutes.
3. Place only truly cross-feature reusable UI under `src/components/`.
4. Place the app-wide `AuthProvider` inside the root layout, but import headers/footers at the page level.
5. Wrap only authenticated pages with `ProtectedRoute`, and perform the independent server-side authorization check before protected data access.
6. Do not add route groups, separate layout shells or extra architectural abstractions to solve straightforward page composition.
7. Keep authentication, Prisma and service logic server-side where appropriate; no server secrets in browser bundles.

### 12.1 Data flow

```text
Browser / Server Components
          |
Next.js page and Route Handler
          |
Validated session + Zod input checks
          |
Resource / Reservation server services
          |
Prisma Client + transaction / database safeguards
          |
Neon PostgreSQL
```

Server rendering should use server-side services directly where suitable. Client Components call Route Handlers for interactive mutations; both paths use the same business and authorization rules.

## 13. Security, validation and error handling

### 13.1 Authentication boundaries

Every protected server page must verify the session before issuing sensitive queries or serializing nonpublic data. The UI may use `ProtectedRoute` for redirect behavior, but client-side hooks cannot prevent an unauthenticated user from requesting a server route or API directly.

For example, a protected Server Component should authenticate and redirect before loading feature data:

```tsx
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/session";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { AppHeader } from "@/components/layout/app-header";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Manage resources and reservations.",
};

export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <ProtectedRoute>
      <AppHeader />
      <main>{/* Authenticated dashboard content */}</main>
    </ProtectedRoute>
  );
}
```

The snippet illustrates the security boundary; `getCurrentUser` and associated APIs are implemented in the authentication work package. Do not create mock implementations that always return a user.

### 13.2 Server input validation

Use Zod to validate all request bodies, route parameters and query parameters, including nullable and optional resource fields, UUID IDs, date-times and enum values. Apply string trimming and length limits before persistence. Database constraints provide an additional protection layer but do not replace validation.

### 13.3 Authorization and data disclosure

- User identity is derived from the validated JWT, never from an arbitrary submitted `userId`.
- Resource creators are recorded even when other users edit the resource.
- Reservation creator ownership is checked for all edits and cancellations.
- An authenticated user may read another user's reservation but cannot modify it.
- API responses must omit `passwordHash`, JWTs, signing keys and internal configuration.
- Database secrets and authentication helpers are never imported into Client Components or exposed through `NEXT_PUBLIC_*`.

### 13.4 Operational limitations

The MVP does not include email ownership verification, automated brute-force protection, global session revocation, audit history, multi-tenant organization isolation or role-based administration. These omissions must be described accurately in the README and demonstration. Protect against ordinary CSRF through origin checks for state-changing requests in addition to SameSite cookie configuration.

## 14. Non-functional requirements

| Attribute       | Requirement                                                                             | Verification                                         |
| --------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Correctness     | Confirmed reservations never overlap for one resource, including concurrent submissions | Database constraint and concurrent integration tests |
| Integrity       | Reservation history survives cancellation and resource lifecycle changes                | Persistence tests and foreign-key checks             |
| Security        | Authenticated-only management and creator-only reservation mutation                     | Session, ownership and API tests                     |
| Reliability     | Database writes are atomic across validation and state transitions                      | Failure-path and transaction tests                   |
| Usability       | Clear forms, errors, loading states, navigation and confirmation                        | Manual desktop/mobile review                         |
| Accessibility   | Keyboard navigation, labels, focus states and readable contrast                         | Manual keyboard and component checks                 |
| Maintainability | Typed code, feature-local components, reusable server services                          | Code review, ESLint and TypeScript build             |
| Reproducibility | Locked dependencies, reviewed migrations and documented environment setup               | Fresh installation and CI                            |
| Performance     | No unnecessary browser data fetching or heavyweight visual features                     | Basic network/devtools inspection                    |

Prioritize end-to-end functionality and sound business rules over additional charts, animations or interface embellishments.

## 15. GitHub Actions, formatting and validation

### 15.1 CI triggers and job

The workflow is `.github/workflows/ci.yml`, with one Ubuntu validation job. It runs on:

- Pushes to `main`, `feature/**` and `fix/**`.
- Pull requests targeting `main`.

The job uses Node.js 24 and npm caching, then runs the following sequence:

1. Checkout repository.
2. Install locked dependencies with `npm ci`.
3. Generate Prisma Client using `npm run prisma:generate`.
4. Verify formatting using `npm run format:check`.
5. Run `npm run lint`.
6. Run `npm run build`.

Formatting, lint and build failures fail the job. The workflow must not run migrations against a live Neon database. Schema deployment is a separate reviewed action; a production build must not make live database changes.

### 15.2 Package scripts

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "format": "prettier --write ./",
    "format:check": "prettier --check ./",
    "prisma:validate": "prisma validate",
    "prisma:format": "prisma format",
    "prisma:generate": "prisma generate",
    "prisma:migrate:dev": "prisma migrate dev --create-only",
    "prisma:migrate:deploy": "prisma migrate deploy",
    "prisma:migrate:status": "prisma migrate status",
    "test:booking-integrity": "tsx scripts/verify-booking-integrity.ts"
  }
}
```

The existing `.prettierignore` excludes `package.json` and `package-lock.json`; changes to that policy must be intentional. Review the diff after `npm run format` before committing generated documentation-wide formatting changes.

### 15.3 Local verification

```bash
npm ci
npm run prisma:generate
npm run format:check
npm run lint
npm run build
```

Use `npm run format` to correct supported files when format checking fails; rerun the check afterward. Prisma migration tests and live database integration checks are separate from the standard build job. Review the GitHub Actions run on the relevant commit before merging.

## 16. Development work packages

The development backlog is organized into small feature branches and issues. The table describes the full product delivery sequence; completed foundation work is retained for traceability. Work packages may be combined when this reduces development overhead without obscuring test coverage.

| Package                               | Priority | Implementation                                                                                                           | Completion evidence                                    | Depends on                                     |
| ------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------ | ---------------------------------------------- |
| RH-01 — Database foundation           | P0       | Neon project, Prisma 7 adapter/configuration, models and migration workflow                                              | Schema validation, migration status, setup guides      | Initial Next.js project                        |
| RH-02 — UI foundation and CI          | P0       | shadcn/ui, Tailwind design tokens, Lucide, Motion, GitHub Actions, page composition and initial landing/dashboard shells | CI passes, UI layout review, build succeeds            | RH-01                                          |
| Database overlap protection           | P0       | Reviewed SQL migration for confirmed reservation exclusion constraint                                                    | Successful positive and negative overlap tests         | RH-01                                          |
| Authentication                        | P0       | Registration, login, logout, `/me`, JWT cookie, AuthProvider, protected routes and server session helpers                | Register/login/redirect and unauthorized-request tests | RH-01, RH-02                                   |
| Resource listing/creation             | P0       | Service, API, list/detail UI, create form                                                                                | Records persist and appear across accounts             | Authentication                                 |
| Resource lifecycle                    | P0       | Edit, deactivate/reactivate and never-reserved deletion                                                                  | Eligibility and foreign-key tests                      | Resources, overlap logic                       |
| Availability and reservation creation | P0       | Time validation, availability API, creation, conflict handling                                                           | Adjacent intervals work; overlap blocked               | Authentication, resources, database constraint |
| Reservation management                | P0       | List all, details, creator-only future edit and cancellation                                                             | Two-user ownership and lifecycle tests                 | Reservation creation                           |
| Race safety and validation            | P0       | Concurrent writes, booking/deactivation coordination, error cases                                                        | Repeatable integration tests                           | Domain modules                                 |
| Documentation and submission          | P0       | README, shareable ER diagram, 3–5-minute demo, final form                                                                | Accessible repository and working links                | All core functionality                         |
| Optional enhancements                 | P1       | Search, filters, accurate dashboard summaries, visual polish and further tests                                           | Verified behavior without delaying P0                  | Stable MVP                                     |

### 16.1 Implementation dependencies

```text
Project + Prisma foundation (RH-01)
              |
              +-- UI foundation and CI (RH-02)
              |
              +-- PostgreSQL overlap constraint
              |
              v
JWT authentication + protected server access
              |
              v
Resource create / list / edit / lifecycle
              |
              v
Availability + reservation creation
              |
              v
All-reservation views + owner-only edit / cancel
              |
              v
Concurrency, security and browser verification
              |
              v
README + ER diagram + demonstration + submission
```

### 16.2 UI foundation sequence (RH-02)

1. Verify GitHub Actions, Prettier, Prisma Client generation, lint and production build.
2. Configure the existing shadcn/ui Radix Nova preset, Geist font mapping and base UI components.
3. Keep the root layout limited to document shell, global styles, fonts, metadata and the `AuthProvider` boundary once authentication support is ready.
4. Implement the landing page with landing-specific header and footer imported directly into `src/app/page.tsx`.
5. Provide a minimal dashboard with direct links to Resources and Reservations, plus a shared application header imported by the applicable pages.
6. Keep login and signup separate from public/application navigation, without header or footer.
7. Implement page metadata exports in all Server Component `page.tsx` files.
8. Place feature-only interactive components in the single component directory for that feature.
9. Verify keyboard navigation, mobile layout, formatting, lint and build. Do not falsely indicate that protected routes are functional before auth APIs exist.

### 16.3 Authentication integration sequence

1. Add secure JWT/password helpers and Zod validation.
2. Implement registration, login, logout and `/me` endpoints.
3. Add the `AuthProvider` to the root layout and refresh the context after login/logout.
4. Add the shared `ProtectedRoute` component for authenticated navigation.
5. In every protected Server Component, verify session and redirect before retrieving protected content.
6. Protect all corresponding API handlers independently of the client wrapper.
7. Confirm login redirects to `/dashboard`; authenticated login/signup visits redirect there as well.
8. Test two browser sessions, unauthorized direct navigation, session expiry, logout and manual API requests.

## 17. Delivery schedule and priorities

The assessment submission deadline is **15 October 2026, 11:59 PM Sri Lanka time**. The schedule below expresses delivery priorities, not a guarantee that a work package is already finished.

### 13 October — Foundation and critical database behavior

- Finalize repository scripts, shadcn/ui setup and passing CI.
- Complete the initial page structure, metadata, simple landing page and dashboard shell.
- Validate the Neon schema, existing migrations and exclusion-constraint migration.
- Prepare and test authentication helpers and required route handlers.

### 14 October — Functional application

- Complete JWT authentication and server-side protection.
- Implement and verify resource creation, listing, editing and lifecycle transitions.
- Implement availability lookup and reservation creation.
- Add all-reservations visibility and creator-only future modifications.
- Test at least one fully working cross-user booking scenario.

### 15 October — Validation and submission

- Run focused security, conflict, concurrency and edge-case tests.
- Verify behavior on mobile and desktop and perform a clean production build.
- Finalize README, migration instructions and accessible ER diagram link.
- Record a 3–5-minute walkthrough of implemented functionality.
- Check GitHub, ER and video links in a separate browser session.
- Submit all required links before 11:59 PM.

### 17.1 Fallback when behind schedule

Prioritize authentication, persistent resource creation, confirmed reservation creation, visible all-user bookings, owner-only mutation, and demonstrably correct overlap rejection. Preserve resource deletion/deactivation rules without replacing them with unsafe shortcuts. Skip optional filtering, dashboard statistics and decorative animation if necessary. Reserve enough time for a working demonstration and submission artifacts.

## 18. Testing and acceptance plan

Only executed tests may be reported as passed. For each test, record whether it is an automated unit/integration test or a manual browser check. Core data and authorization rules require server-side tests; visual behavior may be checked manually.

### 18.1 Authentication and authorization

- [ ] AUTH-T01 — Valid registration stores a user with a hashed password.
- [ ] AUTH-T02 — Duplicate normalized email returns 409.
- [ ] AUTH-T03 — Invalid or missing registration fields return 400.
- [ ] AUTH-T04 — Correct login creates a session; incorrect login returns 401.
- [ ] AUTH-T05 — Missing, expired or tampered JWT is rejected.
- [ ] AUTH-T06 — Logout clears the browser session.
- [ ] AUTH-T07 — Authenticated user visiting `/login` or `/signup` is redirected to `/dashboard`.
- [ ] AUTH-T08 — Unauthenticated visitor to `/dashboard`, `/resources` or `/reservations` is redirected to `/login` before protected server data is loaded.
- [ ] AUTH-T09 — Protected APIs reject unauthenticated direct requests with 401.
- [ ] AUTH-T10 — Submitted `userId`, `createdById` or role fields cannot override authenticated identity or permissions.
- [ ] AUTH-T11 — Two users can read the same reservations, but cannot edit each other's reservations.
- [ ] AUTH-T12 — Password hashes and JWTs are absent from public API responses.
- [ ] AUTH-T13 — Auth context refresh reflects login, refresh and logout correctly.

### 18.2 Resource integrity

- [ ] RES-T01 — Any authenticated user can create a valid resource.
- [ ] RES-T02 — Invalid name, type, location and capacity are rejected.
- [ ] RES-T03 — A different user can edit a resource while original creator attribution remains unchanged.
- [ ] RES-T04 — A resource with no reservation history can be deleted.
- [ ] RES-T05 — A resource with cancelled history cannot be hard-deleted.
- [ ] RES-T06 — A resource with completed-only bookings may be deactivated.
- [ ] RES-T07 — An ongoing or future confirmed reservation blocks deactivation.
- [ ] RES-T08 — Inactive resources reject new reservations; reactivation restores eligibility.
- [ ] RES-T09 — Delete/booking races do not result in dangling foreign keys.

### 18.3 Reservation rules

- [ ] BOOK-T01 — Valid future reservation persists with authenticated creator ID.
- [ ] BOOK-T02 — Adjacent bookings of one resource are both permitted.
- [ ] BOOK-T03 — Overlapping confirmed bookings on the same resource return 409.
- [ ] BOOK-T04 — The same time on two different resources is permitted.
- [ ] BOOK-T05 — Two concurrent same-resource overlapping inserts yield only one success.
- [ ] BOOK-T06 — Invalid, past, missing or reversed intervals are rejected.
- [ ] BOOK-T07 — Cancelled bookings no longer block a future matching interval.
- [ ] BOOK-T08 — Creator can change a future confirmed booking.
- [ ] BOOK-T09 — A rejected reschedule does not change the original booking.
- [ ] BOOK-T10 — Another user cannot edit/cancel a booking (403) but can read it.
- [ ] BOOK-T11 — Cancellation preserves the record and changes status.
- [ ] BOOK-T12 — Ongoing, completed and cancelled bookings cannot be mutated.
- [ ] BOOK-T13 — Availability responses agree with booking insert results.
- [ ] BOOK-T14 — Booking/deactivation races preserve resource eligibility rules.
- [ ] BOOK-T15 — Derived lifecycle labels are correct at exact start/end boundaries.

### 18.4 Interface, structure and CI

- [ ] UI-T01 — All `page.tsx` files are Server Components and export appropriate metadata.
- [ ] UI-T02 — Root layout supplies `AuthProvider` but no global header or footer.
- [ ] UI-T03 — Landing page shows only its public header/footer; login and signup show neither.
- [ ] UI-T04 — Dashboard, resource and reservation pages show the shared app header.
- [ ] UI-T05 — Feature-only components are under one `components/` directory per major route, with no nested duplicates.
- [ ] UI-T06 — Landing page is simple and uses real navigation, without fabricated statistics.
- [ ] UI-T07 — Browser navigation after successful login reaches `/dashboard`.
- [ ] UI-T08 — Interactive elements are keyboard accessible and usable on mobile.
- [ ] UI-T09 — No server-side database or token module is imported into client-only UI.
- [ ] CI-T01 — Feature/fix/main pushes and main-targeted PRs trigger GitHub Actions as configured.
- [ ] CI-T02 — `npm ci`, Prisma generation, Prettier check, ESLint and build pass.
- [ ] CI-T03 — Failed formatting, lint or build steps correctly report workflow failure.
- [ ] CI-T04 — Build checks do not apply database migrations or modify production records.

### 18.5 End-to-end manual acceptance

1. Register Alice, log in, and verify automatic navigation to the dashboard.
2. Create Room A and a confirmed future booking.
3. Open a separate browser/private session, register Bob and log in.
4. Verify Bob can see Alice's booking but cannot modify or cancel it.
5. Attempt a booking that overlaps Room A and verify a conflict response.
6. Verify adjacent intervals are permitted and bookings on another resource are unaffected.
7. Return to Alice and edit or cancel her eligible booking.
8. Attempt to delete a never-reserved resource, then a resource with history; verify different outcomes.
9. Verify ongoing/future confirmed bookings prevent resource deactivation.
10. Check session expiry/logout, responsive behavior, build and available demonstration links.

## 19. Demo data and demonstration script

Use fictional names and resource details. Demo records must be created through the actual registration and resource APIs or through a valid seed script with a known user foreign key. Do not display mock counts or claims about live usage. Generate reservations for dates safely in the future during the demonstration.

Suggested demonstration sequence:

1. Show the public landing page and registration/login process.
2. Show dashboard links to resources and reservations.
3. Create Room A, explain creator attribution, and reserve it.
4. Show the reservation in the organization-wide list.
5. Attempt a duplicate interval in another account and demonstrate HTTP 409.
6. Show that a second user may view but cannot edit or cancel Alice's booking.
7. Return to the owner to reschedule/cancel and show that cancellation releases the interval.
8. Demonstrate never-reserved resource deletion and historical resource protection.
9. Briefly display the ER diagram and explain JWT cookies, server ownership checks and PostgreSQL exclusion constraint.

Keep the video within the required **3–5 minutes** and describe only features that work in the delivered build.

## 20. Documentation and final submission

### 20.1 README requirements

The README must provide:

1. Application purpose and implemented feature summary.
2. Current framework, Node.js and database requirements.
3. Environment variables and `.env.example` setup, without committed credentials.
4. Commands for `npm ci`, Prisma Client generation, reviewed migration deployment and local development.
5. Formatting, lint, build and available test commands.
6. Explanation of the User, Resource and Reservation models.
7. Reservation overlap and cancellation semantics.
8. Authentication and reservation ownership rules.
9. Design limitations and intentionally excluded features.
10. Links to the ER diagram and demonstration video.

The implementation instructions should allow a reviewer to run the app from a clean clone. State any external database requirements and provide steps appropriate to the configured Neon environment.

### 20.2 Repository artifacts

- `docs/ReserveHub_Implementation_Plan.md` — requirements, architecture and implementation plan.
- `docs/ReserveHub_ER_Diagram.drawio` — editable entity-relationship diagram.
- `docs/NeonDB_Setup_Guide.md` — Neon configuration and connection setup.
- `docs/Prisma_Migrations_Guide.md` — migration creation, review and deployment.
- `README.md`, `.env.example`, Prisma schema and committed migration history.
- Source code and passing CI workflow under `.github/workflows/ci.yml`.

Provide the ER diagram through a shareable repository or other publicly accessible URL; the existence of a local drawing file alone does not satisfy the sharing requirement. A rendered SVG/PNG may be provided as a convenience, without replacing the editable source.

### 20.3 Submission checklist

- [ ] GitHub repository is accessible to evaluators.
- [ ] Core functionality is demonstrated and verified.
- [ ] README provides reproducible setup commands.
- [ ] Shareable ER diagram link is tested.
- [ ] Demonstration video is accessible and between 3 and 5 minutes.
- [ ] Links are tested from a browser without the owner's active account session.
- [ ] Submission form is completed before the deadline.
- [ ] The submitted email matches the original job application email.

Submission form: <https://forms.gle/HzQH6tB5c4edPjnn8>.

## 21. Architectural decisions

| ID     | Decision                                             | Rationale / constraint                                                                 |
| ------ | ---------------------------------------------------- | -------------------------------------------------------------------------------------- |
| ADR-01 | Next.js full-stack application                       | Meets assessment stack requirements with one deployable codebase                       |
| ADR-02 | JWT in HttpOnly cookie                               | Supports server-verified session handling without exposing tokens to browser scripts   |
| ADR-03 | One registered-user type; no RBAC                    | Limits complexity while retaining meaningful ownership authorization                   |
| ADR-04 | Reservation creator-only future mutation             | Preserves user control over bookings without restricting organization-wide visibility  |
| ADR-05 | Resource creator attribution, not ownership          | Allows collaborative resource maintenance                                              |
| ADR-06 | Hard-delete only never-reserved resources            | Removes accidental entries without destroying history                                  |
| ADR-07 | Resource deactivation subject to live booking checks | Preserves active/future reservations                                                   |
| ADR-08 | Reservation cancellation instead of deletion         | Retains booking history and releases cancelled intervals                               |
| ADR-09 | PostgreSQL GiST exclusion constraint                 | Prevents overlapping confirmed bookings under concurrency                              |
| ADR-10 | Two stored reservation statuses                      | Derives time-dependent states without scheduled jobs                                   |
| ADR-11 | Next.js Server Component pages with metadata         | Keeps page rendering and SEO metadata server-side while isolating browser interactions |
| ADR-12 | Root AuthProvider and selective ProtectedRoute       | Supports simple client navigation without replacing server authorization               |
| ADR-13 | Explicit page-level header/footer imports            | Login/signup remain uncluttered without route groups or additional layouts             |
| ADR-14 | One components directory per major feature           | Keeps feature implementation cohesive and reduces folder fragmentation                 |
| ADR-15 | Shared components only for cross-feature reuse       | Avoids placing page-specific elements in a global component collection                 |
| ADR-16 | shadcn/ui + Lucide + restrained Motion               | Provides consistent, accessible UI without unnecessary visual complexity               |
| ADR-17 | Reviewed Prisma SQL migrations                       | Makes database changes traceable and supports custom overlap constraints               |
| ADR-18 | GitHub Actions with formatting, lint and build       | Detects integration errors before merging without applying migrations                  |

### 21.1 Authorization explanation

ReserveHub permits any authenticated employee to manage resource records and view organization-wide bookings. Reservation mutations are restricted to the original creator while the confirmed booking has not yet started. The API and database enforce those rules independently of interface visibility. Administrative role management is excluded from the MVP.

### 21.2 Resource lifecycle explanation

Never-reserved resources may be removed permanently. Once any booking has referenced a resource, its history is retained and deletion is prohibited. Deactivation is then available only if no confirmed reservation remains ongoing or scheduled for the future.

## 22. Risk register

| Risk                                    | Potential effect                              | Mitigation                                                                           |
| --------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------ |
| Neon connectivity or migration mismatch | Feature development blocked                   | Validate setup early; use direct migration URL, reviewed SQL and status checks       |
| Overlap race                            | Double-booked resource                        | PostgreSQL exclusion constraint and concurrent tests                                 |
| Booking/deactivation race               | Inactive resource with newly accepted booking | Consistent resource row locking and transaction tests                                |
| Ownership bypass                        | User edits another user's booking             | Server-side JWT and immutable owner checks with 403 tests                            |
| Client-only route protection            | Private data exposed before redirect          | Authenticate in Server Components and Route Handlers before data access              |
| Unmanaged component reuse               | Bloated shared component directory            | One route-local components folder per feature; global components only for true reuse |
| Misleading dashboard data               | Incorrect demo and unreliable UI              | Use navigation-first dashboard; compute any metrics from actual data                 |
| Timezone mismatch                       | Incorrect interval comparison                 | Store instants as timestamptz; present Asia/Colombo consistently                     |
| Incomplete core flow                    | Unconvincing assessment demonstration         | Finish P0 end-to-end journeys before optional styling                                |
| Missing delivery artifacts              | Invalid or incomplete submission              | Reserve the final delivery window for README, ER diagram, video and tested links     |

## 23. Definition of done

The application is ready for submission when all applicable P0 criteria are satisfied:

- [ ] Registration, login, logout and authenticated session restoration work.
- [ ] Login redirects to `/dashboard`; unauthenticated management requests are rejected server-side.
- [ ] Landing, authentication and management pages use the required distinct header/footer placement.
- [ ] Every `page.tsx` remains a Server Component and provides route metadata.
- [ ] Shared UI is genuinely reusable; each major feature has at most one page-specific components directory.
- [ ] AuthProvider is attached to the root layout and ProtectedRoute is used only for protected pages.
- [ ] Authenticated users can create, view and edit resources, with creator attribution preserved.
- [ ] A never-reserved resource can be deleted, but any reservation history prevents hard deletion.
- [ ] Current or future confirmed bookings prevent deactivation.
- [ ] An active resource can be booked in a valid free future interval.
- [ ] Overlapping confirmed reservations are rejected by PostgreSQL, including concurrent submissions.
- [ ] Authenticated users can view all reservations and identify their creators.
- [ ] Only the creator can edit/reschedule or cancel their future confirmed reservation.
- [ ] Ongoing, completed and cancelled bookings remain read-only.
- [ ] Cancellation preserves the record and makes the interval available again.
- [ ] The three-entity Prisma model matches the ER diagram and committed migrations.
- [ ] CI formatting, lint and production build checks pass.
- [ ] The repository runs locally using the documented setup process.
- [ ] README, shareable ER link and 3–5-minute video are available to reviewers.
- [ ] The final submission is completed before the assessment deadline.

## Appendix A — Development commands

All commands below use syntax compatible with Windows PowerShell and Linux Bash in the repository root.

```bash
# Install locked dependencies
npm ci

# Generate Prisma Client
npm run prisma:generate

# Start the application
npm run dev

# Format and validate
npm run format
npm run format:check
npm run lint
npm run build

# Validate schema and inspect migrations
npm run prisma:validate
npm run prisma:migrate:status
```

For a new migration, follow the reviewed SQL workflow in Section 8.5 and `docs/Prisma_Migrations_Guide.md`. Do not deploy migrations simply to resolve an unrelated frontend build error.

## Appendix B — Sources and traceability

- PrimeWave Lab (Pvt) Ltd, _Software Engineering Internship — Technical Assessment_ (source assessment document).
- ReserveHub repository: <https://github.com/ishara-dhanushan/Reserve-Hub>.
- Database setup: `docs/NeonDB_Setup_Guide.md`.
- Schema changes: `docs/Prisma_Migrations_Guide.md`.
- ER diagram: `docs/ReserveHub_ER_Diagram.drawio`.
- GitHub Actions workflow: `.github/workflows/ci.yml`.

**Project scope:** JWT-authenticated collaborative resource management; organization-wide reservation visibility; creator-only edits and cancellation of future confirmed reservations; and database-enforced avoidance of overlapping bookings. Administrative roles and advanced scheduling features are outside the MVP.
