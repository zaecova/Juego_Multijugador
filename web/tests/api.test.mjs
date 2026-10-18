import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdir,readFile,writeFile,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
const sqlite=new DatabaseSync(':memory:');
for(const file of (await readdir('drizzle')).filter(x=>x.endsWith('.sql')).sort())sqlite.exec(await readFile('drizzle/'+file,'utf8'));
function prepare(sql){let params=[];return{bind(...v){params=v;return this;},async first(){return sqlite.prepare(sql).get(...params)||null;},async run(){const r=sqlite.prepare(sql).run(...params);return{meta:{changes:Number(r.changes)}};}};}
globalThis.__testEnv={DB:{prepare,async batch(statements){sqlite.exec('BEGIN');try{const result=[];for(const s of statements)result.push(await s.run());sqlite.exec('COMMIT');return result;}catch(e){sqlite.exec('ROLLBACK');throw e;}}}};
await mkdir('.sites-runtime/test-build',{recursive:true});
async function compile(src,name){let text=await readFile(src,'utf8');text=text.replace(/import \{\s*env\s*\} from ['"]cloudflare:workers['"];?/,'const env=globalThis.__testEnv;');text=text.replace("'../../../lib/accounts'",JSON.stringify(pathToFileURL(resolve('.sites-runtime/test-build/accounts.mjs')).href));text=text.replace("'../../../lib/race.mjs'",JSON.stringify(pathToFileURL(resolve('lib/race.mjs')).href));const out=ts.transpileModule(text,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;const path=resolve('.sites-runtime/test-build/'+name+'.mjs');await writeFile(path,out);return import(pathToFileURL(path).href);}
await compile('lib/accounts.ts','accounts');
const auth=await compile('app/api/auth/route.ts','auth'),room=await compile('app/api/room/route.ts','room');
let clock=100000000;Date.now=()=>clock;
async function request(handler,body,cookie='',token=''){
 const r=await handler.POST(new Request('https://game.test/api',{method:'POST',headers:{'Content-Type':'application/json','Origin':'https://game.test',...(cookie?{Cookie:cookie}:{}),...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body)}));return{status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]||''};
}
test('accounts, password recovery, authenticated room, two players and shared race',async()=>{
 let r=await request(room,{op:'create'});assert.equal(r.status,401);
 const a=await request(auth,{op:'register',username:'zara',email:'zara@example.test',password:'Test-password-137'});assert.equal(a.status,200);assert.ok(a.cookie);assert.equal(a.data.recovery.length,32);
 const dup=await request(auth,{op:'register',username:'zara',email:'other@example.test',password:'Test-password-137'});assert.equal(dup.status,409);
 const b=await request(auth,{op:'register',username:'ana',email:'ana@example.test',password:'Test-password-567'});assert.equal(b.status,200);
 r=await request(auth,{op:'login',identifier:'zara@example.test',password:'incorrect-password'});assert.equal(r.status,401);
 r=await request(auth,{op:'login',identifier:'zara',password:'Test-password-137'});assert.equal(r.status,200);
 const created=await request(room,{op:'create',name:'ignored'},a.cookie);assert.equal(created.status,200);assert.equal(created.data.players[0].name,'zara');assert.equal(created.data.players[0].accountId,undefined);
 const code=created.data.code,ta=created.data.token;
 const joined=await request(room,{op:'join',code},b.cookie);assert.equal(joined.status,200);assert.equal(joined.data.players.length,2);const tb=joined.data.token;
 const forbidden=await request(room,{op:'start',code},b.cookie,tb);assert.equal(forbidden.status,403);
 const start=await request(room,{op:'start',code},a.cookie,ta);assert.equal(start.status,200);assert.equal(start.data.status,'racing');assert.equal(start.data.startAt,clock+3000);
 clock+=4000;
 const input=await request(room,{op:'action',code,action:'right',round:start.data.round},b.cookie,tb);assert.equal(input.status,200);
 clock+=500;
 const state=await request(room,{op:'state',code},a.cookie,ta);assert.equal(state.status,200);assert.equal(state.data.players[1].lane,2);assert.equal(state.data.players[0].distance,state.data.players[1].distance);
 assert.ok(state.data.players.every(p=>p.token===undefined));
 const recovered=await request(auth,{op:'recover',identifier:'zara@example.test',password:'New-test-password-213',recovery:a.data.recovery});assert.equal(recovered.status,200);assert.notEqual(recovered.data.recovery,a.data.recovery);
 r=await request(room,{op:'state',code},a.cookie,ta);assert.equal(r.status,401);
 r=await request(auth,{op:'recover',identifier:'zara',password:'Other-test-password',recovery:a.data.recovery});assert.equal(r.status,401);
 r=await request(auth,{op:'login',identifier:'zara',password:'Test-password-137'});assert.equal(r.status,401);
 r=await request(auth,{op:'login',identifier:'zara@example.test',password:'New-test-password-213'});assert.equal(r.status,200);
 const resumed=await request(room,{op:'state',code},r.cookie,ta);assert.equal(resumed.status,200);
 const out=await request(auth,{op:'logout'},r.cookie);assert.equal(out.status,200);
 const me=await auth.GET(new Request('https://game.test/api/auth',{headers:{Cookie:r.cookie}}));assert.equal((await me.json()).user,null);
});
