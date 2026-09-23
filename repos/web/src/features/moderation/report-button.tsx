"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Flag, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Select } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { useSession } from "@/features/auth/session-provider";
import { placeErrorMessage } from "@/features/places/place-access";
import { createReport } from "./moderation-client";
import { reportReasonCodes, type ReportReasonCode, type ReportTargetType } from "./moderation-contracts";

export function ReportButton({ label, placeId, targetId, targetType }: { label: string; placeId: string; targetId: string; targetType: ReportTargetType }) {
  const session = useSession();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  if (session.status !== "authenticated") return null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setPending(true);
    const form = new FormData(formElement);
    try {
      await createReport(placeId, {
        details: String(form.get("details") ?? ""),
        reasonCode: String(form.get("reasonCode")) as ReportReasonCode,
        targetId,
        targetType,
      });
      toast.success("Report submitted.");
      formElement.reset();
      setOpen(false);
    } catch (error) {
      toast.error(placeErrorMessage(error, "The report could not be submitted."));
    } finally {
      setPending(false);
    }
  }

  return <span className="report-control">
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger asChild>
        <button className="icon-button" title={`Report ${label}`} type="button"><Flag size={15} /><span className="sr-only">Report {label}</span></button>
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="report-dialog-overlay" />
        <DialogPrimitive.Content className="report-dialog">
          <span className="report-dialog-heading">
            <DialogPrimitive.Title>Report {label}</DialogPrimitive.Title>
            <DialogPrimitive.Close asChild><button className="icon-button" title="Close report" type="button"><X size={15} /><span className="sr-only">Close</span></button></DialogPrimitive.Close>
          </span>
          <DialogPrimitive.Description className="report-dialog-description">Send this item to the moderation team for review.</DialogPrimitive.Description>
          <form onSubmit={submit}>
            <label className="form-field">Reason<Select defaultValue="" name="reasonCode" options={[{ disabled: true, label: "Select reason", value: "" }, ...reportReasonCodes.map((reason) => ({ label: reason.replaceAll("_", " "), value: reason }))]} required /></label>
            <label className="form-field">Details<textarea maxLength={4000} name="details" rows={4} /></label>
            <button className="primary-button" disabled={pending} type="submit"><Flag size={15} />{pending ? "Submitting..." : "Submit report"}</button>
          </form>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  </span>;
}