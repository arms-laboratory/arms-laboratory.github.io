'use strict';
(()=>{
const $=id=>document.getElementById(id), C=EncoderCore, isCalc=!!$('chart');
const fmt=(v,d=3)=>!Number.isFinite(v)?'—':v!==0&&Math.abs(v)<10**(-d)?v.toExponential(2):Number(v.toPrecision(6)).toLocaleString('en-US',{maximumFractionDigits:d});
const keys=['slits','decode','ts','bits','clock','divisor','timerBits'];
function config(){return {slits:+$('slits').value,decode:+$('decode').value,ts:+$('ts').value/1000,bits:+$('bits').value,clock:+$('clock').value*1e6,divisor:+$('divisor').value,timerBits:+$('timerBits').value};}
function fill(c){for(const k of keys)if(c[k]!=null)$(k).value=k==='ts'?c[k]*1000:k==='clock'?c[k]/1e6:c[k];}
function valid(){const ok=$('settings').checkValidity();$('error').textContent=ok?'':'Enter positive values within the displayed input limits.';return ok;}
function link(file,c,rpm){const q=new URLSearchParams();for(const k of keys)q.set(k,c[k]);q.set('rpm',rpm);return file+'?'+q;}
const incoming=new URLSearchParams(location.search), received={};for(const k of keys){const v=Number(incoming.get(k));if(incoming.has(k)&&Number.isFinite(v))received[k]=v;}fill(received);
if(!valid())fill({slits:256,decode:4,ts:.01,bits:16,clock:16e6,divisor:8,timerBits:16});
const stat=(label,value,detail)=>`<div class="stat"><span>${label}</span><strong>${value}</strong><small>${detail}</small></div>`;
const line=(x1,y1,x2,y2,color='#cbd5cd',dash='')=>`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" ${dash?`stroke-dasharray="${dash}"`:''}/>`;
const text=(x,y,s,anchor='start')=>`<text x="${x}" y="${y}" text-anchor="${anchor}">${s}</text>`;
const path=(points,color,dash='')=>`<path d="${points.map((p,i)=>(i?'L':'M')+p.map(x=>x.toFixed(2)).join(' ')).join(' ')}" fill="none" stroke="${color}" stroke-width="2.5" ${dash?`stroke-dasharray="${dash}"`:''}/>`;
const green='#086b54',blue='#355c93';
if(isCalc){
 let saved=null,c,lastC,lo=1,hi=3000,n=100;
 if(incoming.has('rpm'))$('speed').value=Math.max(.001,Math.abs(+incoming.get('rpm'))||1);
 function render(){
  if(!valid())return;lo=+$('minRPM').value;hi=+$('maxRPM').value;
  if(hi<=lo){$('error').textContent='Plot maximum must exceed minimum.';return;}
  if(!$('speed').checkValidity()){ $('error').textContent='Selected speed must be positive and no greater than 1,000,000 RPM.';return;}
  c=config();lastC={...c};n=+$('speed').value;const m=C.metrics(c,n),target=+$('target').value,relative=$('units').value==='relative';
  const x=v=>75+775*(Math.log10(v)-Math.log10(lo))/(Math.log10(hi)-Math.log10(lo));
  const value=(cc,r,method)=>{const z=C.metrics(cc,r);return z[method+(relative?'Rel':'Abs')];};
  const vals=[value(c,lo,'count'),value(c,hi,'count'),value(c,lo,'duration'),value(c,hi,'duration')];if(saved)for(const r of [lo,hi])for(const a of ['count','duration'])vals.push(value(saved,r,a));if(relative)vals.push(target);
  let ymin=Math.floor(Math.log10(Math.min(...vals))),ymax=Math.ceil(Math.log10(Math.max(...vals)));if(ymin===ymax)ymax++;
  const y=v=>350-310*(Math.log10(v)-ymin)/(ymax-ymin);
  let svg='<defs><clipPath id="plotclip"><rect x="75" y="40" width="775" height="310"/></clipPath></defs>';
  const targetLow=60/(m.p*c.ts*(target/100)),targetHigh=60*m.fd*(target/100)/m.p;
  if(targetLow<=targetHigh){const a=Math.max(lo,targetLow),b=Math.min(hi,targetHigh);if(b>a)svg+=`<rect x="${x(a)}" y="40" width="${x(b)-x(a)}" height="310" fill="#e0f0e7"/>`;}
  const dy=Math.max(1,Math.ceil((ymax-ymin)/7));for(let e=ymin;e<=ymax;e+=dy){svg+=line(75,y(10**e),850,y(10**e))+text(65,y(10**e)+4,`10^${e}`,'end');}
  for(let j=0;j<=5;j++){const r=lo*(hi/lo)**(j/5);svg+=line(x(r),40,x(r),350)+text(x(r),373,fmt(r,2),'middle');}
  svg+=text(75,22,relative?'Relative quantization error (%)':'Absolute quantization error (RPM)')+text(460,402,'Speed (RPM) · logarithmic axes','middle');
  svg+='<g clip-path="url(#plotclip)">';
  if(relative)svg+=line(75,y(target),850,y(target),'#a44c1b','3 5');else svg+=path([[x(lo),y(lo*target/100)],[x(hi),y(hi*target/100)]],'#a44c1b','3 5');
  function curve(cc,method,color,dash=''){return path(Array.from({length:200},(_,j)=>{let r=lo*(hi/lo)**(j/199);return [x(r),y(value(cc,r,method))];}),color,dash);}
  if(saved)svg+=`<g opacity="0.4">${curve(saved,'count',green,'7 5')}${curve(saved,'duration',blue,'7 5')}</g>`;
  svg+=curve(c,'count',green)+curve(c,'duration',blue);
  if(m.cross>=lo&&m.cross<=hi){svg+=line(x(m.cross),40,x(m.cross),350,'#52665f','5 4')+`<circle cx="${x(m.cross)}" cy="${y(value(c,m.cross,'count'))}" r="5" fill="#17332f"/>`;}
  if(n>=lo&&n<=hi){svg+=line(x(n),40,x(n),350,'#17332f');for(const [method,color]of [['count',green],['duration',blue]])svg+=`<circle cx="${x(n)}" cy="${y(value(c,n,method))}" r="5" fill="${color}"/>`;}
  svg+='</g>';if(m.cross>=lo&&m.cross<=hi)svg+=text(Math.max(150,Math.min(760,x(m.cross))),34,`Crossover ${fmt(m.cross)} RPM`,'middle');
  $('chart').innerHTML=svg;
  $('slider').value=Math.max(0,Math.min(1000,1000*Math.log(n/lo)/Math.log(hi/lo)));
  $('summary').innerHTML=stat('Effective resolution',fmt(m.p,0)+' counts/rev',`${c.slits} cycles × ${c.decode} decoding`)+stat('Timer tick',fmt(1e6/m.fd)+' µs',`${fmt(m.fd)} ticks/s after ÷${c.divisor}`)+stat('Approximate crossover',fmt(m.cross)+' RPM',`${fmt(C.metrics(c,m.cross).countRel)}% quantization error`);
  $('verdict').textContent=`At ${fmt(n)} RPM: counting ≈ ${fmt(m.countRel)}% (${fmt(m.countAbs)} RPM); duration ≈ ${fmt(m.durationRel)}% (${fmt(m.durationAbs)} RPM). ${Math.abs(m.countRel-m.durationRel)<1e-8?'The two estimates are equal.':m.countRel<m.durationRel?'Pulse counting has the lower predicted quantization error.':'Pulse duration has the lower predicted quantization error.'}${n<lo||n>hi?' Selected speed is outside the plotted range.':''}`;
  $('target-note').textContent=`For ≤ ${target}% error: counting needs n ≥ ${fmt(targetLow)} RPM; duration needs n ≤ ${fmt(targetHigh)} RPM. ${targetLow<=targetHigh?`Both satisfy the target from ${fmt(targetLow)} to ${fmt(targetHigh)} RPM.`:'There is no overlap meeting the target.'} These are quantization limits; check counter and timer limits below.`;
  $('count-math').innerHTML=`p = ${c.slits} × ${c.decode} = ${m.p} counts/rev<br>q = p n Ts / 60<br> = ${m.p} × ${fmt(n)} × ${fmt(c.ts,6)} / 60<br> = ${fmt(m.q)} expected counts/window<br>ε ≈ 100/q = ${fmt(m.countRel)}%<br>Δn ≈ 60/(p Ts) = ${fmt(m.countAbs)} RPM<br>Update interval = ${fmt(c.ts*1000)} ms`;
  $('duration-math').innerHTML=`fd = ${fmt(c.clock)} / ${c.divisor} = ${fmt(m.fd)} Hz<br>i = 60 fd / (p n)<br> = 60 × ${fmt(m.fd)} / (${m.p} × ${fmt(n)})<br> = ${fmt(m.i)} expected ticks/edge<br>ε ≈ 100/i = ${fmt(m.durationRel)}%<br>Δn ≈ n/i = ${fmt(m.durationAbs)} RPM<br>Edge interval = ${fmt(m.period*1000,6)} ms`;
  $('cross-math').innerHTML=`60/(p n Ts) = p n/(60 fd)<br>n_cross = (60/p) √(fd/Ts)<br> = (60/${m.p}) √(${fmt(m.fd)}/${fmt(c.ts,6)})<br> = ${fmt(m.cross)} RPM`;
  const notes=[];if(m.q<10)notes.push('Fewer than 10 counts/window: counting is coarse; individual samples may differ substantially.');if(m.i<10)notes.push('Fewer than 10 timer ticks/edge: the duration approximation is poor.');if(m.i>=2**c.timerBits)notes.push(`${c.timerBits}-bit duration timer wraps before the next edge; overflow handling is required.`);if(m.q>=2**(c.bits-1))notes.push('Position counter changes by at least half its range per sample: signed displacement is ambiguous.');const mc=C.metrics(c,m.cross);if(mc.q>=2**(c.bits-1)||mc.i>=2**c.timerBits||mc.i<10)notes.push('The mathematical crossover falls outside at least one modeled operating limit.');
  $('limits').textContent=(notes.length?notes.join(' '):'Selected speed is within the modeled counter range and has at least 10 counts and timer ticks.')+` Signed tracking requires |Δcount| < ${2**(c.bits-1)}. Duration timer range: ${fmt(2**c.timerBits/m.fd*1000)} ms. Startup duration measurement requires two edges.`;
  $('comparison').textContent=saved?`Saved curves: ${saved.slits*saved.decode} counts/rev, ${fmt(saved.ts*1000)} ms window, ${fmt(saved.clock/saved.divisor)} Hz timer.`:'Keep the current curves, then change a parameter to compare designs.';
  $('lab-link').href=link('encoder.html',c,n);
 }
 $('settings').onsubmit=e=>e.preventDefault();$('settings').oninput=render;$('settings').onchange=render;$('units').onchange=render;$('speed').oninput=render;
 $('slider').oninput=()=>{$('speed').value=(lo*(hi/lo)**(+$('slider').value/1000)).toPrecision(7);render();};
 $('cross').onclick=()=>{if(!lastC)return;const v=C.metrics(lastC,1).cross;$('speed').value=v.toPrecision(12);if(v<lo)$('minRPM').value=Math.max(.001,v/2);if(v>hi)$('maxRPM').value=Math.min(1e6,v*2);render();};
 $('save').onclick=()=>{if(!valid())return;saved={...lastC};$('clear').disabled=false;render();};$('clear').onclick=()=>{saved=null;$('clear').disabled=true;render();};
 $('lecture').onclick=()=>{fill({slits:2048,decode:4,ts:.01,bits:16,clock:16e6,divisor:8,timerBits:16});render();};
 $('example').onclick=()=>{fill({slits:2048,decode:4,ts:.01,bits:16,clock:8e6,divisor:8,timerBits:16});$('speed').value=60/8192*Math.sqrt(1e6/.01);render();};
 let dragging=false;function pick(e){const rect=$('chart').getBoundingClientRect(),xx=(e.clientX-rect.left)/rect.width*900;const f=Math.max(0,Math.min(1,(xx-75)/775));$('speed').value=(lo*(hi/lo)**f).toPrecision(7);render();}
 $('chart').onpointerdown=e=>{dragging=true;$('chart').setPointerCapture(e.pointerId);pick(e);};$('chart').onpointermove=e=>{if(dragging)pick(e);};$('chart').onpointerup=$('chart').onpointercancel=()=>dragging=false;
 window.addEventListener("pageshow",()=>requestAnimationFrame(render));
 render();return;
}
let c=config(),sim,history=[],playing=null,rpm=30;
const lessons=[
 ['Read every edge','Start with a slow shaft and 16 visible cycles. Watch the A/B order, then reverse. Change decoding to compare the number of counts per revolution.','Which A/B state comes next, and will the decoded count change?','Clockwise-positive sequence: 00 → 10 → 11 → 01. ×4 counts every transition; ×2 counts A edges; ×1 counts A rising edges.'],
 ['A wrapped count can still track position','A 4-bit counter wraps after 16 counts. With 4 counts between samples, the software can reconstruct the movement. Increase the sampling window to 600 ms to exceed half the range.','Will a raw count smaller than the previous reading always mean reverse motion?','No. A forward rollover also reduces the raw reading. The shortest signed difference works only if movement is strictly less than half the counter range per sample.'],
 ['Find the sampling boundary','Use 2048 cycles/revolution, ×4 decoding, and 3000 RPM. At 80 ms the shaft moves exactly 32768 counts: half a 16-bit counter. Compare 79, 80, and 81 ms.','At exactly half the range, can two readings identify the direction?','No. +32768 and −32768 produce the same change modulo 65536. Use less than 80 ms and leave margin.'],
 ['Compare the two speed estimates','At low speed, counting windows contain only a few edges. Duration measurements resolve the interval well, but arrive less often. Change speed, stop, or open the calculator.','If the shaft stops, does the last measured pulse duration immediately become zero speed?','No new edge means no new duration measurement. Its last estimate becomes stale; a real system needs a timeout policy. Counting responds after its next window.'],
 ['Experiment with your own settings','Configure the measurement, apply, and compare actual motion with reconstructed position and measured speed.','What limits accuracy here: encoder counts, timer ticks, or sampling ambiguity?','Use the count/tick readouts and the half-range condition to identify which limit applies. The linked calculator isolates quantization uncertainty.']
];
function lesson(){const a=lessons[+$('demo').value];$('lesson-title').textContent=a[0];$('lesson-text').textContent=a[1];$('question').textContent=a[2];$('answer').textContent=a[3];$('answer').hidden=true;}
function pause(){clearInterval(playing);playing=null;$('play').textContent='▶ Play';}
function reset(){pause();sim=new C.Encoder(c);history=[];render();}
function snapshot(){history.push(JSON.stringify({sim,rpm}));if(history.length>100)history.shift();}
function speed(){const v=+$('rpm').value;if(!$('rpm').checkValidity()||!Number.isFinite(v)){pause();$('error').textContent='Use a shaft speed between −10,000 and 10,000 RPM.';return null;}rpm=v;return v;}
function step(kind){const r=speed();if(r===null)return;snapshot();let dt;if(kind==='sample'||r===0)dt=Math.max(1e-10,sim.nextSample-sim.t);else{const dir=Math.sign(r),boundary=dir>0?Math.floor(sim.x)+1:Math.ceil(sim.x)-1;dt=(Math.abs(boundary-sim.x)+1e-7)/(Math.abs(r)*c.slits*4/60);dt=Math.min(dt,sim.nextSample-sim.t);}
 sim.advance(Math.max(1e-10,dt),r);render();}
function render(){
 const m=C.metrics(c,rpm),factor=4/c.decode,raw=C.mod(sim.count,2**c.bits),st=C.mod(Math.floor(sim.x),4),states=[[0,0],[1,0],[1,1],[0,1]],ab=states[st],angle=sim.x/(4*c.slits)*360,home=C.homeAt(sim.x,c.slits);
 const visible=Math.min(c.slits,32);let disc='<circle cx="120" cy="120" r="99" fill="#eeeee6" stroke="#91a79a"/><g transform="rotate('+angle+' 120 120)">';
 for(let j=0;j<visible;j++){const a=j*2*Math.PI/visible;disc+=`<line x1="${120+74*Math.sin(a)}" y1="${120-74*Math.cos(a)}" x2="${120+95*Math.sin(a)}" y2="${120-95*Math.cos(a)}" stroke="#17332f" stroke-width="${visible<20?8:4}"/>`;}
 disc+='<line x1="120" y1="120" x2="120" y2="27" stroke="#a44c1b" stroke-width="4"/></g><circle cx="120" cy="120" r="44" fill="#fffdf7"/>'+text(120,117,fmt(C.mod(angle,360),1)+'°','middle')+text(120,137,rpm>0?'CW +':rpm<0?'CCW −':'Stopped','middle')+'<path d="M112 11 L128 11 L120 26 Z" fill="#086b54"/>'+text(141,20,'Home');
 $('disc').innerHTML=disc;$('disc-note').textContent=c.slits>32?`Schematic disc: ${c.slits} cycles/rev; only 32 marks drawn.`:`${c.slits} cycles/rev · ${fmt(360/m.p,5)}° per decoded count`;
 const edgePeriod=rpm?60/(Math.abs(rpm)*c.slits*4):c.ts/8,windowT=Math.min(c.ts*2,edgePeriod*12),start=Math.max(0,sim.t-windowT),span=Math.max(1e-9,sim.t-start);
 function at(t){for(let j=sim.segments.length-1;j>=0;j--){const s=sim.segments[j];if(t>=s.start-1e-12)return s.x0+(s.x1-s.x0)*Math.min(1,(t-s.start)/(s.end-s.start||1));}return .25;}
 let waves='';for(let channel=0;channel<3;channel++){const base=[48,103,158][channel],label=['A','B','Home'][channel];let pts=[];for(let j=0;j<=320;j++){const t=start+span*j/320,phase=at(t),bit=channel===2?C.homeAt(phase,c.slits):states[C.mod(Math.floor(phase),4)][channel];pts.push([50+j*1.75,base-bit*28]);}waves+=text(14,base-8,label)+line(50,base,610,base)+path(pts,[green,blue,'#a44c1b'][channel]);}
 waves+=line(610,15,610,175,'#a44c1b')+text(50,205,fmt(start*1000,4)+' ms')+text(610,205,fmt(sim.t*1000,4)+' ms','end');$('waves').innerHTML=waves;
 $('phase').textContent=`A = ${ab[0]} · B = ${ab[1]} · Home = ${home} (${home?'HIGH':'LOW'}, once/rev) · ${c.decode} decoded counts/cycle · cursor t = ${fmt(sim.t*1000,5)} ms`;
 $('stats').innerHTML=stat('Hardware U/D count',raw,`Modulo ${2**c.bits} · ${c.bits} bit`)+stat('Software position',fmt(sim.software,0)+' counts',`${fmt(sim.software*360/m.p)}° from start · sampled`)+stat('Actual position',fmt(sim.count,0)+' counts',`${fmt(sim.count*360/m.p)}° from start · continuous edges`);
 const safe=m.q<2**(c.bits-1);$('sampling').className='notice'+(!safe?' warn':'');$('sampling').textContent=`At this speed: ${fmt(m.q)} expected counts/sample ${safe?'<':'≥'} ${2**(c.bits-1)} (half range). ${rpm?`Require Ts < ${fmt(60*2**(c.bits-1)/(m.p*Math.abs(rpm))*1000)} ms.`:'No movement at zero speed.'} ${safe?'Within the signed tracking limit.':'Direction/displacement may be ambiguous.'}${sim.ambiguous?' Last sample reconstructed the wrong displacement.':''}`;
 const age=sim.lastEdge?sim.t-sim.lastEdge.time:0,stale=sim.lastEdge&&(rpm===0||age>2*m.period),over=sim.ticks>=2**c.timerBits;
 const countError=sim.countRPM===null?'Waiting for a sample':`Actual error ${fmt(Math.abs(sim.countRPM-rpm))} RPM`;
 $('speed-stats').innerHTML=stat('Pulse counting',sim.countRPM===null?'—':fmt(sim.countRPM)+' RPM',countError)+stat('Pulse duration',sim.periodRPM===null?'—':fmt(sim.periodRPM)+' RPM',sim.periodRPM===null?'Waiting for two decoded edges':`${stale?'Stale · ':''}${over?'Needs overflow handling · ':''}${fmt(sim.ticks,0)} timer ticks`)+stat('Actual shaft speed',fmt(rpm)+' RPM',`Counting update every ${fmt(c.ts*1000)} ms`);
 $('speed-note').textContent=`Expected: q = ${fmt(m.q)} counts/window; i = ${rpm?fmt(m.i):'no new'} timer ticks/edge. ${sim.lastEdge?`Last decoded edge was ${fmt(age*1000)} ms ago.`:''} ${sim.periodRPM!==null?`Duration estimate actual error: ${fmt(Math.abs(sim.periodRPM-rpm))} RPM.`:''} ${over?'The displayed estimate uses an ideal extended timer.':''} Duration estimates immediately after reversal can be misleading.`;
 $('calculator-link').href=link('speed-calculator.html',c,Math.abs(rpm)||1);
 const rows=sim.samples;let points='';if(rows.length){const all=rows.flatMap(s=>[s.trueCount,s.software]),mn=Math.min(0,...all),mx=Math.max(1,...all),x=j=>65+j*730/Math.max(1,rows.length-1),y=v=>140-(v-mn)/(mx-mn)*110;points=line(65,140,800,140)+text(55,35,fmt(mx,0),'end')+text(55,143,fmt(mn,0),'end')+path(rows.map((s,j)=>[x(j),y(s.trueCount)]),green)+path(rows.map((s,j)=>[x(j),y(s.software)]),blue,'6 4')+text(65,170,fmt(rows[0].t*1000)+' ms')+text(800,170,fmt(rows.at(-1).t*1000)+' ms','end');}else points=text(425,90,'Step to a sample to see position tracking.','middle');$('position').innerHTML=points;
 $('samples').innerHTML=rows.slice(-8).reverse().map(s=>`<tr class="${s.bad?'bad':''}"><td>${fmt(s.t*1000)}</td><td>${s.raw}</td><td>${s.actual}</td><td>${s.delta}${s.bad?' · ambiguous':''}</td><td>${s.software}</td></tr>`).join('');$('back').disabled=!history.length;
}
$('settings').onsubmit=e=>{e.preventDefault();if(!valid())return;c=config();$('dirty').hidden=true;$('demo').value='4';lesson();reset();};$('settings').oninput=()=>{$('dirty').hidden=false;};
$('demo').onchange=()=>{let k=+$('demo').value;const presets=[{slits:16,decode:4,ts:.1,bits:16,rpm:30},{slits:16,decode:4,ts:.25,bits:4,rpm:15},{slits:2048,decode:4,ts:.08,bits:16,rpm:3000},{slits:256,decode:4,ts:.01,bits:16,rpm:5}];if(k<4){fill(presets[k]);rpm=presets[k].rpm;$('rpm').value=rpm;c=config();}$('dirty').hidden=true;lesson();reset();};
$('edge').onclick=()=>{pause();step('edge');};$('sample').onclick=()=>{pause();step('sample');};$('reset').onclick=reset;$('back').onclick=()=>{pause();if(history.length){const old=JSON.parse(history.pop());sim=Object.assign(new C.Encoder(c),old.sim);rpm=old.rpm;$('rpm').value=rpm;render();}};
$('play').onclick=()=>{if(playing)pause();else{playing=setInterval(()=>step($('pace').value),450);$('play').textContent='Ⅱ Pause';}};
$('rpm').oninput=()=>{if(speed()!==null)render();};$('reverse').onclick=()=>{$('rpm').value=-(+$('rpm').value);speed();render();};$('stop').onclick=()=>{$('rpm').value=0;speed();render();};$('reveal').onclick=()=>{$('answer').hidden=!$('answer').hidden;};
let dragAngle=null;function pointerAngle(e){const r=$('disc').getBoundingClientRect();return Math.atan2(e.clientY-r.top-r.height/2,e.clientX-r.left-r.width/2);}
$('disc').onpointerdown=e=>{pause();if(speed()===null)return;snapshot();dragAngle=pointerAngle(e);$('disc').setPointerCapture(e.pointerId);};$('disc').onpointermove=e=>{if(dragAngle===null)return;const a=pointerAngle(e),d=Math.atan2(Math.sin(a-dragAngle),Math.cos(a-dragAngle));dragAngle=a;if(Math.abs(d)<.001)return;rpm=Math.sign(d)*(Math.abs(rpm)||30);$('rpm').value=rpm;sim.advance(Math.min(Math.abs(d)/(2*Math.PI)*60/Math.abs(rpm),c.ts*1000),rpm);render();};$('disc').onpointerup=$('disc').onpointercancel=()=>dragAngle=null;
window.addEventListener('pageshow',e=>requestAnimationFrame(()=>{if(!e.persisted){fill(c);$('rpm').value=rpm;}render();}));
if(incoming.size){$('demo').value='4';rpm=Math.min(10000,Math.max(-10000,Number(incoming.get('rpm'))||30));$('rpm').value=rpm;lesson();reset();}else $('demo').onchange();
})();
