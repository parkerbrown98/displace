"use client";

import { X } from "lucide-react";
import type { ReactNode } from "react";

interface ModalProps {
  children: ReactNode;
  onDismiss?: () => void;
  title: string;
}

export function Modal({ children, onDismiss, title }: ModalProps) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onDismiss}>
      <section
        aria-labelledby="modal-title"
        aria-modal="true"
        className="modal"
        role="dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <h2 id="modal-title">{title}</h2>
          {onDismiss ? (
            <button className="icon-button" onClick={onDismiss} type="button" title="Close">
              <X size={18} />
              <span className="sr-only">Close</span>
            </button>
          ) : null}
        </header>
        {children}
      </section>
    </div>
  );
}