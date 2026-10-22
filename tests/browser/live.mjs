// Живая проверка "Терминов" на тестовом демоне 6794 в безголовом Chrome.
// Фикстура: пространство agmazin, агент "Проверка", ответ агента ровно "Новое рабочее пространство".
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
const root = "http://127.0.0.1:6794";
const cli = (...args) => execFileSync("paseo", [...args, "--host", "127.0.0.1:6794"], { encoding: "utf8" });
const b = await chromium.launch({ headless: true, channel: "chrome" });
const p = await b.newPage({ viewport: { width: 1560, height: 975 }, locale: "ru-RU" });
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));
p.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

// Всё, что осталось со словом "пространств" вне чата, полей и кода.
const leftovers = () => p.evaluate(() => {
  const content = '[data-testid="agent-chat-scroll"],[contenteditable],pre,code,textarea,input';
  const rows = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode())
    if (/пространств/i.test(n.nodeValue) && !n.parentElement.closest(content)) rows.push(n.nodeValue);
  for (const el of document.querySelectorAll("[aria-label],[placeholder],[title]"))
    for (const a of ["aria-label", "placeholder", "title"]) {
      const v = el.getAttribute(a);
      if (v && /пространств/i.test(v) && !el.closest('[data-testid="agent-chat-scroll"]')) rows.push(`${a}=${v}`);
    }
  return rows;
});
const check = async (where) => {
  await p.waitForTimeout(500);
  const rows = await leftovers();
  console.log(where, rows.length ? rows : "чисто");
  assert.deepEqual(rows, [], where);
};
const close = async () => { await p.keyboard.press("Escape"); await p.waitForTimeout(300); };

await p.goto(root);
await p.waitForTimeout(3000);
await p.getByText("Проверка").first().click();
await p.waitForTimeout(2000);
await check("главный экран");
assert.equal(await p.locator('[data-testid="sidebar-global-new-workspace"]').innerText(), "Новая папка");
assert.equal(await p.locator('[data-testid="dialogs-block"]').getByText("Диалоги", { exact: true }).count(), 1);

// чат не тронут
const reply = await p.locator('[data-testid="assistant-message"]').first().innerText();
assert.equal(reply.trim(), "Новое рабочее пространство");
assert.match(await p.locator('[data-testid="user-message"]').first().innerText(), /: Новое рабочее пространство\n/);

// поле ввода: набранный текст остаётся как есть
const composer = p.locator("textarea").first();
await composer.fill("Новое рабочее пространство");
await p.waitForTimeout(300);
assert.equal(await composer.inputValue(), "Новое рабочее пространство");
await composer.fill("");

// окно "+" у Папок
await p.locator('[data-testid="dialogs-block"] button').first().click();
await check("окно новой папки");
assert.equal(await p.getByText("Новая папка", { exact: true }).filter({ visible: true }).count(), 2);
assert.equal(await p.getByText(/^Каталог: AI OS \(public\)/).count(), 1);
await close();

// меню папки и переименование
await p.locator('[data-testid="dialogs-block"]').getByText("agmazin", { exact: true }).click({ button: "right" });
await p.getByText("Переименовать", { exact: true }).click();
await check("переименование");
assert.equal(await p.getByText("Переименовать папку", { exact: true }).count(), 1);
await close();

// родное меню в шапке
await p.locator('[data-testid="workspace-header-menu-trigger"]').first().click();
await check("меню в шапке");
await close();

// ⌘K: плейсхолдер и разделы
await p.locator("body").click({ position: { x: 900, y: 600 } });
await p.keyboard.press("Meta+k");
await p.waitForTimeout(500);
assert.equal(await p.locator('input[placeholder^="Поиск команд"]').getAttribute("placeholder"), "Поиск команд, файлов, папок и агентов...");
await check("⌘K");
await p.keyboard.type("раб");
await check("⌘K поиск");
await close();

// родной экран новой папки
await p.locator('[data-testid="sidebar-global-new-workspace"]').click();
await p.waitForTimeout(1000);
await check("родная новая папка");
await p.screenshot({ path: "/tmp/paseo-terms-native-new.png" });
await close();

// настройки
await p.keyboard.press("Meta+Comma");
await p.waitForTimeout(1000);
for (const page of ["Основные", "Боковая панель", "Папки", "Метаданные", "Проекты", "Плагины"]) {
  await p.getByText(page, { exact: true }).filter({ visible: true }).first().click();
  await check(`настройки: ${page}`);
}

// отключение плагина возвращает родные надписи
await p.goBack();
await p.waitForTimeout(1500);
cli("plugin", "disable", "paseo-terms");
await p.waitForTimeout(2500);
const off = await p.locator('[data-testid="sidebar-global-new-workspace"]').innerText();
console.log("после disable:", off);
cli("plugin", "enable", "paseo-terms");
await p.waitForTimeout(2500);
const on = await p.locator('[data-testid="sidebar-global-new-workspace"]').innerText();
console.log("после enable:", on);
assert.equal(off, "Новое рабочее пространство");
assert.equal(on, "Новая папка");

console.log("errors", errors);
assert.deepEqual(errors, []);
await b.close();
