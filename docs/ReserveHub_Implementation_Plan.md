# ReserveHub — Complete Requirements and Implementation Plan

**Product:** ReserveHub — Office Resource Reservation Management System  
**Assessment:** PrimeWave Lab (Pvt) Ltd, Software Engineering Internship  
**Document version:** **3.0 — Final simplified authenticated MVP**  
**Updated:** 13 October 2026  
**Submission deadline:** **Thursday, 15 October 2026, 11:59 PM (Sri Lanka, UTC+05:30)**  
**Status:** Agreed implementation baseline — decisions identified separately from employer requirements  
**Related conceptual ER:** `docs/ReserveHub_Final_Chen_ER_Diagram.drawio`

---

## 1. Purpose and source of requirements

This document supersedes **ReserveHub Requirements and Implementation Plan v2.0**, which specified Admin/User RBAC and a coordinator-style administrative workflow. **Version 3.0 has no roles.** All registered users share the same general permissions; **only a reservation's creator may modify or cancel it**. Every authenticated user may view all reservations and may manage resources.

The assessment PDF describes an organization struggling with informal reservations, overlapping time slots, and unclear shared-resource availability. It asks for a practical, reliable full-stack solution and leaves the feature interpretation and architecture to the candidate. In particular, the company specifies:

| Source                 | Company requirement or expectation **[ASSESSMENT]**                                                                             |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Business scenario      | Centralized management of shared resources and their reservations; clear usage and availability                                 |
| Technical expectations | **Next.js App Router, TypeScript, PostgreSQL, Git/GitHub**, persistent database, local run capability                           |
| Scope                  | A **focused** system, not an enterprise platform; sound engineering decisions, reliability and usability                        |
| Submission             | Source code in GitHub with a setup README, a **3–5-minute demonstration video**, and a shareable ER diagram                     |
| Evaluation             | Interpretation, functionality, reliability, architecture, data model, code quality, usability, and ability to explain decisions |
| Deadline               | **15 October 2026 at 11:59 PM**, Sri Lanka time                                                                                 |

**[DESIGN DECISION]** marks requirements we chose to satisfy the scenario; the company did **not** explicitly demand registration, JWT, specific user roles, specific resource types, or these exact endpoint names. **[FUTURE]** marks excluded functionality.

**Submission URL supplied in assessment:** https://forms.gle/HzQH6tB5c4edPjnn8. Use the **same email address used for the original job application**.

---

## 2. Product overview

### 2.1 Product statement

ReserveHub is a single-organization website where registered employees can:

1. Sign up, sign in and sign out.
2. Add shared office resources such as meeting rooms and individual projectors.
3. Browse, update, deactivate or remove eligible resources.
4. See who created a resource and who booked a resource.
5. Search or inspect reservation availability for a date/time interval.
6. Reserve one active resource for a specified time period.
7. View **all** reservations created by all users.
8. **Edit/reschedule or cancel only reservations that they themselves created**, and only before the reservation starts.
9. Receive clear feedback if a time slot is already taken.

A resource is treated as **one exclusive bookable unit**. A meeting room with a capacity of 12 is still booked as a single resource; capacity is descriptive information, not 12 independently bookable seats. One projector represents one physically distinct item.

### 2.2 User experience goal

A new user should be able to register, log in, add a room, book it, and observe another user viewing the booking without being able to modify it. Attempting another overlapping booking must fail reliably on the server and at the database level.

### 2.3 Constraints and priorities

- **P0 / Must:** End-to-end authentication, resource CRUD/lifecycle, reservation creation and viewing, ownership authorization, conflict prevention, README, ER diagram, demo.
- **P1 / Nice to have:** Summary dashboard, richer filters/search, additional responsive polish, expanded tests.
- **P2 / Excluded:** RBAC, admin accounts, approvals, payments, email verification/recovery, notifications, calendar integrations, recurring bookings, audit logging, resource photos, multiple organizations, and microservices.

**Scope rule:** No new feature is added until all P0 acceptance criteria and the required submission artifacts are satisfied.

---

## 3. Actors and permission model

**There are no application roles and no Admin account.** `User` has no `role` property or enum. Authentication is JWT-based, and authorization is limited to identifying the current user and enforcing reservation ownership.

| Action                                              | Visitor (not logged in) | Any authenticated user | Another reservation's creator?  |
| --------------------------------------------------- | :---------------------: | :--------------------: | :-----------------------------: |
| Register/login                                      |           Yes           |          Yes           |               N/A               |
| Access dashboard, resources, reservations           |           No            |          Yes           |               Yes               |
| Add resource                                        |           No            |          Yes           |               Yes               |
| View any resource                                   |           No            |          Yes           |               Yes               |
| Edit resource details                               |           No            |          Yes           |               Yes               |
| Delete an unused resource                           |           No            |          Yes           |               Yes               |
| Deactivate/reactivate eligible resource             |           No            |          Yes           |               Yes               |
| See who added resources                             |           No            |          Yes           |               Yes               |
| Check availability                                  |           No            |          Yes           |               Yes               |
| Create a reservation for self                       |           No            |          Yes           |               Yes               |
| View all users' reservations and creator names      |           No            |          Yes           |               Yes               |
| Edit a **future reservation created by self**       |           No            |          Yes           | **No** for other user's booking |
| Cancel a **future reservation created by self**     |           No            |          Yes           | **No** for other user's booking |
| Edit/cancel ongoing, completed or cancelled booking |           No            |           No           |               No                |
| Permanently delete a reservation                    |           No            |           No           |               No                |

**Security invariant:** A hidden or disabled button is a UI convenience, **not** authorization. The API verifies the JWT and checks `reservation.userId === authenticatedUser.id` for every edit and cancel request. No authenticated user can override this rule.

**Intentional simplification:** Any logged-in user can edit or deactivate resource records, even those added by someone else. `createdById` exists **for attribution, not edit authorization**. For a production system, roles and audit trails would be valuable.

---

## 4. Authentication — requirements (P0)

### AUTH-01 — Register a user

**Page:** `/register` · **Endpoint:** `POST /api/auth/register` · **Access:** Public.

**Inputs:**

| Field             | Rule                                                                    |
| ----------------- | ----------------------------------------------------------------------- |
| `name`            | Required, trimmed, 2–100 characters                                     |
| `email`           | Required, trimmed, lowercase, valid email, up to 254 characters, unique |
| `password`        | Required, 8–72 UTF-8 bytes (appropriate bcrypt input length)            |
| `confirmPassword` | Required in the UI, must match; not stored or passed into Prisma        |

Server validates with Zod, hashes the password with `bcryptjs`, creates one `User`, and returns success; user is directed to the login page. Registration does not assign a role and does not automatically create a session.

**Errors:** 400 for invalid input; 409 for duplicate normalized email. Never store or return plaintext passwords or password hashes.

**Acceptance:** Account is created and survives refresh/server restart; email uniqueness is enforced in PostgreSQL; login works with the registered credentials.

### AUTH-02 — Login

**Page:** `/login` · **Endpoint:** `POST /api/auth/login` · **Access:** Public.

Look up the normalized email, compare the bcrypt hash, and generate a signed JWT containing minimal claims (e.g. `sub`, `iat`, `exp`, `iss`). Respond with a secure, HTTP-only session cookie, not a token in response JSON. Use a generic **"Invalid email or password"** message for incorrect credentials.

**Acceptance:** Valid credentials authenticate; incorrect credentials return 401; authenticated pages work after refresh while the cookie remains valid.

### AUTH-03 — JWT session security

- Use `jose` with HS256 and a random 32-byte-or-longer `JWT_SECRET` stored only in server environment variables.
- JWT lifetime: **12 hours**; verify expiration, signature and issuer on protected requests.
- Cookie: `reservehub_session`, `HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` for HTTPS production, and maximum age aligned with token expiry.
- Never put JWTs in `localStorage`, expose the secret through `NEXT_PUBLIC_*`, or print credential values.
- Verify that the user identified by `sub` still exists.
- Check `Origin` for state-changing cookie-authenticated HTTP requests; reject untrusted origins (CSRF defense in addition to SameSite).
- Use a server-side `getCurrentUser()` or `requireUser()` helper, reused by route handlers and server rendering.

**Known limitation:** Clearing the browser cookie does **not** revoke a copied JWT. No refresh-token or global revocation system is part of this MVP.

### AUTH-04 — Logout and navigation protection

**Endpoint:** `POST /api/auth/logout` clears the cookie. Protected pages redirect unauthenticated visitors to `/login`; protected APIs return 401. Use `/api/auth/me` to return the current public user profile (`id`, `name`, `email`).

**Acceptance:** After logout, the browser no longer makes authenticated requests using the cleared cookie. Direct route access and manual API requests are protected.

### AUTH-05 — Single-user authorization (replaces RBAC)

All logged-in users may manage resources and view all reservations. There are **no role checks**, seeded administrators, role-based navigation, or privileged API routes. Every resource/reservation creation request derives the creator ID from the verified JWT rather than accepting an untrusted `userId` or `createdById` from the request body.

**Acceptance:** Account X cannot impersonate account Y by submitting another user ID; all logged-in users can manage resources; no role field is persisted.

### AUTH-06 — Reservation ownership authorization

- Any authenticated user may list or view bookings, including those belonging to someone else.
- Only the **creator** may reschedule/change purpose or cancel a reservation, and only when `status=CONFIRMED` and its original `startAt` is strictly in the future.
- Enforce the check in the server service/handler on every PATCH and cancel, not only in the UI.
- Existing booking owner is immutable. No transfer of ownership through an API request.
- For a nonexistent reservation, return 404; for a real reservation owned by someone else, return 403 (appropriate because the booking is viewable to all authenticated users).

**Acceptance:** Two users can view the same booking, but a non-owner receives 403 on edit/cancel, even when calling the API directly.

### AUTH-07 — Basic security and validation

Use server-side Zod validation, bcrypt hashing, Prisma parameterization, input length limits, no untrusted HTML rendering, and safe error handling. Do not claim production-grade brute-force protection or email ownership verification: rate limits, email confirmation, password recovery and sessions revocation are **out of scope**.

---

## 5. Resource management — requirements (P0)

### RES-01 — Resource list and detail

**Pages:** `/resources`, `/resources/[resourceId]` · **Endpoints:** `GET /api/resources`, `GET /api/resources/[resourceId]`.

Display all resources, including inactive ones with clearly marked status. Show name, type, location, optional capacity/description, created-by display name, and current availability or next reservations. A basic text/type search is **P1**; showing the list is **P0**.

### RES-02 — Create resource

**Page:** `/resources/new` or a dialog · **Endpoint:** `POST /api/resources`.

| Field         | Validation                                          |
| ------------- | --------------------------------------------------- |
| `name`        | Required, trimmed, 2–100 characters                 |
| `type`        | Required; `MEETING_ROOM` or `EQUIPMENT`             |
| `location`    | Required, trimmed, 2–120 characters                 |
| `capacity`    | Optional positive integer (mainly useful for rooms) |
| `description` | Optional, up to 500 characters                      |

The server assigns `createdById` from the authenticated user; `isActive` defaults to `true`; timestamps are generated automatically. Repeated names are permitted (two distinct rooms may be named similarly); a resource is identified by its ID.

**Acceptance:** Any signed-in user can add a valid resource, and it appears for everyone after refresh. Malformed input returns 400.

### RES-03 — Edit resource

**Page:** `/resources/[resourceId]/edit` or dialog · **Endpoint:** `PATCH /api/resources/[resourceId]`.

All logged-in users can edit a resource's name, type, location, capacity, and description. The server must not allow clients to change `createdById`, `createdAt` or `id`. The creator's name remains visible after others edit the resource. Display save success/error messages.

**Acceptance:** User B can edit a resource added by User A, and User A remains the recorded creator.

### RES-04 — Deactivate/reactivate resource

Use the same PATCH endpoint with `isActive` and a confirmation dialog.

- `isActive=false` makes a resource **unavailable for new reservations** while retaining the record and history.
- **Do not deactivate** if the resource has any `CONFIRMED` reservation with `endAt > now` (includes **currently ongoing** and future reservations).
- Existing cancelled and completed reservations do not block deactivation.
- Reactivation sets `isActive=true`, allowing new bookings again.
- All changes are validated on the server. Coordinate this check with booking writes to avoid races (see Section 10).

**Acceptance:** A resource with an ongoing/future confirmed booking gets 409 on deactivation; a resource with only completed/cancelled records may be deactivated; an inactive resource cannot be booked.

### RES-05 — Permanently delete **never-reserved** resources

**Endpoint:** `DELETE /api/resources/[resourceId]`.

To allow removal of accidental records, any logged-in user may **hard-delete a resource only if no `Reservation` record has ever referenced it**. This includes confirmed, completed, and cancelled reservation history: **any history makes hard deletion unavailable**.

- `0` related reservation records → permanently delete; return 204; show confirmation dialog.
- `>=1` related record → **409 Conflict** with message: "This resource has reservation history. Deactivate it instead, if eligible."
- If it also has current/future confirmed bookings, deactivation is independently prohibited by RES-04.
- Do **not** automatically convert DELETE to deactivation; these are separate, predictable user actions.
- Use a restrictive foreign key (`onDelete: Restrict`) on the Reservation→Resource relationship so concurrent/stale requests cannot remove referenced resources.

**Acceptance:** Accidentally created unused resource can be removed, and any previously booked resource preserves history.

### RES-06 — Search/filter resources (P1)

Filter by name/type/active state. Avoid sophisticated indexing, image uploads or equipment stock quantities.

---

## 6. Reservation management — requirements (P0)

### BOOK-01 — Create reservation

**Page:** `/reservations/new` or booking dialog · **Endpoint:** `POST /api/reservations`.

**Fields:** `resourceId`, `purpose` (required, trimmed, e.g. 3–200 characters), `startAt`, `endAt`.

Flow: choose active resource → select start/end date-times → optionally check availability → enter purpose → submit → server validates resource, authenticated owner and interval → database inserts a `CONFIRMED` booking if no conflict → display success.

`userId` is always read from the JWT; it is **not accepted** from the browser. No approval state or booking on behalf of another user.

### BOOK-02 — Validate date/time and status

- `startAt` must be **strictly in the future** at creation.
- `endAt > startAt`.
- Store timestamps as UTC instants (`@db.Timestamptz(3)` in PostgreSQL) and display using `Asia/Colombo` (Sri Lanka time).
- Reject invalid/missing dates, unknown resource IDs, inactive resources and empty purpose.
- Booking intervals use **half-open** semantics: `[startAt, endAt)`. A booking ending at 10:00 and another starting at 10:00 **do not conflict**.
- Keep only **two persisted states**: `CONFIRMED`, `CANCELLED`.
- Display derived labels: **Upcoming** (`startAt>now`), **Ongoing** (`startAt<=now<endAt`), **Completed** (`endAt<=now`) for confirmed bookings; **Cancelled** when stored status is `CANCELLED`.
- No cron job or background state transition is necessary to mark completion.

**Simplification:** No arbitrary same-day requirement, booking-duration tier, recurring scheduling, timezone selector, or minimum/maximum slot length in the MVP. The essential ordering/future/overlap rules are enough.

### BOOK-03 — Prevent double booking (critical)

Two `CONFIRMED` reservations conflict if they refer to the same resource and:

```text
existing.startAt < requested.endAt
AND existing.endAt > requested.startAt
```

- Apply this rule when creating and when changing the time of a reservation.
- Exclude `CANCELLED` reservations from conflict checks.
- Perform a normal server-side check for a helpful conflict message **and** enforce a PostgreSQL exclusion constraint, so two near-simultaneous requests cannot both succeed.
- On database conflict, return **409 Conflict** with message: "This resource is already reserved for the selected time."
- See Section 10 for exact SQL and concurrency treatment.

### BOOK-04 — View all reservations

**Page:** `/reservations` · **Endpoint:** `GET /api/reservations`.

Every authenticated user can view the organization's booking list. Show resource name, date/time, user display name (**"Reserved by"**), purpose, derived state, and stored cancellation state. Do not expose emails, password hashes, JWTs or internal credentials. Add a **My reservations** filter/view using `userId === currentUser.id`. Filtering by resource/status/date is P1.

**Acceptance:** User A can view User B's booking details, but has no available edit/cancel action for it; manually calling the mutation API returns 403.

### BOOK-05 — Reservation detail

**Endpoint:** `GET /api/reservations/[reservationId]` · **Page:** `/reservations/[reservationId]` or a modal.

Show the resource, creator display name, purpose, date/time, and status. If the current user created a **future confirmed** reservation, show Edit and Cancel. Otherwise show a view-only screen with a short explanation. All users can read details (authenticated only).

### BOOK-06 — Edit/reschedule **own future** reservation

**Endpoint:** `PATCH /api/reservations/[reservationId]`.

An owner may change **purpose and/or start/end times** if the stored booking is confirmed and its **original startAt > now**. The revised start must also be in the future. Re-run validation and overlap checking; exclude the current booking ID from the conflict check. No change of `userId` or `resourceId` in MVP—cancel and make a new reservation if a different resource is needed.

**Acceptance:** The owner may reschedule a future booking; another user's PATCH gets 403; ongoing/completed/cancelled bookings cannot be edited; an overlapping reschedule returns 409 and leaves old values intact.

### BOOK-07 — Cancel **own future** reservation

**Endpoint:** `POST /api/reservations/[reservationId]/cancel`.

An owner may cancel when `status=CONFIRMED` and `startAt>now`; change status to `CANCELLED`, keep the record, and release the slot. Another user cannot cancel it. Ongoing or completed reservations are immutable, including cancellation. Repeat cancellation returns 409 with a clear explanation (or an explicitly documented idempotent outcome; choose **409**).

**No hard deletion of reservations in this MVP.** The request to allow future deletes has been intentionally simplified to **future-only cancellation** to preserve history and reduce complexity.

### BOOK-08 — Availability check

**Endpoint:** `GET /api/resources/[resourceId]/availability?startAt=...&endAt=...`.

Show Available/Unavailable for the chosen interval. For an inactive resource, return Unavailable with reason. If a confirmed booking overlaps, show the time slot as unavailable. This check improves UX but the authoritative decision happens on booking write. Optionally display booked intervals without exposing unrelated user information beyond the organization-visible reservation list.

### BOOK-09 — Reservation filters (P1)

Filter by All/Mine, resource, date and lifecycle label. Use simple dropdowns and a date field rather than a complex drag-and-drop calendar.

---

## 7. Dashboard and navigation

### DASH-01 — Minimal dashboard (P1)

Show total active resources, confirmed upcoming bookings, today's confirmed bookings, and a short upcoming reservations list. Dashboard is a usability enhancement, **not a prerequisite for completing reservation correctness**. If behind schedule, `/resources` can act as the authenticated landing page.

### UX-01 — Practical interface (P0)

- Shared authenticated navbar/sidebar: Resources, Reservations, Add Resource, New Reservation, My Reservations, Log out.
- Display logged-in user's name in the header.
- Loading indicators, empty states, confirmation dialogs, clearly worded 401/403/404/409 errors, success feedback.
- Resource list: state and creator; resource details: upcoming bookings and availability.
- Booking list: owner name and dates; owner-only edit/cancel buttons for eligible future bookings.
- Prevent duplicate form submissions with disabled loading submit buttons **without** relying on the UI for double-booking protection.
- Mobile-friendly forms and sensible card/list layout. Keep styling consistent using Tailwind CSS and a small number of shadcn/ui components.

**No** full calendar UI, realtime websockets, interactive floor maps, analytics charts or elaborate animation.

---

## 8. Core business rules — frozen

| ID    | Rule                                                                  | Outcome / failure                                    |
| ----- | --------------------------------------------------------------------- | ---------------------------------------------------- |
| BR-01 | Creating/changing data requires a valid JWT                           | Missing/invalid cookie → 401                         |
| BR-02 | All users have the same resource rights                               | No role or resource-creator restriction              |
| BR-03 | Creator IDs come from JWT, not request data                           | Spoofed `userId` / `createdById` ignored or rejected |
| BR-04 | Resources must be active to accept bookings                           | Booking inactive resource → 409                      |
| BR-05 | Reservation start in future; end after start                          | Invalid interval → 400                               |
| BR-06 | Confirmed intervals for same resource may not overlap                 | Conflict → 409 even under concurrent requests        |
| BR-07 | Anyone authenticated can **view** all reservations                    | Listing and detail allowed                           |
| BR-08 | Only creator can **edit/cancel** their reservation                    | Non-owner edit/cancel → 403                          |
| BR-09 | Only future confirmed reservations editable/cancellable               | Ongoing/past/cancelled → 409                         |
| BR-10 | Cancelled bookings don't block future availability                    | Cancelled reservation retained                       |
| BR-11 | Hard-delete resource only if **no reservation records of any status** | Resource with history → 409                          |
| BR-12 | Deactivate resource only when **no ongoing/future confirmed booking** | Existing `endAt > now` → 409                         |
| BR-13 | Inactive resources and cancelled bookings remain visible              | History retained                                     |
| BR-14 | Completed status is derived from time; not persisted                  | No scheduled status update                           |

**Examples:**

| Situation                                             | Permitted? | Explanation                         |
| ----------------------------------------------------- | ---------- | ----------------------------------- |
| Alice books Room A 09:00–10:00, Bob books 10:00–11:00 | **Yes**    | Adjacent intervals                  |
| Alice books 09:00–10:00, Bob tries 09:30–10:30        | **No**     | Overlap                             |
| Bob opens Alice's booking details                     | **Yes**    | All bookings viewable               |
| Bob edits/cancels Alice's future booking              | **No**     | Creator-only mutation               |
| Alice cancels her future confirmed booking            | **Yes**    | Slot opens again                    |
| Alice edits her booking after it has started          | **No**     | Ongoing/past immutable              |
| Bob edits a room originally added by Alice            | **Yes**    | Collaborative resource maintenance  |
| Bob deletes a room never reserved                     | **Yes**    | No history                          |
| Bob deletes room with a cancelled reservation         | **No**     | Still has history                   |
| Bob deactivates resource with completed bookings only | **Yes**    | No ongoing/future confirmed booking |
| Bob deactivates room during an ongoing booking        | **No**     | Active booking protected            |

---

## 9. Database and conceptual ER specification

### 9.1 Chen-notation conceptual model

**Diagram:** `ReserveHub_Final_Chen_ER_Diagram.drawio` (editable source), plus `.svg` / `.png` previews. The diagram uses entity rectangles, attribute ellipses, relationship diamonds, cardinality labels `1`/`N`, and underlined primary keys.

**Exactly three entities and three relationships:**

```text
USER (1) ───── CREATES ───── (N) RESOURCE
USER (1) ─────  MAKES  ───── (N) RESERVATION
RESOURCE (1) ─ BOOKED FOR ── (N) RESERVATION
```

- One `USER` may create zero or many resources; each resource records exactly one creator.
- One `USER` may create zero or many reservations; each reservation belongs to exactly one creator.
- One `RESOURCE` may have zero or many reservations; each reservation is for exactly one resource.
- This is a **conceptual Chen ER**: the relationship connectors represent foreign keys. FK columns appear in the physical Prisma models, not redundantly as independent conceptual relationship attributes.
- JWT is a token, **not a separate entity**. No `Role`, `Admin`, `Permission`, or `Session` entity is required.

### 9.2 Entity attributes

**USER**

| Attribute             | Physical type / rule                                    |
| --------------------- | ------------------------------------------------------- |
| `id` (`userId` in ER) | UUID/string primary key (Prisma `@id @default(uuid())`) |
| `name`                | String; required                                        |
| `email`               | String; required, unique, normalized lowercase          |
| `passwordHash`        | String; bcrypt hash; never returned in API              |
| `createdAt`           | `DateTime`, generated                                   |

**RESOURCE**

| Attribute                 | Physical type / rule                           |
| ------------------------- | ---------------------------------------------- |
| `id` (`resourceId` in ER) | UUID/string primary key                        |
| `name`                    | Required string                                |
| `type`                    | Enum `MEETING_ROOM` / `EQUIPMENT`              |
| `location`                | Required string                                |
| `capacity`                | Optional positive integer                      |
| `description`             | Optional string                                |
| `isActive`                | Boolean, default `true`                        |
| `createdById`             | FK → `User.id`, required, `onDelete: Restrict` |
| `createdAt`, `updatedAt`  | Automatically maintained timestamps            |

**RESERVATION**

| Attribute                    | Physical type / rule                                |
| ---------------------------- | --------------------------------------------------- |
| `id` (`reservationId` in ER) | UUID/string primary key                             |
| `userId`                     | FK → `User.id`, required, `onDelete: Restrict`      |
| `resourceId`                 | FK → `Resource.id`, required, `onDelete: Restrict`  |
| `purpose`                    | Required string                                     |
| `startAt`, `endAt`           | `DateTime` with PostgreSQL `@db.Timestamptz(3)`     |
| `status`                     | Enum `CONFIRMED` / `CANCELLED`, default `CONFIRMED` |
| `createdAt`                  | Generated timestamp                                 |

**Recommended indexes:** Resource `createdById` and `isActive`; Reservation `(resourceId,startAt)`, `(userId,startAt)`, `(status,startAt)`; User unique `email`. PostgreSQL also manages an index for the reservation exclusion constraint.

### 9.3 Database integrity and deletion

- Enforce the email uniqueness and FK requirements in PostgreSQL.
- Keep `Reservation.resourceId` restrictive on delete so past bookings remain referentially valid.
- Never expose a user deletion operation; related resources and reservations depend on User records.
- Use `CHECK ("endAt" > "startAt")` for interval ordering, if supported via manual migration.
- Apply a PostgreSQL exclusion constraint for overlap prevention (Section 10).
- A resource with historical bookings can remain `isActive=false`; this is **soft deactivation**, not automatic deletion.

### 9.4 Example Prisma model shape (implementation guidance, not yet executed)

```prisma
// The complete datasource/generator declarations are supplied during setup.
enum ResourceType {
  MEETING_ROOM
  EQUIPMENT
}

enum ReservationStatus {
  CONFIRMED
  CANCELLED
}

model User {
  id                 String        @id @default(uuid())
  name               String
  email              String        @unique
  passwordHash       String
  createdAt          DateTime      @default(now())
  createdResources   Resource[]    @relation("ResourceCreator")
  reservations       Reservation[]
}

model Resource {
  id                 String        @id @default(uuid())
  name               String
  type               ResourceType
  location           String
  capacity           Int?
  description        String?
  isActive           Boolean       @default(true)
  createdById        String
  createdBy          User          @relation("ResourceCreator", fields: [createdById], references: [id], onDelete: Restrict)
  createdAt          DateTime      @default(now())
  updatedAt          DateTime      @updatedAt
  reservations       Reservation[]

  @@index([createdById])
  @@index([isActive])
}

model Reservation {
  id                 String            @id @default(uuid())
  userId             String
  resourceId         String
  purpose            String
  startAt            DateTime          @db.Timestamptz(3)
  endAt              DateTime          @db.Timestamptz(3)
  status             ReservationStatus @default(CONFIRMED)
  createdAt          DateTime          @default(now())
  user               User              @relation(fields: [userId], references: [id], onDelete: Restrict)
  resource           Resource          @relation(fields: [resourceId], references: [id], onDelete: Restrict)

  @@index([resourceId, startAt])
  @@index([userId, startAt])
  @@index([status, startAt])
}
```

**Prisma v7 note:** The connection configuration may belong in `prisma.config.ts` and the application may require a driver adapter; confirm against the exact installed Prisma version. The schema above documents the agreed data model, not a claim that it has already been migrated.

---

## 10. Overlap prevention and concurrency design

### 10.1 Overlap formula

Two confirmed bookings of the same resource overlap when:

```typescript
existing.startAt < requested.endAt && existing.endAt > requested.startAt;
```

Intervals touching at their boundaries do not overlap. A cancelled booking must not block future slots. A reschedule excludes the current reservation row from the preliminary lookup.

### 10.2 PostgreSQL constraint (P0, critical)

Application-only checks have a race: two concurrent requests can both find the same slot free. Add the constraint in a **Prisma migration SQL file** using PostgreSQL's `btree_gist` extension and range support:

```sql
-- Supports GiST equality on the resource's string ID.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Confirmed bookings for one resource may never have intersecting time ranges.
ALTER TABLE "Reservation"
ADD CONSTRAINT reservation_no_confirmed_overlap
EXCLUDE USING gist (
  "resourceId" WITH =,
  tstzrange("startAt", "endAt", '[)') WITH &&
)
WHERE ("status" = 'CONFIRMED');

-- Ordering validation; optionally put in the same migration.
ALTER TABLE "Reservation"
ADD CONSTRAINT reservation_valid_interval CHECK ("endAt" > "startAt");
```

**Implementation detail:** Depending on the generated migration/enum naming and the database permissions, adjust SQL to match the actual schema and confirm `CREATE EXTENSION` succeeds on Neon. An exclusion violation is normally PostgreSQL SQLSTATE **23P01**. Convert that database failure to an HTTP 409 with a friendly message. Test by firing two concurrent booking requests for the same interval; **exactly one** must succeed.

### 10.3 Resource lifecycle / booking race

A booking must not slip in at the same time as resource deactivation. For booking create and resource deactivation, use a consistent database transaction strategy: lock the relevant Resource row (`SELECT ... FOR UPDATE`, using safe parameterization), then check `isActive` and (for deactivation) that there is no `CONFIRMED` reservation whose `endAt>now`. Perform the write before releasing the transaction. Hard delete also relies on FK Restrict; do the history check and delete transactionally and handle a concurrent FK rejection gracefully.

The GiST constraint is still required for booking-to-booking concurrency. A UI-only check is never sufficient.

### 10.4 Editing and cancelling safely

- Check current user ID, reservation owner, `CONFIRMED` status and future `startAt` on the server **at mutation time**.
- Update the reservation transactionally (guard against stale writes with a conditional `updateMany` if appropriate).
- Recheck the new interval and rely on PostgreSQL exclusion as the final conflict barrier.
- Cancellation sets `status=CANCELLED`; it never deletes the row.
- Return specific errors: 400 invalid data, 401 unauthenticated, 403 non-owner, 404 unknown resource/booking, 409 overlap, invalid lifecycle, or blocked resource deactivation/delete.

---

## 11. HTTP API specification

All endpoints use JSON except `204 No Content`; authenticated endpoints require the signed cookie. Bracketed segments are Next.js App Router dynamic segments.

| Method   | Route                                      | Access           | Behavior                              | Priority |
| -------- | ------------------------------------------ | ---------------- | ------------------------------------- | -------- |
| `POST`   | `/api/auth/register`                       | Public           | Register                              | P0       |
| `POST`   | `/api/auth/login`                          | Public           | JWT login/cookie                      | P0       |
| `POST`   | `/api/auth/logout`                         | Session          | Clear cookie                          | P0       |
| `GET`    | `/api/auth/me`                             | Session          | Current public user profile           | P0       |
| `GET`    | `/api/resources`                           | Session          | List all resources                    | P0       |
| `POST`   | `/api/resources`                           | Session          | Create resource                       | P0       |
| `GET`    | `/api/resources/[resourceId]`              | Session          | Resource details                      | P0       |
| `PATCH`  | `/api/resources/[resourceId]`              | Session          | Edit/activate/deactivate resource     | P0       |
| `DELETE` | `/api/resources/[resourceId]`              | Session          | Delete only if never reserved         | P0       |
| `GET`    | `/api/resources/[resourceId]/availability` | Session          | Check interval availability           | P0       |
| `GET`    | `/api/reservations`                        | Session          | All/Mine bookings (`scope=all\|mine`) | P0       |
| `POST`   | `/api/reservations`                        | Session          | Create booking for current user       | P0       |
| `GET`    | `/api/reservations/[reservationId]`        | Session          | View any booking                      | P0       |
| `PATCH`  | `/api/reservations/[reservationId]`        | **Creator only** | Change purpose/time of future booking | P0       |
| `POST`   | `/api/reservations/[reservationId]/cancel` | **Creator only** | Cancel future booking                 | P0       |
| `GET`    | `/api/dashboard`                           | Session          | Small stats summary                   | P1       |

**No** `DELETE /api/reservations` endpoint. **No** admin routes or role arguments. `scope=mine` is a filter and not a separate permission. Queries returning reservations should include a _limited nested user selection_ such as `user: { select: { id: true, name: true } }`, not a raw User row containing passwordHash.

### 11.1 Representative requests

**`POST /api/resources`**

```json
{
  "name": "Meeting Room A",
  "type": "MEETING_ROOM",
  "location": "Second Floor",
  "capacity": 10,
  "description": "Projector and whiteboard"
}
```

**`POST /api/reservations`**

```json
{
  "resourceId": "<resource-uuid>",
  "purpose": "Sprint planning",
  "startAt": "2026-10-14T04:30:00.000Z",
  "endAt": "2026-10-14T05:30:00.000Z"
}
```

**`PATCH /api/reservations/[reservationId]`**

```json
{
  "purpose": "Updated sprint planning",
  "startAt": "2026-10-14T05:30:00.000Z",
  "endAt": "2026-10-14T06:30:00.000Z"
}
```

These JSON examples show request shapes; the specific dates are illustrative and may be past by implementation/testing time. **Generate future intervals dynamically in tests/demo**. Reservation request bodies never contain `userId`.

### 11.2 Response conventions

- Success list: `{ "data": [...] }` and optional pagination metadata.
- Success item: `{ "data": { ... } }`.
- Error: `{ "error": { "code": "RESERVATION_CONFLICT", "message": "This resource is already reserved for the selected time." } }`.
- `400` validation, `401` authentication, `403` owner check, `404` not found, `409` conflict/lifecycle, `500` unexpected error without leaking stack traces.
- Document server-side input limits and consistent date serialization in ISO-8601 UTC.

---

## 12. Frontend page and screen specification

| Screen             | Route                           | Must show / support                                                                     |
| ------------------ | ------------------------------- | --------------------------------------------------------------------------------------- |
| Login              | `/login`                        | Email/password, validation, invalid credentials message                                 |
| Registration       | `/register`                     | Name/email/password/confirm, duplicate validation                                       |
| Dashboard          | `/dashboard`                    | Summary cards (P1); may redirect to Resources in P0                                     |
| Resources list     | `/resources`                    | Active/inactive items, creator name, Add Resource, view/edit/deactivate/delete eligible |
| New resource       | `/resources/new`                | Validated form; all users                                                               |
| Resource detail    | `/resources/[resourceId]`       | Full details, creator, availability, resource reservations                              |
| Edit resource      | `/resources/[resourceId]/edit`  | Prefilled form; all users                                                               |
| Reservations list  | `/reservations`                 | All records, creator name, status, All/Mine filter                                      |
| New reservation    | `/reservations/new`             | Resource picker, start/end, purpose, availability feedback                              |
| Reservation detail | `/reservations/[reservationId]` | Read-only for non-owners; edit/cancel for owner + future confirmed                      |

**UI layout notes:**

- Global header with brand, navigation, current user's name and Logout.
- Use shadcn/ui **Button, Input, Label, Select, Card, Badge, Dialog**; basic Table if helpful.
- Use an HTML `datetime-local` input or simple Date/Time controls; do not spend time building a large calendar component.
- Client may hide edit/cancel buttons for non-owners, but server always checks ownership.
- For future confirmed reservations owned by the user, show **Edit** and **Cancel** with confirmation.
- For other users' reservations, show **"View only — created by [name]"**.
- For ongoing/completed/cancelled bookings, hide or disable mutation controls and show why.
- For resources with booking history, show **Deactivate** rather than Delete; resource lifecycle restrictions remain enforced on server.
- If an active booking blocks deactivation, show a useful conflict message instead of silently deactivating.

### 12.1 Example reservation table

| Resource    | Reserved by | Start           | End             | Status    | Actions for signed-in user       |
| ----------- | ----------- | --------------- | --------------- | --------- | -------------------------------- |
| Room A      | Alice       | Tomorrow, 9:00  | Tomorrow, 10:00 | Upcoming  | Alice: Edit/Cancel; others: View |
| Projector A | Bob         | Today, 10:00    | Today, 11:00    | Completed | View                             |
| Room B      | Alice       | Tomorrow, 13:00 | Tomorrow, 14:00 | Cancelled | View                             |

### 12.2 Responsiveness and accessibility

Labels must match inputs, keyboard focus must be visible, dialogs should have accessible titles, errors should have readable contrast, and large tables should remain usable on mobile (stack rows into cards if necessary). Choose a restrained consistent visual style; functionality takes precedence over complex dashboard layouts.

---

## 13. Application architecture and stack

| Layer                | Choice                                          | Reason                                              |
| -------------------- | ----------------------------------------------- | --------------------------------------------------- |
| Full stack           | **Next.js App Router**                          | Required; one deployable codebase                   |
| Language             | TypeScript                                      | Required; end-to-end types                          |
| UI styling           | Tailwind CSS + basic shadcn/ui                  | Faster consistent components                        |
| Forms and validation | React Hook Form (optional) + Zod                | Practical form validation and shared rules          |
| Auth                 | `jose`, `bcryptjs`, HTTP-only cookie            | Simple, explainable JWT flow                        |
| Database             | PostgreSQL via Neon                             | Required; persistent and familiar                   |
| ORM                  | Prisma                                          | Familiar schema, queries, migrations                |
| Tests                | Jest (or Vitest if simpler), targeted API tests | Core business and security checks                   |
| Version control      | Git + GitHub                                    | Required                                            |
| Hosting              | Local is mandatory; Vercel is optional          | Assessment explicitly requires local run capability |

### 13.1 Data flow

```text
Browser / React pages
        |
Next.js App Router + Route Handlers
        |
requireUser() / Zod input validation
        |
Resource Service / Reservation Service
        |
Prisma client + PostgreSQL transactions
        |
Neon PostgreSQL (+ no-overlap exclusion constraint)
```

**Architecture decision:** No NestJS backend, REST gateway, Dockerized microservices, Redis or background worker. Route handlers call reusable server-side business modules, avoiding duplicating logic inside page components. Do not use dynamic imports for app modules; keep imports at the top.

### 13.2 Proposed folder structure

```text
reservehub/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── (protected)/
│   │   ├── layout.tsx
│   │   ├── dashboard/page.tsx                  # P1
│   │   ├── resources/
│   │   │   ├── page.tsx
│   │   │   ├── new/page.tsx
│   │   │   └── [resourceId]/
│   │   │       ├── page.tsx
│   │   │       └── edit/page.tsx
│   │   └── reservations/
│   │       ├── page.tsx
│   │       ├── new/page.tsx
│   │       └── [reservationId]/page.tsx
│   ├── api/
│   │   ├── auth/{register,login,logout,me}/route.ts   # conceptual folder shorthand
│   │   ├── resources/route.ts
│   │   ├── resources/[resourceId]/route.ts
│   │   ├── resources/[resourceId]/availability/route.ts
│   │   ├── reservations/route.ts
│   │   ├── reservations/[reservationId]/route.ts
│   │   └── reservations/[reservationId]/cancel/route.ts
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── ui/                                    # shadcn/ui components
│   ├── resources/
│   ├── reservations/
│   └── layout/
├── lib/
│   ├── auth.ts                                # sign/verify + requireUser
│   ├── db.ts                                  # Prisma singleton / adapter
│   ├── validators/
│   ├── services/
│   │   ├── resources.ts
│   │   └── reservations.ts
│   └── errors.ts
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── docs/
│   ├── ReserveHub_Requirements_Implementation_Plan_v3.md
│   ├── ReserveHub_Final_Chen_ER_Diagram.drawio
│   └── ReserveHub_Final_Chen_ER_Diagram.svg
├── tests/
├── .env.example
├── README.md
└── package.json
```

**Note:** The `{register,login,...}` path line illustrates separate folders; do **not** literally create a folder with braces. Use separate `app/api/auth/register/route.ts`, `login/route.ts`, etc.

### 13.3 Neon connectivity / Prisma risk

The developer previously experienced blocked direct connections on PostgreSQL port 5432. **Check real database connectivity and migrations at the very start**. If the chosen network blocks standard connections, prefer a supported Neon serverless driver/Prisma adapter or an already-tested migration workflow rather than introducing a second backend. Do not assume an adapter solves Prisma CLI migrations automatically. Avoid changing database architecture at the last minute; prove read/write plus migration before building screens.

---

## 14. Security decisions and known limitations

1. **JWT:** server-signed, stored in secure HTTP-only cookie; 12-hour expiration; verify on each protected action.
2. **Passwords:** bcryptjs hash only; never log or return them.
3. **CSRF:** `SameSite=Lax`, proper origin validation for mutations and safe JSON requests.
4. **Server-side authorization:** only creator may change/cancel their reservation; all user and resource IDs derived from trusted sources.
5. **Safe database access:** Prisma and parameterized SQL; never interpolate user strings into raw queries.
6. **Resource permissions:** all authenticated users can change resources; this is a **deliberate business simplification**, not robust organization-wide authorization.
7. **Public reservation details within organization:** all registered users can see booking metadata and creator names. Never return personal email/passwordHash in reservation reads.
8. **No general user deletion:** FK-referenced history must remain valid.
9. **Known production gaps:** no email verification, login throttling, fine-grained RBAC, audit trail, JWT revocation, fraud prevention or advanced monitoring. These are explicitly future improvements.

---

## 15. Non-functional requirements

| ID     | Requirement                                                | Validation                            |
| ------ | ---------------------------------------------------------- | ------------------------------------- |
| NFR-01 | Data survives restart                                      | Register/create/refresh and re-read   |
| NFR-02 | Same-resource overlap is impossible for confirmed bookings | Database constraint + concurrent test |
| NFR-03 | Server validates all mutations                             | Bad requests return 400/409           |
| NFR-04 | Protected APIs require JWT                                 | Missing/expired cookie → 401          |
| NFR-05 | Creator-only reservation changes                           | Other account → 403                   |
| NFR-06 | Resource deletion preserves reservation history            | FK restrict + 409                     |
| NFR-07 | Resource deactivation preserves ongoing/future bookings    | 409 on active bookings                |
| NFR-08 | Consistent UTC timestamps and Colombo display              | Manually verify conversion            |
| NFR-09 | UI works on laptop and phone widths                        | Manual layout check                   |
| NFR-10 | Clear errors/loading/empty states                          | Manual acceptance                     |
| NFR-11 | No secrets committed or logged                             | `.gitignore` + source review          |
| NFR-12 | Local setup is reproducible using README                   | Clean install smoke test              |
| NFR-13 | Business rules reside in server modules                    | Code review                           |
| NFR-14 | Data design reflects submitted Chen ER                     | Schema-to-diagram verification        |

---

## 16. Exact development task backlog

**P0 items are required.** P1 items may be skipped if time is short.

| Task     | Priority | Implementation                                                    | Definition of done                              | Depends on |
| -------- | -------- | ----------------------------------------------------------------- | ----------------------------------------------- | ---------- |
| **T-01** | P0       | Create Next.js App Router TypeScript project, Tailwind, shadcn/ui | Project runs locally                            | —          |
| **T-02** | P0       | Set up repository, environment example, lint/build commands       | Clean Git state, no secrets                     | T-01       |
| **T-03** | P0       | Configure Prisma/Neon; test DB connection                         | Migration and round-trip query work             | T-01       |
| **T-04** | P0       | Implement 3 database entities/enums/relations                     | Schema and Chen ER agree                        | T-03       |
| **T-05** | P0       | Apply PostgreSQL no-overlap and FK constraints                    | DB rejects overlapping confirmed writes         | T-04       |
| **T-06** | P0       | Build JWT/password helpers and validation                         | Sign/verify/hash unit tests                     | T-04       |
| **T-07** | P0       | Build register/login/logout/me APIs and UI                        | Two independent users log in                    | T-06       |
| **T-08** | P0       | Protected shell and `requireUser` helpers                         | Anonymous requests blocked                      | T-07       |
| **T-09** | P0       | Resource list/detail/create service/API/UI                        | Any signed-in user can add and view             | T-08       |
| **T-10** | P0       | Resource edit, deactivate/reactivate, safe hard-delete            | History/deactivation rules pass tests           | T-09       |
| **T-11** | P0       | Availability lookup                                               | Correct result for occupied/free intervals      | T-05, T-09 |
| **T-12** | P0       | Reservation create service/API/UI                                 | Slot booked under signed-in user                | T-11       |
| **T-13** | P0       | List/detail All/Mine reservations with creator display            | Any user can read; private fields hidden        | T-12       |
| **T-14** | P0       | Owner-only edit and cancel API/UI                                 | Other owner gets 403; future rule enforced      | T-13       |
| **T-15** | P0       | Race-safety and edge-case tests                                   | One winner on concurrent same-slot booking      | T-14       |
| **T-16** | P0       | Error states, responsive polish, input usability                  | Complete journeys usable                        | T-15       |
| **T-17** | P0       | README, ER upload/link, verification checklist                    | New developer can run app                       | T-16       |
| **T-18** | P0       | Record 3–5-minute demonstration                                   | Video clearly illustrates core design           | T-17       |
| **T-19** | P0       | Submit correct GitHub/video/ER links                              | Submission form completed on time               | T-18       |
| **T-20** | P1       | Dashboard cards and upcoming reservations                         | Summary accurate                                | T-13       |
| **T-21** | P1       | Resource and reservation filters/search                           | Search works with no extra backend complexity   | T-13       |
| **T-22** | P1       | Additional tests / styling                                        | Improves confidence without delaying submission | T-15       |

### 16.1 Work packages and dependency path

```text
T-01/T-02 → T-03/T-04/T-05 → T-06/T-07/T-08
                                |
                                v
                    T-09/T-10 (Resources)
                                |
                                v
                    T-11/T-12 (Booking)
                                |
                                v
                  T-13/T-14 (View/Ownership)
                                |
                                v
                    T-15/T-16 (Tests/UI)
                                |
                                v
                 T-17/T-18/T-19 (Submission)
```

Do not implement all pages before testing one working end-to-end create/read flow. Commit small working slices to GitHub.

---

## 17. Three-day schedule (13–15 October 2026)

### Day 1 — Tuesday, 13 October: foundation and resource management

- [ ] Create repository and Next.js + Tailwind + shadcn/ui project.
- [ ] Resolve Prisma/Neon connection and verify migration pipeline first.
- [ ] Create User, Resource and Reservation tables, FKs, enums, indexes.
- [ ] Add and verify the no-overlap exclusion constraint.
- [ ] Implement registration/login/logout/JWT cookie and protected shell.
- [ ] Complete resource listing and creation; edit/deactivate/delete if time allows.
- [ ] Commit tested changes.

**Exit criterion:** Two users can register/login; resource information persists; schema and migration work; no role field exists.

### Day 2 — Wednesday, 14 October: business flow and authorization

- [ ] Finish resource lifecycle API/UI and creator attribution.
- [ ] Implement availability check and booking creation.
- [ ] Implement all-reservation listing and My reservations filter.
- [ ] Display reservation creator name.
- [ ] Implement owner-only edit/reschedule and future-only cancel.
- [ ] Test overlapping/adjacent periods and conflicting concurrent submissions.
- [ ] Test resource deletion/deactivation rules and booking-vs-deactivation safety.

**Exit criterion:** The complete authenticated reservation journey works, and User B cannot edit or cancel User A's bookings.

### Day 3 — Thursday, 15 October: finish and submit

- [ ] Resolve bugs from the end-to-end smoke test.
- [ ] Test security edge cases, error messages, refresh and mobile layout.
- [ ] Run lint/type-check/build and focused tests.
- [ ] Finalize README and environment/setup instructions.
- [ ] Commit updated `.drawio` and `.svg`, confirm shareable links.
- [ ] Add simple dashboard only if all P0 features are stable.
- [ ] Record/edit/check the **3–5 minute video**.
- [ ] Submit GitHub, ER and video links with the correct application email.

**Target:** Submit before approximately **10 PM Sri Lanka time** on October 15, allowing a buffer before the 11:59 PM hard deadline.

### 17.1 Fallback plan when behind schedule

1. **Never drop** persistent storage, a working resource list/create flow, reservation creation, and double-booking prevention.
2. Keep authentication and owner-only reservation mutation checks; simplify the UI rather than security.
3. If short on time, remove dashboard, advanced filters, and styling work.
4. If the resource activation/deletion lifecycle is difficult, prefer a smaller **well-tested** safe implementation and document the exact missing path; do not silently violate referential integrity.
5. Preserve at least enough time to produce the **mandatory** README, ER link, video and submission.

---

## 18. Automated and manual test plan

### 18.1 Authentication / authorization

- [ ] **AUTH-T01:** Valid registration persists with hashed password.
- [ ] **AUTH-T02:** Duplicate normalized email is rejected.
- [ ] **AUTH-T03:** Invalid registration input rejected.
- [ ] **AUTH-T04:** Login succeeds with correct password; wrong one returns 401.
- [ ] **AUTH-T05:** Missing/tampered/expired JWT rejected.
- [ ] **AUTH-T06:** Logout clears cookie.
- [ ] **AUTH-T07:** Signup body cannot set `role` or override saved User fields.
- [ ] **AUTH-T08:** Spoofed `userId` on booking/create resource cannot change creator.
- [ ] **AUTH-T09:** User A and User B can view all bookings.
- [ ] **AUTH-T10:** User B cannot edit/cancel User A's booking (403) even via manual requests.
- [ ] **AUTH-T11:** Valid owner of **ongoing/completed/cancelled** booking cannot mutate it.
- [ ] **AUTH-T12:** PasswordHash/email not leaked in booking API responses.

### 18.2 Resource tests

- [ ] **RES-T01:** Any authenticated user creates a resource.
- [ ] **RES-T02:** Invalid name/type/location/capacity rejected.
- [ ] **RES-T03:** Another user can edit resource, but original creator attribution remains.
- [ ] **RES-T04:** Unused resource hard-deletes successfully.
- [ ] **RES-T05:** Resource with even **cancelled** history cannot hard-delete.
- [ ] **RES-T06:** Resource with completed-only reservations can be deactivated.
- [ ] **RES-T07:** Resource with ongoing/future confirmed booking cannot deactivate.
- [ ] **RES-T08:** Inactive resource rejects new bookings; reactivation restores ability.
- [ ] **RES-T09:** Concurrent delete/booking cannot leave dangling FK records.

### 18.3 Reservation and availability tests

- [ ] **BOOK-T01:** Owner creates a valid future booking and name appears in listing.
- [ ] **BOOK-T02:** Adjacent bookings for same resource are allowed.
- [ ] **BOOK-T03:** Overlapping bookings for same resource rejected (409).
- [ ] **BOOK-T04:** Same time for **different** resources allowed.
- [ ] **BOOK-T05:** Two concurrent same-resource/time writes → only one succeeds.
- [ ] **BOOK-T06:** Invalid/missing/past/zero-length/negative interval rejected.
- [ ] **BOOK-T07:** Cancelled booking does not block same slot.
- [ ] **BOOK-T08:** Owner reschedules future booking successfully.
- [ ] **BOOK-T09:** Owner reschedule into occupied interval fails without changing old row.
- [ ] **BOOK-T10:** Non-owner edit/cancel fails with 403; read is still allowed.
- [ ] **BOOK-T11:** Future cancellation changes stored status but preserves record.
- [ ] **BOOK-T12:** Ongoing/completed booking cannot be cancelled or edited.
- [ ] **BOOK-T13:** Availability result agrees with successful booking writes.
- [ ] **BOOK-T14:** Resource deactivation and booking race obey active-booking rule.
- [ ] **BOOK-T15:** Stored/derived lifecycle status is correct at boundaries.

### 18.4 UI, build and documentation

- [ ] Register → login → add resource → reserve → list → edit → cancel works in browser.
- [ ] Second browser/private session sees the first account's reservation but cannot edit it.
- [ ] Resource status and creator display clearly.
- [ ] All error messages are actionable; forms do not lose data after 409.
- [ ] Works on desktop and mobile-size viewport.
- [ ] ESLint and production build succeed.
- [ ] README instructions checked from a clean environment, or steps precisely recorded.
- [ ] Draw.io diagram opens successfully and shows 3 entities/3 relationships.
- [ ] Demo video is between 3 and 5 minutes and all shared links can be opened.

**Testing policy:** Automated tests should cover overlap, ownership, lifecycle and auth helpers first. Manual acceptance is acceptable for visual polish. Never claim unexecuted tests have passed.

---

## 19. Seed data and demo scenario

Seed fictional resources (e.g. Room A, Room B, Projector A) using a **known seeded demo user** (or create them through the UI); all resources must have a valid `createdById`. The UI registration flow can create a second user for the video. Avoid fixed reservation dates that will be past during the presentation; create reservations for a date safely in the future.

**Demonstration scenario:**

1. Register/log in as Alice and add Room A.
2. Book Room A for an upcoming time; show successful reservation and creator name.
3. Attempt a conflicting booking in a second user session; show a helpful 409.
4. Show User B can **view** Alice's reservation but cannot edit/cancel it.
5. Switch back to Alice; reschedule or cancel her future reservation.
6. Demonstrate resource deletion if never reserved, versus deactivation if it has history.
7. Briefly explain the 3-table Chen ER, signed JWT cookie, and database-level overlap constraint.

---

## 20. README and final submission checklist

### README must contain

1. App name, problem statement and key features **actually implemented**.
2. Stack versions and Node version requirement.
3. Prerequisites: Node/npm and PostgreSQL/Neon credentials.
4. `.env.example` keys; how to configure `DATABASE_URL`, JWT secret, and app base URL without committing secrets.
5. Dependency install, Prisma client generation, migration, seeding, and local dev commands.
6. How to run lint, build, tests and reset demo data safely.
7. Architecture/data model overview, constraint explanation and intentional lack of RBAC.
8. Known limitations and tradeoffs; what was not finished, if any.
9. ER diagram and demonstration video links.

### GitHub artifacts

```text
docs/
  ReserveHub_Requirements_Implementation_Plan_v3.md
  ReserveHub_Final_Chen_ER_Diagram.drawio
  ReserveHub_Final_Chen_ER_Diagram.svg
README.md
.env.example
```

### Required external submission

- [ ] GitHub repository accessible to reviewers, containing complete source and README.
- [ ] ER diagram accessible through a **shareable link** (e.g. committed `.drawio` or `.svg` in public repository).
- [ ] **3–5 minute** screen recording accessible to reviewers.
- [ ] Form submitted through https://forms.gle/HzQH6tB5c4edPjnn8 **before 11:59 PM, 15 Oct 2026 Sri Lanka time**.
- [ ] Exact email address matches the original CV/application email.
- [ ] Verify all links in a browser not signed into your personal account.

**Remember:** A local `.drawio` file is not by itself a _shareable URL_; upload it to a repository or link-accessible drive location.

---

## 21. Architectural decision record (ADR)

| Decision                                                  | Rationale                                                            | Trade-off                                                 |
| --------------------------------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------- |
| **ADR-01: Next.js full-stack monolith**                   | Required framework; fast to develop and explain                      | Less separation than microservices, acceptable for MVP    |
| **ADR-02: JWT in HTTP-only cookie**                       | Small familiar auth flow; server-rendering compatible                | No token revocation/refresh in MVP                        |
| **ADR-03: No RBAC**                                       | Not assessment-required; three-day limit; reduce code and test scope | Anyone logged in can manage resources                     |
| **ADR-04: Creator-only reservation mutations**            | Protect users from one another without roles                         | Any user still sees organizational bookings               |
| **ADR-05: Resource creator for attribution only**         | Display who added resources without complex ownership rules          | Other users may edit those records                        |
| **ADR-06: Hard delete unused resource only**              | Clean up accidental entries                                          | Resources with any history must remain                    |
| **ADR-07: Soft deactivate resources with history**        | Preserve booking integrity                                           | Must block while confirmed ongoing/future bookings remain |
| **ADR-08: Cancel instead of deleting reservations**       | History and simpler lifecycle                                        | No permanent reservation deletion                         |
| **ADR-09: PostgreSQL no-overlap exclusion constraint**    | Correct under concurrent requests                                    | Needs tested SQL migration                                |
| **ADR-10: Two persisted reservation statuses**            | Derive completion from time; no scheduled workers                    | Status presentation depends on current time               |
| **ADR-11: Basic shadcn/ui only**                          | Consistent UI while learning a small component set                   | Less visual customization; easier to defend               |
| **ADR-12: No dynamic importing or backend microservices** | Small codebase, familiar debugging                                   | Advanced separation deferred                              |

### Interview explanation of omitted RBAC

> The assessment focused on practical resource reservations rather than organizational role management. Given the fixed deadline, I deliberately implemented one authenticated user type. All users can maintain the resource catalog and view reservations, while the server permits only a reservation's creator to reschedule or cancel it. This provided a clear security boundary without the time and testing cost of a complete RBAC system. A production rollout should introduce appropriate administrator privileges and audit logging.

### Interview explanation of resource deletion

> We allow hard deletion only for a resource that has never been referenced by a reservation. Historical records remain intact, including cancelled ones. A resource with history can be deactivated once it has no current or future confirmed reservation. This makes accidental entries removable without destroying booking history.

---

## 22. Risks and mitigation

| Risk                                  | Impact                             | Mitigation                                                              |
| ------------------------------------- | ---------------------------------- | ----------------------------------------------------------------------- |
| Neon connection/migration failure     | Blocks all backend functionality   | Prove migrations first on Day 1; reuse known compatible driver workflow |
| Overbooking under concurrent requests | Core scenario fails                | PostgreSQL exclusion constraint + concurrent test                       |
| Race between booking and deactivation | Inconsistent active-resource state | Consistent Resource row-lock transactions                               |
| Unauthorized booking mutation         | Cross-user data corruption         | Server-side creator comparison, 403 tests                               |
| Overly large UI scope                 | Incomplete core workflows          | Basic shadcn/ui, simple forms, P1 dashboard only after P0               |
| Confusing lifecycle rules             | Incorrect deletes/cancels          | Explicit BR matrix and status tests                                     |
| Hard deletion violates FK integrity   | Missing historical resource        | Restrict FK and return 409                                              |
| UTC/local date confusion              | Incorrect slots                    | Consistent instant storage and `Asia/Colombo` presentation              |
| Running out of time for delivery      | Missing mandatory artifacts        | Save Day 3 for README, ER, video, form                                  |

---

## 23. Definition of Done — final approval checklist

The application is ready to submit when **all** of the following are true:

- [ ] Users can register, log in and log out using secure JWT cookies.
- [ ] A logged-in user can add and manage shared resources.
- [ ] Original resource creator remains visible, but **does not limit resource edits**.
- [ ] Unused resources can be deleted; resources with any booking history cannot be hard-deleted.
- [ ] Resources with current/future confirmed bookings cannot be deactivated.
- [ ] A user can create a booking for an active resource during a free future interval.
- [ ] Double bookings are rejected on the database side, including concurrent submissions.
- [ ] **All** authenticated users can view all reservations and see the creator's display name.
- [ ] **Only the reservation creator** may edit/reschedule or cancel their **future confirmed** reservation.
- [ ] Other users' bookings, and ongoing/completed/cancelled bookings, are **view-only**.
- [ ] Cancelled bookings remain stored and cease blocking availability.
- [ ] No `role` / `ADMIN` / `USER` authorization logic is implemented.
- [ ] Schema matches the **three-entity / three-relationship Chen ER diagram**.
- [ ] Application runs locally using README directions and the production build is successful.
- [ ] Source is committed and relevant checks are performed.
- [ ] GitHub URL, shareable ER URL and 3–5-minute demo URL are ready and accessible.
- [ ] Final submission is made before the assessment deadline.

**Frozen product summary:** **ReserveHub v1 = JWT-authenticated collaborative resource management + organization-wide reservation visibility + creator-only future booking mutations + reliable no-overlap PostgreSQL scheduling. No RBAC.**

---

## Appendix A — Suggested npm commands

The following `npm`, `npx` and Git commands have the same syntax in **Windows PowerShell** and **Linux Bash**.

```bash
# After scaffolding the project, install chosen dependencies.
npm install jose bcryptjs zod @prisma/client @prisma/adapter-neon @neondatabase/serverless
npm install -D prisma

# shadcn/ui initialization and minimal components.
npx shadcn@latest init
npx shadcn@latest add button input label select card badge dialog table

# Once package scripts and Prisma config are defined:
npx prisma generate
npm run dev
npm run lint
npm run build
```

**Important:** Do not blindly run these until the exact installed Next.js/Prisma versions, database configuration, package scripts and provider adapter have been selected and tested. Follow the project's final README. For PostgreSQL migrations, use the tested compatible CLI/database-access route; generating a Prisma client does not apply database migrations.

## Appendix B — References and traceability

- PrimeWave Lab (Pvt) Ltd, _Software Engineering Internship — Technical Assessment_, sections 2–9 (supplied PDF).
- ReserveHub v2.0 plan and Chen ER diagram (superseded as to role and permission details).
- Project decisions finalized on **13 October 2026**: no RBAC, collaborative resource management, conditional resource hard-delete/deactivation, global reservation read access, creator-only future edit/cancel.
- diagrams.net native uncompressed `.drawio` uses `mxfile → diagram → mxGraphModel → root → mxCell` structure; see https://github.com/jgraph/drawio/wiki/File-Format.

All detailed features beyond the employer's stated technology/delivery/business problem are **our design decisions**, selected to produce an explainable and maintainable MVP before the deadline.
