"use client";

import { X } from "lucide-react";

interface ToastProps {
  message: string;
  onDismiss?: () => void;
  title: string;
  tone?: "error" | "neutral" | "success";
}

export function Toast({ message, onDismiss, title, tone = "neutral" }: ToastProps) {
  return (
    <section className={`toast toast-${tone}`} role={tone === "error" ? "alert" : "status"}>
      <div>
        <strong>{title}</strong>
        <p>{message}</p>
      </div>
      {onDismiss ? (
        <button className="icon-button" onClick={onDismiss} type="button" title="Dismiss">
          <X size={16} />
          <span className="sr-only">Dismiss</span>
        </button>
      ) : null}
    </section>
  );
}