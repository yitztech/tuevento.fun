// Forma de las respuestas de la API del panel (src/server.mjs y src/stats.mjs).
export interface Counts {
  visits: number;
  registrations: number;
  logins: number;
  downloads: number;
}

export interface Stats {
  overview: {
    online: { platform: string; visitors: number }[];
    users: { total: number; last1: number; last7: number; last30: number; byPlatform: { platform: string; users: number }[] };
    sessions: { open: number };
    events: { total: number; last7: number; archived: number; themes: { theme: string; events: number }[] };
    invitations: { total: number };
    guests: { accepted: number; declined: number; pending: number };
  };
  activity: {
    days: number;
    totals: Counts & { visitors: number };
    daily: (Counts & { day: string })[];
    routes: { route: string; visits: number }[];
  };
}

export interface Countries {
  available: boolean;
  days: number;
  rows: { country: string | null; visitors: number }[];
}

export interface Page<T> {
  page: number;
  pageSize: number;
  rows: T[];
}

export interface UserRow {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  platform: string;
  createdAt: string;
  events: number;
  lastActivity: string | null;
}

export interface EventRow {
  id: string;
  title: string;
  date: string | null;
  theme: string;
  archived: boolean;
  createdAt: string;
  owner: string;
  invitations: number;
  accepted: number;
}
