"use client";

import { useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useGenerateStore } from "@/stores/use-generate-store";
import { StepNavigator } from "./step-navigator";
import { StepPlatforms } from "./step-platforms";
import { StepContent } from "./step-content";
import { StepOutline } from "./step-outline";
import { StepStyleBrand } from "./step-style-brand";
import { StepSettings } from "./step-settings";
import { StepResults } from "./step-results";
import { Card } from "@/components/ui/card";

const stepComponents = [
  StepPlatforms, // step 1
  StepContent, // step 2
  StepOutline, // step 3
  StepStyleBrand, // step 4
  StepSettings, // step 5
  StepResults, // step 6
];

interface GenerateFlowProps {
  projectId?: string;
  campaignId?: string;
}

export function GenerateFlow({ projectId, campaignId }: GenerateFlowProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { step, setStep, setContext, reset } = useGenerateStore();

  useEffect(() => {
    setContext(projectId ?? null, campaignId ?? null);
    const urlStep = parseInt(searchParams.get("step") ?? "1");
    if (urlStep >= 1 && urlStep <= 6) setStep(urlStep);
    return () => reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("step", String(step));
    router.replace(`?${params.toString()}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const ActiveStep = stepComponents[step - 1] ?? StepPlatforms;

  return (
    <div className="flex flex-1 gap-4 px-4 py-6 lg:px-6">
      <StepNavigator />
      <div className="flex-1 min-w-0">
        <ActiveStep />
      </div>
      <Card className="hidden w-80 shrink-0 p-4 @3xl/main:block">
        <p className="text-sm text-muted-foreground">Preview</p>
        <p className="mt-2 text-xs text-muted-foreground/50">
          Live preview will appear here as you make selections.
        </p>
      </Card>
    </div>
  );
}
