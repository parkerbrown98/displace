"use client";

import * as PopoverPrimitive from "@radix-ui/react-popover";
import { Check, ChevronDown } from "lucide-react";
import { useState } from "react";

const colors = ["#2563eb", "#0891b2", "#059669", "#65a30d", "#ca8a04", "#ea580c", "#dc2626", "#db2777", "#7c3aed", "#475569"];

export function ColorPicker({ defaultValue = colors[0], label, name }: { defaultValue?: string; label: string; name: string }) {
  const [color, setColor] = useState(normalizeColor(defaultValue) ?? colors[0]);
  const [draft, setDraft] = useState(color);

  function commit(value: string) {
    const next = normalizeColor(value);
    if (!next) return;
    setColor(next);
    setDraft(next);
  }

  return <label className="form-field color-picker-field">
    {label}
    <PopoverPrimitive.Root>
      <PopoverPrimitive.Trigger className="color-picker-trigger" type="button">
        <span aria-hidden="true" className="color-picker-preview" style={{ backgroundColor: color }} />
        <span>{color.toUpperCase()}</span>
        <ChevronDown aria-hidden="true" size={15} />
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content align="start" className="color-picker-content" sideOffset={6}>
          <div className="color-picker-swatches" role="list" aria-label="Suggested colors">
            {colors.map((swatch) => <button aria-label={swatch} aria-pressed={color === swatch} key={swatch} onClick={() => commit(swatch)} style={{ backgroundColor: swatch }} type="button">{color === swatch ? <Check aria-hidden="true" size={15} /> : null}</button>)}
          </div>
          <label>Hex color<input maxLength={7} onBlur={() => commit(draft)} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); commit(draft); } }} value={draft} /></label>
          <PopoverPrimitive.Arrow className="color-picker-arrow" />
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
    <input name={name} type="hidden" value={color} />
  </label>;
}

function normalizeColor(value: string) {
  const candidate = value.trim().toLowerCase();
  return /^#[0-9a-f]{6}$/.test(candidate) ? candidate : undefined;
}
