import { test } from "node:test";
import assert from "node:assert/strict";
import { phrases } from "../shared/dictionary.ts";
import { createTranslator } from "../shared/model.ts";

const terms = createTranslator(phrases);

test("every phrase becomes its folder form", () => {
  assert.equal(terms.translate("Новое рабочее пространство"), "Новая папка");
  assert.equal(terms.translate("Рабочие пространства"), "Папки");
  assert.equal(terms.translate("Архивировать рабочее пространство"), "Архивировать папку");
  assert.equal(terms.translate("Файлы рабочего пространства"), "Файлы папки");
  assert.equal(terms.translate("Нет подходящих рабочих пространств"), "Нет подходящих папок");
  assert.equal(
    terms.translate("Поиск команд, файлов, рабочих пространств и агентов..."),
    "Поиск команд, файлов, папок и агентов...",
  );
});

test("templates keep the inserted value", () => {
  assert.equal(terms.translate("Коммитов в рабочем пространстве: 3"), "Коммитов в папке: 3");
  assert.equal(terms.translate("Открыть рабочее пространство в Finder"), "Открыть папку в Finder");
  assert.equal(
    terms.translate("Создать новое рабочее пространство для AI OS (public)"),
    "Создать новую папку для AI OS (public)",
  );
  assert.equal(
    terms.translate("Метка будет снята с 5 рабочих пространств на этом хосте."),
    "Метка будет снята с 5 папок на этом хосте.",
  );
});

test("only the whole text is replaced", () => {
  assert.equal(terms.translate("Создай новое рабочее пространство"), null);
  assert.equal(terms.translate("Новое рабочее пространство!"), null);
  assert.equal(terms.translate("Что нужно сделать с рабочими пространствами?"), null);
  assert.equal(terms.translate("рабочее пространство"), null);
  assert.equal(terms.translate(""), null);
  assert.equal(terms.translate("  Рабочее пространство\n"), "  Папка\n");
});

test("replacements never match again and keep their slots", () => {
  const slots = (text: string) => [...text.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort();
  const sources = new Set<string>();
  for (const [from, to] of phrases) {
    assert.ok(!sources.has(from), `duplicate: ${from}`);
    sources.add(from);
    assert.equal(terms.translate(to), null, `loops: ${to}`);
    assert.deepEqual(slots(to), slots(from), `slots: ${from}`);
    assert.ok(!/пространств/i.test(to), `left: ${to}`);
    assert.ok(!/[\u2013\u2014\u00ab\u00bb\u201c\u201d\u201e\u007e\u20bd]/.test(to), `typography: ${to}`);
  }
  assert.equal(phrases.length, 60);
});
