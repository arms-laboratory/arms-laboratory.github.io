const assert = require("node:assert/strict");
const { sample, design } = require("./sampling-core.js");
const proper = {
  bits: 4,
  cycles: 16,
  decode: 1,
  rpm: 18.75,
  ts: 1,
  initial: 12,
};
let s = sample(proper, 1);
assert.equal(s.raw, 1);
assert.equal(s.movement, 5);
assert.equal(s.delta, 5);
assert.equal(s.software, 17);
for (let k = 0; k <= 24; k++) assert.equal(sample(proper, k).correct, true);
const improper = { ...proper, ts: 2.2 };
s = sample(improper, 1);
assert.equal(s.raw, 7);
assert.equal(s.previous, 12);
assert.equal(s.movement, 11);
assert.equal(s.delta, -5);
assert.equal(s.software, 7);
s = sample(improper, 3);
assert.equal(s.software - s.actual, -48);
const boundary = { ...proper, ts: 1.6 };
s = sample(boundary, 1);
assert.equal(s.delta, -8);
assert.equal(s.tie, true);
assert.equal(s.stepCorrect, false);
s = sample({ ...boundary, rpm: -18.75 }, 1);
assert.equal(s.delta, -8);
assert.equal(s.tie, true);
assert.equal(s.stepCorrect, true);
for (let k = 0; k <= 24; k++)
  assert.equal(sample({ ...proper, rpm: -proper.rpm }, k).correct, true);
const lecture = {
  bits: 16,
  cycles: 2048,
  decode: 4,
  rpm: 3000,
  ts: 0.079,
  initial: 0,
};
assert.equal(design(lecture).limit, 0.08);
assert.equal(sample(lecture, 1).stepCorrect, true);
assert.equal(sample({ ...lecture, ts: 0.08 }, 1).tie, true);
assert.equal(sample({ ...lecture, ts: 0.081 }, 1).stepCorrect, false);
const multi = { ...proper, ts: 6.4 };
s = sample(multi, 1);
assert.equal(s.movement, 32);
assert.equal(s.delta, 0);
const stop = { ...proper, rpm: 0 };
s = sample(stop, 24);
assert.equal(s.software, 12);
assert.equal(s.movement, 0);
const fractional = { ...proper, ts: 1.58 };
assert.equal(sample(fractional, 1).tie, true);
console.log(
  "Passed: proper/improper sampling, rollover, both half-range directions, reverse, 79/80/81 ms, multiple wraps, zero speed, fractional-count boundary.",
);
