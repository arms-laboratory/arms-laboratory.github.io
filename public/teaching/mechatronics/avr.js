/* AVR teaching subset. Reference: Atmel-0856L, November 2016. */
(function(root){
'use strict';
const ref={
 LDI:{syntax:'LDI Rd, K',description:'Copy a constant into an upper register.',operands:'Rd: R16–R31; K: 0–255.',effect:'Rd ← K',flags:'Unchanged',words:1,cycles:'1',page:115},
 MOV:{syntax:'MOV Rd, Rr',description:'Copy a register. The source keeps its value.',operands:'Rd and Rr: R0–R31.',effect:'Rd ← Rr',flags:'Unchanged',words:1,cycles:'1',page:123},
 LDS:{syntax:'LDS Rd, address',description:'Copy one byte from data memory into a register.',operands:'Rd: R0–R31. This simulator accepts SRAM addresses 0x0100–0x08FF.',effect:'Rd ← SRAM[address]',flags:'Unchanged',words:2,cycles:'2',page:116},
 STS:{syntax:'STS address, Rr',description:'Copy a register into a data-memory byte. The register keeps its value.',operands:'Rr: R0–R31. This simulator accepts SRAM addresses 0x0100–0x08FF.',effect:'SRAM[address] ← Rr',flags:'Unchanged',words:2,cycles:'2',page:179},
 ADD:{syntax:'ADD Rd, Rr',description:'Add two registers. Write the low eight bits into the destination.',operands:'Rd and Rr: R0–R31. Incoming carry is ignored.',effect:'Rd ← (Rd + Rr) mod 256',flags:'H, S, V, N, Z, C',words:1,cycles:'1',page:32},
 SUB:{syntax:'SUB Rd, Rr',description:'Subtract the source from the destination and keep the low eight bits.',operands:'Rd and Rr: R0–R31. C reports an unsigned borrow.',effect:'Rd ← (Rd − Rr) mod 256',flags:'H, S, V, N, Z, C',words:1,cycles:'1',page:181},
 CPI:{syntax:'CPI Rd, K',description:'Compare by subtracting a constant for the flags only. The register is unchanged.',operands:'Rd: R16–R31; K: 0–255.',effect:'Flags ← result of Rd − K',flags:'H, S, V, N, Z, C',words:1,cycles:'1',page:81},
 DEC:{syntax:'DEC Rd',description:'Subtract one from a register. Carry and half-carry stay unchanged.',operands:'Rd: R0–R31.',effect:'Rd ← (Rd − 1) mod 256',flags:'S, V, N, Z',words:1,cycles:'1',page:84},
 BREQ:{syntax:'BREQ label',description:'Branch when the zero flag is set.',operands:'Label offset: −64 to +63 words, measured from PC + 1.',effect:'If Z = 1: PC ← label; otherwise PC ← PC + 1',flags:'Unchanged',words:1,cycles:'2 taken / 1 not taken',page:45},
 BRNE:{syntax:'BRNE label',description:'Branch when the zero flag is clear.',operands:'Label offset: −64 to +63 words, measured from PC + 1.',effect:'If Z = 0: PC ← label; otherwise PC ← PC + 1',flags:'Unchanged',words:1,cycles:'2 taken / 1 not taken',page:54},
 RJMP:{syntax:'RJMP label',description:'Jump to a label regardless of the flags.',operands:'Label offset: −2048 to +2047 words, measured from PC + 1.',effect:'PC ← label',flags:'Unchanged',words:1,cycles:'2',page:142},
 NOP:{syntax:'NOP',description:'Do nothing for one clock cycle, then continue.',operands:'No operands.',effect:'PC ← PC + 1',flags:'Unchanged',words:1,cycles:'1',page:131}
};
const hex=(n,w=2)=>'0x'+n.toString(16).toUpperCase().padStart(w,'0');
function number(t){if(!/^(?:\d+|0x[\da-f]+|\$[\da-f]+|0b[01]+)$/i.test(t))throw Error('Use a decimal, 0x hexadecimal, $ hexadecimal, or 0b binary number.');return t[0]==='$'?parseInt(t.slice(1),16):Number(t);}
function assemble(source){const errors=[],instructions=[],labels=new Map();let pc=0;
 source.split(/\r?\n/).forEach((original,index)=>{let line=original.split(';')[0].trim();if(!line)return;const label=line.match(/^([A-Za-z_]\w*):/);if(label){if(labels.has(label[1].toLowerCase()))errors.push({line:index+1,message:'Duplicate label: '+label[1]});else labels.set(label[1].toLowerCase(),pc);line=line.slice(label[0].length).trim();}if(!line)return;
 const m=line.match(/^(\w+)\b(.*)$/);if(!m||!ref[m[1].toUpperCase()]){errors.push({line:index+1,message:'Unsupported instruction. Choose one from the instruction guide.'});return;}
 const op=m[1].toUpperCase(),args=m[2].trim()?m[2].trim().split(',').map(a=>a.trim()):[];instructions.push({op,args,pc,line:index+1,text:line,words:ref[op].words});pc+=ref[op].words;});
 if(!instructions.length)errors.push({line:1,message:'Write at least one instruction.'});if(pc>128)errors.push({line:1,message:'This classroom model allows at most 128 program words.'});
 const starts=new Set(instructions.map(i=>i.pc));
 for(const i of instructions){try{const {op,args}=i;const count=op==='NOP'?0:['DEC','BREQ','BRNE','RJMP'].includes(op)?1:2;if(args.length!==count||args.some(a=>!a))throw Error(`${op} expects ${count} operand${count===1?'':'s'}. Syntax: ${ref[op].syntax}`);
 const reg=(s,upper=false)=>{const m=/^r(\d+)$/i.exec(s);const n=m?Number(m[1]):-1;if(n<(upper?16:0)||n>31)throw Error(upper?`${op} requires R16–R31.`:'Register must be R0–R31.');return n;};const byte=s=>{let n=number(s);if(n<0||n>255)throw Error('Constant must fit in one byte (0–255).');return n;};const addr=s=>{let n=number(s);if(n<256||n>2303)throw Error('This model supports SRAM only: 0x0100–0x08FF.');return n;};
 if(['LDI','CPI'].includes(op)){i.d=reg(args[0],true);i.k=byte(args[1]);i.code=[(op==='LDI'?0xe000:0x3000)|((i.k&0xf0)<<4)|((i.d-16)<<4)|(i.k&15)];}
 if(['MOV','ADD','SUB'].includes(op)){i.d=reg(args[0]);i.r=reg(args[1]);i.code=[({MOV:0x2c00,ADD:0x0c00,SUB:0x1800}[op])|(i.d<<4)|(i.r&15)|((i.r&16)<<5)];}
 if(op==='LDS'){i.d=reg(args[0]);i.address=addr(args[1]);i.code=[0x9000|(i.d<<4),i.address];}
 if(op==='STS'){i.address=addr(args[0]);i.r=reg(args[1]);i.code=[0x9200|(i.r<<4),i.address];}
 if(op==='DEC'){i.d=reg(args[0]);i.code=[0x940a|(i.d<<4)];}
 if(['BRNE','BREQ','RJMP'].includes(op)){const target=labels.get(args[0].toLowerCase());if(target===undefined)throw Error('Unknown label: '+args[0]);if(!starts.has(target))throw Error('A branch label must point to an instruction, not beyond the program.');i.target=target;i.offset=target-i.pc-1;const min=op==='RJMP'?-2048:-64,max=op==='RJMP'?2047:63;if(i.offset<min||i.offset>max)throw Error(`Branch is too far: offset ${i.offset}; allowed ${min} to ${max}.`);i.code=[op==='RJMP'?0xc000|(i.offset&4095):(op==='BREQ'?0xf001:0xf401)|((i.offset&127)<<3)];}
 if(op==='NOP')i.code=[0];
 }catch(e){errors.push({line:i.line,message:e.message});}}
 return {instructions,wordCount:pc,errors,byPC:new Map(instructions.map(i=>[i.pc,i]))};}
function initial(guided=false,r1=171,mem=15){const s={regs:new Uint8Array(32),ram:new Uint8Array(2048),pc:0,cycles:0,count:0,flags:{C:0,Z:0,N:0,V:0,S:0,H:0}};if(guided){s.regs[1]=r1;s.ram[0]=mem;}return s;}
function clone(s){return {...s,regs:s.regs.slice(),ram:s.ram.slice(),flags:{...s.flags}};}
function arithmetic(s,a,b,sub){const result=(sub?a-b:a+b)&255,N=result>>7,V=+((sub?(a^b)&(a^result):~(a^b)&(a^result))&128?true:false);s.flags={C:+(sub?a<b:a+b>255),H:+(sub?(a&15)<(b&15):(a&15)+(b&15)>15),Z:+(result===0),N,V,S:N^V};return result;}
function execute(state,i){const s=clone(state),ev={op:i.op,from:[],to:null,description:'',alu:'',written:[],flagsWritten:ref[i.op].flags!=='Unchanged',pcBefore:s.pc};let cycles=1;s.pc+=i.words;const reg=n=>'r'+n;const R=n=>'R'+n;let a=s.regs[i.d],b=i.r!==undefined?s.regs[i.r]:i.k;
 switch(i.op){
 case 'LDI':s.regs[i.d]=i.k;ev.from=['flash'];ev.to=reg(i.d);ev.description=`Copy constant ${i.k} (${hex(i.k)}) into ${R(i.d)}.`;break;
 case 'MOV':s.regs[i.d]=b;ev.from=[reg(i.r)];ev.to=reg(i.d);ev.description=`Copy ${R(i.r)} (${b}) into ${R(i.d)}. The source keeps its value.`;break;
 case 'LDS':s.regs[i.d]=s.ram[i.address-256];ev.from=['mem'];ev.to=reg(i.d);cycles=2;ev.description=`Read ${hex(i.address,4)} (${s.regs[i.d]}) into ${R(i.d)}. SRAM is unchanged.`;break;
 case 'STS':s.ram[i.address-256]=b;ev.from=[reg(i.r)];ev.to='mem';cycles=2;ev.description=`Write ${R(i.r)} (${b}) into SRAM ${hex(i.address,4)}. The register is unchanged.`;break;
 case 'ADD':case 'SUB':case 'CPI':{let result=arithmetic(s,a,b,i.op!=='ADD');if(i.op!=='CPI'){s.regs[i.d]=result;ev.to=reg(i.d);}else ev.to='flags';ev.from=[reg(i.d),i.op==='CPI'?'flash':reg(i.r)];ev.alu=`${a} ${i.op==='ADD'?'+':'−'} ${b} = ${i.op==='ADD'?a+b:a-b}`;ev.description=i.op==='CPI'?`Compare ${R(i.d)} (${a}) with ${b}. Only flags change; Z = ${s.flags.Z}.`:`${ev.alu}. ${R(i.d)} receives ${result} (low 8 bits); C = ${s.flags.C}.`;break;}
 case 'DEC':{let result=(a-1)&255;s.regs[i.d]=result;const N=result>>7,V=+(a===128);Object.assign(s.flags,{N,V,S:N^V,Z:+(result===0)});ev.from=[reg(i.d)];ev.to=reg(i.d);ev.alu=`${a} − 1 = ${a-1}`;ev.description=`${R(i.d)} becomes ${result}. Z = ${s.flags.Z}; carry and half-carry are preserved.`;break;}
 case 'BREQ':case 'BRNE':{let taken=i.op==='BREQ'?!!s.flags.Z:!s.flags.Z;if(taken)s.pc=i.target;cycles=taken?2:1;ev.description=`Z = ${s.flags.Z}: branch ${taken?'taken':'not taken'}. PC becomes ${hex(s.pc,4)} (${cycles} clock cycle${cycles===1?'':'s'}).`;ev.to='pc';break;}
 case 'RJMP':s.pc=i.target;cycles=2;ev.to='pc';ev.description=`Jump to ${hex(s.pc,4)}. Offset ${i.offset} is added to PC + 1.`;break;
 case 'NOP':ev.description='No data changes. Advance to the next instruction.';break;
 }
 if(ev.to&&ev.to!=='pc')ev.written=[ev.to];s.cycles+=cycles;s.count++;ev.cycles=cycles;return {state:s,event:ev};}
const api={ref,hex,number,assemble,initial,clone,execute};if(typeof module!=='undefined')module.exports=api;else root.AVR=api;
})(typeof window!=='undefined'?window:globalThis);
