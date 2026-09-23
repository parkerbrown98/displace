"use client";

import { ArrowLeft, Check, ChevronDown, ChevronRight, CircleAlert, CircleCheck, ClipboardList, Clock3, FileSearch, Gavel, Inbox, MessageSquareText, NotebookPen, ShieldAlert, UserCheck, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { AppShell } from "@/components/app-shell/app-shell";
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

const reportStatuses: ReportStatus[] = ["open", "in_review", "resolved", "dismissed"];

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
    setReports((items) => next.status === status ? items.map((item) => item.id === next.id ? next : item) : items.filter((item) => item.id !== next.id));
  }

  async function loadMore() {
    if (!placeId || !nextCursor) return;
    const page = await listModerationReports(placeId, { cursor: nextCursor, status });
    setReports((items) => [...items, ...page.items]);
    setNextCursor(page.nextCursor);
  }

  const activePlace = places.find(({ context }) => context.place.id === placeId)?.context.place;
  const assignedCount = reports.filter((report) => report.assignedToUserId === session.user?.id).length;
  const unassignedCount = reports.filter((report) => !report.assignedToUserId).length;
  function changeStatus(nextStatus: ReportStatus) {
    if (nextStatus === status) return;
    setLoading(true);
    setSelected(undefined);
    setChecked([]);
    setStatus(nextStatus);
  }
  return <AppShell activePlaceSlug={activePlace?.slug}>
    <main className="main-content moderation-page" id="main-content">
      <header className="operations-heading moderation-heading"><div><p className="eyebrow">Trust and safety</p><h1>Review reports</h1><p>Triage incoming reports, review the available evidence, and record a clear outcome.</p></div><div className="moderation-overview" aria-label="Queue summary"><span><strong>{reports.length}</strong><small>{statusLabel(status)} loaded</small></span><span><strong>{assignedCount}</strong><small>Assigned to you</small></span><span><strong>{unassignedCount}</strong><small>Unassigned</small></span></div></header>
      {notice ? <p className={`form-message${notice.error ? " form-message-error" : " form-message-success"}`} role={notice.error ? "alert" : "status"}>{notice.text}</p> : null}
      {session.status === "loading" || loading && !placeId ? <LoadingPanel label="Loading moderation queue" /> : session.status !== "authenticated" ? <StatusPanel title="Sign in required" description="Sign in to review moderation cases." /> : places.length === 0 ? <StatusPanel title="No moderation access" description="None of your current place roles grant moderation management." /> : <>
        <section className="moderation-toolbar" aria-label="Queue filters">
          <label className="form-field">Community<Select onValueChange={(value) => { setLoading(true); setSelected(undefined); setChecked([]); setPlaceId(value); }} options={places.map(({ context }) => ({ label: context.place.name, value: context.place.id }))} value={placeId} /></label>
          <div className="moderation-status-filter"><span>Queue</span><div className="moderation-status-segments" aria-label="Report status" role="group">{reportStatuses.map((reportStatus) => <button aria-pressed={status === reportStatus} key={reportStatus} onClick={() => changeStatus(reportStatus)} type="button">{statusLabel(reportStatus)}</button>)}</div></div>
        </section>
        <BulkActionBar checked={checked} placeId={placeId!} reports={reports} onClear={() => setChecked([])} onComplete={async () => { setNotice({ text: "Bulk actions recorded." }); setChecked([]); if (selected) await refreshReport(selected.id); }} />
        <div className={`moderation-layout${selected ? " has-selection" : ""}`}>
          <section className="moderation-queue" aria-label="Report queue">
            <header className="moderation-queue-heading"><div><p className="eyebrow">Inbox</p><h2>{statusLabel(status)} reports</h2></div><span>{reports.length}</span></header>
            {loading ? <LoadingPanel label="Refreshing reports" /> : reports.length ? <>
              <div className="moderation-queue-actions"><label><input aria-label="Select all shown reports" checked={checked.length > 0 && reports.slice(0, 25).every((report) => checked.includes(report.id))} onChange={(event) => setChecked(event.target.checked ? reports.slice(0, 25).map((report) => report.id) : [])} type="checkbox" /><span>Select all shown</span></label><small>Up to 25 at once</small></div>
              <div className="moderation-queue-list">{reports.map((report) => <article className={selected?.id === report.id ? "active" : ""} key={report.id}>
                <label className="case-select"><input aria-label={`Select report ${report.id}`} checked={checked.includes(report.id)} onChange={(event) => setChecked((items) => event.target.checked ? [...items, report.id].slice(0, 25) : items.filter((id) => id !== report.id))} type="checkbox" /></label>
                <button aria-pressed={selected?.id === report.id} className="case-open" onClick={() => void openReport(report.id)} type="button"><span className="case-open-copy"><span className="case-open-meta"><span>{targetTypeLabel(report.targetType)}</span><time dateTime={report.createdAt}>{formatRelativeDate(report.createdAt)}</time></span><strong>{targetLabel(report)}</strong><small><CircleAlert aria-hidden="true" size={13} />{humanize(report.reasonCode)}</small>{report.assignedToUserId ? <em>{report.assignedToUserId === session.user?.id ? "Assigned to you" : "Assigned"}</em> : null}</span><ChevronRight aria-hidden="true" size={17} /></button>
              </article>)}</div>
              {nextCursor ? <button className="secondary-button moderation-load-more" onClick={() => void loadMore()} type="button">Load more reports</button> : null}
            </> : <div className="moderation-queue-empty" role="status"><Inbox aria-hidden="true" size={24} /><strong>Queue clear</strong><p>There are no {statusLabel(status).toLowerCase()} reports in this community.</p></div>}
          </section>
          <section className="moderation-case" aria-live="polite">
            {selected ? <CaseDetail key={selected.id} onBack={() => setSelected(undefined)} onChanged={() => refreshReport(selected.id)} placeId={placeId!} report={selected} userId={session.user!.id} /> : <div className="moderation-case-empty"><span><ShieldAlert aria-hidden="true" size={25} /></span><p className="eyebrow">Review workspace</p><h2>Select a report</h2><p>Choose a report from the queue to inspect evidence, leave private notes, take action, or close the case.</p></div>}
          </section>
        </div>
      </>}
    </main>
  </AppShell>;
}

function BulkActionBar({ checked, onClear, onComplete, placeId, reports }: { checked: string[]; onClear: () => void; onComplete: () => Promise<void>; placeId: string; reports: ModerationReportContract[] }) {
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
  const includesUnsupportedReports = selectedReports.length !== checked.length;
  return <form aria-label="Bulk moderation action" className="bulk-action-bar" onSubmit={submit}><div className="bulk-action-heading"><span>{checked.length}</span><div><strong>Bulk warning</strong><small>{includesUnsupportedReports ? "Only member reports can be warned in bulk." : "Apply one warning to the selected members."}</small></div><button aria-label="Clear selection" className="icon-button" onClick={onClear} title="Clear selection" type="button"><X size={16} /></button></div><div className="bulk-action-fields"><label className="form-field">Reason code<Select name="reasonCode" options={actionReasonCodes.map((reason) => ({ label: humanize(reason), value: reason }))} required /></label><label className="form-field grow">Warning<input maxLength={4000} name="reason" required /></label><button className="secondary-button" disabled={pending || includesUnsupportedReports} title={includesUnsupportedReports ? "Bulk warning is available for member reports" : undefined} type="submit"><Gavel size={15} />{pending ? "Warning..." : "Warn members"}</button></div></form>;
}

function CaseDetail({ onBack, onChanged, placeId, report, userId }: { onBack: () => void; onChanged: () => Promise<void>; placeId: string; report: ModerationReportContract; userId: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const actions = actionsFor(report);
  const [selectedAction, setSelectedAction] = useState<ModerationActionName | undefined>(actions[0]);
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
  return <div className="case-detail">
    <button className="case-back-button" onClick={onBack} type="button"><ArrowLeft size={16} />Back to queue</button>
    <header className="case-header"><div className="case-header-meta"><span className="case-target-type">{targetTypeLabel(report.targetType)}</span><span className={`case-status case-status-${report.status}`}>{statusLabel(report.status)}</span></div><h2>{targetLabel(report)}</h2><p>{report.details || "The reporter did not provide additional details."}</p><dl className="case-meta"><div><dt>Reported</dt><dd><Clock3 aria-hidden="true" size={14} />{formatDate(report.createdAt)}</dd></div><div><dt>Reporter</dt><dd>{shortId(report.reporterUserId)}</dd></div><div><dt>Assignment</dt><dd>{report.assignedToUserId ? report.assignedToUserId === userId ? "You" : shortId(report.assignedToUserId) : "Unassigned"}</dd></div><div><dt>Case</dt><dd>{shortId(report.id)}</dd></div></dl></header>
    {error ? <p className="form-message form-message-error" role="alert">{error}</p> : null}
    <section className="case-section"><div className="case-section-heading"><span><FileSearch aria-hidden="true" size={18} /></span><div><h3>Evidence snapshot</h3><p>Information captured when the report was submitted.</p></div></div><dl className="evidence-list">{Object.entries(report.evidence).map(([key, value]) => <div key={key}><dt>{humanize(key)}</dt><dd>{formatEvidence(value)}</dd></div>)}</dl></section>
    {report.status === "open" || report.status === "in_review" ? <>
      <div className="case-assignment"><span><UserCheck aria-hidden="true" size={18} /><span><strong>{report.assignedToUserId === userId ? "This case is assigned to you" : report.assignedToUserId ? "This case is assigned" : "This case is unassigned"}</strong><small>Claim a case before coordinating moderation work.</small></span></span><button className="secondary-button" disabled={pending || report.assignedToUserId === userId} onClick={() => void run(() => assignModerationReport(placeId, report.id, userId))} type="button">{report.assignedToUserId === userId ? "Assigned to you" : "Assign to me"}</button></div>
      {actions.length ? <details className="case-workflow-section case-workflow-danger" open><summary><span><Gavel aria-hidden="true" size={18} /><span><strong>Take moderation action</strong><small>Apply a policy action to the reported target.</small></span></span><ChevronDown aria-hidden="true" size={17} /></summary><form className="case-action-form" onSubmit={action}><label className="form-field">Action<Select name="action" onValueChange={(value) => setSelectedAction(value as ModerationActionName)} options={actions.map((name) => ({ label: humanize(name), value: name }))} required value={selectedAction} /></label>{selectedAction === "member.timeout" ? <label className="form-field">Timeout hours<input defaultValue={24} max={8760} min={1} name="durationHours" type="number" /></label> : null}{selectedAction === "topic.move" ? <label className="form-field">Destination forum ID<input name="targetForumId" required /></label> : null}<label className="form-field">Reason code<Select name="reasonCode" options={actionReasonCodes.map((reason) => ({ label: humanize(reason), value: reason }))} required /></label><label className="form-field wide">Reason<textarea maxLength={4000} name="reason" required rows={3} /></label><button className="danger-button" disabled={pending} type="submit"><Gavel size={16} />{pending ? "Applying..." : "Apply action"}</button></form></details> : null}
      <details className="case-workflow-section"><summary><span><NotebookPen aria-hidden="true" size={18} /><span><strong>Private notes</strong><small>Leave context for other moderators.</small></span></span><ChevronDown aria-hidden="true" size={17} /></summary><form className="case-note-form" onSubmit={note}><label className="form-field">Note<textarea maxLength={4000} name="body" required rows={3} /></label><button className="secondary-button" disabled={pending} type="submit"><MessageSquareText size={16} />Add note</button></form><NoteList notes={report.notes ?? []} /></details>
      <details className="case-workflow-section case-workflow-resolve"><summary><span><CircleCheck aria-hidden="true" size={18} /><span><strong>Close case</strong><small>Record the final outcome and resolution.</small></span></span><ChevronDown aria-hidden="true" size={17} /></summary><form className="case-resolution-form" onSubmit={resolve}><label className="form-field">Outcome<Select name="status" options={[{ label: "Resolved", value: "resolved" }, { label: "Dismissed", value: "dismissed" }]} /></label><label className="form-field grow">Resolution summary<input maxLength={4000} name="resolution" required /></label><button className="primary-button" disabled={pending} type="submit"><Check size={16} />{pending ? "Closing..." : "Close case"}</button></form></details>
    </> : <section className="case-resolution-summary"><CircleCheck aria-hidden="true" size={20} /><div><h3>{statusLabel(report.status)}</h3><p>{report.resolution || "No resolution summary was recorded."}</p>{report.resolvedAt ? <time dateTime={report.resolvedAt}>{formatDate(report.resolvedAt)}</time> : null}</div></section>}
    <section className="case-section"><div className="case-section-heading"><span><ClipboardList aria-hidden="true" size={18} /></span><div><h3>Action history</h3><p>A permanent record of moderation decisions.</p></div></div>{report.actions?.length ? <ol className="case-history">{report.actions.map((action) => <li key={action.id}><span className="case-history-icon"><Gavel aria-hidden="true" size={14} /></span><div><strong>{humanize(action.action)}</strong><p>{action.reason}</p><small>{humanize(action.reasonCode)}</small></div><time dateTime={action.createdAt}>{formatDate(action.createdAt)}</time></li>)}</ol> : <p className="case-section-empty">No actions have been recorded for this case.</p>}</section>
  </div>;
}

function NoteList({ notes }: { notes: NonNullable<ModerationReportContract["notes"]> }) { return notes.length ? <ol className="case-notes">{notes.map((note) => <li key={note.id}><p>{note.body}</p><time dateTime={note.createdAt}>{formatDate(note.createdAt)}</time></li>)}</ol> : <p className="settings-muted">No private notes.</p>; }
function actionsFor(report: ModerationReportContract): ModerationActionName[] { if (report.targetType === "member") return ["member.warn", "member.timeout", "member.ban"]; if (report.targetType === "topic") return ["content.hide", "content.restore", "topic.lock", "topic.unlock", "topic.pin", "topic.unpin", "topic.move"]; if (report.targetType === "post") return ["content.hide", "content.restore"]; if (report.targetType === "chat_message") return ["chat.delete"]; return []; }
function targetLabel(report: ModerationReportContract): string { return String(report.evidence.title ?? report.evidence.displayName ?? report.evidence.handle ?? report.evidence.body ?? report.targetType.replaceAll("_", " ")); }
function targetTypeLabel(value: ModerationReportContract["targetType"]): string { return humanize(value); }
function statusLabel(value: ReportStatus): string { return humanize(value); }
function humanize(value: string): string { const words = value.replaceAll(/[._]/g, " "); return `${words.charAt(0).toUpperCase()}${words.slice(1)}`; }
function shortId(value: string): string { return value.length > 12 ? `${value.slice(0, 8)}…${value.slice(-4)}` : value; }
function formatEvidence(value: unknown): string { if (value === null || value === undefined || value === "") return "Not provided"; if (Array.isArray(value)) return value.map(String).join(", "); if (typeof value === "object") return JSON.stringify(value, null, 2); if (typeof value === "boolean") return value ? "Yes" : "No"; return String(value); }
function formatDate(value: string): string { return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
function formatRelativeDate(value: string): string { const elapsed = Date.parse(value) - Date.now(); const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" }); const minutes = Math.round(elapsed / 60_000); if (Math.abs(minutes) < 60) return formatter.format(minutes, "minute"); const hours = Math.round(minutes / 60); if (Math.abs(hours) < 24) return formatter.format(hours, "hour"); return formatter.format(Math.round(hours / 24), "day"); }