# Finest Proxies

Premium proxy infrastructure platform — marketing site, customer dashboard,
admin panel, and gateway control plane for a residential/ISP/mobile proxy
business.

> **Rebranding.** "Finest Proxies" / `finestproxies.com` is set in
> `src/lib/config/brand.ts` (defaults) and can be overridden per-environment
> via the `NEXT_PUBLIC_BRAND_*` env vars — nothing else in the codebase
> hardcodes the brand name, so changing it there is enough to rebrand the
> whole app.

## Build status

This project is being built in phases. **Phases 1 through 4 are complete**:

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

**Phase 3** — Full admin panel at `/admin` (role-gated, separate from the
customer dashboard): Dashboard (KPIs), Customers (suspend/ban, internal
notes), Orders, Products (create/edit without touching code — pricing,
locations, active flag), Pricing (recurring plans), Providers
(create/edit, secrets encrypted at rest and never re-displayed after
saving, per-product cost config, locations, credential rotation history),
Gateways (create/edit, maintenance mode), Routes (assign
gateway+provider+product with priority/weight), Usage, Payments, Coupons,
Support (reply as staff, change status), System Settings (generic
key/value config), and Audit Logs. Every sensitive mutation goes through
`requireAdminSession()` (role check independent of the page-level
middleware) and is recorded via `logAdminAction()` in `src/lib/audit.ts`.

**Phase 4** — A real routing engine (`src/services/routing/routing-engine.ts`):
`gateway-service` no longer just takes the first enabled route — it scores
every candidate `GatewayRoute` by administrator-defined priority/weight,
gateway and provider health, latency, historical success rate, upstream
cost, and geographic fit, and picks the best one. Also, the Gateway
Control API's ingestion side: `POST /api/gateway-control/heartbeat` and
`POST /api/gateway-control/usage`, bearer-secret-authenticated endpoints a
gateway agent calls to report health (updates `Gateway` + appends
`GatewayHealth`) and bill real usage (same dedupe-safe `recordUsageEvent`
the dev "simulate usage" button uses). `npm run gateway:heartbeat` sends
one simulated heartbeat per seeded gateway so you can see the whole path
without real infrastructure.

Not yet built (see the project's build order): real billing integration
(Stripe) and profit analytics (Phase 5), plus a broader security/testing
pass (Phase 6).

### A note on this environment's local database

While building Phase 4, the sandboxed dev environment's local ephemeral
Postgres (`prisma dev`, used because Docker wasn't available here)
repeatedly died and had to be restarted — not something in the app code.
I verified Phases 1–3 and the routing engine build/lint/type-check
thoroughly, plus real runtime testing of auth, the customer dashboard,
proxy generation/purchase/usage flows, and most admin CRUD (Products,
Coupons, Providers, Gateways, including a BigInt-serialization bug I found
and fixed) before the database instability made further live testing
unreliable in-session. I did not get a final live run specifically against
the new heartbeat/usage-ingestion endpoints — do that first with
`npm run gateway:heartbeat` once you have a stable Postgres (e.g. via
`docker compose up -d`, which is what your own machine will use).

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
- `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` — optional, enables "Continue
  with Discord" on Login/Register. Create an app at
  [discord.com/developers/applications](https://discord.com/developers/applications),
  add redirect URL `{NEXTAUTH_URL}/api/auth/callback/discord` (e.g.
  `http://localhost:3000/api/auth/callback/discord` locally), enable the
  `identify` and `email` scopes, and copy the Client ID/Secret in. Leave
  both unset and the button simply doesn't render — email/password still
  works either way.

See `.env.example` for the full list, including billing/email variables that
are reserved for later phases.

Discord accounts are matched to a `User` by email on first sign-in (linking
an existing password account if one exists with the same email, or
creating a new customer if not) — see the `signIn` callback in
`src/auth.ts`. Discord-only accounts have no password until they use
"Forgot password" to set one.

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
| Admin    | `admin@finestproxies.com`    |
| Customer | `customer@finestproxies.com` |

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

Recommended stack: **Vercel** (app), **Neon** or **Supabase** (managed
Postgres), **Upstash** (managed Redis). None of this is required to be
these specific providers — anything that gives you a Postgres/Redis
connection string and runs Node.js works — but this combination has the
least setup friction with Next.js.

1. **Push to GitHub.** Vercel deploys from a repo. Create a repo, then:
   ```bash
   git remote add origin <your-repo-url>
   git push -u origin master
   ```
2. **Create the database.** Sign up at neon.tech (or supabase.com), create
   a Postgres project, and copy the connection string it gives you — that's
   your `DATABASE_URL` (use the same value for `DIRECT_URL` unless your
   provider gives you a separate non-pooled connection string, in which
   case use that for `DIRECT_URL`).
3. **Create Redis.** Sign up at upstash.com, create a Redis database, copy
   its connection string as `REDIS_URL`.
4. **Import the project into Vercel.** vercel.com → New Project → import
   your GitHub repo. Framework preset should auto-detect Next.js.
5. **Set environment variables** in the Vercel project settings (every key
   from `.env.example`, with real values):
   - `DATABASE_URL`, `DIRECT_URL` — from step 2
   - `REDIS_URL` — from step 3
   - `NEXTAUTH_URL` — your production URL, e.g. `https://finestproxies.com`
   - `NEXTAUTH_SECRET`, `SECRETS_ENCRYPTION_KEY`, `GATEWAY_AGENT_SECRET` —
     generate fresh ones for production, don't reuse dev values:
     ```bash
     node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
     ```
   - `NEXT_PUBLIC_BRAND_*` — only needed if overriding the defaults already
     in `src/lib/config/brand.ts`
   - `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` — only if Discord login
     is enabled; also add `https://finestproxies.com/api/auth/callback/discord`
     as a redirect URL in the Discord app settings
6. **Deploy.** The `build` script runs `prisma migrate deploy` before
   `next build`, so every deploy applies any pending migrations
   automatically — no separate migration step needed.
7. **Create your first admin account.** The seed script's dev accounts
   (`admin@…` / `DevPassword123`) are for local development only — don't
   run `db:seed` against production. Instead, register a normal account
   through `/register` on the live site, then promote it: open your
   database provider's SQL console (or `npx prisma studio` pointed at the
   production `DATABASE_URL`) and run:
   ```sql
   UPDATE "User" SET role = 'ADMIN', status = 'ACTIVE' WHERE email = 'you@example.com';
   ```
8. **Point the domain at Vercel.** Project Settings → Domains → add
   `finestproxies.com`. Vercel shows the exact DNS records to add — add
   those in GoDaddy's DNS management page for the domain. Propagation is
   usually fast (minutes) but can take longer.

## 9. Connecting our gateway infrastructure

A real gateway becomes visible to the platform in two steps:

1. **Register it**: add a `Gateway` row (admin panel → Gateways → New
   gateway) with its hostname, IP, and region, and add `GatewayRoute` rows
   (admin panel → Routes) connecting it to whichever provider(s) and
   product(s) it should serve.
2. **Point its agent at the Gateway Control API**: the agent process
   running on the gateway should periodically `POST
   /api/gateway-control/heartbeat` (health) and, per unit of customer
   traffic, `POST /api/gateway-control/usage` (billing), both authenticated
   with `Authorization: Bearer $GATEWAY_AGENT_SECRET`. See
   `src/lib/validation/gateway-control.ts` for the exact payload shape and
   `scripts/simulate-gateway-agent.ts` for a minimal working example.

The routing engine (`src/services/routing/routing-engine.ts`) automatically
starts considering a gateway for traffic as soon as its `GatewayRoute` rows
are enabled and its heartbeat reports a non-`OFFLINE` status — no code
changes needed. Per-gateway agent credentials (rather than one shared
secret) are a TODO called out in
`src/lib/auth/require-gateway-agent.ts`.

## Customer dashboard walkthrough

Log in as `customer@finestproxies.com` and try, in order:

1. **Orders** — buy some Residential GB or ISP IPs (mock payment settles
   instantly).
2. **Proxy Generator** — pick the product you just bought, a country,
   protocol, and session type, and generate credentials. The host/port
   shown are always OUR gateway (`resi.finestproxies.com:8000`, etc.), never an
   upstream address.
3. **Proxies → (product)** — see credentials you've generated; use
   **Simulate usage** to inject traffic, or **Revoke** to disable one.
4. **Usage / Overview** — bandwidth, requests, and balances update
   immediately from the usage you simulated.
5. **Support** — open a ticket and reply to it.

## Admin panel walkthrough

Log in as `admin@finestproxies.com` and visit `/admin`:

1. **Products** — edit an existing product's pricing or create a new one;
   changes are live on `/pricing` immediately.
2. **Providers** — open the seeded "Mock Upstream Provider," review its
   cost config and locations, and try rotating its API key (the old
   credential is marked "rotated out," not deleted — audit trail intact).
3. **Gateways** — put a gateway into maintenance and confirm its status
   badge updates.
4. **Routes** — see which gateway/provider serves each product; this is
   what `gateway-service` reads when a customer generates a credential.
5. **Customers** — open a customer, suspend them, and confirm (from the
   customer dashboard, or by checking `CustomerProxyCredential` rows) that
   their active credentials get disabled too.
6. **Audit Logs** — confirm every action above left a row.

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
