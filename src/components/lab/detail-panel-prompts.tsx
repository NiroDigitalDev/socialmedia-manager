"use client";

import { useState } from "react";
import {
  ChevronDownIcon,
  PencilIcon,
  SaveIcon,
  XIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

interface DetailPanelPromptsProps {
  systemPrompt: string | null;
  contentPrompt: string | null;
  onSave: (systemPrompt: string, contentPrompt: string) => void;
}

export function DetailPanelPrompts({
  systemPrompt,
  contentPrompt,
  onSave,
}: DetailPanelPromptsProps) {
  const [editing, setEditing] = useState(false);
  const [editSystem, setEditSystem] = useState(systemPrompt ?? "");
  const [editContent, setEditContent] = useState(contentPrompt ?? "");

  const handleEdit = () => {
    setEditSystem(systemPrompt ?? "");
    setEditContent(contentPrompt ?? "");
    setEditing(true);
  };

  const handleCancel = () => {
    setEditing(false);
  };

  const handleSave = () => {
    onSave(editSystem, editContent);
    setEditing(false);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Prompts
        </h3>
        {!editing ? (
          <Button variant="ghost" size="sm" className="h-6 px-2" onClick={handleEdit}>
            <PencilIcon className="mr-1 size-3" />
            Edit
          </Button>
        ) : (
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" className="h-6 px-2" onClick={handleCancel}>
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
      />

      {/* Content Prompt */}
      <PromptCollapsible
        label="Content Prompt"
        value={editing ? editContent : (contentPrompt ?? "")}
        editing={editing}
        onChange={setEditContent}
        placeholder="No content prompt"
      />
    </div>
  );
}

function PromptCollapsible({
  label,
  value,
  editing,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  editing: boolean;
  onChange: (v: string) => void;
  placeholder: string;
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
          <Textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="min-h-[80px] text-xs"
            placeholder={`Enter ${label.toLowerCase()}...`}
          />
        ) : (
          <p className="whitespace-pre-wrap rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            {value || placeholder}
          </p>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
