import { tr, trMessage, formatLocale } from "./i18n";
import { createContext, useContext } from "react";
import { EventApi } from "@tuevento/client";
import type { User, Event, Notification, GeoPoint } from "@tuevento/contracts";
export type Runtime = {
  apiBase: string;
  platform?: "web" | "android" | "ios";
  appVersion?: string;
  startNativeLogin?: () => Promise<void>;
  publicOrigin: string;
  fetch?: typeof globalThis.fetch;
  copy: (text: string) => Promise<void>;
  openExternal: (url: string) => void;
  subscribe?: (onChange: () => void) => () => void;
  /** Posición del dispositivo, con el permiso del sistema. Sin ella no se ofrece «Usar mi ubicación». */
  getPosition?: () => Promise<GeoPoint>;
  /** Hoja de compartir del sistema. Sin ella se copia el texto. */
  share?: (data: { title: string; text: string; url?: string }) => Promise<void>;
};
export type AppState = {
  api: EventApi;
  runtime: Runtime;
  user: User | null;
  setUser: (u: User | null) => void;
  events: Event[];
  notifications: Notification[];
  reload: () => Promise<void>;
  toast: (message: string) => void;
  config: {
    googleClientId: string;
    demoEnabled: boolean;
    /** Si el servidor cobra los eventos (Stripe configurado). */
    paymentsEnabled: boolean;
  };
};
export const AppContext = createContext<AppState>(null!);
export const useApp = () => useContext(AppContext);
/**
 * Fecha guardada en UTC mostrada en una zona: la del evento cuando se indica y,
 * si no (notificaciones, actividad), la zona horaria del propio usuario.
 */
export const dateText = (
  date: string,
  timeZone?: string,
  options: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "long",
    year: "numeric",
  },
) =>
  new Intl.DateTimeFormat(formatLocale(), { ...options, timeZone }).format(
    new Date(date),
  );
export const errorText = (error: unknown) =>
  error instanceof Error
    ? trMessage(error.message)
    : tr("common.couldntCompleteActionPlease");
