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

interface BrandSettings {
  id: string;
  brandName: string;
  colors: string[];
  tagline: string | null;
  logoUrl: string | null;
  updatedAt: string;
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

  useEffect(() => {
    fetchBrand();
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
      </div>
    </div>
  );
}
