/* ATmega328P teaching state; no instruction execution or electrical timing. */
(function(root){
'use strict';
const FLAGS=['C','Z','N','V','S','H','T','I'];
function number(text,max=255,min=0){const s=String(text).trim();if(!/^(?:0x[\da-f]+|0b[01]+|\d+)$/i.test(s))throw Error('Use decimal, 0x hexadecimal, or 0b binary.');const n=Number(s);if(!Number.isSafeInteger(n)||n<min||n>max)throw Error(`Enter a value from ${min} to ${max}.`);return n;}
function alu(a,b,op,old=0){
 if(a===null||b===null)throw Error('Initialize both operand registers first.');
 let raw,r,c,h,v,n,z,s,affected;
 if(op==='ADD'||op==='SUB'){
 raw=op==='ADD'?a+b:a-b;r=raw&255;c=op==='ADD'?+(raw>255):+(a<b);h=op==='ADD'?+((a&15)+(b&15)>15):+((a&15)<(b&15));
 v=op==='ADD'?+((~(a^b)&(a^r)&128)!==0):+(((a^b)&(a^r)&128)!==0);affected=63;
 }else{r=op==='AND'?a&b:op==='OR'?a|b:op==='EOR'?a^b:NaN;if(!Number.isInteger(r))throw Error('Unknown ALU operation.');v=0;affected=30;}
 n=r>>>7;z=+(r===0);s=n^v;let bits=(c||0)|z<<1|n<<2|v<<3|s<<4|(h||0)<<5;
 return {result:r,status:(old&~affected)|(bits&affected),affected,raw:raw??r};
}
class Machine{
 constructor(){this.reset();}
 reset(){this.data=Array(2304).fill(0);this.eeprom=Array(1024).fill(255);this.flash=Array(16384).fill(65535);this.flash.splice(0,5,0x0000,0xE20A,0x9110,0x0100,0xCFFB);this.pc=0;this.sp=0x8ff;this.depth=0;this.external=Array(8).fill(null);this.sreg=0;this.power=true;}
 get sreg(){return this.data[0x5f];} set sreg(v){this.data[0x5f]=v;}
 get sp(){return this.data[0x5d]|this.data[0x5e]<<8;} set sp(v){this.data[0x5d]=v&255;this.data[0x5e]=v>>8;}
 pin(bit){const mask=1<<bit;if(this.data[0x24]&mask)return +(!!(this.data[0x25]&mask));if(this.external[bit]!==null)return this.external[bit];return this.data[0x25]&mask?1:null;}
 read(addr){if(!Number.isInteger(addr)||addr<0||addr>0x8ff)throw Error('Data address must be 0x0000–0x08FF.');if(!this.power)throw Error('Turn power on first.');if(addr===0x23){let n=0;for(let i=0;i<8;i++){let p=this.pin(i);if(p===null)throw Error('PINB contains floating inputs. Set pull-ups or external levels for all bits before a byte read.');n|=p<<i;}return n;}if(addr<32||addr>=256||[0x24,0x25,0x44,0x45,0x5d,0x5e,0x5f].includes(addr))return this.data[addr];throw Error('This peripheral address is shown in the map but is not modeled.');}
 write(addr,value){if(!this.power)throw Error('Turn power on first.');if(addr<0||addr>0x8ff||!Number.isInteger(addr))throw Error('Data address must be 0x0000–0x08FF.');if(!Number.isInteger(value)||value<0||value>255)throw Error('A byte must be 0–255.');if(addr===0x44){this.data[addr]=value&0xf3;return;}if(addr===0x45){if(value&0xc0)throw Error('Force-compare commands are outside this model. Use the clock and mode bits only.');this.data[addr]=value&0x0f;return;}if(addr===0x24){for(let i=0;i<8;i++)if(value&(1<<i)&&this.external[i]!==null)throw Error('Disconnect the external drive before making this pin an output.');}if(addr===0x23){this.data[0x25]^=value;return;}if(addr===0x5d||addr===0x5e)throw Error('Use the stack controls to manage SP in this explorer.');if(addr<32||addr>=256||[0x24,0x25,0x5f].includes(addr)){this.data[addr]=value;return;}throw Error('This peripheral address is shown in the map but is not modeled.');}
 operate(d,s,op){const r=alu(this.data[d],this.data[s],op,this.sreg);this.data[d]=r.result;this.sreg=r.status;return r;}
 push(v){if(this.sp<0x100)throw Error('Stack full: no SRAM remains below SP.');const a=this.sp;this.write(a,v);this.sp=a-1;this.depth++;return a;}
 pop(){if(!this.depth)throw Error('Stack empty: there is no value to pop.');this.sp++;this.depth--;return {address:this.sp,value:this.data[this.sp]};}
 powerToggle(){this.power=!this.power;if(!this.power){this.data.fill(null);this.pc=0;this.depth=0;}else{for(let i=32;i<256;i++)this.data[i]=0;this.sp=0x8ff;this.pc=0;}return this.power;}
}
const api={Machine,alu,number,FLAGS};if(typeof module!=='undefined')module.exports=api;else root.ArchitectureCore=api;
})(globalThis);
