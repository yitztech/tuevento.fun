import type {
  User,
  Event,
  EventInput,
  Invitation,
  InvitationInput,
  Notification,
  EventLanding,
  LandingAddress,
  RegistrationInput,
  PublicInvitation,
  RegisterInput,
  ProfileInput,
  Status,
  Locale,
  Postcard,
  PostcardDesign,
  PostcardVersion,
  GeoPlace,
  GeoPoint,
  AccountType,
  ProviderProfile,
  ProviderPublic,
  ProviderProfileInput,
  ProviderService,
  ProviderServiceInput,
} from "@tuevento/contracts";
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public fields?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
export type ApiOptions = {
  baseUrl: string;
  platform?: "web" | "android" | "ios";
  appVersion?: string;
  locale?: Locale | (() => Locale);
  fetch?: typeof globalThis.fetch;
};
/**
 * Framework independent: inject fetch/baseUrl from browser, Electron or Tauri.
 * El idioma de las respuestas lo decide el servidor por el Host del dominio (o X-App-Locale en apps móviles).
 */
export class EventApi {
  private transport: typeof globalThis.fetch;
  constructor(private options: ApiOptions) {
    this.transport = options.fetch ?? globalThis.fetch.bind(globalThis);
  }
  async request<T>(path: string, method = "GET", body?: unknown): Promise<T> {
    const resolvedLocale =
      typeof this.options.locale === "function"
        ? this.options.locale()
        : this.options.locale;
    const response = await this.transport(`${this.options.baseUrl}${path}`, {
      method,
      credentials: "include",
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        "X-TuEvento-Client": "1",
        "X-Client-Platform": this.options.platform || "web",
        "X-App-Version": this.options.appVersion || "web",
        ...(resolvedLocale ? { "X-App-Locale": resolvedLocale } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok)
      throw new ApiError(
        response.status,
        typeof data.message === "string"
          ? data.message
          : "common.couldntCompleteRequest",
        data.fields,
      );
    return data;
  }
  subscribeNewsletter(email: string, name?: string) {
    return this.request<{ ok: boolean; message: string }>(
      "/newsletter/subscribe",
      "POST",
      { email, name },
    );
  }
  config = () =>
    this.request<{ googleClientId: string; demoEnabled: boolean }>("/config");
  me = () => this.request<User>("/auth/me");
  demo = () => this.request<User>("/auth/demo", "POST", {});
  register = (data: RegisterInput) =>
    this.request<User>("/auth/register", "POST", data);
  login = (email: string, password: string) =>
    this.request<User>("/auth/login", "POST", { email, password });
  /** `accountType` solo cuenta si la cuenta se crea en ese momento. */
  google = (credential: string, nonce: string, accountType?: AccountType) =>
    this.request<User>("/auth/google", "POST", { credential, nonce, ...(accountType ? { accountType } : {}) });
  forgotPassword = (email: string) =>
    this.request<{ ok: boolean; message: string }>(
      "/auth/password/forgot",
      "POST",
      { email },
    );
  resetPassword = (token: string, password: string) =>
    this.request<User>("/auth/password/reset", "POST", { token, password });
  /** Confirmar el correo de la cuenta con el enlace del correo, y volver a pedir ese correo. */
  verifyEmail = (token: string) => this.request<User>("/auth/email/verify", "POST", { token });
  resendVerification = () => this.request<{ ok: boolean }>("/auth/email/resend", "POST", {});
  /** Baja de los avisos a invitados desde el enlace firmado de un correo. */
  unsubscribe = (h: string, s: string) => this.request<{ ok: boolean }>("/mail/unsubscribe", "POST", { h, s });
  googleNonce = () =>
    this.request<{ nonce: string }>("/auth/google/nonce", "POST", {});
  logout = () => this.request("/auth/logout", "POST", {});
  profile = (data: ProfileInput) =>
    this.request<User>("/profile", "PATCH", data);
  avatar = (dataUrl: string) =>
    this.request<User>("/profile/avatar", "PUT", { dataUrl });
  events = () => this.request<Event[]>("/events");
  event = (id: string) => this.request<Event>(`/events/${id}`);
  saveEvent = (data: EventInput, id?: string) =>
    this.request<Event>(
      id ? `/events/${id}` : "/events",
      id ? "PATCH" : "POST",
      data,
    );
  deleteEvent = (id: string) => this.request(`/events/${id}`, "DELETE");
  invitations = (id: string) =>
    this.request<Invitation[]>(`/events/${id}/invitations`);
  saveInvitation = (eventId: string, data: InvitationInput, id?: string) =>
    this.request<Invitation>(
      `/events/${eventId}/invitations${id ? `/${id}` : ""}`,
      id ? "PUT" : "POST",
      data,
    );
  deleteInvitation = (eventId: string, id: string) =>
    this.request(`/events/${eventId}/invitations/${id}`, "DELETE");
  postcard = (eventId: string) =>
    this.request<Postcard>(`/events/${eventId}/postcard`);
  savePostcard = (eventId: string, design: PostcardDesign) =>
    this.request<Postcard>(`/events/${eventId}/postcard`, "PUT", design);
  postcardVersions = (eventId: string) =>
    this.request<PostcardVersion[]>(`/events/${eventId}/postcard/versions`);
  restorePostcard = (eventId: string, versionId: string) =>
    this.request<Postcard>(`/events/${eventId}/postcard/versions/${versionId}/restore`, "POST", {});
  uploadPostcardPhoto = (eventId: string, dataUrl: string) =>
    this.request<{ id: string; url: string }>(`/events/${eventId}/postcard/images`, "POST", { dataUrl });
  removePostcardPhoto = (eventId: string, imageId: string) =>
    this.request<Postcard>(`/events/${eventId}/postcard/images/${imageId}`, "DELETE");
  notifications = () => this.request<Notification[]>("/notifications");
  readNotifications = () => this.request("/notifications/read", "POST", {});
  publicInvitation = (token: string) =>
    this.request<PublicInvitation>(`/invitations/${token}`);
  /** Enlace personal: concede al invitado el acceso a la landing y dice cuál es. */
  invitationAccess = (token: string) =>
    this.request<LandingAddress>(`/invitations/${token}/access`, "POST", {});
  landing = (code: string, slug: string) =>
    this.request<EventLanding>(`/public/landing/${code}/${slug}`);
  unlockLanding = (code: string, slug: string, password: string) =>
    this.request<{ ok: boolean }>(`/public/landing/${code}/${slug}/unlock`, "POST", { password });
  /** Las direcciones /e/<dirección> anteriores a la landing: a qué landing llevan. */
  legacyEventAddress = (slug: string) =>
    this.request<LandingAddress>(`/public/events/${slug}`);
  slugAvailable = (slug: string, eventId?: string) => {
    const query = new URLSearchParams({ slug, ...(eventId ? { eventId } : {}) });
    return this.request<{ available: boolean }>(`/events/slug-available?${query}`);
  };
  registerInvitation = (token: string, data: RegistrationInput) =>
    this.request<{ token: string }>(`/invitations/${token}/register`, "POST", data);
  /** Lugares que coinciden con un texto (al pulsar «Buscar en el mapa»). */
  geoSearch = (q: string) =>
    this.request<GeoPlace[]>(`/geo/search?${new URLSearchParams({ q })}`);
  geoReverse = (point: GeoPoint) =>
    this.request<{ place: GeoPlace | null }>(
      `/geo/reverse?${new URLSearchParams({ lat: String(point.lat), lng: String(point.lng) })}`,
    );
  /** Coordenadas de un enlace de Google Maps, Apple Maps o Waze. */
  parseMapLink = (url: string) => this.request<GeoPoint>("/geo/parse-link", "POST", { url });
  // Panel del proveedor (docs/PLAN-PROVEEDORES-Y-OFFLINE.md, fase 3)
  /** Página pública de un proveedor; con una dirección anterior, el perfil con la actual. */
  providerPage = (slug: string) => this.request<ProviderPublic>(`/public/providers/${encodeURIComponent(slug)}`);
  providerProfile = () => this.request<{ profile: ProviderProfile | null }>("/provider/profile");
  saveProviderProfile = (data: ProviderProfileInput) => this.request<ProviderProfile>("/provider/profile", "PUT", data);
  providerSlugAvailable = (slug: string) =>
    this.request<{ available: boolean }>(`/provider/slug-available?slug=${encodeURIComponent(slug)}`);
  publishProvider = (publish: boolean) =>
    this.request<ProviderProfile>(publish ? "/provider/publish" : "/provider/unpublish", "POST", {});
  createProviderService = (data: ProviderServiceInput) => this.request<ProviderService>("/provider/services", "POST", data);
  updateProviderService = (id: string, data: ProviderServiceInput) =>
    this.request<ProviderService>(`/provider/services/${id}`, "PUT", data);
  removeProviderService = (id: string) => this.request<void>(`/provider/services/${id}`, "DELETE");
  orderProviderServices = (ids: string[]) => this.request<ProviderProfile>("/provider/services/order", "PUT", { ids });
  uploadProviderImage = (data: { dataUrl: string; alt: string; serviceId: string | null }) =>
    this.request<ProviderProfile>("/provider/images", "POST", data);
  updateProviderImage = (id: string, data: { alt: string; serviceId: string | null }) =>
    this.request<ProviderProfile>(`/provider/images/${id}`, "PATCH", data);
  removeProviderImage = (id: string) => this.request<ProviderProfile>(`/provider/images/${id}`, "DELETE");
  orderProviderImages = (ids: string[]) => this.request<ProviderProfile>("/provider/images/order", "PUT", { ids });
  chooseProviderImage = (kind: "cover" | "logo", imageId: string | null) =>
    this.request<ProviderProfile>(`/provider/${kind}`, "PUT", { imageId });
  rsvp = (token: string, members: { id: string; status: Status }[]) =>
    this.request<PublicInvitation>(`/invitations/${token}/rsvp`, "POST", {
      members,
    });
}
