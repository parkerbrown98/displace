"use client";

import { Plus, X } from "lucide-react";
import { useState, type KeyboardEvent } from "react";

export function TagInput({
  initialTags = [],
  label,
  maxTags = 8,
  name,
}: {
  initialTags?: string[];
  label: string;
  maxTags?: number;
  name: string;
}) {
  const [tags, setTags] = useState(() => initialTags.slice(0, maxTags));
  const [draft, setDraft] = useState("");

  function addTag() {
    const tag = normalizeTag(draft);
    if (!tag || tags.includes(tag) || tags.length >= maxTags) return;
    setTags((current) => [...current, tag]);
    setDraft("");
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addTag();
    } else if (event.key === "Backspace" && !draft && tags.length) {
      setTags((current) => current.slice(0, -1));
    }
  }

  return <div className="form-field tag-input-field">
    <span>{label}</span>
    <div className="tag-input-control">
      <div className="tag-input-values" aria-live="polite">
        {tags.map((tag) => <span className="tag-input-value" key={tag}>#{tag}<button aria-label={`Remove ${tag}`} onClick={() => setTags((current) => current.filter((item) => item !== tag))} type="button"><X aria-hidden="true" size={13} /></button><input name={name} type="hidden" value={tag} /></span>)}
        <input aria-label={`Add ${label.toLowerCase()}`} disabled={tags.length >= maxTags} maxLength={40} onChange={(event) => setDraft(event.target.value)} onKeyDown={handleKeyDown} placeholder={tags.length ? "Add another" : "Type a tag"} value={draft} />
        <button aria-label="Add tag" className="tag-input-add" disabled={!normalizeTag(draft) || tags.length >= maxTags} onClick={addTag} title="Add tag" type="button"><Plus aria-hidden="true" size={15} /></button>
      </div>
    </div>
    <small>Press Enter to add up to {maxTags} tags. Spaces become hyphens.</small>
  </div>;
}

function normalizeTag(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-").replace(/^-|-$/g, "");
}
