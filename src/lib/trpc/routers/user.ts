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
