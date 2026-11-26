/* Lecture 17 teaching models. SI units unless explicitly named. */
(function(root){
'use strict';
const TAU=2*Math.PI;
const motor={R:2,L:0.02,K:0.1,J:0.003,b:0.001};
const defaults={supply:24,duty:0.55,frequency:500,load:0.12,mode:'forward',freewheel:'sync',decay:'slow'};
function initial(){return {t:0,i:0,w:0,angle:0};}
function gates(t,p){
 const on=(t*p.frequency)%1 < p.duty-1e-10;
 if(p.mode==='brake')return [false,true,false,true];
 if(p.mode==='coast')return [false,false,false,false];
 if(!on&&p.freewheel==='diode'&&p.decay==='fast')return [false,false,false,false];
 return on?(p.mode==='forward'?[true,false,false,true]:[false,true,true,false]):p.freewheel==='diode'?(p.mode==='forward'?[false,false,false,true]:[false,true,false,false]):[false,true,false,true];
}
function terminal(t,i,p,w=0){
 if(p.mode==='coast')return Math.abs(i)<1e-9?motor.K*w:-Math.sign(i)*(p.supply+1.4);
 const g=gates(t,p);
 if(!g.some(Boolean)){const limit=p.supply+1.4;return Math.abs(i)<1e-9?Math.max(-limit,Math.min(limit,motor.K*w)):-Math.sign(i)*limit;}
 if(p.freewheel==='diode'){
  const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));
  if(p.mode==='brake')return Math.abs(i)<1e-9?clamp(motor.K*w,-.7,.7):-Math.sign(i)*.7;
  const direction=p.mode==='forward'?1:-1;
  // Opposing current returns through the external diode pair, even if switches are commanded on.
  if(i*direction < -1e-9)return direction*(p.supply+1.4);
  if(g[0]||g[2])return direction*p.supply;
  if(Math.abs(i)<1e-9)return direction>0?clamp(motor.K*w,-.7,p.supply+1.4):clamp(motor.K*w,-p.supply-1.4,.7);
  return -direction*.7;
 }
 return p.supply*((g[0]?1:0)-(g[2]?1:0));
}
function conduction(t,i,p){
 const g=gates(t,p),switches=[],diodes=[];
 if(Math.abs(i)<1e-8)return {switches,diodes};
 const add=(index)=>{if(g[index]&&(p.freewheel!=='diode'||(i>0?[0,3]:[1,2]).includes(index)))switches.push(index);else diodes.push(index);};
 if(p.mode==='coast'||!g.some(Boolean)){diodes.push(...(i>0?[1,2]:[0,3]));}
 else if(p.mode==='brake'){add(1);add(3);}
 else if(p.freewheel==='diode'&&i*(p.mode==='forward'?1:-1)<0){diodes.push(...(i>0?[1,2]:[0,3]));}
 else if(g[0]||g[2]){add(p.mode==='forward'?0:1);add(p.mode==='forward'?3:2);}
 else{add(1);add(3);}
 return {switches,diodes};
}
function powerFlow(t,i,p,w=0){
 const path=conduction(t,i,p),g=gates(t,p),voltage=terminal(t,i,p,w);
 const diodeLoss=path.diodes.length*.7*Math.abs(i);
 const supplyPower=path.diodes.length===2?-p.supply*Math.abs(i):(g[0]||g[2])?p.supply*(g[0]?1:-1)*i:0;
 const copperLoss=motor.R*i*i,mechanicalPower=motor.K*i*w;
 return {supplyPower,diodeLoss,copperLoss,mechanicalPower,magneticPower:voltage*i-copperLoss-mechanicalPower,voltage};
}
function step(s,p,duration){
 let left=duration;
 while(left>1e-12){
  // Align integration to PWM edges, including arbitrary duty cycles.
  const phase=((s.t*p.frequency)%1+1)%1;
  let edge=(phase < p.duty-1e-9?p.duty-phase:1-phase)/p.frequency;
  if(edge<1e-10)edge=1/p.frequency;
  const h=Math.min(left,1/(p.frequency*32),0.0001,edge);
  const v=terminal(s.t+h/2,s.i,p,s.w),old=s.i;
  let next=(old-(v-motor.K*s.w)/motor.R)*Math.exp(-motor.R*h/motor.L)+(v-motor.K*s.w)/motor.R;
  if(p.mode==='coast'&&(Math.abs(old)<1e-9||old*next<=0))next=0;
  if(p.freewheel==='diode'&&old*next<0)next=0;
  const current=(old+next)/2;
  const friction=p.load+motor.b*Math.abs(s.w);
  const torque=motor.K*current;
  let w=s.w+(torque-(Math.abs(s.w)>1e-8?Math.sign(s.w)*friction:Math.max(-friction,Math.min(friction,torque))))/motor.J*h;
  if(s.w*w<0&&Math.abs(torque)<=friction)w=0;
  s.i=next;s.angle+=(s.w+w)*h/2;s.w=w;s.t+=h;left-=h;
 }
 return s;
}
function nextEdge(s,p){const phase=(s.t*p.frequency)%1;return (phase<p.duty-1e-8?p.duty-phase:1-phase)/p.frequency+1e-9;}
function rpm(w){return w*60/TAU;}
function conversion(t,p){
 const theta=((TAU*p.line*t)%TAU+TAU)%TAU,primary=p.peak*Math.sin(theta),secondary=primary*p.ratio;
 const rect=p.rect==='half'?Math.max(0,secondary):p.rect==='scr'?(theta>=p.alpha*Math.PI/180&&theta<=Math.PI?secondary:0):Math.abs(secondary);
 return {primary,secondary,rect};
}
function rectMean(p){const v=p.peak*p.ratio;return p.rect==='full'?2*v/Math.PI:p.rect==='half'?v/Math.PI:v*(1+Math.cos(p.alpha*Math.PI/180))/(2*Math.PI);}
function field(p){const ns=120*p.hz/p.poles;const slip=p.type==='induction'?0.015+0.12*p.load:0;return {ns,slip,nr:ns*(1-slip),lag:p.type==='induction'?0:Math.asin(Math.min(.95,p.load*.85))};}
function phases(theta,reverse=false){const sign=reverse?-1:1;return [0,1,2].map(k=>Math.sin(theta-sign*k*TAU/3));}
function resultant(values){return values.reduce((a,v,k)=>({x:a.x+v*Math.cos(k*TAU/3),y:a.y+v*Math.sin(k*TAU/3)}),{x:0,y:0});}
// Isolated switched RL load. Clamp values are assumptions, not a breakdown prediction.
function flyback(t,p){const clamp=p.protected?0.7:p.clamp;const i=Math.max(0,(p.current+clamp/p.R)*Math.exp(-p.R*t/p.L)-clamp/p.R);return {i,v:i>0?-clamp:0,switchV:i>0?p.supply+clamp:p.supply};}
// Find carrier crossings rather than sampling PWM sparsely (avoids false pulse aliasing).
function pwmWave(duration,hz,carrier,amplitude=1){
 const difference=t=>Math.sin(TAU*hz*t)-(4*Math.abs((t*carrier)%1-.5)-1);
 const signal=t=>difference(t)>=0?amplitude:-amplitude;
 const result=[[0,signal(1e-12)]];let previous=signal(1e-12);
 const half=1/(2*carrier);
 for(let start=0;start<duration-1e-12;start+=half){
  let lo=start,hi=Math.min(duration,start+half),dl=difference(lo),dh=difference(hi);
  if(dl*dh<0){for(let k=0;k<35;k++){const mid=(lo+hi)/2,dm=difference(mid);if(dl*dm<=0)hi=mid;else{lo=mid;dl=dm;}}
   const t=(lo+hi)/2,next=signal(Math.min(duration,t+1e-10));result.push([t,previous],[t,next]);previous=next;
  }
 }
 result.push([duration,previous]);return result;
}
function waveWindow(p){return p.fit?2/p.hz:p.window/1000;}
function electricalAngle(seconds,hz){return TAU*hz*seconds;}
function flybackEnd(p){const clamp=p.protected?.7:p.clamp;return p.L/p.R*Math.log(1+p.R*p.current/clamp);}
const api={powerFlow,conduction,pwmWave,waveWindow,electricalAngle,flybackEnd,TAU,motor,defaults,initial,gates,terminal,step,nextEdge,rpm,conversion,rectMean,field,phases,resultant,flyback};
if(typeof module!=='undefined')module.exports=api;root.MotorCore=api;
})(typeof globalThis!=='undefined'?globalThis:this);
