'use strict';
const $=id=>document.getElementById(id),hex=n=>'0x'+n.toString(16).toUpperCase().padStart(4,'0');
let lab=new InterruptLab(),playing=null;
const ms=n=>(n/16000).toFixed(4)+' ms';
function stop(){clearTimeout(playing);playing=null;$('play').textContent='▶ Play';}
function reset(c=lab.c){stop();lab=new InterruptLab(c);render();}
function render(){
 const s=lab.s,c=lab.c;
 const durationMs=cycles=>Number((cycles/c.hz*1000).toFixed(7))+' ms';
 $('duration-settings').textContent=`prescaler /${c.divisor} · OCR1A = ${c.top}`;
 $('compare-ms').textContent=durationMs(lab.period);
 $('reach-ms').textContent=`Time to reach OCR1A from 0: ${durationMs(c.top*c.divisor)}`;
 $('compare-formula').textContent=`(${c.top} + 1) × ${c.divisor} ÷ 16,000,000 seconds`;
 $('body-ms').textContent=durationMs(c.isrCycles);
 $('body-formula').textContent=`${c.isrCycles.toLocaleString('en-US')} CPU cycles ÷ 16,000,000 seconds`;
 const ratio=c.isrCycles/lab.period;
 $('duration-verdict').textContent=ratio>1?`ISR body is ${Number(ratio.toFixed(3))}× the timer interval. Another timer event can occur before the ISR finishes.`:ratio===1?'ISR body equals the timer interval. Entry and return take additional time.':`ISR body uses ${Number((ratio*100).toFixed(3))}% of one timer interval. The remaining ${durationMs(lab.period-c.isrCycles)} must also cover interrupt overhead before main-program work.`;
 $('duration-verdict').classList.toggle('over-interval',ratio>=1);
 $('count').textContent=s.count;$('counter').max=c.top+1;$('counter').value=s.count;
 $('compare').textContent=c.top;
 const equal=s.count===c.top;$('comparison').textContent=equal?'=':'≠';
 $('count-box').classList.toggle('equal',equal);$('compare-box').classList.toggle('equal',equal);
 $('flag').textContent=s.flag?'1 · pending':'0';$('flag-box').classList.toggle('pending',s.flag);
 $('gate').textContent=Number(s.mask)+' & '+Number(s.i);$('cpu').textContent={main:'Main program',entry:'Vector jump',isr:'ISR body',return:'RETI'}[s.cpu];
 $('explanation').textContent=s.message;$('global').checked=s.i;$('global').disabled=s.cpu!=='main';$('mask').checked=s.mask;
 $('pc').textContent=c.longView&&['isr','return'].includes(s.cpu)?(s.cpu==='isr'?'CPU executing ISR work block':'CPU executing RETI'):'PC '+hex(s.pc)+(s.mainProgress?' · instruction in progress':'');$('stack').textContent=s.stack.length?'Saved PC '+hex(s.stack[0]):'Stack empty';
 $('main-loops').textContent=Math.floor(s.mainInstructions/3).toLocaleString('en-US')+' main-loop passes completed';
 const mainPC=c.longView&&s.cpu!=='main'?s.stack[0]:s.pc;
 $('main-code').innerHTML=['Read inputs','Update main work','Repeat main loop'].map((v,i)=>`<div class="code-row ${mainPC===0x40+i*2&&(s.cpu==='main'||c.longView)?(s.cpu==='main'?'active':'paused-line'):''}">${hex(0x40+i*2)} · ${v}</div>`).join('');
 const isrRows=c.longView?
 [['entry','0x0016 · JMP ISR','Compare A vector · enter ISR'],['isr','ISR work block',`Many instructions or a repeated loop · ${Number((c.isrCycles/c.hz*1000).toFixed(7))} ms total, then toggle LED`],['return','RETI','Return to the saved main-program address']]:
 [['entry','0x0016 · JMP ISR','Compare A vector'],['isr','0x0100 · ISR body','Work, then toggle LED'],['return','0x0102 · RETI','Resume saved PC']];
 $('isr-code').innerHTML=isrRows.map(([p,v,d])=>`<div class="code-row ${s.cpu===p?'active':''}">${v}<small>${d}</small></div>`).join('');
 $('led').classList.toggle('on',s.led);$('led-state').textContent=s.led?'on':'off';
 $('time').textContent=ms(s.cycles);$('events').textContent=s.events;$('services').textContent=s.services;$('merged').textContent=s.merged;
 $('back').disabled=!lab.undo.length;$('next').disabled=!s.mask||(!s.i&&s.cpu==='main');
 $('timing').textContent=`Compare interval: (${c.top} + 1) × ${c.divisor} / 16 MHz = ${ms(lab.period)}. ISR body: ${ms(c.isrCycles)}.`;
 $('trace').innerHTML=s.trace.map(e=>`<li>${ms(e.cycles)} · ${e.label}${e.duration?' ('+e.duration+' cycles)':''}</li>`).join('');
 const cs={1:1,8:2,64:3,256:4,1024:5}[c.divisor];
 $('code').textContent=`// Setup excerpt; Timer1 is used exclusively.\nnoInterrupts();\nTCCR1A = 0;\nTCCR1B = 0;\nTIMSK1 = 0;\nTCNT1 = 0;\nOCR1A = ${c.top};\nTIFR1 = (1 << OCF1A); // clear stale flag\nTIMSK1 = (1 << OCIE1A);\nTCCR1B = (1 << WGM12) | ${cs}; // CTC, /${c.divisor}\ninterrupts();\n\nISR(TIMER1_COMPA_vect) {\n  // Perform brief periodic work here.\n}`;
 $('work-block-note').hidden=!c.longView;
 $('long-view').hidden=!c.longView;$('next').hidden=!!c.longView;
 if(c.longView)longTimeline();
 plot();
}
function plot(){
 const s=lab.s,end=Math.max(lab.period,s.cycles),start=Math.max(0,end-lab.period*3),width=end-start;
 const x=t=>60+800*(t-start)/width,y=n=>135-105*n/Math.max(1,lab.c.top);
 let svg=`<defs><clipPath id="window"><rect x="60" y="15" width="800" height="170"/></clipPath></defs><text x="65" y="17" font-size="12" fill="#a44c1b">OCR1A = ${lab.c.top} · compare value</text><text x="30" y="139" font-size="12">0</text><text x="10" y="174" font-size="12">CPU</text><path d="M60 25H860 M60 135H860" stroke="#cbd5cd"/><path d="M60 30H860" stroke="#a44c1b" stroke-dasharray="5 4"/>`;
 svg+='<g clip-path="url(#window)">';
 for(let t=(Math.floor(start/lab.period)+1)*lab.period;t<=end;t+=lab.period)svg+=`<path d="M${x(t)} 20V145" stroke="#c98a3b" stroke-dasharray="3 4"/>`;
 svg+=`<polyline points="${s.points.map(p=>`${x(p.cycles)},${y(p.count)}`).join(' ')}" fill="none" stroke="#086b54" stroke-width="2.5"/>`;
 for(const e of s.trace.filter(e=>e.duration))svg+=`<rect x="${x(e.start)}" y="158" width="${Math.max(.5,800*e.duration/width)}" height="20" fill="${e.label==='Main program'?'#086b54':'#355c93'}"><title>${e.label}: ${e.duration} cycles</title></rect>`;
 svg+='</g>';svg+=`<text x="60" y="201" font-size="12">${ms(start)}</text><text x="860" y="201" text-anchor="end" font-size="12">${ms(end)}</text>`;$('plot').innerHTML=svg;
 $('range').textContent=`Window ${ms(start)}–${ms(end)} · green: main program · blue: interrupt entry, vector, ISR and return.`;
}
function longTimeline(){
 const s=lab.s,c=lab.c,paused=s.cpu!=='main';
 $('long-summary').textContent=`Compare events occur every ${ms(lab.period)}. The ISR body takes ${ms(c.isrCycles)}; the main program waits while the CPU executes it. Step through each event to watch the pending flag.`;
 $('main-status').textContent=paused?'PAUSED at '+hex(s.stack[0]):s.mustMain?'RESUMED · next instruction':'RUNNING';
 $('main-status').className=paused?'paused-text':'running-text';
 $('isr-status').textContent=s.cpu==='isr'?ms(s.isrRemaining)+' remaining':s.cpu==='return'?'Body complete · RETI next':s.cpu==='entry'?'Starting · vector jump next':s.services?'Waiting for next interrupt':'Not started';
 $('isr-progress').max=c.isrCycles;$('isr-progress').value=s.cpu==='isr'?c.isrCycles-s.isrRemaining:s.cpu==='return'?c.isrCycles:0;
 $('pending-status').textContent=s.flag?'1 request pending':'No pending request';
 const end=Math.max(lab.period*4,s.cycles),start=Math.max(0,end-lab.period*4),w=end-start;
 const x=t=>140+730*(t-start)/w;
 let svg=`<defs><clipPath id="long-window"><rect x="140" y="25" width="730" height="215"/></clipPath></defs><text x="12" y="60">Main program</text><text x="12" y="120">ISR / entry / return</text><text x="12" y="190">Timer1</text><text x="12" y="210" font-size="11">0 to OCR1A</text>`;
 svg+='<g clip-path="url(#long-window)">';
 const spans=[];
 for(const e of s.trace.filter(e=>e.duration).slice().reverse()){
  const main=e.label==='Main program',last=spans[spans.length-1];
  if(last&&last.main===main&&last.cycles===e.start)last.cycles=e.cycles;
  else spans.push({main,start:e.start,cycles:e.cycles});
 }
 for(const e of spans){
  const main=e.main,left=Math.max(140,x(e.start)),right=Math.min(870,x(e.cycles)),width=right-left;
  if(width<=0)continue;
  svg+=`<rect x="${left}" y="38" width="${width}" height="30" fill="${main?'#086b54':'#f3dec3'}"/><rect x="${left}" y="98" width="${width}" height="30" fill="${main?'#e8e9e4':'#355c93'}"/>`;
  if(width>75)svg+=`<text x="${left+width/2}" y="58" text-anchor="middle" fill="${main?'white':'#754015'}" font-size="12">${main?'RUNNING':'PAUSED'}</text><text x="${left+width/2}" y="118" text-anchor="middle" fill="${main?'#52665f':'white'}" font-size="12">${main?'Waiting':'CPU in ISR'}</text>`;
 }
 svg+=`<polyline points="${s.points.map(p=>`${x(p.cycles)},${225-65*p.count/Math.max(1,c.top)}`).join(' ')}" fill="none" stroke="#086b54" stroke-width="2"/>`;
 for(let t=(Math.floor(start/lab.period)+1)*lab.period;t<=Math.min(end,s.cycles);t+=lab.period)svg+=`<path d="M${x(t)} 28V233" stroke="#a44c1b" stroke-dasharray="4 3"/><circle cx="${x(t)}" cy="232" r="4" fill="#a44c1b"/>`;
 svg+=`<path d="M${x(s.cycles)} 25V238" stroke="#17332f" stroke-width="2"/></g>`;
 for(let i=0;i<=4;i++){const t=start+w*i/4;svg+=`<text x="${x(t)}" y="260" text-anchor="${i===0?'start':i===4?'end':'middle'}" font-size="12">${ms(t)}</text>`;}
 $('long-timeline').innerHTML=svg;
}
$('step').onclick=()=>{stop();lab.step();render();};
$('back').onclick=()=>{stop();lab.back();render();};
$('reset').onclick=()=>reset();
$('play').onclick=()=>{if(playing){stop();return;}function run(){lab.step();render();$('play').textContent='Ⅱ Pause';playing=setTimeout(run,Math.max(Number($('speed').value),lab.c.longView?1200:0,lab.s.count===lab.c.top?1400:0));}run();};
$('next').onclick=()=>{stop();const target=lab.s.services+1;for(let i=0;i<20&&lab.s.services<target;i++)lab.step();render();};
$('global').onchange=()=>{stop();lab.toggle('i');render();};$('mask').onchange=()=>{stop();lab.toggle('mask');render();};
$('settings').oninput=()=>{$('dirty').hidden=false;};
$('settings').onsubmit=e=>{e.preventDefault();try{const c={divisor:Number($('divisor').value),top:Number($('top').value),isrCycles:Number($('duration').value),longView:lab.c.longView};const fresh=new InterruptLab(c);stop();lab=fresh;$('error').textContent='';$('dirty').hidden=true;render();}catch(err){$('error').textContent=err.message;}};
$('answer').onclick=()=>{$('answer-text').hidden=!$('answer-text').hidden;};
document.querySelectorAll('[data-demo]').forEach(b=>b.onclick=()=>{
 const demo=b.dataset.demo;reset({divisor:8,top:12499,isrCycles:demo==='long'?240000:1600,longView:demo==='long'});
 if(demo==='long')lab.s.message='The main program is running. Step forward: when the ISR begins, the main program will pause while Timer1 keeps counting.';
 if(demo==='disabled'){lab.s.i=false;lab.s.message='Global interrupts are disabled. Step to a compare event, then enable I and step again.';}
 $('divisor').value=8;$('top').value=12499;$('duration').value=lab.c.isrCycles;$('dirty').hidden=true;$('error').textContent='';
 $('question').textContent=demo==='long'?'If several matches occur during the ISR, will every match produce another ISR call?':'If I = 0, will the timer stop or will only interrupt servicing stop?';
 $('answer-text').textContent=demo==='long'?'The pending flag holds one request. Further events while it is already set do not create a queue. Watch the event and ISR-entry totals diverge.':'The timer continues and the compare flag can become set. Both enable bits must be set before the CPU services it.';
 $('answer-text').hidden=true;document.querySelectorAll('[data-demo]').forEach(el=>el.setAttribute('aria-pressed',el===b));render();
});
render();
