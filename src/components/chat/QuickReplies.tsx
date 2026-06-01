"use client";

import { Button } from "@/components/ui/button";

export function QuickReplies({
  options,
  onPick,
  disabled,
}: {
  options: string[];
  onPick: (text: string) => void;
  disabled: boolean;
}) {
  if (options.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <Button
          key={opt}
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => onPick(opt)}
        >
          {opt}
        </Button>
      ))}
    </div>
  );
}
