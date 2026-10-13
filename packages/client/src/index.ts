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
  fetch?: typeof globalThis.fetch;
  language?: () => "es" | "en";
};
/** Framework independent: inject fetch/baseUrl from browser, Electron or Tauri. */
export class EventApi {
  private transport: typeof globalThis.fetch;
  constructor(private options: ApiOptions) {
    this.transport = options.fetch ?? globalThis.fetch.bind(globalThis);
  }
  async request<T>(path: string, method = "GET", body?: unknown): Promise<T> {
    const response = await this.transport(`${this.options.baseUrl}${path}`, {
      method,
      credentials: "include",
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        "X-TuEvento-Client": "1",
        "X-Client-Platform": this.options.platform || "web",
        "X-App-Version": this.options.appVersion || "web",
        "Accept-Language": this.options.language?.() || "es",
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok)
      throw new ApiError(
        response.status,
        typeof data.message === "string"
          ? data.message
          : "No se pudo completar la solicitud.",
        data.fields,
      );
    return data;
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
  notifications = () => this.request<Notification[]>("/notifications");
  readNotifications = () => this.request("/notifications/read", "POST", {});
  publicInvitation = (token: string) =>
    this.request<PublicInvitation>(`/invitations/${token}`);
  rsvp = (token: string, members: { id: string; status: Status }[]) =>
    this.request<PublicInvitation>(`/invitations/${token}/rsvp`, "POST", {
      members,
    });
}
