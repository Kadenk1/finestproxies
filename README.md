# ProxyGrid

Premium proxy infrastructure platform — marketing site, customer dashboard,
admin panel, and gateway control plane for a residential/ISP/mobile proxy
business.

> **Brand name placeholder.** "ProxyGrid" / `proxygrid.com` is a placeholder.
> Rename by editing `src/lib/config/brand.ts` defaults or setting the
> `NEXT_PUBLIC_BRAND_*` env vars — nothing else in the codebase hardcodes the
> brand name.

## Build status

This project is being built in phases. **Phase 1 is complete**:

- Project structure, design system, and Prisma schema
- Email/password authentication with sessions, roles, rate limiting, email
  verification, and password reset
- Public marketing site: Home, Pricing (DB-driven), About, FAQ, Documentation,
  Contact, Terms of Service, Privacy Policy, Acceptable Use Policy, Login,
  Register
- Mock seed data (dev accounts, products, a mock upstream provider, gateways)

Not yet built (see the project's build order): the full customer dashboard,
proxy generator, admin panel, routing engine, gateway control API, billing
integration, and profit analytics. Minimal placeholder pages exist at
`/dashboard` and `/admin` solely to prove the auth + role-gating flow works
end to end.

## Tech stack

Next.js (App Router) · TypeScript · Tailwind CSS · shadcn/ui (Base UI
primitives) · PostgreSQL · Prisma ORM 7 · Redis · NextAuth (Auth.js) v5

## Project structure

```
src/
  app/
    (marketing)/     Public website pages (shared header/footer layout)
    (auth)/           Login, register, password reset (centered card layout)
    dashboard/         Customer dashboard (placeholder — Phase 2)
    admin/              Admin panel (placeholder — Phase 3)
    api/                 Route handlers (auth, contact, ...)
  components/
    ui/                shadcn/ui primitives
    marketing/         Marketing site sections
    auth/                Auth forms
  lib/
    config/            Brand config, stats
    db/                  Prisma + Redis clients
    auth/                Password hashing, verification tokens
    crypto/             AES-256-GCM secret encryption
    security/           Rate limiting
    validation/         Zod schemas
    email/               Transactional email (console-logged in dev)
    data/                 Server-side data-access helpers
  services/              Gateway/provider/billing/routing/usage service
                         layers (scaffolded, implemented starting Phase 2/4)
  types/                  Shared TypeScript types
prisma/
  schema.prisma          Full data model
  seed.ts                 Dev seed data
```

## 1. Installation

```bash
npm install
```

`postinstall` runs `prisma generate` automatically.

## 2. Database setup

You need PostgreSQL and Redis running locally. The easiest way:

```bash
docker compose up -d
```

This starts Postgres on `5432` and Redis on `6379` with credentials matching
`.env.example`.

Then run migrations:

```bash
npm run db:migrate
```

## 3. Environment variables

```bash
cp .env.example .env
```

Fill in:

- `DATABASE_URL` — matches `docker-compose.yml` by default
- `REDIS_URL` — matches `docker-compose.yml` by default
- `NEXTAUTH_SECRET` — generate with `openssl rand -base64 32`
- `SECRETS_ENCRYPTION_KEY` — 32-byte base64 key, generate with:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
  ```
- `NEXT_PUBLIC_BRAND_*` — optional, override to rebrand

See `.env.example` for the full list, including billing/email variables that
are reserved for later phases.

## 4. Running locally

```bash
npm run dev
```

Visit `http://localhost:3000`.

## 5. Seeding data / creating an admin account

```bash
npm run db:seed
```

This creates two dev accounts (password `DevPassword123` for both):

| Role     | Email                     |
| -------- | -------------------------- |
| Admin    | `admin@proxygrid.com`    |
| Customer | `customer@proxygrid.com` |

It also seeds the three products (Residential, ISP, Mobile), a mock upstream
provider, three gateways, sample orders/usage, and a `WELCOME10` coupon.

To create additional admin accounts, register normally through `/register`
then promote the user's `role` to `ADMIN` in the database (an admin UI for
this is planned for Phase 3):

```bash
npx prisma studio
```

## 6. Running the mock provider

**Not yet implemented.** Phase 1 seeds a `Provider` row named "Mock Upstream
Provider" directly in the database so the schema and dashboard have
something to reference. The actual `MockProviderAdapter` — which simulates
proxy issuance, usage, gateway health, latency, and outages behind the
`ProviderAdapter` interface — is built in Phase 2 alongside the proxy
generator.

## 7. Adding a real authorized upstream provider

**Not yet implemented.** This lands in Phase 3 (admin provider management)
and Phase 4 (routing engine). The plan: implement a new class satisfying the
`ProviderAdapter` interface (see `src/services/providers`, scaffolded but
empty), register it in the provider adapter factory, and configure the
provider's cost/location/product data through the admin panel — application
code outside the adapter never needs to change.

## 8. Deploying

**Not yet implemented / documented.** The intended shape: Next.js app
deployed to a Node-capable host (e.g. Vercel or a container platform),
Postgres and Redis as managed services, migrations run via
`npm run db:deploy` in CI/CD before releasing a new version.

## 9. Connecting our gateway infrastructure

**Not yet implemented.** Phase 4 introduces the Gateway Control API and the
heartbeat contract gateway agents use to report health. Until then, `Gateway`
rows exist in the schema and are seeded with mock data for the dashboard to
read.

## Scripts

| Command             | Description                              |
| -------------------- | ----------------------------------------- |
| `npm run dev`        | Start the dev server                      |
| `npm run build`      | Production build (includes type checking) |
| `npm run start`       | Start the production server               |
| `npm run lint`        | Lint                                       |
| `npm run db:migrate`  | Create/apply a migration (dev)             |
| `npm run db:deploy`   | Apply migrations (CI/production)           |
| `npm run db:seed`     | Seed the database                          |
| `npm run db:studio`   | Open Prisma Studio                         |
| `npm run db:reset`    | Reset the database (dev only, destructive) |

## Security notes

- Passwords are hashed with bcrypt, never stored in plaintext.
- Upstream provider credentials and customer proxy passwords are encrypted
  at rest with AES-256-GCM (`src/lib/crypto/secrets.ts`) and are never
  returned by any API response — only decrypted at the point of use.
- Login, registration, contact, and password-reset endpoints are
  rate-limited (Redis-backed, fails open if Redis is unavailable so an
  outage there doesn't take down the app).
- Auth uses NextAuth v5 with a JWT session strategy; `/dashboard` and
  `/admin` are protected by `src/proxy.ts` (Next.js 16's middleware
  convention), with `/admin` additionally gated on `role === "ADMIN"`.
