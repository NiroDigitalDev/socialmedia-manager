# Social Media Manager

## Package Manager

- Use `bun` exclusively — npm/yarn/pnpm are blocked by preinstall script and `packageManager` field

## Database & ORM

- Run `prisma generate` before builds — the build script does this (`bun run build`), but if you're type-checking standalone, run it first
- Prisma client is generated to `src/generated/prisma/` (not `node_modules`) — this directory is gitignored and must be regenerated locally
- Prisma uses the `@prisma/adapter-pg` PostgreSQL adapter (not the default driver) — connection is via raw `pg` pool, not Prisma's built-in driver

## Images

- Images are currently stored as binary blobs in PostgreSQL (`Bytes` type) — migration to Cloudflare R2 is in progress via `src/lib/r2.ts` and `src/lib/image-processing.ts`
- Image serving endpoint: `/api/images/[id]?type=stored|generated` — returns binary data with 1-year immutable cache headers

## UI & Components

- Use `cn()` from `@/lib/utils` for all Tailwind className merging — never concatenate manually
- shadcn/ui style is `radix-nova` with `neutral` base color — use `bunx shadcn@latest add <component>` to add new components

## AI Generation

- AI image generation uses Gemini models via `@google/genai` — two models: `nano-banana-2` (flash) and `nano-banana-pro` (pro). Supported aspect ratios: 3:4, 1:1, 4:5, 9:16

## Route Groups

- The `(roks-workspace)` route group has its own layout (no main app Sidebar) — use it for experimental/workspace features separate from the main app
