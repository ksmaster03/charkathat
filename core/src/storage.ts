/**
 * Image persistence + path resolution.
 *
 * The tricky part on Claude Code plugins is the *current working directory*:
 * the plugin executes from its own cache dir, so relative output paths would
 * land inside the plugin cache instead of the user's project. Callers pass a
 * `baseDir` (the user's real cwd) and we resolve every relative path against it.
 */

import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { dirname, isAbsolute, join, resolve, extname, basename } from "node:path";
import type { ImageInput } from "./types.js";

const MIME_EXT: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/webp": ".webp",
};

export class ImageStorage {
  /**
   * @param outputDirectory Default directory for auto-named files.
   * @param baseDir         The user's project root; relative paths resolve here.
   */
  constructor(
    private readonly outputDirectory: string,
    private readonly baseDir: string = process.cwd(),
  ) {}

  getOutputDirectory(): string {
    return isAbsolute(this.outputDirectory)
      ? this.outputDirectory
      : resolve(this.baseDir, this.outputDirectory);
  }

  /** Resolve a user-supplied path against the project root (not the plugin cache). */
  resolvePath(p: string): string {
    return isAbsolute(p) ? p : resolve(this.baseDir, p);
  }

  /**
   * Save base64 image bytes to disk.
   *
   * @param outputPath Optional caller path. Relative => resolved against baseDir.
   *                   Absent => auto-named inside the output directory.
   */
  saveImage(
    base64Data: string,
    outputPath: string | undefined,
    mimeType: string,
    seed?: string,
  ): { success: boolean; filePath?: string; fileName?: string; error?: string } {
    try {
      const ext = MIME_EXT[mimeType] ?? ".png";
      let target: string;

      if (outputPath) {
        target = this.resolvePath(outputPath);
        // If the caller gave a path with no extension, append the mime ext.
        if (!extname(target)) target = `${target}${ext}`;
      } else {
        const dir = this.getOutputDirectory();
        target = join(dir, this.autoName(ext, seed));
      }

      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, Buffer.from(base64Data, "base64"));
      return { success: true, filePath: target, fileName: basename(target) };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /** Load an on-disk image into an {@link ImageInput} for edit/reference use. */
  loadImage(path: string): ImageInput {
    const resolved = this.resolvePath(path);
    if (!existsSync(resolved)) {
      throw new Error(`Image not found: ${resolved}`);
    }
    const buf = readFileSync(resolved);
    return { base64: buf.toString("base64"), mimeType: mimeFromExt(resolved) };
  }

  /**
   * Build an ASCII-safe, collision-resistant filename. We avoid Date.now() with
   * a monotonic counter + a slug of the seed so names stay readable and unique
   * within a batch without leaking locale/encoding issues onto Windows.
   */
  private counter = 0;
  private autoName(ext: string, seed?: string): string {
    const slug = seed
      ? seed
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .slice(0, 40)
      : "image";
    const n = (++this.counter).toString().padStart(3, "0");
    const stamp = process.hrtime
      ? process.hrtime.bigint().toString(36).slice(-8)
      : "0";
    return `${slug || "image"}-${stamp}-${n}${ext}`;
  }
}

function mimeFromExt(path: string): string {
  switch (extname(path).toLowerCase()) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    default:
      return "image/png";
  }
}
