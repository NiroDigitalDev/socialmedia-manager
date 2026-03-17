# Styles Page Overhaul Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add platform tabs, remix/blend AI functions, and 2x2 preview grids to the styles page.

**Architecture:** Add `platforms` and `parentStyleIds` fields to the Style model. Platform tabs are client-side filtering on the existing `style.list` query. Remix and blend use Gemini text model (`gemini-2.5-flash`) to generate varied/merged prompts. Style cards get a 2x2 grid with 4 image slots (existing samples + placeholders). Three-dot menu on cards for Remix/Blend actions.

**Tech Stack:** Prisma (schema + migration), tRPC (new endpoints), Gemini AI (`geminiText`), React (shadcn tabs, dropdown-menu), Tailwind CSS

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `prisma/schema.prisma` | Add `platforms` and `parentStyleIds` fields to Style model |
| Modify | `src/lib/trpc/routers/style.ts` | Add `remix` and `blend` mutations, update `create`/`seed` to include platforms/parentStyleIds |
| Modify | `src/hooks/use-styles.ts` | Add `useRemixStyle` and `useBlendStyles` hooks |
| Modify | `src/components/style-card.tsx` | 2x2 preview grid, three-dot menu with Remix/Blend/Delete actions |
| Modify | `src/app/(roks-workspace)/dashboard/styles/page.tsx` | Platform filter tabs, remix/blend dialogs, pass new props to StyleCard |

---

## Chunk 1: Data Model & Backend

### Task 1: Prisma Schema Migration

**Files:**
- Modify: `prisma/schema.prisma:129-142`

- [ ] **Step 1: Add new fields to Style model**

In `prisma/schema.prisma`, update the Style model:

```prisma
model Style {
  id               String          @id @default(cuid())
  name             String
  description      String?
  promptText       String
  referenceImageId String?
  sampleImageIds   String[]
  isPredefined     Boolean         @default(false)
  platforms        String[]        @default([])
  parentStyleIds   String[]        @default([])
  orgId            String?
  createdAt        DateTime        @default(now())
  posts            GeneratedPost[]

  @@index([orgId])
}
```

- [ ] **Step 2: Generate and apply migration**

Run:
```bash
bunx prisma migrate dev --name add-style-platforms-and-lineage
```

Expected: Migration applied successfully, new columns added.

- [ ] **Step 3: Generate Prisma client**

Run:
```bash
bunx prisma generate
```

- [ ] **Step 4: Commit**

```bash
git add prisma/
git commit -m "feat(styles): add platforms and parentStyleIds fields to Style model"
```

### Task 2: Update PREDEFINED_STYLES with platform tags

**Files:**
- Modify: `src/lib/trpc/routers/style.ts:6-241`

- [ ] **Step 1: Add platform tags to each predefined style**

Update the `PREDEFINED_STYLES` array. Add a `platforms` field to each style object. Use these platform assignments (sensible defaults based on style type):

```typescript
const ALL_PLATFORMS = ["instagram", "linkedin", "x", "reddit", "blog", "email"] as const;
export type Platform = (typeof ALL_PLATFORMS)[number];

const PREDEFINED_STYLES: Array<{
  name: string;
  description: string;
  promptText: string;
  platforms: string[];
}> = [
  {
    name: "Corporate Clean",
    description: "Professional and modern corporate aesthetic",
    promptText: "Professional, clean corporate design with blue and white colors, modern typography, structured layout",
    platforms: ["linkedin", "blog", "email"],
  },
  {
    name: "Bold & Vibrant",
    description: "High-energy designs that grab attention",
    promptText: "Bold, vibrant colors, high contrast, energetic design, dynamic composition, eye-catching",
    platforms: ["instagram", "x", "reddit"],
  },
  {
    name: "Minimalist",
    description: "Less is more - clean and elegant designs",
    promptText: "Minimalist design, lots of white space, simple typography, subtle colors, clean and elegant",
    platforms: ["instagram", "linkedin", "blog", "email"],
  },
  // ... continue for all 39 remaining styles with sensible platform assignments
  // Visual/artistic styles → instagram, x, reddit
  // Professional/clean styles → linkedin, blog, email
  // Versatile styles → all platforms
  // Text-heavy styles → blog, email, linkedin
];
```

Assign platforms per style using this logic:
- **Visual/artistic** (Neon/Cyberpunk, Vaporwave, Psychedelic, Pop Art, Pixel Art, Synthwave, Grunge Texture): `["instagram", "x", "reddit"]`
- **Professional/clean** (Corporate Clean, Magazine Editorial): `["linkedin", "blog", "email"]`
- **Versatile** (Minimalist, Gradient Modern, Flat Illustration, 3D Render, Glassmorphism, Duotone): `["instagram", "linkedin", "x", "blog"]`
- **Craft/artsy** (Watercolor, Hand-Drawn Sketch, Origami, Embroidery, Paper Cut, Collage Scrapbook, Chalkboard): `["instagram", "blog"]`
- **Bold/expressive** (Bold & Vibrant, Typography Heavy, Brutalist, Memphis Design, Bauhaus): `["instagram", "x", "reddit"]`
- **Moody/premium** (Dark Luxury, Noir Film, Art Deco, Retro/Vintage): `["instagram", "linkedin", "blog"]`
- **Soft/gentle** (Pastel Soft, Earthy Natural): `["instagram", "linkedin", "blog", "email"]`
- **Technical** (Blueprint, Isometric, Low Poly): `["linkedin", "blog", "reddit"]`
- **Others**: at least 2-3 platforms that make sense

- [ ] **Step 2: Update the seed mutation to include platforms**

In the `seed` mutation (around line 402), update the `createMany` data to include `platforms`:

```typescript
data: newStyles.map((style) => ({
  name: style.name,
  description: style.description,
  promptText: style.promptText,
  platforms: style.platforms,
  sampleImageIds: [],
  isPredefined: true,
})),
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/trpc/routers/style.ts
git commit -m "feat(styles): add platform tags to predefined styles and seed mutation"
```

### Task 3: Update create/update endpoints for platforms and parentStyleIds

**Files:**
- Modify: `src/lib/trpc/routers/style.ts:294-333`

- [ ] **Step 1: Update create mutation input and data**

```typescript
create: orgProtectedProcedure
  .input(
    z.object({
      name: z.string().min(1).max(200),
      description: z.string().optional(),
      promptText: z.string().min(1),
      platforms: z.array(z.string()).optional(),
      parentStyleIds: z.array(z.string()).optional(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const style = await ctx.prisma.style.create({
      data: {
        name: input.name,
        description: input.description ?? null,
        promptText: input.promptText,
        platforms: input.platforms ?? [],
        parentStyleIds: input.parentStyleIds ?? [],
        sampleImageIds: [],
        isPredefined: false,
        orgId: ctx.orgId,
      },
    });
    return style;
  }),
```

- [ ] **Step 2: Update update mutation to accept platforms**

```typescript
update: orgProtectedProcedure
  .input(
    z.object({
      id: z.string(),
      name: z.string().min(1).max(200).optional(),
      description: z.string().max(2000).optional(),
      promptText: z.string().min(1).optional(),
      platforms: z.array(z.string()).optional(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const { id, ...data } = input;
    const style = await ctx.prisma.style.findFirst({
      where: { id, orgId: ctx.orgId, isPredefined: false },
    });
    if (!style) throw new TRPCError({ code: "NOT_FOUND" });
    return ctx.prisma.style.update({ where: { id }, data });
  }),
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/trpc/routers/style.ts
git commit -m "feat(styles): accept platforms and parentStyleIds in create/update endpoints"
```

### Task 4: Add remix and blend tRPC mutations

**Files:**
- Modify: `src/lib/trpc/routers/style.ts` (add after the `fromImage` mutation, before the closing `}`)

- [ ] **Step 1: Add remix mutation**

```typescript
remix: orgProtectedProcedure
  .input(z.object({ sourceStyleId: z.string() }))
  .mutation(async ({ ctx, input }) => {
    const source = await ctx.prisma.style.findUnique({
      where: { id: input.sourceStyleId },
    });
    if (!source) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Source style not found" });
    }
    // Verify access
    if (!source.isPredefined && source.orgId !== ctx.orgId) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
    }

    const prompt = `Given this visual style description: "${source.promptText}"

Create a creative variation that keeps the core aesthetic but introduces fresh elements. Change some aspects like color palette shifts, texture variations, or composition tweaks while maintaining the overall mood and feel.

Return ONLY the new style description as a single prompt (1-2 sentences), nothing else.`;

    const variation = await geminiText.generateContent(prompt);
    const cleanedVariation = (typeof variation === "string" ? variation : "").trim();

    return {
      name: `${source.name} — Remix`,
      description: source.description ? `Remix of: ${source.description}` : null,
      promptText: cleanedVariation || source.promptText,
      platforms: source.platforms,
      parentStyleIds: [source.id],
    };
  }),

blend: orgProtectedProcedure
  .input(z.object({ styleIdA: z.string(), styleIdB: z.string() }))
  .mutation(async ({ ctx, input }) => {
    const [styleA, styleB] = await Promise.all([
      ctx.prisma.style.findUnique({ where: { id: input.styleIdA } }),
      ctx.prisma.style.findUnique({ where: { id: input.styleIdB } }),
    ]);

    if (!styleA || !styleB) {
      throw new TRPCError({ code: "NOT_FOUND", message: "One or both styles not found" });
    }

    // Verify access to both
    for (const s of [styleA, styleB]) {
      if (!s.isPredefined && s.orgId !== ctx.orgId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }
    }

    const prompt = `Combine these two visual styles into one cohesive new style:

Style A: "${styleA.promptText}"
Style B: "${styleB.promptText}"

Create a harmonious blend that takes the best elements from both styles and merges them into something new and cohesive.

Return ONLY the new blended style description as a single prompt (1-2 sentences), nothing else.`;

    const blended = await geminiText.generateContent(prompt);
    const cleanedBlend = (typeof blended === "string" ? blended : "").trim();

    // Union of platforms from both styles, deduplicated
    const platforms = [...new Set([...styleA.platforms, ...styleB.platforms])];

    return {
      name: `${styleA.name} × ${styleB.name}`,
      description: `Blend of ${styleA.name} and ${styleB.name}`,
      promptText: cleanedBlend || `${styleA.promptText}. ${styleB.promptText}`,
      platforms,
      parentStyleIds: [styleA.id, styleB.id],
    };
  }),
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/trpc/routers/style.ts
git commit -m "feat(styles): add remix and blend AI mutations"
```

### Task 5: Add React hooks for remix and blend

**Files:**
- Modify: `src/hooks/use-styles.ts`

- [ ] **Step 1: Add useRemixStyle and useBlendStyles hooks**

Append to the file after the existing hooks:

```typescript
export function useRemixStyle() {
  const trpc = useTRPC();
  return useMutation({
    ...trpc.style.remix.mutationOptions(),
    onError: () => {
      toast.error("Failed to generate style remix");
    },
  });
}

export function useBlendStyles() {
  const trpc = useTRPC();
  return useMutation({
    ...trpc.style.blend.mutationOptions(),
    onError: () => {
      toast.error("Failed to blend styles");
    },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/use-styles.ts
git commit -m "feat(styles): add useRemixStyle and useBlendStyles hooks"
```

---

## Chunk 2: Style Card & Page UI

### Task 6: Update StyleCard with 2x2 preview grid and three-dot menu

**Files:**
- Modify: `src/components/style-card.tsx`

- [ ] **Step 1: Update the StyleCardStyle interface**

```typescript
export interface StyleCardStyle {
  id: string;
  name: string;
  description?: string | null;
  promptText: string;
  isPredefined: boolean;
  sampleImageIds: string[];
  referenceImageId?: string | null;
  platforms?: string[];
  parentStyleIds?: string[];
}
```

- [ ] **Step 2: Add new imports and props**

```typescript
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontalIcon, Trash2Icon, ShuffleIcon, MergeIcon } from "lucide-react";
```

Update StyleCardProps:
```typescript
interface StyleCardProps {
  style: StyleCardStyle;
  selected?: boolean;
  onSelect?: () => void;
  onDelete?: () => void;
  onRemix?: () => void;
  onBlend?: () => void;
}
```

- [ ] **Step 3: Replace the preview section with 2x2 grid**

Replace the existing preview `<div className="aspect-square ...">` block with:

```tsx
{/* 2x2 Preview Grid */}
<div className="aspect-square overflow-hidden bg-muted">
  <div className="grid h-full grid-cols-2 grid-rows-2 gap-0.5">
    {[0, 1, 2, 3].map((idx) => {
      const imgId = style.sampleImageIds[idx];
      return imgId ? (
        <img
          key={imgId}
          src={`/api/images/${imgId}?type=stored`}
          alt=""
          className="size-full object-cover"
          loading="lazy"
        />
      ) : (
        <div
          key={idx}
          className="flex items-center justify-center border border-dashed border-muted-foreground/20 bg-muted/50"
        >
          <PlusIcon className="size-3 text-muted-foreground/30" />
        </div>
      );
    })}
  </div>
</div>
```

Add `PlusIcon` to the lucide imports.

- [ ] **Step 4: Replace the delete button with a three-dot dropdown menu**

Remove the existing delete button block (`{!style.isPredefined && onDelete && (...)}`). Replace with a three-dot menu in the same absolute position:

```tsx
{/* Actions menu */}
{(onRemix || onBlend || onDelete) && (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-2 top-2 size-7 opacity-0 transition-opacity group-hover:opacity-100 bg-background/80 backdrop-blur-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <MoreHorizontalIcon className="size-3.5" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      {onRemix && (
        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onRemix(); }}>
          <ShuffleIcon className="mr-2 size-3.5" />
          Remix
        </DropdownMenuItem>
      )}
      {onBlend && (
        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onBlend(); }}>
          <MergeIcon className="mr-2 size-3.5" />
          Blend with...
        </DropdownMenuItem>
      )}
      {!style.isPredefined && onDelete && (
        <DropdownMenuItem
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="text-destructive focus:text-destructive"
        >
          <Trash2Icon className="mr-2 size-3.5" />
          Delete
        </DropdownMenuItem>
      )}
    </DropdownMenuContent>
  </DropdownMenu>
)}
```

- [ ] **Step 5: Add lineage text below description in CardHeader**

After the description `CardDescription`, add:

```tsx
{style.parentStyleIds && style.parentStyleIds.length === 1 && (
  <p className="text-[10px] text-muted-foreground/60">Remixed</p>
)}
{style.parentStyleIds && style.parentStyleIds.length === 2 && (
  <p className="text-[10px] text-muted-foreground/60">Blended</p>
)}
```

- [ ] **Step 6: Commit**

```bash
git add src/components/style-card.tsx
git commit -m "feat(styles): 2x2 preview grid and three-dot menu on style cards"
```

### Task 7: Add platform filter tabs and remix/blend dialogs to styles page

**Files:**
- Modify: `src/app/(roks-workspace)/dashboard/styles/page.tsx`

This is the largest task. The page needs:
1. Platform filter tabs at the top
2. Remix dialog (pre-filled create dialog with AI-varied prompt)
3. Blend flow (pick second style dialog → AI blend → pre-filled create dialog)
4. Pass onRemix/onBlend to StyleCard

- [ ] **Step 1: Add new imports and constants**

Add to existing imports:
```typescript
import {
  useRemixStyle,
  useBlendStyles,
} from "@/hooks/use-styles";
import {
  ShuffleIcon,
  MergeIcon,
} from "lucide-react";
```

Add platform constants at top of file:
```typescript
const PLATFORMS = [
  { id: "all", label: "All" },
  { id: "instagram", label: "Instagram" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "x", label: "X" },
  { id: "reddit", label: "Reddit" },
  { id: "blog", label: "Blog" },
  { id: "email", label: "Email" },
] as const;
```

- [ ] **Step 2: Add new state and hooks in component body**

After the existing state declarations, add:

```typescript
const remixStyle = useRemixStyle();
const blendStyles = useBlendStyles();

// Platform filter
const [activePlatform, setActivePlatform] = useState("all");

// Remix state
const [remixOpen, setRemixOpen] = useState(false);
const [remixSourceId, setRemixSourceId] = useState<string | null>(null);
const [remixName, setRemixName] = useState("");
const [remixDescription, setRemixDescription] = useState("");
const [remixPrompt, setRemixPrompt] = useState("");
const [remixPlatforms, setRemixPlatforms] = useState<string[]>([]);
const [remixParentIds, setRemixParentIds] = useState<string[]>([]);

// Blend state
const [blendOpen, setBlendOpen] = useState(false);
const [blendPickerOpen, setBlendPickerOpen] = useState(false);
const [blendFirstId, setBlendFirstId] = useState<string | null>(null);
const [blendName, setBlendName] = useState("");
const [blendDescription, setBlendDescription] = useState("");
const [blendPrompt, setBlendPrompt] = useState("");
const [blendPlatforms, setBlendPlatforms] = useState<string[]>([]);
const [blendParentIds, setBlendParentIds] = useState<string[]>([]);

// Filtered styles
const filteredStyles = styles?.filter((s) =>
  activePlatform === "all" ? true : s.platforms?.includes(activePlatform)
) ?? [];
```

- [ ] **Step 3: Add remix handler**

```typescript
const handleRemix = (styleId: string) => {
  setRemixSourceId(styleId);
  remixStyle.mutate(
    { sourceStyleId: styleId },
    {
      onSuccess: (data) => {
        setRemixName(data.name);
        setRemixDescription(data.description ?? "");
        setRemixPrompt(data.promptText);
        setRemixPlatforms(data.platforms);
        setRemixParentIds(data.parentStyleIds);
        setRemixOpen(true);
      },
    }
  );
};

const handleSaveRemix = () => {
  if (!remixName.trim() || !remixPrompt.trim()) return;
  createStyle.mutate(
    {
      name: remixName,
      description: remixDescription || undefined,
      promptText: remixPrompt,
      platforms: remixPlatforms,
      parentStyleIds: remixParentIds,
    },
    {
      onSuccess: () => {
        toast.success("Remixed style created");
        setRemixOpen(false);
      },
      onError: (err) => toast.error(err.message ?? "Failed to save remix"),
    }
  );
};
```

- [ ] **Step 4: Add blend handlers**

```typescript
const handleBlendStart = (styleId: string) => {
  setBlendFirstId(styleId);
  setBlendPickerOpen(true);
};

const handleBlendSelect = (secondId: string) => {
  if (!blendFirstId) return;
  setBlendPickerOpen(false);
  blendStyles.mutate(
    { styleIdA: blendFirstId, styleIdB: secondId },
    {
      onSuccess: (data) => {
        setBlendName(data.name);
        setBlendDescription(data.description ?? "");
        setBlendPrompt(data.promptText);
        setBlendPlatforms(data.platforms);
        setBlendParentIds(data.parentStyleIds);
        setBlendOpen(true);
      },
    }
  );
};

const handleSaveBlend = () => {
  if (!blendName.trim() || !blendPrompt.trim()) return;
  createStyle.mutate(
    {
      name: blendName,
      description: blendDescription || undefined,
      promptText: blendPrompt,
      platforms: blendPlatforms,
      parentStyleIds: blendParentIds,
    },
    {
      onSuccess: () => {
        toast.success("Blended style created");
        setBlendOpen(false);
      },
      onError: (err) => toast.error(err.message ?? "Failed to save blend"),
    }
  );
};
```

- [ ] **Step 5: Add platform tabs before the style grid**

Insert after the action buttons div and before the error state. This replaces the comment `{/* Error state */}`:

```tsx
{/* Platform filter tabs */}
{!isError && !isLoading && styles && styles.length > 0 && (
  <div className="flex gap-1 overflow-x-auto">
    {PLATFORMS.map((p) => {
      const count = p.id === "all"
        ? styles.length
        : styles.filter((s) => s.platforms?.includes(p.id)).length;
      return (
        <Button
          key={p.id}
          variant={activePlatform === p.id ? "default" : "outline"}
          size="sm"
          onClick={() => setActivePlatform(p.id)}
          className="shrink-0 gap-1.5"
        >
          {p.label}
          <span className="text-xs opacity-60">{count}</span>
        </Button>
      );
    })}
  </div>
)}
```

- [ ] **Step 6: Update style grid to use filteredStyles and pass remix/blend props**

Replace the existing `styles.map(...)` in the grid with `filteredStyles.map(...)`. Update StyleCard usage to pass new handlers:

```tsx
{filteredStyles.map((style) => (
  <div key={style.id}>
    {!style.isPredefined ? (
      <AlertDialog
        open={deleteId === style.id}
        onOpenChange={(open) => setDeleteId(open ? style.id : null)}
      >
        <StyleCard
          style={style}
          onDelete={() => setDeleteId(style.id)}
          onRemix={() => handleRemix(style.id)}
          onBlend={() => handleBlendStart(style.id)}
        />
        {/* ... existing AlertDialogContent ... */}
      </AlertDialog>
    ) : (
      <StyleCard
        style={style}
        onRemix={() => handleRemix(style.id)}
        onBlend={() => handleBlendStart(style.id)}
      />
    )}
  </div>
))}
```

- [ ] **Step 7: Add Remix dialog**

Add after the existing Create Style dialog:

```tsx
{/* Remix Style Dialog */}
<Dialog open={remixOpen} onOpenChange={setRemixOpen}>
  <DialogContent className="max-w-lg">
    <DialogHeader>
      <DialogTitle className="flex items-center gap-2">
        <ShuffleIcon className="size-4" />
        Remix Style
      </DialogTitle>
      <DialogDescription>
        AI generated a variation. Edit before saving.
      </DialogDescription>
    </DialogHeader>
    <div className="space-y-4 mt-2">
      <div className="space-y-2">
        <Label>Name</Label>
        <Input value={remixName} onChange={(e) => setRemixName(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>Description <span className="text-muted-foreground">(optional)</span></Label>
        <Input value={remixDescription} onChange={(e) => setRemixDescription(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>Style Prompt</Label>
        <Textarea
          value={remixPrompt}
          onChange={(e) => setRemixPrompt(e.target.value)}
          rows={5}
          className="resize-none"
        />
      </div>
      <div className="flex gap-2 pt-2">
        <Button variant="outline" onClick={() => setRemixOpen(false)}>
          Cancel
        </Button>
        <Button
          onClick={handleSaveRemix}
          disabled={createStyle.isPending || !remixName.trim() || !remixPrompt.trim()}
          className="flex-1 gap-1.5"
        >
          {createStyle.isPending && <Loader2Icon className="size-3.5 animate-spin" />}
          Save Remix
        </Button>
      </div>
    </div>
  </DialogContent>
</Dialog>
```

- [ ] **Step 8: Add Blend picker dialog and Blend result dialog**

Blend picker (select second style):
```tsx
{/* Blend Picker Dialog */}
<Dialog open={blendPickerOpen} onOpenChange={setBlendPickerOpen}>
  <DialogContent className="max-w-2xl max-h-[80vh]">
    <DialogHeader>
      <DialogTitle className="flex items-center gap-2">
        <MergeIcon className="size-4" />
        Choose Second Style to Blend
      </DialogTitle>
      <DialogDescription>
        Select a style to blend with &ldquo;{styles?.find((s) => s.id === blendFirstId)?.name}&rdquo;.
      </DialogDescription>
    </DialogHeader>
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 overflow-y-auto max-h-[50vh] mt-2">
      {styles
        ?.filter((s) => s.id !== blendFirstId)
        .map((s) => (
          <StyleCard
            key={s.id}
            style={s}
            onSelect={() => handleBlendSelect(s.id)}
          />
        ))}
    </div>
  </DialogContent>
</Dialog>
```

Blend result dialog:
```tsx
{/* Blend Style Dialog */}
<Dialog open={blendOpen} onOpenChange={setBlendOpen}>
  <DialogContent className="max-w-lg">
    <DialogHeader>
      <DialogTitle className="flex items-center gap-2">
        <MergeIcon className="size-4" />
        Blend Styles
      </DialogTitle>
      <DialogDescription>
        AI blended both styles. Edit before saving.
      </DialogDescription>
    </DialogHeader>
    <div className="space-y-4 mt-2">
      <div className="space-y-2">
        <Label>Name</Label>
        <Input value={blendName} onChange={(e) => setBlendName(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>Description <span className="text-muted-foreground">(optional)</span></Label>
        <Input value={blendDescription} onChange={(e) => setBlendDescription(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>Style Prompt</Label>
        <Textarea
          value={blendPrompt}
          onChange={(e) => setBlendPrompt(e.target.value)}
          rows={5}
          className="resize-none"
        />
      </div>
      <div className="flex gap-2 pt-2">
        <Button variant="outline" onClick={() => setBlendOpen(false)}>
          Cancel
        </Button>
        <Button
          onClick={handleSaveBlend}
          disabled={createStyle.isPending || !blendName.trim() || !blendPrompt.trim()}
          className="flex-1 gap-1.5"
        >
          {createStyle.isPending && <Loader2Icon className="size-3.5 animate-spin" />}
          Save Blend
        </Button>
      </div>
    </div>
  </DialogContent>
</Dialog>
```

- [ ] **Step 9: Add loading state for remix/blend operations**

Show a toast when remix or blend AI call starts. After the `handleRemix` function is called, before `remixStyle.mutate`:

```typescript
toast.info("Generating style variation...");
```

Same for `handleBlendSelect`:
```typescript
toast.info("Blending styles...");
```

- [ ] **Step 10: Commit**

```bash
git add src/app/(roks-workspace)/dashboard/styles/page.tsx
git commit -m "feat(styles): platform filter tabs, remix and blend dialogs"
```

### Task 8: Update existing predefined styles in DB with platforms

**Files:**
- Modify: `src/lib/trpc/routers/style.ts` (update the `seed` mutation)

- [ ] **Step 1: Make seed mutation also update existing styles with platforms**

After the existing `createMany` block in the seed mutation, add an upsert loop for existing styles that have empty platforms:

```typescript
// Update existing predefined styles with platform data
const allPredefined = await ctx.prisma.style.findMany({
  where: { isPredefined: true },
  select: { id: true, name: true, platforms: true },
});

const styleMap = new Map(PREDEFINED_STYLES.map((s) => [s.name, s.platforms]));

const updates = allPredefined
  .filter((s) => s.platforms.length === 0 && styleMap.has(s.name))
  .map((s) =>
    ctx.prisma.style.update({
      where: { id: s.id },
      data: { platforms: styleMap.get(s.name)! },
    })
  );

if (updates.length > 0) {
  await Promise.all(updates);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/trpc/routers/style.ts
git commit -m "feat(styles): seed mutation updates existing styles with platform tags"
```

### Task 9: Final integration test

- [ ] **Step 1: Run the dev server and verify**

```bash
bun run dev
```

- [ ] **Step 2: Navigate to styles page, verify:**
- Platform tabs appear with correct counts
- Filtering works when clicking tabs
- Three-dot menu appears on hover for all style cards
- 2x2 grid shows on cards (existing samples + placeholders)
- "Remix" opens loading toast → then remix dialog with AI-varied prompt
- "Blend with..." opens picker → select second style → loading toast → blend dialog
- Saving remix/blend creates new style with lineage info

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat(styles): styles page overhaul - platform tabs, remix, blend, 2x2 preview grid"
```
