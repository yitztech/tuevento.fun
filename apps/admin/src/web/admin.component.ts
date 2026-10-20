import { HttpClient, HttpErrorResponse } from "@angular/common/http";
import { Component, DestroyRef, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { firstValueFrom } from "rxjs";
import type { Countries, EventRow, Page, Stats, UserRow } from "./api";

type Session = "checking" | "out" | "in";
type Tab = "summary" | "users" | "events";

const REFRESH_MS = 60 * 1000;
const PLATFORMS: Record<string, string> = { web: "Web", android: "Android", ios: "iOS" };
const THEMES: Record<string, string> = {
  gold: "Dorado", neon: "Neón", tropical: "Tropical", minimal: "Minimalista", floral: "Floral", kids: "Infantil",
  winter: "Invierno", spring: "Primavera", autumn: "Otoño", silver: "Plata", copper: "Cobre", disco: "Disco",
  starlight: "Luz de estrellas", sand: "Arena", wildflower: "Flores silvestres", pastel: "Pastel",
};
const MESSAGES = {
  invalid: "Usuario o contraseña incorrectos.",
  blocked: "Demasiados intentos. Espera unos minutos.",
  error: "No se pudieron cargar los datos.",
  countries: "No se pudo consultar Umami.",
};
const REGIONS = typeof Intl.DisplayNames === "function" ? new Intl.DisplayNames(["es"], { type: "region" }) : null;
const JSON_HEADERS = { "Content-Type": "application/json" };

const statusOf = (error: unknown) => (error instanceof HttpErrorResponse ? error.status : 0);

@Component({
  selector: "admin-root",
  imports: [FormsModule],
  templateUrl: "./admin.component.html",
})
export class AdminComponent {
  private readonly http = inject(HttpClient);

  readonly periods = [7, 30, 90];

  readonly session = signal<Session>("checking");
  readonly tab = signal<Tab>("summary");
  readonly days = signal(30);
  readonly page = signal(1);
  readonly busy = signal(false);
  readonly error = signal("");
  readonly loginError = signal("");
  readonly showPassword = signal(false);
  readonly stats = signal<Stats | null>(null);
  readonly users = signal<Page<UserRow> | null>(null);
  readonly events = signal<Page<EventRow> | null>(null);
  readonly countries = signal<Countries | null>(null);
  readonly countriesError = signal("");
  credentials = { username: "", password: "" };

  constructor() {
    // Actualiza el resumen cada minuto para ver a los conectados avanzar.
    const timer = setInterval(() => {
      if (this.session() === "in" && this.tab() === "summary" && !this.busy()) this.loadStats();
    }, REFRESH_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));

    // ── Arranque ──────────────────────────────────────────────────────────
    firstValueFrom(this.http.get("/api/session")).then(
      () => {
        this.session.set("in");
        this.show("summary");
      },
      (error: unknown) => {
        if (statusOf(error) !== 401) this.error.set(MESSAGES.error);
        this.session.set("out");
      },
    );
  }

  // ── Textos ──────────────────────────────────────────────────────────────
  platformName(platform: string) {
    return PLATFORMS[platform] || platform;
  }

  themeName(theme: string) {
    return THEMES[theme] || theme;
  }

  // Umami da el código ISO del país ("MX"); el nombre sale en español del navegador
  countryName(code: string | null) {
    if (!code) return "Desconocido";
    try {
      return REGIONS?.of(code) || code;
    } catch {
      return code;
    }
  }

  date(value: string | null) {
    if (!value) return "";
    return new Date(value).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
  }

  // ── Gráficas: barras proporcionales, sin librerías ──────────────────────
  maxOf<T>(rows: T[] | undefined, field: keyof T) {
    return Math.max(1, ...(rows || []).map((r) => Number(r[field]) || 0));
  }

  share(value: number, max: number) {
    return Math.round(((value || 0) / max) * 100);
  }

  totalOnline() {
    const stats = this.stats();
    if (!stats) return 0;
    return stats.overview.online.reduce((sum, p) => sum + p.visitors, 0);
  }

  // ── Red ─────────────────────────────────────────────────────────────────
  private async request<T>(url: string): Promise<T> {
    this.busy.set(true);
    this.error.set("");
    try {
      const data = await firstValueFrom(this.http.get<T>(url));
      this.busy.set(false);
      return data;
    } catch (error) {
      this.busy.set(false);
      if (statusOf(error) === 401) this.session.set("out");
      else this.error.set(MESSAGES.error);
      throw error;
    }
  }

  togglePassword() {
    this.showPassword.update((shown) => !shown);
  }

  login() {
    this.loginError.set("");
    this.showPassword.set(false);
    this.busy.set(true);
    firstValueFrom(this.http.post("/api/login", this.credentials, { headers: JSON_HEADERS })).then(
      () => {
        this.busy.set(false);
        this.credentials.password = "";
        this.session.set("in");
        this.show("summary");
      },
      (error: unknown) => {
        this.busy.set(false);
        this.credentials.password = "";
        this.loginError.set(statusOf(error) === 429 ? MESSAGES.blocked : MESSAGES.invalid);
      },
    );
  }

  logout() {
    firstValueFrom(this.http.post("/api/logout", {}, { headers: JSON_HEADERS }))
      .catch(() => undefined)
      .finally(() => {
        this.session.set("out");
        this.stats.set(null);
        this.users.set(null);
        this.events.set(null);
        this.countries.set(null);
      });
  }

  setDays(days: number) {
    this.days.set(days);
    this.loadStats();
  }

  loadStats() {
    this.loadCountries();
    return this.request<Stats>(`/api/stats?days=${this.days()}`).then(
      (data) => this.stats.set(data),
      () => undefined,
    );
  }

  // Aparte del resumen: si Umami falla, el resto del panel se sigue viendo
  loadCountries() {
    this.countriesError.set("");
    return firstValueFrom(this.http.get<Countries>(`/api/countries?days=${this.days()}`)).then(
      (data) => this.countries.set(data),
      (error: unknown) => {
        if (statusOf(error) === 401) return;
        this.countries.set(null);
        this.countriesError.set(MESSAGES.countries);
      },
    );
  }

  show(tab: Tab) {
    this.tab.set(tab);
    this.page.set(1);
    this.reload();
  }

  go(page: number) {
    this.page.set(Math.max(1, page));
    this.reload();
  }

  reload() {
    if (this.session() !== "in") return;
    if (this.tab() === "summary") return this.loadStats();
    if (this.tab() === "users") {
      return this.request<Page<UserRow>>(`/api/users?page=${this.page()}`).then(
        (data) => this.users.set(data),
        () => undefined,
      );
    }
    return this.request<Page<EventRow>>(`/api/events?page=${this.page()}`).then(
      (data) => this.events.set(data),
      () => undefined,
    );
  }
}
