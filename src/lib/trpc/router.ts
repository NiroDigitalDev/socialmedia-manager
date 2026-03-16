import { router } from "./init";
import { userRouter } from "./routers/user";
import { orgRouter } from "./routers/org";
import { projectRouter } from "./routers/project";
import { campaignRouter } from "./routers/campaign";
import { brandIdentityRouter } from "./routers/brand-identity";
import { contentRouter } from "./routers/content";
import { favoriteRouter } from "./routers/favorite";
import { assetRouter } from "./routers/asset";

export const appRouter = router({
  user: userRouter,
  org: orgRouter,
  project: projectRouter,
  campaign: campaignRouter,
  brandIdentity: brandIdentityRouter,
  content: contentRouter,
  favorite: favoriteRouter,
  asset: assetRouter,
});

export type AppRouter = typeof appRouter;
