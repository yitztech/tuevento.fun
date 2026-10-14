import { tr, formatLocale } from "./i18n";
import { createContext, useContext } from "react";
import { EventApi } from "@tuevento/client";
import type { User, Event, Notification } from "@tuevento/contracts";
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
    ? tr(error.message)
    : tr("No se pudo completar la acción. Vuelve a intentarlo.");
