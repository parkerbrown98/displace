import { createContext, use } from 'react';

export type Notify = (message: string) => void;
export type Confirm = (options: {
  title: string;
  message: string;
  confirmLabel?: string;
}) => Promise<boolean>;

export const ToastContext = createContext<Notify | null>(null);
export const ConfirmContext = createContext<Confirm | null>(null);

export function useToast(): Notify {
  const context = use(ToastContext);
  if (!context) throw new Error('useToast must be used within FeedbackProvider.');
  return context;
}

export function useConfirmation(): Confirm {
  const context = use(ConfirmContext);
  if (!context) throw new Error('useConfirmation must be used within FeedbackProvider.');
  return context;
}