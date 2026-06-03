/**
 * HuggingFace Inference provider — FLUX.1-schnell by default.
 *
 * The free serverless Inference API returns raw image bytes (not JSON) for
 * text-to-image models. It's fast and free, which makes it the ideal provider
 * for quick iterations / drafts and a zero-cost fallback. No edit support.
 *
 * Note: FLUX.1-schnell is a gated model — the account behind HF_TOKEN must have
 * accepted its license once at huggingface.co/black-forest-labs/FLUX.1-schnell.
 */

import { withTimeout, type Provider } from "./base.js";
import type {
  AspectRatio,
  Capabilities,
  GenerateRequest,
  GenResult,
} from "../types.js";

const CAPS: Capabilities = {
  textToImage: true,
  edit: false,
  referenceImages: false,
  maxReferenceImages: 0,
  aspectRatios: ["1:1", "16:9", "9:16", "4:3", "3:4"],
  strengths: ["fast", "cheap", "art", "photoreal"],
  speed: "fast",
  costTier: 0,
};

const DIMS: Record<string, { width: number; height: number }> = {
  "1:1": { width: 1024, height: 1024 },
  "16:9": { width: 1360, height: 768 },
  "9:16": { width: 768, height: 1360 },
  "4:3": { width: 1024, height: 768 },
  "3:4": { width: 768, height: 1024 },
};

export class HuggingFaceProvider implements Provider {
  readonly id = "huggingface";
  readonly displayName = "HuggingFace (FLUX.1-schnell)";
  readonly capabilities = CAPS;

  constructor(
    private readonly apiKey: string | undefined,
    private readonly model: string,
    private readonly defaultTimeoutMs: number,
  ) {}

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  async generate(req: GenerateRequest): Promise<GenResult> {
    const ratio = (req.aspectRatio ?? "1:1") as AspectRatio;
    const dims = DIMS[ratio] ?? DIMS["1:1"];
    const model = req.model || this.model;

    return withTimeout(req.timeoutMs ?? this.defaultTimeoutMs, async (signal) => {
      const res = await fetch(
        `https://api-inference.huggingface.co/models/${model}`,
        {
          method: "POST",
          signal,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
            Accept: "image/png",
          },
          body: JSON.stringify({
            inputs: req.prompt,
            parameters: { width: dims.width, height: dims.height },
          }),
        },
      );

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        return {
          success: false,
          errorCode: `HF_HTTP_${res.status}`,
          error: `HuggingFace error ${res.status}: ${text.slice(0, 300)}`,
        };
      }

      const contentType = res.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        // Model still loading, or an error payload.
        const text = await res.text().catch(() => "");
        return {
          success: false,
          errorCode: "HF_NOT_READY",
          error: `HuggingFace did not return an image: ${text.slice(0, 300)}`,
        };
      }

      const buf = Buffer.from(await res.arrayBuffer());
      return {
        success: true,
        base64Data: buf.toString("base64"),
        mimeType: contentType || "image/png",
        model,
      };
    });
  }
}
