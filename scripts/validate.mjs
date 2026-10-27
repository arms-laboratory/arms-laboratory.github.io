import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "dist");
const htmlFiles = [];
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (name.endsWith(".html")) htmlFiles.push(path);
  }
}
walk(root);
const errors = [];
const external = new Set();
for (const file of htmlFiles) {
  const html = readFileSync(file, "utf8");
  const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
  for (const [, attr, value] of html.matchAll(/\b(href|src)="([^"]+)"/g)) {
    if (value.startsWith("https://")) {
      external.add(value);
      continue;
    }
    if (value.startsWith("mailto:") || value.startsWith("tel:")) continue;
    if (value.startsWith("http:") || value.startsWith("data:")) {
      errors.push(`${file}: disallowed ${attr} ${value.slice(0, 50)}`);
      continue;
    }
    const sitePath = file
      .slice(root.length)
      .replaceAll("\\", "/")
      .replace(/index\.html$/, "");
    const url = new URL(value, `https://arms.engr.ucdavis.edu${sitePath}`);
    const target = resolve(
      root,
      decodeURIComponent(url.pathname).slice(1),
      url.pathname.endsWith("/") ? "index.html" : "",
    );
    if (!target.startsWith(root) || !statExists(target)) {
      errors.push(`${file}: missing ${value}`);
      continue;
    }
    if (url.hash) {
      const targetIds =
        target === file
          ? ids
          : new Set(
              [...readFileSync(target, "utf8").matchAll(/\bid="([^"]+)"/g)].map(
                (m) => m[1],
              ),
            );
      if (!targetIds.has(decodeURIComponent(url.hash.slice(1))))
        errors.push(`${file}: missing anchor ${value}`);
    }
  }
}
function statExists(path) {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}
const pubs = readFileSync(join(root, "publications", "index.html"), "utf8");
if ([...pubs.matchAll(/class="pub-entry"/g)].length !== 44)
  errors.push("Expected exactly 44 publication records");
if (
  !readFileSync(join(root, "index.html"), "utf8").includes(
    "1FAIpQLSfzkuls8SktTR6h8LjhqNDLTKo2afUI3-cOIgn7XEoejJseMg",
  )
)
  errors.push("Student inquiry URL changed");
if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else
  console.log(
    `Validated ${htmlFiles.length} pages, 44 publications, internal links and anchors. ${external.size} unique external URLs for live checks.`,
  );
