'use strict';
const el=id=>document.getElementById(id);
const fmt=n=>Number(n.toPrecision(9)).toLocaleString('en-US',{maximumSignificantDigits:9});
const duration=n=>n>=1?`${fmt(n)} s`:n>=.001?`${fmt(n*1000)} ms`:`${fmt(n*1e6)} µs`;
let currentCode='',currentId=1,codeView='full';
function shownCode(){
 if(codeView==='full'||!currentCode)return currentCode;
 const start=currentCode.indexOf('ISR('),end=currentCode.indexOf('\nvoid setup()',start);
 return '// Interrupt function setup — replace the matching ISR; do not add a duplicate.\n// Requires these globals (already included in the complete sketch):\n// volatile uint16_t pendingTicks = 0;\n// volatile bool queueOverflow = false;\n// Use with the timer configuration and atomic loop in the Complete sketch.\n\n'+currentCode.slice(start,end).trim()+'\n';
}
function showCode(){el('generated-code').value=currentCode?shownCode():'No sketch generated. Choose a valid timing configuration above.';el('view-full').setAttribute('aria-pressed',codeView==='full');el('view-isr').setAttribute('aria-pressed',codeView==='isr');el('copy-code').textContent=codeView==='isr'?'Copy interrupt function':'Copy sketch';el('code-view-note').textContent=codeView==='isr'?'ISR excerpt only. Configure the timer and provide the shared globals and loop from the complete sketch. With software counting enabled, the static counter runs inside this ISR.':'Includes setup, the interrupt function, and a nonblocking loop example.';}
el('view-full').onclick=()=>{codeView='full';el('copy-status').textContent='';showCode();};
el('view-isr').onclick=()=>{codeView='isr';el('copy-status').textContent='';showCode();};
function prescalers(){const select=el('calc-prescaler'),old=select.value;select.innerHTML='<option value="auto">Auto · smallest frequency error</option>'+TimerCalculator.choices(+el('calc-timer').value).map(d=>`<option value="${d}">÷ ${d}</option>`).join('');select.value=TimerCalculator.choices(+el('calc-timer').value).includes(+old)?old:'auto';}
function invalidate(message){el('calc-error').textContent=message;el('valid-result').hidden=true;el('accuracy').hidden=true;el('copy-code').disabled=true;el('download-code').disabled=true;currentCode='';el('generated-code').value='No sketch generated. Choose a valid timing configuration above.';}
function update(){
 el('copy-status').textContent='';el('candidates').innerHTML='';el('range-note').textContent='';el('overflow-advice').hidden=true;
 const id=+el('calc-timer').value,clock=Number(el('calc-clock').value),target=Number(el('calc-target').value),unit=el('calc-unit').value;
 el('timer-conflict').textContent=[
  'Timer0 owns Arduino timekeeping. This sketch disables millis(), micros(), and delay(), and changes PWM on pins 5 and 6. Prefer Timer1 unless Timer0 is part of your experiment.',
  'Timer1 changes PWM on pins 9 and 10. Do not use it alongside Servo or another library that owns Timer1.',
  'Timer2 changes PWM on pins 3 and 11. Do not use it alongside tone() or another library that owns Timer2.'
 ][id];
 try{
  if(!Number.isFinite(target)||target<=0)throw Error('Enter a target value greater than zero.');
  const seconds=target*({s:1,ms:.001,us:.000001}[unit]||1),frequency=unit==='hz'?target:1/seconds;
  const result=TimerCalculator.calculate({id,clock,frequency,software:el('calc-software').checked});
  if(frequency<result.min){
   el('overflow-advice').hidden=false;
   const alternative=TimerCalculator.calculate({id:1,clock,frequency}).best;
   el('use-timer1').hidden=id===1||!alternative;
   el('use-software').hidden=el('calc-software').checked;
   el('overflow-explanation').textContent=`Even at /1024, this interval needs ${fmt(clock/1024/frequency)} ticks; Timer${id} can hold only ${id===1?'65,536':'256'} count intervals per cycle. `+(id!==1&&alternative?`Timer1 can achieve ${duration(alternative.period)} with /${alternative.divisor} and OCR1A = ${alternative.ocr}. `:'Even the 16-bit timer cannot fit this interval in one cycle. ')+`Alternatively, count shorter timer interrupts inside the ISR and run the task only after the required number. This avoids trying to store an oversized value in OCRnA.`;
  }
  const selected=el('calc-prescaler').value==='auto'?result.best:result.rows.find(r=>r.divisor===+el('calc-prescaler').value&&r.valid);
  el('candidates').innerHTML=result.rows.map(r=>r.valid?`<tr class="${r===selected?'selected':''}"><td>÷ ${r.divisor}</td><td>${r.ocr.toLocaleString()}</td><td>${r.softwareCount.toLocaleString()}</td><td>${fmt(r.actual)} Hz</td><td>${r.exact?'0':fmt(r.error)}%</td><td><button type="button" data-divider="${r.divisor}" aria-label="Use prescaler ${r.divisor}" aria-pressed="${r===selected}">${r===selected?'Selected':r===result.best?'Best fit':'Use'}</button></td></tr>`:`<tr class="unavailable"><td>÷ ${r.divisor}</td><td colspan="5">Out of range · ${fmt(r.min)}–${fmt(r.max)} Hz</td></tr>`).join('');
  el('range-note').textContent=`Timer${id} range across all prescalers: ${fmt(result.min)}–${fmt(result.max)} Hz (one interrupt per cycle; CPU service limits still apply).`;
  if(!selected){invalidate(result.best?'This prescaler cannot represent the requested timing. Select Auto or a valid row below.':`The requested timing is outside the available range. ${frequency<result.min?"Use Timer1 or enable an ISR software counter below. Extremely long intervals may exceed the 32-bit software counter too.":"Reduce the requested frequency; software counting cannot make interrupts faster than the hardware clock."}`);return;}
  currentId=id;el('calc-error').textContent='';el('valid-result').hidden=false;el('accuracy').hidden=false;el('accuracy').className='accuracy'+(selected.exact?'':' rounded');el('accuracy').textContent=selected.exact?'Exact nominal match':'Rounded to a timer tick';
  el('actual-period').textContent=duration(selected.period);el('actual-frequency').textContent=`${fmt(selected.actual)} task events / second`;
  el('ocr-label').textContent=`OCR${id}A · compare register`;el('ocr-value').textContent=selected.ocr.toLocaleString();el('ocr-hex').textContent=`0x${selected.ocr.toString(16).toUpperCase().padStart(id===1?4:2,'0')} · ${selected.ticks.toLocaleString()} ticks per cycle`;
  el('actual-divider').textContent=`÷ ${selected.divisor}`;el('actual-error').textContent=(selected.exact?'0':(selected.error>0?'+':'')+fmt(selected.error))+' %';el('actual-tick').textContent=duration(selected.divisor/clock);
  el('software-detail').hidden=selected.softwareCount===1;el('software-detail').textContent=`Count ${selected.softwareCount.toLocaleString()} interrupts in the ISR. Hardware interrupt interval: ${duration(1/selected.interruptRate)} (${fmt(selected.interruptRate)} Hz). Task interval: ${selected.softwareCount.toLocaleString()} × ${duration(1/selected.interruptRate)} = ${duration(selected.period)}. The simulator link shows the hardware timer only; it does not execute the ISR counter.`;
  el('calc-equation').textContent=`(${selected.ocr.toLocaleString()} + 1) × ${selected.divisor} × ${selected.softwareCount} / ${clock.toLocaleString()} Hz = ${duration(selected.period)}. Requested: ${duration(1/frequency)} (${fmt(frequency)} Hz).`;
  const cycles=selected.divisor*selected.ticks;el('capacity-note').hidden=cycles>=1600;el('capacity-note').textContent=`Only ${cycles.toLocaleString()} CPU cycles per interrupt. The timer can count this fast, but this sketch may not service every event. Reduce the rate or use hardware output compare for fast signals.`;
  el('try-simulator').href=`timer.html?${new URLSearchParams({id,mode:'ctc',divisor:selected.divisor,hz:clock,preload:0,a:selected.ocr,b:Math.floor(selected.ocr/2)})}`;
  currentCode=TimerCalculator.sketch(result,selected);showCode();el('copy-code').disabled=false;el('download-code').disabled=false;
 }catch(error){invalidate(error.message);}
}
el('calculator-form').onsubmit=e=>e.preventDefault();el('calculator-form').addEventListener('input',update);
el('use-timer1').onclick=()=>{el('calc-timer').value='1';el('calc-prescaler').value='auto';prescalers();update();};
el('use-software').onclick=()=>{el('calc-software').checked=true;el('calc-prescaler').value='auto';update();};
el('calc-timer').addEventListener('change',()=>{prescalers();update();});
el('calculator-form').addEventListener('change',update);
for(const button of document.querySelectorAll('[data-seconds]'))button.onclick=()=>{const s=+button.dataset.seconds;el('calc-target').value=s===.001?'1000':s;el('calc-unit').value=s===.001?'hz':'s';update();};
el('candidates').onclick=e=>{const button=e.target.closest('[data-divider]');if(button){el('calc-prescaler').value=button.dataset.divider;update();}};
el('copy-code').onclick=async()=>{if(!currentCode)return;try{await navigator.clipboard.writeText(shownCode());el('copy-status').textContent=codeView==='isr'?'Interrupt function copied. Merge it with the complete sketch setup and shared globals.':'Sketch copied. Paste into a new Arduino sketch.';}catch{el('generated-code').focus();el('generated-code').select();el('copy-status').textContent='Automatic clipboard access is unavailable. The sketch is selected; press Ctrl+C (or ⌘C) to copy.';}};
el('download-code').onclick=()=>{if(!currentCode)return;const url=URL.createObjectURL(new Blob([currentCode],{type:'text/plain'})),a=document.createElement('a');a.href=url;a.download=`Timer${currentId}_CTC.ino`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);el('copy-status').textContent='Arduino sketch download requested.';};
prescalers();update();
// Browsers can restore form fields after scripts run when navigating Back.
window.addEventListener('pageshow',()=>{prescalers();update();});
