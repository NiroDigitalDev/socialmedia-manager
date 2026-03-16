import { router } from "./init";
import { userRouter } from "./routers/user";
import { orgRouter } from "./routers/org";

export const appRouter = router({
  user: userRouter,
  org: orgRouter,
});

export type AppRouter = typeof appRouter;
