import type {
  User,
  Event,
  EventInput,
  Invitation,
  InvitationInput,
  Notification,
  PublicInvitation,
  RegisterInput,
  ProfileInput,
  Status,
  Locale,
  Postcard,
  PostcardDesign,
  PostcardVersion,
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
  google = (credential: string, nonce: string) =>
    this.request<User>("/auth/google", "POST", { credential, nonce });
  forgotPassword = (email: string) =>
    this.request<{ ok: boolean; message: string }>(
      "/auth/password/forgot",
      "POST",
      { email },
    );
  resetPassword = (token: string, password: string) =>
    this.request<User>("/auth/password/reset", "POST", { token, password });
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
  rsvp = (token: string, members: { id: string; status: Status }[]) =>
    this.request<PublicInvitation>(`/invitations/${token}/rsvp`, "POST", {
      members,
    });
}
