// Разведка вёрстки Paseo: где лежат надписи со словом "пространств" и чат.
import { chromium } from "playwright";
const root = process.argv[2] || "http://127.0.0.1:6794";
const b = await chromium.launch({ headless: true, channel: "chrome" });
const p = await b.newPage({ viewport: { width: 1560, height: 975 }, locale: "ru-RU" });
await p.goto(root);
await p.waitForTimeout(3000);
await p.getByText("Проверка").first().click().catch(() => {});
await p.waitForTimeout(2500);
const found = await p.evaluate(() => {
  const chain = (el) => {
    const out = [];
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      const id = n.getAttribute("data-testid");
      const role = n.getAttribute("role");
      if (id || role || n.tagName !== "DIV") out.push(`${n.tagName.toLowerCase()}${id ? `#${id}` : ""}${role ? `[${role}]` : ""}`);
    }
    return out.slice(0, 8).join(" < ");
  };
  const rows = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode())
    if (/пространств/i.test(n.nodeValue)) rows.push(["text", n.nodeValue, chain(n.parentElement)]);
  for (const el of document.querySelectorAll("[aria-label],[placeholder],[title]"))
    for (const a of ["aria-label", "placeholder", "title"]) {
      const v = el.getAttribute(a);
      if (v && /пространств/i.test(v)) rows.push([a, v, chain(el)]);
    }
  return rows;
});
for (const r of found) console.log(r.join(" | "));
await p.screenshot({ path: "/tmp/paseo-terms-inspect.png" });
await b.close();
