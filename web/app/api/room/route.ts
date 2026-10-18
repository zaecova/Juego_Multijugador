import { env } from 'cloudflare:workers';
import { advance, input, publicRoom, reset, runner } from '../../../lib/race.mjs';

import { currentUser } from '../../../lib/accounts';

export const dynamic = 'force-dynamic';
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
const clean=(v:unknown)=>String(v||'').replace(/[<>\u0000-\u001f]/g,'').trim().slice(0,20)||'Explorador';
const codePattern=/^[A-Z2-9]{6}$/;
function makeCode(){const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';return Array.from(crypto.getRandomValues(new Uint8Array(6)),n=>alphabet[n%alphabet.length]).join('');}
export async function POST(request:Request){
 try{
  if(request.headers.get('origin')&&request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Origen no permitido'},403);
  const raw=await request.text();
  if(raw.length>2048)return json({error:'Solicitud demasiado grande'},413);
  let body;try{body=JSON.parse(raw);}catch{return json({error:'Solicitud inválida'},400);}
  if(!body||typeof body!=='object')return json({error:'Solicitud inválida'},400);
  const op=body.op,now=Date.now();
  if(!['create','join','state','action','start','leave'].includes(op))return json({error:'Acción desconocida'},400);
  const user=await currentUser(request,body.sessionToken);
  if(!user)return json({error:'Inicia sesión para entrar al juego.'},401);
  const db=env.DB;
  if(!db)return json({error:'La sala todavía se está preparando. Vuelve a intentar.'},503);
  const newId=crypto.randomUUID(),newToken=crypto.randomUUID()+crypto.randomUUID();
  if(op==='create'){
   await db.prepare('DELETE FROM rooms WHERE code IN (SELECT code FROM rooms WHERE expires_at < ? LIMIT 20)').bind(now).run();
   for(let attempt=0;attempt<4;attempt++){
    const code=makeCode();
    const first=runner(newId,user.username,newToken,now,body.avatar==='explorador'?'explorador':'exploradora');first.accountId=user.id;
    const room={code,host:newId,round:0,status:'waiting',startAt:0,players:[first]};
    const result=await db.prepare('INSERT OR IGNORE INTO rooms(code,state,revision,expires_at) VALUES(?,?,0,?)').bind(code,JSON.stringify(room),now+3600000).run();
    if(result.meta.changes)return json({...publicRoom(room,now,newId),token:newToken});
   }
   return json({error:'No se pudo crear la sala. Intenta otra vez.'},503);
  }
  const code=String(body.code||'').toUpperCase();
  if(!codePattern.test(code))return json({error:'Escribe un código de seis caracteres.'},400);
  for(let attempt=0;attempt<8;attempt++){
   const row=await db.prepare('SELECT state,revision,expires_at FROM rooms WHERE code=?').bind(code).first<{state:string,revision:number,expires_at:number}>();
   if(!row||row.expires_at<now)return json({error:'La sala no existe o ha caducado.'},404);
   const room=JSON.parse(row.state);
   const token=typeof body.roomToken==='string'?body.roomToken:request.headers.get('authorization')?.replace(/^Bearer /,'')||'';
   let p=room.players.find((p:any)=>p.token===token&&p.accountId===user.id);
   if(p)p.seen=now;
   advance(room,now);
   if(op==='join'&&!p){
    if(room.status==='racing')return json({error:'La carrera ya comenzó. Espera a la siguiente ronda.'},409);
    if(room.players.length>=4)return json({error:'La sala ya tiene cuatro jugadores.'},409);
    p=runner(newId,user.username,newToken,now,body.avatar==='explorador'?'explorador':'exploradora');
    p.accountId=user.id;
    const existing=room.players.find((q:any)=>q.accountId===user.id);
    if(existing)return json({error:'Ya estás en esta sala. Usa la pestaña original o espera 25 segundos para volver a entrar.'},409);
    room.players.push(p);if(!room.host)room.host=p.id;
   }
   if(!p)return json({error:'Tu sesión de sala terminó. Vuelve a entrar.'},401);
   if(op==='action'){
    if(!['left','right','jump'].includes(body.action))return json({error:'Acción desconocida'},400);
    if(body.round===room.round)input(room,p,body.action,now);
   }
   if(op==='start'){
    if(p.id!==room.host)return json({error:'Solo el anfitrión puede iniciar.'},403);
    if(room.status==='racing')return json(publicRoom(room,now,p.id));
    reset(room,now);
   }
   if(op==='leave'){
    room.players=room.players.filter((q:any)=>q.id!==p.id);
    if(room.host===p.id)room.host=room.players[0]?.id||'';
   }
   const result=await db.prepare('UPDATE rooms SET state=?,revision=revision+1,expires_at=? WHERE code=? AND revision=?').bind(JSON.stringify(room),now+3600000,code,row.revision).run();
   if(result.meta.changes)return json({...publicRoom(room,now,p.id),...(op==='join'&&p.id===newId?{token:newToken}:{})});
  }
  return json({error:'La sala está ocupada. Vuelve a intentar.'},409);
 }catch(error){console.error('Room request failed',error);return json({error:'No pudimos conectar con la sala. Inténtalo de nuevo.'},500);}
}
