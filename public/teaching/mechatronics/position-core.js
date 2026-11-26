/* Lecture 13: sampled outer position loop, velocity-command output. */
(function(g){
'use strict';
const defaults={distance:40,speed:10,kp:5,ki:8,kd:0.15,dt:0.02,tau:0,limit:60,tolerance:0.1,mode:'P',feedforward:false,switching:false,policy:'zero'};
function run(options={}){
 const c={...defaults,...options};
 for(const k of ['distance','speed','kp','ki','kd','dt','tau','limit','tolerance']) if(!Number.isFinite(c[k])||c[k]<0)throw Error('Invalid '+k);
 if(!c.distance||!c.speed||!c.dt||!c.limit||c.dt<0.001)throw Error('Positive distance, speed, interval and limit required');
 const end=c.distance/c.speed+5, n=Math.ceil(end/c.dt), rows=[];
 if(n>200000)throw Error('Too many samples');
 let x=0,v=0,integral=0,prevError=0,prevX=0,prevR=0,u=0,latched=false;
 for(let i=0;i<=n;i++){
  const t=i*c.dt;
  if(i){if(c.tau===0){v=u;x+=u*c.dt;}else{const a=Math.exp(-c.dt/c.tau);x+=u*c.dt+(v-u)*c.tau*(1-a);v=u+(v-u)*a;}}
  const r=Math.min(c.distance,c.speed*t),dx=x-prevX,dr=r-prevR,e=r-x;
  const xgo=r<c.distance-1e-10;
  if(c.switching&&!xgo&&Math.abs(e)<c.tolerance)latched=true;
  const p=(latched?0:c.kp)*e;
  const d=c.mode==='PID'?c.kd*(e-prevError)/c.dt:0;
  const oldIntegral=integral;
  if(c.mode!=='P')integral+=e*c.dt;
  let it=c.mode==='P'?0:c.ki*integral;
  const ff=c.feedforward&&xgo?c.speed:0;
  let raw=p+it+d+ff;
  // Conditional integration: do not accumulate further into saturation.
  if(Math.abs(raw)>c.limit&&Math.sign(e)===Math.sign(raw)) {integral=oldIntegral;it=c.mode==='P'?0:c.ki*integral;raw=p+it+d+ff;}
  u=Math.max(-c.limit,Math.min(c.limit,raw));
  if(latched&&c.policy==='zero'){u=0;integral=0;it=0;}
  rows.push({i,t,r,x,v,e,dx,dr,previousError:prevError,recurrence:prevError+dr-dx,p,it,d,ff,raw,u,integral,xgo,latched,state:latched?'In position':xgo?'Moving':'Finishing'});
  prevX=x;prevR=r;prevError=e;
 }
 return {c,rows,end:rows.at(-1).t};
}
const api={defaults,run};if(typeof module!=='undefined')module.exports=api;g.Servo=api;
})(typeof window!=='undefined'?window:globalThis);
