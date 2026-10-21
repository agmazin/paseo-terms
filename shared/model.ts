const SLOT = /\{\{(\w+)\}\}/g;
// Longer text is a sentence somebody wrote, not a Paseo label.
export const MAX = 400;

interface Template {
  pattern: RegExp;
  names: string[];
  target: string;
}

export interface Translator {
  translate(text: string): string | null;
}

function escape(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function template(source: string, target: string): Template {
  const names: string[] = [];
  let pattern = "^";
  let last = 0;
  for (const match of source.matchAll(SLOT)) {
    pattern += `${escape(source.slice(last, match.index))}(.+?)`;
    names.push(match[1]);
    last = match.index + match[0].length;
  }
  return { pattern: new RegExp(`${pattern}${escape(source.slice(last))}$`), names, target };
}

// Matches the whole text only: a phrase inside a longer sentence is left alone.
export function createTranslator(entries: ReadonlyArray<readonly [string, string]>): Translator {
  const exact = new Map<string, string>();
  const templates: Template[] = [];
  for (const [source, target] of entries) {
    if (source.includes("{{")) templates.push(template(source, target));
    else exact.set(source, target);
  }
  return {
    translate(text) {
      if (!text || text.length > MAX) return null;
      const core = text.trim();
      if (!core) return null;
      let next = exact.get(core);
      if (next === undefined) {
        for (const { pattern, names, target } of templates) {
          const match = pattern.exec(core);
          if (!match) continue;
          const values = new Map(names.map((name, i) => [name, match[i + 1]]));
          next = target.replace(SLOT, (_, name: string) => values.get(name) ?? "");
          break;
        }
      }
      if (next === undefined) return null;
      const start = text.indexOf(core);
      return text.slice(0, start) + next + text.slice(start + core.length);
    },
  };
}
