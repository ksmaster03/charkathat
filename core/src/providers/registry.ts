/**
 * Provider registry — the brain behind "Claude picks the best provider".
 *
 * Given a job's {@link JobHints}, it ranks the *configured* providers by how
 * well their declared {@link Capabilities} match, and returns an ordered
 * fallback chain. The pipeline walks that chain, moving to the next provider if
 * one fails (error / timeout / rate limit), which is what makes generation
 * resilient without the caller knowing which backend ran.
 */

import type { Provider } from "./base.js";
import { GeminiProvider } from "./gemini.js";
import { OpenAIProvider } from "./openai.js";
import { HuggingFaceProvider } from "./huggingface.js";
import type { RuntimeConfig } from "../config.js";
import type { JobHints } from "../types.js";

export class ProviderRegistry {
  private readonly providers: Provider[];

  constructor(private readonly config: RuntimeConfig) {
    this.providers = [
      new GeminiProvider(
        config.keys.gemini,
        config.geminiDefaultModel,
        config.requestTimeoutMs,
      ),
      new OpenAIProvider(
        config.keys.openai,
        config.openaiDefaultModel,
        config.requestTimeoutMs,
      ),
      new HuggingFaceProvider(
        config.keys.huggingface,
        config.huggingfaceModel,
        config.requestTimeoutMs,
      ),
    ];
  }

  all(): Provider[] {
    return this.providers;
  }

  configured(): Provider[] {
    return this.providers.filter((p) => p.isConfigured());
  }

  get(id: string): Provider | undefined {
    return this.providers.find((p) => p.id === id);
  }

  /**
   * Build the ordered fallback chain for a job. The first element is the best
   * match; later elements are tried only if earlier ones fail.
   */
  pickChain(hints: JobHints): Provider[] {
    const candidates = this.configured().filter((p) => this.canSatisfy(p, hints));

    // Explicit provider: honour it exactly, no substitution.
    if (hints.explicitProvider) {
      const exact = candidates.find((p) => p.id === hints.explicitProvider);
      return exact ? [exact] : [];
    }

    return candidates
      .map((p) => ({ p, score: this.score(p, hints) }))
      .sort((a, b) => b.score - a.score)
      .map((x) => x.p);
  }

  /** Hard requirements a provider must meet to even be considered. */
  private canSatisfy(p: Provider, hints: JobHints): boolean {
    const c = p.capabilities;
    if (hints.needsEdit && !c.edit) return false;
    if (hints.needsReferences && !c.referenceImages) return false;
    if (hints.aspectRatio && !c.aspectRatios.includes(hints.aspectRatio)) return false;
    return true;
  }

  /** Soft scoring: higher is better. Tuned to match jobs to provider strengths. */
  private score(p: Provider, hints: JobHints): number {
    const c = p.capabilities;
    let score = 0;

    if (hints.needsTypography && c.strengths.includes("typography")) score += 50;
    if (hints.needsVector && c.strengths.includes("vector")) score += 50;
    if (hints.needsReferences && c.strengths.includes("multimodal")) score += 40;
    if (hints.needsEdit && c.strengths.includes("multimodal")) score += 40;

    if (hints.preferSpeed) {
      if (c.speed === "fast") score += 30;
      else if (c.speed === "medium") score += 10;
    }
    if (hints.preferFree && c.costTier === 0) score += 30;

    // Mild general-quality bias toward higher-tier models when nothing else
    // distinguishes them, so the default experience favours quality.
    score += c.costTier * 2;

    // Operator preference acts as a tie-breaker nudge.
    if (this.config.preferredProvider && p.id === this.config.preferredProvider) {
      score += 15;
    }

    return score;
  }
}

/** Build a one-line capability summary for CLI `--list-providers` / docs. */
export function describeProvider(p: Provider): string {
  const c = p.capabilities;
  const flags = [
    c.edit ? "edit" : null,
    c.referenceImages ? `refs:${c.maxReferenceImages}` : null,
    c.costTier === 0 ? "free" : `cost:${c.costTier}`,
    `speed:${c.speed}`,
  ]
    .filter(Boolean)
    .join(" ");
  return `${p.id.padEnd(12)} ${p.isConfigured() ? "✓" : "·"}  ${flags}  [${c.strengths.join(", ")}]`;
}
