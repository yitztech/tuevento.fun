import { Controller, Get, Post, Body, Req, Param, Query, Res, BadRequestException, ForbiddenException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { randomUUID, randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { visitSchema, releaseSchema, normalizeLocale, validationOptions } from '@tuevento/contracts';
import { Database } from './database';
import { AuthService, userView } from './auth';
import { clientPlatform } from './client-platform';
const parse = <T extends z.ZodType>(schema: T, value: unknown, req?: FastifyRequest): z.output<T> => {
  const r = schema.safeParse(value, validationOptions(normalizeLocale(req?.headers["accept-language"]))); if (!r.success) throw new BadRequestException(r.error.issues[0]?.message); return r.data;
};
@Controller()
export class PlatformController {
  constructor(private db: Database, private auth: AuthService) {}
  @Post('auth/mobile/authorize') async authorize(@Body() body: unknown, @Req() req: FastifyRequest) {
    const user = await this.auth.current(req);
    if(user.isDemo) throw new ForbiddenException();
    const {challenge}=parse(z.object({challenge:z.string().regex(/^[A-Za-z0-9_-]{43}$/)}),body,req);
    const code=randomBytes(32).toString('base64url');
    await this.db.query('DELETE FROM mobile_auth_codes WHERE expires_at < now()');
    await this.db.query("INSERT INTO mobile_auth_codes(code_hash,challenge,user_id,expires_at) VALUES($1,$2,$3,now()+interval '2 minutes')",[createHash('sha256').update(code).digest('hex'),challenge,user.id]);
    return {code};
  }
  @Post('auth/mobile/exchange') async exchange(@Body() body: unknown, @Req() req: FastifyRequest, @Res({passthrough:true}) reply: FastifyReply) {
    const v=parse(z.object({code:z.string().regex(/^[A-Za-z0-9_-]{43}$/),verifier:z.string().regex(/^[A-Za-z0-9_-]{43,128}$/)}),body,req);
    const [row]=await this.db.query('DELETE FROM mobile_auth_codes WHERE code_hash=$1 AND challenge=$2 AND expires_at>now() RETURNING user_id',[createHash('sha256').update(v.code).digest('hex'),createHash('sha256').update(v.verifier).digest('base64url')]);
    if(!row)throw new UnauthorizedException();
    const [user]=await this.db.query('SELECT * FROM users WHERE id=$1',[row.user_id]);
    return this.auth.session(userView(user),req,reply);
  }
  @Post('analytics/visit') async visit(@Body() body: unknown, @Req() req: FastifyRequest) {
    const v = parse(visitSchema, body,req);
    await this.db.query("INSERT INTO activity(id,kind,platform,visitor_id,route) VALUES($1,'visit',$2,$3,$4) ON CONFLICT DO NOTHING", [v.visitId, clientPlatform(req), v.visitorId, v.route]);
    return {ok:true};
  }
  @Get('owner/metrics') async metrics(@Req() req: FastifyRequest, @Query('days') raw?: string) {
    const user = await this.auth.current(req);
    if (!user.isOwner || user.isDemo) throw new ForbiddenException('Acceso exclusivo del dueño del sistema.');
    const days = parse(z.coerce.number().int().min(1).max(90).default(30), raw,req);
    const counts = `count(*) FILTER(WHERE kind='visit')::int AS visits, count(*) FILTER(WHERE kind='registration')::int AS registrations, count(*) FILTER(WHERE kind='login')::int AS logins, count(*) FILTER(WHERE kind='download')::int AS downloads`;
    const where = "created_at >= (date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC') - (($1::int-1)*interval '1 day')";
    const [totals] = await this.db.query(`SELECT count(DISTINCT visitor_id)::int AS visitors, ${counts} FROM activity WHERE ${where}`, [days]);
    const sources = await this.db.query(`SELECT platform, ${counts} FROM activity WHERE ${where} GROUP BY platform ORDER BY platform`, [days]);
    const daily = await this.db.query(`SELECT to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD') AS day, ${counts} FROM activity WHERE ${where} GROUP BY day ORDER BY day`, [days]);
    return {days, totals, sources, daily};
  }
  // Verificación de App Links: Google y Apple leen estos archivos del dominio público.
  // Se sirven desde la API con la configuración del entorno, sin reconstruir la web.
  @Get('.well-known/assetlinks.json') assetLinks() {
    const fingerprint = process.env.ANDROID_CERT_SHA256 || '';
    if (!/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(fingerprint)) throw new NotFoundException();
    return [{
      relation: ['delegate_permission/common.handle_all_urls'],
      target: { namespace: 'android_app', package_name: process.env.MOBILE_APP_ID || 'com.tueventofun.app', sha256_cert_fingerprints: [fingerprint] },
    }];
  }
  @Get('.well-known/apple-app-site-association') appleAssociation() {
    const team = process.env.APPLE_TEAM_ID || '';
    if (!/^[A-Z0-9]{10}$/.test(team)) throw new NotFoundException();
    return { applinks: { details: [{ appIDs: [`${team}.${process.env.MOBILE_APP_ID || 'com.tueventofun.app'}`], components: [{ '/': '/app-link/auth*' }] }] } };
  }
  @Get('releases') async releases() {
    return this.db.query(`SELECT DISTINCT ON(platform,channel) id,platform,version,build,channel,url,sha256,notes,published_at AS "publishedAt" FROM app_releases ORDER BY platform,channel,build DESC`);
  }
  @Post('releases/:id/download') async download(@Param('id') id: string, @Req() req: FastifyRequest) {
    parse(z.uuid(),id,req);
    const [release] = await this.db.query('SELECT id FROM app_releases WHERE id=$1',[id]);
    if (!release) throw new BadRequestException('Versión no encontrada.');
    await this.db.query("INSERT INTO activity(id,kind,platform,route) VALUES($1,'download',$2,$3)",[randomUUID(),clientPlatform(req),id]);
    return {ok:true};
  }
  @Post('releases') async publish(@Body() body: unknown, @Req() req: FastifyRequest) {
    const expected = process.env.RELEASE_PUBLISH_TOKEN;
    const supplied = req.headers.authorization?.replace(/^Bearer /,'');
    if (!expected || expected.length < 32 || !supplied || !timingSafeEqual(createHash('sha256').update(expected).digest(),createHash('sha256').update(supplied).digest())) throw new UnauthorizedException();
    const v = parse(releaseSchema, body,req);
    const allowed = (process.env.RELEASE_DOWNLOAD_HOSTS || 'github.com,apps.apple.com,testflight.apple.com,play.google.com').split(',');
    if (!allowed.includes(new URL(v.url).hostname)) throw new BadRequestException('Host de descarga no permitido.');
    const [r] = await this.db.query(`INSERT INTO app_releases(id,platform,version,build,channel,url,sha256,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8)
      ON CONFLICT(platform,channel,build) DO UPDATE SET version=EXCLUDED.version,url=EXCLUDED.url,sha256=EXCLUDED.sha256,notes=EXCLUDED.notes,published_at=now() RETURNING id`,[randomUUID(),v.platform,v.version,v.build,v.channel,v.url,v.sha256 || null,v.notes]);
    return r;
  }
}
