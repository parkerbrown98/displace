import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog';
import * as ToastPrimitive from '@radix-ui/react-toast';
import { useRef, useState, type ReactNode } from 'react';
import { Check, X } from 'lucide-react';
import {
  ConfirmContext,
  ToastContext,
  type Confirm,
  type Notify,
} from './feedback-context';

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const toastId = useRef(0);
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null);
  const [confirmation, setConfirmation] = useState<{
    options: Parameters<Confirm>[0];
    resolve: (result: boolean) => void;
  } | null>(null);

  const notify: Notify = (message) => {
    toastId.current += 1;
    setToast({ id: toastId.current, message });
  };
  const confirm: Confirm = (options) =>
    new Promise((resolve) => setConfirmation({ options, resolve }));
  const finishConfirmation = (result: boolean) => {
    confirmation?.resolve(result);
    setConfirmation(null);
  };

  return <ToastPrimitive.Provider duration={4_000} swipeDirection="right">
    <ToastContext value={notify}>
      <ConfirmContext value={confirm}>
        {children}
          {toast ? <ToastPrimitive.Root className="toast" key={toast.id} onOpenChange={(open) => { if (!open) setToast(null); }} open>
            <span aria-hidden="true"><Check size={16} /></span>
              <ToastPrimitive.Description>{toast.message}</ToastPrimitive.Description>
              <ToastPrimitive.Close asChild><button className="icon-button" aria-label="Dismiss notification">
                <X aria-hidden="true" size={15} />
              </button></ToastPrimitive.Close>
            </ToastPrimitive.Root> : null}
        <ToastPrimitive.Viewport className="toast-region" />
        <AlertDialogPrimitive.Root onOpenChange={(open) => { if (!open && confirmation) finishConfirmation(false); }} open={Boolean(confirmation)}>
          <AlertDialogPrimitive.Portal>
            <AlertDialogPrimitive.Overlay className="dialog-backdrop" />
            <AlertDialogPrimitive.Content className="dialog">
              <AlertDialogPrimitive.Title>{confirmation?.options.title}</AlertDialogPrimitive.Title>
              <AlertDialogPrimitive.Description>{confirmation?.options.message}</AlertDialogPrimitive.Description>
              <div className="dialog-actions">
                <AlertDialogPrimitive.Cancel asChild><button className="button secondary">Cancel</button></AlertDialogPrimitive.Cancel>
                <AlertDialogPrimitive.Action asChild><button className="button danger" onClick={() => finishConfirmation(true)}>{confirmation?.options.confirmLabel ?? 'Confirm'}</button></AlertDialogPrimitive.Action>
              </div>
            </AlertDialogPrimitive.Content>
          </AlertDialogPrimitive.Portal>
        </AlertDialogPrimitive.Root>
      </ConfirmContext>
    </ToastContext>
  </ToastPrimitive.Provider>;
}