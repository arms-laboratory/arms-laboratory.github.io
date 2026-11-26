const { metrics, Encoder, delta, homeAt } = require("./encoder-core.js");
const assert = require("node:assert/strict");
const c = {
  slits: 2048,
  decode: 4,
  ts: 0.01,
  bits: 16,
  clock: 8e6,
  divisor: 8,
  timerBits: 16,
};
assert.equal(metrics(c, 1).cross, 73.2421875);
assert.equal(metrics(c, 73.2421875).countRel, 1);
assert.equal(metrics(c, 73.2421875).durationRel, 1);
for (const [ts, d, bad] of [
  [0.079, 32358, false],
  [0.08, -32768, true],
  [0.081, -32359, true],
]) {
  const e = new Encoder({ ...c, ts });
  e.advance(ts, 3000);
  assert.equal(e.lastDelta, d);
  assert.equal(e.ambiguous, bad);
}
assert.equal(homeAt(0.25, 16), 1);
assert.equal(homeAt(0.99, 16), 1);
assert.equal(homeAt(1, 16), 0);
assert.equal(homeAt(63.99, 16), 0);
assert.equal(homeAt(64, 16), 1);
assert.equal(homeAt(-0.01, 16), 0);
assert.equal(delta(2, 14, 4), 4);
assert.equal(delta(14, 2, 4), -4);
for (const decode of [1, 2, 4]) {
  const e = new Encoder({ ...c, slits: 16, decode, ts: 10 });
  e.advance(2, 30);
  assert.equal(e.count, 16 * decode);
  e.advance(2, -30);
  assert.equal(e.count, 0);
}
for (const decode of [1, 2, 4]) {
  const e = new Encoder({ ...c, slits: 1, decode, ts: 10 });
  e.advance(0.2, 60);
  assert.equal(e.count, 1, "A rising counted");
}
const x1 = new Encoder({ ...c, slits: 1, decode: 1, ts: 10 });
x1.advance(0.3, -60);
assert.equal(x1.count, 0, "Reverse B edge does not count in x1");
x1.advance(0.1, -60);
assert.equal(x1.count, -1, "Reverse A rising counts down");
const stopped = new Encoder(c);
stopped.advance(0.01, 0);
assert.equal(stopped.countRPM, 0);
assert.equal(stopped.periodRPM, null);
const period = new Encoder({ ...c, slits: 256 });
period.advance(0.1, 60);
assert.ok(Math.abs(period.periodRPM - 60) < 0.1);
const previous = period.periodRPM;
period.advance(0.1, 0);
assert.equal(period.periodRPM, previous);
assert.equal(period.countRPM, 0);
const whole = new Encoder(c),
  parts = new Encoder(c);
whole.advance(0.1, 73.24);
for (let j = 0; j < 100; j++) parts.advance(0.001, 73.24);
assert.equal(parts.count, whole.count);
assert.equal(parts.software, whole.software);
assert.equal(parts.ticks, whole.ticks);
console.log(
  "Passed: crossover, error equality, half-range boundaries, rollover, forward/reverse x1/x2/x4, stop/stale period, and step-size consistency.",
);
