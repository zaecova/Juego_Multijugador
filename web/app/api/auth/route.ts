import {env} from 'cloudflare:workers';
import {currentUser,digest,equal,limit,newSession,passwordHash,secret,sessionCookie,suppliedSession} from '../../../lib/accounts';
export const dynamic='force-dynamic';
const json=(value:unknown,status=200,cookie?:string)=>Response.json(value,{status,headers:{'Cache-Control':'no-store',...(cookie?{'Set-Cookie':cookie}:{})}});
export async function GET(request:Request){const user=await currentUser(request);return json({user});}
export async function POST(request:Request){
 try{
  if(request.headers.get('origin')&&request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Origen no permitido'},403);
  const text=await request.text();if(text.length>4096)return json({error:'Solicitud demasiado grande'},413);
  let b;try{b=JSON.parse(text);}catch{return json({error:'Solicitud inválida'},400);}
  if(!b||typeof b!=='object')return json({error:'Solicitud inválida'},400);
  if(b.op==='me')return json({user:await currentUser(request,b.sessionToken)});
  if(b.op==='logout'){
   await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await digest(suppliedSession(request,b.sessionToken))).run();
   return json({ok:true},200,'treasure_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0');
  }
  if(!['register','login','recover'].includes(b.op))return json({error:'Acción desconocida'},400);
  const ip=request.headers.get('cf-connecting-ip')||'unknown';
  if(!await limit('ip:'+await digest(ip),50,3600000))return json({error:'Demasiados intentos. Espera una hora antes de continuar.'},429);
  const identifier=String(b.identifier||'').trim().toLowerCase();
  if(identifier.length>254)return json({error:'Datos inválidos'},400);
  if(b.op!=='register'&&!await limit('account:'+await digest(identifier),12,900000))return json({error:'Demasiados intentos. Espera 15 minutos.'},429);
  const password=String(b.password||'');
  if(password.length<10||password.length>128)return json({error:'Usa una contraseña de 10 a 128 caracteres.'},400);
  if(b.op==='register'){
   const username=String(b.username||'').trim().toLowerCase(),email=String(b.email||'').trim().toLowerCase();
   if(!/^[a-z0-9_]{3,20}$/.test(username)||email.length>254||!/^\S+@\S+\.\S+$/.test(email))return json({error:'Usa un usuario de 3 a 20 letras, números o guiones bajos y un correo válido.'},400);
   const id=crypto.randomUUID(),salt=secret(),recovery=secret().slice(0,32);
   const hash=await passwordHash(password,salt);
   const result=await env.DB.prepare('INSERT OR IGNORE INTO accounts(id,username,email,password_hash,salt,recovery_hash,created_at) VALUES(?,?,?,?,?,?,?)').bind(id,username,email,hash,salt,await digest(recovery),Date.now()).run();
   if(!result.meta.changes)return json({error:'Ese usuario o correo ya está registrado. Inicia sesión o recupera tu contraseña.'},409);
   const session=await newSession(id);
   return json({user:{id,username,email},recovery,sessionToken:session.token},200,session.cookie);
  }
  const user=await env.DB.prepare('SELECT * FROM accounts WHERE username=? OR email=?').bind(identifier,identifier).first<any>();
  if(b.op==='login'){
   const hash=await passwordHash(password,user?.salt||'dummy-login-salt');
   if(!user||!equal(hash,user.password_hash))return json({error:'Usuario, correo o contraseña incorrectos.'},401);
   const session=await newSession(user.id);
   return json({user:{id:user.id,username:user.username,email:user.email},sessionToken:session.token},200,session.cookie);
  }
  const recovery=String(b.recovery||'').replace(/[\s-]/g,'').toLowerCase();
  if(!user||!equal(await digest(recovery),user.recovery_hash))return json({error:'Los datos o el código de recuperación no son válidos.'},401);
  const salt=secret(),newRecovery=secret().slice(0,32);
  const result=await env.DB.batch([
   env.DB.prepare('UPDATE accounts SET password_hash=?,salt=?,recovery_hash=? WHERE id=? AND recovery_hash=?').bind(await passwordHash(password,salt),salt,await digest(newRecovery),user.id,user.recovery_hash),
   env.DB.prepare('DELETE FROM sessions WHERE account_id=?').bind(user.id),
  ]);
  if(!result[0].meta.changes)return json({error:'El código ya fue utilizado. Usa tu código más reciente.'},409);
  const session=await newSession(user.id);
  return json({user:{id:user.id,username:user.username,email:user.email},recovery:newRecovery,sessionToken:session.token},200,session.cookie);
 }catch(error){console.error('Authentication failed',error);return json({error:'No pudimos completar la solicitud. Inténtalo de nuevo.'},500);}
}
