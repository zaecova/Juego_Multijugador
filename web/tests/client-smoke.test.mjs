import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const html=await readFile('public/game.html','utf8');
test('client initialization and first frame have no missing elements or variables',async()=>{
 const ids=new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1])),elements=new Map();let render;
 const noop=()=>{};
 const ctx=new Proxy({createLinearGradient:()=>({addColorStop:noop})},{get:(o,k)=>o[k]||noop,set:(o,k,v)=>(o[k]=v,true)});
 const element=id=>{if(!ids.has(id))throw Error('Missing DOM element: '+id);if(!elements.has(id))elements.set(id,{value:'',hidden:false,style:{},classList:{add:noop,remove:noop},append:noop,replaceChildren:noop,addEventListener:noop,getContext:()=>ctx,width:960,height:570});return elements.get(id);};
 const doc={getElementById:element,querySelectorAll:()=>[],createElement:()=>({append:noop}),activeElement:{tagName:'BODY'}};
 const window={addEventListener:noop};const sandbox={document:doc,window,URL,URLSearchParams,location:{href:'https://game.test/game.html',search:''},sessionStorage:{getItem:()=>null,removeItem:noop,setItem:noop},navigator:{},requestAnimationFrame:fn=>render=fn,setInterval:noop,setTimeout:noop,fetch:async()=>({ok:true,json:async()=>({user:null})}),console,Blob,AbortSignal};
 vm.runInNewContext(html.split('<script>')[1].split('</script>')[0],sandbox);
 assert.equal(typeof render,'function');render();await new Promise(resolve=>setImmediate(resolve));assert.equal(element('accountOverlay').hidden,false);
});
