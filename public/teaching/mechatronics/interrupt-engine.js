/* Guided Timer1 CTC model. CPU phases are explicit teaching abstractions. */
(function(root){
'use strict';
class InterruptLab {
 constructor(c={}) {
  this.c={hz:16000000,divisor:8,top:12499,isrCycles:1600,longView:false,...c};
  if(![1,8,64,256,1024].includes(this.c.divisor)||!Number.isInteger(this.c.top)||this.c.top<0||this.c.top>65535||!Number.isInteger(this.c.isrCycles)||this.c.isrCycles<1||this.c.isrCycles>1600000)throw Error('Use OCR1A 0–65535 and ISR duration 1–1,600,000 cycles.');
  this.s={cycles:0,count:0,phase:0,flag:false,mask:true,i:true,cpu:'main',pc:0x40,stack:[],events:0,services:0,merged:0,led:false,mustMain:false,mainProgress:0,mainInstructions:0,isrRemaining:0,trace:[],points:[{cycles:0,count:0}],message:'The main program is running. Timer1 counts independently.'};
  this.undo=[];
 }
 get period(){return (this.c.top+1)*this.c.divisor;}
 save(){this.undo.push(JSON.parse(JSON.stringify(this.s)));if(this.undo.length>120)this.undo.shift();}
 back(){if(this.undo.length)this.s=this.undo.pop();}
 log(label){this.s.trace.unshift({cycles:this.s.cycles,label});this.s.trace=this.s.trace.slice(0,this.c.longView?100:24);}
 advance(n,kind){
  const s=this.s,c=this.c,start=s.cycles;
  const ticks=Math.floor((s.phase+n)/c.divisor),total=s.count+ticks;
  const matches=Math.floor(total/(c.top+1));
  const first=(c.top+1-s.count)*c.divisor-s.phase;
  // Preserve sawtooth corners for the last few cycles, without iterating clock ticks.
  if(matches){
   for(let j=Math.max(0,matches-8);j<matches;j++){
    const t=start+first+j*this.period;
    s.points.push({cycles:t-c.divisor,count:c.top},{cycles:t,count:0});
   }
   s.merged+=Math.max(0,matches-(s.flag?0:1));s.events+=matches;s.flag=true;
  }
  s.phase=(s.phase+n)%c.divisor;s.count=total%(c.top+1);s.cycles+=n;
  s.points.push({cycles:s.cycles,count:s.count});s.points=s.points.slice(-100);
  s.trace.unshift({cycles:s.cycles,label:kind,duration:n,start});s.trace=s.trace.slice(0,this.c.longView?100:24);
 }
 toggle(key){this.save();this.s[key]=!this.s[key];this.s.message=key==='i'?'Global interrupt enable changed. Timer1 keeps counting.':'Compare A interrupt enable changed. The event flag is independent of this mask.';this.log(this.s.message);}
 step(){
  this.save();const s=this.s;
  if(s.cpu==='entry'){
   this.advance(3,'Vector jump');s.pc=0x100;s.cpu='isr';s.isrRemaining=this.c.isrCycles;s.message=this.c.longView?'The vector at word address 0x0016 jumps to the ISR work block. This block represents many instructions or a repeated loop; its duration is configured separately.':'The vector at word address 0x0016 jumps to the ISR at illustrative address 0x0100.';
  }else if(s.cpu==='isr'){
   const wasPending=s.flag,oldEvents=s.events;
   let elapsed=s.isrRemaining;
   if(this.c.longView){
    const toObservation=s.count===this.c.top?this.c.divisor-s.phase:Math.min(this.c.top-s.count,Math.max(1,Math.ceil(this.c.top/4)))*this.c.divisor-s.phase;
    elapsed=Math.min(elapsed,toObservation);
   }
   this.advance(elapsed,'ISR body');s.isrRemaining-=elapsed;
   if(s.isrRemaining>0){
    s.message=s.events>oldEvents?(wasPending?'Another compare event occurred. OCF1A was already 1, so it still holds only one pending request.':'Compare event: TCNT1 cleared to 0 and OCF1A became 1. One interrupt is pending while the ISR continues.'):
     s.count===this.c.top?`TCNT1 = OCR1A = ${this.c.top}. Timer1 reaches equality while the CPU is still executing the ISR. The next timer tick sets the flag.`:
     `The CPU is working inside the ISR. Timer1 has advanced to ${s.count}; the main program remains paused.`;
    return;
   }
   s.led=!s.led;s.pc=0x102;s.cpu='return';s.message='The ISR toggled the LED. Timer1 continued counting during the ISR; any new compare request remains pending.';
  }else if(s.cpu==='return'){
   this.advance(4,'RETI');s.pc=s.stack.pop();s.i=true;s.cpu='main';s.mustMain=true;s.message='RETI restores the return address and sets I = 1. One main instruction executes before another pending interrupt is serviced.';
  }else if(s.flag&&s.mask&&s.i&&!s.mustMain&&s.mainProgress===0){
   s.stack.push(s.pc);s.i=false;s.flag=false;s.services++;this.advance(4,'Interrupt entry');s.pc=0x16;s.cpu='entry';s.message='Interrupt accepted: return address saved, I cleared, and the serviced compare flag cleared. A new event during entry can set it again.';
  }else{
   // Observation pauses can fall inside a main instruction. Keep its progress
   // so interrupt entry still waits for the instruction boundary.
   let n;
   if(s.mustMain)n=4-s.mainProgress;
   else if(s.flag&&s.mask&&s.i&&s.mainProgress)n=4-s.mainProgress;
   else if(s.count<this.c.top)n=Math.min(this.c.top-s.count,Math.max(1,Math.ceil(this.c.top/4)))*this.c.divisor-s.phase;
   else n=this.c.divisor-s.phase;
   const resumed=s.mustMain,oldCount=s.count,oldEvents=s.events,completed=Math.floor((s.mainProgress+n)/4);
   s.mainProgress=(s.mainProgress+n)%4;s.mainInstructions+=completed;
   this.advance(n,'Main program');s.pc=0x40+2*((((s.pc-0x40)/2)+completed)%3);s.mustMain=false;
   if(this.c.longView&&resumed){
    s.message='Main program resumes: one instruction completed. '+(s.flag&&s.mask&&s.i?'An interrupt is pending, so the next step pauses the main program again.':'Timer1 continues counting.');
   }else if(s.events>oldEvents){
    s.message='One timer tick after equality: TCNT1 clears to 0 and OCF1A is set. '+(!s.mask?'OCIE1A = 0 blocks service.':!s.i?'I = 0 blocks service.':s.mainProgress?'The CPU must finish its current instruction before accepting the interrupt.':'The CPU can accept the interrupt on the next step.');
   }else if(s.count===this.c.top){
    s.message=`Equality: TCNT1 = OCR1A = ${this.c.top}. The next timer tick clears TCNT1 to 0 and sets OCF1A. `+(s.flag?'An earlier request is already pending.':'The compare flag is still 0.');
   }else{
    s.message=`Counting: TCNT1 advanced from ${oldCount} to ${s.count}, below OCR1A = ${this.c.top}. The main program completed ${completed.toLocaleString('en-US')} instructions during this step (${Math.floor(s.mainInstructions/3).toLocaleString('en-US')} loop passes total). `+(s.flag?(!s.mask?'An earlier flag remains pending; OCIE1A = 0 blocks service.':!s.i?'An earlier flag remains pending; I = 0 blocks service.':'The pending interrupt can now be accepted.'):'No compare event yet in this timer period.');
   }
  }
 }
}
root.InterruptLab=InterruptLab;if(typeof module!=='undefined')module.exports=InterruptLab;
})(typeof globalThis!=='undefined'?globalThis:window);
