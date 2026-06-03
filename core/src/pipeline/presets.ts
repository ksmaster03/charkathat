/**
 * Style templates & presets.
 *
 * A style file is a Markdown document with a `## Prompt Template` section
 * containing a fenced code block. The block may use a `{subject}` placeholder.
 * This lets a brand/style be captured once and reused for consistent output —
 * the same mechanism the user can extend with their own `.md` files.
 */

import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";

/**
 * Extract a prompt template from a `.md` style file.
 *
 * Looks for a fenced code block following a heading that contains the word
 * "Template" (e.g. "## Prompt Template" or "### Template"). Normalises common
 * placeholder spellings to `{subject}`.
 */
export function loadStyleTemplate(stylePath: string, baseDir: string): string {
  const resolved = isAbsolute(stylePath) ? stylePath : resolve(baseDir, stylePath);
  if (!existsSync(resolved)) {
    throw new Error(`Style file not found: ${resolved}`);
  }
  const content = readFileSync(resolved, "utf8");

  const pattern =
    /(?:#{1,3}\s*(?:Prompt\s*)?Template)[^\n]*\n+(?:.*?\n)*?```[^\n]*\n([\s\S]*?)```/i;
  const match = content.match(pattern);
  if (!match) {
    throw new Error(
      `No prompt template found in ${resolved}. Add a "## Prompt Template" section with a fenced code block.`,
    );
  }

  return normalisePlaceholder(match[1].trim());
}

/** Apply a subject to a template; if there's no placeholder, prepend it. */
export function applyTemplate(template: string, subject: string): string {
  if (template.includes("{subject}")) {
    return template.split("{subject}").join(subject);
  }
  return `${subject}. ${template}`;
}

function normalisePlaceholder(template: string): string {
  return template.replace(
    /\[YOUR SUBJECT[^\]]*\]|\[SUBJECT\]|\{\{\s*subject\s*\}\}/gi,
    "{subject}",
  );
}
