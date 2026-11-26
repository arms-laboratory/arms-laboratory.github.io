const assert = require("node:assert/strict");
const C = require("./motor-core.js");
const near = (a, b, tol, msg) =>
  assert.ok(Math.abs(a - b) < tol, `${msg}: ${a} vs ${b}`);
function run(p, duration = 6, s = C.initial()) {
  C.step(s, p, duration);
  return s;
}
let p = { ...C.defaults, duty: 0.6, load: 0.1 };
let s = run(p);
const expected =
  (C.motor.K * p.duty * p.supply - C.motor.R * p.load) /
  (C.motor.K ** 2 + C.motor.R * C.motor.b);
near(
  s.w,
  expected,
  0.5,
  "PWM steady speed agrees with mean-voltage motor equation",
);
let reverse = run({ ...p, mode: "reverse" });
near(reverse.w, -s.w, 0.001, "Symmetric reverse drive");
assert.ok(run({ ...p, load: 0.4 }).w < s.w, "Additional load reduces speed");
assert.equal(run({ ...p, duty: 0 }).w, 0, "Zero duty stays at rest");
assert.ok(run({ ...p, duty: 1 }).w > s.w, "Full duty increases speed");
let coast = run({ ...p, mode: "coast", load: 0 }, 0.3, { ...s }),
  brake = run({ ...p, mode: "brake", load: 0 }, 0.3, { ...s });
assert.ok(brake.w < coast.w, "Electrical braking slows faster than coast");
assert.equal(coast.i, 0, "Coast current decays to zero");
const swapped = run({ ...p, mode: "reverse" }, 2, { ...s });
assert.ok(swapped.w < 0, "Reversal crosses zero and reverses shaft");
for (const mode of ["forward", "reverse", "brake", "coast"])
  for (let k = 0; k < 100; k++) {
    const g = C.gates(k * 0.000013, { ...p, mode });
    assert.ok(
      !(g[0] && g[1]) && !(g[2] && g[3]),
      "No same-leg simultaneous switches",
    );
  }
const v = { peak: 24, ratio: 1.5, line: 60, alpha: 90 };
for (const rect of ["full", "half", "scr"]) {
  let sum = 0,
    n = 40000;
  for (let i = 0; i < n; i++)
    sum += C.conversion((i + 0.5) / n / v.line, { ...v, rect }).rect;
  near(sum / n, C.rectMean({ ...v, rect }), 0.003, `${rect} mean`);
}
near(
  C.rectMean({ ...v, rect: "scr", alpha: 180 }),
  0,
  1e-9,
  "SCR at 180 degrees blocks",
);
assert.equal(C.field({ hz: 60, poles: 4, load: 0.5, type: "pmsm" }).ns, 1800);
assert.ok(
  C.field({ hz: 60, poles: 4, load: 0.5, type: "induction" }).nr < 1800,
);
for (let i = 0; i < 30; i++) {
  const ph = C.phases(i * 0.13),
    r = C.resultant(ph);
  near(
    ph.reduce((a, b) => a + b, 0),
    0,
    1e-10,
    "Balanced phases",
  );
  near(Math.hypot(r.x, r.y), 1.5, 1e-10, "Constant resultant field");
}
const fp = { current: 3, L: 0.02, R: 2, supply: 24, clamp: 120 };
near(
  C.flyback(0, { ...fp, protected: true }).i,
  3,
  1e-10,
  "Initial winding current",
);
near(
  C.flyback(0, { ...fp, protected: true }).switchV,
  24.7,
  1e-9,
  "Diode clamp voltage",
);
assert.ok(
  C.flyback(0.001, { ...fp, protected: false }).i <
    C.flyback(0.001, { ...fp, protected: true }).i,
  "High clamp decays faster",
);
assert.equal(C.flyback(0.1, { ...fp, protected: true }).i, 0);
console.log(
  "Motor model checks passed: dynamics, reversal, brake/coast, bridge gates, rectification, field, and flyback.",
);
// Regressions for frequency changes: keep physical time fixed unless fit is explicit.
near(
  C.waveWindow({ hz: 10, window: 200, fit: false }),
  0.2,
  1e-12,
  "10 Hz fixed window",
);
near(
  C.waveWindow({ hz: 60, window: 200, fit: false }),
  0.2,
  1e-12,
  "60 Hz retains the same window",
);
near(
  C.waveWindow({ hz: 10, window: 200, fit: true }),
  0.2,
  1e-12,
  "Explicit fit at 10 Hz",
);
near(
  C.waveWindow({ hz: 60, window: 200, fit: true }),
  1 / 30,
  1e-12,
  "Explicit fit at 60 Hz",
);
near(
  C.electricalAngle(0.01, 60) / C.electricalAngle(0.01, 10),
  6,
  1e-12,
  "Animation advances six times faster at 60 Hz",
);
for (const hz of [1, 10, 60, 100]) {
  const wave = C.pwmWave(0.2, hz, 1000, 24);
  assert.equal(wave[0][0], 0);
  near(wave.at(-1)[0], 0.2, 1e-12, "PWM covers full fixed window");
  assert.ok(
    wave.every(
      ([t, y], i) =>
        Math.abs(y) === 24 && t >= 0 && t <= 0.2 && (!i || t >= wave[i - 1][0]),
    ),
    "PWM edge times and voltage levels",
  );
  // Sample away from transitions and independently compare sinusoid with triangle.
  let index = 0;
  for (let k = 0; k < 997; k++) {
    const t = ((k + 0.37) / 997) * 0.2;
    while (index + 1 < wave.length && wave[index + 1][0] <= t) index++;
    const expected =
      Math.sin(2 * Math.PI * hz * t) >= 4 * Math.abs(((t * 1000) % 1) - 0.5) - 1
        ? 24
        : -24;
    assert.equal(
      wave[index][1],
      expected,
      `PWM comparator at ${hz} Hz, t=${t}`,
    );
  }
}
const diodeEnd = C.flybackEnd({ ...fp, protected: true }),
  clampEnd = C.flybackEnd({ ...fp, protected: false });
assert.ok(
  diodeEnd > 20 * clampEnd,
  "Default diode decay is visibly longer than clamp decay",
);
near(
  C.flyback(diodeEnd, { ...fp, protected: true }).i,
  0,
  1e-9,
  "Predicted diode zero-current time",
);
near(
  C.flyback(clampEnd, { ...fp, protected: false }).i,
  0,
  1e-9,
  "Predicted clamp zero-current time",
);
console.log(
  "Revision checks passed: fixed time axes, animation frequency, PWM edges, and flyback decay times.",
);
const diodeParams = { ...C.defaults, freewheel: "diode", duty: 0.6, load: 0.1 };
const tOff = 0.0015;
assert.deepEqual(
  C.gates(tOff, diodeParams),
  [false, false, false, true],
  "Diode PWM off holds only B4 on",
);
assert.deepEqual(
  C.conduction(tOff, 3, diodeParams),
  { switches: [3], diodes: [1] },
  "Forward return path uses D2 and B4",
);
assert.deepEqual(
  C.conduction(tOff, 3, { ...diodeParams, freewheel: "sync" }),
  { switches: [1, 3], diodes: [] },
  "Synchronous return path uses B2 and B4 channels",
);
assert.deepEqual(
  C.conduction(tOff, -3, { ...diodeParams, mode: "reverse" }),
  { switches: [1], diodes: [3] },
  "Reverse diode return uses B2 and D4",
);
near(
  C.terminal(tOff, 3, diodeParams),
  -0.7,
  1e-12,
  "Diode opposes forward current with 0.7 V",
);
near(
  C.terminal(tOff, 3, { ...diodeParams, freewheel: "sync" }),
  0,
  1e-12,
  "Ideal synchronous recirculation voltage is zero",
);
const diodeSteady = run(diodeParams),
  syncSteady = run({ ...diodeParams, freewheel: "sync" });
assert.ok(
  diodeSteady.w < syncSteady.w,
  "Diode drop reduces steady speed at the same duty",
);
const expectedDiode =
  (C.motor.K * (diodeParams.duty * 24 - (1 - diodeParams.duty) * 0.7) -
    2 * diodeParams.load) /
  (0.01 + 0.002);
near(
  diodeSteady.w,
  expectedDiode,
  0.5,
  "Diode steady state agrees with continuous-current mean voltage",
);
near(
  run({ ...diodeParams, mode: "reverse" }).w,
  -diodeSteady.w,
  0.001,
  "Diode-mode reverse symmetry",
);
console.log(
  "Two-design checks passed: selected gates, current return paths, diode drop, speed, and reversal.",
);
const fastParams = {
  ...C.defaults,
  freewheel: "diode",
  decay: "fast",
  duty: 0.55,
};
assert.deepEqual(
  C.gates(0.0015, fastParams),
  [false, false, false, false],
  "Fast diode decay opens all switches",
);
assert.deepEqual(
  C.conduction(0.0015, 3, fastParams),
  { switches: [], diodes: [1, 2] },
  "Forward fast decay uses D2 and D3",
);
near(
  C.terminal(0.0015, 3, fastParams),
  -25.4,
  1e-12,
  "Fast decay opposes current with bus plus two diode drops",
);
let fastEnergy = C.powerFlow(0.0015, 3, fastParams, 50),
  slowEnergy = C.powerFlow(0.0015, 3, { ...fastParams, decay: "slow" }, 50);
near(
  fastEnergy.supplyPower,
  -72,
  1e-12,
  "Fast path returns 72 W to a 24 V bus at 3 A",
);
near(slowEnergy.supplyPower, 0, 1e-12, "Local diode loop has no bus exchange");
near(slowEnergy.diodeLoss, 2.1, 1e-12, "Local diode dissipates I times Vf");
for (const freewheel of ["diode", "sync"])
  for (const decay of ["fast", "slow"])
    for (const mode of ["forward", "reverse", "coast", "brake"])
      for (const i of [-3, 0, 3])
        for (const t of [0.0005, 0.0015]) {
          const pp = { ...C.defaults, freewheel, decay, mode },
            energy = C.powerFlow(t, i, pp, 50);
          near(
            energy.supplyPower,
            energy.voltage * i + energy.diodeLoss,
            1e-8,
            "Bridge instantaneous power balance",
          );
          near(
            energy.supplyPower,
            energy.diodeLoss +
              energy.copperLoss +
              energy.mechanicalPower +
              energy.magneticPower,
            1e-8,
            "Motor plus bridge energy balance",
          );
        }
console.log(
  "Energy-path checks passed: local versus bus-return paths and instantaneous power balance.",
);
