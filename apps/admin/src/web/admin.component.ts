import { HttpClient, HttpErrorResponse } from "@angular/common/http";
import { Component, DestroyRef, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { firstValueFrom } from "rxjs";
import type { Countries, CouponRow, EventRow, Page, SitePalette, Stats, UserRow } from "./api";

type Session = "checking" | "out" | "in";
type Tab = "summary" | "users" | "events" | "coupons" | "design";

const REFRESH_MS = 60 * 1000;
const PLATFORMS: Record<string, string> = { web: "Web", android: "Android", ios: "iOS" };
const THEMES: Record<string, string> = {
  gold: "Dorado", neon: "Neón", tropical: "Tropical", minimal: "Minimalista", floral: "Floral", kids: "Infantil",
  winter: "Invierno", spring: "Primavera", autumn: "Otoño", silver: "Plata", copper: "Cobre", disco: "Disco",
  starlight: "Luz de estrellas", sand: "Arena", wildflower: "Flores silvestres", pastel: "Pastel",
};
// Muestras de cada paleta, en este orden: principal, celebración, acento, fondo suave y texto.
// Copia de `sitePalettes` (packages/contracts) y de los tokens de packages/app/src/styles.css para Terracota.
// `hue` es el giro del logo de `brandHueRotation` (packages/app/src/ui/site/brand-palette.ts); null conserva
// la marca original. El panel pinta el logo completo con ese mismo filtro.
const PALETTES = [
  { id: "terracotta", name: "Terracota", hue: 325, colors: ["#a63f30", "#ffca66", "#e25c80", "#f9e6dc", "#3d2a25"] },
  { id: "fuchsia-plum-amber", name: "Fucsia, Ciruela y Ámbar", hue: null, colors: ["#d9004b", "#ffc400", "#ff8a00", "#fff0f5", "#3d002b"] },
  { id: "plum-champagne", name: "Ciruela y Champagne", hue: 260, colors: ["#570035", "#ffd166", "#ff8a00", "#fff1f6", "#320d26"] },
  { id: "mandarin-raspberry", name: "Mandarina y Frambuesa", hue: 345, colors: ["#b94a00", "#d9004b", "#ffc400", "#fff0e3", "#40152d"] },
  { id: "raspberry-vanilla", name: "Frambuesa y Vainilla", hue: 285, colors: ["#a90046", "#ffe08a", "#ff8a00", "#fff0f6", "#3d102a"] },
  { id: "ocean-aqua", name: "Océano y Aguamarina", hue: 155, colors: ["#0a5a8a", "#5ce1d6", "#1fb6c9", "#e8f5fb", "#06283d"] },
  { id: "forest-mint", name: "Bosque y Menta", hue: 75, colors: ["#12633f", "#8ee6b8", "#2fb67c", "#e7f6ee", "#0b2e20"] },
  { id: "indigo-ice", name: "Índigo y Hielo", hue: 180, colors: ["#3a3fb8", "#a9d6ff", "#5b8def", "#eceefb", "#15174a"] },
  { id: "petrol-lime", name: "Petróleo y Lima", hue: 130, colors: ["#0f5c63", "#c6ec5a", "#27a8a0", "#e8f4f2", "#0d2f33"] },
];
const MESSAGES = {
  invalid: "Usuario o contraseña incorrectos.",
  blocked: "Demasiados intentos. Espera unos minutos.",
  error: "No se pudieron cargar los datos.",
  countries: "No se pudo consultar Umami.",
  couponDuplicate: "Ya existe un cupón con ese código.",
  couponInvalid: "Revisa los datos del cupón.",
  couponError: "No se pudo guardar el cupón.",
  paletteError: "No se pudo guardar la paleta.",
};
const REGIONS = typeof Intl.DisplayNames === "function" ? new Intl.DisplayNames(["es"], { type: "region" }) : null;
const JSON_HEADERS = { "Content-Type": "application/json" };
const SECTION_TITLES: Record<Tab, string> = {
  summary: "Resumen",
  users: "Usuarios",
  events: "Eventos",
  coupons: "Cupones",
  design: "Diseño",
};

const statusOf = (error: unknown) => (error instanceof HttpErrorResponse ? error.status : 0);

@Component({
  selector: "admin-root",
  imports: [FormsModule],
  templateUrl: "./admin.component.html",
})
export class AdminComponent {
  private readonly http = inject(HttpClient);

  readonly periods = [7, 30, 90];
  readonly palettes = PALETTES;

  readonly session = signal<Session>("checking");
  readonly tab = signal<Tab>("summary");
  readonly navOpen = signal(false);
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
  readonly coupons = signal<Page<CouponRow> | null>(null);
  readonly couponError = signal("");
  readonly palette = signal<string | null>(null);
  readonly paletteError = signal("");
  readonly paletteSaved = signal(false);
  paletteChoice = "";
  credentials = { username: "", password: "" };
  couponForm = { code: "", kind: "percent", value: null as number | null, expires: "", maxRedemptions: null as number | null };

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
  sectionTitle() {
    return SECTION_TITLES[this.tab()];
  }

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

  paletteName(id: string) {
    return PALETTES.find((palette) => palette.id === id)?.name || id;
  }

  // Mismo tratamiento que el sitio: el logo completo se tiñe con la paleta elegida.
  paletteFilter(hue: number | null) {
    return hue === null ? "none" : `grayscale(1) sepia(1) saturate(3) hue-rotate(${hue}deg)`;
  }

  couponDiscount(coupon: CouponRow) {
    return coupon.percentOff !== null ? `${coupon.percentOff} %` : `$${((coupon.amountOffCents ?? 0) / 100).toFixed(2)}`;
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

  totalGuests() {
    const guests = this.stats()?.overview.guests;
    return guests ? guests.accepted + guests.declined + guests.pending : 0;
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

  toggleNav() {
    this.navOpen.update((open) => !open);
  }

  closeNav() {
    this.navOpen.set(false);
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
    this.navOpen.set(false);
    firstValueFrom(this.http.post("/api/logout", {}, { headers: JSON_HEADERS }))
      .catch(() => undefined)
      .finally(() => {
        this.session.set("out");
        this.stats.set(null);
        this.users.set(null);
        this.events.set(null);
        this.coupons.set(null);
        this.countries.set(null);
        this.palette.set(null);
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
    this.navOpen.set(false);
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
    if (this.tab() === "coupons") {
      return this.request<Page<CouponRow>>(`/api/coupons?page=${this.page()}`).then(
        (data) => this.coupons.set(data),
        () => undefined,
      );
    }
    if (this.tab() === "design") {
      this.paletteError.set("");
      this.paletteSaved.set(false);
      return this.request<SitePalette>("/api/palette").then(
        ({ palette }) => {
          this.palette.set(palette);
          this.paletteChoice = palette;
        },
        () => undefined,
      );
    }
    return this.request<Page<EventRow>>(`/api/events?page=${this.page()}`).then(
      (data) => this.events.set(data),
      () => undefined,
    );
  }

  savePalette() {
    this.paletteError.set("");
    this.paletteSaved.set(false);
    this.busy.set(true);
    firstValueFrom(this.http.put<SitePalette>("/api/palette", { palette: this.paletteChoice }, { headers: JSON_HEADERS })).then(
      ({ palette }) => {
        this.busy.set(false);
        this.palette.set(palette);
        this.paletteSaved.set(true);
      },
      (error: unknown) => {
        this.busy.set(false);
        if (statusOf(error) === 401) return this.session.set("out");
        this.paletteError.set(MESSAGES.paletteError);
      },
    );
  }

  createCoupon() {
    const { code, kind, value, expires, maxRedemptions } = this.couponForm;
    const body = {
      code,
      percentOff: kind === "percent" ? value : null,
      amountOffCents: kind === "amount" && value !== null ? Math.round(value * 100) : null,
      // La fecha elegida entra entera: el cupón caduca al final de ese día, en la hora de quien lo crea
      expiresAt: expires ? new Date(`${expires}T23:59:59`).toISOString() : null,
      maxRedemptions,
    };
    this.couponError.set("");
    this.busy.set(true);
    firstValueFrom(this.http.post("/api/coupons", body, { headers: JSON_HEADERS })).then(
      () => {
        this.busy.set(false);
        this.couponForm = { code: "", kind: "percent", value: null, expires: "", maxRedemptions: null };
        this.reload();
      },
      (error: unknown) => this.couponFailed(error),
    );
  }

  setCouponActive(coupon: CouponRow, active: boolean) {
    this.couponError.set("");
    this.busy.set(true);
    firstValueFrom(this.http.post("/api/coupons/active", { id: coupon.id, active }, { headers: JSON_HEADERS })).then(
      () => {
        this.busy.set(false);
        this.reload();
      },
      (error: unknown) => this.couponFailed(error),
    );
  }

  private couponFailed(error: unknown) {
    this.busy.set(false);
    const status = statusOf(error);
    if (status === 401) return this.session.set("out");
    this.couponError.set(status === 409 ? MESSAGES.couponDuplicate : status === 422 ? MESSAGES.couponInvalid : MESSAGES.couponError);
  }
}
