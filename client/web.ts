import { Platform } from "react-native";
import { phrases } from "../shared/dictionary";
import { createTranslator, MAX, type Translator } from "../shared/model";

// DOM is restricted to this module. Paseo 0.12 has no plugin API for its own texts,
// so labels are swapped on screen by exact whole-text match and nothing else is touched.
declare const document: any;
declare const window: any;
declare const MutationObserver: any;
declare const NodeFilter: any;

const ATTRS = ["aria-label", "placeholder", "title"];
// Written by the user or an agent: chat, code, terminals, editors.
const CONTENT = [
  '[data-testid="agent-chat-scroll"]',
  '[contenteditable]:not([contenteditable="false"])',
  "pre",
  "code",
  ".xterm",
  ".cm-editor",
  ".monaco-editor",
].join(",");
// Text inside a field is its value; the field's own placeholder and label are still Paseo's.
const FIELD = "textarea,input,select";
const SKIP_TEXT = `${CONTENT},${FIELD}`;
const TEXT = "__paseoTermsText";
const ATTR = "__paseoTermsAttrs";

function shared() {
  return window as { __paseoTerms?: { count: number; dispose: () => void } };
}

export function mountTerms(): () => void {
  if (Platform.OS !== "web" || typeof document === "undefined") return () => {};
  // One adapter per window even when several hosts load the plugin.
  const host = shared();
  if (host.__paseoTerms) {
    host.__paseoTerms.count++;
  } else {
    host.__paseoTerms = { count: 1, dispose: start(createTranslator(phrases)) };
  }
  let released = false;
  return () => {
    const state = host.__paseoTerms;
    if (released || !state) return;
    released = true;
    if (--state.count > 0) return;
    state.dispose();
    delete host.__paseoTerms;
  };
}

function start(terms: Translator): () => void {
  const withAttrs = ATTRS.map((name) => `[${name}]`).join(",");
  // What Paseo put into the node, even if the node currently shows our replacement.
  const original = (node: any): string => {
    const swap = node[TEXT];
    return swap && node.nodeValue === swap[1] ? swap[0] : node.nodeValue;
  };
  // Setting the same value would queue another mutation and loop.
  const write = (node: any, before: string, after: string) => {
    if (node.nodeValue === after) return;
    node[TEXT] = [before, after];
    node.nodeValue = after;
  };
  const textNodes = (root: any) => {
    const nodes = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) nodes.push(node);
    return nodes;
  };
  // ⌘K search splits a label around the highlighted letters: "Новое " + "раб" + "очее пространство".
  // The label is matched as a whole and written into its first text node; the other nodes stay, empty.
  const fixLabel = (start: any) => {
    if (start.closest(SKIP_TEXT)) return;
    for (let el = start, level = 0; el && el !== document.body && level < 3; el = el.parentElement, level++) {
      if (el.textContent.length > MAX) return;
      const nodes = textNodes(el);
      if (nodes.length < 2) continue;
      const before = nodes.map(original);
      const next = terms.translate(before.join(""));
      if (next === null) continue;
      nodes.forEach((node, i) => write(node, before[i], i === 0 ? next : ""));
      return;
    }
  };
  const fixText = (node: any) => {
    const parent = node.parentElement;
    if (!parent) return;
    const before = original(node);
    const next = terms.translate(before);
    if (next === null) return fixLabel(parent);
    if (!parent.closest(SKIP_TEXT)) write(node, before, next);
  };
  const fixAttr = (el: any, name: string) => {
    const value = el.getAttribute(name);
    const next = value && terms.translate(value);
    if (!next || el.closest(CONTENT)) return;
    el[ATTR] = { ...el[ATTR], [name]: [value, next] };
    el.setAttribute(name, next);
  };
  // Chat, fields and code are not walked at all.
  const skipContent = {
    acceptNode: (node: any) =>
      node.nodeType === 3 ? NodeFilter.FILTER_ACCEPT : node.matches(SKIP_TEXT) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_SKIP,
  };
  const scan = (root: any) => {
    if (root.nodeType === 3) return fixText(root);
    if (root.nodeType !== 1 || root.closest(SKIP_TEXT)) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, skipContent);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) fixText(node);
    for (const name of ATTRS) if (root.hasAttribute(name)) fixAttr(root, name);
    for (const el of root.querySelectorAll(withAttrs))
      for (const name of ATTRS) if (el.hasAttribute(name)) fixAttr(el, name);
  };
  // Runs before paint, so the original wording never flashes. Replaced text is not in the dictionary,
  // which ends the loop of our own mutations.
  const observer = new MutationObserver((records: any[]) => {
    for (const record of records) {
      if (record.type === "characterData") fixText(record.target);
      else if (record.type === "attributes") fixAttr(record.target, record.attributeName);
      else {
        for (const node of record.addedNodes) scan(node);
        if (record.removedNodes.length && record.target.nodeType === 1) fixLabel(record.target);
      }
    }
  });
  observer.observe(document.body, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ATTRS,
  });
  scan(document.body);
  return () => {
    observer.disconnect();
    // Puts Paseo's wording back where the node still shows our replacement.
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const swap = node[TEXT];
      if (swap && node.nodeValue === swap[1]) node.nodeValue = swap[0];
      delete node[TEXT];
    }
    for (const el of document.querySelectorAll(withAttrs)) {
      const swaps = el[ATTR];
      if (!swaps) continue;
      for (const [name, [before, after]] of Object.entries(swaps) as [string, [string, string]][])
        if (el.getAttribute(name) === after) el.setAttribute(name, before);
      delete el[ATTR];
    }
  };
}
