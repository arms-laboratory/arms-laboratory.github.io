const assert = require("node:assert/strict");
const { calculate, sketch, choices } = require("./timer-calculator-core.js");
let r = calculate();
assert.equal(r.best.divisor, 256);
assert.equal(r.best.ocr, 62499);
assert.equal(r.best.actual, 1);
const lecture = r.rows.find((r) => r.divisor === 1024);
assert.equal(lecture.ocr, 15624);
assert.equal(lecture.actual, 1);
r = calculate({ id: 1, clock: 16000000, frequency: 2 });
assert.equal(r.best.divisor, 256);
assert.equal(r.best.ocr, 31249);
assert.equal(calculate({ id: 0, clock: 16000000, frequency: 1 }).best, null);
assert.equal(
  calculate({ id: 1, clock: 16000000, frequency: 0.001 }).best,
  null,
);
assert.equal(
  calculate({ id: 1, clock: 16000000, frequency: 16000001 }).best,
  null,
);
r = calculate({ id: 0, clock: 16000000, frequency: 16000000 });
assert.equal(r.best.ocr, 0);
r = calculate({ id: 1, clock: 16000000, frequency: 16000000 / 1024 / 65536 });
assert.equal(r.best.ocr, 65535);
assert.throws(() => calculate({ frequency: 0 }));
assert.throws(() => calculate({ frequency: NaN }));
assert.throws(() => calculate({ clock: 16000000.5 }));
for (const id of [0, 1, 2]) {
  const c = calculate({ id, clock: 16000000, frequency: 1000 });
  assert.deepEqual(
    c.rows.map((x) => x.divisor),
    choices(id),
  );
  for (const row of c.rows.filter((x) => x.valid)) {
    const code = sketch(c, row);
    assert.ok(code.includes(`ISR(TIMER${id}_COMPA_vect)`));
    assert.ok(code.includes(`OCR${id}A = ${row.ocr};`));
    assert.ok(code.includes(`TIMSK${id} = _BV(OCIE${id}A)`));
    assert.ok(code.includes("ATOMIC_BLOCK(ATOMIC_RESTORESTATE)"));
    assert.ok(code.includes(id === 1 ? "_BV(WGM12)" : `_BV(WGM${id}1)`));
    for (let bit = 0; bit < 3; bit++)
      assert.equal(
        code.includes(`_BV(CS${id}${bit})`),
        !!(row.cs & (1 << bit)),
      );
    assert.equal(row.actual, 16000000 / row.divisor / (row.ocr + 1));
  }
}
// Independently brute-force every 8-bit count at every divisor to check ranking.
for (const id of [0, 2])
  for (const frequency of [61.1, 100, 999, 1234.56, 20000, 1000000]) {
    const c = calculate({ id, clock: 16000000, frequency });
    let best = Infinity;
    for (const d of choices(id))
      if (16000000 / d / frequency >= 1 && 16000000 / d / frequency <= 256)
        for (let k = 1; k <= 256; k++)
          best = Math.min(
            best,
            Math.abs(((16000000 / d / k - frequency) / frequency) * 100),
          );
    assert.ok(Math.abs(Math.abs(c.best.error) - best) < 1e-10);
  }
console.log(
  "Passed calculator checks: lecture examples, rounding, range limits, prescaler encodings, and generated code structure.",
);
r = calculate({ id: 0, clock: 16000000, frequency: 1, software: true });
assert.ok(r.best);
assert.equal(r.best.actual, 1);
assert.ok(r.best.softwareCount > 1);
assert.ok(r.best.ocr <= 255);
assert.ok(
  sketch(r, r.best).includes(
    `if (++interruptCount < ${r.best.softwareCount}UL) return;`,
  ),
);
r = calculate({ id: 1, clock: 16000000, frequency: 0.01, software: true });
assert.ok(r.best);
assert.equal(r.best.actual, 0.01);
assert.ok(r.best.softwareCount > 1);
assert.equal(
  calculate({ id: 0, clock: 16000000, frequency: 1e-20, software: true }).best,
  null,
);
console.log(
  "Passed ISR software-divider checks for 8-bit and 16-bit timers and counter overflow limits.",
);
r = calculate({ id: 2, clock: 16000000, frequency: 1, software: true });
assert.equal(r.best.divisor, 1024);
assert.equal(r.best.ocr, 124);
assert.equal(r.best.softwareCount, 125);
assert.equal(r.best.interruptRate, 125);
console.log(
  "Passed software auto-selection: exact one-second Timer2 task at 125 interrupts/s.",
);
