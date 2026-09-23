"use client";

import * as ToastPrimitive from "@radix-ui/react-toast";
import { X } from "lucide-react";
import { createContext, use, useEffect, useState, type ReactNode } from "react";

type ToastTone = "error" | "success";

interface ToastItem {
  description?: string;
  id: number;
  title: string;
  tone: ToastTone;
}

interface ToastApi {
  error: (title: string, description?: string) => void;
  success: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);
const toastListeners = new Set<(toast: ToastItem) => void>();
let nextToastId = 0;

function publishToast(tone: ToastTone, title: string, description?: string) {
  const item = { description, id: nextToastId++, title, tone };
  toastListeners.forEach((listener) => listener(item));
}

export const toast: ToastApi = {
  error: (title, description) => publishToast("error", title, description),
  success: (title, description) => publishToast("success", title, description),
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const listener = (item: ToastItem) => setToasts((items) => [...items, item]);
    toastListeners.add(listener);
    return () => { toastListeners.delete(listener); };
  }, []);

  return <ToastContext value={toast}>
    <ToastPrimitive.Provider duration={5000} swipeDirection="right">
      {children}
      {toasts.map((toast) => <ToastPrimitive.Root
        className={`toast toast-${toast.tone}`}
        key={toast.id}
        onOpenChange={(open) => { if (!open) setToasts((items) => items.filter((item) => item.id !== toast.id)); }}
        type={toast.tone === "error" ? "foreground" : "background"}
      >
        <span className="toast-copy">
          <ToastPrimitive.Title className="toast-title">{toast.title}</ToastPrimitive.Title>
          {toast.description ? <ToastPrimitive.Description>{toast.description}</ToastPrimitive.Description> : null}
        </span>
        <ToastPrimitive.Close asChild>
          <button className="icon-button toast-close" title="Dismiss notification" type="button"><X aria-hidden="true" size={15} /><span className="sr-only">Dismiss notification</span></button>
        </ToastPrimitive.Close>
      </ToastPrimitive.Root>)}
      <ToastPrimitive.Viewport className="toast-region" />
    </ToastPrimitive.Provider>
  </ToastContext>;
}

export function useToast(): ToastApi {
  const context = use(ToastContext);
  if (!context) throw new Error("useToast must be used within ToastProvider.");
  return context;
}

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