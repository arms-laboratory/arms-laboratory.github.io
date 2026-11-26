'use strict';
const $=id=>document.getElementById(id),{Timer,divisors}=AVRTimer;
const presets=[
 {id:0,mode:'normal',divisor:64,preload:250,a:128,b:64,reload:false},
 {id:0,mode:'ctc',divisor:64,preload:0,a:9,b:4,reload:false},
 {id:1,mode:'normal',divisor:1024,preload:49911,a:0,b:0,reload:false},
 {id:1,mode:'ctc',divisor:1024,preload:0,a:15624,b:7812,reload:false}
];
const lessons=[
 [['Start near the limit','TCNT0 starts at 250. Timer0 is 8 bit, so its maximum is 255. Predict how many timer ticks are needed for overflow.'],['Six ticks to overflow','Select Next event: after six ticks, 255 rolls to 0 and TOV0 becomes 1. At 16 MHz with /64, six ticks take 24 µs.'],['The flag remembers','Clear TOV0 by selecting its flag button. The next overflow takes a full 256 ticks (1.024 ms), because hardware restarts at zero.']],
 [['Choose your TOP','OCR0A = 9 sets TOP in CTC. The counter visits 0 through 9: ten count intervals per cycle, not nine.'],['Compare B observes','Select Next event. OCR0B = 4 raises OCF0B on the following timer edge, but does not reset the counter.'],['Compare A clears','Select Next event again. Compare A sets OCF0A and clears TCNT0. A complete cycle takes 10 × 4 µs = 40 µs. TOV0 remains clear.']],
 [['A one-second first interval','16 MHz / 1024 = 15,625 timer ticks per second. Load TCNT1 = 65,536 − 15,625 = 49,911 (0xC2F7).'],['Jump to the overflow','Select Next event to advance exactly 15,625 ticks: the first overflow occurs at 1 s. TCNT1 then returns to zero.'],['Make it repeat','Without a reload, later overflows take 4.194304 s. In the experiment lab, enable software reload and apply to repeat the ideal one-second interval. Real software adds latency.']],
 [['A one-second repeating interval','In Timer1 CTC mode, OCR1A = 15,624 (0x3D08). Each cycle takes OCR1A + 1 = 15,625 ticks at 64 µs each.'],['Compare B is independent','Next event first reaches compare B at tick 7,813. It sets OCF1B without clearing TCNT1.'],['One second, automatically','Next event then reaches compare A at tick 15,625, or 1 s. TCNT1 clears to zero automatically, so the one-second cycle repeats without a software reload.']]
];
let timer=new Timer(presets[0]),running=false,last=0,credit=0,lesson=0;
const hex=(n,width=2)=>'0x'+n.toString(16).toUpperCase().padStart(width,'0');
const time=s=>s===0?'0 s':s<.001?`${+(s*1e6).toFixed(6)} µs`:s<1?`${+(s*1e3).toFixed(6)} ms`:`${+s.toFixed(9)} s`;
function pause(){running=false;$('play').textContent='▶ Play';}
function clocks(id,value){$('prescaler').innerHTML=divisors(id).map(v=>`<option value="${v}">${v?'÷ '+v+(v===1?' · no prescaling':''):'Stopped · CS = 000'}</option>`).join('');$('prescaler').value=divisors(id).includes(value)?value:64;}
function populate(c){$('timer').value=c.id;$('timer-mode').value=c.mode;$('frequency').value=16;clocks(c.id,c.divisor);$('preload').value=c.preload;$('compare-a').value=c.a;$('compare-b').value=c.b;$('reload').checked=c.reload;$('reload').disabled=c.mode==='ctc';$('dirty').hidden=true;$('settings-error').textContent='';}
function loadDemo(){pause();lesson=0;const p=presets[+$('demo').value];timer=new Timer(p);populate(p);showLesson();render();}
function showLesson(){const ls=lessons[+$('demo').value];$('lesson-step').textContent=`${lesson+1} / 3`;$('lesson-title').textContent=ls[lesson][0];$('lesson-text').textContent=ls[lesson][1];$('lesson-next').textContent=lesson===2?'Back to first explanation ↺':'Next explanation →';}
function parse(id,max){const s=$(id).value.trim();if(!/^(?:\d+|0x[0-9a-f]+)$/i.test(s)||!Number.isSafeInteger(Number(s))||Number(s)>max)throw Error(`Use an integer from 0 to ${max} for ${$(id).parentElement.firstChild.textContent.trim()}.`);return Number(s);}
$('settings-form').onsubmit=e=>{e.preventDefault();try{const id=+$('timer').value,max=id===1?65535:255,hz=+$('frequency').value*1e6;if(hz<1000||hz>20000000)throw Error('Choose a clock from 0.001 to 20 MHz.');const c={id,mode:$('timer-mode').value,divisor:+$('prescaler').value,hz,preload:parse('preload',max),a:parse('compare-a',max),b:parse('compare-b',max),reload:$('reload').checked&&$('timer-mode').value==='normal'};const next=new Timer(c);pause();timer=next;$('dirty').hidden=true;$('settings-error').textContent='';setMode(false);render();}catch(err){$('settings-error').textContent=err.message;}};
$('timer').onchange=()=>clocks(+$('timer').value,+$('prescaler').value);
$('timer-mode').onchange=()=>{$('reload').disabled=$('timer-mode').value==='ctc';};
$('settings-form').addEventListener('input',()=>{$('dirty').hidden=false;});
function setMode(guided){$('demo-panel').hidden=!guided;$('guided').setAttribute('aria-pressed',guided);$('lab').setAttribute('aria-pressed',!guided);}
$('guided').onclick=()=>{setMode(true);loadDemo();};$('lab').onclick=()=>setMode(false);
$('demo').onchange=loadDemo;$('restart-demo').onclick=loadDemo;$('lesson-next').onclick=()=>{lesson=(lesson+1)%3;showLesson();};
$('play').onclick=()=>{if(running)pause();else if(timer.c.divisor){running=true;credit=0;last=performance.now();$('play').textContent='Ⅱ Pause';}};
$('tick').onclick=()=>{pause();timer.tick();render();};$('event').onclick=()=>{pause();timer.nextEvent();render();};$('reset').onclick=()=>{pause();timer.reset(timer.c);render();};
function register(name,value,description,labels,width=2){return `<div class="reg"><div class="reg-title"><strong>${name}</strong><span>${hex(value,width)}</span></div>${labels?'<div class="bit-row">'+labels.map((label,i)=>`<span class="bit ${(value&(1<<(7-i)))?'on':''}"><small>${label}</small>${(value>>(7-i))&1}</span>`).join('')+'</div>':`<code>${value.toString(2).padStart(width*4,'0').match(/.{1,8}/g).join(' ')} · ${value}</code>`}<p>${description}</p></div>`;}
function render(){
 const t=timer,c=t.c,n=c.id,w=n===1?4:2,top=c.mode==='ctc'?c.a:t.max;
 $('clock-label').textContent=`${c.hz/1e6} MHz`;$('divider-label').textContent=c.divisor?'÷ '+c.divisor:'Stopped';$('counter-label').textContent=`TCNT${n} · ${n===1?16:8} bit`;$('count').textContent=t.count;$('count-hex').textContent=hex(t.count,w);$('top-label').textContent=c.mode==='ctc'?`TOP · OCR${n}A`:'TOP · MAX';$('top').textContent=top;
 $('elapsed').textContent=time(t.ticks*t.tickSeconds);$('period').textContent=c.divisor?time(t.tickSeconds):'No clock';$('ticks').textContent=t.ticks.toLocaleString();
 for(const id of ['play','tick','event'])$(id).disabled=!c.divisor;
 const recent=t.events.filter(e=>e.tick===t.ticks).map(e=>e.name).join(' + ');
 $('live-explanation').textContent=!c.divisor?'Clock stopped: CS bits are 000. The counter and flags hold their values.':recent?`Tick ${t.ticks}: ${recent}. TCNT${n} is now ${t.count}.`:t.count===c.a?`TCNT${n} equals OCR${n}A. On the next timer edge, OCF${n}A will be set${c.mode==='ctc'?' and the counter will clear':''}.`:`TCNT${n} = ${t.count}. ${c.mode==='ctc'?`Compare A controls clearing; compare B only sets a flag.`:`The counter increments toward ${t.max}; overflow returns it to zero.`}`;
 const aLabels=[`COM${n}A1`,`COM${n}A0`,`COM${n}B1`,`COM${n}B0`,'—','—',`WGM${n}1`,`WGM${n}0`];
 const bLabels=n===1?['ICNC1','ICES1','—','WGM13','WGM12','CS12','CS11','CS10']:[`FOC${n}A`,`FOC${n}B`,'—','—',`WGM${n}2`,`CS${n}2`,`CS${n}1`,`CS${n}0`];
 const bytes=v=>n===1?` High byte ${hex(v>>8)} · low byte ${hex(v&255)}.`:'';
 $('registers').innerHTML=register(`TCCR${n}A`,t.controlA,'Waveform mode bits; output pins are not modeled.',aLabels)+register(`TCCR${n}B`,t.controlB,`WGM = ${c.mode==='ctc'?(n===1?'0100 (mode 4)':'010 (mode 2)'):(n===1?'0000':'000')}; CS = ${(t.controlB&7).toString(2).padStart(3,'0')}.`,bLabels)+register(`TCNT${n}`,t.count,'Current counter.'+bytes(t.count),null,w)+register(`OCR${n}A`,c.a,(c.mode==='ctc'?'Compare A also defines TOP.':'Compare A does not clear the counter.')+bytes(c.a),null,w)+register(`OCR${n}B`,c.b,'Compare B sets OCF only; it never defines TOP.'+bytes(c.b),null,w)+register(`TIFR${n}`,t.flags,'Sticky event flags. Write one to clear; writing zero leaves a flag unchanged.',['—','—',n===1?'ICF1':'—','—','—',`OCF${n}B`,`OCF${n}A`,`TOV${n}`]);
 $('flag-buttons').innerHTML=[[1,`TOV${n}`],[2,`OCF${n}A`],[4,`OCF${n}B`]].map(([mask,name])=>`<button data-mask="${mask}" class="${t.flags&mask?'flag-set':''}" aria-label="Write one to clear ${name}">${name} = ${t.flags&mask?1:0} · clear</button>`).join('');
 const first=t.max+1-c.preload,repeat=c.reload?first:t.max+1;
 $('formula').textContent=!c.divisor?'Select a clock source to calculate timing.':c.mode==='ctc'?`Tick = ${c.divisor} / ${c.hz.toLocaleString()} Hz = ${time(t.tickSeconds)}. Repeating compare A interval = (${c.a} + 1) ticks × ${time(t.tickSeconds)} = ${time((c.a+1)*t.tickSeconds)}.`:`First overflow = (${t.max+1} − ${c.preload}) × ${time(t.tickSeconds)} = ${time(first*t.tickSeconds)}. Later overflows ${c.reload?'with ideal software reload':'from zero'}: ${repeat.toLocaleString()} ticks = ${time(repeat*t.tickSeconds)}.`;
 $('warning').textContent=c.mode==='ctc'&&c.preload>c.a?'Initial TCNT exceeds TOP: the counter must wrap at MAX before it can reach compare A. The first interval differs from the repeating interval.':c.mode==='ctc'&&c.b>c.a?'OCRnB exceeds TOP: compare B will not occur during steady CTC cycles.':c.mode==='ctc'&&c.preload>0?'A nonzero initial counter shortens the first cycle; the formula shows subsequent cycles.':c.mode==='normal'&&c.reload?'Reload is software, modeled with zero delay. A real program must account for execution latency.':'';
 $('totals').textContent=`Compare A: ${t.totals.a} · Compare B: ${t.totals.b} · Overflows: ${t.totals.overflow}`;
 $('events').innerHTML=t.events.length?t.events.map(e=>`<li>${time(e.tick*t.tickSeconds)} · tick ${e.tick} · ${e.name}</li>`).join(''):'<li>No events yet.</li>';
 plot();
}
$('flag-buttons').onclick=e=>{const b=e.target.closest('[data-mask]');if(b){pause();timer.clear(+b.dataset.mask);render();}};
function plot(){const h=timer.history,lo=h[0].tick,span=Math.max(20,h.at(-1).tick-lo),max=Math.max(1,timer.c.mode==='ctc'?timer.c.a:timer.max,...h.map(p=>p.count)),x=v=>55+(v-lo)/span*785,y=v=>180-v/max*155;let path=`M ${x(h[0].tick)} ${y(h[0].count)}`;for(let i=1;i<h.length;i++)path+=` H ${x(h[i].tick)} V ${y(h[i].count)}`;const top=timer.c.mode==='ctc'?timer.c.a:timer.max;$('plot').innerHTML=`<line x1="55" y1="180" x2="840" y2="180" stroke="#a6b7a9"/><line x1="55" y1="25" x2="55" y2="180" stroke="#a6b7a9"/><line x1="55" y1="${y(top)}" x2="840" y2="${y(top)}" stroke="#a44c1b" stroke-dasharray="5 5"/><text x="5" y="${y(top)+4}">${top}</text><text x="30" y="184">0</text><text x="55" y="205">${lo}</text><text x="800" y="205">${lo+span}</text><path d="${path}" fill="none" stroke="#086b54" stroke-width="2.5"/>`+h.filter(p=>p.event).map(p=>`<circle cx="${x(p.tick)}" cy="${y(p.count)}" r="3.5" fill="#a44c1b"/>`).join('');$('plot-range').textContent=`Tick ${lo}–${h.at(-1).tick} · current counter ${timer.count}`;}
function frame(now){if(running){credit+=Math.min((now-last)/1000,.1)*+$('speed').value;const steps=Math.floor(credit);credit-=steps;for(let i=0;i<steps;i++)timer.tick();if(steps)render();}last=now;requestAnimationFrame(frame);}
populate(presets[0]);showLesson();render();requestAnimationFrame(frame);

// Optional calculator handoff; validate all values before loading a fresh run.
const calculatorParams = new URLSearchParams(location.search);
if (calculatorParams.has('id')) {
 try {
  const config = {id:Number(calculatorParams.get('id')), mode:calculatorParams.get('mode'), divisor:Number(calculatorParams.get('divisor')), hz:Number(calculatorParams.get('hz')), preload:Number(calculatorParams.get('preload')), a:Number(calculatorParams.get('a')), b:Number(calculatorParams.get('b')), reload:false};
  timer = new Timer(config);
  populate(config); $('frequency').value = config.hz / 1e6; setMode(false); render();
 } catch { $('settings-error').textContent = 'The calculator link contains invalid timer settings. Default settings are shown.'; }
}
