'use strict';
const F=Frequency,$=id=>document.getElementById(id),colors=['#69756c','#a44c1b','#355c93','#8060a0','#086b54','#b22b55'];
let p={...F.defaults},id='mechanism';
const fmt=(v,n=3)=>!Number.isFinite(v)?'undefined':Number(v).toLocaleString('en-US',{maximumSignificantDigits:n});
$('system').innerHTML=F.cases.map(c=>`<option value="${c.id}">${c.name}</option>`).join('');$('system').value=id;
function resonanceDemo(){
 p={...F.defaults,f:Math.sqrt(F.defaults.k/F.defaults.m)/(2*Math.PI)};id='mechanism';
 for(const key of Object.keys(p))$(key).value=p[key];
 $('system').value=id;$('frequency-slider').value=Math.log10(p.f);
 $('mode').value='periodic';$('cycles').value='3';$('motion-scale').value='fit';$('motion-speed').value='1';$('dirty').textContent='';
}
if(new URLSearchParams(location.search).get('demo')==='resonance')resonanceDemo();
$('resonance-demo').addEventListener('click',()=>{resonanceDemo();render();$('motion-play').focus();});

const ns='http://www.w3.org/2000/svg';
function el(tag,attrs={},text){const e=document.createElementNS(ns,tag);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,v);if(text!==undefined)e.textContent=text;return e;}
function plot(name,series,xlo,xhi,xLabel,yLabel,{log=false,reference=null,marker=null}={}){
 const svg=$(name),W=svg.clientWidth,H=svg.clientHeight,L=65,R=18,T=16,B=44,iw=W-L-R,ih=H-T-B;
 svg.replaceChildren();svg.setAttribute('viewBox',`0 0 ${W} ${H}`);
 let vals=series.flatMap(s=>s.data.map(d=>d[1]).filter(Number.isFinite));if(reference!==null)vals.push(reference);
 let lo=Math.min(...vals),hi=Math.max(...vals),pad=(hi-lo)*.12||Math.max(1,Math.abs(hi)*.1);lo-=pad;hi+=pad;
 const x=v=>L+iw*(log?(Math.log10(v)-Math.log10(xlo))/(Math.log10(xhi)-Math.log10(xlo)):(v-xlo)/(xhi-xlo));
 const y=v=>T+ih*(hi-v)/(hi-lo);
 svg.append(el('rect',{x:L,y:T,width:iw,height:ih,fill:'none',stroke:'var(--line)'}));
 for(let i=0;i<=4;i++){const v=lo+(hi-lo)*i/4,yy=y(v);svg.append(el('line',{x1:L,x2:W-R,y1:yy,y2:yy,stroke:'var(--line)','stroke-width':.6}),el('text',{x:L-8,y:yy+4,'text-anchor':'end'},fmt(v)));}
 const ticks=W<420?3:5;
 for(let i=0;i<ticks;i++){const v=log?10**(Math.log10(xlo)+(Math.log10(xhi)-Math.log10(xlo))*i/(ticks-1)):xlo+(xhi-xlo)*i/(ticks-1);svg.append(el('text',{x:x(v),y:H-B+19,'text-anchor':i===0?'start':i===ticks-1?'end':'middle'},fmt(v)));}
 svg.append(el('text',{x:L+iw/2,y:H-5,'text-anchor':'middle'},xLabel),el('text',{transform:`translate(15 ${T+ih/2}) rotate(-90)`,'text-anchor':'middle'},yLabel));
 if(reference!==null)svg.append(el('line',{x1:L,x2:W-R,y1:y(reference),y2:y(reference),stroke:'var(--muted)','stroke-dasharray':'4 5'}));
 for(const s of series){let pen=false;svg.append(el('path',{d:s.data.map(d=>{if(!Number.isFinite(d[1])){pen=false;return '';}const command=pen?'L':'M';pen=true;return `${command}${x(d[0]).toFixed(2)},${y(d[1]).toFixed(2)}`;}).join(' '),fill:'none',stroke:s.color,'stroke-width':s.width||2,'stroke-dasharray':s.dash||''}));}
 if(marker&&Number.isFinite(marker.v)){const xx=x(marker.f);svg.append(el('line',{x1:xx,x2:xx,y1:T,y2:H-B,stroke:'var(--ink)','stroke-dasharray':'3 4'}),el('circle',{cx:xx,cy:y(marker.v),r:4,fill:marker.color,stroke:'var(--cream)','stroke-width':1.5}));}
 if(name==='wave')Motion.setPlot({svg,x,y,top:T,bottom:H-B});
 if(log){const hit=el('rect',{x:L,y:T,width:iw,height:ih,fill:'transparent',style:'cursor:crosshair'});hit.addEventListener('click',e=>{const rect=svg.getBoundingClientRect();p.f=10**(Math.log10(xlo)+Math.max(0,Math.min(1,(e.clientX-rect.left-L)/iw))*(Math.log10(xhi)-Math.log10(xlo)));p.f=Math.max(.001,Math.min(10000,p.f));$('f').value=Number(p.f.toPrecision(5));$('frequency-slider').value=Math.log10(p.f);render();});svg.append(hit);}
}
function render(){
 Motion.pause();
 const state=F.stability(p),nonstable=id==='feedback'&&state!=='stable';
 $('mode').options[0].disabled=nonstable;if(nonstable)$('mode').value='startup';
 $('feedback-info').hidden=id!=='feedback';
 $('stability').textContent=`${state.toUpperCase()}: K = ${fmt(p.K)} s⁻¹; stability requires K < c/m = ${fmt(p.c/p.m)} s⁻¹. Feedback measures the final mass position.`+(state!=='stable'?' The Bode curve is a formal evaluation of H(jω), not a steady-state response. Startup is shown; at the boundary the resonant FRF is undefined.':'');
 const c=F.cases.find(c=>c.id===id),h=F.response(id,p),wn=Math.sqrt(p.k/p.m),fn=wn/(2*Math.PI),zeta=p.c/(2*Math.sqrt(p.m*p.k));
 $('case-title').textContent=c.name;$('flow').textContent=c.flow;$('formula').textContent=c.formula;
 $('case-note').textContent=({ideal:'The ideal benchmark has gain 1 and zero phase at every frequency.',open:'Position integrates the velocity command; gain falls at 20 dB/decade with −90° phase.',closed:'Feedback produces a first-order low-pass response. Its −3.01 dB corner is K/(2π).',mechanism:'Low damping produces a resonance peak; phase passes −90° at the natural frequency.',feedback:'Extension: final-position feedback improves tracking, but excessive gain destabilizes the flexible mechanism.',combined:'The integrator and mechanism multiply their gains and add their phases. High-frequency slope approaches −60 dB/decade.'}[id]);
 $('mechanical-info').textContent=`Natural frequency: ${fmt(fn)} Hz • Damping ratio ζ: ${fmt(zeta)} • Ideal-motion feedback corner: ${fmt(p.K/(2*Math.PI))} Hz.`+(zeta<Math.SQRT1_2?` Mechanical resonance: ${fmt(fn*Math.sqrt(1-2*zeta*zeta))} Hz.`:' No mechanical resonance peak.');
 const selected=$('compare').checked?F.cases:[c],xmin=Math.min(p.f,fn,p.K/(2*Math.PI)) / 30,xmax=Math.max(p.f,fn,p.K/(2*Math.PI))*30;
 let freqs=Array.from({length:801},(_,i)=>10**(Math.log10(xmin)+(Math.log10(xmax/xmin))*i/800));
 // Include narrow mechanical resonances explicitly, even for very small damping.
 for(let i=-100;i<=100;i++){const f=fn*(1+i*Math.min(zeta,.2)/20);if(f>xmin&&f<xmax)freqs.push(f);}if(selected.some(c=>c.id==='feedback')){const width=Math.max(1e-9,Math.min(.2,zeta*Math.abs(1-p.K*p.m/p.c)));for(let i=-100;i<=100;i++){const f=fn*(1+i*width/20);if(f>xmin&&f<xmax)freqs.push(f);}}freqs.push(p.f,fn);freqs.sort((a,b)=>a-b);
 const series=field=>selected.map(c=>({color:colors[F.cases.indexOf(c)],width:c.id===id?2.8:1.5,data:freqs.map(f=>[f,F.response(c.id,p,f)[field]])}));
 $('legend').innerHTML=selected.map(c=>`<span><i class="swatch" style="border-color:${colors[F.cases.indexOf(c)]}"></i>${c.name}${c.id==='feedback'&&state!=='stable'?' (formal FRF, '+state+')':''}</span>`).join('');
 plot('magnitude',series('db'),xmin,xmax,'Frequency f (Hz)','Magnitude (dB)',{log:true,reference:0,marker:{f:p.f,v:h.db,color:colors[F.cases.indexOf(c)]}});
 plot('phase',series('degrees'),xmin,xmax,'Frequency f (Hz)','Phase (°)',{log:true,reference:0,marker:{f:p.f,v:h.degrees,color:colors[F.cases.indexOf(c)]}});
 $('readout').textContent=`f = ${fmt(p.f)} Hz · ω = ${fmt(2*Math.PI*p.f)} rad/s · Gain = ${fmt(h.gain)} (${fmt(h.db)} dB) · Phase = ${fmt(h.degrees)}° · Output amplitude = ${fmt(p.A*h.gain)} mm · Phase-equivalent lag = ${fmt(-h.phase/(2*Math.PI*p.f))} s. FRF = ${fmt(h.re)} ${h.im<0?'−':'+'} j${fmt(Math.abs(h.im))}.`;
 if(nonstable)$('readout').textContent=`${state.toUpperCase()} system. f = ${fmt(p.f)} Hz. Formal |H(jω)| = ${fmt(h.gain)}, phase = ${fmt(h.degrees)}°. No attracting sinusoidal steady state; inspect startup below.`;
 const startup=$('mode').value==='startup';let duration=Number($('cycles').value)/p.f;
 let times=Array.from({length:1601},(_,i)=>duration*i/1600),dense=false;
 if(startup&&(id==='mechanism'||id==='combined')){const end=Math.min(duration,16*p.m/p.c),count=Math.ceil(end*wn*20);dense=count>6000;for(let i=0;i<=Math.min(count,6000);i++)times.push(end*i/Math.min(count,6000));times.sort((a,b)=>a-b);}
 let trajectory=null,shortened=false;
 if(id==='feedback'&&startup){const maxDuration=6000/(40*Math.max(fn,p.f));shortened=duration>maxDuration;duration=Math.min(duration,maxDuration);trajectory=F.feedbackTrajectory(p,duration,Math.max(1600,Math.ceil(duration*40*Math.max(fn,p.f))));duration=trajectory.points.at(-1)[0]||duration;times=trajectory.points.map(d=>d[0]);}
 const outputPoints=trajectory?trajectory.points:times.map(t=>[t,F.output(id,p,t,startup),F.springEnd(id,p,t,startup)]);
 plot('wave',[{color:'var(--signal-blue)',dash:'6 4',data:times.map(t=>[t,p.A*Math.sin(2*Math.PI*p.f*t)])},{color:'var(--signal-green)',data:outputPoints}],0,duration,'Time (s)','Displacement (mm)',{reference:0});
 $('wave-note').textContent=(startup?(id==='open'||id==='combined'?`Starts at rest. The integrator retains a ${fmt(p.K*p.A/(2*Math.PI*p.f))} mm offset. The Bode amplitude above describes only the oscillating component.`:'Starts at zero position and velocity (where applicable). The transient is included; its decay may require more than the displayed cycles.'):'Periodic sinusoidal component from the FRF. Transients and any constant integration offset are excluded.')+(dense?' Very rapid transient oscillations exceed the plot resolution at these parameters; zoom by increasing input frequency or use more damping.':'');
 if(id==='feedback'&&startup)$('wave-note').textContent=`Starts from rest with feedback from final mass position. ${state==='stable'?'Transient oscillations decay; near the stability limit they may persist beyond this view.':state==='marginal'?'Undamped natural oscillations persist. Excitation at the natural frequency causes growing resonance.':'An unstable mode grows with time, even for a bounded input.'}`+(shortened?' View shortened to resolve mechanical oscillations.':'')+(trajectory.limited?' Display stopped before amplitude exceeded 1,000,000 times the input; no physical saturation is modeled.':'');
 Motion.setRun({id,p:{...p},startup,duration,points:outputPoints});
 $('comparison').innerHTML=F.cases.map(c=>{const r=F.response(c.id,p);return `<tr><td>${c.name}${c.id==='feedback'&&state!=='stable'?' (formal FRF)':''}</td><td>${fmt(r.gain)}</td><td>${fmt(r.db)}</td><td>${fmt(r.degrees)}</td><td>${c.id==='feedback'&&state!=='stable'?'No steady state':fmt(p.A*r.gain)}</td></tr>`;}).join('');
}
$('settings').addEventListener('submit',e=>{e.preventDefault();for(const key of Object.keys(p))p[key]=Number($(key).value);$('frequency-slider').value=Math.log10(p.f);$('dirty').textContent='';render();});
for(const key of Object.keys(p))$(key).addEventListener('input',()=>{$('dirty').textContent='Parameters edited. Apply to update the plots.';});
$('system').addEventListener('change',()=>{id=$('system').value;render();});
$('frequency-slider').addEventListener('input',()=>{p.f=10**Number($('frequency-slider').value);$('f').value=Number(p.f.toPrecision(5));render();});
$('reset').addEventListener('click',()=>{p={...F.defaults};for(const key of Object.keys(p))$(key).value=p[key];$('frequency-slider').value=0;$('dirty').textContent='';render();});
for(const key of ['compare','mode','cycles'])$(key).addEventListener('change',render);
for(const button of $('feedback-presets').querySelectorAll('button'))button.addEventListener('click',()=>{p.K=Number(button.dataset.ratio)*p.c/p.m;$('K').value=p.K;$('mode').value='startup';render();});
let plotWidth=0;new ResizeObserver(entries=>{const w=entries[0].contentRect.width;if(Math.abs(w-plotWidth)>1){plotWidth=w;render();}}).observe($('magnitude').parentElement);render();
