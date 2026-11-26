import {
  mkdtempSync,
  cpSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const temporary = mkdtempSync(join(tmpdir(), "arms-teaching-models-"));
try {
  // UMD model engines are tested in CommonJS, matching the original package.
  cpSync(
    new URL("../public/teaching/mechatronics/", import.meta.url),
    temporary,
    {
      recursive: true,
    },
  );
  cpSync(new URL("../tests/teaching-models/", import.meta.url), temporary, {
    recursive: true,
  });
  writeFileSync(join(temporary, "package.json"), '{"type":"commonjs"}\n');
  const tests = readdirSync(temporary).filter((name) =>
    name.endsWith(".test.cjs"),
  );
  for (const name of tests.sort()) {
    const result = spawnSync(process.execPath, [join(temporary, name)], {
      stdio: "inherit",
    });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`${name} failed`);
  }
  console.log(`Passed all ${tests.length} teaching model suites.`);
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
