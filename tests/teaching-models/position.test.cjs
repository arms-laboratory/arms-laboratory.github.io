const assert = require("node:assert/strict");
const { run } = require("./position-core.js");
const near = (a, b, t = 1e-8) => assert.ok(Math.abs(a - b) < t, a + " != " + b);
let a = run();
near(a.rows[150].e, 2, 1e-6);
assert.ok(Math.abs(a.rows.at(-1).e) < 1e-8);
near(run({ speed: 20, distance: 80 }).rows[150].e, 4, 1e-6);
near(run({ kp: 10 }).rows[150].e, 1, 1e-6);
const ff = run({ feedforward: true });
assert.ok(ff.rows.every((r) => Math.abs(r.e) < 1e-10));
for (const mode of ["P", "PI", "PID"])
  for (const tau of [0, 0.15]) {
    let q = run({ mode, tau });
    for (const r of q.rows) {
      near(r.e, r.recurrence);
      assert.ok(Number.isFinite(r.x));
      assert.ok(Math.abs(r.u) <= q.c.limit);
    }
  }
let pi = run({ mode: "PI", distance: 100 });
assert.ok(Math.abs(pi.rows[450].e) < 0.01);
let stop = run({ switching: true });
let event = stop.rows.find((r) => r.latched);
assert.ok(event && !event.xgo && Math.abs(event.e) < 0.1);
assert.ok(stop.rows.filter((r) => r.latched).every((r) => r.u === 0));
let full = run({ mode: "PI", switching: true });
assert.ok(
  full.rows
    .filter((r) => r.latched)
    .every((r) => r.u === 0 && r.integral === 0),
);
let gain = run({ mode: "PI", switching: true, policy: "kp" });
assert.ok(gain.rows.some((r) => r.latched && Math.abs(r.u) > 0.01));
let lag = run({ tau: 0.2, feedforward: true });
near(lag.rows[1].v, 10 * (1 - Math.exp(-0.1)));
near(lag.rows[1].x, 10 * 0.02 - 2 * (1 - Math.exp(-0.1)));
let saturated = run({ limit: 2, mode: "PI" });
assert.ok(saturated.rows.every((r) => Math.abs(r.u) <= 2));
console.log(
  "Passed: ramp error, gain/speed scaling, settling, feedforward, PI tracking, error recurrence, switching policies, exact drive propagation, saturation.",
);
