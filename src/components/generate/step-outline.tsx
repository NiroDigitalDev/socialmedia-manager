"use client";

import { useEffect, useState } from "react";
import {
  useGenerateStore,
  type OutlineSection,
  type Platform,
} from "@/stores/use-generate-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { RefreshCwIcon, PencilIcon, CheckIcon } from "lucide-react";
import { toast } from "sonner";

const platformLabels: Record<Platform, string> = {
  instagram: "Instagram",
  linkedin: "LinkedIn",
  reddit: "Reddit",
  x: "X",
  blog: "Blog",
  email: "Email",
};

function generateMockOutline(platforms: Platform[]): OutlineSection[] {
  const sections: OutlineSection[] = [];
  let order = 0;

  for (const platform of platforms) {
    const templates = getMockSections(platform);
    for (const template of templates) {
      sections.push({
        id: `${platform}-${order}`,
        platform,
        label: template.label,
        content: template.content,
        order: order++,
      });
    }
  }

  return sections;
}

function getMockSections(
  platform: Platform
): { label: string; content: string }[] {
  switch (platform) {
    case "instagram":
      return [
        { label: "Hook", content: "Eye-catching opening line to stop the scroll" },
        { label: "Body", content: "Main message with key points and value proposition" },
        { label: "Call to Action", content: "Engagement prompt — save, share, or comment" },
        { label: "Hashtags", content: "#relevant #hashtags #foryourpost" },
      ];
    case "linkedin":
      return [
        { label: "Opening Hook", content: "Professional insight or bold statement" },
        { label: "Story / Context", content: "Background and relevant experience" },
        { label: "Key Takeaways", content: "3-5 actionable insights or lessons" },
        { label: "Closing CTA", content: "Ask a question or invite discussion" },
      ];
    case "reddit":
      return [
        { label: "Title", content: "Clear, descriptive post title" },
        { label: "Context", content: "Background information and setup" },
        { label: "Main Content", content: "Detailed explanation or discussion points" },
      ];
    case "x":
      return [
        { label: "Main Tweet", content: "Concise, punchy message (280 chars)" },
        { label: "Thread Follow-up", content: "Additional context or details" },
        { label: "Engagement Hook", content: "Question or call to action" },
      ];
    case "blog":
      return [
        { label: "Title & Subtitle", content: "SEO-friendly title with compelling subtitle" },
        { label: "Introduction", content: "Hook the reader and preview the value" },
        { label: "Main Sections", content: "3-5 key sections with subheadings" },
        { label: "Conclusion", content: "Summary and next steps for the reader" },
      ];
    case "email":
      return [
        { label: "Subject Line", content: "Open-worthy subject line with preview text" },
        { label: "Opening", content: "Personal greeting and hook" },
        { label: "Body", content: "Core message with clear value" },
        { label: "CTA Button", content: "Single clear call to action" },
      ];
  }
}

export function StepOutline() {
  const { platforms, outline, setOutline, updateOutlineSection, setStep } =
    useGenerateStore();

  useEffect(() => {
    if (!outline && platforms.length > 0) {
      setOutline(generateMockOutline(platforms));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [editingId, setEditingId] = useState<string | null>(null);

  const sectionsByPlatform = (outline ?? []).reduce(
    (acc, section) => {
      if (!acc[section.platform]) acc[section.platform] = [];
      acc[section.platform].push(section);
      return acc;
    },
    {} as Record<Platform, OutlineSection[]>
  );

  const handleRegenerate = (platform: Platform) => {
    toast.info("AI outline generation coming soon", {
      description: `Regenerate for ${platformLabels[platform]} will use AI in a future update.`,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Review the plan</h2>
        <p className="text-sm text-muted-foreground">
          Edit the outline for each platform. Click any section to modify it.
        </p>
      </div>

      <div className="space-y-6">
        {platforms.map((platform) => (
          <div key={platform} className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-medium">
                  {platformLabels[platform]}
                </h3>
                <Badge variant="secondary">
                  {sectionsByPlatform[platform]?.length ?? 0} sections
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleRegenerate(platform)}
                className="gap-1.5"
              >
                <RefreshCwIcon className="size-3.5" />
                Regenerate
              </Button>
            </div>

            <div className="space-y-2">
              {(sectionsByPlatform[platform] ?? []).map((section) => {
                const isEditing = editingId === section.id;
                return (
                  <Card key={section.id} size="sm">
                    <CardHeader className="pb-0">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          {section.label}
                        </CardTitle>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="size-6 p-0"
                          onClick={() =>
                            setEditingId(isEditing ? null : section.id)
                          }
                        >
                          {isEditing ? (
                            <CheckIcon className="size-3" />
                          ) : (
                            <PencilIcon className="size-3" />
                          )}
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {isEditing ? (
                        <Textarea
                          value={section.content}
                          onChange={(e) =>
                            updateOutlineSection(section.id, e.target.value)
                          }
                          rows={3}
                          className="resize-none text-sm"
                          autoFocus
                        />
                      ) : (
                        <p
                          className={cn(
                            "text-sm cursor-pointer rounded px-1 -mx-1 py-0.5 hover:bg-muted/50 transition-colors",
                            !section.content && "text-muted-foreground italic"
                          )}
                          onClick={() => setEditingId(section.id)}
                        >
                          {section.content || "Click to add content..."}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <Button variant="outline" onClick={() => setStep(2)}>
          Back
        </Button>
        <Button onClick={() => setStep(4)}>Continue</Button>
      </div>
    </div>
  );
}
