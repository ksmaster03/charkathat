/**
 * Provider contract.
 *
 * Every backend (Gemini, OpenAI, HuggingFace, ...) implements this interface so
 * the registry can treat them uniformly and the pipeline never has to know who
 * actually rendered an image. Providers declare their {@link Capabilities} so
 * the registry can pick the right one for a given job automatically.
 */

import type {
  Capabilities,
  EditRequest,
  GenerateRequest,
  GenResult,
} from "../types.js";

export interface Provider {
  /** Stable id used in config, CLI flags, and the registry (e.g. "gemini"). */
  readonly id: string;
  /** Human-readable name for logs and the gallery. */
  readonly displayName: string;
  readonly capabilities: Capabilities;

  /** True when the necessary API key/config is present. */
  isConfigured(): boolean;

  /** Text-to-image. */
  generate(req: GenerateRequest): Promise<GenResult>;

  /** Image editing (only call when capabilities.edit is true). */
  edit?(req: EditRequest): Promise<GenResult>;

  /** Optional dynamic model discovery (e.g. Gemini lists image models). */
  listModels?(): Promise<string[]>;
}

/**
 * Run an async operation with a hard timeout via AbortController, returning a
 * typed GenResult on timeout instead of throwing — keeps the fallback loop in
 * the registry simple (it just inspects `success`).
 */
export async function withTimeout(
  timeoutMs: number,
  run: (signal: AbortSignal) => Promise<GenResult>,
): Promise<GenResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await run(controller.signal);
  } catch (error) {
    if (controller.signal.aborted) {
      return {
        success: false,
        errorCode: "REQUEST_TIMEOUT",
        error: `Request timed out after ${timeoutMs}ms`,
      };
    }
    return {
      success: false,
      errorCode: "PROVIDER_ERROR",
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timer);
  }
}
