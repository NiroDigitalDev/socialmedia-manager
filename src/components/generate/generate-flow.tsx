"use client";

import { useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useGenerateStore } from "@/stores/use-generate-store";
import { StepNavigator } from "./step-navigator";
import { StepContent } from "./step-content";
import { StepStyle } from "./step-style";
import { StepOutline } from "./step-outline";
import { StepSettings } from "./step-settings";
import { StepResults } from "./step-results";

const stepComponents = [
  StepContent,   // step 1
  StepStyle,     // step 2
  StepOutline,   // step 3
  StepSettings,  // step 4
  StepResults,   // step 5
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
    if (urlStep >= 1 && urlStep <= 5) setStep(urlStep);
    return () => reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("step", String(step));
    router.replace(`?${params.toString()}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const ActiveStep = stepComponents[step - 1] ?? StepContent;

  return (
    <div className="flex flex-1 gap-4 px-4 py-6 lg:px-6">
      <StepNavigator />
      <div className="flex-1 min-w-0">
        <ActiveStep />
      </div>
    </div>
  );
}
