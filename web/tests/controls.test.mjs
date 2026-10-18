import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {runner,reset,input,publicRoom} from '../lib/race.mjs';
const html=await readFile('public/game.html','utf8');
function controls(){
 const room={code:'TEST',host:'a',players:[runner('a','Ana','secret',0)],round:0,status:'waiting'};reset(room,0);
 let now=3100;const buttons=[...html.matchAll(/<button data-act="([^"]+)"/g)].map(m=>({dataset:{act:m[1]},handlers:{},addEventListener(k,f){this.handlers[k]=f;}}));
 const document={activeElement:{tagName:'BODY'},querySelectorAll:()=>buttons};const handlers={};const window={addEventListener:(k,f)=>handlers[k]=f};
 const context=vm.createContext({document,window,Date:{now:()=>now},playing:true,snapshot:room,offset:0,session:{},actionQueue:Promise.resolve(),api:async(op,{action})=>{input(room,room.players[0],action,now);return room;},accept:()=>{},message:msg=>{throw Error(msg);}});
 const action=html.match(/function action\(a\)\{[^\n]+/)[0];
 const bindings=html.slice(html.indexOf("window.addEventListener('keydown'"),html.indexOf('\nfunction accountScreen'));
 vm.runInContext(action+'\n'+bindings,context);
 const drain=()=>vm.runInContext('actionQueue',context);
 return {room,buttons,document,handlers,drain,setTime:n=>now=n,press:async(a,event='pointerdown',detail=0)=>{buttons.find(b=>b.dataset.act===a).handlers[event]({button:0,detail,preventDefault(){}});await drain();}};
}
test('actual left, right and jump button handlers reach the authoritative simulation',async()=>{
 const c=controls(),p=c.room.players[0];
 await c.press('right');assert.equal(p.lane,2);
 c.setTime(3200);await c.press('right');assert.equal(p.lane,2);
 c.setTime(3300);await c.press('left');assert.equal(p.lane,1);
 c.setTime(3400);await c.press('left');assert.equal(p.lane,0);
 c.setTime(3500);await c.press('left');assert.equal(p.lane,0);
 await c.press('jump');assert.equal(p.jumpedAt,.5);
 assert.ok(publicRoom(c.room,3700,'a').players[0].height>0);
 c.setTime(3700);await c.press('jump');assert.equal(p.jumpedAt,.5);
 c.setTime(4500);await c.press('jump');assert.equal(p.jumpedAt,1.5);
});
test('keyboard, accessible clicks, countdown, finished race and text focus guards',async()=>{
 const c=controls(),p=c.room.players[0];
 c.setTime(2900);await c.press('right');assert.equal(p.lane,1);
 c.setTime(3100);await c.press('left','click',0);assert.equal(p.lane,0);
 c.setTime(3200);await c.press('right','click',1);assert.equal(p.lane,0); // pointer click must not repeat pointerdown
 const key=async code=>{c.handlers.keydown({code,repeat:false,preventDefault(){}});await c.drain();};
 await key('KeyD');assert.equal(p.lane,1);
 c.setTime(3300);await key('ArrowRight');assert.equal(p.lane,2);
 c.setTime(3400);await key('KeyA');assert.equal(p.lane,1);
 c.setTime(3500);await key('ArrowLeft');assert.equal(p.lane,0);
 await key('Space');assert.equal(p.jumpedAt,.5);
 c.document.activeElement={tagName:'INPUT'};c.setTime(4600);await key('KeyD');assert.equal(p.lane,0);
 c.document.activeElement={tagName:'BUTTON',dataset:{act:'left'}};await key('Space');assert.equal(p.jumpedAt,.5);
 p.done=true;await c.press('right');assert.equal(p.lane,0);
});
