// Снимки экранов со словом "рабочее пространство" на тестовом демоне 6794: до и после плагина.
// node tests/browser/shots.mjs <папка для PNG> [dark]
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
const root = "http://127.0.0.1:6794";
const out = process.argv[2] || "/tmp/paseo-terms-shots";
const scheme = process.argv[3] === "dark" ? "dark" : "light";
mkdirSync(out, { recursive: true });
const b = await chromium.launch({ headless: true, channel: "chrome" });
const p = await b.newPage({ viewport: { width: 1560, height: 975 }, locale: "ru-RU", colorScheme: scheme });
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));
p.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
const shot = async (name) => { await p.waitForTimeout(400); await p.screenshot({ path: `${out}/${name}.png` }); };
const close = async () => { await p.keyboard.press("Escape"); await p.waitForTimeout(300); };

await p.goto(root);
await p.waitForTimeout(3000);
await p.getByText("Проверка").first().click();
await p.waitForTimeout(2000);
await shot("1-main");

// "+" у блока Диалоги/Папки: окно создания
await p.locator('[data-testid="dialogs-block"] button').first().click();
await shot("2-new-folder");
await close();

// меню группы: правый клик по строке группы, затем окно переименования
await p.locator('[data-testid="dialogs-block"]').getByText("agmazin", { exact: true }).click({ button: "right" });
await shot("3-group-menu");
await p.getByText("Переименовать", { exact: true }).click();
await shot("4-rename");
await close();

// родное меню рабочего пространства в шапке
await p.locator('[data-testid="workspace-header-menu-trigger"]').first().click();
await shot("5-header-menu");
await close();

// ⌘K
await p.locator("body").click({ position: { x: 900, y: 600 } });
await p.keyboard.press("Meta+k");
await shot("6-command-center");
await close();

// настройки
await p.locator('[aria-label="Настройки"], [aria-label="Settings"]').first().click().catch(() => {});
await p.waitForTimeout(1200);
await shot("7-settings");
await p.getByText(/^(Рабочие пространства|Папки)$/).filter({ visible: true }).first().click();
await p.waitForTimeout(1000);
await shot("8-settings-folders");
await p.getByText("Боковая панель", { exact: true }).first().click();
await p.waitForTimeout(1000);
await shot("9-settings-sidebar");
await p.getByText("Плагины", { exact: true }).first().click();
await p.waitForTimeout(1500);
await shot("10-settings-plugins");

console.log("errors", errors);
await b.close();
