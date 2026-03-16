import { router, orgProtectedProcedure } from "../init";

export const generationRouter = router({
  // Placeholder — full implementation in future iteration
  recent: orgProtectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.generatedPost.findMany({
      where: { orgId: ctx.orgId },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { style: { select: { name: true } } },
    });
  }),
});
