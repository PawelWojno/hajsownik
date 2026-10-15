// UI contract check: fails when a view file hardcodes colors (hex, rgb/hsl/oklch, Tailwind palette classes) or
// arbitrary px/rem values instead of using the tokens from src/styles/global.css.
// Zero dependencies on purpose (same as smoke.mjs).
//   node scripts/check-ui-tokens.mjs [file ...]   checks the given files (lint-staged passes the staged ones)
//   node scripts/check-ui-tokens.mjs              checks CLEAN_PATHS below (npm run check:ui)
// Add a view here once it is migrated to tokens, and add the same path to "lint-staged" in package.json.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const CLEAN_PATHS = [
  "src/pages/dashboard.astro",
  "src/pages/dev/dashboard-states.astro",
  "src/components/Topbar.astro",
  "src/components/auth/ServerError.tsx",
  "src/components/dev",
  "src/components/month",
];

const PALETTE =
  "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black";
const UTILITIES = "bg|text|border|ring|outline|from|via|to|fill|stroke|shadow|divide";
const HARDCODED = new RegExp(
  String.raw`#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|oklch\(|-\[[0-9.]+(px|rem)\]|\b(${UTILITIES})-(${PALETTE})\b`,
);

function expand(path) {
  if (!statSync(path).isDirectory()) return [path];
  return readdirSync(path)
    .filter((name) => /\.(tsx|astro)$/.test(name))
    .map((name) => join(path, name));
}

const args = process.argv.slice(2);
const files = (args.length > 0 ? args : CLEAN_PATHS).flatMap(expand);

let hits = 0;
for (const file of files) {
  readFileSync(file, "utf8")
    .split(/\r?\n/)
    .forEach((line, index) => {
      if (!HARDCODED.test(line)) return;
      hits += 1;
      console.error(`${file}:${index + 1}: ${line.trim()}`);
    });
}

if (hits > 0) {
  console.error(
    `\n${hits} hardcoded color/value(s). Use a token from src/styles/global.css (bg-primary, text-muted-foreground, ...).`,
  );
  process.exit(1);
}
console.log(`check-ui-tokens: ${files.length} file(s) clean`);
