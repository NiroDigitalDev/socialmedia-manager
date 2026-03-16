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

export const orgProtectedProcedure = t.procedure.use(async (opts) => {
  if (!opts.ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  const orgId = opts.ctx.session.session.activeOrganizationId;
  if (!orgId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "No active organization. Select an organization first.",
    });
  }

  // Verify membership
  const membership = await opts.ctx.prisma.member.findFirst({
    where: {
      userId: opts.ctx.session.user.id,
      organizationId: orgId,
    },
  });

  if (!membership) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Not a member of this organization" });
  }

  return opts.next({
    ctx: {
      ...opts.ctx,
      session: opts.ctx.session,
      orgId,
      membership,
    },
  });
});
