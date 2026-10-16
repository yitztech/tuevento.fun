import assert from 'node:assert/strict';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
const base=process.env.TEST_API_URL||'http://127.0.0.1:3087/api';
const sql=(query)=>execFileSync('docker',['compose','exec','-T','postgres','psql','-U','tuevento','-d','tueventofun','-Atc',query],{encoding:'utf8'}).trim();
const results=[];let cookie='',id;const visitId=randomUUID(),visitorId=randomUUID();
async function call(path,method='GET',body,status=200,headers={}){const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json','X-TuEvento-Client':'1',Cookie:cookie,...headers},body:body===undefined?undefined:JSON.stringify(body)});const data=await r.json();assert.equal(r.status,status,JSON.stringify(data));const c=r.headers.get('set-cookie');if(c)cookie=c.split(';')[0];return data;}
const pass=(s)=>{results.push(s);console.log('PASS',s)};
try{
 await call('/owner/metrics','GET',undefined,401);pass('Owner metrics require authentication');
 const n=Date.now();const password=randomBytes(20).toString('hex');const email=`platform-${n}@example.invalid`;
 const user=await call('/auth/register','POST',{firstName:'Prueba',lastName:'Plataforma',phone:'+527770000000',email,password,isOwner:true},201,{'X-Client-Platform':'android','X-App-Version':'1.2.3'});id=user.id;
 assert.equal(user.isOwner,false);await call('/owner/metrics','GET',undefined,403);pass('Registration cannot self-assign owner role');
 assert.equal(sql(`SELECT registration_platform FROM users WHERE id='${id}'`),'android');assert.equal(sql(`SELECT platform||':'||app_version FROM sessions WHERE user_id='${id}'`),'android:1.2.3');pass('Client platform and version persisted');
 await call('/analytics/visit','POST',{visitId,visitorId,route:'landing'},201);await call('/analytics/visit','POST',{visitId,visitorId,route:'landing'},201);assert.equal(sql(`SELECT count(*) FROM activity WHERE id='${visitId}'`),'1');await call('/analytics/visit','POST',{visitId:randomUUID(),visitorId,route:'/i/private-token'},400);pass('Visits deduplicated; private paths rejected');
 sql(`UPDATE users SET is_owner=true WHERE id='${id}'`);const stats=await call('/owner/metrics?days=7');assert.equal(stats.days,7);assert.ok(stats.sources.find(s=>s.platform==='android').registrations>=1);await call('/owner/metrics?days=999','GET',undefined,400);pass('Owner metrics filter and platform attribution');
 await call('/auth/login','POST',{email,password},201,{'X-Client-Platform':'ios'});assert.equal(sql(`SELECT count(*) FROM activity WHERE user_id='${id}' AND kind='login' AND platform='ios'`),'1');pass('Successful login is recorded server-side');
 await call('/auth/login','POST',{email,password:'bad-password-1'},401);assert.equal(sql(`SELECT count(*) FROM activity WHERE user_id='${id}' AND kind='login'`),'1');pass('Failed authentication does not inflate successful sign-ins');
 const verifier=randomBytes(32).toString('base64url');const challenge=createHash('sha256').update(verifier).digest('base64url');const {code}=await call('/auth/mobile/authorize','POST',{challenge},201);await call('/auth/mobile/exchange','POST',{code,verifier:randomBytes(32).toString('base64url')},401);await call('/auth/mobile/exchange','POST',{code,verifier},201,{'X-Client-Platform':'android'});await call('/auth/mobile/exchange','POST',{code,verifier},401);pass('Native authentication bridge requires PKCE and single-use code');
 await call('/releases','POST',{},401);assert.ok(Array.isArray(await call('/releases')));pass('Release catalog public; publication protected');
 writeFileSync('qa-artifacts/platform-results.json',JSON.stringify({passed:results.length,checks:results},null,2));
}finally{if(id){sql(`DELETE FROM activity WHERE user_id='${id}'`);sql(`DELETE FROM users WHERE id='${id}' AND email LIKE 'platform-%@example.invalid'`)}sql(`DELETE FROM activity WHERE visitor_id='${visitorId}'`)}
