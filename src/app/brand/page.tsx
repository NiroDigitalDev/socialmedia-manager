"use client";

import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { Trash2, Plus, Loader2 } from "lucide-react";

interface BrandSettings {
  id: string;
  brandName: string;
  colors: string[];
  tagline: string | null;
  logoUrl: string | null;
  updatedAt: string;
  createdAt: string;
}

interface BrandPalette {
  id: string;
  name: string;
  accentColor: string;
  bgColor: string;
  createdAt: string;
}

export default function BrandPage() {
  const [brandName, setBrandName] = useState("");
  const [colors, setColors] = useState<string[]>([]);
  const [tagline, setTagline] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [newColor, setNewColor] = useState("#000000");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Palettes
  const [palettes, setPalettes] = useState<BrandPalette[]>([]);
  const [paletteName, setPaletteName] = useState("");
  const [paletteAccent, setPaletteAccent] = useState("#2563EB");
  const [paletteBg, setPaletteBg] = useState("#0F172A");
  const [savingPalette, setSavingPalette] = useState(false);

  useEffect(() => {
    fetchBrand();
    fetchPalettes();
  }, []);

  async function fetchBrand() {
    try {
      const res = await fetch("/api/brand");
      const data: BrandSettings | null = await res.json();
      if (data) {
        setBrandName(data.brandName);
        setColors(data.colors);
        setTagline(data.tagline || "");
        setLogoUrl(data.logoUrl);
      }
    } catch {
      toast.error("Failed to load brand settings");
    } finally {
      setLoading(false);
    }
  }

  async function fetchPalettes() {
    try {
      const res = await fetch("/api/brand/palettes");
      if (res.ok) {
        setPalettes(await res.json());
      }
    } catch {
      // silent
    }
  }

  async function handleSave() {
    if (!brandName.trim()) {
      toast.error("Brand name is required");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/brand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandName, colors, tagline }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }

      toast.success("Brand settings saved successfully");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save brand settings"
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("logo", file);

      const res = await fetch("/api/brand/logo", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to upload logo");
      }

      const data = await res.json();
      setLogoUrl(data.url);
      toast.success("Logo uploaded successfully");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to upload logo"
      );
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  function addColor() {
    if (colors.includes(newColor)) {
      toast.error("This color has already been added");
      return;
    }
    setColors([...colors, newColor]);
    setNewColor("#000000");
  }

  function removeColor(index: number) {
    setColors(colors.filter((_, i) => i !== index));
  }

  async function handleSavePalette() {
    if (!paletteName.trim()) {
      toast.error("Please enter a palette name");
      return;
    }

    setSavingPalette(true);
    try {
      const res = await fetch("/api/brand/palettes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: paletteName,
          accentColor: paletteAccent,
          bgColor: paletteBg,
        }),
      });

      if (!res.ok) throw new Error("Failed to save palette");

      const palette = await res.json();
      setPalettes((prev) => [palette, ...prev]);
      setPaletteName("");
      setPaletteAccent("#2563EB");
      setPaletteBg("#0F172A");
      toast.success("Color palette saved");
    } catch {
      toast.error("Failed to save color palette");
    } finally {
      setSavingPalette(false);
    }
  }

  async function handleDeletePalette(id: string) {
    try {
      const res = await fetch(`/api/brand/palettes/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");
      setPalettes((prev) => prev.filter((p) => p.id !== id));
      toast.success("Palette deleted");
    } catch {
      toast.error("Failed to delete palette");
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto max-w-2xl py-10">
        <p className="text-muted-foreground">Loading brand settings...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-2xl py-10 px-4 page-enter">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Brand Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage your brand identity and visual settings.
        </p>
      </div>

      <div className="space-y-6">
        {/* Logo Section */}
        <Card>
          <CardHeader>
            <CardTitle>Logo</CardTitle>
            <CardDescription>
              Upload your brand logo. Recommended size: 512x512px.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt="Brand logo"
                  className="h-24 w-24 rounded-xl border object-contain"
                />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-xl border border-dashed">
                  <span className="text-xs text-muted-foreground">
                    No logo
                  </span>
                </div>
              )}
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? "Uploading..." : "Upload Logo"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Separator />

        {/* Brand Details */}
        <Card>
          <CardHeader>
            <CardTitle>Brand Details</CardTitle>
            <CardDescription>
              Set your brand name and tagline.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="brandName">Brand Name</Label>
              <Input
                id="brandName"
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                placeholder="Enter your brand name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tagline">Tagline</Label>
              <Textarea
                id="tagline"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                placeholder="Enter a short tagline for your brand"
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        <Separator />

        {/* Brand Colors */}
        <Card>
          <CardHeader>
            <CardTitle>Brand Colors</CardTitle>
            <CardDescription>
              Define your brand color palette using hex values.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-end gap-3">
              <div className="space-y-2">
                <Label htmlFor="colorPicker">Pick a Color</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    id="colorPicker"
                    value={newColor}
                    onChange={(e) => setNewColor(e.target.value)}
                    className="h-10 w-10 cursor-pointer rounded border p-0.5"
                  />
                  <Input
                    value={newColor}
                    onChange={(e) => setNewColor(e.target.value)}
                    placeholder="#000000"
                    className="w-32"
                  />
                </div>
              </div>
              <Button variant="outline" onClick={addColor}>
                Add Color
              </Button>
            </div>

            {colors.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2">
                {colors.map((color, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 rounded-full border px-3 py-1.5"
                  >
                    <div
                      className="h-5 w-5 rounded-full border"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-sm font-mono">{color}</span>
                    <button
                      type="button"
                      onClick={() => removeColor(index)}
                      className="ml-1 text-muted-foreground hover:text-destructive text-sm"
                      aria-label={`Remove color ${color}`}
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            )}

            {colors.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No colors added yet. Use the picker above to add brand colors.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        </div>

        <Separator />

        {/* Color Palettes */}
        <Card>
          <CardHeader>
            <CardTitle>Color Palettes</CardTitle>
            <CardDescription>
              Create named color palettes (accent + background) to quickly select in the Generate page.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Create new palette */}
            <div className="space-y-4 rounded-xl border border-dashed p-4">
              <div className="space-y-2">
                <Label htmlFor="paletteName">Palette Name</Label>
                <Input
                  id="paletteName"
                  value={paletteName}
                  onChange={(e) => setPaletteName(e.target.value)}
                  placeholder="e.g., Summer Campaign, Product Launch..."
                />
              </div>
              <div className="flex gap-6">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Accent Color</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={paletteAccent}
                      onChange={(e) => setPaletteAccent(e.target.value)}
                      className="h-8 w-8 cursor-pointer rounded-full border border-border bg-transparent p-0 [&::-webkit-color-swatch-wrapper]:p-0.5 [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-none"
                    />
                    <span className="text-xs text-muted-foreground font-mono">{paletteAccent}</span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Background Color</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={paletteBg}
                      onChange={(e) => setPaletteBg(e.target.value)}
                      className="h-8 w-8 cursor-pointer rounded-full border border-border bg-transparent p-0 [&::-webkit-color-swatch-wrapper]:p-0.5 [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-none"
                    />
                    <span className="text-xs text-muted-foreground font-mono">{paletteBg}</span>
                  </div>
                </div>
              </div>

              {/* Preview */}
              <div
                className="rounded-xl p-4 flex items-center gap-3"
                style={{ backgroundColor: paletteBg }}
              >
                <div
                  className="rounded-full px-4 py-1.5 text-xs font-medium"
                  style={{ backgroundColor: paletteAccent, color: paletteBg }}
                >
                  Accent
                </div>
                <span className="text-xs font-medium" style={{ color: paletteAccent }}>
                  Preview Text
                </span>
              </div>

              <Button
                onClick={handleSavePalette}
                disabled={savingPalette || !paletteName.trim()}
                className="w-full"
              >
                {savingPalette ? (
                  <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Saving...</>
                ) : (
                  <><Plus className="h-4 w-4 mr-1" />Save Palette</>
                )}
              </Button>
            </div>

            {/* Saved palettes list */}
            {palettes.length > 0 && (
              <div className="space-y-3">
                <Label className="text-sm font-medium">Saved Palettes</Label>
                <div className="grid gap-3 sm:grid-cols-2">
                  {palettes.map((palette) => (
                    <div
                      key={palette.id}
                      className="rounded-xl border p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium truncate">
                          {palette.name}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleDeletePalette(palette.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                      </div>
                      <div
                        className="rounded-lg p-3 flex items-center gap-2"
                        style={{ backgroundColor: palette.bgColor }}
                      >
                        <div
                          className="h-5 w-5 rounded-full border border-white/20 shrink-0"
                          style={{ backgroundColor: palette.accentColor }}
                        />
                        <span
                          className="text-xs font-mono"
                          style={{ color: palette.accentColor }}
                        >
                          {palette.accentColor}
                        </span>
                        <div
                          className="h-5 w-5 rounded-full border border-white/20 shrink-0 ml-auto"
                          style={{ backgroundColor: palette.bgColor, borderColor: palette.accentColor + "40" }}
                        />
                        <span
                          className="text-xs font-mono"
                          style={{ color: palette.accentColor }}
                        >
                          {palette.bgColor}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {palettes.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-2">
                No palettes saved yet. Create one above to use in the Generate page.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
