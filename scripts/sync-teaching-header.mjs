import { readdirSync, readFileSync, writeFileSync } from "node:fs";

const directory = new URL("../public/teaching/mechatronics/", import.meta.url);
const template = readFileSync(
  new URL("./templates/teaching-header.html", import.meta.url),
  "utf8",
).replaceAll("{{assets}}", "../assets");
for (const name of readdirSync(directory).filter((name) =>
  name.endsWith(".html"),
)) {
  const path = new URL(name, directory);
  const original = readFileSync(path, "utf8");
  const updated = original.replace(
    /<!-- ARMS HEADER START -->[\s\S]*?<!-- ARMS HEADER END -->/,
    template.trim(),
  );
  if (
    updated === original &&
    !original.includes("<!-- ARMS HEADER START -->")
  ) {
    throw new Error(`Missing header markers in ${name}`);
  }
  writeFileSync(path, updated);
}
console.log("Synchronized the shared header across all teaching labs.");
