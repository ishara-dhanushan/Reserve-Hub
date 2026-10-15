# ReserveHub

**Office Resource Reservation Management System**  
**Project:** Software Engineering Internship Technical Assessment

ReserveHub is a full-stack web application for organizing shared office resources such as meeting rooms and equipment. Users can browse resources, check availability, reserve future time slots, and view reservation history. Creator-only booking changes and PostgreSQL constraints protect bookings from unauthorized changes and scheduling conflicts.

The application runs locally as a single **Next.js App Router** project, with **Neon PostgreSQL** for persistent data storage.

## 1. Problem and Solution

Informal booking through messages or spreadsheets makes it difficult to identify available resources, track who reserved them, and avoid overlapping schedules. ReserveHub provides a shared resource catalogue, authenticated booking workflows, transparent reservation history, and database-backed prevention of conflicting bookings.

## 2. Implemented Features

### Authentication

- Register, log in, and log out.
- Passwords hashed with `bcryptjs`.
- JWT sessions stored in HTTP-only cookies.
- Authentication checks on protected pages and API routes.

### Resource Management

- Create and browse meeting rooms and equipment.
- View creator attribution, location, capacity, description, and activity status.
- Edit resources as any authenticated user.
- Deactivate/reactivate resources when allowed by existing reservations.
- Permanently delete a resource only when it has **no reservation history**.

### Reservation Management

- Check availability and create reservations for active resources.
- Prevent overlapping confirmed bookings, including concurrent requests.
- View organization-wide reservation history, or select the **Mine** filter.
- View booking details, including creator, resource, purpose, and dates.
- Edit the purpose or reschedule a **future confirmed booking created by the current user**.
- Cancel eligible bookings without deleting their history; cancelled slots become available again.
- Display **Upcoming**, **Ongoing**, **Completed**, and **Cancelled** statuses.
- Display booking times in **Asia/Colombo (UTC+05:30)**.

## 3. Technology Stack

| Layer          | Technology                                       |
| -------------- | ------------------------------------------------ |
| Application    | Next.js 16 (App Router)                          |
| Language       | TypeScript                                       |
| Frontend       | React 19, Tailwind CSS 4, shadcn/ui, Radix UI    |
| Authentication | `jose` (JWT), `bcryptjs`, HTTP-only cookies      |
| Validation     | Zod                                              |
| Database       | Neon PostgreSQL                                  |
| ORM            | Prisma 7 and `@prisma/adapter-neon`              |
| Testing        | `tsx` integration scripts and Node.js assertions |
| Quality / CI   | ESLint, Prettier, GitHub Actions                 |

**Recommended setup:** Node.js **24.x** (the version used in CI), npm, Git, a Neon PostgreSQL database, and a modern browser. No Docker installation or separately hosted API service is required.

## 4. Architecture

```text
Browser
  |
  v
Next.js 16 (App Router)
  |-- React pages and client components
  |-- REST API Route Handlers
  |-- Authentication and business services
  |-- Prisma Client + Neon adapter
  |
  v
Neon PostgreSQL
  |-- User
  |-- Resource
  |-- Reservation
  |-- Foreign keys and booking integrity constraints
```

Interactive pages call the application's JSON API routes. Authorization, reservation eligibility, and database operations are enforced server-side.

## 5. Local Installation and Setup

### Step 1 — Clone and install

```bash
git clone https://github.com/ishara-dhanushan/Reserve-Hub.git
cd Reserve-Hub
npm ci
```

### Step 2 — Create a Neon PostgreSQL database

1. Visit [Neon Console](https://console.neon.tech/) and create a PostgreSQL project/database.
2. Under **Connect**, obtain the **pooled URL** for application queries and the **direct URL** for Prisma migrations. Both must refer to the same intended database.
3. Use a development database for local setup; do not point development tools at a production database containing important data.

More detail: [Neon PostgreSQL Setup Guide](docs/NeonDB_Setup_Guide.md).

### Step 3 — Configure local environment variables

Copy the supplied `.env.example` to `.env`.

**Windows PowerShell:**

```powershell
Copy-Item .env.example .env
```

**Linux / macOS:**

```bash
cp .env.example .env
```

Replace the placeholder values in `.env` with your own credentials. The application's required values are:

```dotenv
# Neon pooled connection for application requests
DATABASE_URL="postgresql://USER:PASSWORD@YOUR-ENDPOINT-pooler.REGION.aws.neon.tech/DB?sslmode=require"

# Direct connection for Prisma CLI migrations
DIRECT_URL="postgresql://USER:PASSWORD@YOUR-ENDPOINT.REGION.aws.neon.tech/DB?sslmode=require"

# Secret with at least 32 UTF-8 bytes
JWT_SECRET="REPLACE_WITH_YOUR_LONG_RANDOM_SECRET"
```

Generate a suitable secret locally:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

The `.env.example` template also contains **optional testing database** fields, `TEST_DATABASE_URL` and `TEST_DIRECT_URL`. They are not required for normal application use. Never commit `.env`, database credentials, or JWT secrets.

### Step 4 — Apply the committed Prisma migrations

Before applying migrations, **verify that `DIRECT_URL` points to the intended database**.

```bash
npm run prisma:validate
npm run prisma:migrate:deploy
npm run prisma:migrate:status
npm run prisma:generate
```

The repository includes these migrations:

- `20261013090455_init_reservehub` — the three data entities, enums, indexes, and foreign keys.
- `20261013125747_rh_03_prevent_booking_overlap` — the `btree_gist` extension, valid-interval check, and exclusion constraint preventing overlapping confirmed bookings.

**Important:** `prisma.config.ts` uses `DIRECT_URL` if present; otherwise it falls back to `TEST_DIRECT_URL`. Migration commands affect whichever database that URL identifies. `prisma:migrate:deploy` applies **all pending migrations**. For migration errors, check direct database connectivity, credentials, and extension permissions; see the [Prisma Migrations Guide](docs/Prisma_Migrations_Guide.md).

### Step 5 — Start the application

```bash
npm run dev
```

Open **http://localhost:3000**, create an account, and sign in. You can then manage resources and reservations.

To run an optimized build locally:

```bash
npm run build
npm run start
```

## 6. Using ReserveHub

1. **Register or log in** and open the dashboard.
2. Choose **Resources** to add a meeting room or equipment item.
3. Choose **Reservations → New Reservation**.
4. Select an active resource, specify a purpose, and enter a future start/end time.
5. Check availability and confirm the reservation.
6. Return to **Reservations** to view all bookings, or select **Mine** to see your own.
7. Open a future booking you created to edit or cancel it.
8. Sign in with a second account to see the organization-wide view and creator-only editing restrictions.

## 7. Permissions and Reservation Rules

ReserveHub has **one authenticated user type** and does not implement role-based administration.

| Action                                   | Permission / condition                                                    |
| ---------------------------------------- | ------------------------------------------------------------------------- |
| Visit landing page, register or log in   | Public                                                                    |
| Browse resources and reservation history | Any authenticated user                                                    |
| Create or edit a resource                | Any authenticated user                                                    |
| Deactivate a resource                    | Any authenticated user, if no ongoing/upcoming confirmed booking exists   |
| Permanently delete a resource            | Any authenticated user, only if it has no reservation history             |
| Create a reservation                     | Any authenticated user, for an active resource and a free future interval |
| Edit or cancel a booking                 | **Its creator only**, while future and `CONFIRMED`                        |
| Delete reservation history               | Not supported                                                             |

Resource creator information records **attribution**, not exclusive ownership permissions. All authenticated users may maintain resources subject to their lifecycle restrictions. Reservations are different: only their original creators may change eligible future bookings.

Reservations use **half-open intervals** `[startAt, endAt)`, so adjacent bookings are allowed. A PostgreSQL GiST exclusion constraint rejects overlapping **confirmed** bookings for the same resource, even when requests arrive concurrently. Only `CONFIRMED` and `CANCELLED` are stored statuses; Upcoming, Ongoing, and Completed are derived from timestamps. Cancelling a booking releases its slot while preserving history.

## 8. Database Design and ER Diagram

The database consists of three entities:

| Entity        | Purpose                                                       |
| ------------- | ------------------------------------------------------------- |
| `User`        | Stores registered accounts and creates resources/reservations |
| `Resource`    | Describes a bookable room or equipment item                   |
| `Reservation` | Connects a user and resource to a time interval and status    |

Relationships:

- **User 1 → many Resource:** one user may create multiple resources.
- **User 1 → many Reservation:** one user may create multiple bookings.
- **Resource 1 → many Reservation:** one resource may be reserved multiple times over different intervals.

The schema is in [`prisma/schema.prisma`](prisma/schema.prisma). The existing editable, shareable diagram is:

**[ReserveHub ER Diagram (.drawio)](docs/ReserveHub_ER_Diagram.drawio)**

Open/import the diagram in [diagrams.net](https://app.diagrams.net/). It is stored in the repository, rather than on the developer's local machine.

## 9. API Overview

Next.js Route Handlers expose JSON endpoints for the application's features.

| Method                   | Endpoint                                   | Function                             |
| ------------------------ | ------------------------------------------ | ------------------------------------ |
| `POST`                   | `/api/auth/register`                       | Register an account                  |
| `POST`                   | `/api/auth/login`                          | Sign in                              |
| `GET`                    | `/api/auth/me`                             | View authenticated account           |
| `POST`                   | `/api/auth/logout`                         | Sign out                             |
| `GET`, `POST`            | `/api/resources`                           | List/create resources                |
| `GET`, `PATCH`, `DELETE` | `/api/resources/[resourceId]`              | View/update/delete eligible resource |
| `GET`                    | `/api/resources/[resourceId]/availability` | Check interval availability          |
| `GET`, `POST`            | `/api/reservations`                        | List/create reservations             |
| `GET`                    | `/api/reservations?scope=mine`             | View current user's bookings         |
| `GET`, `PATCH`           | `/api/reservations/[reservationId]`        | View/edit reservation                |
| `POST`                   | `/api/reservations/[reservationId]/cancel` | Cancel eligible reservation          |

The APIs validate authentication and request data and use appropriate error statuses such as `400`, `401`, `403`, `404`, and `409`. There is intentionally **no DELETE reservation endpoint**.

## 10. npm Commands

| Command                                                   | Description                                     |
| --------------------------------------------------------- | ----------------------------------------------- |
| `npm run dev`                                             | Run the development server                      |
| `npm run build`                                           | Build for production                            |
| `npm run start`                                           | Start a production build                        |
| `npm run lint`                                            | Run ESLint                                      |
| `npm run format:check`                                    | Check Prettier formatting                       |
| `npm run format`                                          | Format project files                            |
| `npm run prisma:validate`                                 | Validate Prisma schema                          |
| `npm run prisma:format`                                   | Format Prisma schema                            |
| `npm run prisma:generate`                                 | Generate Prisma Client                          |
| `npm run prisma:migrate:status`                           | View migration state                            |
| `npm run prisma:migrate:deploy`                           | Apply reviewed pending migrations               |
| `npm run prisma:migrate:dev -- --name descriptive_change` | Create a **new migration file only** for review |
| `npm run test:reservation-workflow`                       | Run reservation API and concurrency tests       |
| `npm run test:booking-integrity`                          | Run direct database integrity tests             |

The `prisma:migrate:dev` script already has `--create-only`; it is intended for **new development migrations**, not routine setup. Do not use it against a production database. Review generated SQL before using `prisma:migrate:deploy`.

## 11. Testing and Quality Assurance

The project includes API integration tests for authentication, availability, reservation creation, editing, cancellation, ownership restrictions, conflict handling, and concurrency.

**Static checks:**

```bash
npm run prisma:validate
npm run format:check
npm run lint
npm run build
```

**Reservation workflow tests:** These require a **separate, migrated Neon testing database**.

1. Create an isolated test database and apply the committed migrations to it after confirming the database URL.
2. Put its pooled URL in `TEST_DATABASE_URL` in `.env`.
3. Make sure `DATABASE_URL` still identifies a **different** database. The test runner checks for accidental test/normal database reuse.
4. Stop any server using port `3100`, then run:

```bash
npm run test:reservation-workflow
```

This script launches a Next.js test server on port `3100`, verifies real JSON API behavior against the isolated database, and removes the temporary records created during the run.

**Database write safety:** `npm run test:booking-integrity` reads **`DATABASE_URL`**, not `TEST_DATABASE_URL`, and writes temporary database records. Run that command **only after explicitly configuring `DATABASE_URL` to a disposable, migrated test database**. Do not run it against production or important application data.

GitHub Actions runs `npm ci`, Prisma Client generation, Prettier, ESLint, and a production build. Database-backed integration tests are run locally rather than in CI.

## 12. Project Structure

```text
Reserve-Hub/
├── .github/workflows/ci.yml          # GitHub Actions checks
├── docs/                             # ER diagram, setup and migration guides
├── prisma/
│   ├── schema.prisma                  # User, Resource, Reservation models
│   └── migrations/                   # Version-controlled PostgreSQL SQL
├── scripts/
│   ├── verify-booking-integrity.ts
│   └── verify-reservation-workflow.ts
├── src/
│   ├── app/
│   │   ├── api/                      # Authentication, resources, reservations
│   │   ├── dashboard/
│   │   ├── login/
│   │   ├── signup/
│   │   ├── resources/
│   │   └── reservations/
│   ├── components/                    # Shared UI and layout components
│   └── lib/                           # Auth, Prisma, services, validators
├── .env.example                      # Environment variable template
├── package.json
└── prisma.config.ts                  # Prisma CLI configuration
```

## 13. Supporting Documentation

- [Neon PostgreSQL Setup Guide](docs/NeonDB_Setup_Guide.md)
- [Prisma Migration Workflow](docs/Prisma_Migrations_Guide.md)
- [Editable ER Diagram](docs/ReserveHub_ER_Diagram.drawio)
- [Requirements and Implementation Plan](docs/ReserveHub_Implementation_Plan.md)

## 14. Scope and Known Limitations

ReserveHub is a focused internship-assessment MVP rather than a multi-organization enterprise system.

- No organization separation or role-based administration; authenticated users share one resource catalogue.
- No recurring reservations, reservation transfers, or reassignment of a booking to another resource.
- No email verification, password reset, notifications, or external calendar synchronization.
- No approval workflow or advanced analytics dashboard.
- Reservation history is intentionally retained, not permanently deleted.
- Local setup requires valid Neon PostgreSQL credentials and network access to its direct migration connection.

---

**Source repository:** https://github.com/ishara-dhanushan/Reserve-Hub  
**Project type:** Software Engineering Internship Technical Assessment
