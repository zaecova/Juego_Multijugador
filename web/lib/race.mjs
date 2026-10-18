export const TRACK = Array.from({length:12},(_,i)=>({index:i,d:45+i*63,lane:i%3,points:100+i*50}));
export const SPEED=4.5, FINISH=810, ROUND_SECONDS=180, HIT_DELAY=1.5;
export function runner(id,name,token,now,avatar='exploradora') {
 return {id,name,token,avatar,lane:1,fromX:0,movedAt:0,jumpedAt:-99,points:0,lives:3,attempts:3,clues:[],passed:[],hits:[],done:false,won:false,seen:now,lastAction:0,delaySeconds:0,blockedUntil:0,message:'¡Sigue las luces doradas!'};
}
export function xAt(p,t){return p.lane-1+(p.fromX-(p.lane-1))*Math.exp(-12*Math.max(0,t-p.movedAt));}
export function heightAt(p,t){const j=t-p.jumpedAt;return j>=0&&j<1?Math.max(0,8*j-9.5*j*j):0;}
export function progressAt(p,t){return Math.max(0,Math.max(t,p.blockedUntil||0)-(p.delaySeconds||0));}
export function podium(players){
 const completed=players.filter(p=>p.won&&Number.isFinite(p.completionMs)).sort((a,b)=>a.completionMs-b.completionMs);
 const positions=new Map();
 for(let i=0;i<completed.length;i++){
  const p=completed[i],first=completed.findIndex(q=>q.completionMs===p.completionMs),place=first+1;
  positions.set(p.id,{place,crownMetal:place===1?'gold':place===2?'silver':place===3?'bronze':null});
 }
 return positions;
}
export function advance(room,now){
 room.players=room.players.filter(p=>now-p.seen<25000);
 if(!room.players.some(p=>p.id===room.host))room.host=room.players[0]?.id||'';
 if(room.status!=='racing')return;
 const t=Math.max(0,(now-room.startAt)/1000),deadline=room.duration||ROUND_SECONDS;
 const events=TRACK.flatMap(c=>[{kind:'clue',...c},{kind:'hit',index:c.index,d:c.d+24,lane:(c.index+1)%3}]).sort((a,b)=>a.d-b.d);
 for(const p of room.players){
  if(p.done)continue;
  p.delaySeconds??=0;
  for(const e of events){
   if(p.done)break;
   const passed=e.kind==='clue'?p.passed:p.hits;
   if(passed.includes(e.index))continue;
   const eventAt=e.d/SPEED+p.delaySeconds;
   if(eventAt>Math.min(t,deadline))break;
   passed.push(e.index);
   if(e.kind==='clue'&&Math.abs(xAt(p,eventAt)-(e.lane-1))>.36)continue;
   if(e.kind==='clue'){
    p.clues.push(e.index);p.points+=e.points;p.message='Pista encontrada';
    if(p.clues.length===TRACK.length){
     p.done=true;p.won=true;p.completionMs=Math.round(eventAt*1000);p.finishAt=eventAt;p.finishDistance=e.d;p.message='¡Completaste los doce pergaminos!';
    }
   }else if(heightAt(p,eventAt)<1.25){
    p.attempts--;p.delaySeconds+=HIT_DELAY;p.blockedUntil=eventAt+HIT_DELAY;p.message='¡Desnivel! Pierdes una oportunidad y te retrasas 1,5 segundos.';
    if(p.attempts===0){p.lives--;p.attempts=3;}
    if(p.lives===0){p.done=true;p.finishAt=eventAt;p.finishDistance=e.d;p.message='Te quedaste sin vidas.';}
   }
  }
  if(t>=deadline&&!p.done){p.done=true;p.finishAt=deadline;p.finishDistance=Math.min(FINISH,progressAt(p,deadline)*SPEED);p.message='Se terminó el tiempo.';}
 }
 if(t>=deadline)room.status='finished';
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
 room.round++;room.status='racing';room.startAt=now+3000;room.duration=ROUND_SECONDS;
 room.players=room.players.map(p=>({...runner(p.id,p.name,p.token,now,p.avatar),accountId:p.accountId}));
}
export function publicRoom(room,now,myId){
 const t=room.status==='waiting'?0:Math.min(room.duration||ROUND_SECONDS,Math.max(0,(now-room.startAt)/1000));
 const positions=podium(room.players);
 return {code:room.code,status:room.status,host:room.host,round:room.round,serverNow:now,speed:SPEED,finish:FINISH,duration:room.duration||ROUND_SECONDS,track:TRACK,startAt:room.startAt,myId,
  players:room.players.map(({token,accountId,...p})=>{const award=positions.get(p.id)||{place:null,crownMetal:null};return {...p,...award,crowned:!!award.crownMetal,x:xAt(p,t),height:p.done?0:heightAt(p,t),distance:Math.min(FINISH,p.done?p.finishDistance??p.finishAt*SPEED:progressAt(p,t)*SPEED)};})};
}
