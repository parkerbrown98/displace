"use client";

import { Check, ChevronRight, ClipboardList, Gavel, ShieldAlert, UserCheck } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { AppShell, ShellTopbar } from "@/components/app-shell/app-shell";
import { Select } from "@/components/ui/select";
import { LoadingPanel, StatusPanel } from "@/components/ui/status-panel";
import { useSession } from "@/features/auth/session-provider";
import { getPlaceContext, listMyPlaces } from "@/features/places/place-client";
import type { PlaceContextContract } from "@/features/places/place-contract";
import { placeErrorMessage } from "@/features/places/place-access";
import {
  addModeratorNote,
  assignModerationReport,
  executeBulkModerationActions,
  executeModerationAction,
  getModerationReport,
  listModerationReports,
  resolveModerationReport,
} from "./moderation-client";
import {
  actionReasonCodes,
  type ActionReasonCode,
  type ModerationActionInput,
  type ModerationActionName,
  type ModerationReportContract,
  type ReportStatus,
} from "./moderation-contracts";

interface ModeratedPlace {
  context: PlaceContextContract;
}

export function ModerationDashboard({ initialPlaceSlug }: { initialPlaceSlug?: string }) {
  const session = useSession();
  const [places, setPlaces] = useState<ModeratedPlace[]>([]);
  const [placeId, setPlaceId] = useState<string>();
  const [reports, setReports] = useState<ModerationReportContract[]>([]);
  const [selected, setSelected] = useState<ModerationReportContract>();
  const [checked, setChecked] = useState<string[]>([]);
  const [status, setStatus] = useState<ReportStatus>("open");
  const [nextCursor, setNextCursor] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ error?: boolean; text: string }>();

  useEffect(() => {
    if (session.status !== "authenticated") return;
    let active = true;
    void listMyPlaces()
      .then((page) => Promise.all(page.items.map((place) => getPlaceContext(place.id).catch(() => undefined))))
      .then((contexts) => {
        if (!active) return;
        const manageable = contexts
          .filter((context): context is PlaceContextContract => Boolean(context?.viewer.permissions.includes("moderation.manage")))
          .map((context) => ({ context }));
        setPlaces(manageable);
        setPlaceId(manageable.find(({ context }) => context.place.slug === initialPlaceSlug)?.context.place.id ?? manageable[0]?.context.place.id);
      })
      .catch((error) => setNotice({ error: true, text: placeErrorMessage(error, "Moderated places could not be loaded.") }))
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [initialPlaceSlug, session.status]);

  useEffect(() => {
    if (!placeId) return;
    let active = true;
    void listModerationReports(placeId, { status })
      .then((page) => { if (active) { setReports(page.items); setNextCursor(page.nextCursor); } })
      .catch((error) => { if (active) setNotice({ error: true, text: placeErrorMessage(error, "Reports could not be loaded.") }); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [placeId, status]);

  async function openReport(reportId: string) {
    if (!placeId) return;
    setNotice(undefined);
    try { setSelected(await getModerationReport(placeId, reportId)); }
    catch (error) { setNotice({ error: true, text: placeErrorMessage(error, "The report could not be loaded.") }); }
  }

  async function refreshReport(reportId: string) {
    if (!placeId) return;
    const next = await getModerationReport(placeId, reportId);
    setSelected(next);
    setReports((items) => items.map((item) => item.id === next.id ? next : item));
  }

  async function loadMore() {
    if (!placeId || !nextCursor) return;
    const page = await listModerationReports(placeId, { cursor: nextCursor, status });
    setReports((items) => [...items, ...page.items]);
    setNextCursor(page.nextCursor);
  }

  const activePlace = places.find(({ context }) => context.place.id === placeId)?.context.place;
  return <AppShell activePlaceSlug={activePlace?.slug}>
    <main className="main-content moderation-page" id="main-content">
      <ShellTopbar />
      <header className="operations-heading"><p className="eyebrow">Place operations</p><h1>Moderation</h1><p>Reports, evidence, actions, and case resolution.</p></header>
      {notice ? <p className={`form-message${notice.error ? " form-message-error" : " form-message-success"}`} role={notice.error ? "alert" : "status"}>{notice.text}</p> : null}
      {session.status === "loading" || loading && !placeId ? <LoadingPanel label="Loading moderation queue" /> : session.status !== "authenticated" ? <StatusPanel title="Sign in required" description="Sign in to review moderation cases." /> : places.length === 0 ? <StatusPanel title="No moderation access" description="None of your current place roles grant moderation management." /> : <>
        <div className="moderation-toolbar">
          <label className="form-field">Place<Select onValueChange={(value) => { setLoading(true); setSelected(undefined); setChecked([]); setPlaceId(value); }} options={places.map(({ context }) => ({ label: context.place.name, value: context.place.id }))} value={placeId} /></label>
          <label className="form-field">Status<Select onValueChange={(value) => { setLoading(true); setSelected(undefined); setChecked([]); setStatus(value as ReportStatus); }} options={[{ label: "Open", value: "open" }, { label: "In review", value: "in_review" }, { label: "Resolved", value: "resolved" }, { label: "Dismissed", value: "dismissed" }]} value={status} /></label>
          <span className="moderation-count"><ClipboardList size={17} />{reports.length} cases</span>
        </div>
        <BulkActionBar checked={checked} placeId={placeId!} reports={reports} onComplete={async () => { setNotice({ text: "Bulk actions recorded." }); setChecked([]); if (selected) await refreshReport(selected.id); }} />
        <div className="moderation-layout">
          <section className="moderation-queue" aria-label="Report queue">
            {loading ? <LoadingPanel label="Refreshing reports" /> : reports.length ? reports.map((report) => <article className={selected?.id === report.id ? "active" : ""} key={report.id}>
              <label className="case-select"><input aria-label={`Select report ${report.id}`} checked={checked.includes(report.id)} onChange={(event) => setChecked((items) => event.target.checked ? [...items, report.id].slice(0, 25) : items.filter((id) => id !== report.id))} type="checkbox" /></label>
              <button className="case-open" onClick={() => void openReport(report.id)} type="button"><span><strong>{targetLabel(report)}</strong><small>{report.reasonCode.replaceAll("_", " ")} · {formatDate(report.createdAt)}</small></span><ChevronRight size={17} /></button>
            </article>) : <StatusPanel title="Queue clear" description={`There are no ${status.replaceAll("_", " ")} reports in this place.`} />}
            {nextCursor ? <button className="secondary-button" onClick={() => void loadMore()} type="button">Load more</button> : null}
          </section>
          <section className="moderation-case" aria-live="polite">
            {selected ? <CaseDetail key={selected.id} onChanged={() => refreshReport(selected.id)} placeId={placeId!} report={selected} userId={session.user!.id} /> : <StatusPanel title="Select a report" description="Case evidence and actions appear here." action={<ShieldAlert size={23} />} />}
          </section>
        </div>
      </>}
    </main>
  </AppShell>;
}

function BulkActionBar({ checked, onComplete, placeId, reports }: { checked: string[]; onComplete: () => Promise<void>; placeId: string; reports: ModerationReportContract[] }) {
  const [pending, setPending] = useState(false);
  const selectedReports = reports.filter((report) => checked.includes(report.id) && report.targetType === "member");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    try {
      await executeBulkModerationActions(placeId, selectedReports.map((report) => ({ action: "member.warn", reason: String(form.get("reason")), reasonCode: String(form.get("reasonCode")) as ActionReasonCode, reportId: report.id, targetId: report.targetId, targetType: "member" })));
      await onComplete();
    } finally { setPending(false); }
  }
  if (!checked.length) return null;
  return <form className="bulk-action-bar" onSubmit={submit}><strong>{checked.length} selected</strong><label className="form-field">Reason code<Select name="reasonCode" options={actionReasonCodes.map((reason) => ({ label: reason.replaceAll("_", " "), value: reason }))} required /></label><label className="form-field grow">Warning<input maxLength={4000} name="reason" required /></label><button className="secondary-button" disabled={pending || selectedReports.length !== checked.length} title={selectedReports.length !== checked.length ? "Bulk warning is available for member reports" : undefined} type="submit"><Gavel size={15} />Warn members</button></form>;
}

function CaseDetail({ onChanged, placeId, report, userId }: { onChanged: () => Promise<void>; placeId: string; report: ModerationReportContract; userId: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  async function run(operation: () => Promise<unknown>) {
    setPending(true); setError(undefined);
    try { await operation(); await onChanged(); }
    catch (cause) { setError(placeErrorMessage(cause, "The moderation case could not be updated.")); }
    finally { setPending(false); }
  }
  async function action(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const action = String(form.get("action")) as ModerationActionName;
    const input: ModerationActionInput = { action, reason: String(form.get("reason")), reasonCode: String(form.get("reasonCode")) as ActionReasonCode, reportId: report.id, targetId: report.targetId, targetType: report.targetType };
    if (action === "member.timeout") input.durationHours = Number(form.get("durationHours"));
    if (action === "topic.move") input.targetForumId = String(form.get("targetForumId"));
    await run(() => executeModerationAction(placeId, input));
  }
  async function note(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const formElement = event.currentTarget; const form = new FormData(formElement); await run(() => addModeratorNote(placeId, report.id, String(form.get("body")))); formElement.reset(); }
  async function resolve(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); await run(() => resolveModerationReport(placeId, report.id, String(form.get("status")) as "dismissed" | "resolved", String(form.get("resolution")))); }
  const actions = actionsFor(report);
  return <div className="case-detail">
    <header><span className={`case-status case-status-${report.status}`}>{report.status.replaceAll("_", " ")}</span><p className="eyebrow">{report.targetType.replaceAll("_", " ")}</p><h2>{targetLabel(report)}</h2><p>{report.details || "No additional reporter details."}</p></header>
    {error ? <p className="form-message form-message-error" role="alert">{error}</p> : null}
    <section><h3>Evidence snapshot</h3><dl className="evidence-list">{Object.entries(report.evidence).map(([key, value]) => <div key={key}><dt>{key.replaceAll(/([A-Z_])/g, " $1")}</dt><dd>{formatEvidence(value)}</dd></div>)}</dl></section>
    {report.status === "open" || report.status === "in_review" ? <>
      <section className="case-command-row"><button className="secondary-button" disabled={pending || report.assignedToUserId === userId} onClick={() => void run(() => assignModerationReport(placeId, report.id, userId))} type="button"><UserCheck size={16} />{report.assignedToUserId === userId ? "Assigned to you" : "Assign to me"}</button></section>
      <section><h3>Action</h3><form className="case-action-form" onSubmit={action}><label className="form-field">Action<Select name="action" options={actions.map((name) => ({ label: name.replaceAll(".", " "), value: name }))} required /></label>{report.targetType === "member" ? <label className="form-field">Timeout hours<input defaultValue={24} max={8760} min={1} name="durationHours" type="number" /></label> : null}{report.targetType === "topic" ? <label className="form-field">Destination forum ID<input name="targetForumId" /></label> : null}<label className="form-field">Reason code<Select name="reasonCode" options={actionReasonCodes.map((reason) => ({ label: reason.replaceAll("_", " "), value: reason }))} required /></label><label className="form-field wide">Reason<textarea maxLength={4000} name="reason" required rows={3} /></label><button className="danger-button" disabled={pending} type="submit"><Gavel size={16} />Apply action</button></form></section>
      <section><h3>Private notes</h3><form className="case-note-form" onSubmit={note}><label className="form-field">Note<textarea maxLength={4000} name="body" required rows={3} /></label><button className="secondary-button" disabled={pending} type="submit">Add note</button></form><NoteList notes={report.notes ?? []} /></section>
      <section><h3>Resolution</h3><form className="case-resolution-form" onSubmit={resolve}><label className="form-field">Outcome<Select name="status" options={[{ label: "Resolved", value: "resolved" }, { label: "Dismissed", value: "dismissed" }]} /></label><label className="form-field grow">Summary<input maxLength={4000} name="resolution" required /></label><button className="primary-button" disabled={pending} type="submit"><Check size={16} />Close case</button></form></section>
    </> : <section><h3>Resolution</h3><p>{report.resolution}</p></section>}
    <section><h3>Action history</h3>{report.actions?.length ? <ol className="case-history">{report.actions.map((action) => <li key={action.id}><strong>{action.action.replaceAll(".", " ")}</strong><span>{action.reason}</span><time dateTime={action.createdAt}>{formatDate(action.createdAt)}</time></li>)}</ol> : <p className="settings-muted">No actions recorded.</p>}</section>
  </div>;
}

function NoteList({ notes }: { notes: NonNullable<ModerationReportContract["notes"]> }) { return notes.length ? <ol className="case-notes">{notes.map((note) => <li key={note.id}><p>{note.body}</p><time dateTime={note.createdAt}>{formatDate(note.createdAt)}</time></li>)}</ol> : <p className="settings-muted">No private notes.</p>; }
function actionsFor(report: ModerationReportContract): ModerationActionName[] { if (report.targetType === "member") return ["member.warn", "member.timeout", "member.ban"]; if (report.targetType === "topic") return ["content.hide", "content.restore", "topic.lock", "topic.unlock", "topic.pin", "topic.unpin", "topic.move"]; if (report.targetType === "post") return ["content.hide", "content.restore"]; if (report.targetType === "chat_message") return ["chat.delete"]; return []; }
function targetLabel(report: ModerationReportContract): string { return String(report.evidence.title ?? report.evidence.displayName ?? report.evidence.handle ?? report.evidence.body ?? report.targetType.replaceAll("_", " ")); }
function formatEvidence(value: unknown): string { if (value === null || value === undefined) return "None"; if (typeof value === "object") return JSON.stringify(value); return String(value); }
function formatDate(value: string): string { return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }