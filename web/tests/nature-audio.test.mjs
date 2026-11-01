import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile('public/nature-audio.js','utf8');
function setup(initialState='running'){
 const contexts=[],pending=new Map();let timer=0;
 const param=()=>({value:0,last:0,setTargetAtTime(v){this.last=v;},setValueAtTime(){},exponentialRampToValueAtTime(){}});
 const node=()=>({gain:param(),frequency:param(),connect(){},disconnect(){},start(){},stop(){}});
 class AudioContext{constructor(){this.currentTime=0;this.sampleRate=100;this.destination={};this.state=initialState;this.oscillators=[];contexts.push(this);}createGain(){return node();}createBiquadFilter(){return node();}createBufferSource(){return node();}createBuffer(n,length){return{getChannelData:()=>new Float32Array(length)};}createOscillator(){const o=node();this.oscillators.push(o);return o;}resume(){this.resumes=(this.resumes||0)+1;this.state='running';return Promise.resolve();}}
 const window={AudioContext};vm.runInNewContext(source,{window,Float32Array,Math,setTimeout(fn){pending.set(++timer,fn);return timer;},clearTimeout(id){pending.delete(id);}});
 return {audio:new window.TreasureNature(),contexts,pending};
}
test('nature audio starts only after a gesture and respects mute, volume and visibility',()=>{
 const {audio,contexts,pending}=setup();audio.setActive(true);assert.equal(contexts.length,0);
 audio.unlock();assert.equal(contexts.length,1);assert.ok(audio.master.gain.last>0);assert.equal(pending.size,1);
 audio.unlock();audio.setActive(true);assert.equal(contexts.length,1);assert.equal(pending.size,1);
 audio.setMuted(true);assert.equal(audio.master.gain.last,0);assert.equal(pending.size,0);
 audio.setMuted(false);audio.setVolume(0);assert.equal(audio.master.gain.last,0);
 audio.setVolume(.5);audio.setVisible(false);assert.equal(audio.master.gain.last,0);assert.equal(pending.size,0);
 audio.setVisible(true);assert.ok(audio.master.gain.last>0);audio.setActive(false);assert.equal(audio.master.gain.last,0);assert.equal(pending.size,0);
});
test('the reward adds a short birdsong and cannot sound while muted',()=>{
 const {audio,contexts}=setup();audio.unlock();audio.setActive(true);const before=contexts[0].oscillators.length;
 audio.chirp(true);assert.equal(contexts[0].oscillators.length,before+4);audio.setMuted(true);audio.chirp(true);assert.equal(contexts[0].oscillators.length,before+4);
});

test('the relaxing message sound also works after the race and respects mute',()=>{const {audio,contexts}=setup();audio.unlock();const before=contexts[0].oscillators.length;audio.relax();assert.equal(contexts[0].oscillators.length,before+3);audio.setMuted(true);audio.relax();assert.equal(contexts[0].oscillators.length,before+3);assert.equal(audio.rewardBus.gain.last,0);});

test('preview resumes audio after a click and plays outside a race',async()=>{const {audio,contexts}=setup();assert.equal(audio.active,false);assert.equal(await audio.preview(),true);assert.equal(audio.shouldPlay(),true);assert.ok(audio.master.gain.last>.4);assert.equal(contexts[0].oscillators.length,8);audio.setMuted(true);assert.equal(audio.master.gain.last,0);assert.equal(await audio.preview(),false);});


test('mobile suspended and interrupted audio resumes on a later gesture without creating a second context',async()=>{
 const {audio,contexts}=setup('suspended');audio.setActive(true);assert.equal(await audio.unlock(),true);const c=contexts[0];assert.equal(c.resumes,1);
 c.state='interrupted';const before=c.oscillators.length;audio.relax();assert.equal(c.oscillators.length,before);
 assert.equal(await audio.unlock(),true);assert.equal(c.resumes,2);assert.equal(contexts.length,1);audio.relax();assert.equal(c.oscillators.length,before+3);
 audio.setMuted(true);c.state='suspended';assert.equal(await audio.unlock(),false);assert.equal(c.resumes,2);
});
