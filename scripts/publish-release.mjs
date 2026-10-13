import { releaseSchema } from '../packages/contracts/dist/index.js';
const release = releaseSchema.parse({
 platform:process.env.RELEASE_PLATFORM, version:process.env.APP_VERSION, build:Number(process.env.BUILD_NUMBER),
 channel:process.env.RELEASE_CHANNEL,url:process.env.RELEASE_URL,sha256:process.env.RELEASE_SHA256||undefined,notes:process.env.RELEASE_NOTES||''
});
const origin=new URL(process.env.PUBLIC_ORIGIN);
if(origin.protocol!=='https:')throw new Error('PUBLIC_ORIGIN must use HTTPS');
if(!process.env.RELEASE_PUBLISH_TOKEN)throw new Error('Missing publish token');
const r=await fetch(new URL('/api/releases',origin),{method:'POST',headers:{'Content-Type':'application/json','X-TuEvento-Client':'1',Authorization:`Bearer ${process.env.RELEASE_PUBLISH_TOKEN}`},body:JSON.stringify(release)});
if(!r.ok)throw new Error(`Release catalog rejected publication: HTTP ${r.status}`);
console.log('Release added to the website catalog.');
