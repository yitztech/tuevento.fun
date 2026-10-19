// Consultas de solo lectura para el panel. Todas usan el rol `admin_ro` (ver services/postgres/sql/admin-role.sql).
// "Conectados ahora" = visitantes distintos con una visita en los últimos 5 minutos.
const ONLINE_WINDOW = "5 minutes";

const counts = `count(*) FILTER (WHERE kind='visit')::int AS visits,
  count(*) FILTER (WHERE kind='registration')::int AS registrations,
  count(*) FILTER (WHERE kind='login')::int AS logins,
  count(*) FILTER (WHERE kind='download')::int AS downloads`;

const since = (days) => `created_at >= (date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC') - (($1::int - 1) * interval '1 day')`;

export async function overview(db) {
  const [online, users, sessions, events, invitations, guests] = await Promise.all([
    db.query(`SELECT platform, count(DISTINCT visitor_id)::int AS visitors FROM activity
      WHERE kind='visit' AND created_at > now() - interval '${ONLINE_WINDOW}' GROUP BY platform ORDER BY platform`),
    db.query(`SELECT count(*)::int AS total,
      count(*) FILTER (WHERE created_at > now() - interval '1 day')::int AS "last1",
      count(*) FILTER (WHERE created_at > now() - interval '7 days')::int AS "last7",
      count(*) FILTER (WHERE created_at > now() - interval '30 days')::int AS "last30"
      FROM users WHERE NOT is_demo`),
    db.query("SELECT count(*)::int AS open FROM sessions WHERE expires_at > now()"),
    db.query(`SELECT count(*)::int AS total,
      count(*) FILTER (WHERE created_at > now() - interval '7 days')::int AS "last7",
      count(*) FILTER (WHERE archived)::int AS archived FROM events`),
    db.query("SELECT count(*)::int AS total FROM invitations"),
    db.query(`SELECT count(*) FILTER (WHERE status='accepted')::int AS accepted,
      count(*) FILTER (WHERE status='declined')::int AS declined,
      count(*) FILTER (WHERE status='pending')::int AS pending FROM members`),
  ]);
  const byPlatform = await db.query("SELECT registration_platform AS platform, count(*)::int AS users FROM users WHERE NOT is_demo GROUP BY 1 ORDER BY 1");
  const themes = await db.query("SELECT theme, count(*)::int AS events FROM events GROUP BY theme ORDER BY events DESC, theme");
  return {
    online,
    users: { ...users[0], byPlatform },
    sessions: sessions[0],
    events: { ...events[0], themes },
    invitations: invitations[0],
    guests: guests[0],
  };
}

export async function activity(db, days) {
  const daily = await db.query(`SELECT to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD') AS day, ${counts}
    FROM activity WHERE ${since(days)} GROUP BY day ORDER BY day`, [days]);
  const totals = await db.query(`SELECT count(DISTINCT visitor_id)::int AS visitors, ${counts} FROM activity WHERE ${since(days)}`, [days]);
  const platforms = await db.query(`SELECT platform, ${counts} FROM activity WHERE ${since(days)} GROUP BY platform ORDER BY platform`, [days]);
  const routes = await db.query(`SELECT route, count(*)::int AS visits FROM activity
    WHERE kind='visit' AND route IS NOT NULL AND ${since(days)} GROUP BY route ORDER BY visits DESC LIMIT 10`, [days]);
  const newEvents = await db.query(`SELECT to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD') AS day, count(*)::int AS events
    FROM events WHERE ${since(days)} GROUP BY day ORDER BY day`, [days]);
  return { days, totals: totals[0], platforms, daily, routes, newEvents };
}

export async function users(db, { offset, limit }) {
  return db.query(`SELECT u.id, u.first_name AS "firstName", u.last_name AS "lastName", u.email,
      u.registration_platform AS platform, u.created_at AS "createdAt",
      (SELECT count(*)::int FROM events e WHERE e.user_id = u.id) AS events,
      (SELECT max(a.created_at) FROM activity a WHERE a.user_id = u.id) AS "lastActivity"
    FROM users u WHERE NOT u.is_demo ORDER BY u.created_at DESC LIMIT $1 OFFSET $2`, [limit, offset]);
}

export async function events(db, { offset, limit }) {
  return db.query(`SELECT e.id, e.title, e.date, e.theme, e.archived, e.created_at AS "createdAt", u.email AS owner,
      (SELECT count(*)::int FROM invitations i WHERE i.event_id = e.id) AS invitations,
      (SELECT count(*)::int FROM members m JOIN invitations i ON i.id = m.invitation_id
        WHERE i.event_id = e.id AND m.status = 'accepted') AS accepted
    FROM events e JOIN users u ON u.id = e.user_id ORDER BY e.created_at DESC LIMIT $1 OFFSET $2`, [limit, offset]);
}
