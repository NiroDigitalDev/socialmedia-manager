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
