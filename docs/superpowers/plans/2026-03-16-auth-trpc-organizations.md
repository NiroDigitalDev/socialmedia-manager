# Auth + tRPC + Organizations Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add invite-only authentication (Better Auth + magic link), organization support, and tRPC API layer to the Social Media Manager app.

**Architecture:** Better Auth with magic link and organization plugins handles auth. tRPC with React Query provides the typed API layer for new features, coexisting with existing REST routes. Resend sends emails. Middleware gates all routes behind auth.

**Tech Stack:** Better Auth, Resend, tRPC v11, @tanstack/react-query, Prisma, Next.js 16 App Router

**Spec:** `docs/superpowers/specs/2026-03-16-auth-trpc-organizations-design.md`

---

## Chunk 1: Foundation (Dependencies, Auth Config, Schema, Middleware)

### Task 1: Install Dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install auth and API dependencies**

```bash
bun i better-auth resend @trpc/server @trpc/client @trpc/tanstack-react-query @tanstack/react-query
```

- [ ] **Step 2: Verify installation**

```bash
bun pm ls | grep -E "better-auth|resend|trpc|react-query"
```

Expected: All 6 packages listed.

- [ ] **Step 3: Commit**

```bash
git add package.json bun.lock
git commit -m "chore: add better-auth, resend, trpc, react-query deps"
```

---

### Task 2: Add Environment Variables

**Files:**
- Modify: `.env`
- Modify: `.env.example`

- [ ] **Step 1: Generate a random secret**

```bash
openssl rand -base64 32
```

- [ ] **Step 2: Add auth + email vars to `.env`**

Add these lines to the existing `.env` file:

```env
# Better Auth
BETTER_AUTH_SECRET=<generated-secret>
BETTER_AUTH_URL=http://localhost:3000
NEXT_PUBLIC_BETTER_AUTH_URL=http://localhost:3000

# Resend
RESEND_API_KEY=
RESEND_FROM_EMAIL=noreply@nirodigital.com
```

Note: `RESEND_API_KEY` will be filled in by the user from resend.com.

- [ ] **Step 3: Update `.env.example`**

Add the same keys (without values) to `.env.example`:

```env
# Better Auth
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=http://localhost:3000
NEXT_PUBLIC_BETTER_AUTH_URL=http://localhost:3000

# Resend
RESEND_API_KEY=
RESEND_FROM_EMAIL=noreply@nirodigital.com
```

- [ ] **Step 4: Commit**

```bash
git add .env.example
git commit -m "chore: add auth and resend env vars to .env.example"
```

---

### Task 3: Better Auth Server Config

**Files:**
- Create: `src/lib/auth.ts`

- [ ] **Step 1: Create the Better Auth server configuration**

```typescript
// src/lib/auth.ts
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { magicLink } from "better-auth/plugins";
import { organization } from "better-auth/plugins";
import { Resend } from "resend";
import { prisma } from "@/lib/prisma";

const resend = new Resend(process.env.RESEND_API_KEY);
const fromEmail = process.env.RESEND_FROM_EMAIL || "noreply@nirodigital.com";

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  plugins: [
    magicLink({
      disableSignUp: true,
      sendMagicLink: async ({ email, url }) => {
        await resend.emails.send({
          from: fromEmail,
          to: email,
          subject: "Sign in to Social Media Manager",
          html: `<p>Click <a href="${url}">here</a> to sign in to Social Media Manager.</p><p>This link expires in 5 minutes.</p>`,
        });
      },
    }),
    organization({
      async sendInvitationEmail(data) {
        const inviteLink = `${process.env.BETTER_AUTH_URL}/accept-invitation/${data.id}`;
        await resend.emails.send({
          from: fromEmail,
          to: data.email,
          subject: `You're invited to join ${data.organization.name}`,
          html: `<p>${data.inviter.user.name} invited you to join <strong>${data.organization.name}</strong> on Social Media Manager.</p><p>Click <a href="${inviteLink}">here</a> to accept the invitation.</p>`,
        });
      },
    }),
  ],
});

export type Session = typeof auth.$Infer.Session;
```

- [ ] **Step 2: Verify file compiles**

```bash
bunx tsc --noEmit 2>&1 | grep "auth.ts" || echo "No errors in auth.ts"
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/auth.ts
git commit -m "feat: add Better Auth server config with magic link + org plugins"
```

---

### Task 4: Better Auth Client Config

**Files:**
- Create: `src/lib/auth-client.ts`

- [ ] **Step 1: Create the Better Auth client**

```typescript
// src/lib/auth-client.ts
import { createAuthClient } from "better-auth/react";
import { magicLinkClient } from "better-auth/client/plugins";
import { organizationClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL || "",
  plugins: [magicLinkClient(), organizationClient()],
});
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/auth-client.ts .env.example
git commit -m "feat: add Better Auth client config with magic link + org plugins"
```

---

### Task 5: Generate Better Auth Schema + Migrate

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Generate Better Auth schema additions**

```bash
bunx @better-auth/cli generate --config src/lib/auth.ts --output prisma/schema.prisma
```

This appends Better Auth's required models (user, session, account, verification, organization, member, invitation) to the existing Prisma schema.

- [ ] **Step 2: Review the generated schema**

Open `prisma/schema.prisma` and verify that these models were added:
- `user`
- `session`
- `account`
- `verification`
- `organization`
- `member`
- `invitation`

Ensure they don't conflict with existing models (StoredImage, Style, etc.).

- [ ] **Step 3: Run the migration**

```bash
bunx prisma migrate dev --name add-auth-tables
```

Expected: Migration created and applied successfully.

- [ ] **Step 4: Generate Prisma client**

```bash
bunx prisma generate
```

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add Better Auth tables to Prisma schema"
```

---

### Task 6: Better Auth API Route Handler

**Files:**
- Create: `src/app/api/auth/[...all]/route.ts`

- [ ] **Step 1: Create the catch-all auth route**

```typescript
// src/app/api/auth/[...all]/route.ts
import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

export const { GET, POST } = toNextJsHandler(auth);
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/auth/
git commit -m "feat: add Better Auth API route handler"
```

---

### Task 7: Auth Middleware

**Files:**
- Create: `src/middleware.ts`

- [ ] **Step 1: Create the middleware**

```typescript
// src/middleware.ts
import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// All /api routes are public — existing REST routes have no auth,
// and Better Auth + tRPC handle their own session validation.
const publicPaths = ["/login", "/accept-invitation", "/api"];

function isPublicPath(pathname: string): boolean {
  return publicPaths.some((path) => pathname.startsWith(path));
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths and static assets
  if (
    isPublicPath(pathname) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Check for session cookie (optimistic — not validated against DB)
  const sessionCookie = getSessionCookie(request);

  if (!sessionCookie) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

- [ ] **Step 2: Verify the dev server starts without errors**

```bash
bun run dev
```

Visit `http://localhost:3000` — should redirect to `/login` (which will 404 for now — that's expected).

- [ ] **Step 3: Commit**

```bash
git add src/middleware.ts
git commit -m "feat: add auth middleware with session cookie check"
```

---

## Chunk 2: tRPC Infrastructure

### Task 8: tRPC Init + Context

**Files:**
- Create: `src/lib/trpc/init.ts`

- [ ] **Step 1: Create the tRPC instance with context**

```typescript
// src/lib/trpc/init.ts
import { initTRPC, TRPCError } from "@trpc/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";

export const createTRPCContext = async () => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  return {
    session,
    prisma,
  };
};

const t = initTRPC.context<typeof createTRPCContext>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(async (opts) => {
  if (!opts.ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return opts.next({
    ctx: {
      ...opts.ctx,
      session: opts.ctx.session,
    },
  });
});
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/trpc/init.ts
git commit -m "feat: add tRPC init with auth context and protected procedure"
```

---

### Task 9: tRPC Routers

**Files:**
- Create: `src/lib/trpc/routers/user.ts`
- Create: `src/lib/trpc/routers/org.ts`
- Create: `src/lib/trpc/router.ts`

Note: The project uses Zod v4 (`^4.3.6`). `import { z } from "zod"` works because Zod v4 is API-compatible. If any tRPC input validation type errors occur, try `import { z } from "zod/v4"` instead.

- [ ] **Step 1: Create the user router**

```typescript
// src/lib/trpc/routers/user.ts
import { z } from "zod";
import { router, protectedProcedure } from "../init";

export const userRouter = router({
  me: protectedProcedure.query(async ({ ctx }) => {
    return ctx.session.user;
  }),

  updateName: protectedProcedure
    .input(z.object({ name: z.string().min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      const updated = await ctx.prisma.user.update({
        where: { id: ctx.session.user.id },
        data: { name: input.name },
      });
      return { name: updated.name };
    }),
});
```

- [ ] **Step 2: Create the org router**

```typescript
// src/lib/trpc/routers/org.ts
import { z } from "zod";
import { router, protectedProcedure } from "../init";

export const orgRouter = router({
  members: protectedProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ ctx, input }) => {
      const members = await ctx.prisma.member.findMany({
        where: { organizationId: input.organizationId },
        include: { user: { select: { id: true, name: true, email: true, image: true } } },
        orderBy: { createdAt: "asc" },
      });
      return members;
    }),

  invitations: protectedProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ ctx, input }) => {
      const invitations = await ctx.prisma.invitation.findMany({
        where: {
          organizationId: input.organizationId,
          status: "pending",
        },
        orderBy: { createdAt: "desc" },
      });
      return invitations;
    }),
});
```

- [ ] **Step 3: Create the merged app router**

```typescript
// src/lib/trpc/router.ts
import { router } from "./init";
import { userRouter } from "./routers/user";
import { orgRouter } from "./routers/org";

export const appRouter = router({
  user: userRouter,
  org: orgRouter,
});

export type AppRouter = typeof appRouter;
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/trpc/
git commit -m "feat: add tRPC routers for user profile and org management"
```

---

### Task 10: tRPC API Route Handler

**Files:**
- Create: `src/app/api/trpc/[trpc]/route.ts`

- [ ] **Step 1: Create the tRPC handler**

```typescript
// src/app/api/trpc/[trpc]/route.ts
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { createTRPCContext } from "@/lib/trpc/init";
import { appRouter } from "@/lib/trpc/router";

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: createTRPCContext,
  });

export { handler as GET, handler as POST };
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/trpc/
git commit -m "feat: add tRPC API route handler for App Router"
```

---

### Task 11: tRPC Client + Providers

**Files:**
- Create: `src/lib/trpc/client.ts`
- Create: `src/app/providers.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Create the tRPC client**

```typescript
// src/lib/trpc/client.ts
"use client";

import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { createTRPCContext } from "@trpc/tanstack-react-query";
import type { AppRouter } from "./router";

export const { TRPCProvider, useTRPC, queryClient } = createTRPCContext<AppRouter>();

export const trpcClient = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: "/api/trpc",
    }),
  ],
});
```

- [ ] **Step 2: Create the providers wrapper**

```tsx
// src/app/providers.tsx
"use client";

import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { TRPCProvider, trpcClient } from "@/lib/trpc/client";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        {children}
      </TRPCProvider>
    </QueryClientProvider>
  );
}
```

- [ ] **Step 3: Wrap the root layout with providers**

Modify `src/app/layout.tsx` — wrap `{children}` with `<Providers>`:

```tsx
// src/app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import { Providers } from "./providers";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Social Media Manager",
  description: "AI-powered social media post generator",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn("dark", "font-sans", geist.variable)}>
      <body className="antialiased">
        <Providers>
          {children}
        </Providers>
        <Toaster />
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/trpc/client.ts src/app/providers.tsx src/app/layout.tsx
git commit -m "feat: add tRPC client, providers, and wrap root layout"
```

---

## Chunk 3: Auth Pages (Login, Invitation, Auth Layout)

### Task 12: Auth Route Group Layout

**Files:**
- Create: `src/app/(auth)/layout.tsx`

- [ ] **Step 1: Create the centered auth layout**

```tsx
// src/app/(auth)/layout.tsx
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add "src/app/(auth)/"
git commit -m "feat: add auth route group with centered layout"
```

---

### Task 13: Login Page

**Files:**
- Create: `src/app/(auth)/login/page.tsx`

Reference: Inspired by shadcn `login-05` template. Run `bunx shadcn@latest add login-05` to see the template, then adapt to magic link only.

- [ ] **Step 1: Create the login page**

```tsx
// src/app/(auth)/login/page.tsx
"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { CommandIcon } from "lucide-react";

type Status = "idle" | "sending" | "sent" | "error";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const searchParams = useSearchParams();
  const urlError = searchParams.get("error");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("sending");
    setErrorMessage("");

    const { error } = await authClient.signIn.magicLink({
      email,
      callbackURL: "/dashboard",
    });

    if (error) {
      setStatus("error");
      setErrorMessage(
        error.message || "No account found — you need an invitation to access this app."
      );
    } else {
      setStatus("sent");
    }
  };

  return (
    <div className="w-full max-w-md">
      <div className="flex flex-col items-center gap-2 mb-6">
        <CommandIcon className="size-8 text-primary" />
        <h1 className="text-xl font-bold">Social Media Manager</h1>
      </div>

      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Sign in</CardTitle>
          <CardDescription>
            Enter your email to receive a magic link
          </CardDescription>
        </CardHeader>
        <CardContent>
          {urlError && (
            <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {urlError === "expired"
                ? "Link expired — request a new one."
                : "Invalid link — please try again."}
            </div>
          )}

          {status === "sent" ? (
            <div className="text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                Check your email for a sign-in link.
              </p>
              <p className="text-xs text-muted-foreground">
                Sent to <strong>{email}</strong>
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStatus("idle")}
              >
                Use a different email
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={status === "sending"}
                />
              </div>

              {status === "error" && (
                <p className="text-sm text-destructive">{errorMessage}</p>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={status === "sending"}
              >
                {status === "sending" ? "Sending..." : "Send magic link"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Verify the page renders**

```bash
bun run dev
```

Visit `http://localhost:3000/login` — should show the login card.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(auth)/login/"
git commit -m "feat: add magic link login page"
```

---

### Task 14: Accept Invitation Page (Server Action + Client Form)

The invitation flow is two-phase because Better Auth's `acceptInvitation` requires an authenticated user. New invitees don't have an account yet. The server action creates the user, and after they authenticate via magic link, a post-login check auto-accepts pending invitations.

**Files:**
- Create: `src/app/(auth)/accept-invitation/[id]/page.tsx`
- Create: `src/app/(auth)/accept-invitation/[id]/actions.ts`

- [ ] **Step 1: Create the server action**

```typescript
// src/app/(auth)/accept-invitation/[id]/actions.ts
"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function getInvitationDetails(invitationId: string) {
  const invitation = await prisma.invitation.findFirst({
    where: { id: invitationId, status: "pending" },
    include: { organization: true },
  });

  if (!invitation) {
    return { error: "Invitation not found or has expired." };
  }

  return {
    id: invitation.id,
    email: invitation.email,
    organizationName: invitation.organization.name,
  };
}

export async function acceptInvitationAndSendMagicLink(
  invitationId: string,
  name: string
) {
  // 1. Fetch the invitation
  const invitation = await prisma.invitation.findFirst({
    where: { id: invitationId, status: "pending" },
  });

  if (!invitation) {
    return { error: "Invitation not found or has expired." };
  }

  // 2. Check if user already exists
  let user = await prisma.user.findFirst({
    where: { email: invitation.email },
  });

  // 3. Create user if they don't exist
  if (!user) {
    user = await prisma.user.create({
      data: {
        name,
        email: invitation.email,
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Create account record for magic link provider
    await prisma.account.create({
      data: {
        userId: user.id,
        accountId: user.id,
        providerId: "magic-link",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  // 4. Send magic link via Better Auth
  // After they authenticate, the post-login hook will auto-accept the invitation
  try {
    await auth.api.signInMagicLink({
      body: { email: invitation.email, callbackURL: "/dashboard" },
    });
  } catch {
    return { error: "Failed to send magic link. Please try again." };
  }

  return { success: true, email: invitation.email };
}
```

- [ ] **Step 2: Create the client page**

```tsx
// src/app/(auth)/accept-invitation/[id]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getInvitationDetails, acceptInvitationAndSendMagicLink } from "./actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CommandIcon } from "lucide-react";

type Status = "loading" | "ready" | "processing" | "sent" | "error";

export default function AcceptInvitationPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [status, setStatus] = useState<Status>("loading");
  const [invitation, setInvitation] = useState<{
    id: string;
    email: string;
    organizationName: string;
  } | null>(null);
  const [name, setName] = useState("");
  const [sentEmail, setSentEmail] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function load() {
      const result = await getInvitationDetails(id);
      if ("error" in result) {
        setStatus("error");
        setErrorMessage(result.error!);
      } else {
        setInvitation(result as typeof invitation);
        setStatus("ready");
      }
    }
    load();
  }, [id]);

  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invitation) return;
    setStatus("processing");

    const result = await acceptInvitationAndSendMagicLink(invitation.id, name);

    if ("error" in result && result.error) {
      setStatus("error");
      setErrorMessage(result.error);
    } else {
      setSentEmail(result.email || invitation.email);
      setStatus("sent");
    }
  };

  if (status === "loading") {
    return (
      <div className="w-full max-w-md text-center">
        <p className="text-sm text-muted-foreground">Loading invitation...</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="w-full max-w-md">
        <Card>
          <CardContent className="pt-6 text-center space-y-4">
            <p className="text-sm text-destructive">{errorMessage}</p>
            <Button variant="outline" onClick={() => router.push("/login")}>
              Go to login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === "sent") {
    return (
      <div className="w-full max-w-md">
        <Card>
          <CardContent className="pt-6 text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              Check your email to complete setup.
            </p>
            <p className="text-xs text-muted-foreground">
              Sent to <strong>{sentEmail}</strong>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      <div className="flex flex-col items-center gap-2 mb-6">
        <CommandIcon className="size-8 text-primary" />
        <h1 className="text-xl font-bold">Social Media Manager</h1>
      </div>

      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">
            Join {invitation?.organizationName}
          </CardTitle>
          <CardDescription>
            You&apos;ve been invited to join as a member
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAccept} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={invitation?.email || ""}
                disabled
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Your name</Label>
              <Input
                id="name"
                type="text"
                placeholder="Enter your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={status === "processing"}
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={status === "processing"}
            >
              {status === "processing" ? "Joining..." : "Accept & join"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add "src/app/(auth)/accept-invitation/"
git commit -m "feat: add invitation acceptance page with server-side user creation"
```

---

## Chunk 4: Dashboard UI (Settings, Nav User, Sidebar)

### Task 15: Dashboard Layout with Sidebar

The existing dashboard page wraps itself in `SidebarProvider` + `AppSidebar`. Extract this into a shared layout so the settings page also gets the sidebar.

**Files:**
- Create: `src/app/(roks-workspace)/dashboard/layout.tsx`
- Modify: `src/app/(roks-workspace)/dashboard/page.tsx` — remove its own `SidebarProvider`/`AppSidebar` wrapper

- [ ] **Step 1: Create the shared dashboard layout**

```tsx
// src/app/(roks-workspace)/dashboard/layout.tsx
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { SiteHeader } from "@/components/site-header"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
```

- [ ] **Step 2: Simplify the dashboard page**

Remove the `SidebarProvider`, `AppSidebar`, `SidebarInset`, and `SiteHeader` wrapper from `src/app/(roks-workspace)/dashboard/page.tsx`. The page should only contain its own content:

```tsx
// src/app/(roks-workspace)/dashboard/page.tsx
import { ChartAreaInteractive } from "@/components/chart-area-interactive"
import { DataTable } from "@/components/data-table"
import { SectionCards } from "@/components/section-cards"

import data from "./data.json"

export default function Page() {
  return (
    <div className="@container/main flex flex-1 flex-col gap-2">
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        <SectionCards />
        <div className="px-4 lg:px-6">
          <ChartAreaInteractive />
        </div>
        <DataTable data={data} />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add "src/app/(roks-workspace)/dashboard/"
git commit -m "feat: extract dashboard layout with shared sidebar"
```

---

### Task 16: Dashboard Settings Page (renumbered from 15)

**Files:**
- Create: `src/app/(roks-workspace)/dashboard/settings/page.tsx`

- [ ] **Step 1: Create the settings page**

```tsx
// src/app/(roks-workspace)/dashboard/settings/page.tsx
"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

export default function SettingsPage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // Get session
  const { data: session } = authClient.useSession();

  // Get active organization
  const { data: activeOrg } = authClient.useActiveOrganization();

  // Profile state
  const [name, setName] = useState("");
  const [nameLoaded, setNameLoaded] = useState(false);

  if (session?.user && !nameLoaded) {
    setName(session.user.name || "");
    setNameLoaded(true);
  }

  // tRPC queries
  const membersQuery = useQuery(
    trpc.org.members.queryOptions({
      organizationId: activeOrg?.id || "",
    })
  );

  const invitationsQuery = useQuery(
    trpc.org.invitations.queryOptions({
      organizationId: activeOrg?.id || "",
    })
  );

  // Update name mutation
  const updateName = useMutation(
    trpc.user.updateName.mutationOptions({
      onSuccess: () => {
        toast.success("Name updated");
      },
      onError: (err) => {
        toast.error(err.message);
      },
    })
  );

  // Invite member state
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrg) return;
    setInviting(true);

    const { error } = await authClient.organization.inviteMember({
      email: inviteEmail,
      role: "member",
      organizationId: activeOrg.id,
    });

    if (error) {
      toast.error(error.message || "Failed to send invitation");
    } else {
      toast.success(`Invitation sent to ${inviteEmail}`);
      setInviteEmail("");
      queryClient.invalidateQueries({ queryKey: trpc.org.invitations.queryKey() });
    }
    setInviting(false);
  };

  const handleRevoke = async (invitationId: string) => {
    const { error } = await authClient.organization.cancelInvitation({
      invitationId,
    });

    if (error) {
      toast.error("Failed to revoke invitation");
    } else {
      toast.success("Invitation revoked");
      queryClient.invalidateQueries({ queryKey: trpc.org.invitations.queryKey() });
    }
  };

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      {/* Profile Section */}
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Manage your account settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="profile-name">Name</Label>
            <div className="flex gap-2">
              <Input
                id="profile-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
              />
              <Button
                onClick={() => updateName.mutate({ name })}
                disabled={updateName.isPending || name === session?.user?.name}
              >
                {updateName.isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={session?.user?.email || ""} disabled />
          </div>
        </CardContent>
      </Card>

      {/* Members Section */}
      {activeOrg && (
        <Card>
          <CardHeader>
            <CardTitle>Members — {activeOrg.name}</CardTitle>
            <CardDescription>Manage organization members</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {membersQuery.data?.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>{member.user.name}</TableCell>
                    <TableCell>{member.user.email}</TableCell>
                    <TableCell className="capitalize">{member.role}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Pending Invitations */}
            {invitationsQuery.data && invitationsQuery.data.length > 0 && (
              <>
                <h3 className="text-sm font-medium text-muted-foreground">
                  Pending Invitations
                </h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Sent</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invitationsQuery.data.map((inv) => (
                      <TableRow key={inv.id}>
                        <TableCell>{inv.email}</TableCell>
                        <TableCell>
                          {new Date(inv.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRevoke(inv.id)}
                          >
                            Revoke
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </>
            )}

            {/* Invite Form */}
            <form onSubmit={handleInvite} className="flex gap-2">
              <Input
                type="email"
                placeholder="Email address"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
                disabled={inviting}
              />
              <Button type="submit" disabled={inviting}>
                {inviting ? "Sending..." : "Invite"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add "src/app/(roks-workspace)/dashboard/settings/"
git commit -m "feat: add dashboard settings page with profile + members management"
```

---

### Task 17: Wire Nav User Component

**Files:**
- Modify: `src/components/nav-user.tsx`

- [ ] **Step 1: Update nav-user.tsx**

Replace the entire file. Key changes:
- Remove Billing and Notifications
- Wire Account → `/dashboard/settings`
- Wire Log out → Better Auth signOut
- Compute avatar initials from `user.name`

```tsx
// src/components/nav-user.tsx
"use client"

import { useRouter } from "next/navigation"
import { authClient } from "@/lib/auth-client"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { EllipsisVerticalIcon, CircleUserRoundIcon, LogOutIcon } from "lucide-react"

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function NavUser({
  user,
}: {
  user: {
    name: string
    email: string
    image?: string | null
  }
}) {
  const { isMobile } = useSidebar()
  const router = useRouter()

  const handleLogout = async () => {
    await authClient.signOut()
    router.push("/login")
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 rounded-lg grayscale">
                <AvatarImage src={user.image || undefined} alt={user.name} />
                <AvatarFallback className="rounded-lg">
                  {getInitials(user.name)}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{user.name}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {user.email}
                </span>
              </div>
              <EllipsisVerticalIcon className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage src={user.image || undefined} alt={user.name} />
                  <AvatarFallback className="rounded-lg">
                    {getInitials(user.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{user.name}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {user.email}
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => router.push("/dashboard/settings")}>
                <CircleUserRoundIcon />
                Account
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}>
              <LogOutIcon />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/nav-user.tsx
git commit -m "feat: wire nav-user to auth (account settings, logout, initials)"
```

---

### Task 18: Wire App Sidebar with Session Data

**Files:**
- Modify: `src/components/app-sidebar.tsx`

- [ ] **Step 1: Update app-sidebar.tsx to use session data**

Replace the hardcoded `data.user` with session data. The sidebar becomes a client component that reads the session.

Key changes:
- Import `authClient`
- Replace hardcoded user with `authClient.useSession()` data
- **Important:** The `NavUser` prop changed from `avatar: string` to `image?: string | null` in Task 17. Pass `image` not `avatar`.
- Keep all other nav items as-is

In `src/components/app-sidebar.tsx`:

1. Remove the `user` property from the `data` object (delete the `user: { name: "shadcn", ... }` block)
2. Add `import { authClient } from "@/lib/auth-client"` at the top
3. Inside the `AppSidebar` component, add session data before the return:

```tsx
import { authClient } from "@/lib/auth-client"

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { data: session } = authClient.useSession()

  const user = {
    name: session?.user?.name || "User",
    email: session?.user?.email || "",
    image: session?.user?.image || null,
  }

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      {/* ... header and content stay the same ... */}
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/app-sidebar.tsx
git commit -m "feat: wire app-sidebar to auth session data"
```

---

## Chunk 5: Seed Script + Final Verification

### Task 19: Seed Script

**Files:**
- Create: `prisma/seed.ts`

- [ ] **Step 1: Create the seed script**

```typescript
// prisma/seed.ts
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const connectionString = process.env.DATABASE_URL!;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding...");

  // 1. Create or find the seed user
  // Uses findFirst + create (not upsert) because email may not have @unique
  let user = await prisma.user.findFirst({
    where: { email: "dev@nirodigital.com" },
  });
  if (!user) {
    user = await prisma.user.create({
      data: {
        name: "Rok",
        email: "dev@nirodigital.com",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    console.log("User created:", user.id, user.email);
  } else {
    console.log("User exists:", user.id, user.email);
  }

  // 2. Create account record for magic link provider
  const existingAccount = await prisma.account.findFirst({
    where: { userId: user.id, providerId: "magic-link" },
  });
  if (!existingAccount) {
    await prisma.account.create({
      data: {
        userId: user.id,
        accountId: user.id,
        providerId: "magic-link",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    console.log("Account created for magic-link provider");
  }

  // 3. Create organization
  // Uses findFirst + create (not upsert) because slug may not have @unique
  let org = await prisma.organization.findFirst({
    where: { slug: "niro-digital" },
  });
  if (!org) {
    org = await prisma.organization.create({
      data: {
        name: "Niro Digital",
        slug: "niro-digital",
        createdAt: new Date(),
      },
    });
    console.log("Organization created:", org.id, org.name);
  } else {
    console.log("Organization exists:", org.id, org.name);
  }

  // 4. Create member (owner)
  const existingMember = await prisma.member.findFirst({
    where: { userId: user.id, organizationId: org.id },
  });
  if (!existingMember) {
    await prisma.member.create({
      data: {
        userId: user.id,
        organizationId: org.id,
        role: "owner",
        createdAt: new Date(),
      },
    });
    console.log("Member created: Rok as owner of Niro Digital");
  }

  console.log("Seed complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 2: Run the seed**

```bash
bun prisma/seed.ts
```

Expected: "Seed complete!" with user, account, org, and member created.

- [ ] **Step 3: Commit**

```bash
git add prisma/seed.ts
git commit -m "feat: add seed script for initial user, org, and member"
```

---

### Task 20: End-to-End Verification

- [ ] **Step 1: Start the dev server**

```bash
bun run dev
```

- [ ] **Step 2: Verify middleware redirects**

Visit `http://localhost:3000` — should redirect to `/login`.
Visit `http://localhost:3000/dashboard` — should redirect to `/login`.

- [ ] **Step 3: Verify login page renders**

Visit `http://localhost:3000/login` — should show the magic link login card.

- [ ] **Step 4: Test magic link flow (requires RESEND_API_KEY)**

Enter `dev@nirodigital.com` → click "Send magic link" → check email → click link → should land on `/dashboard`.

- [ ] **Step 5: Verify dashboard shows real user data**

After login, the sidebar should show "Rok" and "dev@nirodigital.com" in the user menu.

- [ ] **Step 6: Verify settings page**

Navigate to `/dashboard/settings` — should show profile (Rok, dev@nirodigital.com) and members table (Rok as owner of Niro Digital).

- [ ] **Step 7: Test logout**

Click user menu → Log out → should redirect to `/login`.

- [ ] **Step 8: Final commit**

```bash
git add -A
git commit -m "feat: complete auth + tRPC + organizations setup"
```

---

## Notes for Implementor

- **Better Auth CLI**: The `bunx @better-auth/cli generate` command may need adjustment based on the exact CLI interface. Check `bunx @better-auth/cli --help` first. Alternative: manually add the models to `schema.prisma` based on Better Auth's Prisma documentation.
- **Prisma adapter compatibility**: The project uses `@prisma/adapter-pg` with a custom `PrismaPg` adapter. The `prismaAdapter` from Better Auth expects a standard `PrismaClient`. This should work since the adapter is transparent to Better Auth, but verify during Task 5.
- **Invitation flow**: The accept-invitation page uses server actions to create users server-side (since Better Auth's `acceptInvitation` requires an authenticated user). After user creation, a magic link is sent. Post-login, pending invitations for the user's email are auto-accepted. Verify `auth.api.signInMagicLink` exists — may need to call the magic link plugin API directly.
- **tRPC client API**: The `createTRPCContext` from `@trpc/tanstack-react-query` is the v11 API. If using an older tRPC version, the setup differs. Verify the installed version matches v11.
- **Existing REST routes**: All `/api/*` routes are excluded from middleware auth checks. Existing routes continue to work without auth. tRPC procedures handle their own auth via `protectedProcedure`.
- **Zod v4**: Project uses Zod v4 (`^4.3.6`). Should work with tRPC v11 via `import { z } from "zod"`. If type errors occur, try `import { z } from "zod/v4"`.
- **Post-login invitation acceptance**: After Task 14 is implemented, verify that the invitation auto-accept works. May need a Better Auth `afterSignIn` hook or a check in the dashboard layout/page that calls `auth.api.acceptInvitation` for pending invitations matching the user's email.
