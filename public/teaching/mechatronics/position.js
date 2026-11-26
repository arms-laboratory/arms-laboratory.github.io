'use strict';
const $=id=>document.getElementById(id), colors=['#355c93','#086b54','#a44c1b','#8057a3'];
let page=0,c={...Servo.defaults},runs=[],index=0,phase=0,playing=false,last=0,clock=0,playbackTimer=null;
const titles=['P control: a predictable following error','Build and compare P, PI and PID','The reference ends before the axis finishes','Inside the timer interrupt'];
const descriptions=['Run a constant-speed move. The position gap approaches speed/Kp; after the command stops, the gap closes. Try doubling speed or Kp, then add velocity feedforward.','All three controllers see the same reference and drive. Inspect their trajectories, then select a controller to inspect its P, I and D contributions. Gains are shared for a controlled comparison, not individually optimized.','Compare the selected controller with switching enabled and disabled. Zoom into the endpoint to see when the axis enters the tolerance band and what happens afterward.','Connect each sampled position to the arithmetic that produces the next held velocity command. The incremental and direct error calculations describe the same sample.'];
const numeric=['distance','speed','kp','ki','kd','dt','tau','limit','tolerance'];
function form(){for(const k of numeric)$ (k).value=c[k];for(const k of ['mode','policy'])$(k).value=c[k];for(const k of ['switching','feedforward'])$(k).checked=c[k];}
function pause(){playing=false;if(playbackTimer!==null){clearInterval(playbackTimer);playbackTimer=null;}$('play').textContent='Play';}
function build(){pause();index=0;phase=0;clock=0;
 if(page===1)runs=['P','PI','PID'].map(mode=>({name:mode,...Servo.run({...c,mode})}));
 else if(page===2)runs=[{name:c.mode+' · switching on',...Servo.run({...c,switching:true})},{name:c.mode+' · switching off',...Servo.run({...c,switching:false})}];
 else runs=[{name:c.mode,...Servo.run(c)}];
 $('cursor').max=runs[0].rows.length-1;$('heading').textContent=titles[page];$('description').textContent=descriptions[page];
 $('terms').hidden=page!==1;$('endpoint').hidden=page!==2;$('isr').hidden=page!==3;$('phase').hidden=page!==3;
 $('plot-title').textContent=page===2?'Endpoint detail':'Position versus time';$('second-title').textContent=page===1?'Selected controller contributions':'Following error';
 $('legend').innerHTML='<span><i style="border-color:'+colors[0]+';border-top-style:dashed"></i>Reference</span>'+runs.map((r,j)=>'<span><i style="border-color:'+colors[(j+1)%4]+'"></i>'+r.name+'</span>').join('');
 document.querySelectorAll('[data-page]').forEach(b=>b.setAttribute('aria-pressed',Number(b.dataset.page)===page));draw();
}
function selected(){return page===1?runs.find(r=>r.c.mode===c.mode):runs[0];}
function f(x){return Number(x).toFixed(3);}
function plot(id,series,ylabel,zoom=false,band=false){
 const svg=$(id),w=Math.max(260,svg.clientWidth),h=235,L=62,R=14,T=18,B=40;
 const end=runs[0].end,start=zoom?Math.max(0,c.distance/c.speed-.1):0;
 let vals=series.flatMap(s=>s.rows.filter(a=>a.t>=start).map(a=>a[s.key]));if(band)vals.push(c.distance-c.tolerance,c.distance+c.tolerance);
 let lo=vals.reduce((a,b)=>Math.min(a,b),zoom?Infinity:0),hi=vals.reduce((a,b)=>Math.max(a,b),zoom?-Infinity:0);const pad=Math.max(.05,(hi-lo)*.1);lo-=pad;hi+=pad;
 const X=t=>L+(t-start)/(end-start)*(w-L-R),Y=y=>h-B-(y-lo)/(hi-lo)*(h-T-B);
 let out='<title>'+ylabel+' versus time</title>';
 if(band)out+='<rect x="'+L+'" y="'+Y(c.distance+c.tolerance)+'" width="'+(w-L-R)+'" height="'+(Y(c.distance-c.tolerance)-Y(c.distance+c.tolerance))+'" fill="#e0f0e7"/>';
 for(let j=0;j<=4;j++){let y=lo+(hi-lo)*j/4,yy=Y(y);out+='<line x1="'+L+'" x2="'+(w-R)+'" y1="'+yy+'" y2="'+yy+'" stroke="#cbd5cd"/><text x="'+(L-7)+'" y="'+(yy+4)+'" text-anchor="end">'+y.toFixed(1)+'</text>';}
 for(let j=0;j<=3;j++){let t=start+(end-start)*j/3;out+='<text x="'+X(t)+'" y="'+(h-22)+'" text-anchor="'+(j===3?'end':'middle')+'">'+t.toFixed(1)+'</text>';}
 series.forEach(s=>{let rows=s.rows.filter(a=>a.t>=start);const stride=Math.max(1,Math.floor(rows.length/1600));rows=rows.filter((a,j)=>j%stride===0||j===rows.length-1);out+='<path d="'+rows.map((a,j)=>(j?'L':'M')+X(a.t).toFixed(2)+','+Y(a[s.key]).toFixed(2)).join(' ')+'" fill="none" stroke="'+s.color+'" stroke-width="2" '+(s.dash?'stroke-dasharray="6 4"':'')+'/>';});
 const switched=zoom?runs[0].rows.find(r=>r.latched):null;if(switched){const xx=X(switched.t);out+='<line x1="'+xx+'" x2="'+xx+'" y1="'+T+'" y2="'+(h-B)+'" stroke="#a44c1b" stroke-dasharray="4 4"/><text x="'+Math.min(xx+5,w-75)+'" y="'+(T+13)+'">Switch</text>';}const t=runs[0].rows[index].t;if(t>=start)out+='<line x1="'+X(t)+'" x2="'+X(t)+'" y1="'+T+'" y2="'+(h-B)+'" stroke="#52665f" stroke-dasharray="3 3"/>';
 out+='<text x="'+L+'" y="12">'+ylabel+'</text><text x="'+(w-R)+'" y="'+(h-3)+'" text-anchor="end">Time (s)</text>';
 svg.setAttribute('viewBox','0 0 '+w+' '+h);svg.innerHTML=out;
}
function draw(){
 const run=selected(),a=run.rows[index],t=a.t;$('cursor').value=index;$('time').textContent=f(t)+' s';
 $('readout').textContent=run.name+' · '+a.state+' · Xr '+f(a.r)+' mm · Xc '+f(a.x)+' mm · error '+f(a.e)+' mm · velocity command '+f(a.u)+' mm/s';
 $('prediction').textContent=c.mode==='P'&&!c.feedforward?'Ideal unsaturated moving-state prediction: e ≈ v/Kp = '+(c.kp?f(c.speed/c.kp)+' mm.':'undefined when Kp = 0.'):(c.feedforward?'Feedforward adds the reference velocity. ':'')+'Integral and derivative terms can change transient tracking and stopping behavior.';
 let mw=Math.max(260,$('motion').clientWidth),left=65,right=mw-65;const actualX=left+Math.max(-.1,Math.min(1.1,a.x/c.distance))*(right-left),refX=left+a.r/c.distance*(right-left);
 $('motion').setAttribute('viewBox','0 0 '+mw+' 150');$('motion').innerHTML='<title>Reference '+f(a.r)+' mm, actual '+f(a.x)+' mm</title><line x1="'+left+'" x2="'+right+'" y1="85" y2="85" stroke="#cbd5cd" stroke-width="6"/><line x1="'+refX+'" x2="'+refX+'" y1="35" y2="105" stroke="'+colors[0]+'" stroke-dasharray="5 3" stroke-width="2"/><rect x="'+(actualX-17)+'" y="68" width="34" height="34" rx="4" fill="'+colors[1]+'"/><text x="'+left+'" y="25">Dashed: reference · block: actual</text><text x="'+left+'" y="128">0 mm</text><text x="'+right+'" y="128" text-anchor="end">'+c.distance+' mm</text>'+(a.x<-.1*c.distance||a.x>1.1*c.distance?'<text x="'+left+'" y="145">Axis outside display range; read exact position above.</text>':'');
 plot('position',[{rows:run.rows,key:'r',color:colors[0],dash:true},...runs.map((r,j)=>({rows:r.rows,key:'x',color:colors[(j+1)%4]}))],'Position (mm)',page===2,page===2);
 if(page===1){plot('secondary',[{rows:run.rows,key:'p',color:colors[1]},{rows:run.rows,key:'it',color:colors[2]},{rows:run.rows,key:'d',color:colors[3]},{rows:run.rows,key:'u',color:colors[0],dash:true}],'Velocity (mm/s)');}
 else plot('secondary',runs.map((r,j)=>({rows:r.rows,key:'e',color:colors[(j+1)%4]})),'Error (mm)',page===2);
 $('equation').innerHTML='<span style="color:'+colors[1]+'">P '+f(a.p)+'</span> + <span style="color:'+colors[2]+'">I '+f(a.it)+'</span> + <span style="color:'+colors[3]+'">D '+f(a.d)+'</span> + FF '+f(a.ff)+' → output '+f(a.u)+' mm/s<br><small>Dashed blue: final output after velocity limit and stop override.</small>';
 const sw=run.rows.find(r=>r.latched);$('decision').textContent='XGO = '+Number(a.xgo)+' · |e| = '+f(Math.abs(a.e))+' mm · INPX = '+f(c.tolerance)+' mm. '+(sw?'Switch event at '+f(sw.t)+' s; position error '+f(sw.e)+' mm.':'No switch event in this run.')+(a.latched&&Math.abs(a.e)>=c.tolerance?' The axis has subsequently left the tolerance band.':'');
 const nextR=Math.min(c.distance,c.speed*(t+c.dt));
 const steps=[['Read encoder','Xcᵢ = '+f(a.x)+' mm; ΔXcᵢ = '+f(a.dx)+' mm'],['Update position error','eᵢ = '+f(a.previousError)+' + '+f(a.dr)+' − '+f(a.dx)+' = '+f(a.recurrence)+' mm. Direct: Xrᵢ − Xcᵢ = '+f(a.e)+' mm.'],['Check endpoint and tolerance','XGO = '+Number(a.xgo)+'; |e| < INPX is '+(Math.abs(a.e)<c.tolerance)+'. Switching '+(run.c.switching?'enabled':'disabled')+'; state: '+a.state+'.'],['Calculate controller terms','P = '+f(a.p)+', I = '+f(a.it)+', D = '+f(a.d)+', feedforward = '+f(a.ff)+' mm/s.'],['Write velocity output','VELXᵢ = '+f(a.u)+' mm/s, held for Δt = '+c.dt+' s.'],['Prepare next reference; return','Xrᵢ₊₁ = '+f(nextR)+' mm; ΔXrᵢ₊₁ = '+f(nextR-a.r)+' mm.']];
 $('steps').innerHTML=steps.map((s,j)=>'<li class="'+(j===phase?'active':'')+'"><strong>'+s[0]+'</strong><br>'+s[1]+'</li>').join('');
 $('history').innerHTML=run.rows.slice(Math.max(0,index-5),index+1).map(r=>'<tr>'+[r.i,f(r.t),f(r.r),f(r.x),f(r.e),f(r.u)].map(v=>'<td>'+v+'</td>').join('')+'</tr>').join('');
 $('sample').disabled=index>=run.rows.length-1;$('status').textContent=(playing?'Playing':'Paused')+' · '+(index===run.rows.length-1?'End of observation window.':'Sample '+index+' of '+(run.rows.length-1)+'.');
}
$('settings').onsubmit=e=>{e.preventDefault();for(const k of numeric)c[k]=Number($(k).value);for(const k of ['mode','policy'])c[k]=$(k).value;for(const k of ['switching','feedforward'])c[k]=$(k).checked;build();$('settings-status').textContent='Applied. Rewound to the start.';};
$('settings').oninput=()=>{$('settings-status').textContent='Unapplied changes. Select Apply & rewind.';};
document.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>{page=Number(b.dataset.page);build();});
document.querySelectorAll('[data-preset]').forEach(b=>b.onclick=()=>{c={...Servo.defaults};const p=b.dataset.preset;if(p==='speed')c.speed=20;if(p==='gain')c.kp=10;if(p==='compensate')c.feedforward=true;if(p==='lag'){c.tau=.15;c.mode='PID';page=1;}if(p==='stop'){c.switching=true;page=2;}form();build();$('settings-status').textContent='Preset applied.';});
$('cursor').oninput=()=>{pause();index=Number($('cursor').value);phase=0;draw();};
$('rewind').onclick=()=>{pause();index=0;phase=0;draw();};
$('sample').onclick=()=>{pause();index=Math.min(index+1,runs[0].rows.length-1);phase=0;draw();};
$('phase').onclick=()=>{pause();if(phase===5){index=Math.min(index+1,runs[0].rows.length-1);phase=0;}else phase++;draw();};
$('play').onclick=()=>{if(playing){pause();draw();return;}if(index===runs[0].rows.length-1)index=0;playing=true;clock=index*c.dt;last=performance.now();$('play').textContent='Pause';draw();playbackTimer=setInterval(()=>tick(performance.now()),33);};
function tick(now){if(!playing)return;clock+=Math.min(.1,(now-last)/1000)*Number($('rate').value);last=now;index=Math.min(Math.floor(clock/c.dt),runs[0].rows.length-1);phase=0;if(index===runs[0].rows.length-1)pause();draw();}
$('isr-sample').onclick=()=> $('sample').onclick();$('isr-phase').onclick=()=> $('phase').onclick();
new ResizeObserver(()=>draw()).observe($('position'));form();build();
