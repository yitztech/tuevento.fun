// Explicit local provisioning; no first-user or email-based privilege escalation.
import pg from 'pg';
const email = process.argv[2];
if (!email || !process.env.DATABASE_URL) throw new Error('Usage: DATABASE_URL=... node scripts/set-owner.mjs registered-owner@example.com');
const db = new pg.Pool({connectionString:process.env.DATABASE_URL});
try {
 const result = await db.query('UPDATE users SET is_owner=true WHERE lower(email)=lower($1) AND is_demo=false RETURNING id',[email]);
 if (result.rowCount !== 1) throw new Error('Register this account first. No matching real account.');
 console.log('Owner role assigned to the registered account.');
} finally {await db.end();}
