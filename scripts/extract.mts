// Сверяет словарь с русской локалью из бандла Paseo после обновления приложения.
// node --experimental-strip-types scripts/extract.mts [путь к index-*.js]
// Пишет docs/phrases-<версия>.txt и печатает новые фразы (нужен перевод) и исчезнувшие (можно убрать).
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { phrases } from "../shared/dictionary.ts";

const APP = "/Applications/Paseo.app/Contents";
const WEB = `${APP}/Resources/app-dist/_expo/static/js/web`;
const WORD = /пространств/i;

const bundle = process.argv[2] ?? join(WEB, readdirSync(WEB).find((name) => /^index-.*\.js$/.test(name)) ?? "");
const source = readFileSync(bundle, "utf8");
const plist = readFileSync(`${APP}/Info.plist`, "utf8");
const version = /CFBundleShortVersionString<\/key>\s*<string>([^<]+)/.exec(plist)?.[1] ?? "unknown";

// Russian strings are stored as \uXXXX escapes inside double-quoted literals.
const found = new Set<string>();
for (const match of source.matchAll(/"((?:[^"\\\n]|\\.)*)"/g)) {
  if (!match[1].includes("\\u04") && !WORD.test(match[1])) continue;
  let text: string;
  try {
    text = JSON.parse(`"${match[1]}"`);
  } catch {
    continue;
  }
  if (WORD.test(text)) found.add(text);
}

const known = new Set(phrases.map(([from]) => from));
const fresh = [...found].filter((text) => !known.has(text));
const gone = [...known].filter((text) => !found.has(text));
const out = new URL(`../docs/phrases-${version}.txt`, import.meta.url);
writeFileSync(out, [...found].join("\n") + "\n");

console.log(`Paseo ${version}: ${found.size} фраз, в словаре ${known.size}`);
console.log(`Список: ${out.pathname}`);
for (const text of fresh) console.log(`НОВАЯ   ${text}`);
for (const text of gone) console.log(`НЕТ     ${text}`);
if (fresh.length) process.exitCode = 1;
