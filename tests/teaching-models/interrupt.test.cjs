const assert = require("node:assert/strict");
const Lab = require("./interrupt-engine.js");
function until(m, predicate) {
  for (let i = 0; i < 30 && !predicate(); i++) m.step();
  assert.ok(predicate(), "Expected phase reached within 30 steps");
}
let m = new Lab();
for (const count of [3125, 6250, 9375, 12499]) {
  m.step();
  assert.equal(m.s.count, count);
  assert.equal(m.s.flag, false);
  assert.equal(m.s.mainInstructions, Math.floor(m.s.cycles / 4));
  assert.equal(m.s.pc, 0x40 + 2 * (m.s.mainInstructions % 3));
}
assert.equal(m.s.count, 12499);
assert.equal(m.s.cycles, 99992);
assert.equal(m.s.flag, false);
assert.equal(m.s.events, 0);
const equality = JSON.stringify(m.s);
m.step();
m.back();
assert.equal(JSON.stringify(m.s), equality);
m.step();
assert.equal(m.s.cycles, 100000);
assert.equal(m.s.events, 1);
assert.equal(m.s.count, 0);
assert.equal(m.s.flag, true);
const pc = m.s.pc;
m.step();
assert.equal(m.s.services, 1);
assert.equal(m.s.i, false);
assert.equal(m.s.flag, false);
assert.deepEqual(m.s.stack, [pc]);
assert.equal(m.s.pc, 0x16);
m.step();
m.step();
assert.equal(m.s.led, true);
m.step();
assert.equal(m.s.pc, pc);
assert.equal(m.s.i, true);
assert.equal(m.s.stack.length, 0);
const prior = JSON.stringify(m.s);
m.step();
assert.equal(m.s.cycles, 101615);
m.back();
assert.equal(JSON.stringify(m.s), prior);
for (const key of ["i", "mask"]) {
  m = new Lab();
  m.toggle(key);
  until(m, () => m.s.events === 2);
  assert.equal(m.s.events, 2);
  assert.equal(m.s.services, 0);
  assert.equal(m.s.merged, 1);
  m.toggle(key);
  m.step();
  assert.equal(m.s.services, 1);
}
m = new Lab({ isrCycles: 240000 });
until(m, () => m.s.cpu === "return");
assert.equal(m.s.events, 3);
assert.equal(m.s.services, 1);
assert.equal(m.s.flag, true);
assert.equal(m.s.merged, 1);
m.step();
m.step();
assert.equal(m.s.services, 1);
m.step();
assert.equal(m.s.services, 2);
// Timer continues during entry and can reassert the serviced flag.
m = new Lab({ top: 0, divisor: 1 });
m.step();
m.step();
m.step();
assert.equal(m.s.flag, true);
assert.equal(m.s.events, 8);
assert.throws(() => new Lab({ top: 65536 }));
assert.throws(() => new Lab({ isrCycles: 0 }));
console.log(
  "Interrupt model checks passed: timing, gates, return PC, undo, long ISR, flag reassertion, validation.",
);

// Equality must be visible even when it falls inside a CPU instruction.
for (const divisor of [1, 8, 64, 256, 1024]) {
  for (const top of [1, 2, 12499, 65535]) {
    m = new Lab({ divisor, top });
    until(m, () => m.s.count === top);
    assert.equal(m.s.count, top);
    assert.equal(m.s.cycles, divisor * top);
    assert.equal(m.s.flag, false);
    m.step();
    assert.equal(m.s.count, 0);
    assert.equal(m.s.cycles, divisor * (top + 1));
    assert.equal(m.s.events, 1);
    if (m.s.mainProgress) {
      m.step();
      assert.equal(m.s.services, 0);
      assert.equal(m.s.mainProgress, 0);
    }
    m.step();
    assert.equal(m.s.services, 1);
    assert.equal(m.s.stack.length, 1);
  }
}
console.log(
  "Equality observation checks passed across prescalers and counter boundaries.",
);

// Loop progress freezes during ISR handling and resumes after return.
m = new Lab();
until(m, () => m.s.cpu === "entry");
const instructions = m.s.mainInstructions;
m.step();
m.step();
m.step();
assert.equal(m.s.mainInstructions, instructions);
m.step();
assert.equal(m.s.mainInstructions, instructions + 1);
m.back();
assert.equal(m.s.mainInstructions, instructions);
console.log(
  "Intermediate count, main-loop progression, ISR pause and undo checks passed.",
);

// Detailed demonstration pauses at each event without advancing the main loop.
m = new Lab({ isrCycles: 240000, longView: true });
until(m, () => m.s.cpu === "isr");
const mainAtEntry = m.s.mainInstructions,
  returnPC = m.s.stack[0],
  bodyStart = m.s.cycles;
assert.equal(m.s.isrRemaining, 240000);
until(m, () => m.s.events === 2);
assert.equal(m.s.cycles, 200000);
assert.equal(m.s.count, 0);
assert.equal(m.s.flag, true);
assert.equal(m.s.isrRemaining, 140007);
assert.equal(m.s.merged, 0);
assert.equal(m.s.mainInstructions, mainAtEntry);
assert.equal(m.s.stack[0], returnPC);
const firstPending = JSON.stringify(m.s);
m.step();
m.back();
assert.equal(JSON.stringify(m.s), firstPending);
until(m, () => m.s.events === 3);
assert.equal(m.s.cycles, 300000);
assert.equal(m.s.merged, 1);
assert.equal(m.s.isrRemaining, 40007);
assert.equal(m.s.mainInstructions, mainAtEntry);
until(m, () => m.s.cpu === "return");
assert.equal(m.s.cycles - bodyStart, 240000);
assert.equal(m.s.isrRemaining, 0);
assert.equal(m.s.led, true);
m.step();
assert.equal(m.s.pc, returnPC);
assert.equal(m.s.mustMain, true);
m.step();
assert.equal(m.s.mainInstructions, mainAtEntry + 1);
assert.match(m.s.message, /one instruction completed/);
m.step();
assert.equal(m.s.cpu, "entry");
assert.equal(m.s.services, 2);
console.log(
  "Detailed long ISR checks passed: event pauses, remaining time, frozen main progress, return and immediate re-entry.",
);
