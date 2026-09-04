const fs = require("fs");
const path = require("path");

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(fullPath));
    } else if (file.endsWith(".tsx") || file.endsWith(".ts")) {
      results.push(fullPath);
    }
  });
  return results;
}

const files = walk("./src");
const en = JSON.parse(fs.readFileSync("./src/locales/en.json", "utf8"));
const ar = JSON.parse(fs.readFileSync("./src/locales/ar.json", "utf8"));

function getNested(obj, keyPath) {
  const parts = keyPath.split(".");
  let cur = obj;
  for (const p of parts) {
    if (cur === undefined || cur === null || typeof cur !== "object") return undefined;
    cur = cur[p];
  }
  return cur;
}

const usedKeys = new Set();
files.forEach(f => {
  const content = fs.readFileSync(f, "utf8");
  if (!content.includes("useTranslation") && !content.includes("i18n.t")) return;
  // Match t("key") or i18n.t("key")
  const matches = content.matchAll(/\b(?:t|i18n\.t)\(\s*["'\`]([a-zA-Z0-9_.]+)["'\`]/g);
  for (const m of matches) {
    usedKeys.add(m[1]);
  }
});

console.log("Total unique translation keys used in frontend components:", usedKeys.size);
const missingInEn = [];
const missingInAr = [];

for (const k of Array.from(usedKeys).sort()) {
  if (getNested(en, k) === undefined) missingInEn.push(k);
  if (getNested(ar, k) === undefined) missingInAr.push(k);
}

console.log("Missing in en.json:", missingInEn);
console.log("Missing in ar.json:", missingInAr);
