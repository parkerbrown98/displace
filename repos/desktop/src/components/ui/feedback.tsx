import { useState, type ReactNode } from 'react';
import { Check, X } from 'lucide-react';
import {
  ConfirmContext,
  ToastContext,
  type Confirm,
  type Notify,
} from './feedback-context';

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{
    options: Parameters<Confirm>[0];
    resolve: (result: boolean) => void;
  } | null>(null);

  const notify: Notify = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 4_000);
  };
  const confirm: Confirm = (options) =>
    new Promise((resolve) => setConfirmation({ options, resolve }));
  const finishConfirmation = (result: boolean) => {
    confirmation?.resolve(result);
    setConfirmation(null);
  };

  return (
    <ToastContext value={notify}>
      <ConfirmContext value={confirm}>
        {children}
        <div className="toast-region" aria-live="polite" aria-atomic="true">
          {toast ? (
            <div className="toast">
              <Check aria-hidden="true" size={16} />
              <span>{toast}</span>
              <button className="icon-button" onClick={() => setToast(null)} aria-label="Dismiss notification">
                <X aria-hidden="true" size={15} />
              </button>
            </div>
          ) : null}
        </div>
        {confirmation ? (
          <div className="dialog-backdrop" role="presentation">
            <section className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-message">
              <h2 id="confirm-title">{confirmation.options.title}</h2>
              <p id="confirm-message">{confirmation.options.message}</p>
              <div className="dialog-actions">
                <button className="button secondary" onClick={() => finishConfirmation(false)}>Cancel</button>
                <button className="button danger" autoFocus onClick={() => finishConfirmation(true)}>
                  {confirmation.options.confirmLabel ?? 'Confirm'}
                </button>
              </div>
            </section>
          </div>
        ) : null}
      </ConfirmContext>
    </ToastContext>
  );
}