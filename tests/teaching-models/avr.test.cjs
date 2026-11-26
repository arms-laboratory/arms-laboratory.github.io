const assert = require("node:assert/strict");
const AVR = require("./avr.js");
function assemble(source) {
  const p = AVR.assemble(source);
  assert.deepEqual(p.errors, [], source);
  return p;
}
function run(source, state = AVR.initial(), limit = 500) {
  const p = assemble(source);
  while (p.byPC.has(state.pc) && state.count < limit)
    state = AVR.execute(state, p.byPC.get(state.pc)).state;
  return state;
}
const signed = (x) => (x < 128 ? x : x - 256);
// Use signed/unsigned arithmetic definitions as an independent flag oracle.
for (const op of ["ADD", "SUB", "CPI"]) {
  const instruction = assemble(op === "CPI" ? "CPI R16, 0" : `${op} R16, R17`)
    .instructions[0];
  const state = AVR.initial();
  for (let a = 0; a < 256; a++)
    for (let b = 0; b < 256; b++) {
      state.regs[16] = a;
      state.regs[17] = b;
      if (op === "CPI") instruction.k = b;
      const next = AVR.execute(state, instruction).state;
      const raw = op === "ADD" ? a + b : a - b;
      const signedRaw =
        op === "ADD" ? signed(a) + signed(b) : signed(a) - signed(b);
      const value = (raw + 256) % 256,
        N = +(value >= 128),
        V = +(signedRaw < -128 || signedRaw > 127);
      assert.equal(next.regs[16], op === "CPI" ? a : value);
      assert.equal(next.regs[17], b);
      assert.deepEqual(next.flags, {
        C: +(op === "ADD" ? raw > 255 : raw < 0),
        H: +(op === "ADD" ? (a % 16) + (b % 16) > 15 : a % 16 < b % 16),
        Z: +(value === 0),
        N,
        V,
        S: N ^ V,
      });
    }
}
const dec = assemble("DEC R16").instructions[0];
for (let a = 0; a < 256; a++) {
  const s = AVR.initial();
  s.regs[16] = a;
  s.flags.C = 1;
  s.flags.H = 1;
  const r = AVR.execute(s, dec).state,
    value = (a + 255) % 256;
  assert.equal(r.regs[16], value);
  assert.deepEqual(r.flags, {
    C: 1,
    H: 1,
    Z: +(value === 0),
    N: +(value >= 128),
    V: +(a === 128),
    S: +(value >= 128) ^ +(a === 128),
  });
}
for (const [source, words] of [
  ["LDI R16, 255", [0xef0f]],
  ["MOV R31, R16", [0x2ff0]],
  ["ADD R2, R1", [0x0c21]],
  ["SUB R16, R17", [0x1b01]],
  ["CPI R16, 5", [0x3005]],
  ["DEC R16", [0x950a]],
  ["LDS R2, 0x0100", [0x9020, 0x0100]],
  ["STS 0x08ff, R31", [0x93f0, 0x08ff]],
  ["loop: RJMP loop", [0xcfff]],
  ["loop: BRNE loop", [0xf7f9]],
  ["NOP", [0]],
  ["BREQ next\nNOP\nnext: NOP", [0xf009, 0, 0]],
])
  assert.deepEqual(
    assemble(source).instructions.flatMap((i) => i.code),
    words,
  );
const original = AVR.initial(true),
  snapshot = AVR.clone(original);
const guided = run("LDS R2, 0x0100\nADD R2, R1\nSTS 0x0100, R2", original);
assert.equal(guided.ram[0], 186);
assert.equal(guided.regs[2], 186);
assert.equal(guided.pc, 5);
assert.equal(guided.cycles, 5);
assert.equal(guided.count, 3);
assert.deepEqual(original, snapshot); // Execution must preserve prior state for Back/undo.
const loop = run(
  "LDI R16,3\nLDI R17,0\nloop: ADD R17,R16\nDEC R16\nBRNE loop\nSTS 0x0100,R17",
);
assert.equal(loop.ram[0], 6);
assert.equal(loop.cycles, 15);
for (const input of [5, 6]) {
  const s = run(
    `LDI R16,${input}\nLDI R17,0\nCPI R16,5\nBREQ equal\nRJMP done\nequal: LDI R17,1\ndone: STS 0x0100,R17`,
  );
  assert.equal(s.ram[0], +(input === 5));
}
const overflow = run("LDI R16,250\nLDI R17,10\nADD R16,R17\nSTS 0x0100,R16");
assert.equal(overflow.ram[0], 4);
assert.equal(overflow.flags.C, 1);
const memory = run(
  "LDI R16,12\nSTS 0x0100,R16\nLDI R16,30\nSTS 0x08ff,R16\nLDS R17,0x0100\nLDS R18,0x08ff\nADD R17,R18\nSTS 0x0102,R17",
);
assert.equal(memory.ram[0], 12);
assert.equal(memory.ram[2047], 30);
assert.equal(memory.ram[2], 42);
assemble(
  " ; comment\nStart: ldi r16, $AB\nLDI R17,0b00001111\nMOV R0,R16\nRJMP START",
);
assemble("BREQ target\n" + "NOP\n".repeat(63) + "target: NOP");
assemble("target: NOP\n" + "NOP\n".repeat(62) + "BRNE target");
for (const bad of [
  "",
  "LDI R15,1",
  "LDI R16,256",
  "LDS R0,0x00ff",
  "STS 0x0900,R0",
  "MOV R32,R0",
  "ADD R0",
  "NOP 1",
  "RJMP missing",
  "RJMP end\nend:",
  "x: NOP\nX: NOP",
  "NOP\n".repeat(129),
  "BREQ target\n" + "NOP\n".repeat(64) + "target: NOP",
  "target: NOP\n" + "NOP\n".repeat(63) + "BRNE target",
])
  assert.ok(AVR.assemble(bad).errors.length, bad);
const twoWord = assemble("RJMP after\nLDS R2,0x0100\nafter: NOP");
assert.equal(twoWord.instructions[0].target, 3);
assert.equal(twoWord.byPC.has(2), false);
console.log(
  "PASS: AVR exhaustive arithmetic/CPI flags, DEC preservation, opcode fixtures, sample programs, cycles, SRAM boundaries, immutable state, and assembler validation.",
);
