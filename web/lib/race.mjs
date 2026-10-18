export const TRACK = Array.from({length:12},(_,i)=>({index:i,d:18+i*21,lane:i%3,points:100+i*50}));
export const SPEED=4.5, FINISH=278;
export function runner(id,name,token,now,avatar='exploradora') {
 return {id,name,token,avatar,lane:1,fromX:0,movedAt:0,jumpedAt:-99,points:0,lives:3,attempts:3,clues:[],passed:[],hits:[],done:false,won:false,seen:now,lastAction:0,message:'¡Sigue las luces doradas!'};
}
export function xAt(p,t){ return p.lane-1+(p.fromX-(p.lane-1))*Math.exp(-12*Math.max(0,t-p.movedAt)); }
export function heightAt(p,t){const j=t-p.jumpedAt;return j>=0&&j<1?Math.max(0,8*j-9.5*j*j):0;}
export function advance(room,now){
 room.players=room.players.filter(p=>now-p.seen<25000);
 if(!room.players.some(p=>p.id===room.host))room.host=room.players[0]?.id||'';
 if(room.status!=='racing')return;
 const t=Math.max(0,(now-room.startAt)/1000);
 for(const p of room.players){
  if(p.done)continue;
  const events=TRACK.flatMap(c=>[{kind:'clue',...c},{kind:'hit',index:c.index,d:c.d+8,lane:(c.index+1)%3}]).sort((a,b)=>a.d-b.d);
  for(const e of events){
   if(p.done||e.d/SPEED>t)break;
   const passed=e.kind==='clue'?p.passed:p.hits;
   if(passed.includes(e.index))continue;
   passed.push(e.index);
   if(e.kind==='clue'&&Math.abs(xAt(p,e.d/SPEED)-(e.lane-1))>.36)continue;
   if(e.kind==='clue'){
    p.clues.push(e.index);p.points+=e.points;p.message='Pista encontrada';
   }else if(heightAt(p,e.d/SPEED)<1.25){
    p.attempts--;p.message='¡Desnivel! Salta el escalón del camino.';
    if(p.attempts===0){p.lives--;p.attempts=3;}
    if(p.lives===0){p.done=true;p.finishAt=e.d/SPEED;p.message='Te quedaste sin vidas.';}
   }
  }
  if(t>=FINISH/SPEED&&!p.done){p.done=true;p.finishAt=FINISH/SPEED;p.won=p.clues.length===12;p.message=p.won?'¡Tesoro encontrado!':'¡Llegaste a la meta!';}
 }
 if(room.players.length===0||room.players.every(p=>p.done))room.status='finished';
}
export function input(room,p,action,now){
 if(room.status!=='racing'||now<room.startAt||p.done||now-p.lastAction<70)return;
 const t=(now-room.startAt)/1000;
 if(action==='left'||action==='right'){
  p.fromX=xAt(p,t);p.movedAt=t;p.lane=Math.max(0,Math.min(2,p.lane+(action==='left'?-1:1)));
 }else if(action==='jump'&&heightAt(p,t)===0)p.jumpedAt=t;
 p.lastAction=now;
}
export function reset(room,now){
 room.round++;room.status='racing';room.startAt=now+3000;
 room.players=room.players.map(p=>({...runner(p.id,p.name,p.token,now,p.avatar),accountId:p.accountId}));
}
export function publicRoom(room,now,myId){
 const t=room.status==='waiting'?0:Math.max(0,(now-room.startAt)/1000);
 return {code:room.code,status:room.status,host:room.host,round:room.round,serverNow:now,speed:SPEED,startAt:room.startAt,myId,players:room.players.map(({token,accountId,...p})=>({...p,x:xAt(p,t),height:heightAt(p,t),distance:Math.min(FINISH,(p.done?p.finishAt||0:t)*SPEED)}))};
}
