/**
 * The orchestration layer — the single entry the CLI and MCP both call.
 *
 * Responsibilities, in order:
 *   1. Resolve the effective prompt (style template + enhancement).
 *   2. Derive job hints and ask the registry for a provider fallback chain.
 *   3. Generate (or edit) — walking the chain until one provider succeeds.
 *   4. Persist the image(s) and record them in the gallery/history.
 *   5. Return a normalised {@link AssetResponse}.
 */

import { ImageStorage } from "../storage.js";
import { Gallery } from "./gallery.js";
import { enhancePrompt, inferHints } from "./enhance.js";
import { applyTemplate, loadStyleTemplate } from "./presets.js";
import { ProviderRegistry } from "../providers/registry.js";
import type { Provider } from "../providers/base.js";
import type { RuntimeConfig } from "../config.js";
import type { Logger } from "../logger.js";
import type { CreateAssetArgs } from "../schemas.js";
import type {
  AssetResponse,
  EditRequest,
  GenResult,
  HistoryEntry,
  JobHints,
} from "../types.js";

export class Pipeline {
  private readonly registry: ProviderRegistry;
  private readonly storage: ImageStorage;
  private readonly gallery: Gallery;

  constructor(
    private readonly config: RuntimeConfig,
    private readonly logger: Logger,
    baseDir: string = process.cwd(),
  ) {
    this.registry = new ProviderRegistry(config);
    this.storage = new ImageStorage(config.outputDirectory, baseDir);
    this.gallery = new Gallery(this.storage.getOutputDirectory());
  }

  getRegistry(): ProviderRegistry {
    return this.registry;
  }

  getOutputDirectory(): string {
    return this.storage.getOutputDirectory();
  }

  async run(args: CreateAssetArgs): Promise<AssetResponse> {
    const warnings: string[] = [];

    // 1. Effective prompt: style template, then optional enhancement.
    let prompt = args.prompt;
    if (args.style) {
      try {
        const template = loadStyleTemplate(args.style, process.cwd());
        prompt = applyTemplate(template, args.prompt);
      } catch (error) {
        return this.fail("STYLE_ERROR", asMessage(error), warnings);
      }
    }
    if (args.enhance) {
      prompt = enhancePrompt(prompt);
    }

    const isEdit = Boolean(args.editImage);

    // 2. Job hints → provider chain.
    const inferred = inferHints(prompt);
    const hints: JobHints = {
      needsEdit: isEdit,
      needsReferences: Boolean(args.references?.length),
      needsTypography: inferred.needsTypography,
      needsVector: inferred.needsVector,
      aspectRatio: args.aspectRatio,
      explicitProvider: args.provider,
    };

    const chain = this.registry.pickChain(hints);
    if (chain.length === 0) {
      return this.fail(
        "NO_PROVIDER",
        this.noProviderMessage(hints),
        warnings,
      );
    }

    // 3 + 4. Generate count variations, each with full fallback, then persist.
    const count = args.count ?? 1;
    const saved: Array<{ filePath: string; provider: string; model: string }> = [];
    let lastError = "";

    for (let i = 0; i < count; i++) {
      const attempt = await this.generateOne(prompt, args, hints, chain, isEdit);
      if (!attempt.result.success || !attempt.result.base64Data) {
        lastError = attempt.result.error ?? "generation failed";
        warnings.push(...attempt.warnings);
        continue;
      }

      // Auto-name per variation unless a single explicit path was given.
      const explicitPath = count === 1 ? args.outputPath : undefined;
      const save = this.storage.saveImage(
        attempt.result.base64Data,
        explicitPath,
        attempt.result.mimeType ?? "image/png",
        args.prompt,
      );
      if (!save.success || !save.filePath) {
        lastError = save.error ?? "failed to save image";
        continue;
      }

      saved.push({
        filePath: save.filePath,
        provider: attempt.provider.id,
        model: attempt.result.model ?? "",
      });

      this.recordHistory({
        prompt,
        provider: attempt.provider,
        result: attempt.result,
        aspectRatio: args.aspectRatio ?? "1:1",
        filePath: save.filePath,
        fileName: save.fileName ?? "",
        kind: isEdit ? "edit" : "generate",
        index: i,
      });
      warnings.push(...attempt.warnings);
    }

    if (saved.length === 0) {
      return this.fail("GENERATION_FAILED", lastError, dedupe(warnings));
    }

    // 5. Gallery (default on for batches; opt-in flag otherwise).
    let galleryPath: string | undefined;
    if (args.gallery || count > 1) {
      galleryPath = this.gallery.renderHtml();
    }

    const first = saved[0];
    return {
      success: true,
      filePath: first.filePath,
      provider: first.provider,
      model: first.model,
      aspectRatio: args.aspectRatio ?? "1:1",
      prompt,
      results: saved.length > 1 ? saved : undefined,
      galleryPath,
      warnings: dedupe(warnings).length ? dedupe(warnings) : undefined,
    };
  }

  /** Try the providers in `chain` in order until one returns an image. */
  private async generateOne(
    prompt: string,
    args: CreateAssetArgs,
    hints: JobHints,
    chain: Provider[],
    isEdit: boolean,
  ): Promise<{ provider: Provider; result: GenResult; warnings: string[] }> {
    const warnings: string[] = [];
    let last: { provider: Provider; result: GenResult } | null = null;

    for (const provider of chain) {
      this.logger.info("Trying provider", { provider: provider.id, edit: isEdit });

      let result: GenResult;
      if (isEdit) {
        if (!provider.edit) {
          warnings.push(`${provider.id} cannot edit; skipping.`);
          continue;
        }
        const editReq = this.buildEditRequest(prompt, args);
        if ("error" in editReq) {
          return {
            provider,
            result: { success: false, errorCode: "INPUT_ERROR", error: editReq.error },
            warnings,
          };
        }
        result = await provider.edit(editReq);
      } else {
        result = await provider.generate({
          prompt,
          aspectRatio: args.aspectRatio,
          model: args.model,
        });
      }

      if (result.success) {
        if (last) {
          warnings.push(
            `Fell back to ${provider.id} after ${last.provider.id} failed.`,
          );
        }
        return { provider, result, warnings };
      }

      this.logger.warn("Provider failed", {
        provider: provider.id,
        error: result.error,
      });
      warnings.push(`${provider.id}: ${result.error ?? "failed"}`);
      last = { provider, result };
    }

    return (
      last
        ? { provider: last.provider, result: last.result, warnings }
        : {
            provider: chain[0],
            result: { success: false, error: "no provider produced an image" },
            warnings,
          }
    );
  }

  private buildEditRequest(
    prompt: string,
    args: CreateAssetArgs,
  ): EditRequest | { error: string } {
    try {
      const baseImage = this.storage.loadImage(args.editImage as string);
      const references = (args.references ?? []).map((p) => this.storage.loadImage(p));
      return { prompt, baseImage, references, aspectRatio: args.aspectRatio, model: args.model };
    } catch (error) {
      return { error: asMessage(error) };
    }
  }

  private recordHistory(input: {
    prompt: string;
    provider: Provider;
    result: GenResult;
    aspectRatio: string;
    filePath: string;
    fileName: string;
    kind: "generate" | "edit";
    index: number;
  }): void {
    const entry: HistoryEntry = {
      id: `${input.fileName}`,
      prompt: input.prompt,
      provider: input.provider.id,
      model: input.result.model ?? "",
      aspectRatio: input.aspectRatio,
      filePath: input.filePath,
      fileName: input.fileName,
      kind: input.kind,
      createdAt: new Date().toISOString(),
    };
    try {
      this.gallery.record(entry);
    } catch (error) {
      this.logger.warn("Failed to record history", { error: asMessage(error) });
    }
  }

  private noProviderMessage(hints: JobHints): string {
    const configured = this.registry.configured().map((p) => p.id);
    if (configured.length === 0) {
      return "No image provider is configured. Set GEMINI_API_KEY (recommended), OPENAI_API_KEY, or HF_TOKEN.";
    }
    if (hints.explicitProvider) {
      return `Provider "${hints.explicitProvider}" is not configured or cannot perform this job. Configured: ${configured.join(", ")}.`;
    }
    const need: string[] = [];
    if (hints.needsEdit) need.push("image editing");
    if (hints.needsReferences) need.push("reference images");
    return `No configured provider supports ${need.join(" + ") || "this request"}. Configured: ${configured.join(", ")}.`;
  }

  private fail(code: string, message: string, warnings: string[]): AssetResponse {
    return {
      success: false,
      errorCode: code,
      error: message,
      warnings: warnings.length ? warnings : undefined,
    };
  }
}

function asMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function dedupe(items: string[]): string[] {
  return [...new Set(items)];
}
