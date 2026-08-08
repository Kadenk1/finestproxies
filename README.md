# ProxyGrid

Premium proxy infrastructure platform — marketing site, customer dashboard,
admin panel, and gateway control plane for a residential/ISP/mobile proxy
business.

> **Brand name placeholder.** "ProxyGrid" / `proxygrid.com` is a placeholder.
> Rename by editing `src/lib/config/brand.ts` defaults or setting the
> `NEXT_PUBLIC_BRAND_*` env vars — nothing else in the codebase hardcodes the
> brand name.

## Build status

This project is being built in phases. **Phases 1 and 2 are complete**:

**Phase 1** — Project structure, design system, and Prisma schema.
Email/password authentication with sessions, roles, rate limiting, email
verification, and password reset. Public marketing site: Home, Pricing
(DB-driven), About, FAQ, Documentation, Contact, Terms of Service, Privacy
Policy, Acceptable Use Policy, Login, Register.

**Phase 2** — Customer dashboard (Overview with balances/charts, Proxies by
product, Proxy Generator, Usage, Orders, Billing, API, Settings, Support)
backed by a real `ProviderAdapter` interface and a `MockProviderAdapter`
(`src/services/providers`). Customers can buy GB/IP allocations through a
mock payment flow, generate proxy credentials bound to OUR gateway
hostnames (never upstream credentials), and simulate traffic to exercise
the usage-accounting pipeline. See `src/services/gateway`,
`src/services/usage`, and `src/services/billing` for the orchestration
logic behind those flows.

Not yet built (see the project's build order): the admin panel, the real
routing engine (Phase 2's route selection is "first enabled route" —
health/latency/cost-aware scoring is Phase 4), the gateway control API,
real billing integration (Stripe), and profit analytics. A minimal
placeholder page exists at `/admin` solely to prove the auth + role-gating
flow works end to end.

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

No separate process to run — `MockProviderAdapter`
(`src/services/providers/mock-provider.ts`) runs in-process and backs its
"capacity" with the seeded `Provider`/`ProviderProduct`/`ProviderLocation`
rows. It's wired up as the only entry in the adapter registry
(`src/services/providers/registry.ts`) and is what the Proxy Generator and
gateway service call to provision credentials.

To exercise usage accounting without waiting for real traffic, generate a
credential from the dashboard and use its **Simulate usage** action (also
available via `POST /api/dashboard/usage/simulate`) — this is a dev-only
convenience tied to `MOCK_PROVIDER`, called out with a `TODO(production)` in
the route handler.

## 7. Adding a real authorized upstream provider

**Adapter interface is implemented; admin UI to configure it is not (Phase
3).** To add a real provider today: implement a new class satisfying
`ProviderAdapter` (`src/services/providers/types.ts`) in a new file under
`src/services/providers`, register it in
`src/services/providers/registry.ts`, and add matching `Provider` /
`ProviderProduct` / `ProviderLocation` / `ProviderCredential` rows (the
latter holding secrets encrypted via `src/lib/crypto/secrets.ts`). Nothing
in the dashboard, API routes, or `gateway-service` needs to change — they
only ever go through the adapter interface and `GatewayRoute` rows.
Phase 3 adds an admin UI for the provider/route configuration; Phase 4
replaces today's "first enabled route" selection with health/latency/
cost-aware scoring.

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

## Customer dashboard walkthrough

Log in as `customer@proxygrid.com` and try, in order:

1. **Orders** — buy some Residential GB or ISP IPs (mock payment settles
   instantly).
2. **Proxy Generator** — pick the product you just bought, a country,
   protocol, and session type, and generate credentials. The host/port
   shown are always OUR gateway (`resi.proxygrid.com:8000`, etc.), never an
   upstream address.
3. **Proxies → (product)** — see credentials you've generated; use
   **Simulate usage** to inject traffic, or **Revoke** to disable one.
4. **Usage / Overview** — bandwidth, requests, and balances update
   immediately from the usage you simulated.
5. **Support** — open a ticket and reply to it.

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
