# ReserveHub — Neon PostgreSQL and Prisma 7 Setup Guide

**Repository:** `ishara-dhanushan/Reserve-Hub`  
**Document type:** Developer setup guide  
**Updated:** 13 October 2026  
**Related:** `docs/ReserveHub_Implementation_Plan.md`, `docs/Prisma_Migrations_Guide.md`

> **Version decision:** Use **Prisma ORM 7** for this assessment and lock the installed versions in `package-lock.json`. Do not accidentally mix Prisma 6, 7, and 8 instructions. Verify the selected Node.js version against the installed Prisma package's `engines` field.

## 1. Architecture and responsibility

```text
Next.js 16 App Router / Route Handlers (Node.js runtime)
    │
    ├── Resource and reservation services
    ├── Prisma Client 7 + @prisma/adapter-neon
    │       │
    │       └── Neon runtime URL (pooled when appropriate)
    │
    └── Prisma CLI (prisma.config.ts)
            │
            └── Neon DIRECT_URL (schema migrations)
```

The database is **PostgreSQL on Neon**, not Prisma Postgres. The application requires no separate NestJS backend or Docker container. Prisma handles the three agreed entities: `User`, `Resource`, and `Reservation`.

## 2. Create a Neon project

1. Sign in at <https://console.neon.tech/>.
2. Create a project, e.g. **reservehub**, select a geographically convenient region, and keep the default PostgreSQL database or give it a recognizable name such as `reservehub`.
3. Use the **development** branch/database during implementation. Avoid pointing development migrations at a production database.
4. Open **Connect** and copy **two connection strings for the same database/branch**:
   - **Direct** (pooling off): used by Prisma CLI/migrations.
   - **Pooled** (pooling on, URL hostname usually contains `-pooler`): used by runtime Prisma/Neon adapter where appropriate.
5. Keep these URLs secret. Do not paste real credentials into an issue, documentation, source files, or demonstration video.
6. If a preview/production environment is introduced, configure separate Neon branches and secrets. For a three-day assessment, one private development database is sufficient for demonstration, with its schema reproducible from migrations.

## 3. Install dependencies (same commands in PowerShell and Bash)

From the repository root:

```bash
npm install @prisma/client@7 @prisma/adapter-neon@7 @neondatabase/serverless dotenv
npm install -D prisma@7 tsx
```

`@prisma/client` and `prisma` should have compatible **7.x** versions (prefer matching exact installed versions). `@prisma/adapter-neon` should remain compatible with the same major. Commit the resulting `package-lock.json`.

Optional base dependencies from the implementation plan, if not already added in separate tickets:

```bash
npm install jose bcryptjs zod
```

## 4. Environment variables

Create `.env` at the **repository root** for Prisma CLI. Next.js also loads `.env` during development. Use a different secret/URL for each real environment.

`.env` **(local only; do not commit)**:

```dotenv
# Server-side app queries: pooled Neon connection string.
DATABASE_URL="postgresql://USER:PASSWORD@EP-NAME-pooler.REGION.aws.neon.tech/DB?sslmode=require"

# Schema and Prisma CLI: direct Neon connection string.
DIRECT_URL="postgresql://USER:PASSWORD@EP-NAME.REGION.aws.neon.tech/DB?sslmode=require"

# Required by the authentication ticket; use a cryptographically random secret.
JWT_SECRET="REPLACE_WITH_A_LONG_RANDOM_SECRET"
```

Create `.env.example` containing **placeholders only**, with the same variable names. **Important:** the existing `.gitignore` has `.env*`, so append the following exception after that rule to allow committing `.env.example`:

```gitignore
# Keep real secrets local, but provide a safe setup template.
!.env.example
```

No environment variable containing a credential should have the `NEXT_PUBLIC_` prefix.

Generate a JWT secret locally:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

The command prints a secret to your own terminal; store it only in local/server environment configuration.

## 5. Initialize Prisma 7

If there is no Prisma directory yet, run:

```bash
npx prisma init --datasource-provider postgresql
```

Inspect created files; do not overwrite customized files. The intended project paths are:

```text
reserve-hub/
├── prisma.config.ts
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts                # optional, after adding the seed ticket
├── src/
│   ├── generated/prisma/      # generated client; generated during setup/build
│   └── lib/prisma.ts          # Prisma singleton
├── .env                       # ignored
└── .env.example               # tracked (safe placeholders)
```

In `prisma/schema.prisma`, use Prisma 7's generator and datasource format, then append the three models/enums from `docs/ReserveHub_Implementation_Plan.md` section 9.4:

```prisma
// TypeScript Prisma Client is generated at this explicit location.
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

// Prisma v7 reads CLI connection URLs from prisma.config.ts.
datasource db {
  provider = "postgresql"
}

// Add enum ResourceType, enum ReservationStatus,
// and the User, Resource, Reservation models from the approved plan.
```

At repository root, create or update `prisma.config.ts`:

```ts
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    // Add seed: "tsx prisma/seed.ts" only when the seed script exists.
  },
  datasource: {
    // Prisma CLI should connect directly for migration operations.
    url: env("DIRECT_URL"),
  },
});
```

Note: `env("DIRECT_URL")` makes even `prisma generate` require that variable at config-load time. In CI where the URL is intentionally unavailable during code generation, use `process.env.DIRECT_URL ?? ""` in the configuration, but keep a separate positive connection check for migrate commands.

## 6. Prisma Client runtime singleton

Once the schema is generated, create `src/lib/prisma.ts`:

```ts
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("Missing DATABASE_URL environment variable");
}

// The Neon adapter uses Neon's serverless PostgreSQL driver.
const adapter = new PrismaNeon({ connectionString });
export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

// Avoid repeated database clients during Next.js development hot reloads.
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

Use this module **only from server-side code** (Route Handlers/server actions/server components), never import it into a `"use client"` component. Database-dependent routes should run on the **Node.js runtime** unless an alternative runtime is deliberately tested.

## 6.1 Reusable package scripts — avoid memorizing CLI commands

In the **existing `package.json`**, edit the `"scripts"` block (currently near lines 5–10). **Keep** the original `dev`, `start`, and `lint` scripts; add these named Prisma scripts:

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint",
  "prisma:validate": "prisma validate",
  "prisma:format": "prisma format",
  "prisma:generate": "prisma generate",
  "prisma:migrate:dev": "prisma migrate dev",
  "prisma:migrate:deploy": "prisma migrate deploy",
  "prisma:migrate:status": "prisma migrate status"
}
```

Do not replace the rest of the `package.json` or delete existing dependency entries.

Then the migration workflow is short (identical in PowerShell/Bash):

```bash
npm run prisma:validate
npm run prisma:migrate:status
npm run prisma:migrate:dev -- --name init_reservehub --create-only
# Open and review prisma/migrations/<timestamp>_init_reservehub/migration.sql before continuing.
npm run prisma:migrate:deploy
npm run prisma:generate
npm run prisma:migrate:status
```

`--create-only` creates the new migration without applying it. Review the generated SQL before running `prisma:migrate:deploy`, which **applies all pending migration files**. Verify the correct Neon database and inspect any existing pending migrations first. The same generate → review → deploy sequence should be followed for later schema changes.

Because the recommended `prisma.config.ts` uses `env("DIRECT_URL")`, `npm run prisma:generate` requires `DIRECT_URL` to be present even though generation itself does not query the database. Supply **server-only** environment variables in any hosting/build environment and never check them into Git. A later CI-oriented refinement could make the config tolerant of missing URLs for generate-only jobs while keeping migration commands strict.

## 7. First migration and smoke test

Before running this step, complete the schema models and double-check that `DIRECT_URL` targets the intended **development** Neon branch. Do not execute against production.

1. Validate the schema and check the target database's current migration history:

```bash
npm run prisma:validate
npm run prisma:migrate:status
```

2. Generate the initial migration SQL **without applying it**:

```bash
npm run prisma:migrate:dev -- --name init_reservehub --create-only
```

3. Open `prisma/migrations/<timestamp>_init_reservehub/migration.sql` and review the SQL. Check table/column names, enum definitions, foreign keys, indexes, and any destructive operations. **Do not proceed until the SQL is reviewed and acceptable.**

4. Apply **all pending, reviewed** migrations to the target Neon database:

```bash
npm run prisma:migrate:deploy
```

5. Generate Prisma Client and verify migration status:

```bash
npm run prisma:generate
npm run prisma:migrate:status
```

**Prisma v7 does not automatically run `prisma generate` after a migration is deployed.** Run it explicitly. `migrate deploy` does not check for schema drift or use a shadow database; review pending migration files and the target database before applying. `--create-only` uses the development migration engine, which performs drift checks and may request a database reset if drift is found—do not approve a reset without understanding its impact.

For a simple database smoke test, add a one-off local script or test that executes `prisma.user.count()` and disconnects. A successful client generation does **not** demonstrate that the database is reachable.

## 8. Port 5432 network restrictions

Some networks block PostgreSQL TCP port **5432** while HTTPS/WebSocket port **443** remains usable. Treat these as two separate access paths:

- Application/runtime queries may work using `@prisma/adapter-neon` and Neon's serverless driver.
- The **standard Prisma CLI Migrate workflow still requires a compatible direct PostgreSQL connection** using the configured `DIRECT_URL`; installing the Neon runtime adapter alone does not make Prisma CLI migrate over HTTP.

If `npm run prisma:migrate:status` returns `P1001` or times out:

1. Double-check the selected Neon project/branch and the direct URL credentials.
2. Check your network/firewall; try a permitted alternative network or hotspot for the migration, then return to your regular network for app development.
3. If the direct connection is unavailable everywhere, follow the **Fallback—restricted network** section in `docs/Prisma_Migrations_Guide.md`. Do **not** randomly switch to `db push`, modify the database manually and pretend that Prisma migration history is consistent, or copy untested migration scripts unchanged.

## 9. Verification checklist

- [ ] Repo still builds and lints (`npm run build`, `npm run lint`).
- [ ] The two Neon URLs connect to the same intended database/branch.
- [ ] Secrets remain ignored by Git; `.env.example` contains placeholders.
- [ ] `prisma/schema.prisma` matches the finalized Chen ER diagram.
- [ ] The migration SQL is created with `--create-only` and reviewed **before** `prisma:migrate:deploy` is run.
- [ ] The initial migration file is committed under `prisma/migrations/`.
- [ ] `npm run prisma:migrate:status` reports an up-to-date development database.
- [ ] `npm run prisma:generate` succeeds with Prisma 7.
- [ ] The Next.js server can query Neon through the adapter.

## 10. Source references

- Prisma ORM 7 PostgreSQL setup: <https://www.prisma.io/docs/orm/v7/core-concepts/supported-databases/postgresql>
- Prisma ORM 7 configuration: <https://www.prisma.io/docs/orm/v7/reference/prisma-config-reference>
- Prisma Client generation: <https://www.prisma.io/docs/orm/v7/prisma-client/setup-and-configuration/generating-prisma-client>
- Prisma ORM 7 `migrate dev`: <https://www.prisma.io/docs/cli/v7/migrate/dev>
- Neon console: <https://console.neon.tech/>
