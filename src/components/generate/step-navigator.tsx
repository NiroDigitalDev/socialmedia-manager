"use client";

import { useGenerateStore } from "@/stores/use-generate-store";
import { cn } from "@/lib/utils";
import { CheckIcon } from "lucide-react";

const steps = [
  { number: 1, title: "Content", description: "What's it about?" },
  { number: 2, title: "Style", description: "How should it look?" },
  { number: 3, title: "Outline", description: "Review the plan" },
  { number: 4, title: "Settings", description: "Final configuration" },
  { number: 5, title: "Results", description: "Your content" },
];

export function StepNavigator() {
  const { step, maxCompletedStep, setStep } = useGenerateStore();

  return (
    <nav className="w-56 shrink-0 space-y-1">
      {steps.map((s) => {
        const isActive = step === s.number;
        const isCompleted = s.number <= maxCompletedStep;
        const isClickable = s.number <= maxCompletedStep + 1;

        return (
          <button
            key={s.number}
            onClick={() => isClickable && setStep(s.number)}
            disabled={!isClickable}
            className={cn(
              "flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left transition-colors",
              isActive && "bg-muted",
              isClickable && !isActive && "hover:bg-muted/50",
              !isClickable && "opacity-40 cursor-not-allowed"
            )}
          >
            <div
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium mt-0.5",
                isCompleted && !isActive && "bg-primary text-primary-foreground",
                isActive && "bg-primary text-primary-foreground",
                !isCompleted && !isActive && "border border-muted-foreground/30 text-muted-foreground"
              )}
            >
              {isCompleted && !isActive ? (
                <CheckIcon className="size-3.5" />
              ) : (
                s.number
              )}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium">{s.title}</div>
              <div className="text-xs text-muted-foreground truncate">
                {s.description}
              </div>
            </div>
          </button>
        );
      })}
    </nav>
  );
}
