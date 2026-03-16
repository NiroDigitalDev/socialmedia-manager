import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../init";

// Reusable authz check — verifies user is a member of the org
async function verifyMembership(
  prisma: { member: { findFirst: Function } },
  userId: string,
  organizationId: string
) {
  if (!organizationId) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "organizationId is required" });
  }
  const membership = await prisma.member.findFirst({
    where: { userId, organizationId },
  });
  if (!membership) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Not a member of this organization" });
  }
  return membership;
}

export const orgRouter = router({
  members: protectedProcedure
    .input(z.object({ organizationId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      await verifyMembership(ctx.prisma, ctx.session.user.id, input.organizationId);

      return ctx.prisma.member.findMany({
        where: { organizationId: input.organizationId },
        include: { user: { select: { id: true, name: true, email: true, image: true } } },
        orderBy: { createdAt: "asc" },
      });
    }),

  invitations: protectedProcedure
    .input(z.object({ organizationId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      await verifyMembership(ctx.prisma, ctx.session.user.id, input.organizationId);

      return ctx.prisma.invitation.findMany({
        where: {
          organizationId: input.organizationId,
          status: "pending",
        },
        orderBy: { createdAt: "desc" },
      });
    }),

  removeMember: protectedProcedure
    .input(z.object({ memberId: z.string(), organizationId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const currentMembership = await verifyMembership(
        ctx.prisma, ctx.session.user.id, input.organizationId
      );

      // Only owners can remove members
      if (currentMembership.role !== "owner") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only owners can remove members" });
      }

      // Can't remove yourself
      const targetMember = await ctx.prisma.member.findFirst({
        where: { id: input.memberId, organizationId: input.organizationId },
      });

      if (!targetMember) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Member not found" });
      }

      if (targetMember.userId === ctx.session.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot remove yourself" });
      }

      await ctx.prisma.member.delete({ where: { id: input.memberId } });
      return { success: true };
    }),
});
