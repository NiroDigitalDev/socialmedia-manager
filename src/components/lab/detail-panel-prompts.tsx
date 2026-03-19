"use client";

import { useState, useCallback } from "react";
import {
  ChevronDownIcon,
  PencilIcon,
  SaveIcon,
  XIcon,
  SparklesIcon,
  SendIcon,
  CopyPlusIcon,
  Loader2Icon,
  CheckIcon,
  UndoIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useTweakPrompt, useDuplicateNode, useUpdateNode } from "@/hooks/use-lab";
import { useLabStore } from "@/stores/use-lab-store";

interface DetailPanelPromptsProps {
  nodeId: string;
  systemPrompt: string | null;
  contentPrompt: string | null;
  onSave: (systemPrompt: string, contentPrompt: string) => void;
}

export function DetailPanelPrompts({
  nodeId,
  systemPrompt,
  contentPrompt,
  onSave,
}: DetailPanelPromptsProps) {
  const [editing, setEditing] = useState(false);
  const [editSystem, setEditSystem] = useState(systemPrompt ?? "");
  const [editContent, setEditContent] = useState(contentPrompt ?? "");

  // AI tweak state per prompt field
  const [tweakedSystem, setTweakedSystem] = useState<string | null>(null);
  const [tweakedContent, setTweakedContent] = useState<string | null>(null);

  const duplicateNode = useDuplicateNode();
  const updateNode = useUpdateNode();
  const selectNode = useLabStore((s) => s.selectNode);

  const handleEdit = () => {
    setEditSystem(systemPrompt ?? "");
    setEditContent(contentPrompt ?? "");
    setTweakedSystem(null);
    setTweakedContent(null);
    setEditing(true);
  };

  const handleCancel = () => {
    setTweakedSystem(null);
    setTweakedContent(null);
    setEditing(false);
  };

  const handleSave = () => {
    onSave(editSystem, editContent);
    setTweakedSystem(null);
    setTweakedContent(null);
    setEditing(false);
  };

  const handleApplyTweak = useCallback(
    (field: "system" | "content") => {
      if (field === "system" && tweakedSystem !== null) {
        setEditSystem(tweakedSystem);
        setTweakedSystem(null);
      } else if (field === "content" && tweakedContent !== null) {
        setEditContent(tweakedContent);
        setTweakedContent(null);
      }
    },
    [tweakedSystem, tweakedContent]
  );

  const handleDiscardTweak = useCallback((field: "system" | "content") => {
    if (field === "system") setTweakedSystem(null);
    else setTweakedContent(null);
  }, []);

  const handleTweakResult = useCallback(
    (field: "system" | "content", result: string) => {
      if (field === "system") setTweakedSystem(result);
      else setTweakedContent(result);
    },
    []
  );

  // Check if prompts have been modified
  const hasChanges =
    editSystem !== (systemPrompt ?? "") ||
    editContent !== (contentPrompt ?? "");

  const handleSaveAndRegenerate = () => {
    if (!hasChanges) {
      toast.info("No prompt changes to save");
      return;
    }

    duplicateNode.mutate(
      { nodeId },
      {
        onSuccess: (duplicate) => {
          // Update the duplicate with the edited prompts
          updateNode.mutate(
            {
              nodeId: duplicate.id,
              systemPrompt: editSystem || null,
              contentPrompt: editContent || null,
            },
            {
              onSuccess: () => {
                // Auto-select the new node so the user sees it in the detail panel
                selectNode(duplicate.id);
                toast.success(
                  "Sibling created with updated prompts — generate from the detail panel"
                );
                setTweakedSystem(null);
                setTweakedContent(null);
                setEditing(false);
              },
            }
          );
        },
      }
    );
  };

  const isSaveAndRegenerateLoading =
    duplicateNode.isPending || updateNode.isPending;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Prompts
        </h3>
        {!editing ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2"
            onClick={handleEdit}
          >
            <PencilIcon className="mr-1 size-3" />
            Edit
          </Button>
        ) : (
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2"
              onClick={handleCancel}
            >
              <XIcon className="mr-1 size-3" />
              Cancel
            </Button>
            <Button size="sm" className="h-6 px-2" onClick={handleSave}>
              <SaveIcon className="mr-1 size-3" />
              Save
            </Button>
          </div>
        )}
      </div>

      {/* System Prompt */}
      <PromptCollapsible
        label="System Prompt"
        value={editing ? editSystem : (systemPrompt ?? "")}
        editing={editing}
        onChange={setEditSystem}
        placeholder="No system prompt"
        tweakedValue={tweakedSystem}
        onApplyTweak={() => handleApplyTweak("system")}
        onDiscardTweak={() => handleDiscardTweak("system")}
        onTweakResult={(result) => handleTweakResult("system", result)}
        field="system"
      />

      {/* Content Prompt */}
      <PromptCollapsible
        label="Content Prompt"
        value={editing ? editContent : (contentPrompt ?? "")}
        editing={editing}
        onChange={setEditContent}
        placeholder="No content prompt"
        tweakedValue={tweakedContent}
        onApplyTweak={() => handleApplyTweak("content")}
        onDiscardTweak={() => handleDiscardTweak("content")}
        onTweakResult={(result) => handleTweakResult("content", result)}
        field="content"
      />

      {/* Save & Regenerate button — only in edit mode with changes */}
      {editing && hasChanges && (
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={handleSaveAndRegenerate}
          disabled={isSaveAndRegenerateLoading}
        >
          {isSaveAndRegenerateLoading ? (
            <Loader2Icon className="mr-1.5 size-3.5 animate-spin" />
          ) : (
            <CopyPlusIcon className="mr-1.5 size-3.5" />
          )}
          Save & Regenerate as Sibling
        </Button>
      )}
    </div>
  );
}

// ── AI Tweak Input ────────────────────────────────────────────────

function AiTweakInput({
  currentPrompt,
  onResult,
}: {
  currentPrompt: string;
  onResult: (tweaked: string) => void;
}) {
  const [instruction, setInstruction] = useState("");
  const tweakPrompt = useTweakPrompt();

  const handleSubmit = () => {
    const trimmed = instruction.trim();
    if (!trimmed) return;
    if (!currentPrompt) {
      toast.error("No prompt to tweak — enter a prompt first");
      return;
    }

    tweakPrompt.mutate(
      { currentPrompt, instruction: trimmed },
      {
        onSuccess: (data) => {
          onResult(data.prompt);
          setInstruction("");
        },
      }
    );
  };

  return (
    <div className="flex items-center gap-1.5 pt-1.5">
      <SparklesIcon className="size-3.5 shrink-0 text-amber-500" />
      <Input
        value={instruction}
        onChange={(e) => setInstruction(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
          }
        }}
        placeholder="AI tweak: e.g. make it more concise..."
        className="h-7 text-xs"
        disabled={tweakPrompt.isPending}
      />
      <Button
        variant="ghost"
        size="icon"
        className="size-7 shrink-0"
        onClick={handleSubmit}
        disabled={tweakPrompt.isPending || !instruction.trim()}
      >
        {tweakPrompt.isPending ? (
          <Loader2Icon className="size-3.5 animate-spin" />
        ) : (
          <SendIcon className="size-3.5" />
        )}
      </Button>
    </div>
  );
}

// ── Tweaked Prompt Preview (diff highlighting) ─────────────────────

function TweakedPromptPreview({
  original,
  tweaked,
  onApply,
  onDiscard,
}: {
  original: string;
  tweaked: string;
  onApply: () => void;
  onDiscard: () => void;
}) {
  const originalWords = original.split(/(\s+)/);
  const tweakedWords = tweaked.split(/(\s+)/);

  return (
    <div className="space-y-2 pt-1">
      <div className="flex items-center gap-1.5">
        <SparklesIcon className="size-3 text-amber-500" />
        <span className="text-[10px] font-medium uppercase tracking-wider text-amber-600 dark:text-amber-400">
          AI Suggestion
        </span>
      </div>
      <div className="rounded-md border border-amber-300 bg-amber-50/50 p-2.5 text-xs leading-relaxed dark:border-amber-700 dark:bg-amber-950/30">
        {diffHighlight(originalWords, tweakedWords)}
      </div>
      <div className="flex gap-1.5">
        <Button
          size="sm"
          className="h-6 px-2 text-xs"
          onClick={onApply}
        >
          <CheckIcon className="mr-1 size-3" />
          Apply
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs"
          onClick={onDiscard}
        >
          <UndoIcon className="mr-1 size-3" />
          Discard
        </Button>
      </div>
    </div>
  );
}

/**
 * Simple word-level diff highlighting.
 * Splits both strings into word/whitespace tokens and highlights tokens
 * in the tweaked version that differ from the original.
 */
function diffHighlight(originalTokens: string[], tweakedTokens: string[]) {
  // Build a set to quickly look up which indices differ
  const maxLen = Math.max(originalTokens.length, tweakedTokens.length);
  const result: React.ReactNode[] = [];

  for (let i = 0; i < tweakedTokens.length; i++) {
    const token = tweakedTokens[i];
    const isWhitespace = /^\s+$/.test(token);

    if (isWhitespace) {
      result.push(token);
      continue;
    }

    const isDifferent = i >= originalTokens.length || token !== originalTokens[i];
    if (isDifferent) {
      result.push(
        <mark
          key={i}
          className="rounded-sm bg-amber-200 px-0.5 dark:bg-amber-800/60 dark:text-amber-100"
        >
          {token}
        </mark>
      );
    } else {
      result.push(token);
    }
  }

  // Show removed trailing words from original
  if (originalTokens.length > tweakedTokens.length) {
    for (let i = tweakedTokens.length; i < maxLen; i++) {
      const token = originalTokens[i];
      if (/^\s+$/.test(token)) continue;
      result.push(
        <mark
          key={`del-${i}`}
          className="rounded-sm bg-red-200 px-0.5 line-through dark:bg-red-800/60 dark:text-red-100"
        >
          {token}
        </mark>
      );
    }
  }

  return result;
}

// ── Collapsible Prompt Section ────────────────────────────────────

function PromptCollapsible({
  label,
  value,
  editing,
  onChange,
  placeholder,
  tweakedValue,
  onApplyTweak,
  onDiscardTweak,
  onTweakResult,
  field,
}: {
  label: string;
  value: string;
  editing: boolean;
  onChange: (v: string) => void;
  placeholder: string;
  tweakedValue: string | null;
  onApplyTweak: () => void;
  onDiscardTweak: () => void;
  onTweakResult: (result: string) => void;
  field: "system" | "content";
}) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm hover:bg-accent/50 transition-colors"
        >
          <span className="text-xs font-medium">{label}</span>
          <ChevronDownIcon
            className={cn(
              "size-3.5 text-muted-foreground transition-transform",
              open && "rotate-180"
            )}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-1 pt-1.5">
        {editing ? (
          <div className="space-y-0">
            <Textarea
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className={cn(
                "min-h-[80px] text-xs",
                tweakedValue !== null && "border-amber-300 dark:border-amber-700"
              )}
              placeholder={`Enter ${label.toLowerCase()}...`}
            />

            {/* AI tweak preview */}
            {tweakedValue !== null && (
              <TweakedPromptPreview
                original={value}
                tweaked={tweakedValue}
                onApply={onApplyTweak}
                onDiscard={onDiscardTweak}
              />
            )}

            {/* AI tweak input */}
            {tweakedValue === null && (
              <AiTweakInput
                currentPrompt={value}
                onResult={onTweakResult}
              />
            )}
          </div>
        ) : (
          <p className="whitespace-pre-wrap rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            {value || placeholder}
          </p>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
