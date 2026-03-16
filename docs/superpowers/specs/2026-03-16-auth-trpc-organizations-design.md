# Auth + tRPC + Organizations Design

## Overview

Add authentication, authorization, and a typed API layer to the Social Media Manager app. Uses Better Auth with magic link (email-only via Resend) and the organization plugin for invite-only access. tRPC provides the typed API layer for new features, coexisting with existing REST routes.

## Goals

- Gate the app behind authentication — invite-only, no open registration
- Seed the first user (Rok / dev@nirodigital.com) and organization (Niro Digital)
- Set up tRPC infrastructure for new feature development
- Login page with magic link, inspired by shadcn login-05
- User settings page with profile editing and member/invitation management
- Wire the dashboard user menu to real auth state
- Support multiple organizations in the future

## Non-Goals

- Migrating existing REST API routes to tRPC (future work)
- Role-based permissions within organizations (all members have equal access for now)
- Password-based auth, social login, or any auth method besides magic link
- Per-user or per-org data isolation (auth is a gate, all data remains shared)

---

## Architecture

### Auth: Better Auth

**Plugins:**
- `magicLink` — email-only authentication via magic link
- `organization` — org management, member roles, invitations

**Tables managed by Better Auth:**
- `user` — id, name, email, emailVerified, image, createdAt, updatedAt
- `session` — id, userId, token, expiresAt, ipAddress, userAgent
- `account` — id, userId, accountId, providerId, etc.
- `verification` — id, identifier, value, expiresAt (used for magic link tokens)
- `organization` — id, name, slug, logo, metadata, createdAt
- `member` — id, userId, organizationId, role, createdAt
- `invitation` — id, email, organizationId, role, status, inviterId, expiresAt

### Email: Resend

Used for sending magic link emails and organization invitation emails. Single integration point in the Better Auth config.

### API: tRPC

**Setup:**
- `src/lib/trpc/init.ts` — tRPC instance, context creation
- `src/lib/trpc/routers/` — router files
- `src/lib/trpc/router.ts` — merged app router
- `src/lib/trpc/client.ts` — tRPC client + React Query client
- `src/app/providers.tsx` — `QueryClientProvider` + tRPC provider (client component)
- `src/app/api/trpc/[trpc]/route.ts` — Next.js App Router handler (uses `fetchRequestHandler` from `@trpc/server/adapters/fetch`)

**Context provides:**
- `session` — from Better Auth (null if unauthenticated)
- `prisma` — Prisma client instance

**Initial routers:**
- `user` — get profile, update name
- `org` — list members, list invitations, invite member, revoke invitation

**Procedures:**
- `publicProcedure` — no auth required
- `protectedProcedure` — middleware that checks `ctx.session`, throws `UNAUTHORIZED` if null

**Coexistence:** Existing REST routes under `/api/*` remain untouched. New features use tRPC. Gradual migration happens later when features move to the roks-workspace.

---

## Auth Flow

### Magic Link Sign-In

1. User visits any protected page
2. Middleware checks for session cookie — no session → redirect to `/login`
3. User enters email on login page, clicks "Send magic link"
4. Better Auth generates a verification token, calls `sendMagicLink` callback
5. We send the email via Resend with the magic link URL
6. User clicks link → Better Auth verifies token → creates session → redirects to `/dashboard`

**Expired/invalid magic links:** Better Auth redirects to the callback URL with an error parameter. The login page handles `?error=expired` and `?error=invalid` query params, showing a clear message ("Link expired — request a new one") with a button to resend.

### Invite-Only Gate

Magic link sign-in only succeeds if the user already exists in the `user` table. Unknown emails are rejected with a clear error message ("No account found — you need an invitation to access this app").

The `disableSignUp` option on the magic link plugin prevents auto-creation of new users on sign-in. Users can only be created through the invitation flow.

### Invitation Flow

The organization plugin requires users to be authenticated before accepting an invitation. The flow is a two-phase process:

1. Authenticated user navigates to Settings → Members
2. Enters invitee email → calls `authClient.organization.inviteMember({ email, role: "member" })`
3. Better Auth creates an `invitation` record
4. The `sendInvitationEmail` callback fires — we send the invite email via Resend
5. Invitee clicks the invitation link → lands on `/accept-invitation/[id]`
6. Accept-invitation page:
   a. Reads the invitation details (email, org name) from Better Auth
   b. Creates the user record via `auth.api.signUpEmail()` (server action — `disableSignUp` only applies to the magic link plugin, not programmatic creation)
   c. Creates an `account` record linking the user to the magic-link provider
   d. Sends the invitee a magic link to verify their identity
   e. Shows a "Check your email to complete setup" message
7. Invitee clicks the magic link → authenticates → session created
8. Post-login hook checks for pending invitations matching the user's email and auto-accepts them via `auth.api.acceptInvitation()`
9. User lands on `/dashboard` as an authenticated org member

---

## Route Structure

```
src/app/
├── layout.tsx                          # Root: <html>/<body>/Toaster
├── providers.tsx                       # QueryClientProvider + tRPC provider
├── (auth)/
│   ├── layout.tsx                      # Centered, minimal — no sidebar
│   ├── login/
│   │   └── page.tsx                    # Magic link email form
│   └── accept-invitation/
│       └── [id]/
│           └── page.tsx                # Invitation acceptance handler
├── (main)/
│   ├── layout.tsx                      # Main app Sidebar wrapper
│   └── ...existing pages (generate, styles, content, posts, brand)
├── (roks-workspace)/
│   ├── layout.tsx                      # shadcn AppSidebar + TooltipProvider
│   └── dashboard/
│       ├── page.tsx                    # Dashboard home
│       └── settings/
│           └── page.tsx                # Profile + members/invitations
└── api/
    ├── auth/[...all]/route.ts          # Better Auth catch-all handler
    ├── trpc/[trpc]/route.ts            # tRPC handler
    └── ...existing REST routes
```

### Route Protection

**Middleware** (`src/middleware.ts`):
- Uses `getSessionCookie()` for fast cookie-existence check (runs in Edge runtime)
- **Public paths** (no auth required): `/login`, `/accept-invitation/*`, `/api/auth/*`
- **Protected paths** (redirect to `/login` if no session cookie): everything else
- Both `(main)` and `(roks-workspace)` route groups are protected

**Security model:** Middleware performs an optimistic redirect based on cookie existence only (does not validate the session against the database — that would require Node.js runtime). Authoritative session validation happens at two levels:
1. **tRPC `protectedProcedure`** — validates session via `auth.api.getSession()` before executing any protected procedure
2. **Page-level** — server components that need session data call `auth.api.getSession()` with request headers

This two-layer approach gives fast redirects at the edge + full validation where it matters.

---

## Pages & UI

### `/login` (auth route group)

- Centered card layout, no sidebar, inspired by shadcn login-05
- Single email input + "Send magic link" button
- States: idle, sending, sent (success message: "Check your email"), error, expired ("Link expired — request a new one")
- App logo/name at top
- No sign-up link (invite-only)
- Handles `?error=expired` and `?error=invalid` query params from magic link callbacks

### `/accept-invitation/[id]` (auth route group)

- Reads invitation ID from URL, fetches invitation details
- Shows org name and invitee email
- "Accept & join" button triggers user creation + magic link send
- States: loading, ready, processing, sent ("Check your email"), error (expired/invalid/already accepted)

### `/dashboard/settings` (roks-workspace)

Two sections:

**Profile:**
- Name field (editable) — calls `user.updateName` tRPC mutation
- Email field (read-only)
- Avatar fallback shows user's initials computed from `user.name`

**Members & Invitations:**
- Table of current org members (name, email, role, joined date)
- Table of pending invitations (email, status, sent date)
- "Invite member" form: email input + invite button
- Revoke invitation button on pending invitations

### `nav-user.tsx` changes

- Remove Billing and Notifications menu items
- Wire "Account" → navigates to `/dashboard/settings`
- Wire "Log out" → calls Better Auth sign out → redirects to `/login`
- Pass real user data (name, email) from session instead of hardcoded "shadcn"
- `AvatarFallback` computes initials from `user.name` (e.g. "Rok" → "R", "Jane Doe" → "JD")

### `app-sidebar.tsx` changes

- Replace hardcoded user data with session user data
- Keep template nav items as-is (Dashboard, Lifecycle, Analytics, etc.)

---

## Seed Script

A seed script (`prisma/seed.ts`) runs on first setup:

1. Better Auth generates tables via Prisma migration
2. Create user: `dev@nirodigital.com`, name: "Rok"
3. Create account record linking the user to the `magic-link` provider (required for magic link sign-in to work)
4. Create organization: "Niro Digital", slug: "niro-digital"
5. Create member: Rok as "owner" of Niro Digital

This runs via `bun prisma/seed.ts` or as part of the Prisma seed config.

---

## File Structure (new files)

```
src/
├── lib/
│   ├── auth.ts                         # Better Auth server config
│   ├── auth-client.ts                  # Better Auth client config
│   └── trpc/
│       ├── init.ts                     # tRPC instance + context
│       ├── router.ts                   # Merged app router
│       ├── client.ts                   # tRPC client + React Query client
│       └── routers/
│           ├── user.ts                 # Profile queries/mutations
│           └── org.ts                  # Members, invitations
├── middleware.ts                        # Auth middleware (Edge runtime)
├── app/
│   ├── providers.tsx                   # QueryClientProvider + tRPC provider
│   ├── (auth)/
│   │   ├── layout.tsx
│   │   ├── login/page.tsx
│   │   └── accept-invitation/[id]/page.tsx
│   ├── (roks-workspace)/
│   │   └── dashboard/
│   │       └── settings/page.tsx
│   └── api/
│       ├── auth/[...all]/route.ts
│       └── trpc/[trpc]/route.ts

prisma/
├── schema.prisma                       # Updated with Better Auth tables
└── seed.ts                             # Seed first user + org
```

---

## Environment Variables

```env
# Better Auth
BETTER_AUTH_SECRET=         # Random 32+ char secret for signing sessions
BETTER_AUTH_URL=http://localhost:3000  # Base URL (change for production)

# Resend
RESEND_API_KEY=             # From resend.com dashboard
RESEND_FROM_EMAIL=noreply@nirodigital.com  # Sender address for magic links and invites
```

Production values set in Railway environment variables.

---

## Dependencies

```
better-auth               # Auth framework
resend                    # Email delivery
@trpc/server              # tRPC server + fetch adapter
@trpc/client              # tRPC client
@trpc/tanstack-react-query # tRPC React Query integration
@tanstack/react-query     # Required by tRPC React
```

Note: `@trpc/next` is the Pages Router adapter and is NOT used with App Router. The App Router handler uses `fetchRequestHandler` from `@trpc/server/adapters/fetch`. `superjson` is not needed initially since all data types are JSON-serializable — add later if needed for Date/Map/Set serialization.

---

## Future Considerations

- **Multiple organizations:** The organization plugin supports this natively. Add an org switcher in the sidebar when needed.
- **Per-org data isolation:** When needed, add `organizationId` to relevant models and filter queries by active org.
- **Role-based access:** The organization plugin supports owner/admin/member roles. Wire up permission checks when needed.
- **REST → tRPC migration:** As features move to the roks-workspace, migrate their API calls to tRPC routers.
