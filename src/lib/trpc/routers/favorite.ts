import { z } from "zod";
import { router, protectedProcedure } from "../init";

export const favoriteRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.favorite.findMany({
      where: { userId: ctx.session.user.id },
      orderBy: { order: "asc" },
    });
  }),

  add: protectedProcedure
    .input(
      z.object({
        targetType: z.enum(["project", "campaign", "route"]),
        targetId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const maxOrder = await ctx.prisma.favorite.aggregate({
        where: { userId: ctx.session.user.id },
        _max: { order: true },
      });
      return ctx.prisma.favorite.upsert({
        where: {
          userId_targetType_targetId: {
            userId: ctx.session.user.id,
            targetType: input.targetType,
            targetId: input.targetId,
          },
        },
        create: {
          userId: ctx.session.user.id,
          ...input,
          order: (maxOrder._max.order ?? -1) + 1,
        },
        update: {},
      });
    }),

  remove: protectedProcedure
    .input(
      z.object({
        targetType: z.enum(["project", "campaign", "route"]),
        targetId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.favorite.deleteMany({
        where: {
          userId: ctx.session.user.id,
          targetType: input.targetType,
          targetId: input.targetId,
        },
      });
      return { success: true };
    }),

  reorder: protectedProcedure
    .input(z.array(z.object({ id: z.string(), order: z.number() })))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.$transaction(async (tx) => {
        for (const item of input) {
          await tx.favorite.update({
            where: { id: item.id, userId: ctx.session.user.id },
            data: { order: item.order },
          });
        }
      });
      return { success: true };
    }),
});
