import {test} from 'node:test';
import assert from 'node:assert/strict';
import {releaseSchema,visitSchema,clientPlatformSchema} from './index';
test('Native releases require safe platform/channel combinations and signed APK checksum',()=>{
 const base={version:'1.0.0',build:1,notes:''};
 assert.equal(releaseSchema.safeParse({...base,platform:'ios',channel:'direct',url:'https://example.com/App.ipa'}).success,false);
 assert.equal(releaseSchema.safeParse({...base,platform:'ios',channel:'testflight',url:'https://testflight.apple.com/join/abcd'}).success,true);
 assert.equal(releaseSchema.safeParse({...base,platform:'ios',channel:'store',url:'https://evil.example/app'}).success,false);
 assert.equal(releaseSchema.safeParse({...base,platform:'android',channel:'direct',url:'https://github.com/o/r/releases/download/v1/app.apk'}).success,false);
 assert.equal(releaseSchema.safeParse({...base,platform:'android',channel:'direct',url:'https://github.com/o/r/releases/download/v1/app.apk',sha256:'a'.repeat(64)}).success,true);
 assert.equal(releaseSchema.safeParse({...base,platform:'android',channel:'direct',url:'javascript:alert(1)',sha256:'a'.repeat(64)}).success,false);
});
test('Telemetry does not accept arbitrary routes or client platforms',()=>{
 assert.equal(clientPlatformSchema.safeParse('owner').success,false);
 assert.equal(visitSchema.safeParse({visitId:crypto.randomUUID(),visitorId:crypto.randomUUID(),route:'/i/private'}).success,false);
});
