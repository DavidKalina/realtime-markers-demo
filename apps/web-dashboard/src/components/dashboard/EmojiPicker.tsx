"use client";

import React, { useState } from "react";
import EmojiPickerReact from "emoji-picker-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Smile } from "lucide-react";

interface EmojiPickerProps {
  selectedEmoji?: string;
  onEmojiSelect: (emoji: string) => void;
  className?: string;
}

export function EmojiPicker({
  selectedEmoji,
  onEmojiSelect,
  className = "",
}: EmojiPickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleEmojiSelect = (emojiObject: any) => {
    onEmojiSelect(emojiObject.emoji);
    setIsOpen(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={`h-10 w-10 p-0 ${className}`}
          type="button"
        >
          {selectedEmoji ? (
            <span className="text-lg">{selectedEmoji}</span>
          ) : (
            <Smile className="h-4 w-4" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <EmojiPickerReact
          onEmojiClick={handleEmojiSelect}
          autoFocusSearch={false}
          searchPlaceholder="Search emoji..."
          width={350}
          height={400}
        />
      </PopoverContent>
    </Popover>
  );
}
