(function(){
'use strict';
const C=MotorCore,$=id=>document.getElementById(id),colors=['#086b54','#355c93','#b05220','#8651a0'];
let tab='drive',running=false,time=0,state=C.initial(),history=[],last=0,stamp=0,stage='inverter';
let p={...C.defaults,freewheel:'diode',decay:'slow'},a={type:'dc',load:.4,reverse:false,overlay:true},v={peak:24,line:60,ratio:2,rect:'full',alpha:60,duty:.5,hz:10,carrier:1000,bus:24,window:200,fit:false},f={protected:true,current:3,L:.02,R:2,supply:24,clamp:120,compare:false,window:10},q={hz:30,poles:2,type:'pmsm',load:.4,reverse:false,carrier:1000,window:200,fit:false};
const lessons={
 drive:{title:'Switch voltage. Build current. Make torque.',intro:'Explore a 24 V brushed DC motor. The switches act quickly; inductance smooths current and inertia smooths motion.',challenge:'At fixed duty, what happens to current and speed when the shaft load suddenly increases?',answer:'Current rises as speed and back EMF fall. The additional current creates more torque. With fixed duty and no speed feedback, the motor settles at a lower speed.',notes:'The motor follows L di/dt = v − Ri − Kω and J dω/dt = Ki − bω − Tload·sign(ω). R = 2 Ω, L = 20 mH, Kt = Ke = 0.1 in SI units, J = 0.003 kg·m², b = 0.001 N·m·s/rad. Load is a resisting friction torque; it can hold the shaft at rest. Parameters are illustrative, not measured hardware data. The diode example supports all-switches-OFF fast decay and one-lower-switch-ON slow decay. The synchronous example uses both lower MOSFETs ON for slow decay. Fast decay returns winding energy through two diodes into an ideal absorbing DC bus. The diode has a fixed 0.7 V drop; active switch drops are idealized as zero. For continuous motoring current, diode slow decay has mean voltage ±[D·Vs − (1−D)·0.7]; diode fast decay has ±[D·Vs − (1−D)·(Vs+1.4)], while the synchronous example has ±D·Vs. Discontinuous current and regeneration do not follow that simple mean formula. Coasting opens all switches; existing current decays through body diodes into an ideal DC supply that can absorb energy, then becomes zero. Braking shorts the winding through both lower switches. Dead time, device losses, supply limits, thermal limits, and saturation are omitted. Switching is integrated at PWM edges with substeps; the ripple preview holds speed fixed over four periods. Avoid interpreting the animated shaft as actual frame-resolved RPM.'},
 anatomy:{title:'Motor mechanisms and commutation.',intro:'Identify the parts, follow the current, then step through the switching sequence. Each motor starts paused with an explanation of its current state.',challenge:'For the same rotating field, does an induction rotor run exactly at the field speed under load?',answer:'No. Induction torque requires relative motion between the field and rotor. In this simplified normal operating range, more load produces more slip. A synchronized permanent-magnet rotor keeps the field speed but trails by a larger electrical load angle.',notes:'These are conceptual steady-state comparisons, not transient motor designs. The motor anatomy view explains mechanisms using slowed schematic motion, without displaying a numerical RPM that could be confused with its playback speed. The single-coil schematic has pulsating torque; current reverses at neutral each half turn. Practical multi-coil armatures smooth this torque. BLDC uses six-step electronic commutation, while PMSM uses a continuous sinusoidal field. Their nominal field is 30 Hz with two poles. PMSM load angle is δ = asin(0.85·load fraction), an illustrative torque-angle model below pull-out. Induction slip is s = 0.015 + 0.12·load fraction, a qualitative normal-load approximation; rotor speed is (1 − s)ns. Startup, magnetic saturation, detailed rotor circuits, and loss of synchronism are not modeled.'},
 conversion:{title:'Trace the waveform through the power chain.',intro:'Select a conversion stage and compare its input and output. Voltage level, polarity and frequency are separate properties.',challenge:'If a transformer doubles voltage, what happens to the AC frequency?',answer:'The frequency stays unchanged. A transformer changes AC voltage according to the turns ratio. Rectification changes polarity; PWM controls average voltage; inversion can create a new AC fundamental frequency.',notes:'The source is an illustrative low-voltage sine wave (peak, not RMS). Transformer: Vs/Vp = Ns/Np; frequency is unchanged. Ideal diodes feed a resistive load with no smoothing capacitor. Half-wave mean = Vpk/π; full-wave mean = 2Vpk/π. SCR is a single half-wave controlled rectifier with a resistive load, firing angle α, and mean Vpk(1 + cos α)/(2π). It latches until the current reaches zero. PWM and inverter stages have their own adjustable ideal DC source. They are separate experiments; a real rectifier-fed bus would require filtering/regulation. PWM mean = D·Vbus. The inverter plot shows ideal bipolar sinusoidal PWM and its commanded sinusoidal average, not a physically filtered output. Transformer loading, diode drops, capacitor ripple, switching losses, and power-factor effects are excluded.'},
 flyback:{title:'The switch opens. The current needs a path.',intro:'Inspect a single switched RL winding at turn-off. Compare a flywheel diode with an illustrative high-voltage avalanche clamp.',challenge:'Which makes the winding current fall faster: a low-voltage flywheel diode or a high-voltage clamp?',answer:'The high-voltage clamp forces a faster current decay, but exposes the switch to a much larger voltage. The diode provides a low-voltage circulation path, so current decays more slowly.',notes:'This isolated low-side RL circuit zooms in on inductive turn-off; it is not the complete H-bridge. After opening, L di/dt = −Ri − Vclamp, stopped at i = 0. The diode clamps to 0.7 V. With the diode removed, an assumed 120 V avalanche clamp limits the inductive reverse winding voltage, making switch voltage Vs + 120 V while current flows. A real unprotected circuit depends on parasitic capacitance and device breakdown; the waveform here is a labeled clamp model, not a prediction of an unlimited spike. Initial magnetic energy is ½LI². It dissipates in winding resistance and the diode/clamp. Mechanical motion and back EMF are omitted.'},
 phase:{title:'Three phases create one rotating field.',intro:'Connect phase sequence and electrical frequency to the magnetic field, then compare synchronous motion with induction slip.',challenge:'Keep the electrical frequency fixed and double the number of poles. What happens to synchronous RPM?',answer:'It halves: ns = 120f/poles. Swapping two phases reverses the field. Raising PWM carrier frequency changes pulse density, not the commanded fundamental frequency or synchronous RPM.',notes:'Balanced sinusoidal current references are 120 electrical degrees apart. Their space-vector sum has constant magnitude 1.5 times one phase amplitude in this normalized model. Synchronous speed ns = 120f/poles rpm. The drawing shows electrical field angle; mechanical speed is scaled by the pole-pair count. The PWM plot compares a phase reference with a triangular carrier to produce a normalized pole voltage (±1 relative to DC midpoint), not line-to-line or motor neutral voltage. Actual phase currents require winding dynamics and a current controller; the displayed sinusoids are ideal current references. PMSM lag and induction slip use the same illustrative steady-state relations as Motor types. Carrier frequency and fundamental frequency are independent controls. PWM switching losses, dead time, startup, and field-oriented control are not modeled.'}
};
function range(id,label,value,min,max,step,unit=''){value=Number(value.toFixed(5));return `<label for="${id}">${label}<output id="${id}-out">${value}${unit}</output><input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${value}" data-unit="${unit}"></label>`;}
function select(id,label,value,options){return `<label for="${id}">${label}<select id="${id}">${options.map(([val,text])=>`<option value="${val}" ${String(value)===String(val)?'selected':''}>${text}</option>`).join('')}</select></label>`;}
function bind(id,obj,key,kind='number'){const el=$(id);el.addEventListener('input',()=>{obj[key]=kind==='number'?+el.value:kind==='bool'?el.value==='true':el.value;if($(id+'-out'))$(id+'-out').textContent=el.value+el.dataset.unit;if(tab==='flyback')resetClock(-.001);if(id==='hz'||id==='type'||id==='reverse'||id==='poles')resetClock(tab==='flyback'?-.001:0);draw();});}
function resetClock(t=0){running=false;time=t;$('play').textContent='Play';$('status').textContent=t<0?'Paused before turn-off. Select Open switch.':'Paused at the selected state.';}
function check(id,label,value){return `<label class="check"><input id="${id}" type="checkbox" ${value?'checked':''}> ${label}</label>`;}
function bindCheck(id,obj,key){$(id).onchange=()=>{obj[key]=$(id).checked;draw();};}
function frequencyInput(obj){return range('hz','AC fundamental frequency',obj.hz,1,100,1,' Hz')+`<label for="hz-exact">Exact frequency (1–100 Hz)<input id="hz-exact" type="number" min="1" max="100" step="0.1" value="${obj.hz}"></label><p id="frequency-error" role="alert"></p>`;}
function bindFrequency(obj){const apply=value=>{obj.hz=value;$('hz').value=value;$('hz-exact').value=value;$('hz-out').textContent=value+' Hz';$('frequency-error').textContent='';resetClock();$('status').textContent='Frequency changed. Paused at cycle start; fixed time window retained.';draw();};$('hz').oninput=()=>apply(+$('hz').value);$('hz-exact').oninput=()=>{const value=+$('hz-exact').value;if(Number.isFinite(value)&&value>=1&&value<=100)apply(value);else $('frequency-error').textContent='Enter a frequency between 1 and 100 Hz.';};}
function windowControls(obj){return select('time-window','Fixed time window',obj.window,[[2,'2 ms · switching detail'],[20,'20 ms'],[50,'50 ms'],[200,'200 ms · default'],[1000,'1,000 ms · low frequencies']])+check('fit-cycles','Fit two cycles (automatic time axis)',obj.fit);}
function bindWindow(obj){bind('time-window',obj,'window');bindCheck('fit-cycles',obj,'fit');}
function span(obj){return C.waveWindow(obj);}
function legend(id,items){$(id).previousElementSibling.innerHTML=items.map(({label,color,dash})=>`<span style="--series:${color};${dash?'--line-style:dashed':''}">${label}</span>`).join('');}
function setTab(name){tab=name;running=false;time=0;state=C.initial();history=[];$('play').textContent='Play';$('answer').open=false;document.querySelectorAll('[data-tab]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.tab===tab));const l=lessons[tab];$('title').textContent=l.title;$('intro').textContent=l.intro;$('challenge').textContent=l.challenge;$('explanation').textContent=l.answer;$('notes').innerHTML=`<p>${l.notes}</p>`;$('extras').innerHTML='';$('plots').innerHTML='';$('stage-tools').innerHTML='';if(tab==='flyback')time=-.001;
 if(tab==='drive'){$('controls').innerHTML=select('freewheel','H-bridge example',p.freewheel,[['diode','1 · Diode bridge'],['sync','2 · Synchronous MOSFET']])+select('decay','Diode PWM off state',p.decay,[['slow','Local loop · one lower switch ON'],['fast','DC-bus return · all switches OFF']])+select('mode','Bridge mode',p.mode,[['forward','Forward'],['reverse','Reverse'],['coast','Coast · all open'],['brake','Brake · short winding']])+range('duty','Duty cycle',p.duty*100,0,100,1,'%')+range('frequency','Switching frequency',p.frequency,100,4000,100,' Hz')+range('supply','Supply',p.supply,6,48,1,' V')+range('load','Resisting load',p.load,0,.8,.01,' N·m');bind('freewheel',p,'freewheel','string');bind('decay',p,'decay','string');bind('mode',p,'mode','string');bind('frequency',p,'frequency');bind('supply',p,'supply');bind('load',p,'load');$('duty').oninput=()=>{p.duty=+$('duty').value/100;$('duty-out').textContent=$('duty').value+'%';draw();};addPlot('speed','Mechanical response · last 6 seconds',['Speed (RPM)']);addPlot('current','Current & torque · last 6 seconds',['Winding current (A)','Torque (N·m), right axis']);addPlot('ripple','Switching detail · four PWM periods',['Terminal voltage (V)','Winding current (A), right axis']);$('extras').innerHTML='<p id="bridge-state" class="scope"></p><p id="bridge-energy" class="scope"></p><button id="inspect-off">Inspect PWM off interval</button><div id="bridge-explanation" class="mechanism"></div><details id="bridge-comparison"><summary>Compare designs, use cases &amp; tradeoffs</summary><div id="bridge-comparison-content"></div></details>';
 $('bridge-comparison-content').innerHTML=`<div class="comparison-scroll"><table><thead><tr><th>Design choice</th><th>Diode freewheeling</th><th>Synchronous MOSFET</th></tr></thead><tbody>
 <tr><th>PWM off interval, forward current</th><td>Default slow decay: B4 remains ON and D2 conducts. Optional fast decay: all switches OFF; D2 and D3 conduct.</td><td>B1 OFF, B2 and B4 ON. Current returns through the B2 channel.</td></tr>
 <tr><th>Where energy goes during PWM OFF</th><td>Fast: some winding energy returns to the DC bus. Slow: current stays in a local winding/diode loop.</td><td>In this slow-decay example, current stays in a local winding/channel loop. MOSFET bridges can also use fast decay with other gate commands.</td></tr><tr><th>Typical uses</th><td>Bipolar H-bridge drivers such as the L298; simple MOSFET drives using diode recirculation; teaching and demonstrating inductive protection.</td><td>MOSFET brushed-DC and stepper drivers; low-voltage battery-powered actuators where conduction loss and heat matter.</td></tr>
 <tr><th>Return-path loss</th><td>Approximately 2|I|·Vf for the two-diode fast path, or |I|·Vf for the local slow path. Vf is 0.7 V in this model, but depends on the real diode and current.</td><td>Approximately I²·RDS(on) in the returning MOSFET. Often lower with a suitably low-resistance MOSFET; not automatically lower in every design.</td></tr>
 <tr><th>Control requirements</th><td>No gate command is needed for the return diode; it conducts when forward-biased. The bridge still needs correct switching and shoot-through prevention.</td><td>Complementary gate control plus dead time. Upper and lower devices on the same leg must never conduct together.</td></tr>
 <tr><th>What remains common</th><td colspan="2">Both reverse motor polarity with the bridge and use PWM to control drive. Both need diode paths for inductive current. Current does not disappear at the PWM falling edge.</td></tr>
 <tr><th>Other practical considerations</th><td>Diode current rating, forward drop, reverse recovery, and heat.</td><td>MOSFET resistance, gate-drive losses, dead time, body-diode recovery, and heat. Synchronous conduction does not eliminate these diode effects.</td></tr>
 <tr><th>What this comparison models</th><td>Ideal active switches with separate 0.7 V diodes; no BJT saturation-voltage or switching-loss model.</td><td>Ideal zero-resistance channels with body diodes; no gate-charge or switching-loss model.</td></tr>
 </tbody></table></div><p class="scope">For example, at 3 A one conducting diode would dissipate about 2.1 W (two would dissipate about 4.2 W) while conducting if Vf = 0.7 V. A 20 mΩ MOSFET channel would dissipate about 0.18 W at the same current. These are illustrative instantaneous conduction losses in one return device, not whole-driver efficiency; PWM off-time fraction and all other losses still matter.</p><p class="scope">Device type and switching strategy are separate choices. Four diodes do not automatically imply fast decay: the gate commands select the path. A MOSFET bridge can also use either fast or slow decay. The diode bridge uses bipolar transistors and separate diodes; the second example demonstrates active recirculation possible with MOSFET channels. Experiment 04 isolates the single-switch diode principle; its one fixed diode is not a replacement for four diode paths in a bidirectional bridge.</p><p class="scope">References: <a href="https://www.st.com/resource/en/datasheet/l298.pdf" target="_blank" rel="noopener">ST L298 bipolar bridge</a> · <a href="https://www.st.com/resource/en/application_note/an1762-l6205-l6206-l6207-dual-full-bridge-drivers-stmicroelectronics.pdf" target="_blank" rel="noopener">ST MOSFET recirculation application note</a>. The lab itself works offline.</p>`;
 $('inspect-off').onclick=()=>{resetClock();if(p.mode==='brake'||p.mode==='coast'){p.mode='forward';$('mode').value='forward';}if(p.duty===0||p.duty===1){p.duty=.55;$('duty').value=55;$('duty-out').textContent='55%';}state=C.initial();history=[];for(let k=0;k<500;k++){C.step(state,p,.002);history.push([state.t,C.rpm(state.w),state.i]);}const offTarget=(Math.floor(state.t*p.frequency+1e-7)+p.duty+(1-p.duty)*.2)/p.frequency;C.step(state,p,offTarget-state.t);history.push([state.t,C.rpm(state.w),state.i]);draw();$('status').textContent='Paused in PWM OFF. Switch between the two examples to compare the diode and channel paths at the same motor current.';};
 $('step').textContent='Next PWM edge';$('time-note').textContent='Playback uses physical motor time. “Next PWM edge” pauses at the next duty or period boundary.';}
 if(tab==='anatomy'){
 $('controls').innerHTML=select('type','Motor type',a.type,[['dc','Brushed DC'],['bldc','BLDC · six-step'],['pmsm','PMSM · sinusoidal'],['induction','AC induction']])+select('reverse','Direction',a.reverse,[['false','Forward'],['true','Reverse']])+check('overlay','Show magnetic-field arrows',a.overlay)+'<details><summary>Explore load</summary>'+range('load','Load fraction',a.load,0,1,.05)+'<p class="scope">Illustrative steady-state load effect; startup and pull-out are not modeled.</p></details>';
 bind('type',a,'type','string');bind('reverse',a,'reverse','bool');bind('load',a,'load');bindCheck('overlay',a,'overlay');
 $('extras').innerHTML='<div id="motor-sequence" class="sequence" aria-label="Commutation states"></div><div id="mechanism" class="mechanism"></div>';
 $('time-note').textContent='Paused at an explanatory position. Motion is a slowed mechanism demonstration, not an actual-speed measurement.';
 }
 if(tab==='conversion'){
 $('stage-tools').innerHTML='<nav class="stage-nav" aria-label="Conversion stage">'+[['inverter','DC → AC inverter'],['transformer','AC → AC transformer'],['rectifier','AC → DC rectifier'],['pwm','DC → DC PWM']].map(([id,label])=>`<button data-stage="${id}" aria-pressed="${stage===id}">${label}</button>`).join('')+'</nav>';
 $('stage-tools').querySelectorAll('button').forEach(b=>b.onclick=()=>{stage=b.dataset.stage;setTab('conversion');});
 if(stage==='inverter'){
 $('title').textContent='DC → AC inverter: change frequency on a fixed time axis.';
 $('intro').textContent='The DC bus stays constant. The H-bridge alternates output polarity; sinusoidal PWM sets the AC fundamental. Increase frequency to see more cycles in the same time.';
 $('controls').innerHTML=range('bus','DC supply',v.bus,6,48,1,' V')+frequencyInput(v)+range('carrier','PWM switching frequency',v.carrier,500,4000,100,' Hz')+windowControls(v);
 bind('bus',v,'bus');bindFrequency(v);bind('carrier',v,'carrier');bindWindow(v);
 addPlot('conversion-reference','AC fundamental reference · voltage (V)',['Sinusoidal average reference']);
 addPlot('conversion-wave','Switched H-bridge output · voltage (V)',['PWM terminal voltage','Sinusoidal reference']);
 $('challenge').textContent='Keep the time window at 200 ms. Change output frequency from 10 Hz to 30 Hz. How many cycles fit?';$('explanation').textContent='10 Hz gives 2 cycles in 200 ms; 30 Hz gives 6. The pulse carrier is independent of that fundamental frequency.';
 }else{
 $('title').textContent={transformer:'Transformer: change voltage, preserve frequency.',rectifier:'Rectifier: change polarity, inspect the mean.',pwm:'DC PWM: change duty, inspect the mean.'}[stage];
 $('controls').innerHTML=stage==='pwm'?range('bus','DC supply',v.bus,6,48,1,' V')+range('dc-duty','DC PWM duty',v.duty*100,0,100,1,'%'):range('peak','Source peak',v.peak,6,48,1,' V')+range('line','Source frequency',v.line,50,60,10,' Hz')+range('ratio','Turns ratio Ns/Np',v.ratio,.25,2,.25);
 if(stage==='rectifier')$('controls').innerHTML+=select('rect','Rectifier',v.rect,[['full','Full-wave diode'],['half','Half-wave diode'],['scr','Half-wave SCR']])+range('alpha','SCR firing angle',v.alpha,0,180,5,'°');
 if(stage==='pwm'){bind('bus',v,'bus');$('dc-duty').oninput=()=>{v.duty=+$('dc-duty').value/100;$('dc-duty-out').textContent=$('dc-duty').value+'%';draw();};}else for(const key of ['peak','line','ratio'])bind(key,v,key);
 if(stage==='rectifier'){bind('rect',v,'rect','string');bind('alpha',v,'alpha');}
 addPlot('conversion-wave','Input and output · voltage (V)',['Input','Output','Mean']);
 }
 $('step').textContent='Advance 1 ms';$('time-note').textContent='Animation: 1/100 physical speed, multiplied by Playback speed. The time axis changes only when you change its control.';
 }
 if(tab==='flyback'){
 $('controls').innerHTML=select('protection','Turn-off circuit',f.protected,[['true','With flywheel diode · 0.7 V'],['false','Without diode · assumed 120 V clamp']])+check('compare','Compare both circuits',f.compare)+select('fly-window','Time after opening shown',f.window,[[2,'2 ms · inspect the spike'],[10,'10 ms · default'],[50,'50 ms'],[200,'200 ms · long decay']])+range('initial-i','Initial current',f.current,.5,6,.5,' A')+range('inductance','Inductance',f.L*1000,5,100,5,' mH');
 bind('protection',f,'protected','bool');bind('initial-i',f,'current');bind('fly-window',f,'window');bindCheck('compare',f,'compare');
 $('inductance').oninput=()=>{f.L=+$('inductance').value/1000;$('inductance-out').textContent=$('inductance').value+' mH';resetClock(-.001);draw();};
 addPlot('decay','Winding current (A)',[]);addPlot('spike','Voltage across the switch (V)',[]);
 $('extras').innerHTML='<div class="event-controls"><button id="before-open">Before opening</button><button id="at-open">Open switch</button><button id="after-open">1 ms after</button></div><p class="experiment-note">Without diode uses a specified avalanche-clamp model. It does not predict an arbitrary unprotected voltage spike. Both plots keep the same axes when you switch cases. This is a single-switch, one-direction example. A bidirectional H-bridge uses four diode paths, as shown in 01; a single fixed diode across its motor cannot be used for both polarities.</p>';
 $('before-open').onclick=()=>{resetClock(-.001);draw();};$('at-open').onclick=()=>{resetClock(0);draw();};$('after-open').onclick=()=>{resetClock(.001);draw();};
 $('step').textContent='Open switch';$('time-note').textContent='Starts 1 ms before opening. Playback slows time by 200× and pauses at turn-off, so you can inspect the current path.';
 }
 if(tab==='phase'){
 $('controls').innerHTML=frequencyInput(q)+select('poles','Number of poles',q.poles,[[2,'2 poles'],[4,'4 poles'],[6,'6 poles'],[8,'8 poles']])+select('type','Rotor',q.type,[['pmsm','Permanent magnet · synchronous'],['induction','Induction · asynchronous']])+range('load','Load fraction',q.load,0,1,.05)+select('reverse','Phase sequence',q.reverse,[['false','U → V → W'],['true','U → W → V']])+range('carrier','PWM switching frequency',q.carrier,500,4000,100,' Hz')+windowControls(q);
 bindFrequency(q);for(const k of ['poles','load','carrier'])bind(k,q,k);bind('type',q,'type','string');bind('reverse',q,'reverse','bool');bindWindow(q);
 addPlot('phases','Three-phase current references · normalized',['U','V','W']);addPlot('pwm-phase','Phase U PWM · same time axis',['Pole voltage / (Vbus/2)','Sinusoidal reference']);
 $('step').textContent='Advance field 30°';$('time-note').textContent='Animation: 1/100 physical speed, multiplied by Playback speed. Higher electrical frequency rotates the field faster; more poles slow the mechanical shaft.';
 }
 draw();
}
function addPlot(id,title,labels){$('plots').insertAdjacentHTML('beforeend',`<section class="plot"><h3>${title}</h3><div class="legend">${labels.map((s,i)=>`<span style="--series:${colors[i]}">${s}</span>`).join('')}</div><canvas id="${id}" role="img" aria-label="${title}"></canvas></section>`);}
function setup(canvas){const w=canvas.clientWidth,h=canvas.clientHeight,dpr=window.devicePixelRatio||1;canvas.width=w*dpr;canvas.height=h*dpr;const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);ctx.font='13px Arial';ctx.lineCap='round';return {ctx,w,h};}
function text(ctx,str,x,y,size=13,color='#17332f',align='left'){ctx.fillStyle=color;ctx.font=`${size}px Arial`;ctx.textAlign=align;ctx.fillText(str,x,y);ctx.textAlign='left';}
function line(ctx,x1,y1,x2,y2,color='#99aaa0',width=2,dash=[]){ctx.beginPath();ctx.strokeStyle=color;ctx.lineWidth=width;ctx.setLineDash(dash);ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();ctx.setLineDash([]);}
function circle(ctx,x,y,r,fill,stroke='#99aaa0'){ctx.beginPath();ctx.arc(x,y,r,0,C.TAU);if(fill){ctx.fillStyle=fill;ctx.fill();}ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.stroke();}
function arrow(ctx,x,y,angle,length,color,width=3){const xx=x+length*Math.cos(angle),yy=y+length*Math.sin(angle);line(ctx,x,y,xx,yy,color,width);line(ctx,xx,yy,xx-9*Math.cos(angle-.45),yy-9*Math.sin(angle-.45),color,width);line(ctx,xx,yy,xx-9*Math.cos(angle+.45),yy-9*Math.sin(angle+.45),color,width);}
function metric(items){$('metrics').innerHTML=items.map(([name,value])=>`<div><span>${name}</span><strong>${value}</strong></div>`).join('');}
function plot(id,series,options={}){const {ctx,w,h}=setup($(id)),left=48,right=options.secondary?50:18,top=18,bottom=34,pw=w-left-right,ph=h-top-bottom;
 const all=series.flatMap(s=>s.data.map(d=>d[1])),xmax=options.xmax||1,xmin=options.xmin||0;
 let ymin=options.ymin??Math.min(0,...all),ymax=options.ymax??Math.max(1,...all);if(ymax-ymin<1e-6)ymax=ymin+1;
 const x=t=>left+(t-xmin)/(xmax-xmin)*pw,y=(v,s)=>top+(1-(v-(s?.min??ymin))/((s?.max??ymax)-(s?.min??ymin)))*ph;
 for(let j=0;j<=4;j++){let val=ymin+(ymax-ymin)*j/4,yy=y(val);line(ctx,left,yy,w-right,yy,'#dbe1da',1);text(ctx,Math.abs(val)>=100?val.toFixed(0):val.toFixed(1),left-7,yy+4,11,'#52665f','right');}
 for(let j=0;j<=4;j++){const t=xmin+(xmax-xmin)*j/4;text(ctx,t.toFixed(options.decimals??1),x(t),h-15,11,'#52665f','center');}
 text(ctx,options.unit||'Time (s)',w-right,h-1,11,'#52665f','right');
 if(options.secondary){for(let j=0;j<=4;j++){const n=options.secondary.min+(options.secondary.max-options.secondary.min)*j/4;text(ctx,n.toFixed(1),w-right+6,top+ph-j*ph/4+4,11,colors[1]);}}
 ctx.save();ctx.beginPath();ctx.rect(left,top,pw,ph);ctx.clip();series.forEach((s,k)=>{ctx.beginPath();ctx.lineWidth=1.7;ctx.strokeStyle=s.color||colors[k];ctx.setLineDash(s.dash||[]);s.data.forEach(([xx,yy],i)=>{if(i)ctx.lineTo(x(xx),y(yy,s.scale));else ctx.moveTo(x(xx),y(yy,s.scale));});ctx.stroke();ctx.setLineDash([]);});if(options.event!=null)line(ctx,x(options.event),top,x(options.event),top+ph,'#99aaa0',1,[2,3]);if(options.cursor!=null)line(ctx,x(options.cursor),top,x(options.cursor),top+ph,'#8651a0',1,[3,3]);ctx.restore();
}
function points(n,fn){return Array.from({length:n+1},(_,i)=>fn(i/n));}
function bridge(ctx,w,h){
 const narrow=w<520,sx=narrow?20:42,lx=narrow?80:110,rx=narrow?w-52:Math.min(w*.55,380),top=44,bottom=246,mid=145;
 const g=C.gates(state.t+1e-10,p),path=C.conduction(state.t+1e-10,state.i,p),power=C.powerFlow(state.t+1e-10,state.i,p,state.w),active=[...path.switches,...path.diodes],local=active.length===2&&active.every(k=>k===1||k===3),returns=power.supplyPower<-.001;
 const names=path.switches.map(k=>'B'+(k+1)+(p.freewheel==='sync'?' channel':' transistor')).concat(path.diodes.map(k=>'D'+(k+1)+(p.freewheel==='sync'?' body diode':' diode')));
 $('bridge-state').textContent=g.map((on,k)=>`B${k+1} ${on?'ON':'OFF'}`).join(' · ')+` | Conducting: ${names.join(' + ')||'no winding current'}`;
 line(ctx,sx,top,rx,top);line(ctx,sx,bottom,rx,bottom);line(ctx,sx,top,sx,bottom);
 if(local)line(ctx,lx,bottom,rx,bottom,colors[0],3);
 else if(active.length){const upper=active.find(k=>k===0||k===2),lower=active.find(k=>k===1||k===3);if(upper!==undefined&&lower!==undefined){const col=returns?colors[2]:colors[0];line(ctx,sx,top,upper===0?lx:rx,top,col,3);line(ctx,sx,bottom,lower===1?lx:rx,bottom,col,3);line(ctx,sx,top,sx,bottom,col,3);arrow(ctx,sx,mid-37,returns?Math.PI/2:-Math.PI/2,22,col,2);}}
 circle(ctx,sx,mid,15,'#fffdf7',returns?colors[2]:'#99aaa0');text(ctx,'DC',sx,mid+4,10,'#17332f','center');text(ctx,`${p.supply} V bus`,(lx+rx)/2,26,14,'#17332f','center');text(ctx,'0 V',(lx+rx)/2,bottom+20,12,'#52665f','center');
 [lx,rx].forEach((x,k)=>[90,201].forEach((y,j)=>{
  const index=k*2+j,dx=x+(k?26:-26),from=j?mid:top,to=j?bottom:mid;
  line(ctx,x,from,x,y-18);line(ctx,x,y+18,x,to);line(ctx,x,y-18,x+(g[index]?0:13),y+18,'#99aaa0',2);
  line(ctx,x,y-22,dx,y-22);line(ctx,dx,y-22,dx,y-16);line(ctx,dx,y+16,dx,y+22);line(ctx,dx,y+22,x,y+22);
  const throughSwitch=path.switches.includes(index),throughDiode=path.diodes.includes(index);
  if(throughSwitch){line(ctx,x,from,x,to,colors[0],3);arrow(ctx,x+(k?-12:12),j?mid+26:top+23,((index===0||index===3)?state.i>0:state.i<0)?Math.PI/2:-Math.PI/2,18,colors[0],2);}
  if(throughDiode){line(ctx,x,from,x,y-22,colors[2],3);line(ctx,x,y-22,dx,y-22,colors[2],3);line(ctx,dx,y-22,dx,y-16,colors[2],3);line(ctx,dx,y+16,dx,y+22,colors[2],3);line(ctx,dx,y+22,x,y+22,colors[2],3);line(ctx,x,y+22,x,to,colors[2],3);arrow(ctx,dx+(k?-10:10),y+12,-Math.PI/2,24,colors[2],2);}
  diode(ctx,dx,y,6,throughDiode?colors[2]:'#aebbb2');
  text(ctx,`B${index+1} ${g[index]?'ON':'OFF'}`,x+(k?-7:7),y-6,11,throughSwitch?colors[0]:'#52665f',k?'right':'left');
  text(ctx,`D${index+1}`,dx,y+34,10,throughDiode?colors[2]:'#52665f','center');
 }));
 const mx=(lx+rx)/2;line(ctx,lx,mid,rx,mid,Math.abs(state.i)>1e-8?colors[0]:'#99aaa0',3);circle(ctx,mx,mid,22,'#e0f0e7',colors[0]);text(ctx,'M',mx,mid+6,18,colors[0],'center');if(Math.abs(state.i)>1e-8)arrow(ctx,mx+(state.i>0?-43:43),mid-13,state.i>0?0:Math.PI,18,colors[0],2);
 if(!narrow){const x=w*.8;circle(ctx,x,mid,60,null);circle(ctx,x,mid,45,'#e0f0e7',colors[0]);arrow(ctx,x,mid,state.angle,38,colors[0],4);text(ctx,'Shaft',x,mid+82,14,'#17332f','center');text(ctx,`${C.rpm(state.w).toFixed(0)} RPM`,x,mid+104,14,'#17332f','center');}
 const caption=active.length===0?'No winding current':returns?'Diode recovery → DC bus':local?(path.diodes.length?'Local loop: motor → transistor → diode':'Local loop: motor → MOSFET channels'):'DC bus supplies the motor';
 text(ctx,caption,w/2,294,12,returns?colors[2]:'#52665f','center');text(ctx,p.freewheel==='sync'?'D1–D4: built-in body diodes; gray = not conducting':'D1–D4: separate diodes; orange = conducting',w/2,319,11,'#52665f','center');
 $('bridge-energy').textContent=`${returns?'Power returned to DC bus':power.supplyPower>.001?'Power drawn from DC bus':'Power exchanged with DC bus'}: ${Math.abs(power.supplyPower).toFixed(2)} W · Diode heat: ${power.diodeLoss.toFixed(2)} W · Winding heat: ${power.copperLoss.toFixed(2)} W. ${local?'This off-state loop is isolated from the supply.':''}`;
}
function diode(ctx,x,y,size=7,color='#52665f'){
 // Cathode at top: body diode conducts from source (bottom) to drain (top).
 line(ctx,x,y+16,x,y+size,color,1);line(ctx,x,y-size,x,y-16,color,1);
 ctx.beginPath();ctx.moveTo(x-size,y+size);ctx.lineTo(x+size,y+size);ctx.lineTo(x,y-size);ctx.closePath();ctx.strokeStyle=color;ctx.lineWidth=1.4;ctx.stroke();line(ctx,x-size,y-size,x+size,y-size,color,1.5);
}
function inverter(ctx,w,h){
 const narrow=w<520,l=narrow?45:75,r=narrow?w-45:w*.56,mid=(l+r)/2,t=time,ref=Math.sin(C.TAU*v.hz*t),tri=4*Math.abs((t*v.carrier)%1-.5)-1,positive=ref>=tri;
 text(ctx,`DC supply: ${v.bus} V`,mid,29,15,'#17332f','center');
 line(ctx,l,50,r,50);line(ctx,l,240,r,240);
 [[l,90,positive,'B1'],[l,200,!positive,'B2'],[r,90,!positive,'B3'],[r,200,positive,'B4']].forEach(([x,y,on,label])=>{
 line(ctx,x,y===90?50:145,x,y-16);line(ctx,x,y+16,x,y===90?145:240);line(ctx,x,y-16,x+(on?0:13),y+16,on?colors[0]:'#99aaa0',on?4:2);text(ctx,label+(on?' ON':' off'),x+(x===l?9:-9),y,12,on?colors[0]:'#52665f',x===l?'left':'right');
 });
 line(ctx,l,145,r,145,colors[0],3);ctx.fillStyle='#fffdf7';ctx.fillRect(mid-24,130,48,30);text(ctx,'Load',mid,150,14,'#17332f','center');
 text(ctx,positive?'+':'−',l+9,133,17,colors[0]);text(ctx,positive?'−':'+',r-9,133,17,colors[0],'right');text(ctx,`Instantaneous output: ${positive?'+':'−'}${v.bus} V`,mid,278,14,'#17332f','center');
 if(!narrow){const x=w*.8,y=145;circle(ctx,x,y,62,null);arrow(ctx,x,y,-C.TAU*v.hz*t,52,colors[3]);text(ctx,'AC reference phase',x,238,13,colors[3],'center');text(ctx,`${v.hz} Hz`,x,263,18,'#17332f','center');}
}
function motorMechanism(ctx,w,h){
 const narrow=w<620,cx=narrow?w/2:w*.3,cy=155,r=narrow?88:103,dir=a.reverse?-1:1,phase=dir*time*C.TAU/4;
 const info=C.field({type:a.type,hz:30,poles:2,load:a.load}),section=((Math.floor(phase/(Math.PI/3))%6)+6)%6;
 const pairs=[[1,-1,0],[1,0,-1],[0,1,-1],[-1,1,0],[-1,0,1],[0,-1,1]];
 let desc='',sequence='',secondary='';
 circle(ctx,cx,cy,r+13,null);
 if(a.type==='dc'){
  const theta=Math.PI/4-phase,positive=Math.cos(theta)*dir>=0;
  // Fixed field is left (N) to right (S). Axial conductors reverse polarity at neutral.
  for(const [x,label] of [[cx-r-5,'N'],[cx+r+5,'S']]){ctx.fillStyle='#e0f0e7';ctx.fillRect(x-16,cy-43,32,86);text(ctx,label,x,cy+6,20,colors[0],'center');}
  text(ctx,'Fixed magnets',cx,27,14,colors[0],'center');circle(ctx,cx,cy,r-24,'#edf1e9');
  const dx=Math.cos(theta)*(r-43),dy=Math.sin(theta)*(r-43);line(ctx,cx-dx,cy-dy,cx+dx,cy+dy,colors[2],6);
  [[cx+dx,cy+dy,positive,'A'],[cx-dx,cy-dy,!positive,'B']].forEach(([x,y,dot,label])=>{circle(ctx,x,y,13,'#fffdf7',colors[2]);text(ctx,dot?'⊙':'⊗',x,y+6,21,colors[2],'center');text(ctx,label,x,y-19,12,'#17332f','center');arrow(ctx,x+18,y,dot?-Math.PI/2:Math.PI/2,25,colors[1],2);});
  if(a.overlay)arrow(ctx,cx-55,cy-70,0,110,colors[0]);
  text(ctx,'Rotating coil · A and B conductors',cx,cy+r+40,13,'#17332f','center');
  const zx=narrow?w/2:w*.76,zy=narrow?420:152;
  text(ctx,'Split commutator (enlarged)',zx,zy-85,14,'#17332f','center');
  for(let k=0;k<2;k++){ctx.beginPath();ctx.arc(zx,zy,45,theta+k*Math.PI+.08,theta+(k+1)*Math.PI-.08);ctx.strokeStyle=k?colors[1]:colors[2];ctx.lineWidth=14;ctx.stroke();text(ctx,k?'B':'A',zx+45*Math.cos(theta+(k+.5)*Math.PI),zy+45*Math.sin(theta+(k+.5)*Math.PI)+4,12,'#fffdf7','center');}
  for(const [xx,label] of [[zx-63,a.reverse?'−':'+'],[zx+63,a.reverse?'+':'−']]){ctx.fillStyle='#52665f';ctx.fillRect(xx-10,zy-15,20,30);text(ctx,label,xx,zy+40,17,'#17332f','center');}
  text(ctx,'Fixed brushes touch the rotating ring',zx,zy+73,12,'#52665f','center');
  text(ctx,'⊙ current out of page · ⊗ into page',zx,zy+98,12,colors[2],'center');
  desc=`Conductor A carries current ${positive?'out of':'into'} the page; B carries it ${positive?'into':'out of'} the page. The blue force arrows keep torque in the ${a.reverse?'reverse':'forward'} direction. At each neutral crossing, the brushes contact the other ring segment and reverse current in the coil.`;
  sequence=positive?'Coil polarity A: ⊙ / B: ⊗':'Coil polarity A: ⊗ / B: ⊙';secondary='Mechanical switching';
  $('step').textContent='Next commutation';
 }else{
  const currents=a.type==='bldc'?pairs[section]:[0,1,2].map(k=>Math.cos(phase-k*C.TAU/3));
  const result=C.resultant(currents),fieldAngle=Math.atan2(result.y,result.x),rotorAngle=a.type==='induction'?phase*(1-info.slip):phase-(a.type==='bldc'?Math.PI/6:0)-dir*info.lag;
  for(let k=0;k<6;k++){
   const angle=k*Math.PI/3,phaseIndex=[0,2,1,0,2,1][k],value=currents[phaseIndex]*[1,-1,1,-1,1,-1][k],x=cx+(r-2)*Math.cos(angle),y=cy-(r-2)*Math.sin(angle);
   ctx.fillStyle=Math.abs(value)>.05?colors[phaseIndex]:'#dbe1da';ctx.globalAlpha=.25+.65*Math.abs(value);ctx.fillRect(x-14,y-17,28,34);ctx.globalAlpha=1;
   text(ctx,Math.abs(value)<.05?'0':value>0?'+':'−',x,y+5,17,'#17332f','center');text(ctx,['U','V','W'][phaseIndex],cx+(r+32)*Math.cos(angle),cy-(r+32)*Math.sin(angle)+4,13,colors[phaseIndex],'center');
  }
  circle(ctx,cx,cy,r-37,'#edf1e9',colors[1]);
  if(a.type==='induction'){
   for(let k=0;k<10;k++){const angle=rotorAngle+k*C.TAU/10,x=cx+(r-49)*Math.cos(angle),y=cy-(r-49)*Math.sin(angle),out=Math.sin(fieldAngle-angle)>0;circle(ctx,x,y,7,'#fffdf7',colors[2]);text(ctx,out?'•':'×',x,y+4,12,colors[2],'center');}
   arrow(ctx,cx,cy,-rotorAngle,r-44,colors[1]);
  }else{
   ctx.save();ctx.translate(cx,cy);ctx.rotate(-rotorAngle);ctx.fillStyle='#d9e5f5';ctx.fillRect(-(r-43),-16,2*(r-43),32);text(ctx,'S',-(r-53),5,16,colors[1],'center');text(ctx,'N',r-53,5,16,colors[1],'center');ctx.restore();
  }
  if(a.overlay)arrow(ctx,cx,cy,-fieldAngle,r-15,colors[0],3);
  text(ctx,'Stator windings: U, V, W',cx,23,14,'#17332f','center');text(ctx,a.type==='induction'?'Conductive rotor bars · no magnets':'Permanent-magnet rotor',cx,cy+r+49,13,colors[1],'center');
  const tx=narrow?w/2:w*.77,ty=narrow?385:89;
  text(ctx,a.type==='bldc'?'Which windings are energized?':'Instantaneous stator currents',tx,ty,14,'#17332f','center');
  currents.forEach((value,k)=>text(ctx,`${['U','V','W'][k]}   ${value.toFixed(2)}${Math.abs(value)<.05?'  · off':''}`,tx,ty+34+k*31,17,colors[k],'center'));
  text(ctx,'Green arrow: combined stator field',tx,ty+143,12,colors[0],'center');
  if(a.type==='bldc'){
   const labels=['U+ V−','U+ W−','V+ W−','V+ U−','W+ U−','W+ V−'];sequence=labels[section];secondary=`Sector ${section+1} / 6`;
   desc=`Sector ${section+1}: ${labels[section]}. Two phases conduct and the third floats. The electronic driver advances the energized pair by 60°; the permanent-magnet rotor follows. Reverse direction traverses the sequence backward.`;
   $('motor-sequence').innerHTML=labels.map((x,k)=>`<button data-sector="${k}" aria-pressed="${k===section}">${k+1} · ${x}</button>`).join('');$('motor-sequence').querySelectorAll('button').forEach(b=>b.onclick=()=>{resetClock((+b.dataset.sector+.01)*4/6*dir);draw();});$('step').textContent='Next commutation';
  }else if(a.type==='pmsm'){
   sequence='Three sinusoidal currents';secondary=`Lag ${(info.lag*180/Math.PI).toFixed(0)}°`;desc='The three winding currents vary smoothly. Their combined field rotates continuously, pulling the permanent-magnet rotor along at the same average speed. More load increases its angular lag.';$('step').textContent='Advance field 30°';
  }else{
   sequence=`Slip ${(info.slip*100).toFixed(1)}%`;secondary='Induced rotor current';desc='The green stator field overtakes the blue rotor marker. Relative motion induces currents in the conducting rotor bars (dots/crosses, qualitative); these currents create torque. Increase load to increase slip and watch the field gain on the rotor.';$('step').textContent='Advance field 30°';
  }
 }
 if(a.type!=='bldc')$('motor-sequence').innerHTML='';
 metric([['Current state',sequence],['Torque mechanism',secondary],['Display','Slowed schematic']]);
 $('scene-note').textContent=desc;
 $('mechanism').innerHTML=`<strong>${{dc:'DC supply → brushes → commutator → rotor coil',bldc:'DC supply → six-step driver → stator windings',pmsm:'DC supply → sinusoidal inverter → stator windings',induction:'Three-phase stator field → induced rotor currents → torque'}[a.type]}</strong><p>${a.type==='dc'?'The single-coil drawing has torque ripple and reverses current at neutral. A practical multi-coil armature smooths torque.':'Colored stator blocks show signed winding excitation, not literal wire cross sections. Rotor current markings in induction mode are qualitative, not an electromagnetic field solution.'}</p>`;
}
function draw(){$('scene').style.height=tab==='drive'?'340px':tab==='anatomy'?($('scene').clientWidth<620?'570px':'355px'):tab==='phase'&&$('scene').clientWidth<520?'465px':'';const {ctx,w,h}=setup($('scene'));
 if(tab==='drive'){
 const lecture=p.freewheel==='diode',fast=lecture&&p.decay==='fast',forward=p.mode!=='reverse',returnDevice=forward?'B2':'B4',held=forward?'B4':'B2';
 $('decay').closest('label').style.display=lecture?'':'none';
 $('bridge-explanation').innerHTML=fast?`<strong>1 · Diode bridge — all-switches-OFF fast decay</strong><p>During PWM OFF, all four switches are open. For ${forward?'forward':'reverse'} current the path is motor → ${forward?'D3':'D1'} → positive DC rail → DC bus → negative rail → ${forward?'D2':'D4'} → motor. The two diodes return some winding energy to the DC bus, while the winding and diodes also dissipate heat.</p><p>The opposing winding voltage is approximately ${p.supply+1.4} V in magnitude, so current falls rapidly. This differs from the local loop of the synchronous example. The source is idealized as able to absorb returned energy; a real drive needs suitable bus capacitance and energy management.</p><p><strong>Where used:</strong> fast current decay and diode recovery paths when a bridge releases an inductive load. The four-diode bridge diagram supports this path, but the gate commands determine whether it uses fast or slow decay.</p>`:lecture?`<strong>1 · Diode bridge — local slow decay</strong><p>During normal ${forward?'forward':'reverse'} PWM OFF, ${held} stays ON and ${returnDevice} stays OFF. The diode beside ${returnDevice} carries return current. Current stays in the local motor loop; it does not return to the supply. This is deliberately similar to synchronous slow decay, with a diode drop instead of channel resistance.</p><p><strong>Where used:</strong> bipolar drivers and simple diode-recirculation drives requiring slower current decay. <strong>Tradeoff:</strong> no gate command is needed for the return diode, but its forward drop causes heat. Select “All switches OFF” to see the DC-bus return path.</p>`:`<strong>2 · Synchronous MOSFET — local slow decay</strong><p>During PWM OFF, both lower MOSFETs turn ON. The ${returnDevice} channel carries return current in reverse, bypassing its body diode. Current circulates locally through the motor and lower channels; it does not return to the supply in this off state.</p><p><strong>Where used:</strong> MOSFET motor drives where low recirculation loss and smooth winding current matter. <strong>Tradeoff:</strong> low channel resistance reduces heating, but requires coordinated gate timing and dead time. Body diodes remain necessary and conduct during real dead time, which is not simulated.</p>`;
 if(p.mode==='brake'||p.mode==='coast')$('bridge-explanation').innerHTML+=`<p><strong>Current mode: ${p.mode}.</strong> The PWM off-state descriptions above apply to Forward/Reverse. Coast opens all switches; Brake commands both lower switches ON.</p>`;
 metric([['Speed',`${C.rpm(state.w).toFixed(0)} RPM`],['Current',`${state.i.toFixed(2)} A`],['Torque',`${(C.motor.K*state.i).toFixed(3)} N·m`]]);bridge(ctx,w,h);
 const avg=(p.mode==='forward'?1:p.mode==='reverse'?-1:0)*p.duty*p.supply;
 $('scene-note').textContent=`t = ${state.t.toFixed(4)} s · Back EMF = ${(C.motor.K*state.w).toFixed(2)} V · ${p.mode==='coast'?'Supply disconnected; open winding voltage follows back EMF':`Ideal PWM command = ${avg.toFixed(2)} V (before diode drops)`} · Torque follows current, not voltage directly.`;
 const start=Math.max(0,state.t-6),end=Math.max(1,state.t),hist=history.length?history:[[0,0,0]];
 plot('speed',[{data:hist.map(d=>[d[0],d[1]])}],{xmin:start,xmax:end,ymin:Math.min(-50,...hist.map(d=>d[1])),ymax:Math.max(100,...hist.map(d=>d[1]))});
 const clo=Math.min(-.1,...hist.map(d=>d[2])),chi=Math.max(1,...hist.map(d=>d[2]));const torqueScale={min:clo*C.motor.K,max:chi*C.motor.K};plot('current',[{data:hist.map(d=>[d[0],d[2]])},{data:hist.map(d=>[d[0],d[2]*C.motor.K]),scale:torqueScale,dash:[5,5]}],{xmin:start,xmax:end,ymin:clo,ymax:chi,secondary:torqueScale});
 const n=512,T=4/p.frequency,volts=[],amps=[];let ii=state.i;for(let k=0;k<=n;k++){let tt=state.t+k*T/n,vv=C.terminal(tt+T/n/2,ii,p,state.w);if(k){const eq=(vv-C.motor.K*state.w)/C.motor.R,ni=eq+(ii-eq)*Math.exp(-C.motor.R*(T/n)/C.motor.L);ii=(p.mode==='coast'&&(ii*ni<=0||Math.abs(ii)<1e-9))||(p.freewheel==='diode'&&ii*ni<0)?0:ni;}volts.push([k*T/n*1000,vv]);amps.push([k*T/n*1000,ii]);}
 const imin=Math.min(...amps.map(d=>d[1]))-.05,imax=Math.max(...amps.map(d=>d[1]))+.05;
 plot('ripple',[{data:volts},{data:amps,scale:{min:imin,max:imax}}],{xmax:T*1000,ymin:-p.supply-2,ymax:p.supply+2,secondary:{min:imin,max:imax},unit:'Time from now (ms)'});
 }
 if(tab==='anatomy')motorMechanism(ctx,w,h);
 if(tab==='conversion'){
 const bus=stage==='inverter'||stage==='pwm'?v.bus:v.peak*v.ratio;
 const duration=stage==='inverter'?span(v):stage==='pwm'?.008:.05,n=Math.max(1000,Math.ceil(duration*v.hz*80));
 if(stage==='inverter'){
  metric([['DC input',`${bus} V`],['AC fundamental',`${v.hz} Hz`],['Cycles in window',`${(duration*v.hz).toFixed(2)}`]]);inverter(ctx,w,h);
  const reference=points(n,z=>[z*duration*1000,bus*Math.sin(C.TAU*v.hz*z*duration)]),switched=C.pwmWave(duration,v.hz,v.carrier,bus).map(([x,y])=>[x*1000,y]);
  plot('conversion-reference',[{data:reference}],{xmax:duration*1000,ymin:-bus*1.15,ymax:bus*1.15,unit:'Time (ms)',cursor:(time%duration)*1000});
  plot('conversion-wave',[{data:switched},{data:reference,dash:[6,4]}],{xmax:duration*1000,ymin:-bus*1.15,ymax:bus*1.15,unit:'Time (ms)',cursor:(time%duration)*1000});
  $('scene-note').textContent=`${v.fit?'Automatic fit: two cycles.':'Fixed time axis.'} ${(duration*1000).toFixed(1)} ms contains ${(duration*v.hz).toFixed(2)} AC cycles at ${v.hz} Hz. PWM switching: ${v.carrier} Hz. The separate reference plot shows the requested sinusoidal average; it is not a measured filtered output. t = ${(time*1000).toFixed(1)} ms.`;
 }else{
  metric([['Input',stage==='pwm'?`${bus} V DC`:`${v.peak} V peak`],['Output',stage==='transformer'?`${bus.toFixed(1)} V peak`:stage==='rectifier'?`${C.rectMean(v).toFixed(2)} V mean`:`${(v.duty*bus).toFixed(2)} V mean`],['Time window',`${duration*1000} ms · fixed`]]);
  const x1=w*.22,x2=w*.78,yy=145;circle(ctx,x1,yy,45,null);circle(ctx,x2,yy,45,'#e0f0e7');arrow(ctx,x1+50,yy,0,x2-x1-100,colors[0]);text(ctx,stage==='pwm'?'DC':'AC',x1,yy+5,20,'#17332f','center');text(ctx,stage==='transformer'?'AC':'DC',x2,yy+5,20,'#17332f','center');text(ctx,{transformer:'Transformer',rectifier:'Rectifier',pwm:'PWM switch'}[stage],w/2,83,18,'#17332f','center');text(ctx,stage==='transformer'?`Ns/Np = ${v.ratio}`:stage==='rectifier'?v.rect==='scr'?`SCR firing: ${v.alpha}°`:v.rect==='full'?'Full-wave':'Half-wave':`Duty: ${Math.round(v.duty*100)}%`,w/2,245,15,'#52665f','center');
  let series=[];
  if(stage==='transformer'){
   series=[{data:points(n,z=>[z*duration*1000,C.conversion(z*duration,v).primary]),dash:[5,4]},{data:points(n,z=>[z*duration*1000,C.conversion(z*duration,v).secondary])}];
   $('scene-note').textContent=`${v.peak} V peak × turns ratio ${v.ratio} = ${bus.toFixed(1)} V peak. Input and output frequency both remain ${v.line} Hz.${v.ratio===1?' At 1:1 the curves overlap; voltage is unchanged.':''}`;
  }else if(stage==='rectifier'){
   series=[{data:points(n,z=>[z*duration*1000,C.conversion(z*duration,v).secondary])},{data:points(n,z=>[z*duration*1000,C.conversion(z*duration,v).rect])},{data:[[0,C.rectMean(v)],[duration*1000,C.rectMean(v)]],dash:[6,4]}];
   $('scene-note').textContent=v.rect==='scr'?`Half-wave SCR feeding a resistor. Fires at ${v.alpha}°; conduction ends at 180°. Mean ${C.rectMean(v).toFixed(2)} V.`:'Unfiltered rectification: output has one polarity but still varies with time. The dashed line is its mean.';
  }else{
   series=[{data:[[0,bus],[8,bus]],dash:[5,4]},{data:points(1200,z=>[z*8,(z*.008*500)%1<v.duty?bus:0])},{data:[[0,v.duty*bus],[8,v.duty*bus]],dash:[5,4]}];$('scene-note').textContent=`${bus} V DC source · 500 Hz PWM · ${Math.round(v.duty*100)}% duty → ${(v.duty*bus).toFixed(2)} V mean.`;
  }
  plot('conversion-wave',series,{xmax:duration*1000,ymin:-Math.max(bus,v.peak)*1.15,ymax:Math.max(bus,v.peak)*1.15,unit:'Time (ms)',cursor:(time%duration)*1000});
 }
 if($('time-window'))$('time-window').disabled=v.fit;
 }
 if(tab==='flyback'){
 const t=time,before=t<0,now=before?{i:f.current,switchV:0}:C.flyback(t,f),color=f.protected?colors[0]:colors[2];
 metric([['Switch state',before?'CLOSED':'OPEN'],['Winding current',`${now.i.toFixed(2)} A`],['Switch voltage',`${now.switchV.toFixed(1)} V`]]);
 const x=w/2,lx=Math.max(34,x-100),rx=Math.min(w-34,x+100);
 const path=(x1,y1,x2,y2,active)=>line(ctx,x1,y1,x2,y2,active?color:'#b0bcb5',active?3:1.5);
 path(lx,45,rx,45,before);path(lx,45,lx,235,before);path(lx,235,rx,235,before);path(rx,45,rx,80,now.i>0);if(!before&&now.i>0)path(x,45,rx,45,true);path(rx,165,rx,185,before);path(rx,215,rx,235,before);line(ctx,rx,185,rx+(before?0:18),215,before?color:'#52665f',3);text(ctx,before?'Closed switch':'Open switch',rx-13,207,12,'#17332f','right');
 ctx.strokeStyle=now.i>0?color:'#b0bcb5';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(rx,80);for(let k=0;k<5;k++)ctx.bezierCurveTo(rx+24,80+k*17,rx+24,97+k*17,rx,97+k*17);ctx.stroke();text(ctx,'Winding',rx-16,130,12,'#17332f','right');circle(ctx,lx,138,23,'#fffdf7');text(ctx,'24 V',lx,143,12,'#17332f','center');
 if(f.protected){path(x,45,x,85,!before&&now.i>0);path(x,117,x,165,!before&&now.i>0);path(x,165,rx,165,!before&&now.i>0);diode(ctx,x,101,8,!before&&now.i>0?color:'#52665f');text(ctx,'Diode',x-12,79,12,color,'right');}
 else{line(ctx,x,45,x,165,!before&&now.i>0?color:'#99aaa0',2,[5,4]);line(ctx,x,165,rx,165,color,2,[5,4]);text(ctx,'Assumed',x-12,82,12,color,'right');text(ctx,'120 V clamp',x-12,103,12,color,'right');}
 if(now.i>0){arrow(ctx,rx+29,106,Math.PI/2,35,color,2);if(!before)arrow(ctx,x-9,154,-Math.PI/2,29,color,2);else arrow(ctx,lx,91,-Math.PI/2,28,color,2);}
 text(ctx,`t = ${(t*1000).toFixed(2)} ms · switch opens at 0`,w/2,280,13,'#17332f','center');
 const end=C.flybackEnd(f)*1000;
 $('scene-note').textContent=(before?'Before turn-off: the switch conducts. The current readout is the specified initial condition. ':now.i>0?f.protected?'After turn-off: current circulates upward through the diode and downward through the winding. ':'After turn-off: current uses the dashed assumed clamp path; the high opposing voltage makes it decay quickly. ':'Current has reached zero; the return path no longer conducts. ')+`For this model, current reaches zero at ${end.toFixed(2)} ms. ${f.protected?'Diode-protected switch peak: 24.7 V.':'Without diode, assumed switch peak: 144 V.'}`;
 const cases=f.compare?[true,false]:[f.protected],duration=f.window/1000;
 const build=(protectedCase,property)=>{
  const config={...f,protected:protectedCase},stop=C.flybackEnd(config),samples=points(1200,z=>[z*duration*1000,C.flyback(z*duration,config)[property]]);
  if(stop<duration){samples.push([stop*1000,property==='i'?0:f.supply],[Math.max(0,stop-1e-10)*1000,property==='i'?0:f.supply+(protectedCase?.7:f.clamp)]);samples.sort((a,b)=>a[0]-b[0]);}
  return {data:[[-1,property==='i'?f.current:0],[0,property==='i'?f.current:0],...samples],color:protectedCase?colors[0]:colors[2],dash:protectedCase?[]:[6,3]};
 };
 const legends=cases.map(on=>({label:on?'With diode · solid':'Without diode, assumed clamp · dashed',color:on?colors[0]:colors[2],dash:!on}));legend('decay',legends);legend('spike',legends);
 plot('decay',cases.map(on=>build(on,'i')),{xmin:-1,xmax:f.window,ymin:0,ymax:f.current*1.1,unit:'Time relative to opening (ms)',cursor:t*1000,event:0});
 plot('spike',cases.map(on=>build(on,'switchV')),{xmin:-1,xmax:f.window,ymin:0,ymax:155,unit:'Time relative to opening (ms)',cursor:t*1000,event:0});
 $('step').textContent=before?'Open switch':'Advance 0.1 ms';
 }
 if(tab==='phase'){
 const fld=C.field(q),sign=q.reverse?-1:1,theta=C.electricalAngle(time,q.hz);metric([['Field speed',`${sign*fld.ns} RPM`],['Rotor speed',`${(sign*fld.nr).toFixed(0)} RPM`],['Carrier / fundamental',`${(q.carrier/q.hz).toFixed(1)}×`]]);
 const cx=w<520?w/2:w*.33,cy=143,r=w<520?82:97,values=C.phases(theta,q.reverse),sum=C.resultant(values);circle(ctx,cx,cy,r+15,null);for(let k=0;k<3;k++){const angle=k*C.TAU/3;line(ctx,cx-r*Math.cos(angle),cy+r*Math.sin(angle),cx+r*Math.cos(angle),cy-r*Math.sin(angle),'#cbd5cd',1,[4,4]);arrow(ctx,cx,cy,-angle+(values[k]<0?Math.PI:0),Math.abs(values[k])*r*.72,colors[k],3);text(ctx,['U','V','W'][k],cx+(r+24)*Math.cos(angle),cy-(r+24)*Math.sin(angle)+4,14,colors[k],'center');}arrow(ctx,cx,cy,Math.atan2(-sum.y,sum.x),r,colors[3],4);
 const sx=w<520?w/2:w*.76,sy=w<520?350:137,pairs=q.poles/2;
 circle(ctx,sx,sy,48,'#e0f0e7',colors[1]);
 const fieldAngle=sign*(Math.PI/2-theta)/pairs,shaftAngle=(sign*(Math.PI/2-theta*(1-fld.slip))+sign*fld.lag)/pairs;
 arrow(ctx,sx,sy,fieldAngle,58,colors[3],2);arrow(ctx,sx,sy,shaftAngle,40,colors[1],4);
 text(ctx,'Mechanical shaft angle',sx,sy+79,13,'#17332f','center');
 text(ctx,'Blue: rotor · purple: field / pole pairs',sx,sy+99,11,'#52665f','center');
 if(w>=520){text(ctx,'Electrical field',cx,279,13,colors[3],'center');text(ctx,values.map((v,k)=>`${['U','V','W'][k]} ${v.toFixed(2)}`).join('   '),cx,300,12,'#52665f','center');}
 else text(ctx,'Electrical field · purple resultant = 1.50',cx,277,12,colors[3],'center');
 $('scene-note').textContent=`ns = 120 × ${q.hz} / ${q.poles} = ${fld.ns} RPM. ${q.type==='induction'?`Slip ${(fld.slip*100).toFixed(1)}%; rotor ${(fld.nr).toFixed(0)} RPM.`:`Synchronous rotor; electrical load angle ${(fld.lag*180/Math.PI).toFixed(1)}°.`} The three arrows are normalized current references; purple is their vector sum.`;
 const duration=span(q),samples=Math.max(800,Math.ceil(duration*q.hz*80));
 plot('phases',[0,1,2].map(k=>({data:points(samples,z=>[z*duration*1000,C.phases(C.TAU*q.hz*z*duration,q.reverse)[k]])})),{xmax:duration*1000,ymin:-1.2,ymax:1.2,unit:'Time (ms)',cursor:(time%duration)*1000});
 plot('pwm-phase',[{data:C.pwmWave(duration,q.hz,q.carrier).map(([x,y])=>[x*1000,y])},{data:points(samples,z=>[z*duration*1000,Math.sin(C.TAU*q.hz*z*duration)]),dash:[5,3]}],{xmax:duration*1000,ymin:-1.2,ymax:1.2,unit:'Time (ms)',cursor:(time%duration)*1000});
 $('scene-note').textContent+=` ${q.fit?'Automatic two-cycle window.':'Fixed time axis.'} ${(duration*1000).toFixed(1)} ms contains ${(duration*q.hz).toFixed(2)} cycles. Animation advances at 1/100 physical speed × playback setting.`;
 $('time-window').disabled=q.fit;
 }
}
function advance(dt){
 if(tab==='drive'){const n=Math.max(1,Math.ceil(dt/.002));for(let k=0;k<n;k++){C.step(state,p,dt/n);history.push([state.t,C.rpm(state.w),state.i]);}history=history.filter(d=>d[0]>=state.t-6);if(history.length>3500)history=history.filter((_,i)=>i%2===0);}
 else if(tab==='flyback'){
  if(time<0&&time+dt>=0){time=0;running=false;$('play').textContent='Play';$('status').textContent='Switch just opened. Current is continuous; voltage jumps. Press Play to follow the decay.';}
  else{time=Math.min(f.window/1000,time+dt);if(time>=f.window/1000){running=false;$('play').textContent='Play';$('status').textContent='End of the selected time window. Zoom out to follow a longer decay, or reset.';}}
 }else time+=dt;
}
$('play').onclick=()=>{if(tab==='flyback'&&time>=f.window/1000)time=-.001;running=!running;$('play').textContent=running?'Pause':'Play';$('status').textContent=running?'Running. Controls apply immediately.':'Paused. Inspect the current state.';};
$('step').onclick=()=>{
 running=false;$('play').textContent='Play';
 if(tab==='anatomy'&&a.type==='dc'){
  const dir=a.reverse?-1:1,phase=time*C.TAU/4,first=dir===1?3*Math.PI/4:Math.PI/4;
  const next=first+(Math.floor((phase-first)/Math.PI+1e-8)+1)*Math.PI;time=(next+.03)*4/C.TAU;
 }else if(tab==='anatomy'&&a.type==='bldc')time+=4/6;
 else advance(tab==='drive'?C.nextEdge(state,p):tab==='flyback'?(time<0?-time:.0001):tab==='conversion'?.001:tab==='phase'?1/(12*q.hz):1/3);
 draw();$('status').textContent=tab==='flyback'&&time===0?'Switch just opened. Current is continuous; voltage jumps.':'Paused after one step.';
};
$('reset').onclick=()=>{resetClock(tab==='flyback'?-.001:0);state=C.initial();history=[];draw();$('status').textContent='Reset to the initial state; control settings retained.';};
$('try').onclick=()=>{running=false;time=0;state=C.initial();history=[];if(tab==='drive'){p={...C.defaults,freewheel:p.freewheel,decay:p.decay,duty:p.duty,load:.08};for(let k=0;k<1500;k++){C.step(state,p,.002);history.push([state.t,C.rpm(state.w),state.i]);}p.load=.4;const saved=state,savedHistory=history;setTab(tab);state=saved;history=savedHistory;$('status').textContent='Motor pre-run for 3 s at 0.08 N·m. Load is now 0.40 N·m. Press Play to see the response.';}else if(tab==='anatomy'){a={type:'induction',load:.8,reverse:false,overlay:true};setTab(tab);}else if(tab==='conversion'){if(stage==='inverter'){v.hz=10;v.window=200;v.fit=false;}else{v.ratio=2;stage='transformer';}setTab(tab);}else if(tab==='flyback'){f.protected=false;setTab(tab);}else{q.poles=q.poles===2?4:2;setTab(tab);}$('play').textContent='Play';draw();};
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{setTab(b.dataset.tab);$('status').textContent='Paused. Change a control or press Play.';});
window.addEventListener('resize',draw);
function frame(ts){const dt=Math.min(.05,(ts-last)/1000||0);last=ts;if(running){advance(dt*+$('rate').value/(tab==='phase'||tab==='conversion'?100:tab==='flyback'?200:1));if(ts-stamp>40){draw();stamp=ts;}}requestAnimationFrame(frame);}
setTab('drive');requestAnimationFrame(frame);
})();
