import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, orgProtectedProcedure } from "../init";

export const brandIdentityRouter = router({
  list: orgProtectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      const project = await ctx.prisma.project.findFirst({
        where: { id: input.projectId, orgId: ctx.orgId },
      });
      if (!project) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
      }
      const brands = await ctx.prisma.brandIdentity.findMany({
        where: { projectId: input.projectId },
        include: { palettes: true },
        orderBy: { createdAt: "desc" },
      });

      // Resolve logo asset r2Keys for brands that have a logoAssetId
      const logoAssetIds = brands
        .map((b) => b.logoAssetId)
        .filter((id): id is string => !!id);

      let logoAssetMap: Record<string, string> = {};
      if (logoAssetIds.length > 0) {
        const assets = await ctx.prisma.asset.findMany({
          where: { id: { in: logoAssetIds } },
          select: { id: true, r2Key: true },
        });
        logoAssetMap = Object.fromEntries(assets.map((a) => [a.id, a.r2Key]));
      }

      return brands.map((brand) => ({
        ...brand,
        logoR2Key: brand.logoAssetId
          ? logoAssetMap[brand.logoAssetId] ?? null
          : null,
      }));
    }),

  get: orgProtectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const identity = await ctx.prisma.brandIdentity.findFirst({
        where: { id: input.id, orgId: ctx.orgId },
        include: { palettes: true },
      });
      if (!identity) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Brand identity not found" });
      }

      let logoR2Key: string | null = null;
      if (identity.logoAssetId) {
        const asset = await ctx.prisma.asset.findUnique({
          where: { id: identity.logoAssetId },
          select: { r2Key: true },
        });
        logoR2Key = asset?.r2Key ?? null;
      }

      return { ...identity, logoR2Key };
    }),

  create: orgProtectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        name: z.string().min(1).max(200),
        tagline: z.string().max(500).optional(),
        logoAssetId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const project = await ctx.prisma.project.findFirst({
        where: { id: input.projectId, orgId: ctx.orgId },
      });
      if (!project) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
      }
      return ctx.prisma.brandIdentity.create({
        data: { ...input, orgId: ctx.orgId },
      });
    }),

  update: orgProtectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(200).optional(),
        tagline: z.string().max(500).optional(),
        logoAssetId: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const identity = await ctx.prisma.brandIdentity.findFirst({
        where: { id, orgId: ctx.orgId },
      });
      if (!identity) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Brand identity not found" });
      }
      return ctx.prisma.brandIdentity.update({ where: { id }, data });
    }),

  duplicate: orgProtectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const source = await ctx.prisma.brandIdentity.findFirst({
        where: { id: input.id, orgId: ctx.orgId },
        include: { palettes: true },
      });
      if (!source) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Brand identity not found" });
      }
      return ctx.prisma.brandIdentity.create({
        data: {
          name: `${source.name} (Copy)`,
          tagline: source.tagline,
          logoAssetId: source.logoAssetId,
          projectId: source.projectId,
          orgId: ctx.orgId,
          palettes: {
            create: source.palettes.map((p) => ({
              name: p.name,
              accentColor: p.accentColor,
              bgColor: p.bgColor,
            })),
          },
        },
      });
    }),

  delete: orgProtectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const identity = await ctx.prisma.brandIdentity.findFirst({
        where: { id: input.id, orgId: ctx.orgId },
      });
      if (!identity) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Brand identity not found" });
      }
      await ctx.prisma.brandIdentity.delete({ where: { id: input.id } });
      return { success: true };
    }),

  addPalette: orgProtectedProcedure
    .input(
      z.object({
        brandIdentityId: z.string(),
        name: z.string().min(1),
        accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
        bgColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const identity = await ctx.prisma.brandIdentity.findFirst({
        where: { id: input.brandIdentityId, orgId: ctx.orgId },
      });
      if (!identity) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Brand identity not found" });
      }
      return ctx.prisma.brandPalette.create({
        data: {
          name: input.name,
          accentColor: input.accentColor,
          bgColor: input.bgColor,
          brandIdentityId: input.brandIdentityId,
        },
      });
    }),

  updatePalette: orgProtectedProcedure
    .input(
      z.object({
        paletteId: z.string(),
        name: z.string().min(1).optional(),
        accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
        bgColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { paletteId, ...data } = input;
      const palette = await ctx.prisma.brandPalette.findFirst({
        where: { id: paletteId, brandIdentity: { orgId: ctx.orgId } },
      });
      if (!palette) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Palette not found" });
      }
      return ctx.prisma.brandPalette.update({ where: { id: paletteId }, data });
    }),

  removePalette: orgProtectedProcedure
    .input(z.object({ paletteId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const palette = await ctx.prisma.brandPalette.findFirst({
        where: { id: input.paletteId, brandIdentity: { orgId: ctx.orgId } },
      });
      if (!palette) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Palette not found" });
      }
      await ctx.prisma.brandPalette.delete({ where: { id: input.paletteId } });
      return { success: true };
    }),
});
