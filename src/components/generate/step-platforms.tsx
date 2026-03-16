"use client";

import { useGenerateStore, type Platform } from "@/stores/use-generate-store";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  InstagramIcon,
  LinkedinIcon,
  MessageSquareIcon,
  TwitterIcon,
  BookOpenIcon,
  MailIcon,
} from "lucide-react";

const platforms: {
  id: Platform;
  name: string;
  hint: string;
  icon: React.ElementType;
}[] = [
  {
    id: "instagram",
    name: "Instagram",
    hint: "Image-first, caption",
    icon: InstagramIcon,
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    hint: "Text-heavy, optional image",
    icon: LinkedinIcon,
  },
  {
    id: "reddit",
    name: "Reddit",
    hint: "Text or image post",
    icon: MessageSquareIcon,
  },
  {
    id: "x",
    name: "X",
    hint: "Short text, optional image",
    icon: TwitterIcon,
  },
  {
    id: "blog",
    name: "Blog",
    hint: "Long-form, markdown",
    icon: BookOpenIcon,
  },
  {
    id: "email",
    name: "Email",
    hint: "Newsletter / marketing",
    icon: MailIcon,
  },
];

export function StepPlatforms() {
  const { platforms: selected, setPlatforms, setStep } = useGenerateStore();

  const toggle = (id: Platform) => {
    setPlatforms(
      selected.includes(id)
        ? selected.filter((p) => p !== id)
        : [...selected, id]
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">What are you creating?</h2>
        <p className="text-sm text-muted-foreground">
          Select one or more platforms.
        </p>
      </div>
      <div className="grid gap-3 @lg/main:grid-cols-2 @3xl/main:grid-cols-3">
        {platforms.map((p) => {
          const isSelected = selected.includes(p.id);
          return (
            <Card
              key={p.id}
              onClick={() => toggle(p.id)}
              className={cn(
                "cursor-pointer p-4 transition-all",
                isSelected
                  ? "ring-2 ring-primary bg-primary/5"
                  : "hover:bg-muted/50"
              )}
            >
              <div className="flex items-center gap-3">
                <p.icon className="size-5 shrink-0" />
                <div>
                  <div className="text-sm font-medium">{p.name}</div>
                  <div className="text-xs text-muted-foreground">{p.hint}</div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
      <Button
        onClick={() => setStep(2)}
        disabled={selected.length === 0}
        className="w-full @lg/main:w-auto"
      >
        Continue
      </Button>
    </div>
  );
}
