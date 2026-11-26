/* Lecture 12: continuous-time displacement ratios; K is controller gain, k stiffness. */
(function(root){
'use strict';
const defaults={K:10,m:1,k:10000,c:20,A:1,f:1};
const cases=[
 {id:'ideal',name:'Ideal tracking',formula:'H(s) = 1',flow:'Reference x → ideal tracking → position y'},
 {id:'open',name:'Open-loop motion',formula:'H(s) = K/s',flow:'Reference x → gain K → velocity → 1/s → position y'},
 {id:'closed',name:'Closed-loop motion',formula:'H(s) = K/(s + K)',flow:'Error (x − y) → gain K → velocity → 1/s → position y; unity negative feedback'},
 {id:'mechanism',name:'Mechanical dynamics',formula:'H(s) = k/(ms² + cs + k)',flow:'Spring-end displacement x → spring k + mass m + grounded damper c → mass displacement y'},
 {id:'combined',name:'Motion + mechanism',formula:'H(s) = Kk / [s(ms² + cs + k)]',flow:'Reference x → gain K → 1/s → spring-end displacement → mechanism → mass displacement y'},
 {id:'feedback',name:'Motion + mechanism with feedback',formula:'H(s) = Kk / (ms³ + cs² + ks + Kk)',flow:'Error (x − y) → gain K → 1/s → spring end → mechanism → mass position y; unity negative feedback from final mass'}
];
function response(id,p,f=p.f){
 const w=2*Math.PI*f; let gain=1,phase=0;
 const den=p.k-p.m*w*w;
 const mg=p.k/Math.hypot(den,p.c*w), mp=-Math.atan2(p.c*w,den);
 if(id==='open'){gain=p.K/w;phase=-Math.PI/2;}
 if(id==='closed'){gain=p.K/Math.hypot(p.K,w);phase=-Math.atan2(w,p.K);}
 if(id==='mechanism'){gain=mg;phase=mp;}
 if(id==='combined'){gain=p.K/w*mg;phase=mp-Math.PI/2;}
 if(id==='feedback'){
  const re=p.K*p.k-p.c*w*w,im=p.k*w-p.m*w*w*w;
  if(Math.hypot(re,im)<1e-12*Math.max(p.K*p.k,p.c*w*w))return {gain:NaN,phase:NaN,db:NaN,degrees:NaN,re:NaN,im:NaN};
  gain=p.K*p.k/Math.hypot(re,im);phase=-Math.atan2(im,re);
  if(stability(p)==='stable' && phase>0)phase-=2*Math.PI;
 }
 return {gain,phase,db:20*Math.log10(gain),degrees:phase*180/Math.PI,re:gain*Math.cos(phase),im:gain*Math.sin(phase)};
}
function homogeneous(t,y0,v0,p){
 const alpha=p.c/(2*p.m), wn2=p.k/p.m, d=alpha*alpha-wn2;
 if(Math.abs(d)<1e-10*wn2)return Math.exp(-alpha*t)*(y0+(v0+alpha*y0)*t);
 if(d<0){const b=Math.sqrt(-d);return Math.exp(-alpha*t)*(y0*Math.cos(b*t)+(v0+alpha*y0)/b*Math.sin(b*t));}
 const b=Math.sqrt(d),r1=-wn2/(alpha+b),r2=-alpha-b,a=(v0-r2*y0)/(r1-r2);
 return a*Math.exp(r1*t)+(y0-a)*Math.exp(r2*t);
}
function output(id,p,t,startup=false){
 if(id==='feedback'&&startup)return feedbackTrajectory(p,t,1).points.at(-1)[1];
 const w=2*Math.PI*p.f,h=response(id,p),part=p.A*h.gain*Math.sin(w*t+h.phase);
 if(!startup||id==='ideal')return part;
 if(id==='open')return p.A*p.K/w*(1-Math.cos(w*t));
 if(id==='closed')return part-p.A*h.gain*Math.sin(h.phase)*Math.exp(-p.K*t);
 const offset=id==='combined'?p.K*p.A/w:0;
 return offset+part+homogeneous(t,-offset-p.A*h.gain*Math.sin(h.phase),-p.A*h.gain*w*Math.cos(h.phase),p);
}
function stability(p){const delta=p.K-p.c/p.m;return Math.abs(delta)<=1e-10*Math.max(p.K,p.c/p.m)?'marginal':delta<0?'stable':'unstable';}
// Exact propagation of a linear system with sinusoidal forcing, using a scaled
// Taylor matrix exponential. States are [spring end, mass, velocity/wn, input, quadrature].
function transition(p,dt){
 const w=2*Math.PI*p.f,n=Math.sqrt(p.k/p.m),N=5;
 let a=[[0,-p.K,0,p.K,0],[0,0,n,0,0],[n,-n,-p.c/p.m,0,0],[0,0,0,0,w],[0,0,0,-w,0]].map(row=>row.map(v=>v*dt));
 const norm=Math.max(...a.map(row=>row.reduce((s,v)=>s+Math.abs(v),0))),scales=Math.max(0,Math.ceil(Math.log2(norm/.5)));
 a=a.map(row=>row.map(v=>v/2**scales));
 const eye=()=>Array.from({length:N},(_,i)=>Array.from({length:N},(_,j)=>+(i===j)));
 const mul=(a,b)=>a.map(row=>b[0].map((_,j)=>row.reduce((sum,v,k)=>sum+v*b[k][j],0)));
 let sum=eye(),term=eye();
 for(let k=1;k<=24;k++){term=mul(term,a).map(row=>row.map(v=>v/k));sum=sum.map((row,i)=>row.map((v,j)=>v+term[i][j]));}
 for(let i=0;i<scales;i++)sum=mul(sum,sum);
 return sum;
}
function feedbackTrajectory(p,duration,count=1600){
 const M=transition(p,duration/count),points=[[0,0,0,0]];let state=[0,0,0,0,p.A],limited=false;
 for(let i=1;i<=count;i++){
  const next=M.map(row=>row.reduce((sum,v,k)=>sum+v*state[k],0));
  if(next.some(v=>!Number.isFinite(v))||Math.abs(next[1])>1e6*p.A){limited=true;break;}
  state=next;points.push([duration*i/count,state[1],state[0],state[2]*Math.sqrt(p.k/p.m)]);
 }
 return {points,limited};
}
function springEnd(id,p,t,startup=false){
 if(id==='mechanism')return p.A*Math.sin(2*Math.PI*p.f*t);
 if(id==='combined')return output('open',p,t,startup);
 if(id==='feedback'){
  if(startup)return feedbackTrajectory(p,t,1).points.at(-1)[2];
  const w=2*Math.PI*p.f,h=response(id,p),angle=w*t+h.phase;
  return p.A*h.gain*((1-p.m*w*w/p.k)*Math.sin(angle)+p.c*w/p.k*Math.cos(angle));
 }
 return null;
}
const api={defaults,cases,response,output,homogeneous,stability,feedbackTrajectory,springEnd};
if(typeof module!=='undefined')module.exports=api;else root.Frequency=api;
})(typeof globalThis!=='undefined'?globalThis:this);
