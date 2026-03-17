# Social Media Manager

## Package Manager

- Use `bun` exclusively — npm/yarn/pnpm are blocked by preinstall script and `packageManager` field

## Database & ORM

- Run `prisma generate` before builds — the build script does this (`bun run build`), but if you're type-checking standalone, run it first
- Prisma client is generated to `src/generated/prisma/` (not `node_modules`) — this directory is gitignored and must be regenerated locally
- Prisma uses the `@prisma/adapter-pg` PostgreSQL adapter (not the default driver) — connection is via raw `pg` pool, not Prisma's built-in driver
- Use the public Railway DB URL locally (`crossover.proxy.rlwy.net:46774`) — the internal URL (`postgres-jehk.railway.internal`) only works from within Railway's network. After changing `.env`, clear `.next` cache and restart dev server.

## Images

- Images are currently stored as binary blobs in PostgreSQL (`Bytes` type) — migration to Cloudflare R2 is in progress via `src/lib/r2.ts` and `src/lib/image-processing.ts`
- Image serving endpoint: `/api/images/[id]?type=stored|generated` — returns binary data with 1-year immutable cache headers

## UI & Components

- Use `cn()` from `@/lib/utils` for all Tailwind className merging — never concatenate manually
- shadcn/ui style is `radix-nova` with `neutral` base color — use `bunx shadcn@latest add <component>` to add new components

## AI Generation

- AI image generation uses Gemini models via `@google/genai` — two models: `nano-banana-2` (flash) and `nano-banana-pro` (pro). Supported aspect ratios: 3:4, 1:1, 4:5, 9:16

## Auth

- Better Auth with `magicLink` plugin (invite-only, `disableSignUp: true`) and `organization` plugin. Server config: `src/lib/auth.ts`, client: `src/lib/auth-client.ts`. API handler: `/api/auth/[...all]`
- Invite-only access — first user seeded via `prisma/seed.ts`. New users must be invited through the organization plugin. The accept-invitation server action creates the user + member record + sends a magic link
- Next.js 16 uses `proxy.ts` (not `middleware.ts`) — export `proxy` function. Checks session cookies, redirects to `/login`. All `/api` paths are public (REST routes have no auth, tRPC/Better Auth validate internally)

## API — tRPC

- tRPC v11 for new features, coexisting with existing REST routes. Init: `src/lib/trpc/init.ts`, routers: `src/lib/trpc/routers/`. Use `protectedProcedure` for auth-required endpoints — validates session, throws `UNAUTHORIZED`
- All org queries must verify membership via `verifyMembership()` helper in `src/lib/trpc/routers/org.ts`

## Email

- Resend for transactional email (magic links, invitations). Sender: `batice@nirodigital.com` (hardcoded in `src/lib/auth.ts`)

## Route Groups

- `(auth)` — login and invitation pages, centered layout, no sidebar
- `(main)` — original app with custom Sidebar component
- `(roks-workspace)/dashboard` — shared layout with shadcn `AppSidebar`, `SiteHeader`, `SidebarProvider`. Use for experimental/workspace features
