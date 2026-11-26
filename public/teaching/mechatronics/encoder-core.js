/* Shared teaching model. Counts/revolution always means decoded counts. */
(function(root){
'use strict';
const mod=(a,b)=>((a%b)+b)%b;
function homeAt(x,slits){return mod(x,4*slits)<1?1:0;}
function metrics(c,n){
 const p=c.slits*c.decode, fd=c.clock/c.divisor, r=Math.abs(n), q=p*r*c.ts/60, i=r?60*fd/(p*r):Infinity;
 return {p,fd,q,i,cross:60/p*Math.sqrt(fd/c.ts),countAbs:60/(p*c.ts),durationAbs:r/i,countRel:q?100/q:Infinity,durationRel:100/i,period:r?60/(p*r):Infinity,limit:60*2**(c.bits-1)/(p*(r||Infinity))};
}
function delta(now,prev,bits){const M=2**bits;return mod(now-prev+M/2,M)-M/2;}
class Encoder {
 constructor(c){this.c={...c};this.t=0;this.x=.25;this.origin=Math.floor((this.x+4/c.decode-1)/(4/c.decode));this.count=0;this.lastSample=0;this.software=0;this.nextSample=c.ts;this.samples=[];this.segments=[];this.lastEdge=null;this.ticks=null;this.periodRPM=null;this.countRPM=null;this.ambiguous=false;this.lastDelta=0;}
 advance(dt,rpm){
  const end=this.t+dt, rate=rpm*this.c.slits*4/60, factor=4/this.c.decode;
  let loops=0;
  while(this.t<end-1e-12 && loops++<10002){
   const stop=Math.min(end,this.nextSample), start=this.t, x0=this.x;
   this.x+=rate*(stop-start);this.t=stop;
   const offset=this.c.decode===1 && rate<0?1:factor-1, old=Math.floor((x0+offset)/factor), current=Math.floor((this.x+offset)/factor), dc=current-old;
   if(dc){
    const boundary=(rate>0?current*factor:(current+1)*factor)-offset;
    const edgeTime=start+(boundary-x0)/rate;
    const edgeTick=Math.floor(edgeTime*this.c.clock/this.c.divisor+1e-8);
    const previous=Math.abs(dc)>1?Math.floor((edgeTime-factor/Math.abs(rate))*this.c.clock/this.c.divisor+1e-8):this.lastEdge?.tick;
    if(previous!==undefined){this.ticks=edgeTick-previous;this.periodRPM=this.ticks>0?Math.sign(rate)*60*(this.c.clock/this.c.divisor)/(this.c.slits*this.c.decode*this.ticks):null;}
    this.lastEdge={time:edgeTime,tick:edgeTick};
   }
   this.count+=dc;
   this.segments.push({start,end:stop,x0,x1:this.x});this.segments=this.segments.slice(-120);
   if(this.t>=this.nextSample-1e-12){
    const raw=mod(this.count,2**this.c.bits), prev=mod(this.lastSample,2**this.c.bits), actual=this.count-this.lastSample;
    this.lastDelta=delta(raw,prev,this.c.bits);this.software+=this.lastDelta;
    this.ambiguous=Math.abs(actual)>=2**(this.c.bits-1);
    this.countRPM=this.lastDelta*60/(this.c.slits*this.c.decode*this.c.ts);
    this.samples.push({t:this.t,raw,actual,delta:this.lastDelta,software:this.software,trueCount:this.count,rpm:this.countRPM,bad:this.ambiguous});this.samples=this.samples.slice(-24);
    this.lastSample=this.count;this.nextSample+=this.c.ts;
   }
  }
 }
}
const api={mod,homeAt,metrics,delta,Encoder};if(typeof module!=='undefined')module.exports=api;root.EncoderCore=api;
})(typeof window!=='undefined'?window:globalThis);
