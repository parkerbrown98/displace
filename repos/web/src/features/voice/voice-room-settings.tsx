"use client";

import { Archive, Plus, Save } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { FormField } from "@/components/ui/form-field";
import { Select } from "@/components/ui/select";
import { placeErrorMessage } from "@/features/places/place-access";
import { placePermissions, type PlaceContextContract, type PlacePermission } from "@/features/places/place-contract";
import { archiveVoiceRoom, createVoiceRoom, listVoiceRooms, updateVoiceRoom } from "./voice-client";
import type { CreateVoiceRoomInput, VoiceRoomContract, VoiceRoomInput } from "./voice-contracts";

type Notice = { kind: "error" | "success"; text: string } | null;

export function VoiceRoomSettings({ context, onForbidden }: { context: PlaceContextContract; onForbidden: (error: unknown) => Promise<void> }) {
  const [rooms, setRooms] = useState<VoiceRoomContract[]>();
  const [notice, setNotice] = useState<Notice>(null);
  const [pending, setPending] = useState<string>();

  async function refresh() { setRooms(await listVoiceRooms(context.place.id)); }

  useEffect(() => {
    let active = true;
    void listVoiceRooms(context.place.id)
      .then((value) => { if (active) setRooms(value); })
      .catch((error) => { if (active) setNotice({ kind: "error", text: placeErrorMessage(error, "Voice rooms could not be loaded.") }); });
    return () => { active = false; };
  }, [context.place.id]);

  async function run(key: string, action: () => Promise<unknown>, success: string) {
    setPending(key); setNotice(null);
    try { await action(); await refresh(); setNotice({ kind: "success", text: success }); return true; }
    catch (error) { await onForbidden(error); setNotice({ kind: "error", text: placeErrorMessage(error, "Voice rooms could not be changed.") }); return false; }
    finally { setPending(undefined); }
  }

  return <section className="settings-section" id="voice">
    <p className="eyebrow">Live audio</p><h2>Voice rooms</h2>
    <p className="settings-muted">Order audio rooms, set capacity, and choose separate permissions for listening and speaking.</p>
    {notice ? <p className={`form-message form-message-${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"}>{notice.text}</p> : null}
    {rooms?.length ? <div className="role-list">{rooms.map((room) => <VoiceRoomEditor disabled={Boolean(pending)} key={room.id} room={room} onArchive={() => run(`archive-${room.id}`, () => archiveVoiceRoom(context.place.id, room.id), "Voice room archived.")} onSave={(input) => run(`save-${room.id}`, () => updateVoiceRoom(context.place.id, room.id, input), "Voice room saved.")} />)}</div> : <p className="settings-muted">No voice rooms yet.</p>}
    <NewVoiceRoom disabled={Boolean(pending)} onCreate={(input) => run("create", () => createVoiceRoom(context.place.id, input), "Voice room created.")} />
  </section>;
}

function VoiceRoomEditor({ disabled, onArchive, onSave, room }: { disabled: boolean; onArchive: () => Promise<boolean>; onSave: (input: VoiceRoomInput) => Promise<boolean>; room: VoiceRoomContract }) {
  return <details className="role-editor"><summary><span><strong>{room.name}</strong></span><small>{room.participants.length}/{room.capacity} connected · position {room.position}</small></summary><form className="settings-form" onSubmit={(event) => { event.preventDefault(); void onSave(roomInput(new FormData(event.currentTarget))); }}><VoiceFields room={room} /><div className="button-row"><button className="secondary-button" disabled={disabled} type="submit"><Save size={16} /> Save room</button><button className="danger-button" disabled={disabled} onClick={() => { if (window.confirm(`Archive ${room.name}? Connected members will not receive another join token.`)) void onArchive(); }} type="button"><Archive size={16} /> Archive</button></div></form></details>;
}

function NewVoiceRoom({ disabled, onCreate }: { disabled: boolean; onCreate: (input: CreateVoiceRoomInput) => Promise<boolean> }) {
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const data = new FormData(form);
    if (await onCreate({ ...roomInput(data), slug: String(data.get("slug") ?? "") })) form.reset();
  }
  return <details className="role-editor new-role" open><summary><span><Plus size={16} /><strong>Create voice room</strong></span></summary><form className="settings-form" onSubmit={submit}><FormField defaultValue="lounge" hint="Lowercase letters, numbers, and hyphens." label="Room slug" maxLength={80} name="slug" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required /><VoiceFields /><button className="primary-button" disabled={disabled} type="submit"><Plus size={16} /> Create room</button></form></details>;
}

function VoiceFields({ room }: { room?: VoiceRoomContract }) {
  return <><FormField defaultValue={room?.name ?? "Lounge"} label="Name" maxLength={120} name="name" required /><div className="policy-grid"><FormField defaultValue={room?.position ?? 0} label="Position" min={0} name="position" type="number" required /><FormField defaultValue={room?.capacity ?? 25} label="Capacity" max={500} min={1} name="capacity" type="number" required /></div><PermissionSelect defaultValue={room?.listenPermission ?? "voice.join"} label="Listen permission" name="listenPermission" /><PermissionSelect defaultValue={room?.speakPermission ?? "voice.join"} label="Speak permission" name="speakPermission" /></>;
}

function PermissionSelect({ defaultValue, label, name }: { defaultValue: PlacePermission; label: string; name: string }) {
  return <label className="form-field">{label}<Select defaultValue={defaultValue} name={name} options={placePermissions.map((permission) => ({ label: permission.replace(".", " "), value: permission }))} /></label>;
}

function roomInput(form: FormData): VoiceRoomInput {
  return { capacity: Number(form.get("capacity") ?? 25), listenPermission: permission(form, "listenPermission"), name: String(form.get("name") ?? ""), position: Number(form.get("position") ?? 0), speakPermission: permission(form, "speakPermission") };
}

function permission(form: FormData, field: string): PlacePermission {
  const value = String(form.get(field) ?? "voice.join") as PlacePermission;
  return placePermissions.includes(value) ? value : "voice.join";
}