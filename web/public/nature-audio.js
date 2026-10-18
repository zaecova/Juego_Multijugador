/* Nature ambience synthesized locally: no microphone, downloads or external audio. */
(()=>{
 class NatureAudio {
  constructor(){this.context=null;this.master=null;this.ambient=null;this.rewardBus=null;this.active=false;this.muted=false;this.volume=.65;this.visible=true;this.birdTimer=0;this.unavailable=false;this.testing=false;this.testTimer=0;}
  unlock(){
   if(this.muted||this.unavailable)return Promise.resolve(false);
   try{
    if(!this.context){
     const Audio=window.AudioContext||window.webkitAudioContext;
     if(!Audio){this.unavailable=true;return Promise.resolve(false);}
     const c=this.context=new Audio();
     this.master=c.createGain();this.master.gain.value=0;this.master.connect(c.destination);this.rewardBus=c.createGain();this.rewardBus.connect(c.destination);
     this.ambient=c.createGain();this.ambient.gain.value=.75;this.ambient.connect(this.master);
     // Filtered brown noise forms a quiet, continuously flowing stream.
     const buffer=c.createBuffer(1,Math.floor(c.sampleRate*3),c.sampleRate),samples=buffer.getChannelData(0);
     let brown=0;for(let i=0;i<samples.length;i++){brown=(brown+(Math.random()*2-1)*.025)/1.025;samples[i]=brown*3.2;}
     const source=c.createBufferSource();source.buffer=buffer;source.loop=true;
     const high=c.createBiquadFilter();high.type='highpass';high.frequency.value=180;
     const low=c.createBiquadFilter();low.type='lowpass';low.frequency.value=1700;
     const stream=c.createGain();stream.gain.value=.65;
     source.connect(high);high.connect(low);low.connect(stream);stream.connect(this.ambient);source.start();
     const ripple=c.createOscillator(),depth=c.createGain();ripple.frequency.value=.19;depth.gain.value=.06;ripple.connect(depth);depth.connect(stream.gain);ripple.start();
    }
    this.sync();return Promise.resolve(this.context.resume()).then(()=>{this.sync();return this.context.state==='running';}).catch(()=>false);
   }catch{this.unavailable=true;return Promise.resolve(false);}
  }
  setActive(value){if(this.active===!!value)return;this.active=!!value;this.sync();}
  setMuted(value){this.muted=!!value;this.sync();}
  setVolume(value){this.volume=Math.max(0,Math.min(1,Number(value)||0));this.sync();}
  setVisible(value){this.visible=!!value;this.sync();}
  shouldPlay(){return (this.active||this.testing)&&!this.muted&&this.visible&&this.volume>0;}
  sync(){
   if(!this.context)return;
   this.rewardBus.gain.setTargetAtTime(!this.muted&&this.visible?this.volume*.75:0,this.context.currentTime,.08);
   this.master.gain.setTargetAtTime(this.shouldPlay()?this.volume*.75:0,this.context.currentTime,.12);
   if(this.shouldPlay()){if(!this.birdTimer)this.scheduleBird();}
   else{clearTimeout(this.birdTimer);this.birdTimer=0;}
  }
  scheduleBird(){
   this.birdTimer=setTimeout(()=>{this.birdTimer=0;if(!this.shouldPlay())return;this.chirp(false);this.scheduleBird();},2500+Math.random()*3500);
  }
  async preview(){
   if(this.muted||this.volume<=0)return false;
   if(!await this.unlock())return false;
   clearTimeout(this.testTimer);this.testing=true;this.sync();this.chirp(true);this.relax();
   this.testTimer=setTimeout(()=>{this.testing=false;this.testTimer=0;this.sync();},3000);return true;
  }
  relax(){
   if(!this.context||this.muted||!this.visible||this.volume<=0||this.context.state==='suspended')return;
   const c=this.context,start=c.currentTime+.01;
   // Gentle consonant tones rise slowly and fade across the full reading interval.
   for(const frequency of [523.25,659.25,783.99]){
    const tone=c.createOscillator(),gain=c.createGain();tone.type='sine';tone.frequency.value=frequency;
    gain.gain.setValueAtTime(.0001,start);gain.gain.exponentialRampToValueAtTime(.12,start+.4);gain.gain.setTargetAtTime(.04,start+1,.6);gain.gain.exponentialRampToValueAtTime(.0001,start+2.97);
    tone.connect(gain);gain.connect(this.rewardBus);tone.start(start);tone.stop(start+3);
    tone.onended=()=>{tone.disconnect();gain.disconnect();};
   }
  }
  chirp(reward=false){
   if(!this.context||!this.shouldPlay()||this.context.state==='suspended')return;
   const c=this.context,start=c.currentTime+.015,count=reward?4:2;
   for(let i=0;i<count;i++){
    const at=start+i*.14,frequency=(reward?2100:1750)+i*230+Math.random()*300;
    const bird=c.createOscillator(),gain=c.createGain();bird.type='sine';
    bird.frequency.setValueAtTime(frequency,at);bird.frequency.exponentialRampToValueAtTime(frequency*1.42,at+.045);bird.frequency.exponentialRampToValueAtTime(frequency*.78,at+.13);
    gain.gain.setValueAtTime(.0001,at);gain.gain.exponentialRampToValueAtTime(reward?.22:.18,at+.02);gain.gain.exponentialRampToValueAtTime(.0001,at+.15);
    bird.connect(gain);gain.connect(this.master);bird.start(at);bird.stop(at+.18);
    bird.onended=()=>{bird.disconnect();gain.disconnect();};
   }
  }
 }
 window.TreasureNature=NatureAudio;
})();
