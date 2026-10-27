import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../dist/", import.meta.url));
const urls = new Set();
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (name.endsWith(".html"))
      for (const [, url] of readFileSync(path, "utf8").matchAll(
        /href="(https:\/\/[^" ]+)"/g,
      ))
        if (!url.startsWith("https://arms.engr.ucdavis.edu/"))
          urls.add(url.replaceAll("&amp;", "&"));
  }
}
walk(root);
const values = [...urls];
let cursor = 0;
const results = [];
await Promise.all(
  Array.from({ length: 6 }, async () => {
    while (cursor < values.length) {
      const url = values[cursor++];
      try {
        const response = await fetch(url, {
          method: "HEAD",
          redirect: "follow",
          signal: AbortSignal.timeout(12000),
          headers: { "User-Agent": "ARMS-site-link-review/1.0" },
        });
        results.push({ status: response.status, url });
      } catch (error) {
        results.push({
          status: "unreachable",
          url,
          reason: String(error.cause?.code || error.name),
        });
      }
    }
  }),
);
results.sort(
  (a, b) =>
    String(a.status).localeCompare(String(b.status)) ||
    a.url.localeCompare(b.url),
);
for (const result of results)
  console.log(
    `${result.status}\t${result.url}${result.reason ? `\t${result.reason}` : ""}`,
  );
