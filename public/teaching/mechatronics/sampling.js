'use strict';
(()=>{
const $=id=>document.getElementById(id),M=SamplingCore;
const f=v=>Number.isFinite(v)?Number(v.toPrecision(7)).toLocaleString('en-US',{maximumFractionDigits:5}):'unlimited';
const tick=v=>Math.abs(v)>=100000||(v!==0&&Math.abs(v)<.01)?v.toExponential(1):f(v);
const green='#086b54',orange='#a44c1b',blue='#355c93';let c,n=1,selected=1,timer=null,revealed=false;
const presets={proper:{bits:4,cycles:16,decode:1,rpm:18.75,ts:1,initial:12},improper:{bits:4,cycles:16,decode:1,rpm:18.75,ts:2.2,initial:12},lecture:{bits:16,cycles:2048,decode:4,rpm:3000,ts:.079,initial:0}};
function read(){return {bits:+$('bits').value,cycles:+$('cycles').value,decode:+$('decode').value,rpm:+$('rpm').value,ts:+$('ts').value/1000,initial:+$('initial').value};}
function fill(v){for(const k of Object.keys(v))$(k).value=k==='ts'?v[k]*1000:v[k];$('initial').max=2**v.bits-1;}
function valid(){ $('initial').max=2**(+$('bits').value)-1;const ok=$('settings').checkValidity();$('error').textContent=ok?'':'Enter values within the input limits. The initial reading must fit the selected counter.';return ok;}
function pause(){clearInterval(timer);timer=null;$('play').textContent='▶ Play';}
function reset(){pause();n=0;selected=0;revealed=false;render();}
function apply(){if(!valid())return false;c=read();$('dirty').hidden=true;reset();return true;}
function next(){if(n>=24){pause();return;}n++;selected=n;revealed=false;render();if(n===24)pause();}
const txt=(x,y,s,extra='')=>`<text x="${x}" y="${y}" ${extra}>${s}</text>`;
const line=(x1,y1,x2,y2,color='#cbd5cd',dash='')=>`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" ${dash?`stroke-dasharray="${dash}"`:''}/>`;
const path=(pts,color,dash='')=>pts.length?`<path d="${pts.map((p,i)=>(i?'L':'M')+p.map(v=>v.toFixed(3)).join(' ')).join(' ')}" fill="none" stroke="${color}" stroke-width="2.5" ${dash?`stroke-dasharray="${dash}"`:''}/>`:'';
const stat=(a,b,d)=>`<div class="stat"><span>${a}</span><strong>${b}</strong><small>${d}</small></div>`;
function render(){
 const d=M.design(c),s=M.sample(c,selected),half=d.half;const boundary=Math.abs(Math.abs(d.q)-half)<1e-7,safe=Math.ceil(Math.abs(d.q)-1e-9)<half;
 $('stats').innerHTML=stat('Counts per sampling interval',f(d.q),`${f(d.rate)} counts/s × ${f(c.ts)} s`)+stat('Counter capacity',f(d.capacity),`Half range = ${f(half)} counts`)+stat('Selected position error',f(s.software-s.actual)+' counts',`Software ${f(s.software)} · actual count ${f(s.actual)}`);
 $('rule').className='notice'+(!safe?' warn':'');$('rule').innerHTML=`<strong>${boundary?'Exact boundary: direction is ambiguous.':safe?'Proper sampling: each increment stays below half the range.':'Sampling does not guarantee an unambiguous displacement.'}</strong><br>|n| p Ts / 60 = ${f(Math.abs(c.rpm))} × ${f(d.p)} × ${f(c.ts)} / 60 = ${f(Math.abs(d.q))} counts. Required: &lt; ${f(half)}.<br>${d.rate?`Ts must be less than ${f(d.limit*1000)} ms. Leave margin for fractional counts and speed changes.`:'The shaft is stopped; no counts arrive.'}`;
 $('progress').textContent=`${n} / 24 samples revealed · inspecting sample ${selected}`;$('back').disabled=n===0;$('step').disabled=n===24;$('play').disabled=n===24;
 const mode=$('preset').value, titles={proper:'Wraparound is not a loss of position.',improper:'The same forward motion can look backward.',lecture:'Explore a 16-bit counter at high speed.',experiment:'Find a sampling interval that preserves motion.'};
 $('lesson-title').textContent=titles[mode];$('lesson').textContent=mode==='proper'?'The shaft advances 5 counts between readings. A 4-bit counter wraps at 16, but each +5 displacement is recoverable.':mode==='improper'?'The shaft and encoder are unchanged. Sampling every 2.2 seconds allows +11 counts between readings, which the software interprets as −5.':mode==='lecture'?'At 8192 counts/revolution and 3000 RPM, a 16-bit counter reaches its half-range boundary in 80 ms. Start at 79 ms, then try the exact boundary.':'Change the parameters and apply them. Compare the actual displacement with the shortest signed difference the software can infer.';
 const start=Math.max(0,n-8),end=Math.max(8,n),X=k=>80+(k-start)*770/(end-start),position=k=>c.initial+d.q*k;
 const rows=Array.from({length:n+1},(_,k)=>M.sample(c,k));const visible=rows.filter(r=>r.k>=start);
 const all=[position(start),position(n),...visible.map(r=>r.software)];let low=Math.min(...all),high=Math.max(...all);if(high-low<1){low-=1;high+=1;}const pad=(high-low)*.12;low-=pad;high+=pad;
 const Y=(v,top)=>top+115-(v-low)/(high-low)*115,rawY=v=>355-v/(d.capacity-1)*115;
 let svg='<title id="chart-title">Actual, hardware, and reconstructed position</title><desc id="chart-desc">Select a sample marker to inspect its reading and inferred displacement. All plots share the time axis.</desc>';
 for(const [top,label]of [[40,'1 · Actual position · equivalent counts'],[240,'2 · Hardware counter · wraps modulo '+f(d.capacity)],[440,'3 · Reconstructed position · updates only at samples']]){
  svg+=txt(80,top-15,label,'class="chart-label"');svg+=line(80,top+115,850,top+115)+line(80,top,80,top+115);
  const isRaw=top===240;for(let j=0;j<3;j++){const v=isRaw?(d.capacity-1)*j/2:low+(high-low)*j/2;const y=isRaw?rawY(v):Y(v,top);svg+=line(80,y,850,y)+txt(70,y+4,tick(v),'text-anchor="end"');}
 }
 for(let k=start;k<=end;k++){const color=k===selected?'#17332f':'#cbd5cd';svg+=line(X(k),35,X(k),560,color,k===selected?'':'3 5')+txt(X(k),589,tick(k*c.ts*1000),'text-anchor="middle"');}
 svg+=txt(465,614,'Time (ms) · all three plots use the same sampling instants','text-anchor="middle"');
 if(n>0){svg+=path([[X(start),Y(position(start),40)],[X(n),Y(position(n),40)]],green);svg+=path([[X(start),Y(position(start),440)],[X(n),Y(position(n),440)]],green,'5 5');}
 // Draw exact count steps when resolvable; for dense edges, draw wrap ramps.
 const a=position(start)+.25,b=position(n)+.25,edges=Math.abs(Math.floor(b)-Math.floor(a));let dense=false;
 if(n>start&&d.q!==0){
  const pts=[],events=[];if(edges<=1200){
   if(d.q>0){for(let v=Math.floor(a)+1;v<=Math.floor(b);v++)events.push((v-c.initial-.25)/d.q);}else{for(let v=Math.floor(a);v>Math.floor(b);v--)events.push((v-c.initial-.25)/d.q);}
   let previous=M.mod(Math.floor(a),d.capacity);pts.push([X(start),rawY(previous)]);
   for(const k of events){pts.push([X(k),rawY(previous)]);previous=M.mod(previous+Math.sign(d.q),d.capacity);pts.push([X(k),rawY(previous)]);}pts.push([X(n),rawY(M.mod(Math.floor(b),d.capacity))]);svg+=path(pts,orange);
  }else{
   const wraps=Math.abs(Math.floor(b/d.capacity)-Math.floor(a/d.capacity));
   if(wraps<=80){const div=d.capacity;let prev=M.mod(a,div)/(div)*(div-1);pts.push([X(start),rawY(prev)]);const bounds=[];if(d.q>0){for(let v=(Math.floor(a/div)+1)*div;v<=b;v+=div)bounds.push(v);}else{for(let v=Math.floor(a/div)*div;v>b;v-=div)bounds.push(v);}for(const v of bounds){const k=(v-c.initial-.25)/d.q;pts.push([X(k),rawY(d.q>0?div-1:0)],[X(k),rawY(d.q>0?0:div-1)]);}pts.push([X(n),rawY(M.mod(b,div)/div*(div-1))]);svg+=path(pts,orange);dense=true;
   }else{svg+=`<rect x="${X(start)}" y="240" width="${X(n)-X(start)}" height="115" fill="#f6eadb"/>`+txt(465,285,`${f(wraps)} wraps in view — too dense to resolve`,'text-anchor="middle"')+txt(465,310,'Sample markers and readings remain exact.','text-anchor="middle"');dense=true;}
  }
 }else if(n>start)svg+=line(X(start),rawY(c.initial),X(n),rawY(c.initial),orange);
 const reconstructed=[];for(let k=start;k<=n;k++){const r=rows[k];if(k>start)reconstructed.push([X(k),Y(rows[k-1].software,440)]);reconstructed.push([X(k),Y(r.software,440)]);}svg+=path(reconstructed,blue);
 for(const r of visible){const picked=r.k===selected;svg+=`<g data-sample="${r.k}" role="button" tabindex="0" aria-label="Inspect sample ${r.k}, counter ${r.raw}"><title>Sample ${r.k}: counter ${r.raw}, inferred change ${r.delta}</title><rect x="${X(r.k)-14}" y="35" width="28" height="530" fill="transparent"/>`;for(const [v,y,color]of [[r.actual,Y(position(r.k),40),green],[r.raw,rawY(r.raw),orange],[r.software,Y(r.software,440),blue]])svg+=`<circle cx="${X(r.k)}" cy="${y}" r="${picked?6:4}" fill="${color}" stroke="${picked?'#17332f':'#fffdf7'}" stroke-width="2"/>`;svg+='</g>';}
 $('plots').innerHTML=svg;$('plot-note').textContent=`Showing sample intervals ${start}–${end}; only completed samples are drawn. ${dense?'Dense hardware counts are shown as wrap ramps or a labeled band; sample readings are exact.':'The hardware trace shows individual integer count transitions.'} The top and bottom plots share a position scale.`;
 $('sample-title').textContent=`Sample ${selected} · ${f(s.t*1000)} ms`;
 $('calculation').innerHTML=selected?`Previous reading ${f(s.previous)} → current reading ${f(s.raw)}<br>Raw difference = ${f(s.raw)} − ${f(s.previous)} = ${f(s.difference)}<br>Signed Δ = ((raw difference + ${half}) mod ${d.capacity}) − ${half} = <strong>${f(s.delta)}</strong><br>Software position = ${f(M.sample(c,selected-1).software)} + (${f(s.delta)}) = ${f(s.software)} counts<br>Actual movement = ${f(s.movement)} counts · ${s.tie?'half-range ambiguity':s.stepCorrect?'this increment is correct':'incorrect displacement'}<br>Accumulated position error = ${f(s.software-s.actual)} counts`:`Initial hardware reading = ${c.initial}. Software position is initialized to the same known value. Advance to the next sample to calculate a displacement.`;
 $('explain').disabled=selected===0;$('explanation').hidden=!revealed||selected===0;$('explain').textContent=revealed?'Hide explanation':'Explain this sample';
 const alternatives=[s.delta-d.capacity,s.delta,s.delta+d.capacity,s.delta+2*d.capacity];$('explanation').className='notice'+(!s.stepCorrect||s.tie?' warn':'');$('explanation').textContent=`These readings permit displacements … ${alternatives.map(f).join(', ')} … counts, because adding ${d.capacity} leaves the same counter reading. Software chooses ${f(s.delta)}, the shortest signed difference. ${s.tie?`At half range, +${half} and −${half} are equally possible. The implementation chooses −${half}; the readings do not establish direction.`:s.stepCorrect?'The actual movement matches that choice. A known bound below half range makes this inference unambiguous.':`The shaft actually moved ${f(s.movement)} counts. Sampling discarded the information needed to distinguish that movement from ${f(s.delta)}.`}`;
 $('history').innerHTML=rows.slice().reverse().map(r=>`<tr class="${r.k===selected?'selected':''}"><td><button data-sample="${r.k}" aria-label="Inspect sample ${r.k}">${r.k}</button></td><td>${f(r.t*1000)}</td><td>${f(r.raw)}</td><td>${f(r.movement)}</td><td>${f(r.delta)}${r.tie?' · tie':!r.stepCorrect?' · wrong':''}</td><td>${f(r.software-r.actual)}</td></tr>`).join('');
}
$('settings').onsubmit=e=>{e.preventDefault();if(apply()){$('preset').value='experiment';render();}};
$('settings').oninput=()=>{$('dirty').hidden=false;};$('bits').onchange=()=>{$('initial').max=2**(+$('bits').value)-1;$('dirty').hidden=false;};
$('preset').onchange=()=>{pause();const p=presets[$('preset').value];if(p){c={...p};fill(c);n=1;selected=1;revealed=false;$('dirty').hidden=true;$('error').textContent='';}render();};
$('step').onclick=()=>{pause();next();};$('back').onclick=()=>{pause();n=Math.max(0,n-1);selected=n;revealed=false;render();};$('reset').onclick=reset;
$('play').onclick=()=>{if(timer)pause();else{timer=setInterval(next,850);$('play').textContent='Ⅱ Pause';}};
$('boundary').onclick=()=>{if(!valid())return;const v=read(),d=M.design(v);if(!d.rate){$('error').textContent='Choose a nonzero shaft speed to calculate the half-range boundary.';return;}if(d.limit*1000<.001||d.limit*1000>1e6){$('error').textContent='The exact boundary is outside the supported sampling interval. Adjust speed or resolution.';return;}$('ts').value=d.limit*1000;if(apply()){$('preset').value='experiment';next();}};
$('reverse').onclick=()=>{if(!valid())return;$('rpm').value=-(+$('rpm').value);if(apply()){$('preset').value='experiment';next();}};
$('explain').onclick=()=>{revealed=!revealed;render();};
function choose(e){const el=e.target.closest('[data-sample]');if(!el)return;pause();selected=+el.dataset.sample;revealed=false;render();}
$('plots').onclick=choose;$('history').onclick=choose;$('plots').onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose(e);}};
c={...presets.proper};fill(c);render();window.addEventListener('pageshow',()=>requestAnimationFrame(()=>{fill(c);$('dirty').hidden=true;render();}));
})();
