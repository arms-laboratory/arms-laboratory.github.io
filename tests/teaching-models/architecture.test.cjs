const assert = require("node:assert/strict");
const { Machine, alu, number } = require("./architecture-core.js");
const signed = (n) => (n < 128 ? n : n - 256);
// Check every pair of bytes against arithmetic definitions, independently of bit formulas.
for (let a = 0; a < 256; a++)
  for (let b = 0; b < 256; b++)
    for (const op of ["ADD", "SUB"]) {
      const r = alu(a, b, op, 0xc0),
        raw = op === "ADD" ? a + b : a - b,
        s = op === "ADD" ? signed(a) + signed(b) : signed(a) - signed(b);
      assert.equal(r.result, (raw + 256) % 256);
      assert.equal(r.status & 1, +(op === "ADD" ? raw > 255 : raw < 0));
      assert.equal((r.status >> 3) & 1, +(s > 127 || s < -128));
      assert.equal((r.status >> 1) & 1, +(r.result === 0));
      assert.equal((r.status >> 2) & 1, +(r.result >= 128));
      assert.equal(
        (r.status >> 4) & 1,
        ((r.status >> 2) ^ (r.status >> 3)) & 1,
      );
      assert.equal(
        (r.status >> 5) & 1,
        +(op === "ADD" ? (a % 16) + (b % 16) > 15 : (a % 16) - (b % 16) < 0),
      );
      assert.equal(r.status & 0xc0, 0xc0);
    }
for (const op of ["AND", "OR", "EOR"]) {
  const r = alu(0xaa, 0x55, op, 0xff);
  assert.equal(r.status & 0xe1, 0xe1);
  assert.equal(r.status & 8, 0);
}
const m = new Machine();
m.write(16, 255);
m.write(17, 1);
m.operate(16, 17, "ADD");
assert.equal(m.read(16), 0);
assert.equal(m.sreg, 35);
m.write(0x100, 0xa5);
assert.equal(m.read(0x100), 0xa5);
assert.equal(m.sp, 0x8ff);
assert.equal(m.push(0xaa), 0x8ff);
assert.equal(m.push(0xbb), 0x8fe);
assert.equal(m.sp, 0x8fd);
assert.equal(m.pop().value, 0xbb);
assert.equal(m.pop().value, 0xaa);
assert.equal(m.read(0x8ff), 0xaa);
assert.throws(() => m.pop());
for (let i = 0; i < 2048; i++) m.push(i & 255);
assert.equal(m.sp, 0xff);
assert.throws(() => m.push(0));
for (let i = 2047; i >= 0; i--) assert.equal(m.pop().value, i & 255);
m.write(0x24, 32);
m.write(0x25, 32);
assert.equal(m.pin(5), 1);
m.write(0x23, 32);
assert.equal(m.pin(5), 0);
m.write(0x24, 0);
assert.equal(m.pin(5), null);
m.write(0x25, 32);
assert.equal(m.pin(5), 1);
m.external[5] = 0;
assert.equal(m.pin(5), 0);
m.eeprom[0] = 0xa5;
const flash = m.flash[0];
m.powerToggle();
assert.equal(m.data[0x100], null);
assert.throws(() => m.read(0));
m.powerToggle();
assert.equal(m.eeprom[0], 0xa5);
assert.equal(m.flash[0], flash);
assert.equal(m.sp, 0x8ff);
assert.equal(m.data[16], null);
assert.throws(() => m.operate(16, 17, "ADD"));
assert.equal(m.sreg, 0);
assert.throws(() => m.write(0x900, 0));
assert.throws(() => m.write(0x60, 0));
assert.throws(() => m.write(0x5d, 0));
assert.equal(number("0b10100101"), 165);
assert.equal(number("0xFF"), 255);
for (const s of ["-1", "256", "", "1.5", "Infinity"])
  assert.throws(() => number(s));
console.log(
  "PASS: exhaustive ADD/SUB flags; logic preservation; shared state; GPIO; full stack boundaries; power persistence; input validation.",
);
// SFR storage is shared with bus access; reserved bits do not become settings.
const sfr = new Machine();
sfr.write(0x45, 3);
assert.equal(sfr.read(0x45), 3);
sfr.write(0x44, 255);
assert.equal(sfr.read(0x44), 0xf3);
sfr.write(0x45, 0x3f);
assert.equal(sfr.read(0x45), 0x0f);
assert.throws(() => sfr.write(0x45, 0xc0));
sfr.powerToggle();
sfr.powerToggle();
assert.equal(sfr.read(0x45), 0);
assert.deepEqual(
  sfr.flash.slice(0, 5),
  [0x0000, 0xe20a, 0x9110, 0x0100, 0xcffb],
);
console.log(
  "PASS: SFR clock/mode fields, reserved-bit masks, power reset, PC example Flash words.",
);
