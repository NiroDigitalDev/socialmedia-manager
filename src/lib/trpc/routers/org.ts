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
