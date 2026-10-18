import {env} from 'cloudflare:workers';
const enc=new TextEncoder();
export const hex=(v:ArrayBuffer)=>Array.from(new Uint8Array(v),x=>x.toString(16).padStart(2,'0')).join('');
export async function digest(text:string){return hex(await crypto.subtle.digest('SHA-256',enc.encode(text)));}
export function secret(){return crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-','');}
export async function passwordHash(password:string,salt:string){
 const key=await crypto.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveBits']);
 return hex(await crypto.subtle.deriveBits({name:'PBKDF2',salt:enc.encode(salt),iterations:100000,hash:'SHA-256'},key,256));
}
export function equal(a:string,b:string){if(a.length!==b.length)return false;let result=0;for(let i=0;i<a.length;i++)result|=a.charCodeAt(i)^b.charCodeAt(i);return result===0;}
export function sessionCookie(request:Request){const value=request.headers.get('cookie')?.match(/(?:^|;\s*)treasure_session=([a-f0-9]{64})(?:;|$)/);return value?.[1]||'';}
export async function currentUser(request:Request){
 const token=sessionCookie(request);if(!token||!env.DB)return null;
 return env.DB.prepare('SELECT a.id,a.username,a.email FROM sessions s JOIN accounts a ON a.id=s.account_id WHERE s.token_hash=? AND s.expires_at>?').bind(await digest(token),Date.now()).first<{id:string,username:string,email:string}>();
}
export async function newSession(userId:string){
 const token=secret();await env.DB.prepare('INSERT INTO sessions(token_hash,account_id,expires_at) VALUES(?,?,?)').bind(await digest(token),userId,Date.now()+7*86400000).run();
 return 'treasure_session='+token+'; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=604800';
}
export async function limit(key:string,max:number,windowMs:number){
 const now=Date.now();const result=await env.DB.prepare('INSERT INTO auth_limits(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expires_at<? THEN 1 ELSE count+1 END, expires_at=CASE WHEN expires_at<? THEN excluded.expires_at ELSE expires_at END RETURNING count').bind(key,now+windowMs,now,now).first<{count:number}>();
 return !!result&&result.count<=max;
}
