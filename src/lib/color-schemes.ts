export interface ColorScheme {
  id: string;
  name: string;
  accent: string;
  bg: string;
}

export const COLOR_SCHEME_PRESETS: ColorScheme[] = [
  { id: "ocean-blue", name: "Ocean Blue", accent: "#2563EB", bg: "#0F172A" },
  { id: "sunset-orange", name: "Sunset Orange", accent: "#F97316", bg: "#1C1917" },
  { id: "forest-green", name: "Forest Green", accent: "#22C55E", bg: "#052E16" },
  { id: "royal-purple", name: "Royal Purple", accent: "#A855F7", bg: "#1E1B2E" },
  { id: "rose-pink", name: "Rose Pink", accent: "#EC4899", bg: "#1A0A14" },
  { id: "golden-luxury", name: "Golden Luxury", accent: "#EAB308", bg: "#18181B" },
  { id: "arctic-teal", name: "Arctic Teal", accent: "#14B8A6", bg: "#0D1B1E" },
  { id: "crimson-red", name: "Crimson Red", accent: "#EF4444", bg: "#1C1215" },
  { id: "electric-indigo", name: "Electric Indigo", accent: "#6366F1", bg: "#0F0F23" },
  { id: "coral-peach", name: "Coral & Peach", accent: "#FB923C", bg: "#FFF7ED" },
  { id: "mint-fresh", name: "Mint Fresh", accent: "#34D399", bg: "#F0FDF4" },
  { id: "slate-minimal", name: "Slate Minimal", accent: "#64748B", bg: "#FFFFFF" },
];
