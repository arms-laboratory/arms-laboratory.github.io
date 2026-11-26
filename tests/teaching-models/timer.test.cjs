const assert = require("node:assert/strict");
const { Timer, divisors } = require("./timer-engine.js");
const advance = (t, n) => {
  for (let i = 0; i < n; i++) t.tick();
};
let t = new Timer();
advance(t, 5);
assert.equal(t.count, 255);
assert.equal(t.flags, 0);
t.tick();
assert.equal(t.count, 0);
assert.equal(t.flags, 1);
advance(t, 256);
assert.equal(t.totals.overflow, 2);
t.clear(1);
assert.equal(t.flags & 1, 0);
t = new Timer({ mode: "ctc", preload: 0, a: 9, b: 4 });
advance(t, 5);
assert.equal(t.count, 5);
assert.equal(t.flags, 4);
advance(t, 5);
assert.equal(t.count, 0);
assert.equal(t.flags, 6);
assert.equal(t.totals.overflow, 0);
t.clear(2);
assert.equal(t.flags, 4);
advance(t, 10);
assert.equal(t.totals.a, 2);
t = new Timer({ id: 1, divisor: 1024, preload: 49911, a: 0, b: 0 });
advance(t, 15625);
assert.equal(t.ticks * t.tickSeconds, 1);
assert.equal(t.totals.overflow, 1);
assert.equal(t.count, 0);
advance(t, 65536);
assert.equal(t.totals.overflow, 2);
t = new Timer({
  id: 1,
  divisor: 1024,
  mode: "ctc",
  preload: 0,
  a: 15624,
  b: 7812,
});
advance(t, 31250);
assert.equal(t.totals.a, 2);
assert.equal(t.ticks * t.tickSeconds, 2);
assert.equal(t.count, 0);
assert.equal(t.controlA, 0);
assert.equal(t.controlB, 13);
t = new Timer({ mode: "ctc", preload: 0, a: 0, b: 0 });
advance(t, 3);
assert.equal(t.count, 0);
assert.equal(t.totals.a, 3);
assert.equal(t.totals.b, 3);
t = new Timer({ mode: "ctc", preload: 0, a: 255, b: 256 - 1 });
advance(t, 256);
assert.equal(t.flags, 7);
t = new Timer({ mode: "ctc", preload: 20, a: 9, b: 15 });
advance(t, 236);
assert.equal(t.count, 0);
assert.equal(t.totals.overflow, 1);
advance(t, 10);
assert.equal(t.totals.a, 1);
t = new Timer({ divisor: 0 });
t.nextEvent();
assert.equal(t.ticks, 0);
t = new Timer({ reload: true });
advance(t, 12);
assert.equal(t.count, 250);
assert.equal(t.totals.overflow, 2);
for (const id of [0, 1, 2])
  for (const d of divisors(id)) {
    t = new Timer({ id, divisor: d });
    assert.equal(t.controlB, divisors(id).indexOf(d));
  }
assert.throws(() => new Timer({ a: 256 }));
assert.throws(() => new Timer({ id: 0, divisor: 32 }));
console.log(
  "Passed: normal/CTC timing, flags, reload, stopped clock, prescalers, boundary values, and one-second lecture examples.",
);
