/* ATmega328P synchronous timer teaching model. One tick is one prescaled clock. */
(function(root){
'use strict';
const divisors = id => id === 2 ? [0,1,8,32,64,128,256,1024] : [0,1,8,64,256,1024];
class Timer {
 constructor(config={}) { this.reset(config); }
 reset(config) {
  this.c={id:0,mode:'normal',divisor:64,hz:16000000,preload:250,a:128,b:64,reload:false,...config};
  const c=this.c, max=c.id===1?65535:255;
  if(![0,1,2].includes(c.id)||!['normal','ctc'].includes(c.mode)||!divisors(c.id).includes(c.divisor)||!Number.isFinite(c.hz)||c.hz<=0||['preload','a','b'].some(k=>!Number.isInteger(c[k])||c[k]<0||c[k]>max)) throw Error('Invalid timer settings');
  this.max=max; this.count=c.preload;this.ticks=0;this.flags=0;this.events=[];this.totals={a:0,b:0,overflow:0};this.history=[{tick:0,count:this.count,flags:0}];
 }
 get tickSeconds(){return this.c.divisor/this.c.hz;}
 get controlA(){return this.c.mode==='ctc'&&this.c.id!==1?2:0;}
 get controlB(){return divisors(this.c.id).indexOf(this.c.divisor)|(this.c.mode==='ctc'&&this.c.id===1?8:0);}
 clear(mask){this.flags&=~mask;}
 tick(){
  if(!this.c.divisor)return [];
  const old=this.count,c=this.c,events=[];
  this.ticks++;
  // Equality during the previous count interval raises OCF on this timer edge.
  if(old===c.a){this.flags|=2;this.totals.a++;events.push('Compare A');}
  if(old===c.b){this.flags|=4;this.totals.b++;events.push('Compare B');}
  if(old===this.max){this.flags|=1;this.totals.overflow++;events.push('Overflow');}
  this.count=(c.mode==='ctc'&&old===c.a)||old===this.max?0:old+1;
  if(old===this.max&&c.mode==='normal'&&c.reload){this.count=c.preload;events.push('Software reload (idealized)');}
  for(const name of events)this.events.unshift({tick:this.ticks,name});
  this.events=this.events.slice(0,30);
  this.history.push({tick:this.ticks,count:this.count,flags:this.flags,event:events.length>0});
  if(this.history.length>700)this.history.shift();
  return events;
 }
 nextEvent(){if(!this.c.divisor)return;for(let i=0;i<=this.max;i++)if(this.tick().length)return;}
}
root.AVRTimer={Timer,divisors};
if(typeof module!=='undefined')module.exports=root.AVRTimer;
})(typeof globalThis!=='undefined'?globalThis:window);
