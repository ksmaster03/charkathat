/**
 * Gallery + history manifest.
 *
 * Every generated image is appended to `history.json` in the output directory,
 * and an `index.html` gallery is (re)written so the user can browse everything
 * they've made, compare variations, and re-read the exact prompt/provider used.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import type { HistoryEntry } from "../types.js";

const HISTORY_FILE = "history.json";
const GALLERY_FILE = "index.html";

export class Gallery {
  constructor(private readonly outputDir: string) {}

  /** Append an entry to the manifest and return the full updated list. */
  record(entry: HistoryEntry): HistoryEntry[] {
    mkdirSync(this.outputDir, { recursive: true });
    const history = this.read();
    history.push(entry);
    writeFileSync(
      join(this.outputDir, HISTORY_FILE),
      JSON.stringify(history, null, 2),
      "utf8",
    );
    return history;
  }

  read(): HistoryEntry[] {
    const path = join(this.outputDir, HISTORY_FILE);
    if (!existsSync(path)) return [];
    try {
      return JSON.parse(readFileSync(path, "utf8")) as HistoryEntry[];
    } catch {
      return [];
    }
  }

  /** (Re)write the HTML gallery from the current manifest. Returns its path. */
  renderHtml(history?: HistoryEntry[]): string {
    const entries = (history ?? this.read()).slice().reverse(); // newest first
    const galleryPath = join(this.outputDir, GALLERY_FILE);
    mkdirSync(this.outputDir, { recursive: true });
    writeFileSync(galleryPath, this.html(entries, galleryPath), "utf8");
    return galleryPath;
  }

  private html(entries: HistoryEntry[], galleryPath: string): string {
    const cards = entries
      .map((e) => {
        const src = toRelative(galleryPath, e.filePath);
        const prompt = escapeHtml(e.prompt);
        const meta = escapeHtml(
          `${e.provider} · ${e.model} · ${e.aspectRatio} · ${e.kind}`,
        );
        return `      <figure class="card">
        <a href="${src}" target="_blank"><img src="${src}" loading="lazy" alt="${prompt}"></a>
        <figcaption>
          <p class="prompt">${prompt}</p>
          <p class="meta">${meta}</p>
          <time>${escapeHtml(e.createdAt)}</time>
        </figcaption>
      </figure>`;
      })
      .join("\n");

    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>charkathat · gallery (${entries.length})</title>
  <style>
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: ui-sans-serif, system-ui, "Segoe UI", sans-serif;
           background: #0b0d12; color: #e8eaed; padding: 24px; }
    header { display: flex; align-items: baseline; gap: 12px; margin-bottom: 20px; }
    h1 { font-size: 20px; margin: 0; }
    .count { color: #8a93a6; font-size: 13px; }
    .grid { display: grid; gap: 16px;
            grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); }
    .card { margin: 0; background: #151922; border: 1px solid #232a36;
            border-radius: 12px; overflow: hidden; display: flex; flex-direction: column; }
    .card img { width: 100%; aspect-ratio: 1 / 1; object-fit: cover; display: block;
                background: #0b0d12; }
    figcaption { padding: 12px; }
    .prompt { margin: 0 0 8px; font-size: 13px; line-height: 1.4; }
    .meta { margin: 0; font-size: 11px; color: #6ee7b7; }
    time { font-size: 11px; color: #8a93a6; }
    .empty { color: #8a93a6; }
  </style>
</head>
<body>
  <header>
    <h1>charkathat gallery</h1>
    <span class="count">${entries.length} image${entries.length === 1 ? "" : "s"}</span>
  </header>
  <div class="grid">
${cards || '    <p class="empty">No images yet.</p>'}
  </div>
</body>
</html>
`;
  }
}

function toRelative(galleryPath: string, target: string): string {
  const rel = relative(dirname(galleryPath), target);
  // Use forward slashes so the path works in the browser on Windows too.
  return rel.split("\\").join("/");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
