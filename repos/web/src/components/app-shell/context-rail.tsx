"use client";

import { PanelRightOpen, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

interface ContextRailProps {
  ariaLabel: string;
  children: ReactNode;
  className: string;
  title: string;
}

export function ContextRail({ ariaLabel, children, className, title }: ContextRailProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const closeButton = useRef<HTMLButtonElement>(null);
  const triggerButton = useRef<HTMLButtonElement>(null);

  const closeDrawer = () => {
    setOpen(false);
    triggerButton.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusFrame = requestAnimationFrame(() => closeButton.current?.focus());
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeDrawer();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return <div className="context-rail-slot">
    <button
      aria-controls={panelId}
      aria-expanded={open}
      className="context-rail-drawer-trigger"
      onClick={() => setOpen(true)}
      ref={triggerButton}
      title={`Open ${title.toLowerCase()}`}
      type="button"
    >
      <PanelRightOpen aria-hidden="true" size={19} />
      <span className="sr-only">Open {title.toLowerCase()}</span>
    </button>
    <button
      aria-label={`Close ${title.toLowerCase()}`}
      className={`context-rail-backdrop${open ? " open" : ""}`}
      onClick={closeDrawer}
      tabIndex={open ? 0 : -1}
      type="button"
    />
    <aside
      aria-label={ariaLabel}
      className={`${className} context-rail-panel${open ? " open" : ""}`}
      id={panelId}
      onClick={(event) => {
        if ((event.target as Element).closest("a")) closeDrawer();
      }}
    >
      <header className="context-rail-drawer-heading">
        <strong>{title}</strong>
        <button className="icon-button" onClick={closeDrawer} ref={closeButton} title={`Close ${title.toLowerCase()}`} type="button">
          <X aria-hidden="true" size={18} />
          <span className="sr-only">Close {title.toLowerCase()}</span>
        </button>
      </header>
      <div className="context-rail-body">{children}</div>
    </aside>
  </div>;
}