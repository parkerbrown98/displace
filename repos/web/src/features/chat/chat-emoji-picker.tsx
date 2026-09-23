"use client";

import * as PopoverPrimitive from "@radix-ui/react-popover";
import type { EmojiClickData } from "emoji-picker-react";
import { Smile } from "lucide-react";
import dynamic from "next/dynamic";
import { useState } from "react";

const EmojiPicker = dynamic(() => import("emoji-picker-react"), { ssr: false });

export function ChatEmojiPicker({ onSelect }: { onSelect: (emoji: string) => void }) {
  const [open, setOpen] = useState(false);

  function selectEmoji(emoji: EmojiClickData) {
    onSelect(emoji.emoji);
    setOpen(false);
  }

  return <PopoverPrimitive.Root onOpenChange={setOpen} open={open}>
    <PopoverPrimitive.Trigger asChild><button className="icon-button chat-emoji-trigger" title="Add emoji" type="button"><Smile aria-hidden="true" size={19} /><span className="sr-only">Add emoji</span></button></PopoverPrimitive.Trigger>
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content align="end" className="chat-emoji-popover" side="top" sideOffset={8}>
        <EmojiPicker height={360} lazyLoadEmojis onEmojiClick={selectEmoji} previewConfig={{ showPreview: false }} searchPlaceHolder="Search emoji" skinTonesDisabled width={320} />
        <PopoverPrimitive.Arrow className="chat-emoji-arrow" />
      </PopoverPrimitive.Content>
    </PopoverPrimitive.Portal>
  </PopoverPrimitive.Root>;
}
