const assert = require("node:assert/strict"),
  F = require("./frequency-core.js"),
  p = { ...F.defaults };
const near = (a, b, t = 1e-7) => assert.ok(Math.abs(a - b) < t, `${a} != ${b}`);
near(F.response("open", p, p.K / (2 * Math.PI)).gain, 1);
near(F.response("closed", p, p.K / (2 * Math.PI)).db, -3.01029995664);
near(F.response("closed", p, p.K / (2 * Math.PI)).degrees, -45);
near(F.response("mechanism", p, 100 / (2 * Math.PI)).gain, 5);
near(F.response("mechanism", p, 100 / (2 * Math.PI)).degrees, -90);
near(F.response("combined", p, 100 / (2 * Math.PI)).degrees, -180);
for (const c of F.cases) near(F.output(c.id, p, 0, true), 0);
for (const damping of [20, 200, 500])
  for (const id of ["mechanism", "combined"]) {
    const q = { ...p, c: damping, f: 3 },
      dt = 1e-5,
      t = 0.17;
    const y = F.output(id, q, t, true),
      v =
        (F.output(id, q, t + dt, true) - F.output(id, q, t - dt, true)) /
        (2 * dt),
      acc =
        (F.output(id, q, t + dt, true) -
          2 * y +
          F.output(id, q, t - dt, true)) /
        (dt * dt);
    const forcing =
      id === "mechanism"
        ? q.k * q.A * Math.sin(2 * Math.PI * q.f * t)
        : ((q.k * q.K * q.A) / (2 * Math.PI * q.f)) *
          (1 - Math.cos(2 * Math.PI * q.f * t));
    near(q.m * acc + q.c * v + q.k * y, forcing, 0.05);
    near(
      (F.output(id, q, dt, true) - F.output(id, q, -dt, true)) / (2 * dt),
      0,
      1e-5,
    );
  }
const f = 2,
  w = 2 * Math.PI * f,
  q = { ...p, f };
near(F.output("open", q, 1 / (2 * f), true), (2 * p.A * p.K) / w);
for (const id of ["closed", "mechanism", "combined"]) {
  const offset = id === "combined" ? (p.A * p.K) / w : 0;
  near(F.output(id, q, 10, true) - F.output(id, q, 10, false), offset, 1e-7);
}
console.log(
  "FRF benchmarks, initial conditions, under/critical/overdamped ODE residuals, and long-time responses passed.",
);
for (const [K, status] of [
  [5, "stable"],
  [15, "stable"],
  [20, "marginal"],
  [25, "unstable"],
])
  assert.equal(F.stability({ ...p, K }), status);
near(F.response("feedback", p, 1e-7).gain, 1, 1e-10);
near(F.response("feedback", p, 100 / (2 * Math.PI)).gain, 1);
near(F.response("feedback", p, 100 / (2 * Math.PI)).degrees, -180);
assert.ok(
  Number.isNaN(
    F.response("feedback", { ...p, K: 20 }, 100 / (2 * Math.PI)).gain,
  ),
);
// Independently integrate the physical state equations using fine-step RK4.
for (const K of [5, 15, 20, 25]) {
  const q = { ...p, K, f: 7 },
    dt = 0.00001,
    total = 0.2;
  let x = [0, 0, 0];
  const deriv = (t, s) => [
    K * (q.A * Math.sin(2 * Math.PI * q.f * t) - s[1]),
    s[2],
    (q.k * (s[0] - s[1]) - q.c * s[2]) / q.m,
  ];
  for (let i = 0; i < 20000; i++) {
    const t = i * dt,
      a = deriv(t, x),
      b = deriv(
        t + dt / 2,
        x.map((v, j) => v + (dt * a[j]) / 2),
      ),
      c = deriv(
        t + dt / 2,
        x.map((v, j) => v + (dt * b[j]) / 2),
      ),
      d = deriv(
        t + dt,
        x.map((v, j) => v + dt * c[j]),
      );
    x = x.map((v, j) => v + (dt * (a[j] + 2 * b[j] + 2 * c[j] + d[j])) / 6);
  }
  near(F.feedbackTrajectory(q, total, 100).points.at(-1)[1], x[1], 1e-8);
}
const stable = { ...p, K: 5, f: 2 };
near(
  F.feedbackTrajectory(stable, 10, 1600).points.at(-1)[1],
  F.output("feedback", stable, 10),
  1e-7,
);
const unstable = F.feedbackTrajectory({ ...p, K: 25 }, 10, 4000);
assert.ok(unstable.limited || Math.abs(unstable.points.at(-1)[1]) > 10);
const boundary = { ...p, K: 20, f: 100 / (2 * Math.PI) };
assert.ok(
  Math.abs(F.feedbackTrajectory(boundary, 2 * Math.PI, 4000).points.at(-1)[1]) >
    5,
);
console.log(
  "Feedback: stability thresholds, singular FRF, independent RK4 comparison, stable settling, unstable growth, and resonant boundary passed.",
);
// Spring-end motion obeys both controller kinematics and mechanical dynamics.
for (const id of ["mechanism", "combined", "feedback"]) {
  const q = { ...p, f: 3 },
    t = 0.143,
    dt = 1e-5,
    w = 2 * Math.PI * q.f;
  const y = F.output(id, q, t),
    v = (F.output(id, q, t + dt) - F.output(id, q, t - dt)) / (2 * dt),
    acc =
      (F.output(id, q, t + dt) - 2 * y + F.output(id, q, t - dt)) / (dt * dt),
    z = F.springEnd(id, q, t);
  near(q.m * acc + q.c * v + q.k * y, q.k * z, 0.02);
  if (id === "feedback") {
    const zdot =
      (F.springEnd(id, q, t + dt) - F.springEnd(id, q, t - dt)) / (2 * dt);
    near(zdot, q.K * (q.A * Math.sin(w * t) - y), 1e-5);
  }
}
const motion = F.feedbackTrajectory(p, 0.3, 3000).points,
  i = 1500,
  dt = motion[1][0];
near(
  (motion[i + 1][2] - motion[i - 1][2]) / (2 * dt),
  p.K * (p.A * Math.sin(2 * Math.PI * p.f * motion[i][0]) - motion[i][1]),
  1e-5,
);
near((motion[i + 1][1] - motion[i - 1][1]) / (2 * dt), motion[i][3], 1e-5);
console.log(
  "Animation spring-end positions, controller motion, and mass velocities passed.",
);
