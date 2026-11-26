(function(root){
'use strict';
const choices=id=>id===2?[1,8,32,64,128,256,1024]:[1,8,64,256,1024];
function calculate({id=1,clock=16000000,frequency=1,software=false}={}){
 if(![0,1,2].includes(id)||!Number.isInteger(clock)||clock<1000||clock>20000000||!Number.isFinite(frequency)||frequency<=0)throw Error('Enter a positive frequency and a whole-number clock from 1,000 to 20,000,000 Hz.');
 const max=id===1?65536:256;
 const rows=choices(id).map((divisor,index)=>{
  const ideal=clock/divisor/frequency;
  if(ideal>max&&software){
   let best=null;
   // Search all hardware counts; choose the nearest whole software divider.
   for(let ticks=max;ticks>=1;ticks--){
    const count=Math.round(ideal/ticks);
    if(count<2||count>4294967295)continue;
    const actual=clock/divisor/ticks/count,error=(actual-frequency)/frequency*100;
    if(!best||Math.abs(error)<Math.abs(best.error)-1e-12)best={divisor,valid:true,ticks,ocr:ticks-1,actual,period:1/actual,error,cs:index+1,exact:Math.abs(error)<1e-9,softwareCount:count,interruptRate:clock/divisor/ticks};
   }
   if(best)return best;
  }
  if(ideal<1-1e-10||ideal>max+1e-10)return {divisor,valid:false,min:clock/divisor/max,max:clock/divisor};
  const candidates=[Math.max(1,Math.min(max,Math.floor(ideal))),Math.max(1,Math.min(max,Math.ceil(ideal)))];
  const ticks=candidates.sort((a,b)=>Math.abs(clock/divisor/a-frequency)-Math.abs(clock/divisor/b-frequency))[0];
  const actual=clock/divisor/ticks,error=(actual-frequency)/frequency*100;
  return {divisor,valid:true,ticks,ocr:ticks-1,actual,period:1/actual,error,cs:index+1,exact:Math.abs(error)<1e-9,softwareCount:1,interruptRate:actual};
 });
 const best=rows.filter(r=>r.valid).sort((a,b)=>{const delta=Math.abs(a.error)-Math.abs(b.error);return Math.abs(delta)>1e-12?delta:(software?a.interruptRate-b.interruptRate:0)||a.divisor-b.divisor;})[0]||null;
 return {id,clock,frequency,software,rows,best,min:clock/1024/max,max:clock};
}
function sketch(result,row){
 if(!row||!row.valid)throw Error('A valid timer configuration is required.');
 const n=result.id,cs=[0,1,2].filter(i=>row.cs&(1<<i)).map(i=>`_BV(CS${n}${i})`).join(' | ');
 const mode=n===1?'_BV(WGM12)':`_BV(WGM${n}1)`;
 return `// ATmega328P · Timer${n} CTC interrupt example
// Target task rate: ${result.frequency.toPrecision(9)} Hz; nominal: ${row.actual.toPrecision(9)} Hz
// Period: ${(row.period*1000).toPrecision(9)} ms; frequency error: ${row.error.toPrecision(6)} %
// Hardware interrupts: ${row.interruptRate.toPrecision(9)} Hz; task every ${row.softwareCount} interrupt(s).
// Prescaler: ${row.divisor}; OCR${n}A: ${row.ocr}; assumes a ${result.clock} Hz CPU clock.
// Owns Timer${n}; do not combine with libraries or PWM using this timer.
${n===0?'// WARNING: millis(), micros(), and delay() will no longer work correctly.\n':''}// Paste this entire sketch into a NEW Arduino IDE sketch.
// Select an ATmega328P board (e.g. Uno R3 / classic Nano), not Uno R4.
#include <Arduino.h>
#include <avr/interrupt.h>
#include <util/atomic.h>

#if !defined(__AVR_ATmega328P__)
#error "This sketch requires an ATmega328P board."
#endif
#if F_CPU != ${result.clock}UL
#error "Board clock does not match the calculator. Check board settings."
#endif

volatile uint16_t pendingTicks = 0;
volatile bool queueOverflow = false;
bool ledState = false;

void configureTimer() {
  const uint8_t savedSREG = SREG;
  cli();
  TCCR${n}B = 0;                         // Stop the timer.
  TIMSK${n} = 0;                         // Disable this timer's interrupts.
  TCCR${n}A = 0;                         // Disconnect compare output pins.
${n===1?'  TCCR1C = 0;\n':''}${n===2?'  // Uses synchronous Timer2 (standard Arduino startup; AS2 must be 0).\n':''}  TCNT${n} = 0;
  OCR${n}A = ${row.ocr};                       // Count 0 through OCR${n}A inclusive.
  TIFR${n} = _BV(OCF${n}A) | _BV(OCF${n}B) | _BV(TOV${n}); // Write 1 to clear flags.
${n!==1?`  TCCR${n}A = ${mode};                 // CTC mode.\n`:''}  TIMSK${n} = _BV(OCIE${n}A);              // Enable compare A interrupt.
  TCCR${n}B = ${n===1?mode+' | ':''}${cs}; // Start with /${row.divisor}.
  SREG = savedSREG;
}

ISR(TIMER${n}_COMPA_vect) {
  // Keep the ISR short: no delay(), Serial printing, or slow tasks here.
${row.softwareCount>1?`  static uint32_t interruptCount = 0;
  if (++interruptCount < ${row.softwareCount}UL) return;
  interruptCount = 0;                 // One requested task interval elapsed.
`:''}  if (pendingTicks < 65535) ++pendingTicks;
  else queueOverflow = true;           // Foreground work is falling behind.
}

void setup() {
  pinMode(LED_BUILTIN, OUTPUT);
  digitalWrite(LED_BUILTIN, LOW);
  configureTimer();
}

void loop() {
  bool runTask = false;
  ATOMIC_BLOCK(ATOMIC_RESTORESTATE) {
    if (pendingTicks > 0) {
      --pendingTicks;
      runTask = true;
    }
  }
  if (runTask) {
    // Replace this with your periodic task. It must finish within one interval.
    ledState = !ledState;
    digitalWrite(LED_BUILTIN, ledState);
    // One full ON/OFF blink takes TWO task intervals.
  }
  // Other nonblocking work can go here.
}

// Timing is nominal: oscillator tolerance and ISR latency still apply.
// Foreground tasks may be delayed by other work. Very high interrupt rates
// can exceed CPU capacity; hardware events may then be missed (not queued).
// queueOverflow latches true if the software queue saturates.
`;
}
root.TimerCalculator={calculate,sketch,choices};if(typeof module!=='undefined')module.exports=root.TimerCalculator;
})(typeof globalThis!=='undefined'?globalThis:window);
