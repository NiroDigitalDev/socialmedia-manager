import { router } from "./init";
import { userRouter } from "./routers/user";
import { orgRouter } from "./routers/org";
import { projectRouter } from "./routers/project";
import { campaignRouter } from "./routers/campaign";
import { brandIdentityRouter } from "./routers/brand-identity";
import { favoriteRouter } from "./routers/favorite";

export const appRouter = router({
  user: userRouter,
  org: orgRouter,
  project: projectRouter,
  campaign: campaignRouter,
  brandIdentity: brandIdentityRouter,
  favorite: favoriteRouter,
});

export type AppRouter = typeof appRouter;
