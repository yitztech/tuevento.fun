import { countMetrics, type Event, type Invitation, type Notification, type SyncChanges, type SyncDeleted } from "@tuevento/contracts";
import type { OfflineStore } from "./store";

/** Clave del perfil del proveedor: hay uno por cuenta. */
export const PROVIDER_KEY = "me";

/** Invitaciones guardadas de un evento. */
export async function localInvitations(store: OfflineStore, eventId: string) {
  return (await store.list<Invitation>("invitations")).filter((i) => i.eventId === eventId);
}

/**
 * Recalcula las métricas de un evento con sus invitaciones guardadas: la sincronización solo vuelve
 * a enviar la invitación cuando responde un invitado, no el evento.
 */
export async function refreshMetrics(store: OfflineStore, eventId: string) {
  const event = await store.get<Event>("events", eventId);
  if (!event) return;
  await store.set("events", eventId, { ...event, metrics: countMetrics(await localInvitations(store, eventId)) });
}

/** Borra un evento con lo que cuelga de él (como la cascada del servidor). */
export async function removeEventLocally(store: OfflineStore, eventId: string) {
  await store.delete("events", eventId);
  for (const invitation of await localInvitations(store, eventId)) await store.delete("invitations", invitation.id);
  for (const notification of await store.list<Notification>("notifications"))
    if (notification.eventId === eventId) await store.delete("notifications", notification.id);
}

export async function removeLocally(store: OfflineStore, deleted: SyncDeleted) {
  if (deleted.entity === "event") return removeEventLocally(store, deleted.id);
  if (deleted.entity === "invitation") {
    const invitation = await store.get<Invitation>("invitations", deleted.id);
    await store.delete("invitations", deleted.id);
    if (invitation) await refreshMetrics(store, invitation.eventId);
    return;
  }
  if (deleted.entity === "notification") return store.delete("notifications", deleted.id);
  return store.delete("provider", PROVIDER_KEY);
}

/**
 * Aplica una página de cambios. `busy` son los ids con escrituras aún en la cola: no se pisan con
 * lo del servidor (se actualizarán cuando la cola se envíe).
 */
export async function applyChanges(store: OfflineStore, page: SyncChanges, busy: Set<string> = new Set()) {
  const touched = new Set<string>();
  for (const event of page.events) if (!busy.has(event.id)) await store.set("events", event.id, event);
  for (const invitation of page.invitations) {
    if (busy.has(invitation.id)) continue;
    await store.set("invitations", invitation.id, invitation);
    touched.add(invitation.eventId);
  }
  for (const notification of page.notifications) await store.set("notifications", notification.id, notification);
  if (page.provider) await store.set("provider", PROVIDER_KEY, page.provider);
  for (const deleted of page.deleted) if (!busy.has(deleted.id)) await removeLocally(store, deleted);
  for (const eventId of touched) await refreshMetrics(store, eventId);
}

/** Datos de la cuenta (sin la cola ni el cursor), para volver a descargarlo todo. */
export async function clearData(store: OfflineStore) {
  for (const collection of ["events", "invitations", "notifications", "provider"] as const)
    for (const item of await store.list<{ id?: string }>(collection))
      if (item.id) await store.delete(collection, collection === "provider" ? PROVIDER_KEY : item.id);
}
