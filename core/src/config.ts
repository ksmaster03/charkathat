/**
 * Runtime configuration: environment variables + an optional .env file.
 *
 * We deliberately avoid a dotenv dependency — a tiny inline parser keeps the
 * single-file bundle lean and predictable across Windows/macOS/Linux.
 *
 * Lookup order for each value: process.env  >  ~/.config/charkathat/.env.
 */

import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { LogLevel } from "./logger.js";

export interface RuntimeConfig {
  /** Provider API keys, keyed by the env var name. */
  keys: {
    gemini?: string;
    openai?: string;
    huggingface?: string;
  };
  /** Default model used when the chosen provider gets no explicit model. */
  geminiDefaultModel: string;
  openaiDefaultModel: string;
  huggingfaceModel: string;
  /** Where images land when no absolute output path is given. */
  outputDirectory: string;
  requestTimeoutMs: number;
  logLevel: LogLevel;
  /** Provider id preferred when several are equally suitable. */
  preferredProvider?: string;
}

/** Parse a flat KEY=value .env file. Ignores comments and blank lines. */
function parseEnvFile(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  const text = readFileSync(path, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    // Strip surrounding quotes if present.
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key) out[key] = value;
  }
  return out;
}

/** Merge file-based config under process.env (process.env wins). */
function loadDotEnv(): Record<string, string> {
  const candidates = [
    join(homedir(), ".config", "charkathat", ".env"),
    join(process.cwd(), ".env"),
  ];
  const merged: Record<string, string> = {};
  for (const path of candidates) {
    if (existsSync(path)) {
      Object.assign(merged, parseEnvFile(path));
    }
  }
  return merged;
}

function pick(
  fileEnv: Record<string, string>,
  ...names: string[]
): string | undefined {
  for (const name of names) {
    const fromProcess = process.env[name];
    if (fromProcess && fromProcess.trim()) return fromProcess.trim();
    const fromFile = fileEnv[name];
    if (fromFile && fromFile.trim()) return fromFile.trim();
  }
  return undefined;
}

export function createRuntimeConfig(): RuntimeConfig {
  const fileEnv = loadDotEnv();

  const timeoutRaw = pick(fileEnv, "CHARKATHAT_REQUEST_TIMEOUT_MS", "GEMINI_REQUEST_TIMEOUT_MS");
  const timeout = timeoutRaw ? Number.parseInt(timeoutRaw, 10) : NaN;

  return {
    keys: {
      // Accept both the namespaced and the upstream-common names.
      gemini: pick(fileEnv, "CHARKATHAT_GEMINI_API_KEY", "GEMINI_API_KEY", "GOOGLE_AI_API_KEY"),
      openai: pick(fileEnv, "CHARKATHAT_OPENAI_API_KEY", "OPENAI_API_KEY"),
      huggingface: pick(fileEnv, "CHARKATHAT_HF_TOKEN", "HF_TOKEN", "HUGGINGFACE_API_KEY"),
    },
    geminiDefaultModel:
      pick(fileEnv, "CHARKATHAT_GEMINI_MODEL", "GEMINI_DEFAULT_MODEL") ??
      "gemini-3-pro-image-preview",
    openaiDefaultModel:
      pick(fileEnv, "CHARKATHAT_OPENAI_MODEL") ?? "gpt-image-1",
    huggingfaceModel:
      pick(fileEnv, "CHARKATHAT_HF_MODEL") ?? "black-forest-labs/FLUX.1-schnell",
    outputDirectory:
      pick(fileEnv, "CHARKATHAT_OUTPUT_DIR", "IMAGE_OUTPUT_DIR") ?? "charkathat-output",
    requestTimeoutMs: Number.isFinite(timeout) && timeout > 0 ? timeout : 90_000,
    logLevel: (pick(fileEnv, "CHARKATHAT_LOG_LEVEL", "MEDIA_PIPELINE_LOG_LEVEL") ??
      "info") as LogLevel,
    preferredProvider: pick(fileEnv, "CHARKATHAT_PREFERRED_PROVIDER"),
  };
}
