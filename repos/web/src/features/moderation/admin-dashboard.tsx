"use client";

import { CheckCircle2, RotateCcw, Save, ShieldX, SlidersHorizontal } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { AppShell, ShellTopbar } from "@/components/app-shell/app-shell";
import { Select } from "@/components/ui/select";
import { LoadingPanel, StatusPanel } from "@/components/ui/status-panel";
import { toast } from "@/components/ui/toast";
import { useSession } from "@/features/auth/session-provider";
import { placeErrorMessage } from "@/features/places/place-access";
import {
  getInstanceSettings,
  updateAccountStatus,
  updateInstanceSettings,
} from "./moderation-client";
import {
  actionReasonCodes,
  type ActionReasonCode,
  type InstanceSettingsContract,
} from "./moderation-contracts";

export function AdminDashboard() {
  const session = useSession();
  const [settings, setSettings] = useState<InstanceSettingsContract>();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string>();

  useEffect(() => {
    if (session.status !== "authenticated" || !session.user?.isInstanceAdmin) {
      return;
    }
    let active = true;
    void getInstanceSettings()
      .then((value) => { if (active) setSettings(value); })
      .catch((error) => { if (active) setLoadError(placeErrorMessage(error, "Instance settings could not be loaded.")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [session.status, session.user?.isInstanceAdmin]);

  return <AppShell activeNavigation={null}>
    <main className="main-content admin-page" id="main-content">
      <ShellTopbar />
      <header className="operations-heading"><p className="eyebrow">Instance</p><h1>Administration</h1><p>Public policy, feature availability, and account safety.</p></header>
      {loadError ? <p className="form-message form-message-error" role="alert">{loadError}</p> : null}
      {session.status === "loading" ? <LoadingPanel label="Loading account" /> : session.status !== "authenticated" ? <StatusPanel title="Sign in required" description="Sign in with an instance administrator account." /> : !session.user?.isInstanceAdmin ? <StatusPanel tone="error" title="Administration unavailable" description="Your account is not an instance administrator." /> : loading ? <LoadingPanel label="Loading instance settings" /> : settings ? <div className="admin-layout">
        <nav aria-label="Administration sections"><a href="#policy">Policy</a><a href="#features">Features</a><a href="#accounts">Accounts</a></nav>
        <div className="admin-sections">
          <SettingsForm onSaved={setSettings} settings={settings} />
          <AccountSafetyForm />
        </div>
      </div> : <StatusPanel tone="error" title="Settings unavailable" description="Instance settings could not be loaded." />}
    </main>
  </AppShell>;
}

function SettingsForm({ onSaved, settings }: { onSaved: (settings: InstanceSettingsContract) => void; settings: InstanceSettingsContract }) {
  const [pending, setPending] = useState(false);
  const publicPolicyUrls = objectValue(settings.settings.publicPolicyUrls);
  const uploads = objectValue(settings.settings.uploads);
  const rateLimits = objectValue(settings.settings.rateLimits);
  const features = objectValue(settings.settings.features);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const formElement = event.currentTarget; setPending(true);
    const form = new FormData(formElement);
    try {
      const updated = await updateInstanceSettings({
        registrationMode: String(form.get("registrationMode")) as InstanceSettingsContract["registrationMode"],
        settings: {
          features: {
            chat: form.get("featureChat") === "on",
            search: form.get("featureSearch") === "on",
            uploads: form.get("featureUploads") === "on",
            voice: form.get("featureVoice") === "on",
          },
          publicPolicyUrls: {
            privacy: String(form.get("privacyUrl") ?? ""),
            terms: String(form.get("termsUrl") ?? ""),
          },
          rateLimits: { authPerMinute: Number(form.get("authRateLimit")) },
          uploads: { maxBytes: Number(form.get("uploadLimitMb")) * 1024 * 1024 },
        },
        singlePlaceMode: form.get("singlePlaceMode") === "on",
      });
      onSaved(updated);
      toast.success("Instance settings saved.");
    } catch (error) { toast.error(placeErrorMessage(error, "Instance settings could not be saved.")); }
    finally { setPending(false); }
  }

  return <form className="admin-settings-form" onSubmit={submit}>
    <section className="settings-section" id="policy"><p className="eyebrow">Policy</p><h2>Access and public documents</h2><div className="admin-field-grid"><label className="form-field">Registration<Select defaultValue={settings.registrationMode} name="registrationMode" options={[{ label: "Open", value: "open" }, { label: "Invite only", value: "invite_only" }, { label: "Closed", value: "closed" }]} /></label><label className="toggle-field"><input defaultChecked={settings.singlePlaceMode} name="singlePlaceMode" type="checkbox" /><span>Single-place mode</span></label><label className="form-field">Terms URL<input defaultValue={stringValue(publicPolicyUrls.terms)} name="termsUrl" type="url" /></label><label className="form-field">Privacy URL<input defaultValue={stringValue(publicPolicyUrls.privacy)} name="privacyUrl" type="url" /></label><label className="form-field">Upload limit (MB)<input defaultValue={numberValue(uploads.maxBytes, 25 * 1024 * 1024) / 1024 / 1024} max={2048} min={1} name="uploadLimitMb" type="number" /></label><label className="form-field">Authentication attempts per minute<input defaultValue={numberValue(rateLimits.authPerMinute, 20)} max={1000} min={1} name="authRateLimit" type="number" /></label></div></section>
    <section className="settings-section" id="features"><p className="eyebrow">Availability</p><h2>Feature switches</h2><div className="feature-switches"><FeatureToggle defaultChecked={booleanValue(features.search, true)} label="Search" name="featureSearch" /><FeatureToggle defaultChecked={booleanValue(features.uploads, true)} label="Uploads" name="featureUploads" /><FeatureToggle defaultChecked={booleanValue(features.chat, true)} label="Chat" name="featureChat" /><FeatureToggle defaultChecked={booleanValue(features.voice, true)} label="Voice" name="featureVoice" /></div><div className="bootstrap-status"><CheckCircle2 size={18} /><span><strong>Bootstrap administrator configured</strong><small>Secrets remain environment-managed and are not available here.</small></span></div><button className="primary-button" disabled={pending} type="submit"><Save size={16} />{pending ? "Saving..." : "Save settings"}</button></section>
  </form>;
}

function AccountSafetyForm() {
  const [pending, setPending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const formElement = event.currentTarget; setPending(true);
    const form = new FormData(formElement);
    const action = String(form.get("action")) as "restore" | "suspend";
    try {
      const result = await updateAccountStatus(String(form.get("userId")), action, { reason: String(form.get("reason")), reasonCode: String(form.get("reasonCode")) as ActionReasonCode });
      toast.success(`Account is now ${result.status}.`);
      formElement.reset();
    } catch (error) { toast.error(placeErrorMessage(error, "Account status could not be changed.")); }
    finally { setPending(false); }
  }
  return <section className="settings-section" id="accounts"><p className="eyebrow">Safety</p><h2>Account status</h2><form className="account-safety-form" onSubmit={submit}><label className="form-field">User ID<input name="userId" pattern="[0-9a-fA-F-]{36}" required /></label><label className="form-field">Action<Select name="action" options={[{ label: "Suspend", value: "suspend" }, { label: "Restore", value: "restore" }]} /></label><label className="form-field">Reason code<Select name="reasonCode" options={actionReasonCodes.map((reason) => ({ label: reason.replaceAll("_", " "), value: reason }))} /></label><label className="form-field wide">Reason<textarea maxLength={4000} name="reason" required rows={3} /></label><button className="danger-button" disabled={pending} type="submit"><ShieldX size={16} />{pending ? "Applying..." : "Apply status"}</button><span className="account-restore-icon" aria-hidden="true"><RotateCcw size={16} /></span></form></section>;
}

function FeatureToggle({ defaultChecked, label, name }: { defaultChecked: boolean; label: string; name: string }) { return <label className="toggle-field"><input defaultChecked={defaultChecked} name={name} type="checkbox" /><SlidersHorizontal size={16} /><span>{label}</span></label>; }
function objectValue(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function stringValue(value: unknown): string { return typeof value === "string" ? value : ""; }
function numberValue(value: unknown, fallback: number): number { return typeof value === "number" && Number.isFinite(value) ? value : fallback; }
function booleanValue(value: unknown, fallback: boolean): boolean { return typeof value === "boolean" ? value : fallback; }